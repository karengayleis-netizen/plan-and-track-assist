
Fix the benchmark wizard so `studentIdentifier` can only come from an approved board-ID header, and stop any stale mapping/template/fallback from reintroducing ordinal values.

## What this build will do

The uploaded CSV already contains a strong `Student Number` header with real board IDs like `1060214`, `1127726`, `1048492`. It does not need guessing. If the wizard is still showing `1, 2, 3...`, the bug is now in mapping enforcement or downstream fallback, not the CSV itself.

## Implementation

### 1) Lock `studentIdentifier` to a strict allow-list in `src/lib/csvParser.ts`
Replace the current broad alias handling for `studentIdentifier` with an explicit approved list only:

Approved headers:
- `student number`
- `studentnumber`
- `student_number`
- `board student number`
- `board number`
- `board id`
- `student id`
- `student_id`
- `external student number`
- `externalstudentnumber`
- `sis student number`

Explicit deny list:
- `student #`
- `student#`
- `number`
- `#`
- `roster number`
- `roster #`
- `class number`
- `seat number`
- `student number in class`
- `student no. in class`
- `line number`
- `row number`

Rules:
- deny-listed headers can never be selected for `studentIdentifier`
- no “contains number” logic
- no numeric-column fallback
- no “first matching-ish column” fallback
- if no approved header exists, leave `studentIdentifier = -1`

### 2) Centralize identifier validation so every path uses the same rule
Add a small helper in `csvParser.ts` that resolves and validates the identifier mapping from:
- detected headers
- manual user selection
- saved template selection

This helper should return:
- mapped header name
- mapped column index
- validity status
- reason if invalid (`denied header`, `not in approved allow-list`, `unmapped`)

That makes detection, preview, import, and template application all enforce the exact same rule.

### 3) Revalidate templates and manual mappings in `src/hooks/useImportWizard.ts`
Even if auto-detection is fixed, an old saved template can still map the wrong column by index.

Update the wizard flow so that:
- after file upload, detected mapping is validated before storing state
- when a template is applied, its `studentIdentifier` index is rechecked against the current file’s headers
- if the template points to a denied or non-approved header, clear `studentIdentifier` back to `-1`
- on `confirmMapping`, do not proceed if `studentIdentifier` is invalid or unmapped

Behavior change:
- the wizard must stop and force manual mapping instead of guessing
- preview/import cannot run with an invalid identifier column

### 4) Make the mapping screen explicit in `src/components/benchmarks/MappingStep.tsx`
Improve the identifier field UI so the user can see exactly what is happening.

Add:
- the exact notice requested when both columns exist:
  `Detected Student # (roster ordinal) and Student Number (board ID). Using Student Number.`
- a blocking inline error under the Student Number field when no approved identifier is mapped:
  `No valid student identifier column was found automatically. Please select Student Number / board ID manually.`
- if a denied header is currently selected, show:
  `Student # / Number / roster ordinal columns cannot be used for matching.`

Also make the Continue button require:
- all required fields mapped
- `studentIdentifier` specifically mapped to an approved header

### 5) Remove identifier fallbacks from preview/import diagnostics
Update `src/components/benchmarks/PreviewStep.tsx` and the wizard flow so diagnostics use only the real mapped identifier column.

Changes:
- no `rawValues[0]`
- no fallback to column `0`
- no fallback to “first numeric-looking column”
- no fallback when `identifierColumnIndex` is missing

If `studentIdentifier` is not valid:
- show a blocking banner instead of unmatched-ID analysis
- explain that preview cannot determine matches until Student Number is mapped

For unmatched diagnostics, display:
- mapped identifier header name
- mapped column index
- first 5 values from that mapped column
- unique unmatched IDs from that mapped column only

### 6) Add debug logging at preview/import time in `src/hooks/useImportWizard.ts`
Add explicit console logging during `confirmMapping` and `runImport`:

Log:
- detected studentIdentifier header name
- detected studentIdentifier column index
- first 5 values from the mapped column
- whether the mapping came from auto-detect, manual selection, or template
- whether the mapped header passed validation

This will make it immediately obvious whether the wizard is still reading `1,2,3` / `K,1,2` or the real board IDs.

### 7) Improve failed-row visibility in `src/components/benchmarks/ResultsStep.tsx`
The current failed-row preview only shows the first few original columns, which can hide the actual identifier being used.

Update it so failed rows include:
- the mapped identifier header name
- the identifier value from that mapped column
- clearer context when the identifier mapping was invalid vs unmatched in roster

This makes post-import debugging align with the actual matching column.

## Files to update

- `src/lib/csvParser.ts`
- `src/hooks/useImportWizard.ts`
- `src/components/benchmarks/MappingStep.tsx`
- `src/components/benchmarks/PreviewStep.tsx`
- `src/components/benchmarks/ResultsStep.tsx`
- `src/components/benchmarks/ImportWizard.tsx` if needed to pass header/index metadata cleanly

## Expected outcome

With the uploaded CSV:
- the wizard auto-selects `Student Number`
- the preview debug sample shows board IDs like `1060214`, `1127726`, `1048492`
- it never selects grade/ordinal-style values like `1, 2, 3`
- if a valid ID column is missing, the wizard stops and requires manual mapping
- matching then runs against roster `externalStudentNumber` / `studentNumber` using the real board ID column only
