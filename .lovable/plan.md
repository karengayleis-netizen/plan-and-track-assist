

## Fix: Classes Permission Error (Root Cause)

There are **two independent problems** causing this, plus a misleading UI label:

### Problem 1: Token never refreshed with custom claims
Your Cloud Function (`syncClaimsFromUserRoles`) writes `role` and `schoolId` to the Firebase Auth token, but `useAuth.tsx` never calls `getIdTokenResult(firebaseUser, true)` to refresh the token. The Firestore SDK sends queries with a stale token.

### Problem 2: Firestore rules use document lookups instead of claims
The `isAdmin()` helper does `exists()` + `get()` on the `user_roles` collection on every single request. This is slow, costs extra reads, and can fail under certain conditions. Since you already have a Cloud Function syncing claims to the token, the rules should just read `request.auth.token.role` and `request.auth.token.schoolId`.

### Problem 3: Misleading UI label
The Admin tab shows `schools/{schoolId}/homerooms/{code}` as the path, but the actual code queries the top-level `/homerooms` collection. This is just a wrong label.

---

### Changes

**File 1: `src/hooks/useAuth.tsx`**
- Import `getIdTokenResult` from `firebase/auth`
- Call `await getIdTokenResult(firebaseUser, true)` before `setUser` in the `onAuthStateChanged` callback
- This ensures the Firestore SDK has a fresh token with `role` and `schoolId` claims before any queries fire

**File 2: `firestore.rules`**
- Rewrite `isAdmin()` to use `request.auth.token.role == 'admin'` (no document lookup)
- Rewrite `getUserSchool()` to use `request.auth.token.schoolId` (no document lookup)
- Rewrite `belongsToSameSchool()` and `newResourceMatchesUserSchool()` to use `request.auth.token.schoolId`
- Simplify homerooms and teachers rules to remove redundant `exists()` checks
- Keep the same access control logic, just backed by claims instead of doc reads

**File 3: `src/components/tabs/AdminTab.tsx`**
- Fix the misleading path label from `schools/{schoolId}/homerooms/{code}` to `homerooms/{code}` (line 285)

---

### After implementation
You must redeploy the Firestore rules:
```
firebase deploy --only firestore:rules
```
Then log out and log back in so the token refreshes with the latest claims.

