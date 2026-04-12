

## Answer: Yes, with a small enhancement

**Current state**: The import wizard already matches students across the entire school by `stableStudentId` or `studentNumber`. If you upload a whole-school CSV, every row will match to the correct student regardless of homeroom. The `classCode`/`homeroom` column is already recognized by the auto-detection engine (aliases: "class", "homeroom", "section").

**What's missing**: The matched homeroom/class data from the CSV isn't currently *stored* on the benchmark record or used for validation. It's detected but ignored during import.

## Plan: Whole-School Import Enhancement

### 1. Store class context on imported benchmarks
- When the CSV includes a `classCode`/`homeroom` column, save it on the benchmark document so it's queryable later.
- Cross-validate: if the student's rostered homeroom differs from the CSV's homeroom column, surface a warning (e.g., "Student 2AF-03 is in homeroom 2AF but CSV says 3BG") — helps catch stale data.

### 2. Add import summary grouped by class
- After import, show a breakdown in the Results step: how many rows imported per homeroom (e.g., "2AF: 12 students, 45E: 8 students, Unmatched: 3").
- This gives teachers confidence the whole-school file routed correctly.

### 3. Add homeroom filter to Preview step
- In the Preview/Validate step, add a dropdown to filter rows by detected homeroom so teachers can spot-check one class at a time before confirming.

### Technical details

**Files to modify:**
- `src/hooks/useImportWizard.ts` — store `classCode` from CSV on benchmark docs; build per-homeroom summary in results.
- `src/components/benchmarks/PreviewStep.tsx` — add homeroom filter dropdown.
- `src/components/benchmarks/ResultsStep.tsx` — display per-class import breakdown.
- `src/types/importWizard.ts` — add `matchedHomeroom` and `csvHomeroom` to `ImportRow`; add `classSummary` to `ImportResult`.

