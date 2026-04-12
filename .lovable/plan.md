

## Diagnosis: Silent Firestore Permission Error

The `useStudents` hook catches errors silently — the `catch` block sets `setError('Failed to fetch students')` but never logs the actual error to the console. This is why you see `useClasses` logs but nothing about students.

The most likely cause is a Firestore security rule issue. Looking at the students rule:

```
allow read: if isAdmin() && resourceSameSchool() ...
```

This calls `roleDoc()` which does a `get()` on `user_roles/{uid}`. For **list** queries, Firestore needs to evaluate this for every potential document, which can cause permission failures if the security function calls are too complex or if there's a race condition with token refresh.

## Plan

### 1. Add error logging to useStudents
In `src/hooks/useStudents.ts`, update the `catch` block in `fetchStudents` to log the actual Firestore error to the console (`console.error('[useStudents] Error:', err)`). This will reveal the exact permission error message.

### 2. Add debug logging for student fetch lifecycle
Add `console.log` statements showing when `fetchStudents` is called, with `user.schoolId` and `user.role`, and the number of documents returned — matching the pattern already used in `useClasses`.

### Technical details

**File:** `src/hooks/useStudents.ts`
- Line 51: Change `catch {` to `catch (err) {` and add `console.error('[useStudents] Fetch error:', err);`
- Line 14: Add `console.log('[useStudents] fetchStudents called, schoolId:', user?.schoolId, 'role:', user?.role);`
- After line 40 (after mapping docs): Add `console.log('[useStudents] Fetched', studentsData.length, 'students');`

This logging will immediately reveal whether the issue is a Firestore permission denial, a missing schoolId, or something else — and we can fix the root cause in the next step.

