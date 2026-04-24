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
