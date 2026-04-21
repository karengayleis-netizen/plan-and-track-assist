

## Why 0 rows imported

Your transformed CSV uses Acadience's 7-digit board student numbers (`1027516`, `1035148`, etc.) in the **Student Number** column. But this app stores students under two identifiers:
- `stableStudentId` — the internal canonical key
- `studentNumber` — a coded display ID like `2AF-03`

The wizard's matcher (`confirmMapping` in `useImportWizard.ts`) only checks those two fields. Since neither holds `1027516`, every row falls into "No student match found" → status becomes `warning` → `runImport` filters them out (`r.status !== 'error' && r.matchedStudentId`) → 0 imported.

It is **not** the file size or whole-school scope — Firestore client writes have no batch limit issue at this scale, and the loop in `runImport` handles row-by-row.

## Fix

Add a third identifier on each student — the board's external Acadience/SIS number — and teach the matcher to use it. This is the standard pattern for school data tools that bridge an internal coded ID with the board's SIS export.

### What changes

**1. `src/types/homeroom.ts` (Student type)** — Add an optional `externalStudentNumber?: string` field. This holds the board-issued number that appears in Acadience/DIBELS/SIS exports.

**2. Students tab — Edit Student dialog** — Add an "External / Board Student # (from SIS)" input next to the existing Student Number field. Admins fill this in once per student; teachers see it as read-only.

**3. Bulk update path — CSV roster upload** — Extend the existing student CSV uploader (in `useStudents` / Students tab) to recognize an `External Student Number`/`Board Number`/`SIS ID` column and populate `externalStudentNumber` on create or update. This lets you backfill all 252 students in one shot from the same Acadience export's roster section.

**4. `src/hooks/useImportWizard.ts` — confirmMapping matcher** — Extend the lookup to a 3-tier match:
```
students.find(s => s.stableStudentId === rawIdentifier)
|| students.find(s => s.studentNumber === rawIdentifier)
|| students.find(s => s.externalStudentNumber === rawIdentifier)
```
Also normalize both sides (trim, strip leading zeros) so `01027516` matches `1027516`.

**5. Diagnostics on the Preview step** — When zero rows match, show a banner: *"No students matched. The CSV uses board numbers (e.g. 1027516) but your roster uses coded IDs (e.g. 2AF-03). Add board numbers to your students via the roster upload, or map a different identifier column."* Today the failure is invisible because the user clicks Import on a screen of warnings and sees 0 imported with no explanation.

### Technical details

- `externalStudentNumber` is indexed client-side via `students.find(...)`; no Firestore index needed at this roster size (~252).
- Firestore rules need no change — same `students` collection, same `schoolId` scoping.
- Backfill path: export a CSV from Acadience with `Student Number, Student Last Name, Student First Name, Class Name`, then upload via Students tab. The uploader matches on name + homeroom (existing logic) and writes `externalStudentNumber`.
- The Copilot prompt for Acadience already outputs a `Student Number` column — no change to the prompt, since after backfill that value will resolve correctly.
- Optional follow-up (not in this plan): also accept Last Name + First Name + Class Name as a tertiary fallback match in the wizard, for the rare case where a student lacks an `externalStudentNumber`.

### Result

After backfilling external numbers once, every future Acadience/DIBELS upload matches without manual ID translation, and the 252 students you already have will accept benchmark imports straight from the board export.

