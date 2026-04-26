# Clean Reset: Student Identity Model

Reset the student identity system to use **board student number** as the single identifier. Drop coded IDs (4F-14), `externalStudentNumber`, `stableStudentId`, `displayCode`, and ordinal-based matching. Build a new admin roster upload that fully replaces the school's student records.

## New data model

`Student` document fields kept:
- `studentNumber` (board number from CSV, e.g. `"970591"`)
- `initials` (e.g. `"J.P.E."`)
- `homeroom` (e.g. `"4F"`)
- `grade` (e.g. `"4"`)
- `schoolId`
- `active: true`
- `createdAt`, `updatedAt`

Removed/ignored: `stableStudentId`, `externalStudentNumber`, `displayCode`, `firstName`, `lastName`, `seat`, `yearGroup`, `className`, `sen`, `pupilPremium`, `eal`, `gender` (kept optional but not part of identity).

Identity rule: **upsert by `studentNumber` only.**

## Admin roster upload (replaces existing flow)

New panel **"Replace Roster from Board CSV"** in Students tab (admin only). Hidden behind a confirmation step.

CSV headers accepted (case-insensitive, flexible):
- `Student Number`
- `Student Initials`
- `Homeroom` OR `Section Number`
- `Grade`

### Flow

1. **Upload + parse** — read CSV in browser, normalize values:
   `String(v ?? "").trim().replace(/\.0$/, "")`
2. **Preview table** showing every parsed row with validation status:
   - Missing `studentNumber` → row error
   - Duplicate `studentNumber` within file → row error
   - Missing `homeroom`/`section` → row error
   - Missing `grade` → row error
   - Missing `initials` → warning (allowed)
   - Summary: `X usable rows, Y errors, Z warnings`
3. **Confirm "Replace Roster"** button (disabled if errors). Triggers a Cloud Function `replaceSchoolRoster`:
   - Marks all existing students for this `schoolId` as `active: false` (preserves history; benchmarks keep their `studentId` references but won't surface in active lists)
   - Deletes any old students whose `studentNumber` matches the legacy 4F-14 coded pattern (`/^[A-Z0-9]+-\d+$/`) for this `schoolId`
   - For each valid CSV row, upserts by `studentNumber` (query: `where schoolId == X and studentNumber == N`):
     - If found → update `initials`, `homeroom`, `grade`, `active: true`, `updatedAt`
     - If not found → create new doc with the 7 fields above
4. **Results screen** — created / updated / deactivated / removed counts.

## Benchmark import matching (rewrite)

In `useImportWizard.ts`, replace the 3-tier match with a single rule:

```ts
const norm = (v: unknown) => String(v ?? "").trim().replace(/\.0$/, "");
const byStudentNumber = new Map<string, Student>();
for (const s of students) {
  if (!s.active) continue;
  const n = norm(s.studentNumber);
  if (n) byStudentNumber.set(n, s);
}
// match: byStudentNumber.get(norm(csvStudentNumber))
```

Drop all references to `externalStudentNumber`, `stableStudentId`, `displayCode` in matching, lookup indexes, and unmatched-diagnosis output.

Acadience preset already maps "Student Number" → `studentIdentifier`; no change needed there.

## Teacher-facing display

New helper `formatStudentDisplay(student)`:

```ts
const last3 = student.studentNumber.slice(-3);
return `${student.initials} · ${student.homeroom} · #${last3}`;
// → "J.P.E. · 4F · #591"
```

Apply in:
- `StudentsTab` roster table (replaces full studentNumber column)
- `StudentSummaryPanel`
- `GlobalSearch` results
- `BenchmarksTab` student column
- `MarkbookTab`, `MissingDataTab`, `TriangulationTab`, `InsightsTab` lists
- `BulkActionsBar` selected-student chips

Keep full `studentNumber` visible in:
- Admin Students table (extra column, admin only)
- Import Wizard preview/results
- Backfill/debug panels
- Student edit modal

## Files to edit / remove

**Edit**
- `src/types/index.ts` — slim `Student` interface
- `src/lib/validations.ts` — slim `StudentSchema`
- `src/hooks/useStudents.ts` — drop duplicate-`stableStudentId` check; upsert by `studentNumber`
- `src/hooks/useImportWizard.ts` — single-key matching
- `src/components/tabs/StudentsTab.tsx` — remove old CSV upload, ForceSetBoardNumbersPanel, ServerBackfillPanel, UpdateStudentNumbersFromRosterPanel, backfill state; add new `ReplaceRosterPanel`; switch table to display helper
- `src/components/tabs/BenchmarksTab.tsx` — display helper
- `src/components/layout/GlobalSearch.tsx` — display helper, search by `studentNumber`/`initials`/`homeroom` only
- `src/components/benchmarks/PreviewStep.tsx` — display helper, drop external/stable refs
- `functions/src/index.ts` — add `replaceSchoolRoster` callable; deprecate (leave but stop calling) `updateStudentNumbersFromRoster`, `forceSetBoardNumbers`, `diagnoseImportStudentIds`

**Create**
- `src/components/students/ReplaceRosterPanel.tsx` — upload, preview, confirm
- `src/lib/studentDisplay.ts` — `formatStudentDisplay()` helper
- `src/lib/rosterParser.ts` — parse + validate the 4-column board CSV

**Delete**
- `src/components/students/ForceSetBoardNumbersPanel.tsx`
- `src/components/students/ServerBackfillPanel.tsx`
- `src/components/students/UpdateStudentNumbersFromRosterPanel.tsx`
- `src/lib/backfillParser.ts`

## Cloud Function: `replaceSchoolRoster`

Callable, admin-only (verify `request.auth` + `user_roles/{uid}.role == 'admin'`).

Input: `{ rows: Array<{ studentNumber, initials, homeroom, grade }> }` (already validated client-side; re-validate server-side).

Steps (batched writes):
1. Query all `students` where `schoolId == caller.schoolId`
2. Build `existingByNumber` map
3. For each input row: upsert by `studentNumber`; collect ids touched
4. For existing students NOT in input: set `active: false`
5. For existing students whose `studentNumber` matches `/^[A-Z0-9]+-\d+$/` AND not in input: delete
6. Return `{ created, updated, deactivated, deleted, errors }`

## Acceptance test

1. Upload CSV with row: `970591, J.P.E., 4F, 4`
2. Firestore `students` doc:
   ```json
   { "studentNumber": "970591", "initials": "J.P.E.", "homeroom": "4F", "grade": "4", "active": true, "schoolId": "..." }
   ```
3. Roster table shows: `J.P.E. · 4F · #591`
4. Acadience CSV row with `Student Number = 970591` matches immediately in Import Wizard preview.

## Notes on existing data

- Benchmark/markbook documents already reference students by Firestore `id` (not `studentNumber`), so deactivating old student records does not orphan them — but since you confirmed no usable benchmark/markbook data exists yet, the cleanest path is: after the new roster upload, also offer a one-click "Wipe all benchmarks/markbook for this school" button in the admin panel (separate confirm). I'll include this as part of `ReplaceRosterPanel`.
