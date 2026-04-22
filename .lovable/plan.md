
Fix the benchmark import so this CSV can match the roster reliably.

## What’s actually going wrong

This is not the old `.xlsx` problem anymore. The file you uploaded now is a valid CSV and its headers are correct for Acadience.

The current failure is more likely caused by three app-side issues working together:

1. `useImportWizard` creates its own `useStudents()` instance and can run matching before that roster has finished loading, so `confirmMapping()` may compare against an empty `students` array.
2. The uploaded file uses the header `Class Name`, but `detectColumnMapping()` does not currently treat `Class Name` as a `classCode` alias, so homeroom mapping is not auto-detected.
3. `PreviewStep` only counts `ready` rows for the import button, but `runImport()` actually allows both `ready` and `warning` rows. If rows are matched but flagged with warnings, the UI can still look like “nothing will import.”

## Implementation plan

### 1. Block matching until the student roster is fully loaded
Update `src/hooks/useImportWizard.ts` to consume both `students` and `loading` from `useStudents()`.

- Add a guard in `confirmMapping()`:
  - if roster is still loading, do not build unmatched rows yet
  - surface a clear message like “Roster is still loading — please wait a moment and try Preview again”
- Expose a `studentsLoading` flag through the wizard state so the UI can react before matching begins.

### 2. Auto-detect the homeroom column from this Acadience file
Update `src/lib/csvParser.ts` column aliases so `classCode` also matches:

- `class name`
- `classname`
- `classroom`

This will let the uploaded CSV auto-map `Class Name` without manual intervention.

### 3. Make the preview/import counts match the real import logic
Update `src/components/benchmarks/PreviewStep.tsx` so the primary import count is based on:

- `matchedStudentId`
- `status !== 'error'`

instead of only `status === 'ready'`.

That means:
- matched rows with warnings still show as importable
- the button label reflects what `runImport()` will actually write
- the import button is no longer disabled for warning-only batches

### 4. Improve the failure diagnostics in the preview step
Refine the preview banner to distinguish between:

- roster still loading
- zero student matches
- homeroom column not mapped
- homeroom mismatches on otherwise matched students

Add copy such as:
- “Roster still loading — matching has not run yet.”
- “Student IDs did not match any roster records.”
- “Class Name was not mapped to Homeroom/Class Code.”
- “Some rows matched by student ID but the homeroom differs.”

### 5. Preserve current import behavior for whole-school files
Keep homeroom mismatch as a warning, not a blocker.

That matches the existing whole-school design:
- student ID is the primary identity key
- CSV homeroom is stored for audit/reporting
- mismatches should be visible, but should not stop import if the student match is confident

## Files to update

- `src/hooks/useImportWizard.ts`
  - add roster-loading guard
  - expose matching readiness / importable counts
- `src/lib/csvParser.ts`
  - extend `classCode` header aliases
- `src/components/benchmarks/PreviewStep.tsx`
  - count importable rows correctly
  - improve banners and messaging
- `src/components/benchmarks/MappingStep.tsx`
  - optionally show a hint when `Class Name` is detected but not mapped

## Expected result

After this change, your uploaded Acadience CSV should behave like this:

- `Student Number` matches students using the backfilled `externalStudentNumber`
- `Class Name` auto-maps to the homeroom/class field
- the wizard waits for the roster before declaring rows unmatched
- matched rows with warnings still show as importable
- the preview clearly tells you whether the issue is ID matching, homeroom mapping, or simply roster load timing

## Technical notes

- No Firestore rule changes needed.
- No student data model changes needed.
- No backend changes needed.
- This is a front-end/import-state fix only.

