

## Fix: stop auto-mapping "Student #" (roster ordinal) as the student identifier

### Root cause

In `src/lib/csvParser.ts`, the `studentIdentifier` aliases list includes the bare token `'number'`. The Acadience export has a `Student #` column (the in-class ordinal: 1, 2, 3...) that appears **before** `Student Number` (the actual board ID). After the previous fix added `Student #` aliases for `classCode`/backfill awareness, `Student #` now also normalizes to something that collides — and `'number'` matches it first.

Result: the wizard reads `1, 2, 3, ...` as the student identifier instead of `1027516, 1035148, ...`. None of those tiny numbers match any roster ID, so all 448 rows fail.

The CSV columns for assessment, score, date, and homeroom map correctly — which exactly matches what you reported.

### The fix

**1. `src/lib/csvParser.ts` — tighten `studentIdentifier` aliases**

Remove the over-broad `'number'` alias and explicitly exclude roster-ordinal headers:

- Drop `'number'` from `studentIdentifier` aliases.
- Keep the strong, unambiguous ones: `student number`, `studentnumber`, `student_number`, `student id`, `student_id`, `pupil id`, `stable id`, `stablestudentid`, `stable_student_id`, `id`, `board number`, `board id`, `external student number`.
- Add an explicit deny-list for roster-ordinal headers so they can never be picked as identifier: `student #`, `student#`, `roster number`, `roster #`, `student number in class`, `class number`, `seat number`, `#`.

**2. `src/lib/csvParser.ts` — make `detectColumnMapping` skip denied headers**

When iterating headers for `studentIdentifier`, if the header (lowercased/trimmed) is in the deny-list, skip it even if a loose alias would match. This guarantees `Student #` is never auto-selected as the identifier, regardless of column order.

**3. `src/components/benchmarks/MappingStep.tsx` — surface the conflict**

If the file contains both a roster-ordinal column (`Student #`) and a board-ID column (`Student Number`), show a small inline hint under the Student Identifier dropdown:

> Detected both `Student #` (roster ordinal) and `Student Number` (board ID). Using `Student Number`. Change here if needed.

This makes the auto-mapping decision visible and overridable.

**4. `src/components/benchmarks/PreviewStep.tsx` — improve the unmatched-IDs sample**

The current "first 10 unmatched IDs" snippet reads from `rawValues[0]`, which is whichever column happens to be first — not necessarily the mapped identifier. Change it to read from `rawValues[columnMapping.studentIdentifier]` so the diagnostic always shows the actual IDs the matcher tried.

This requires passing `columnMapping` (or a resolved `identifierColumnIndex`) from `ImportWizard` → `PreviewStep`.

### Files to update

- `src/lib/csvParser.ts` — remove `'number'`; add deny-list; respect deny-list in `detectColumnMapping`
- `src/components/benchmarks/MappingStep.tsx` — show conflict hint when both columns present
- `src/components/benchmarks/PreviewStep.tsx` — read unmatched-IDs from the mapped identifier column
- `src/components/benchmarks/ImportWizard.tsx` — pass identifier column index to `PreviewStep`

### Out of scope

- No matcher logic changes in `useImportWizard.ts` — it's already correct.
- No backfill changes — the previous backfill work stays.
- No Firestore, schema, or rule changes.

### Expected outcome

Re-uploading the same Acadience CSV (no other action needed):
- The wizard auto-maps `Student Number` (board ID) — not `Student #` (1, 2, 3) — as the identifier.
- The 448 rows match against `externalStudentNumber` on the roster as intended.
- The diagnostic banner, if it ever shows again, will list real board IDs (`1027516`, ...) instead of `1, 2, 3`.

