

## Diagnose & fix the "4 writes succeeded but didn't persist" backfill issue

### What we know from the trace

- 37 writes attempted, 37 reported "success" at the `updateDoc` level, but 4 specific students (`1AF-7`, `1AF-13`, `1BF-6`, `1BF-16`) come back from the roster refetch still empty.
- User is **admin** of `folkstone_ps` (confirmed in the JWT — `role:"admin", schoolId:"folkstone_ps"`).
- Firestore rule for student updates: `allow update: if resourceSameSchool() && requestSameSchool();`
- `useStudents.updateStudent` only sends `{ externalStudentNumber, updatedAt, lastUpdated }` — no `schoolId`. In Firestore, `request.resource.data` is the **merged** post-update doc, so `schoolId` survives — UNLESS the existing doc has no `schoolId` field at all (legacy import).

### The most likely root cause

These 4 student docs are missing a `schoolId` field on the existing document (legacy data from an earlier import that pre-dates the school-isolation rules). When you call `updateDoc` with only a partial payload:
- The update **succeeds at the SDK level** because Firestore doesn't pre-validate against rules — wait, that's wrong. Rules DO block it and throw.

A second, more plausible scenario: the docs DO have `schoolId` but the value is stale/different (e.g. `""` or another school's ID). The query filters them OUT on refetch (`where('schoolId', '==', 'folkstone_ps')`), so the verification step looks for them in `students` array, doesn't find them, and reports them as "did not persist." The write may have actually succeeded — but to a doc the user can no longer see.

A third possibility: the doc has a unique-board-id check elsewhere, or the boardId conflicts with another row's, but there's no such rule today.

### The investigation step (no code yet)

Before changing code, we need to read those 4 specific docs directly from Firestore to see their actual `schoolId` value. Two ways:

1. **Quickest** — open Firebase Console → Firestore → `students` collection → look up doc IDs `zczv996viRquAHpxxyvc`, `b7mKc4bGpP5uU0RWFbq0`, `CdlP82WK0Y5PWzODIsbU`, `SejuBADMIeMew6syECrv`. Inspect `schoolId` and `externalStudentNumber` fields.
2. **In-app** — add a one-off "Inspect doc" debug button (admin only) that does `getDoc()` for an entered ID and prints all fields, bypassing the school filter.

### The code fix (after investigation confirms cause)

**`src/hooks/useStudents.ts` — make `updateStudent` rule-safe and self-healing**
- Always include `schoolId: user.schoolId` in the update payload. This guarantees `requestSameSchool()` passes even if the existing doc has a wrong/missing schoolId, and the `repairingMissingSchoolId` rule path (already in `firestore.rules`) covers admin self-heal.
- Remove the `await fetchStudents()` call inside `updateStudent`. The backfill loop runs 37 sequential updates — that's 37 full collection refetches. Let the caller refetch once at the end.
- Replace the silent `catch {}` with `catch (e)` and re-throw the original error so the backfill loop can show the actual Firestore error code (`permission-denied` vs `not-found`).

**`src/components/tabs/StudentsTab.tsx` — improve verification + diagnostics**
- After the backfill loop, instead of relying on the filtered `students` array for verification, do a direct `getDoc()` per write target to bypass the school filter. This distinguishes "write rejected" from "write succeeded but doc no longer visible to your query."
- For each verify-miss, show the doc's actual `schoolId` and `externalStudentNumber` from the direct read in the diagnostic panel — so the cause is obvious next time.
- Add a single "Refetch roster once" call at the end of the loop instead of inside each `updateStudent`.

**`src/lib/backfillParser.ts` — separate concern, same upload**
- The trace also reports `L.M.C.` in roster `4F` not matched (file row 12 is `3AF-11 / L.M.C.`). The homeroom-stem fallback already exists but file `3AF` stem=`3` ≠ roster `4F` stem=`4`, so it correctly does not auto-match. This stays as an "unmatched, use Resolve picker" row — no code change needed.

### Out of scope

- No fuzzy matching on initials.
- No automatic moving of students between homerooms based on the file (preserving the current "boards write only, homerooms unchanged" behavior).
- No bulk re-assignment of `schoolId` on legacy docs — the `repairingMissingSchoolId` rule + the always-include-schoolId fix handles new repairs as a side effect of any update.

### Expected outcome

- Re-run backfill on the same file. Either (a) the 4 writes now persist (if the cause was a missing/stale `schoolId`), or (b) the diagnostic panel shows you the exact `schoolId` value on those 4 docs so we know to fix them in Firestore Console once.
- Backfill is also significantly faster — one refetch at the end instead of 37.
- Real Firestore errors propagate to the results CSV instead of being swallowed.

### Files to change

- `src/hooks/useStudents.ts` — include schoolId in update, drop per-update refetch, surface real errors.
- `src/components/tabs/StudentsTab.tsx` — direct `getDoc` verification, end-of-loop refetch, richer diagnostic display.

