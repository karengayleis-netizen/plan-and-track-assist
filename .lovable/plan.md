## Plan

Two things in one pass:

1. Figure out why the Acadience CSV still won't import (functions are now deployed and healthy, so this is a data problem, not a deploy problem).
2. Bump Cloud Functions runtime from Node 20 → Node 22.

---

### Part 1 — Why the CSV won't upload

Looking at the file you attached:

- Column `Student Number` contains board numbers like `1046969`, `1049989`, `1050879`…
- Column `Class Name` contains homerooms like `12E`.

The Import Wizard tries to match each row to a student in your Firestore `students` collection by board number. To match, that number has to live in the `externalStudentNumber` field on the student doc, in your school. If it doesn't, the row shows as unmatched, the Import button stays disabled, and "nothing uploads."

The deploy you just finished gives us the tool to see exactly what's happening:

- `diagnoseImportStudentIds` will now classify every ID in the CSV as one of:
  - `visibleMatch` — fine, will import
  - `missingEverywhere` — student doc doesn't exist at all
  - `hiddenMissingSchoolId` — student exists but has no `schoolId` set
  - `hiddenWrongSchoolId` — student exists but is assigned to a different school
  - `duplicateExternalNumber` — same board number on multiple docs
- `backfillExternalStudentNumbers` can write the board numbers in for you when the roster matches by initials + homeroom but is missing the `externalStudentNumber`.

### Steps

1. In the app, open **Benchmarks → Import Wizard**, upload the same CSV again, map columns (`Student Number` → board ID, `Class Name` → homeroom), and go to the **Preview** step.
2. The Preview now runs the cross-school diagnosis automatically. Read the breakdown panel — it will tell us which bucket the unmatched rows fall into.
3. Based on the result:
   - If most rows are **`hiddenMissingSchoolId`** or matched by initials+homeroom → run the **Server Backfill** panel (Students tab) using your roster CSV. That writes board numbers and repairs `schoolId` in one shot. Then re-run the import.
   - If most rows are **`hiddenWrongSchoolId`** → those students are assigned to a different school. We need to identify which school and decide whether to reassign them.
   - If most rows are **`missingEverywhere`** → the students were never imported into the roster. Fix by uploading the school roster CSV in the Students tab first, then re-importing benchmarks.
   - If **`duplicateExternalNumber`** appears → we'll need a small one-off cleanup script to dedupe.

I cannot run those steps for you (Firestore data lives in your project, not the sandbox). I need the diagnosis output from the Preview step to know which fix to apply. Once you paste the buckets/counts, I'll give you the exact next action.

### Part 2 — Node 20 → Node 22 bump

Small, isolated change:

- Edit `functions/package.json`: change `"engines": { "node": "20" }` → `"node": "22"`.
- Locally run:
  ```cmd
  cd C:\Projects\plan-and-track-assist\functions
  npm install
  cd ..
  firebase deploy --only functions
  ```
- Confirm in the Firebase Console that all four functions show Node 22.

No code changes are needed — your functions only use `firebase-functions/v1` and `firebase-admin`, both fully compatible with Node 22.

## Technical details

- The Import Wizard's match logic (`src/hooks/useImportWizard.ts` line ~319) requires `r.matchedStudentId` to be set before a row is importable; the Import button (`PreviewStep.tsx` line 348) is disabled when `importableCount === 0`. That's the "won't upload" symptom.
- The roster matcher uses `externalStudentNumber` as the join key for board numbers, with normalization that strips leading zeros and trailing `.0`.
- The diagnose function reads all `students` docs with the Admin SDK, so it sees docs the client-side query cannot (those without `schoolId` or with the wrong `schoolId`). That's why the diagnosis panel will reveal causes the Preview can't show on its own.
- `backfillExternalStudentNumbers` matches by either `studentNumber` ("section-ordinal" coded ID) or `(initials, homeroom)`; if it finds a doc with no `schoolId` it both writes the board number and stamps the caller's `schoolId` (`repairedSchoolIdAndUpdated` action).

## Expected outcome

- Diagnosis panel tells us the exact reason rows are unmatched.
- Apply the matching fix (backfill, roster upload, or reassignment).
- CSV imports cleanly.
- Functions running on Node 22, off the deprecation track.
