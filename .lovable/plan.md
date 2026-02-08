

## Align frontend hooks with new Firestore rules

### Problem
The deployed Firestore rules now require:
- `isAdmin()` for reading/writing homerooms and teachers
- A valid `schoolId` on the user profile (no fallback accepted)

The frontend hooks still use `'default-school'` fallbacks and don't check the user's role before calling Firestore.

### Changes

**1. `src/hooks/useClasses.ts` -- fetchClasses guard**
- Remove `const schoolId = user?.schoolId || 'default-school'` fallback
- Exit early if `!user?.uid` or `!user?.schoolId`
- Use `user.schoolId` directly
- Update `useEffect` to depend on both `user?.uid` and `user?.schoolId`

**2. `src/hooks/useClasses.ts` -- addClass guard**
- Remove `user.schoolId || 'default-school'` fallback
- Throw a clear error if `user.schoolId` is missing

**3. `src/hooks/useStaff.ts` -- fetchStaffMembers guard**
- Remove `const schoolId = user?.schoolId || 'default-school'` fallback
- Exit early if `!user?.uid` or `!user?.schoolId`

**4. `src/hooks/useStaff.ts` -- saveStaffMember guard**
- Remove `user.schoolId || 'default-school'` fallback
- Throw a clear error if `user.schoolId` is missing

**5. `src/hooks/useStaff.ts` -- searchStaffByEmail guard**
- Remove `const schoolId = user?.schoolId || 'default-school'` fallback
- Exit early if `!user?.schoolId`

### No deployment needed
These are frontend-only changes -- they take effect immediately in the preview.

### Technical detail

In each location, the pattern is:

```text
BEFORE:
  const schoolId = user?.schoolId || 'default-school';

AFTER:
  if (!user?.uid || !user?.schoolId) {
    // set empty state, return early
    return;
  }
  const schoolId = user.schoolId;
```

Five edits across two files. No new files or dependencies.

