

## Backfill diagnostics & verification — already implemented

Per the prior approved plan (last turn), all five requested fixes are already in `src/lib/backfillParser.ts` and `src/components/tabs/StudentsTab.tsx`:

1. **`alreadyCorrect` tightened** — empty current + non-empty incoming now goes to `matched`.
2. **Trace by Student #** input in Backfill Preview reports roster presence, current fields, derived ID hits, and bucket.
3. **Per-row write log** with `{ studentId, studentNumber, externalNumber, status, error? }`, summary panel, CSV download.
4. **Post-commit `refetch()` + verification** — red banner if matched students still have empty `externalStudentNumber`.
5. **Expandable unmatched / ambiguous lists** with `derivedCodedId`, `externalNumber`, `initials`, `section`, `rosterNumber`.

Nothing new to build for that scope.

## What to do next — actually trace `4F-14`

Re-open **Students → Backfill Board Numbers**, re-upload the same workbook, and in the Backfill Preview type `4F-14` into the trace input. The result will fall into exactly one of these cases. Each has a one-line follow-up fix.

**Case A — "Not in roster"**
The in-memory `students` array doesn't include `4F-14`. Causes: wrong `schoolId` context, teacher-role homeroom filter excluding `4F`, or the doc's `studentNumber` has hidden whitespace / different case.
Follow-up: I'll add a normalized roster lookup (`trim().toUpperCase()`) on `studentNumber` / `stableStudentId` keys in `buildMatchPlan`.

**Case B — "In roster, but no backfill row produced `derivedCodedId = 4F-14`"**
The workbook's row for that student has a missing/blank Student # ordinal or a Section value that isn't `4F`.
Follow-up: open the unmatched list, find the row by initials, and either fix the source file or extend `HEADER_ALIASES.rosterNumber` for the actual header used.

**Case C — "Landed in `unmatched` / `ambiguous`"**
Derived ID built correctly but didn't match the roster key. Almost certainly a normalization gap (whitespace, trailing `.0`, case).
Follow-up: same normalized lookup as Case A.

**Case D — "Landed in `matched`, but post-commit banner is red"**
The Firestore `updateDoc` was rejected. Check `firestore.rules` for `students` write permissions for the current user's role/schoolId.
Follow-up: open `firestore.rules`, confirm the admin write rule on `/students/{id}` allows partial updates with `externalStudentNumber`.

**Case E — "Landed in `alreadyCorrect`"**
Should now be impossible after fix #1. If it still happens, the file row's external number equals the student's existing one — meaning the student already has a board ID and you're looking at a different field in Firestore.

## Action requested from you

Run the trace for `4F-14` and tell me which case (A–E) shows. I'll then ship the single targeted fix instead of another speculative pass.

