# Update Student Numbers from Board Roster (new admin tool)

Stop trying to improve the backfill resolver. Instead, **rewrite student docs** so that `studentNumber`, `externalStudentNumber`, and `stableStudentId` all carry the board Student Number, and the old coded value (`4F-14`) moves to a new `displayCode` field. After this runs once, the existing Acadience import wizard matches naturally — no further wizard changes needed.

## What gets built

### 1. New Cloud Function: `updateStudentNumbersFromRoster`
File: `functions/src/index.ts` (admin-only callable)

Input:
```ts
{
  rows: Array<{
    boardStudentNumber: string;
    initials: string;
    homeroom: string;
    grade?: string;
    gender?: string;
    oen?: string;
    sourceSheet?: string;
    rowIndex: number;
  }>;
  dryRun: boolean;          // true = preview, false = write
  createMissing: boolean;   // user toggle for step 4
}
```

Per-row logic (server-side, runs as admin so it bypasses rules):

1. **Normalize**
   - `boardStudentNumber = String(input).trim().replace(/\.0+$/, '')` — reject if empty or non-numeric.
   - `initials = input.replace(/\./g, '').replace(/\s+/g, '').toUpperCase().trim()`
   - `homeroom = input.toUpperCase().trim()`

2. **Match within caller's `schoolId`**
   - First pass: students where `normInitials === initials AND normHomeroom === homeroom`.
   - If 0 → second pass with `homeroomStem` (existing helper logic, e.g. `4AF` → `4`).
   - If still 0 → action `create` (when `createMissing`) or `skipped`.
   - If exactly 1 → action `update`.
   - If > 1 → action `ambiguous` (return candidate IDs; never auto-write).

3. **Update payload** (only when action = `update`):
   ```ts
   {
     displayCode: existing.displayCode || existing.studentNumber, // preserve "4F-14"
     studentNumber: boardStudentNumber,
     externalStudentNumber: boardStudentNumber,
     stableStudentId: (
       !existing.stableStudentId ||
       /^[A-Z0-9]+-\d+$/i.test(existing.stableStudentId)
     ) ? boardStudentNumber : existing.stableStudentId,
     // initials, homeroom, grade, schoolId left untouched
     updatedAt, lastUpdated
   }
   ```

4. **Create payload** (when action = `create`):
   ```ts
   {
     schoolId: callerSchoolId,
     studentNumber: boardStudentNumber,
     externalStudentNumber: boardStudentNumber,
     stableStudentId: boardStudentNumber,
     initials, homeroom,
     grade: grade || '',
     firstName: '', lastName: '',
     // plus the standard required defaults from StudentSchema
     createdAt, updatedAt, lastUpdated
   }
   ```

5. **Verification re-read** (write mode only): re-fetch each touched doc and confirm `externalStudentNumber === boardStudentNumber`. Mark row `verified: true|false`.

Returns: `{ callerSchoolId, totals, results: [{ rowIndex, action, docId?, before, after, candidateIds?, verified?, reason? }] }`.

### 2. New UI panel: `UpdateStudentNumbersFromRosterPanel.tsx`
Location: `src/components/students/`, mounted in `StudentsTab.tsx` (admin only).

Flow:
1. **Upload CSV / XLSX** — reuse the existing `parseBackfillFile` helper (it already detects "Student Number", "Student Initials", "Section Number / Homeroom", "Grade"). Add OEN + Gender + Source Sheet pass-through.
2. **Preview** — call the function with `dryRun: true`. Render a table with these columns:

   | CSV # | Initials | Homeroom | Matched doc id | Old studentNumber | New studentNumber | displayCode | Action |
   |---|---|---|---|---|---|---|---|

   Action badge colors: update (blue), create (green), ambiguous (amber, expandable to show candidate IDs + a per-row "pick" radio), skipped (grey).
3. **Confirm & write** — toggles: ☑ Create missing students. Button disabled until preview ran.
4. **Results card** — totals: updated, created, ambiguous, skipped, failed; plus a verification line ("X of Y verified after re-read"). Download CSV report button.
5. After write: call `refetch()` from `useStudents` so the roster view reflects new numbers.

### 3. Type addition
`src/types/index.ts` — add:
```ts
displayCode?: string; // human-readable code like "4F-14", preserved from legacy studentNumber
```
No other fields renamed; `Student.studentNumber` keeps its name and now carries the board number going forward.

## Files changed

- `functions/src/index.ts` — new `updateStudentNumbersFromRoster` callable
- `src/components/students/UpdateStudentNumbersFromRosterPanel.tsx` — new panel
- `src/components/tabs/StudentsTab.tsx` — mount panel for admins
- `src/types/index.ts` — add `displayCode?: string`
- (optional cosmetic) any student row component that shows the coded ID — display `displayCode || studentNumber` so old "4F-14" still shows somewhere

No changes needed to `useImportWizard.ts` — its existing 3-tier match (`externalStudentNumber` → `studentNumber` → `stableStudentId`) all point to the board number after this runs.

## Roll-out

1. Deploy: `firebase deploy --only functions`
2. Students tab → **Update Student Numbers from Board Roster** → upload roster → review preview → confirm.
3. Re-run Acadience import wizard. Row with `Student Number = 970591` matches the J.P.E. doc whose `externalStudentNumber = 970591`.

## Acceptance — J.P.E.

| Field | Before | After |
|---|---|---|
| `studentNumber` | `4F-14` | `970591` |
| `externalStudentNumber` | (empty) | `970591` |
| `stableStudentId` | `4F-14` (or empty) | `970591` |
| `displayCode` | (n/a) | `4F-14` |
| `initials`, `homeroom`, `grade`, `schoolId` | unchanged | unchanged |

## Safety guarantees

- Admin-only (checks caller's custom claims).
- `schoolId` scoped — never touches docs outside the caller's school.
- Coded IDs (matching `^[A-Z0-9]+-\d+$`) are **never** written into `externalStudentNumber` or `studentNumber`.
- Ambiguous matches are never auto-written; user must resolve.
- Dry-run preview is mandatory — write button only enables after preview returns.
- Post-write re-read verification per row.
- Idempotent: re-running on already-migrated rows results in `update` with identical values (no harm) or can be skipped via an `alreadyMigrated` short-circuit (`existing.externalStudentNumber === boardStudentNumber`).
