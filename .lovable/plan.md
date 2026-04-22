

## Whole-School Board-Number Backfill from Excel/CSV

### Goal
Use the uploaded `Class_List_Cleaned_Initials_Numbers.xlsx`-style file to backfill `externalStudentNumber` on all 252 existing students in one upload, without touching any other student fields.

### What changes

**1. New "Backfill Board Numbers" upload control in the Students tab**
A second, separate upload button (next to the existing per-class CSV uploader) labeled **"Backfill Board Numbers (whole-school)"**. Accepts `.csv` and `.xlsx`. No homeroom selection required — it processes the entire file.

**2. Flexible column detection**
The parser reads the header row and locates columns by name (case-insensitive, trimmed):
- **Initials** — required. Headers: `Student Initials`, `Initials`
- **Board number** — required. Headers: `Student Number`, `Board Number`, `External Student Number`, `SIS ID`
- **Section / Homeroom** — required. Headers: `Section Number`, `Section`, `Homeroom`, `Class`
- **Grade** — optional, used as a tiebreaker. Headers: `Grade`, `Year Group`
- Ignores everything else (`Student #`, `OEN`, `Gender`, etc.)

**3. Match existing students (no creation)**
For each row, find the existing student by **`homeroom + initials`** (both normalized: trim, uppercase, strip dots from initials so `S.K.B.` matches `SKB` or `S.K.B.`). Optionally fall back to `homeroom + initials + grade` if there are duplicate initials inside one homeroom.

For each match: only write `externalStudentNumber` (and `lastUpdated`). Never overwrite names, grades, gender, or tags.

**4. Preview before commit**
After parsing, show a summary modal:
- ✅ N rows matched and ready to update
- ⚠️ N rows with no match (list initials + homeroom so the admin can fix names manually)
- ⚠️ N rows with ambiguous matches (multiple students with same initials in same homeroom — shown for manual resolution)
- ℹ️ N rows where the board number is already correct (skip)

The user clicks **Confirm Backfill** to commit. Without this preview, a typo in one initial would silently leave that student unmatched.

**5. Excel (.xlsx) parsing**
Add a lightweight client-side `.xlsx` reader (`xlsx` / SheetJS package, ~200KB). Reads all sheets, concatenates rows under a unified header. Falls back to CSV if a `.csv` is uploaded.

### Technical details

- **File:** `src/components/tabs/StudentsTab.tsx` — add a second upload card below the existing one, plus the preview dialog.
- **New utility:** `src/lib/backfillParser.ts` — handles xlsx + csv parsing, header detection, normalization (`normalizeInitials(s) = s.replace(/\./g, '').toUpperCase().trim()`).
- **Hook reuse:** Calls `updateStudent(id, { externalStudentNumber })` from `useStudents` in a loop. At 252 rows this is fine; no batching needed.
- **Dependency:** add `xlsx` (SheetJS community edition) to `package.json`.
- **No Firestore rule changes** — uses existing student update permissions.
- **No data model changes** — `externalStudentNumber` already exists on the Student type.

### Result
Upload the file once → preview shows ~252 matched / 0 unmatched (assuming initials line up) → click Confirm → every student now has their board number → the next Acadience benchmark import matches all rows immediately.

