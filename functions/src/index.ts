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

// ── Force-set External Student Numbers by doc ID ────────────────────────────
// Admin-only. Bypasses all matching logic. Writes externalStudentNumber to a
// specific student doc and verifies via re-read.

type ForceSetAction =
  | "verified"
  | "verifyMismatch"
  | "alreadyCorrect"
  | "notFound"
  | "wrongSchool"
  | "errored"
  | "skippedInvalidInput";

interface ForceSetEntry {
  docId: string;
  externalStudentNumber: string;
}

interface ForceSetInput {
  entries: ForceSetEntry[];
}

interface ForceSetRowResult {
  docId: string;
  action: ForceSetAction;
  before?: string;
  after: string;
  actualAfterRead?: string;
  schoolId?: string;
  reason?: string;
}

interface ForceSetResponse {
  callerSchoolId: string;
  totals: Record<ForceSetAction, number>;
  results: ForceSetRowResult[];
}

export const forceSetExternalStudentNumbers = functions.https.onCall(
  async (data: ForceSetInput, context): Promise<ForceSetResponse> => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    await assertIsAdmin(context.auth.uid);

    const callerRoleDoc = await db.collection("user_roles").doc(context.auth.uid).get();
    const callerSchoolId = (callerRoleDoc.data()?.schoolId ?? "").toString();
    if (!callerSchoolId) {
      throw new functions.https.HttpsError("failed-precondition", "Caller has no schoolId");
    }

    const entries = Array.isArray(data?.entries) ? data.entries : [];
    if (entries.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "entries array required");
    }
    if (entries.length > 500) {
      throw new functions.https.HttpsError("invalid-argument", "Max 500 entries per call");
    }

    const totals: Record<ForceSetAction, number> = {
      verified: 0,
      verifyMismatch: 0,
      alreadyCorrect: 0,
      notFound: 0,
      wrongSchool: 0,
      errored: 0,
      skippedInvalidInput: 0,
    };
    const results: ForceSetRowResult[] = [];

    for (const e of entries) {
      const docId = (e?.docId ?? "").toString().trim();
      const board = normalizeBoard(e?.externalStudentNumber);
      if (!docId || !board) {
        totals.skippedInvalidInput++;
        results.push({
          docId,
          after: board,
          action: "skippedInvalidInput",
          reason: !docId ? "Missing docId" : "Missing/invalid externalStudentNumber",
        });
        continue;
      }

      try {
        const ref = db.collection("students").doc(docId);
        const snap = await ref.get();
        if (!snap.exists) {
          totals.notFound++;
          results.push({ docId, after: board, action: "notFound" });
          continue;
        }
        const cur = snap.data() as any;
        const curSchoolId = (cur?.schoolId ?? "").toString();
        const before = normalizeBoard(cur?.externalStudentNumber);

        if (curSchoolId && curSchoolId !== callerSchoolId) {
          totals.wrongSchool++;
          results.push({
            docId,
            before: cur?.externalStudentNumber,
            after: board,
            schoolId: curSchoolId,
            action: "wrongSchool",
            reason: `Doc schoolId=${curSchoolId} != caller ${callerSchoolId}`,
          });
          continue;
        }

        if (before === board) {
          totals.alreadyCorrect++;
          results.push({
            docId,
            before: cur?.externalStudentNumber,
            after: board,
            actualAfterRead: cur?.externalStudentNumber,
            schoolId: curSchoolId,
            action: "alreadyCorrect",
          });
          continue;
        }

        await ref.update({
          externalStudentNumber: board,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Re-read for definitive verification
        const verifySnap = await ref.get();
        const actualAfter = normalizeBoard((verifySnap.data() as any)?.externalStudentNumber);

        if (actualAfter === board) {
          totals.verified++;
          results.push({
            docId,
            before: cur?.externalStudentNumber,
            after: board,
            actualAfterRead: actualAfter,
            schoolId: curSchoolId,
            action: "verified",
          });
        } else {
          totals.verifyMismatch++;
          results.push({
            docId,
            before: cur?.externalStudentNumber,
            after: board,
            actualAfterRead: actualAfter,
            schoolId: curSchoolId,
            action: "verifyMismatch",
            reason: `After write, doc still reads ${actualAfter || "∅"}`,
          });
        }
      } catch (err: any) {
        totals.errored++;
        results.push({
          docId,
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

// ── Update Student Numbers from Board Roster ─────────────────────────────────
// Admin-only. Rewrites student docs so board Student Number becomes the canonical
// identifier across studentNumber / externalStudentNumber / stableStudentId.
// Old coded value (e.g. "4F-14") is preserved in displayCode.

interface UpdateNumbersRow {
  boardStudentNumber: string;
  initials: string;
  homeroom: string;
  grade?: string;
  gender?: string;
  oen?: string;
  sourceSheet?: string;
  rowIndex: number;
}

interface UpdateNumbersData {
  rows: UpdateNumbersRow[];
  dryRun: boolean;
  createMissing: boolean;
}

type UpdateAction = "update" | "create" | "ambiguous" | "skipped" | "alreadyMigrated" | "errored";

interface UpdateRowResult {
  rowIndex: number;
  action: UpdateAction;
  docId?: string;
  candidateIds?: string[];
  before?: {
    studentNumber?: string;
    externalStudentNumber?: string;
    stableStudentId?: string;
    displayCode?: string;
  };
  after?: {
    studentNumber?: string;
    externalStudentNumber?: string;
    stableStudentId?: string;
    displayCode?: string;
  };
  verified?: boolean;
  reason?: string;
  csvBoardNumber: string;
  csvInitials: string;
  csvHomeroom: string;
}

const normInitials = (s: string): string =>
  (s || "").replace(/\./g, "").replace(/\s+/g, "").toUpperCase().trim();

const normHomeroom = (s: string): string =>
  (s || "").toUpperCase().trim();

const homeroomStem = (s: string): string => {
  const norm = normHomeroom(s);
  const numMatch = norm.match(/^(\d+)/);
  if (numMatch) return numMatch[1];
  const letterMatch = norm.match(/^([A-Z]+)/);
  if (letterMatch) return letterMatch[1];
  return norm;
};

const normBoardNumber = (v: unknown): string => {
  const s = String(v ?? "").trim().replace(/\.0+$/, "");
  return s;
};

const looksLikeCodedId = (v: unknown): boolean => {
  const s = String(v ?? "").trim();
  return /^[A-Z0-9]+-\d+$/i.test(s);
};

export const updateStudentNumbersFromRoster = functions
  .runWith({ timeoutSeconds: 540, memory: "512MB" })
  .https.onCall(
    async (data: UpdateNumbersData, context) => {
      if (!context.auth?.uid) {
        throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
      }
      await assertIsAdmin(context.auth.uid);

      const callerRoleDoc = await db.collection("user_roles").doc(context.auth.uid).get();
      const callerSchoolId = (callerRoleDoc.data()?.schoolId ?? "").toString().trim();
      if (!callerSchoolId) {
        throw new functions.https.HttpsError("failed-precondition", "Caller has no schoolId");
      }

      const rows = Array.isArray(data?.rows) ? data.rows : [];
      const dryRun = !!data?.dryRun;
      const createMissing = !!data?.createMissing;

      // Load full school roster once
      const rosterSnap = await db
        .collection("students")
        .where("schoolId", "==", callerSchoolId)
        .get();

      interface RosterDoc {
        id: string;
        initials: string;
        homeroom: string;
        grade?: string;
        studentNumber?: string;
        externalStudentNumber?: string;
        stableStudentId?: string;
        displayCode?: string;
      }

      const roster: RosterDoc[] = rosterSnap.docs.map((d) => {
        const x = d.data() as any;
        return {
          id: d.id,
          initials: x.initials ?? "",
          homeroom: x.homeroom ?? "",
          grade: x.grade ?? "",
          studentNumber: x.studentNumber ?? "",
          externalStudentNumber: x.externalStudentNumber ?? "",
          stableStudentId: x.stableStudentId ?? "",
          displayCode: x.displayCode ?? "",
        };
      });

      const results: UpdateRowResult[] = [];
      const totals = {
        update: 0,
        create: 0,
        ambiguous: 0,
        skipped: 0,
        alreadyMigrated: 0,
        errored: 0,
        verified: 0,
        verifyFailed: 0,
      };

      const writes: Array<{
        rowIndex: number;
        kind: "update" | "create";
        docRef: admin.firestore.DocumentReference;
        payload: Record<string, unknown>;
        expectedBoardNumber: string;
      }> = [];

      for (const row of rows) {
        const board = normBoardNumber(row.boardStudentNumber);
        const init = normInitials(row.initials);
        const home = normHomeroom(row.homeroom);

        const baseResult: Pick<UpdateRowResult, "rowIndex" | "csvBoardNumber" | "csvInitials" | "csvHomeroom"> = {
          rowIndex: row.rowIndex,
          csvBoardNumber: board,
          csvInitials: init,
          csvHomeroom: home,
        };

        if (!board || !/^\d+$/.test(board)) {
          results.push({ ...baseResult, action: "skipped", reason: "Invalid or missing board Student Number" });
          totals.skipped++;
          continue;
        }
        if (!init || !home) {
          results.push({ ...baseResult, action: "skipped", reason: "Missing initials or homeroom" });
          totals.skipped++;
          continue;
        }

        // Match: exact initials + homeroom
        let candidates = roster.filter(
          (s) => normInitials(s.initials) === init && normHomeroom(s.homeroom) === home
        );

        // Fallback: initials + homeroom stem
        if (candidates.length === 0) {
          const stem = homeroomStem(home);
          candidates = roster.filter(
            (s) => normInitials(s.initials) === init && homeroomStem(s.homeroom) === stem
          );
        }

        if (candidates.length > 1) {
          results.push({
            ...baseResult,
            action: "ambiguous",
            candidateIds: candidates.map((c) => c.id),
            reason: `${candidates.length} candidates with same initials+homeroom`,
          });
          totals.ambiguous++;
          continue;
        }

        if (candidates.length === 0) {
          if (!createMissing) {
            results.push({ ...baseResult, action: "skipped", reason: "No matching student (create disabled)" });
            totals.skipped++;
            continue;
          }
          // Plan a create
          const now = admin.firestore.FieldValue.serverTimestamp();
          const payload: Record<string, unknown> = {
            schoolId: callerSchoolId,
            studentNumber: board,
            externalStudentNumber: board,
            stableStudentId: board,
            initials: init,
            homeroom: home,
            grade: row.grade ?? "",
            firstName: "",
            lastName: "",
            yearGroup: "",
            className: "",
            sen: false,
            pupilPremium: false,
            eal: false,
            isFocusStudent: false,
            isHighNeed: false,
            tags: [],
            createdAt: now,
            updatedAt: now,
            lastUpdated: now,
          };
          if (row.gender) payload.gender = row.gender;
          if (row.oen) payload.oen = row.oen;

          const newRef = db.collection("students").doc();
          results.push({
            ...baseResult,
            action: "create",
            docId: newRef.id,
            after: {
              studentNumber: board,
              externalStudentNumber: board,
              stableStudentId: board,
            },
          });
          totals.create++;
          writes.push({ rowIndex: row.rowIndex, kind: "create", docRef: newRef, payload, expectedBoardNumber: board });
          continue;
        }

        // Exactly one match → update
        const existing = candidates[0];
        const before = {
          studentNumber: existing.studentNumber || "",
          externalStudentNumber: existing.externalStudentNumber || "",
          stableStudentId: existing.stableStudentId || "",
          displayCode: existing.displayCode || "",
        };

        // Skip if already migrated
        if (
          before.externalStudentNumber === board &&
          before.studentNumber === board
        ) {
          results.push({
            ...baseResult,
            action: "alreadyMigrated",
            docId: existing.id,
            before,
            after: before,
            reason: "Already has board number on both fields",
          });
          totals.alreadyMigrated++;
          continue;
        }

        const newDisplayCode = existing.displayCode
          ? existing.displayCode
          : (looksLikeCodedId(existing.studentNumber) ? existing.studentNumber || "" : (existing.displayCode || ""));

        const newStableId = (
          !existing.stableStudentId ||
          looksLikeCodedId(existing.stableStudentId)
        ) ? board : existing.stableStudentId;

        const after = {
          studentNumber: board,
          externalStudentNumber: board,
          stableStudentId: newStableId,
          displayCode: newDisplayCode,
        };

        const now = admin.firestore.FieldValue.serverTimestamp();
        const payload: Record<string, unknown> = {
          studentNumber: board,
          externalStudentNumber: board,
          stableStudentId: newStableId,
          updatedAt: now,
          lastUpdated: now,
          schoolId: callerSchoolId,
        };
        if (newDisplayCode) payload.displayCode = newDisplayCode;
        if (row.gender) payload.gender = row.gender;
        if (row.oen) payload.oen = row.oen;

        results.push({
          ...baseResult,
          action: "update",
          docId: existing.id,
          before,
          after,
        });
        totals.update++;
        writes.push({
          rowIndex: row.rowIndex,
          kind: "update",
          docRef: db.collection("students").doc(existing.id),
          payload,
          expectedBoardNumber: board,
        });
      }

      if (dryRun || writes.length === 0) {
        return { callerSchoolId, dryRun, totals, results };
      }

      // Commit in batches of 400
      const BATCH = 400;
      for (let i = 0; i < writes.length; i += BATCH) {
        const slice = writes.slice(i, i + BATCH);
        const batch = db.batch();
        for (const w of slice) {
          if (w.kind === "create") {
            batch.set(w.docRef, w.payload);
          } else {
            batch.set(w.docRef, w.payload, { merge: true });
          }
        }
        try {
          await batch.commit();
        } catch (e: any) {
          for (const w of slice) {
            const r = results.find((x) => x.rowIndex === w.rowIndex);
            if (r) {
              r.action = "errored";
              r.reason = `Batch commit failed: ${e?.message || String(e)}`;
              totals.errored++;
            }
          }
        }
      }

      // Verify each touched doc
      for (const w of writes) {
        try {
          const snap = await w.docRef.get();
          const x = snap.data() as any;
          const ok = !!x && String(x.externalStudentNumber ?? "") === w.expectedBoardNumber;
          const r = results.find((x2) => x2.rowIndex === w.rowIndex);
          if (r && r.action !== "errored") {
            r.verified = ok;
            if (ok) totals.verified++;
            else totals.verifyFailed++;
          }
        } catch {
          totals.verifyFailed++;
        }
      }

      return { callerSchoolId, dryRun, totals, results };
    }
  );

// ── Replace School Roster ──────────────────────────────────────────────────
// Admin-only. Fully replaces the active student roster for the caller's school
// using a board CSV. Each row provides:
//   - studentNumber  (board student number, e.g. "970591")
//   - initials
//   - homeroom
//   - grade
//
// Behavior:
//   - For each row: upsert a student doc keyed by `${schoolId}_${studentNumber}`.
//   - Any existing active student in the caller's school whose studentNumber
//     is NOT in the CSV is set to active=false (deactivated).
//   - Any existing student in the caller's school whose studentNumber matches
//     the legacy coded pattern (e.g. "4F-14") AND is not in the CSV is
//     permanently deleted to clean up the old identity model.

interface ReplaceRosterRow {
  studentNumber: string;
  initials: string;
  homeroom: string;
  grade: string;
}

interface ReplaceRosterInput {
  rows: ReplaceRosterRow[];
}

interface ReplaceRosterError {
  studentNumber: string;
  reason: string;
}

interface ReplaceRosterResponse {
  callerSchoolId: string;
  created: number;
  updated: number;
  deactivated: number;
  deletedLegacyCoded: number;
  errors: ReplaceRosterError[];
}

const CODED_ID_RE = /^[0-9]+[A-Za-z]+-[0-9]+$/;

function normStr(v: unknown): string {
  return String(v ?? "").trim().replace(/\.0$/, "");
}

export const replaceSchoolRoster = functions.https.onCall(
  async (data: ReplaceRosterInput, context): Promise<ReplaceRosterResponse> => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in");
    }
    await assertIsAdmin(context.auth.uid);

    const callerRoleDoc = await db.collection("user_roles").doc(context.auth.uid).get();
    const callerSchoolId = String(callerRoleDoc.data()?.schoolId ?? "");
    if (!callerSchoolId) {
      throw new functions.https.HttpsError("failed-precondition", "Caller has no schoolId");
    }

    const rows = Array.isArray(data?.rows) ? data.rows : [];
    if (rows.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "rows array required");
    }
    if (rows.length > 5000) {
      throw new functions.https.HttpsError("invalid-argument", "Max 5000 rows per call");
    }

    // Normalize + dedupe input rows by studentNumber (last write wins)
    const incoming = new Map<string, ReplaceRosterRow>();
    for (const r of rows) {
      const sn = normStr(r?.studentNumber);
      if (!sn) continue;
      incoming.set(sn, {
        studentNumber: sn,
        initials: normStr(r?.initials),
        homeroom: normStr(r?.homeroom),
        grade: normStr(r?.grade),
      });
    }

    if (incoming.size === 0) {
      throw new functions.https.HttpsError("invalid-argument", "No valid studentNumber rows");
    }

    // Load all existing students for this school
    const existingSnap = await db
      .collection("students")
      .where("schoolId", "==", callerSchoolId)
      .get();

    type ExistingDoc = {
      id: string;
      studentNumber: string;
      active: boolean;
      isLegacyCoded: boolean;
    };
    const existing: ExistingDoc[] = [];
    existingSnap.forEach((d) => {
      const x = d.data() as any;
      const sn = normStr(x.studentNumber);
      existing.push({
        id: d.id,
        studentNumber: sn,
        active: x.active !== false,
        isLegacyCoded: CODED_ID_RE.test(sn),
      });
    });

    const now = admin.firestore.FieldValue.serverTimestamp();
    const errors: ReplaceRosterError[] = [];
    let created = 0;
    let updated = 0;
    let deactivated = 0;
    let deletedLegacyCoded = 0;

    // Helper to commit batched writes (Firestore limit 500 ops per batch)
    type Op =
      | { type: "set"; ref: admin.firestore.DocumentReference; data: any }
      | { type: "update"; ref: admin.firestore.DocumentReference; data: any }
      | { type: "delete"; ref: admin.firestore.DocumentReference };
    const ops: Op[] = [];

    async function flush() {
      while (ops.length > 0) {
        const chunk = ops.splice(0, 450);
        const batch = db.batch();
        for (const op of chunk) {
          if (op.type === "set") batch.set(op.ref, op.data, { merge: true });
          else if (op.type === "update") batch.update(op.ref, op.data);
          else batch.delete(op.ref);
        }
        await batch.commit();
      }
    }

    // Build a map of existing docs keyed by studentNumber for upsert detection
    const existingBySn = new Map<string, ExistingDoc>();
    for (const e of existing) {
      if (e.studentNumber) existingBySn.set(e.studentNumber, e);
    }

    // 1) Upsert every incoming row
    for (const row of incoming.values()) {
      try {
        const docId = `${callerSchoolId}_${row.studentNumber}`;
        const ref = db.collection("students").doc(docId);
        const prior = existingBySn.get(row.studentNumber);

        const payload: any = {
          studentNumber: row.studentNumber,
          initials: row.initials,
          homeroom: row.homeroom,
          grade: row.grade,
          schoolId: callerSchoolId,
          active: true,
          lastUpdated: now,
          updatedAt: now,
        };
        if (!prior) {
          payload.createdAt = now;
          created++;
        } else {
          updated++;
        }
        ops.push({ type: "set", ref, data: payload });
      } catch (err: any) {
        errors.push({
          studentNumber: row.studentNumber,
          reason: err?.message || String(err),
        });
      }
    }

    // 2) For existing docs in this school NOT in incoming:
    //    - delete legacy coded-ID rows (cleanup)
    //    - deactivate everything else that is currently active
    for (const e of existing) {
      if (incoming.has(e.studentNumber)) continue;
      const ref = db.collection("students").doc(e.id);
      if (e.isLegacyCoded) {
        ops.push({ type: "delete", ref });
        deletedLegacyCoded++;
      } else if (e.active) {
        ops.push({
          type: "update",
          ref,
          data: { active: false, lastUpdated: now, updatedAt: now },
        });
        deactivated++;
      }
    }

    await flush();

    return {
      callerSchoolId,
      created,
      updated,
      deactivated,
      deletedLegacyCoded,
      errors,
    };
  }
);
