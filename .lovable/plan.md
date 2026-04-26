## Goal

Get the 48 missing board numbers (and the 418 unmatched benchmark rows) imported by backfilling `externalStudentNumber` on the existing roster — using the Acadience CSV you just uploaded as the backfill source.

## Why this works

Your Acadience CSV already contains the three fields the backfill tool needs:

- `Student Number` → board number (e.g. `1046969`)
- `Student Initials` → `J.N.P.`
- `Class Name` → homeroom (e.g. `12E`)

The existing `parseBackfillFile` in `src/lib/backfillParser.ts` already recognizes all three header names as aliases. No code changes required for parsing.

It has no roster-ordinal column, so coded-ID matching is skipped automatically and it falls through to **initials + homeroom** matching — exactly the path that fixes your 111 students missing `externalStudentNumber`.

## Steps

1. **Run the backfill with the Acadience CSV itself**
   - Students tab → "Server-side board number backfill" panel
   - Upload `Acadience_Import_Ready_Final_With_Initials_Sheet1.csv`
   - The callable `backfillExternalStudentNumbers` runs as admin (bypasses rules) and writes `externalStudentNumber` onto every roster student whose initials + homeroom match a row.

2. **Read the totals badges** that appear after it finishes:
   - `Updated` / `Repaired schoolId + updated` → board numbers written ✅
   - `Already correct` → the 141 already linked
   - `No match` → roster gaps (student not in roster at all, or different initials/homeroom)
   - `Ambiguous` → multiple roster students share initials in same homeroom

3. **Re-run the benchmark Import Wizard** with the same CSV. The 418 unmatched rows should now resolve because their board numbers are linked to roster students.

4. **If `No match` is still > 0**, download the report CSV from the panel — it lists exactly which `Student Number / Initials / Homeroom` triples failed. Two common causes:
   - Roster homeroom code differs (file says `12E`, roster says `2E` or `1-2E`) → the parser already tries a "stem" fallback, but very different codes need the roster homeroom value updated.
   - Student genuinely not on roster → add them via the Students tab, then re-run.

## Why no code changes

- Header aliases for `Student Number`, `Student Initials`, `Class Name` already exist in `HEADER_ALIASES`.
- `fileUsesCodedIds = false` path is already implemented — `missingRosterNumber` warnings will be suppressed.
- Initials + homeroom (and homeroom-stem fallback) matching is already wired.
- Server function `backfillExternalStudentNumbers` is already deployed (Node 22).

## What gets delivered

After approval I'll:
1. Confirm the panel is reachable on the Students tab and walk you through the upload (no file edits needed).
2. If the report shows a systematic homeroom-format mismatch between the Acadience file (`12E`) and your roster, propose a one-line normalization tweak in `backfillParser.ts` and apply it.

Nothing to change in the codebase up front — the existing tool already accepts this exact file format.
