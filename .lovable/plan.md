

## Add syncClaimsFromUserRoles alongside existing lookupUserByEmail

### What this does
Adds a new Cloud Function that automatically syncs custom claims (role, schoolId) to Firebase Auth whenever a `user_roles/{uid}` document is created, updated, or deleted. This eliminates the need for the frontend to separately fetch role data from Firestore on every login.

### Changes

**File: `functions/src/index.ts`**

Keep the existing `lookupUserByEmail` function (v1) intact and add the new `syncClaimsFromUserRoles` function below it.

Since Eventarc issues were previously encountered, the new function will use **v1 syntax** (`functions.firestore.document().onWrite()`) instead of the v2 `onDocumentWritten` to avoid deployment failures:

```typescript
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
```

### Summary
- **1 file modified**: `functions/src/index.ts`
- Existing `lookupUserByEmail` preserved
- New function uses v1 to avoid Eventarc issues
- After updating, deploy with: `firebase deploy --only functions`

