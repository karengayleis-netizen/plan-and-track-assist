

## Add Missing Assessment Types + Implement CSV Upload/Download for Benchmarks

### Changes

**1. Add missing assessment types (`src/types/index.ts`, line 122-132)**

Update `ASSESSMENT_TYPES` to include the requested benchmarks:

```typescript
export const ASSESSMENT_TYPES = [
  'Acadience Reading',
  'DIBELS',
  'GB+ Reading',
  'PM Benchmark',
  'Running Record',
  'DRA',
  'Heggerty',
  'UFLI',
  'Knowledgehook',
  'MathUp',
  'Mathology',
  'Math Interview',
  'Writing Sample',
  'Other'
];
```

Grouped logically: reading assessments first, then phonics/foundational, then math, then writing, then catch-all.

**2. Implement CSV upload and download (`src/components/tabs/BenchmarksTab.tsx`)**

- **CSV Upload**: Parse the file using the 6-column format already documented in the UI: `StudentNumber, Type, Score, Date, Notes, Ref`. Match `StudentNumber` against loaded students to resolve `studentId`. Call `addBenchmark` for each valid row. Show toast with success/error count.

- **CSV Download**: Export current benchmarks as CSV with headers `StudentNumber, Type, Score, Date, Notes, Ref`. Trigger browser download.

- **Format help text**: Update the existing format hint to be clearer, showing an example row so teachers know exactly what to put in each column:
  ```
  Example: 1AF-3, Acadience Reading, Level 42, 2026-03-15, Spring assessment, REF-001
  ```

### Technical Details

- CSV parsing: simple `split(',')` with trim — no external library needed
- Download: create a Blob with `text/csv` MIME type, use a temporary `<a>` element
- Student matching: look up by `studentNumber` field from the loaded students array
- File input wired to state via `onChange`, read with `FileReader`

