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
