# Diagnose & fix the "0 imported / 971 silent failures" bug

## What the numbers actually say

Your results screen shows:
- **Total Rows: 980**
- **Imported: 0**
- **Skipped: 9**  ← these are the 9 unmatched rows for student `1093503`
- **Unmatched: 9**

That leaves **971 rows** that *did* match a student in your roster, *did* pass validation, *were* sent to Firestore — and every single one **failed silently**. The Results screen never tells you about them, because the import code currently swallows write errors and the UI doesn't display the error count.

So this is **not** a roster-matching problem (matching worked for 971/980). Something is rejecting the writes to the `benchmarks` collection.

## Root cause to confirm

In `src/hooks/useImportWizard.ts` (`runImport`), every `addDoc(collection(db, 'benchmarks'), …)` is wrapped in `try { … } catch { errorCount++ }` — the actual error is thrown away. And `errorCount` is computed but never shown in `ResultsStep.tsx`.

Most likely culprits (in order):
1. A field value the Firestore SDK rejects (e.g., `Date` from an invalid `parsedDate`, or a value that becomes `NaN`).
2. A security rule edge case on `/benchmarks` create — unlikely given the rule only checks `schoolId`, but worth proving.
3. A required field the new schema expects that isn't being set.

We can't tell which until we stop swallowing the error.

## Fix — 3 small changes

### 1. Stop swallowing the real error
In `runImport`, log each failure with the row index, the document payload, and the error message. Capture the **first 5 errors** into a new `writeErrors: string[]` field on the result so we can show them on the Results screen.

### 2. Show write failures in the Results UI
Update `ImportResult` and `ResultsStep.tsx` so when `errorRows > 0` we display:
- A red banner: *"N rows matched a student but failed to save"*
- The first few error messages verbatim (e.g. `"Missing or insufficient permissions"`, `"Invalid Date"`, etc.)
- Include these rows in the downloadable error CSV (currently the CSV only includes unmatched/validation errors, not write failures).

### 3. Make the totals add up
Right now: Imported(0) + Skipped(9) + Unmatched(9) ≠ Total(980). Add a fourth tile **Failed to Save: 971** and rename the existing tiles so a teacher can see at a glance where every row went.

## About the Students / Insights filters

The filters are already there on the Students tab (search box, *All homerooms* dropdown, *All Tags* dropdown — `StudentsTab.tsx` lines 308–342). They're rendered inside the roster card header, top-right, and only appear once classes have loaded. If you're not seeing them, it's almost certainly a viewport/wrapping issue on the 889px-wide preview — they wrap to a second row below the title. After the next deploy, please confirm whether they're visible on a wider screen; if not, I'll move them into a dedicated filter row above the table so they're always obvious.

The Insights tab uses the same `useStudents` + `useBenchmarks` hooks — once the benchmark writes succeed, its charts and per-class breakdowns will populate automatically. There's nothing to fix there until the import works.

## Files to change

- `src/hooks/useImportWizard.ts` — log + capture write errors, return them in the result
- `src/types/importWizard.ts` — add `writeErrors: string[]` and `failedToSaveRows: number` to `ImportResult`
- `src/components/benchmarks/ResultsStep.tsx` — add the *Failed to Save* tile and the error banner
- `src/lib/csvParser.ts` — extend `generateErrorReportCSV` to include write-failure rows

## Next step after deploy

Re-run the same Acadience import. The Results screen will now show the actual Firestore error message for the 971 failed rows. Paste that message back to me and I'll fix the underlying cause in one shot — it'll be either a schema/field issue (5-line fix) or a rules tweak (also small).
