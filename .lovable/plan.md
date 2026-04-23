

## Add manual board-number column override to Backfill

### The actual problem

The trace confirms it: the workbook is parsed, all other columns are detected, but the **Board number column → NOT FOUND**. Because `parseSheet` early-returns when `iExt === -1`, every row is dropped, so no `derivedCodedId` is ever produced for `4F-14` (or any other student). The matcher code is fine — it just never receives any rows.

The header for the board ID in `Class_list_for_data_tracker_app.xlsx` doesn't match any current alias in `HEADER_ALIASES.externalNumber`. We don't need to keep guessing aliases — we need to let the user pick the column themselves from the headers the parser already sees.

### What this build will do

**1. `src/lib/backfillParser.ts` — accept a manual override**

- Add an optional second argument: `parseBackfillFile(file, overrides?: { externalNumber?: string })`.
- Inside `parseSheet`, if `overrides.externalNumber` is provided, look it up in `headers` by case-insensitive exact match and use that index instead of running the alias search for `externalNumber`.
- When the override resolves, do NOT push the "missing required column" warning, and do NOT early-return.
- Always populate `allHeaders` from the first sheet that has any header row, even when parsing fails — so the UI can show the chips.
- Broaden `HEADER_ALIASES.externalNumber` defensively with: `'oen'`, `'ontario education number'`, `'student id'`, `'student id number'`, `'board id'`, `'board #'`, `'board no'`, `'board no.'`. Keep `'student #'` OUT of this list (it collides with the roster ordinal).

**2. `src/components/tabs/StudentsTab.tsx` — header picker UI**

In the Backfill Preview dialog:

- Keep the existing "Detected columns" block.
- When `detectedColumns.externalNumber` is null, render below it: "Select the column that contains the board student number:" followed by all `parseResult.allHeaders` as clickable chips (Badge components, click-to-select).
- Clicking a chip:
  1. Stores the header in component state `backfillColumnOverride: string | null`.
  2. Re-runs `parseBackfillFile(backfillFile, { externalNumber: chipText })` against the cached `File` object.
  3. Re-runs `buildMatchPlan(rows, students)` and replaces `backfillPlan`.
- Highlight the currently selected chip (filled vs outline variant).
- If the override produces zero matched rows, show a small hint: "Selected column has no values that look like board IDs — try another."

**3. State & wiring**

- Cache the uploaded `File` in state (`backfillFile: File | null`) so re-parsing doesn't require a re-upload.
- Reset `backfillColumnOverride` and `backfillFile` when the dialog closes.
- All existing diagnostics (trace input, per-row write log, post-commit refetch + verification banner, unmatched/ambiguous tables) stay exactly as they are.

### Files to update

- `src/lib/backfillParser.ts` — accept `overrides`, expand aliases, always return `allHeaders`.
- `src/components/tabs/StudentsTab.tsx` — cache uploaded file, render header chips when board column missing, wire chip click → re-parse → re-plan.

### Out of scope

- No matcher algorithm changes.
- No Firestore rule, schema, or import-wizard changes.
- No persistence of the override beyond the current session.

### Expected outcome

Re-open Backfill, upload `Class_list_for_data_tracker_app.xlsx`. The "Board number column → NOT FOUND" line is now followed by a row of clickable header chips from the actual file. Click the one that holds the board IDs (e.g. `OEN`, `Student ID`, or whatever the file uses). The plan rebuilds in place, `4F-14` moves into `matched`, and Confirm writes `externalStudentNumber` to every matched student. The post-commit verification banner stays green.

