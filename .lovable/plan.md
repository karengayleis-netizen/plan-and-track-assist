

## Sync local firestore.rules with live rules

### Problem
The local `firestore.rules` uses **claims-based** auth (`request.auth.token.role`), but the **live** Firebase rules use **document-lookup** auth (`roleDoc()` reading from `user_roles`). These are fundamentally different approaches. If someone runs `firebase deploy --only firestore:rules`, it would overwrite the live rules with the wrong version.

The permission errors are happening because `hasSchool()` in the live rules requires `user_roles/{uid}.schoolId` to be a non-empty string. If that field is missing, every homeroom and teacher query fails.

### Changes

**File 1: `firestore.rules`** — Replace entirely with the live rules the user pasted, which use `roleDoc()` document lookups instead of token claims.

Key sections:
- Helper functions: `signedIn()`, `uid()`, `roleDoc()`, `mySchoolId()`, `hasSchool()`, `isAdmin()`, `resourceSameSchool()`, `requestSameSchool()`, `isMissingSchoolId()`, `repairingMissingSchoolId()`
- Collections: artifacts, users, user_roles, homerooms, teachers, students, benchmarks, markbook
- Default deny-all catch rule

### Manual step (critical)
Open Firebase Console > Firestore > `user_roles` > `3Zg3r5UF6zgmP94zp9NKRMclhZg1` and confirm it has **both**:
- `role`: `"admin"`
- `schoolId`: `"folkstone_ps"`

If `schoolId` is missing, add it. This is what `hasSchool()` checks, and without it every admin query fails even though the UI shows the correct schoolId.

### Why this fixes it
- Local rules will match live rules — no risk of accidental overwrite
- Once `user_roles` doc has `schoolId`, the `hasSchool()` check passes
- `isAdmin()` reads from the same doc, confirming admin role
- Homeroom list/get and teacher list/get all gate on `isAdmin() && hasSchool()`

