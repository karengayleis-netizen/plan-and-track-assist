## Eliminate `undefined` from every Firestore benchmark write

The probe failed with `[invalid-argument] Unsupported field value: undefined (found in field scoreLabel ...)`. The current code in `useImportWizard.ts` already coerces `getVal('status') || null`, so an `undefined` should be impossible there — which means the failing write came from a different code path or from a field we are not coercing. I will harden every write site so `undefined` cannot reach Firestore from any benchmark import or save, exactly as you specified.

### What I will change

**1. Add a shared `removeUndefinedFields` helper** in `src/hooks/useImportWizard.ts` (top of file):

```ts
function removeUndefinedFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
```

**2. Rebuild the bulk import payload (`runImport`, lines ~315–353)** so optional fields are *omitted* when blank instead of being set to `null`. Acadience-specific behaviour:
- `score` ← CSV `Score`
- `rawScore` ← CSV `rawScore` if present, else fall back to `score`
- `scoreLabel` ← CSV `Status` if present, otherwise omit the field entirely
- All other optionals (`benchmarkWindow`, `strand`, `classCode`, `notes`, `ref`, `percent`, `reference`, `term`) — only included when they have a real value

**3. Defensive validation right before `addDoc`:**
```ts
const cleanPayload = removeUndefinedFields(payload);
const stillUndefined = Object.entries(cleanPayload).filter(([, v]) => v === undefined);
if (stillUndefined.length) {
  console.error('[ImportWizard] undefined survived sanitization', stillUndefined);
}
await addDoc(collection(db, 'benchmarks'), cleanPayload);
```

**4. Apply the same sanitization to `probeWrite`** (lines ~472–496) so the next probe run uses the identical clean path.

**5. Fix `useBenchmarks.addBenchmark`** in `src/hooks/useBenchmarks.ts`:
- Zod's `.optional()` produces `undefined` for missing keys, and the result is spread into `addDoc`. Wrap that doc in `removeUndefinedFields` too.
- Also guard `schoolId: user?.schoolId` — if it's `undefined`, the field is `undefined` and Firestore rejects. Either omit it or fail fast with a clear error.

**6. Same treatment for the legacy CSV uploader** in `BenchmarksTab.tsx → handleCSVUpload` (passes `notesVal`, `refVal` that can be `undefined`). It calls `addBenchmark`, so fixing #5 covers it, but I'll spot-check.

### Acceptance test (after the fix)

1. Open the wizard → upload the same Acadience CSV → reach the Results screen.
2. Click **Test write 1 matched row** → expect `ok: true` with the cleaned payload printed (no `scoreLabel: undefined`, no `rawScore: undefined`).
3. Re-run the full import → expect ~**971 imported**, **9 unmatched** (1093503), **0 failed to save**, **0 unaccounted**.
4. Confirm Insights and student/class filters populate from the saved benchmarks.

### Files I will edit

- `src/hooks/useImportWizard.ts` — add `removeUndefinedFields`, rebuild `runImport` payload to omit blanks, sanitize before every `addDoc`, same for `probeWrite`.
- `src/hooks/useBenchmarks.ts` — sanitize the doc passed to `addDoc`, guard missing `schoolId`.

### What I will NOT touch

- Student matching (working — only the 9 known-bad 1093503 rows fail to match).
- Firestore rules.
- CSV column mapping or preset detection.
