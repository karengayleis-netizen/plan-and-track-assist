// functions/src/index.ts
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

interface LookupEmailData {
  email: string;
}

interface LookupEmailResponse {
  uid: string;
  email: string;
  displayName?: string | null;
}

async function assertIsAdmin(callerUid: string): Promise<void> {
  const roleDoc = await db.collection("user_roles").doc(callerUid).get();
  const role = roleDoc.exists ? roleDoc.data()?.role : null;

  if (role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Admin role required"
    );
  }
}

export const lookupUserByEmail = functions.https.onCall(
  async (data: LookupEmailData, context): Promise<LookupEmailResponse> => {
    // Require authentication
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in"
      );
    }

    // Require admin (server-side)
    await assertIsAdmin(context.auth.uid);

    // Validate + normalize email
    const emailRaw = (data?.email ?? "").toString();
    const email = emailRaw.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Valid email required"
      );
    }

    // Look up user by email in Firebase Auth
    try {
      const userRecord = await admin.auth().getUserByEmail(email);

      return {
        uid: userRecord.uid,
        email: (userRecord.email ?? email).toLowerCase(),
        displayName: userRecord.displayName ?? null,
      };
    } catch {
      throw new functions.https.HttpsError("not-found", "User not found");
    }
  }
);

// ── Diagnose Import Student IDs ──────────────────────────────────────────────
// Admin-only. Given a list of CSV student identifiers, classifies each as
// missingEverywhere | hiddenMissingSchoolId | hiddenWrongSchoolId |
// visibleMatch | duplicateExternalNumber. Uses Admin SDK so it can see docs
// outside the caller's schoolId-scoped roster query.

interface DiagnoseImportData {
  ids: string[];
}

type IdClassification =
  | "visibleMatch"
  | "missingEverywhere"
  | "hiddenMissingSchoolId"
  | "hiddenWrongSchoolId"
  | "duplicateExternalNumber";

interface IdDiagnosis {
  rawId: string;
  normalized: string;
  status: IdClassification;
  matchedField?: "externalStudentNumber" | "studentNumber" | "stableStudentId";
  docCount: number;
  docSchoolIds: string[];
}

interface DiagnoseImportResponse {
  callerSchoolId: string;
  results: IdDiagnosis[];
  rosterStats: {
    totalInSchool: number;
    withExternalStudentNumber: number;
    withStudentNumber: number;
    withStableStudentId: number;
  };
}

function normalizeId(v: unknown): string {
  const s = String(v ?? "").trim().replace(/\.0+$/, "");
  if (!s) return "";
  if (/^\d+$/.test(s)) return s.replace(/^0+/, "") || "0";
  return s.toLowerCase();
}

