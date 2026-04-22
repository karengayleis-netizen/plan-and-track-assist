
Fix the failed Acadience import by correcting the upstream board-number backfill, not the benchmark CSV parser.

## What’s actually happening

The benchmark file itself is valid:
- it has a proper `Student Number` column
- the wizard is already reading those values correctly
- the importer already tries `stableStudentId -> studentNumber -> externalStudentNumber`

So if all 448 rows say “No student match found,” the likely problem is that the earlier whole-school backfill did not populate `externalStudentNumber` for the students in this file.

The strongest clue is the uploaded class-list workbook structure:
- `Student #`
- `Student Initials`
- `Student Number` (board ID)
- `Section Number`

Your roster stores students as coded IDs like `1AF-3`, `12E-7`, etc. That means the workbook already contains a stronger matching key than initials:
`Section Number + Student #`

Current backfill logic only matches by `initials + homeroom`, so any initials mismatch, duplicate initials, or formatting drift leaves the board number unapplied. Then the benchmark import has nothing to match against.

## Implementation plan

### 1. Upgrade whole-school backfill matching to use the roster’s real key
Update `src/lib/backfillParser.ts` so it also detects and reads the `Student #` column.

New matching order:
1. `stableStudentId === "${Section Number}-${Student #}"`
2. `studentNumber === "${Section Number}-${Student #}"`
3. fallback: `initials + homeroom`
4. optional tiebreaker: `grade`

This makes the backfill deterministic for students created through the class-roster uploader, which already builds IDs in that same format.

### 2. Expand the parser schema for the workbook you uploaded
In `src/lib/backfillParser.ts`:
- add header aliases for the roster ordinal column:
  - `student #`
  - `student # `
  - `student number in class`
  - `roster number`
  - `number`
- keep existing aliases for:
  - initials
  - board/external student number
  - section/homeroom
  - grade

Store both values separately:
- `rosterNumber` = classroom ordinal (`1`, `2`, `3`)
- `externalNumber` = board ID (`1027516`)

This avoids today’s ambiguity where “Student Number” can mean two different things depending on the file.

### 3. Make the backfill preview explain how each match was found
Update `src/components/tabs/StudentsTab.tsx` preview dialog to break matched rows into:
- matched by `Section + Student #`
- matched by `Initials + Homeroom`
- already correct
- unmatched
- ambiguous

Also show a few sample unmatched rows with all useful fields:
- row number
- section
- student #
- initials
- board number

That will make it obvious whether failures are due to missing roster numbers, wrong homerooms, or initials drift.

### 4. Improve backfill diagnostics before commit
In the same preview dialog, add warnings for:
- rows missing `Student #`
- rows where `Section Number` is blank
- rows where the derived coded ID (example `1AF-3`) does not exist in the current roster
- rows that only matched by initials fallback

This turns the backfill step into a real preflight check instead of a best-effort update.

### 5. Make the benchmark preview message point to incomplete backfill coverage
Update `src/components/benchmarks/PreviewStep.tsx` so when `matchedCount === 0`, the warning is more specific:

Instead of only saying “backfill External Student Number,” show:
- this benchmark file is using board IDs
- those board IDs are still not present on the roster
- re-run the whole-school backfill using `Section Number + Student #`

Optionally add a short summary of unique unmatched student IDs instead of only row counts, because 448 failed rows may represent far fewer unique students.

### 6. Keep benchmark import matching logic as-is
No change needed to the benchmark matcher order in `src/hooks/useImportWizard.ts` unless a tiny normalization helper is added for safety.

The important part is getting `externalStudentNumber` filled correctly on the roster first.

## Files to update

- `src/lib/backfillParser.ts`
  - parse `Student #`
  - distinguish roster number vs board number
  - implement stronger match order
- `src/components/tabs/StudentsTab.tsx`
  - richer preview summary
  - unmatched diagnostics
  - match-source visibility
- `src/components/benchmarks/PreviewStep.tsx`
  - clearer “incomplete backfill” message for zero-match imports

## Expected result

After this change:
1. Upload the same class-list workbook again in **Backfill Board Numbers (whole-school)**
2. The system matches students primarily by derived coded ID like `1AF-3`
3. `externalStudentNumber` is filled for the missing students
4. Re-run the Acadience import
5. The benchmark file matches by board ID and the 448 rows import normally

## Technical details

- No Firestore rule changes
- No schema changes
- No backend changes
- This is a front-end matching and diagnostics fix
- The fix is low-risk because it strengthens an existing admin-only backfill tool instead of changing stored benchmark logic
