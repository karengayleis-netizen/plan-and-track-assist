## Add a definitive pre-import diagnosis for unmatched Acadience IDs

### What the current code is actually doing

- The import wizard matches the mapped `Student Number` column against the visible roster in this order:
  1. `externalStudentNumber`
  2. `studentNumber`
  3. `stableStudentId`
- Matching happens in `src/hooks/useImportWizard.ts` after normalizing values (trim, strip trailing `.0`, strip leading zeros for numeric IDs).
- The roster used for matching comes from `useStudents()`, which only queries students where `schoolId == user.schoolId`.
- That means two different problems currently look identical in the UI:
  - the board number was never backfilled onto any student
  - the student doc exists, but has a missing/wrong `schoolId` so it is invisible to the wizard
- The current preview banner in `src/components/benchmarks/PreviewStep.tsx` only checks the already-filtered roster, so it cannot distinguish those two cases.

### Read-only diagnosis plan for this file

1. **Use the wizard preview as the first filter**
   - If the file maps `Student Number` correctly and rows still say `No matching student found in roster`, the issue is not the CSV column names.
   - Look at the preview stats:
     - if the roster count with `externalStudentNumber` is much lower than the total roster, that points to incomplete board-number backfill
     - if some rows match and many do not, the problem is likely mixed data quality, not header mapping

2. **Pick 3-5 unmatched board IDs from the preview/error CSV**
   - Use actual unmatched values from the file, not coded IDs like `1AF-7`
   - These are the values the wizard is trying to match to `externalStudentNumber`

3. **Definitive check in Firebase Console**
   - Open Firestore → `students`
   - Search for one unmatched board number in `externalStudentNumber`
   - Interpret the result like this:

```text
No document with that externalStudentNumber
  => missing board-number problem

Document exists, but schoolId is empty/missing
  => hidden student problem caused by missing schoolId

Document exists, but schoolId != your current schoolId
  => hidden student problem caused by wrong schoolId

Document exists, schoolId is correct
  => not a schoolId visibility problem; investigate duplicates/formatting
```

4. **Why the current UI cannot prove hidden-vs-missing by itself**
   - `useStudents()` never loads students outside the current `schoolId`
   - `confirmMapping()` only indexes that filtered array
   - the preview diagnostic also only inspects that same filtered array
   - so a hidden student is currently indistinguishable from a missing board number without either:
     - Firebase Console inspection, or
     - a privileged server-side diagnostic

### Exact UI/code change to make the wizard show missing IDs before import

#### 1. Add a callable diagnostic function
**File:** `functions/src/index.ts`

Add a new admin-only callable function, e.g. `diagnoseImportStudentIds`.

It should:
- require auth and admin role using the existing server-side admin check pattern
- derive the caller's `schoolId` from `user_roles/{uid}`
- accept a list of unmatched CSV student IDs
- normalize them with the same rules the wizard uses
- query `students` by `externalStudentNumber` in chunks
- classify each ID as one of:
  - `visibleMatch` — doc exists and `schoolId` matches caller school
  - `missingEverywhere` — no student doc has that board number
  - `hiddenMissingSchoolId` — doc exists but `schoolId` is empty/missing
  - `hiddenWrongSchoolId` — doc exists but `schoolId` belongs to a different school
  - `duplicateExternalNumber` — more than one student has that board number

This is the key change that makes the diagnosis reliable, because Admin SDK bypasses the client-side visibility limitation.

#### 2. Store match diagnostics in wizard state
**Files:**
- `src/types/importWizard.ts`
- `src/hooks/useImportWizard.ts`

Add diagnostic types/state such as:
- unique unmatched raw IDs
- unique unmatched normalized IDs
- visible roster stats (`students.length`, count with `externalStudentNumber`)
- server-side classification results from `diagnoseImportStudentIds`

In `confirmMapping()`:
- keep the existing row matching logic
- after matching, collect unique unmatched IDs from the mapped identifier column
- for admins, call `diagnoseImportStudentIds(uniqueUnmatchedIds)`
- save the result into wizard state before moving to Preview
- for teachers, fall back to a local-only diagnostic summary (no hidden-doc classification)

#### 3. Replace the current all-or-nothing warning banner with a real pre-import diagnosis panel
**File:** `src/components/benchmarks/PreviewStep.tsx`

Change the preview UI so diagnostics appear whenever there are unmatched IDs, not only when `matchedCount === 0`.

Show a structured panel like this:

```text
Unmatched student IDs before import
- 95 unmatched rows
- 62 unique student IDs

Likely missing board numbers
- 48 IDs not found on any student record
- sample: 1046969, 1057155, 1038425
- next action: run Backfill Board Numbers

Hidden student records
- 10 IDs found on student docs with missing schoolId
- 4 IDs found on student docs assigned to another schoolId
- next action: repair schoolId on those student docs

Visible roster health
- 312 visible students
- 141 students currently have externalStudentNumber
```

Also add a compact detail table:
- CSV ID
- status
- detail/reason
- next action

#### 4. Make the diagnosis actionable
**Optional but recommended**
- Add a “Download unmatched ID report” CSV from Preview
- Include columns like: `CSV Student ID`, `Status`, `Reason`, `Suggested Action`
- Keep internal Firestore doc IDs out of the downloadable report

### Expected result after implementation

- Before import, the wizard will tell you exactly which IDs are missing from the roster.
- It will separate:
  - `board number not backfilled anywhere`
  - `student exists but hidden because schoolId is missing/wrong`
- You will no longer have to guess whether the CSV is wrong or the roster visibility is wrong.
- The preview becomes the decision point: backfill board numbers, repair `schoolId`, or proceed with the matched rows.

### Technical details

**Files to change**
- `functions/src/index.ts` — add `diagnoseImportStudentIds` callable
- `src/types/importWizard.ts` — add diagnostic result types
- `src/hooks/useImportWizard.ts` — collect unmatched IDs and request server-side diagnosis
- `src/components/benchmarks/PreviewStep.tsx` — render pre-import missing-ID diagnostics

**Important constraints**
- Do not rely on the existing `useStudents()` list to detect hidden students; it is filtered by `schoolId`.
- Use the exact same normalization on both client and server.
- Keep the import matching logic unchanged; this feature is diagnostic, not a new matching algorithm.
- Server-side diagnosis must stay admin-only because it inspects records outside the caller’s visible roster scope.