

## Benchmark Import Wizard

A 6-step guided import flow inside the Benchmarks tab that handles CSV uploads from Acadience, DIBELS, Knowledgehook, and generic exports with column mapping, validation preview, and OEN-hash-based student matching.

### Architecture

```text
src/
  lib/
    csvParser.ts           (new) — CSV parsing, column alias detection, row normalization
    importPresets.ts        (new) — source presets with default mappings & assessment families
  types/
    importWizard.ts         (new) — all wizard types (WizardStep, ColumnMapping, ImportRow, etc.)
  hooks/
    useImportWizard.ts      (new) — wizard state machine + validation + Firestore write logic
  components/
    benchmarks/
      ImportWizard.tsx      (new) — main wizard shell with step progress indicator
      SourceStep.tsx        (new) — Step 1: source selection cards
      UploadStep.tsx        (new) — Step 2: file upload + header preview
      MappingStep.tsx       (new) — Step 3: column mapping UI with auto-detect
      PreviewStep.tsx       (new) — Step 4: preview table + validation summary
      ResultsStep.tsx       (new) — Step 5: import results + error report download
      SaveTemplateStep.tsx  (new) — Step 6: optional save mapping template
```

### New Files

**1. `src/types/importWizard.ts`**
- `ImportSource`: `'acadience' | 'dibels' | 'knowledgehook' | 'generic_csv'`
- `AssessmentFamily`: `'reading' | 'math' | 'other'`
- `WizardStep`: enum for the 6 steps
- `ColumnMapping`: maps internal field names to CSV column indices
- `ImportRow`: parsed row with match status, validation errors, matched student info
- `ImportResult`: totals for imported/skipped/unmatched/errors
- `NormalizedBenchmark`: the full document shape (schoolId, studentId, source, assessmentFamily, assessmentType, score, scoreLabel, rawScore, percent, benchmarkWindow, strand, date, notes, ref, importedAt, importedBy, rawImportMeta — never raw OEN)
- `ImportTemplate`: saved mapping template shape
- `ImportRun`: audit trail shape

**2. `src/lib/csvParser.ts`**
- `parseCSV(text: string)`: handles quoted values, returns `{ headers: string[], rows: string[][] }`
- `detectColumnMapping(headers, source)`: auto-matches headers to internal fields using alias maps
- `COLUMN_ALIASES`: maps for studentIdentifier, assessmentType, score, date, notes, etc.
- `normalizeRow(row, mapping, source, preset)`: produces a normalized object ready for Firestore
- `validateRow(normalized)`: returns validation status (ready/warning/error) and messages

**3. `src/lib/importPresets.ts`**
- Preset configs for each source: default `assessmentFamily`, suggested column names, label overrides
- Acadience: reading, expects OEN/Measure/Score/Date
- DIBELS: reading, expects OEN/Subtest/Score/Date
- Knowledgehook: math, expects OEN/Assessment/Score or Percent/Date/Strand
- Generic: no assumptions

**4. `src/hooks/useImportWizard.ts`**
- Manages wizard state: current step, source, file data, column mapping, parsed/validated rows, import results
- `matchStudents()`: hashes OEN from mapped column, matches against `students` by `oenHash`, falls back to `studentNumber`
- `runImport()`: writes valid rows to Firestore `benchmarks` collection using the normalized shape, records `importedAt`/`importedBy`
- `saveTemplate()`: writes mapping to `benchmark_import_templates` collection
- `saveImportRun()`: writes audit record to `benchmark_import_runs` collection
- `generateErrorCSV()`: builds downloadable CSV of skipped rows with reasons (no raw OEN)

**5. `src/components/benchmarks/ImportWizard.tsx`**
- Dialog-based wizard triggered by "Import CSV" button in BenchmarksTab
- Step progress bar at top
- Renders the appropriate step component
- Back/Next/Cancel navigation

**6. Step Components**
- **SourceStep**: 4 cards (Acadience, DIBELS, Knowledgehook, Generic CSV) with icons and descriptions
- **UploadStep**: file input, shows filename/row count/header preview
- **MappingStep**: for each internal field, a dropdown selecting which CSV column maps to it; auto-populated from alias detection; required fields highlighted
- **PreviewStep**: table of first 10 rows showing matched student initials, assessment type, score, date, status badge (Ready/Warning/Error); summary counts above
- **ResultsStep**: success summary (imported/skipped/unmatched counts), option to download error report CSV
- **SaveTemplateStep**: optional name input + save button; shows existing templates for this source

### Changes to Existing Files

**`src/components/tabs/BenchmarksTab.tsx`**
- Add "Import CSV" button that opens the ImportWizard dialog
- Keep existing manual entry form and legacy CSV upload as-is for backward compatibility
- After wizard import completes, refetch benchmarks

**`src/types/index.ts`**
- Extend `Benchmark` interface with optional fields: `source`, `assessmentFamily`, `scoreLabel`, `rawScore`, `percent`, `benchmarkWindow`, `strand`, `importedAt`, `importedBy`, `rawImportMeta`

**`src/lib/validations.ts`**
- Add optional fields to `BenchmarkSchema` matching the new Benchmark fields

### Privacy
- Raw OEN is only held in memory during the matching step
- `rawImportMeta` stores original filename and mapped column names but never raw OEN
- Error report CSV uses coded student number or "Unmatched", never raw OEN
- No OEN in console logs

### Backward Compatibility
- Existing benchmark documents and workflows are untouched
- New fields on Benchmark are all optional
- Legacy CSV upload button remains functional

