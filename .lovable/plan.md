## Problem

Four students show `expected ≠ actual` after the backfill ran successfully:

| Coded ID | Doc ID | Expected | Actual on doc |
|---|---|---|---|
| 1AF-7  | zczv996viRquAHpxxyvc | 1057559 | 1020583 |
| 1AF-13 | b7mKc4bGpP5uU0RWFbq0 | 1058132 | 1027515 |
| 1BF-6  | CdlP82WK0Y5PWzODIsbU | 1051601 | 1057273 |
| 1BF-16 | SejuBADMIeMew6syECrv | 1047318 | 1029135 |

All docs exist with `schoolId="folkstone_ps"`, so they're writable. The "value mismatch after write" almost certainly means the backfill matched the CSV row to a *different* doc that shares the same `(initials, homeroom)` or coded-id key — so it wrote the expected value to the wrong student, and this doc was either skipped or overwritten by another row in the same batch. Re-running the same CSV through the matching logic will repeat the same wrong assignment.

## Fix: write by doc ID, no matching

Add a small admin-only Cloud Function and a UI panel that takes a list of `{docId, expectedExternalNumber}` pairs and writes each value directly to that exact document. This bypasses all initials/homeroom/coded-id resolution and guarantees the right doc gets the right number.

## Changes

### 1. New Cloud Function `forceSetExternalStudentNumbers` (`functions/src/index.ts`)

- Admin-only (reuse `assertIsAdmin`).
- Input: `{ entries: Array<{ docId: string; externalStudentNumber: string }> }`, max 500.
- For each entry, in a single batched write:
  - Read `students/{docId}`. If missing → record `notFound`.
  - If `schoolId` doesn't match caller's `schoolId` → record `wrongSchool` (don't write).
  - Else `update({ externalStudentNumber, updatedAt: serverTimestamp() })`.
  - After commit, re-read the doc and confirm `externalStudentNumber === expected`; record `verified` or `verifyMismatch` with the actual value.
- Return `{ totals, results: [{ docId, action, before, after, actualAfterRead, reason? }] }`.
- Use `db.runTransaction` per entry (or batched commit + post-commit re-read) so we get a true round-trip verification, which is what surfaced the original problem.

### 2. New UI panel `ForceSetBoardNumbersPanel` on the Students tab

Location: `src/components/students/ForceSetBoardNumbersPanel.tsx`, rendered in `StudentsTab.tsx` next to `ServerBackfillPanel`.

- Textarea accepting CSV / pasted lines: `docId,externalStudentNumber` (one per line, header optional).
- Pre-filled with the 4 known mismatches as a one-click "Load known mismatches" button so the admin can run them immediately:
  ```
  zczv996viRquAHpxxyvc,1057559
  b7mKc4bGpP5uU0RWFbq0,1058132
  CdlP82WK0Y5PWzODIsbU,1051601
  SejuBADMIeMew6syECrv,1047318
  ```
- "Run force-set" button calls the new callable.
- Renders the per-row results table (action + before → after + verified actual) and a "Download report CSV" button matching the existing `ServerBackfillPanel` style.
- After success, calls `onAfterRun?.()` so the roster refreshes.

### 3. Build & deploy

`functions/package.json` is already set up; the new function ships on the next deploy of the `functions` directory.

## Why this approach

- The mismatches are caused by *matching* logic picking the wrong doc, not by a write/permission failure. Any tool that re-runs matching will keep getting it wrong.
- Writing by `docId` is unambiguous and trivially auditable.
- Post-write re-read + compare gives definitive proof the value stuck (this is what the original report was doing manually).
- Keeps the existing backfill panel untouched — this is a surgical "manual override" tool the admin can use whenever the CSV-driven matcher disagrees with reality.

## After the fix

Once the 4 docs are corrected, re-run the benchmark Import Wizard — the four previously-mismatched IDs (1057559, 1058132, 1051601, 1047318) will now resolve to the correct students.

Optional follow-up (not in this plan): investigate *why* the matcher chose the wrong docs — almost certainly a duplicate `(initials, homeroom)` collision or a stale `studentNumber` collision in the roster — and add a duplicate-detection warning to `ServerBackfillPanel` so future runs flag ambiguous targets before writing.