export const diagnoseImportStudentIds = functions.https.onCall(
  async (data: DiagnoseImportData, context): Promise<DiagnoseImportResponse> => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    await assertIsAdmin(context.auth.uid);

    const callerRoleDoc = await db.collection("user_roles").doc(context.auth.uid).get();
    const callerSchoolId = (callerRoleDoc.data()?.schoolId ?? "").toString();
    if (!callerSchoolId) {
      throw new functions.https.HttpsError("failed-precondition", "Caller has no schoolId");
    }

    const rawIds = Array.isArray(data?.ids) ? data.ids : [];
    if (rawIds.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "ids array required");
    }
    if (rawIds.length > 500) {
      throw new functions.https.HttpsError("invalid-argument", "Max 500 ids per call");
    }

    // Build full-roster index across ALL schools (admin SDK bypasses RLS).
    // Limited to fields we need so payload stays small.
    const studentsSnap = await db.collection("students").get();

    // Per-field maps: normalized value -> array of {schoolId, raw}
    type Hit = { schoolId: string; raw: string; field: IdDiagnosis["matchedField"] };
    const idxExternal = new Map<string, Hit[]>();
    const idxStudentNumber = new Map<string, Hit[]>();
    const idxStable = new Map<string, Hit[]>();

    let inSchoolTotal = 0;
    let inSchoolWithExt = 0;
    let inSchoolWithNum = 0;
    let inSchoolWithStable = 0;

    studentsSnap.forEach((d) => {
      const data = d.data() as any;
      const schoolId = (data.schoolId ?? "").toString();
      const ext = normalizeId(data.externalStudentNumber);
      const num = normalizeId(data.studentNumber);
      const stb = normalizeId(data.stableStudentId);

      if (schoolId === callerSchoolId) {
        inSchoolTotal++;
        if (ext) inSchoolWithExt++;
        if (num) inSchoolWithNum++;
        if (stb) inSchoolWithStable++;
      }

      if (ext) {
        const arr = idxExternal.get(ext) || [];
        arr.push({ schoolId, raw: String(data.externalStudentNumber ?? ""), field: "externalStudentNumber" });
        idxExternal.set(ext, arr);
      }
      if (num) {
        const arr = idxStudentNumber.get(num) || [];
        arr.push({ schoolId, raw: String(data.studentNumber ?? ""), field: "studentNumber" });
        idxStudentNumber.set(num, arr);
      }
      if (stb) {
        const arr = idxStable.get(stb) || [];
        arr.push({ schoolId, raw: String(data.stableStudentId ?? ""), field: "stableStudentId" });
        idxStable.set(stb, arr);
      }
    });

    const results: IdDiagnosis[] = rawIds.map((raw) => {
      const normalized = normalizeId(raw);
      if (!normalized) {
        return { rawId: raw, normalized, status: "missingEverywhere", docCount: 0, docSchoolIds: [] };
      }

      // Check external first, then studentNumber, then stable
      const allHits: Hit[] = [
        ...(idxExternal.get(normalized) || []),
        ...(idxStudentNumber.get(normalized) || []),
        ...(idxStable.get(normalized) || []),
      ];

      if (allHits.length === 0) {
        return { rawId: raw, normalized, status: "missingEverywhere", docCount: 0, docSchoolIds: [] };
      }

      const matchedField = allHits[0].field;
      const docSchoolIds = Array.from(new Set(allHits.map((h) => h.schoolId)));

      // Duplicates of the SAME id, even within one school, are ambiguous.
      const sameSchoolHits = allHits.filter((h) => h.schoolId === callerSchoolId);
      if (sameSchoolHits.length > 1) {
        return {
          rawId: raw, normalized, status: "duplicateExternalNumber",
          matchedField, docCount: allHits.length, docSchoolIds,
        };
      }

      if (sameSchoolHits.length === 1) {
        return {
          rawId: raw, normalized, status: "visibleMatch",
          matchedField, docCount: allHits.length, docSchoolIds,
        };
      }

      // No same-school hit but doc(s) exist elsewhere
      const hasMissingSchool = allHits.some((h) => !h.schoolId);
      if (hasMissingSchool) {
        return {
          rawId: raw, normalized, status: "hiddenMissingSchoolId",
          matchedField, docCount: allHits.length, docSchoolIds,
        };
      }
      return {
        rawId: raw, normalized, status: "hiddenWrongSchoolId",
        matchedField, docCount: allHits.length, docSchoolIds,
      };
    });

    return {
      callerSchoolId,
      results,
      rosterStats: {
        totalInSchool: inSchoolTotal,
        withExternalStudentNumber: inSchoolWithExt,
        withStudentNumber: inSchoolWithNum,
        withStableStudentId: inSchoolWithStable,
      },
    };
  }
);

// ── Backfill externalStudentNumber (server-side, bypasses rules) ────────────
// Admin-only. Accepts CSV-derived rows and writes the board number into
// each matched student's `externalStudentNumber`. Repairs missing schoolId
// on docs that match by (initials, homeroom) but have no schoolId yet.

interface BackfillInputRow {
  section?: string;
  ordinal?: string;
  initials?: string;
  homeroom?: string;
  boardNumber: string;
  rowIndex?: number;
}

interface BackfillInput {
  rows: BackfillInputRow[];
}

type BackfillAction =
  | "updated"
  | "alreadyCorrect"
  | "noMatch"
  | "ambiguous"
  | "errored"
  | "repairedSchoolIdAndUpdated"
  | "skippedInvalidInput";

interface BackfillRowResult {
  rowIndex: number;
  studentId?: string;
  studentNumber?: string;
  initials?: string;
  homeroom?: string;
  before?: string;
  after: string;
  action: BackfillAction;
  reason?: string;
}

