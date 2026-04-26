# Why 0 rows imported when 971 rows matched

## What the numbers tell us

From your last run:
- **Total: 980** · Imported: **0** · Skipped: **9** · Unmatched: **9** · Failed to Save: **0**
- The downloaded error CSV contains exactly **9 rows**, all for student `1093503` (a kindergarten student not in your roster). Those 9 are correctly classified as "no match".
- That leaves **971 rows that matched a real student, were valid, entered the import loop, and yet neither succeeded (`Imported`) nor failed (`Failed to Save`)**.

That combination is mathematically impossible with the current code — unless one of three things is happening, and the current logging can't tell us which:

1. **Firestore rules silently reject every `addDoc`** but the rejection isn't reaching our `catch` block (e.g. a network-level error, or the promise is being lost).
2. **The loop is exiting early** (browser killed the tab, React unmounted the wizard mid-import, or an exception escaped the `for` loop entirely).
3. **The result object the UI shows is stale** — from a previous wizard run — and the real run is still pending or already failed.

## Most likely culprit: Firestore rules

Your `firestore.rules` for `/benchmarks/{id}` requires:

```text
allow create: if requestSameSchool();
```

…and `requestSameSchool()` requires `request.resource.data.schoolId == mySchoolId()`. The import code writes `schoolId: user.schoolId || ''`. If `user.schoolId` is ever an empty string at the moment of write (race with auth refresh), every single `addDoc` is rejected with `PERMISSION_DENIED`.

But your auth log clearly shows `schoolId: "folkstone_ps"` — so this should be fine. We need to **prove it** instead of guessing.

## The fix: make every outcome visible

I will tighten `runImport` so no row can disappear silently, and add a one-time "import diagnostics" panel.

### 1. Tighten counters in `src/hooks/useImportWizard.ts`

- Compute `attemptedCount` (= `validRows.length`) up front and assert that `attemptedCount === importedCount + errorCount` at the end. If it doesn't, log a hard error to the console with the exact deltas.
- Wrap the entire `for` loop in a `try/catch` so an exception thrown *between* iterations (not inside an `addDoc`) is captured and surfaced.
- Capture the exact Firestore error **code** (`err.code`) — not just the message — so `permission-denied`, `unavailable`, `cancelled`, `failed-precondition`, etc. are all distinguishable.
- If `user.schoolId` is empty at the moment of import, refuse to start and surface that as the failure reason instead of writing 971 rejected docs.

### 2. New "Import diagnostics" block in `ResultsStep.tsx`

When `importedRows + skippedRows + unmatchedRows + failedToSaveRows !== totalRows`, render a red diagnostics panel showing:

- The exact arithmetic (`980 = 0 imported + 9 skipped + 9 unmatched + 0 failed → 962 unaccounted`)
- The first 5 captured `err.code` / `err.message` pairs verbatim
- The `schoolId` that was used for the writes
- A button to **retry just one row** so we can read the full Firestore error in the network tab

### 3. One-row probe button

Add a "Test write 1 row" button on the Results screen (only when `failedToSave === 0` and `imported === 0`). It re-runs `addDoc` for the first matched row only and surfaces the raw error. This nails down whether it's a rules problem, a payload problem, or something else.

## Files I will edit

- `src/hooks/useImportWizard.ts` — tighten counters, add hard assertions, capture `err.code`, add `probeWrite()` method
- `src/types/importWizard.ts` — add `attemptedRows`, `accountedFor`, `lastErrorCode` to `ImportResult`
- `src/components/benchmarks/ResultsStep.tsx` — render the diagnostics panel + probe button

## What I will NOT change yet

- Firestore rules — until we have proof of the failure mode, changing rules is guessing.
- The matching logic — your matching is working (971 of 980 matched correctly).
- The student/insight filters — those will start working as soon as benchmarks actually save. Let's fix the import first, then verify the dashboard.

## After you re-run

You'll see one of three things in the new diagnostics panel:

1. **`PERMISSION_DENIED` on every row** → I'll fix the `schoolId` race or rules mismatch immediately.
2. **`UNAVAILABLE` / `DEADLINE_EXCEEDED`** → batched writes + retry logic (Firestore can't handle 971 sequential `addDoc` calls in flaky network conditions).
3. **`accountedFor` math is correct but `failedToSave: 971`** → we get the real error message and fix the payload.

Approve and I'll ship the diagnostics; first re-run will tell us exactly what to fix.