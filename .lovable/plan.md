

## Fix: Teacher Can't See Classes (Ruchi Bhardwaj)

### Root Causes

1. **Missing `user_roles` document in Firestore** — Ruchi's UID (`I9RDwJ3ADmYaOyo0eRaxWtz9yok1`) has no entry in the `user_roles` collection. The Firestore security rules rely on this document to authorize all reads (students, homerooms, etc.). Without it, every query is denied.

2. **`useClasses` hook blocks non-admin users** — The hook has a guard that returns empty if `role !== 'admin'`, so teachers never load the homeroom list even if Firestore would allow it.

### Required Actions

**Action 1: Create the missing Firestore document (manual, in Firebase Console)**

Go to Firebase Console → Firestore → `user_roles` collection → Add document with ID `I9RDwJ3ADmYaOyo0eRaxWtz9yok1`:
- `role`: `"teacher"`
- `schoolId`: `"folkstone_ps"`

This must be done for every teacher account — it's how the security rules authorize access.

**Action 2: Update `useClasses` to allow teachers to fetch homerooms**

**File: `src/hooks/useClasses.ts`** (~line 27)

Change the guard from requiring `admin` to just requiring a valid `schoolId`. Teachers need to see the class list to filter students by homeroom. The Firestore rules already enforce school-level isolation, so this is safe.

```typescript
// Before:
if (!user?.uid || !user?.schoolId || role !== 'admin') {

// After:
if (!user?.uid || !user?.schoolId) {
```

Also update the `useEffect` trigger (~line 138) to remove the admin check:
```typescript
// Before:
if (user?.schoolId && role === 'admin') {

// After:
if (user?.schoolId) {
```

Note: Write operations (add/update/delete class) are already protected by Firestore rules that require admin role, so removing the read guard doesn't create a security issue.

**Action 3: Update Firestore security rules for teacher homeroom reads**

Currently `homerooms` rules only allow admin access. Teachers need read access to see the class dropdown:

```
match /homerooms/{homeroomId} {
  allow list: if hasSchool();                    // was: isAdmin() && hasSchool()
  allow get: if hasSchool() && (resourceSameSchool() || isMissingSchoolId());  // was: isAdmin() && ...
  // create/update/delete remain admin-only (unchanged)
}
```

### Summary
- One manual Firestore document creation (and for any future teachers)
- Two small code changes in `useClasses.ts`
- One Firestore rules update for teacher read access to homerooms