interface BackfillResponse {
  callerSchoolId: string;
  totals: Record<BackfillAction, number>;
  results: BackfillRowResult[];
}

function normalizeBoard(v: unknown): string {
  const s = String(v ?? "").trim().replace(/\.0+$/, "");
  if (!s) return "";
  if (/^\d+$/.test(s)) return s.replace(/^0+/, "") || "0";
  return s;
}

function normalizeKey(v: unknown): string {
  return String(v ?? "").trim().toUpperCase();
}

export const backfillExternalStudentNumbers = functions.https.onCall(
  async (data: BackfillInput, context): Promise<BackfillResponse> => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    await assertIsAdmin(context.auth.uid);

    const callerRoleDoc = await db.collection("user_roles").doc(context.auth.uid).get();
    const callerSchoolId = (callerRoleDoc.data()?.schoolId ?? "").toString();
    if (!callerSchoolId) {
      throw new functions.https.HttpsError("failed-precondition", "Caller has no schoolId");
    }

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    if (rows.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "rows array required");
    }
    if (rows.length > 2000) {
      throw new functions.https.HttpsError("invalid-argument", "Max 2000 rows per call");
    }

    // Load all students once. Admin SDK bypasses rules.
    const studentsSnap = await db.collection("students").get();

    // Build lookups:
    //  - byCodedIdInSchool: studentNumber (e.g. "4F-14") within caller's school
    //  - byInitialsHomeroomInSchool: "INITIALS|HOMEROOM" within caller's school
    //  - byInitialsHomeroomNoSchool: same key but only docs where schoolId is empty
    type DocLite = {
      id: string;
      schoolId: string;
      studentNumber: string;
      initials: string;
      homeroom: string;
      externalStudentNumber: string;
    };
    const byCodedIdInSchool = new Map<string, DocLite[]>();
    const byInitHrInSchool = new Map<string, DocLite[]>();
    const byInitHrNoSchool = new Map<string, DocLite[]>();

    studentsSnap.forEach((d) => {
      const x = d.data() as any;
      const lite: DocLite = {
        id: d.id,
        schoolId: (x.schoolId ?? "").toString(),
        studentNumber: (x.studentNumber ?? "").toString(),
        initials: (x.initials ?? "").toString(),
        homeroom: (x.homeroom ?? x.className ?? "").toString(),
        externalStudentNumber: (x.externalStudentNumber ?? "").toString(),
      };

      const codedKey = normalizeKey(lite.studentNumber);
      const ihKey = `${normalizeKey(lite.initials)}|${normalizeKey(lite.homeroom)}`;

      if (lite.schoolId === callerSchoolId) {
        if (codedKey) {
          const a = byCodedIdInSchool.get(codedKey) || [];
          a.push(lite);
          byCodedIdInSchool.set(codedKey, a);
        }
        if (lite.initials && lite.homeroom) {
          const a = byInitHrInSchool.get(ihKey) || [];
          a.push(lite);
          byInitHrInSchool.set(ihKey, a);
        }
      } else if (!lite.schoolId) {
        // Hidden — no schoolId set. Eligible for repair via initials+homeroom.
        if (lite.initials && lite.homeroom) {
          const a = byInitHrNoSchool.get(ihKey) || [];
          a.push(lite);
          byInitHrNoSchool.set(ihKey, a);
        }
      }
    });

    const totals: Record<BackfillAction, number> = {
      updated: 0,
      alreadyCorrect: 0,
      noMatch: 0,
      ambiguous: 0,
      errored: 0,
      repairedSchoolIdAndUpdated: 0,
      skippedInvalidInput: 0,
    };
    const results: BackfillRowResult[] = [];

    let i = 0;
    for (const r of rows) {
      i++;
      const rowIndex = typeof r.rowIndex === "number" ? r.rowIndex : i;
      const board = normalizeBoard(r.boardNumber);
      if (!board) {
        totals.skippedInvalidInput++;
        results.push({
          rowIndex,
          after: "",
          action: "skippedInvalidInput",
          reason: "Missing/invalid boardNumber",
        });
        continue;
      }

      // Try coded ID first: "{section}-{ordinal}"
      let candidates: DocLite[] = [];
      let matchSource = "";
      const section = (r.section ?? "").toString().trim();
      const ordinal = (r.ordinal ?? "").toString().trim();
      if (section && ordinal) {
        const codedKey = normalizeKey(`${section}-${ordinal}`);
        const hits = byCodedIdInSchool.get(codedKey) || [];
        if (hits.length > 0) {
          candidates = hits;
          matchSource = "codedId";
        }
      }

      // Fallback: initials + homeroom in caller's school
      let repairingSchoolId = false;
      if (candidates.length === 0 && r.initials && r.homeroom) {
        const ihKey = `${normalizeKey(r.initials)}|${normalizeKey(r.homeroom)}`;
        const hits = byInitHrInSchool.get(ihKey) || [];
        if (hits.length > 0) {
          candidates = hits;
          matchSource = "initialsHomeroom";
        } else {
          // Last resort: docs with no schoolId (will repair)
          const orphan = byInitHrNoSchool.get(ihKey) || [];
          if (orphan.length > 0) {
            candidates = orphan;
            matchSource = "initialsHomeroomRepair";
            repairingSchoolId = true;
          }
        }
      }

      if (candidates.length === 0) {
        totals.noMatch++;
        results.push({
          rowIndex,
          initials: r.initials,
          homeroom: r.homeroom,
          after: board,
          action: "noMatch",
          reason: `No student matched by codedId(${section}-${ordinal}) or (initials,homeroom)=(${r.initials},${r.homeroom})`,
        });
        continue;
      }
      if (candidates.length > 1) {
        totals.ambiguous++;
        results.push({
          rowIndex,
          initials: r.initials,
          homeroom: r.homeroom,
          after: board,
          action: "ambiguous",
          reason: `Multiple candidates (${candidates.length}) via ${matchSource}: ${candidates.map(c => c.id).join(", ")}`,
        });
        continue;
      }

      const target = candidates[0];
      const before = normalizeBoard(target.externalStudentNumber);
      if (before === board && !repairingSchoolId) {
        totals.alreadyCorrect++;
        results.push({
          rowIndex,
          studentId: target.id,
          studentNumber: target.studentNumber,
          initials: target.initials,
          homeroom: target.homeroom,
          before: target.externalStudentNumber,
          after: board,
          action: "alreadyCorrect",
        });
        continue;
      }

      try {
        const update: any = {
          externalStudentNumber: board,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (repairingSchoolId) {
          update.schoolId = callerSchoolId;
        }
        await db.collection("students").doc(target.id).update(update);

        if (repairingSchoolId) {
          totals.repairedSchoolIdAndUpdated++;
        } else {
          totals.updated++;
        }
        results.push({
          rowIndex,
          studentId: target.id,
          studentNumber: target.studentNumber,
          initials: target.initials,
          homeroom: target.homeroom,
          before: target.externalStudentNumber,
          after: board,
          action: repairingSchoolId ? "repairedSchoolIdAndUpdated" : "updated",
        });
      } catch (err: any) {
        totals.errored++;
        results.push({
          rowIndex,
          studentId: target.id,
          studentNumber: target.studentNumber,
          initials: target.initials,
          homeroom: target.homeroom,
          before: target.externalStudentNumber,
          after: board,
          action: "errored",
          reason: err?.message || String(err),
        });
      }
    }

    return { callerSchoolId, totals, results };
  }
);

export const syncClaimsFromUserRoles = functions.firestore
  .document("user_roles/{uid}")
  .onWrite(async (change, context) => {
    const uid = context.params.uid;
    const after = change.after;

    if (!after.exists) {
      functions.logger.info("Role doc deleted. Clearing claims for uid:", uid);
      await admin.auth().setCustomUserClaims(uid, null);
      return;
    }

    const data = after.data() as any;
    const role = (data?.role ?? "").toString().trim();
    const schoolId = (data?.schoolId ?? "").toString().trim();

    const claims = {
      role: role || "teacher",
      schoolId: schoolId || "",
    };

    functions.logger.info("Setting claims for uid:", uid, claims);
    await admin.auth().setCustomUserClaims(uid, claims);
  });
