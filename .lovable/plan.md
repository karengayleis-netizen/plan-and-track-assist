

## Fix the Backfill matching for the new file format — homeroom normalization + ambiguity resolver

### What the trace actually shows

The file is parsing correctly. All 4 columns auto-detect. The real issues are downstream:

1. **Homeroom code mismatch** is the dominant cause of the 164 "no match" rows. Example: roster `4F-14` (J.P.E.) lives in homeroom **`4F`**, but the file lists J.P.E. in **`3AF`**. Other likely mismatches in your roster vs file: `4F` vs `4AF`, `5F` vs `5AF`, `2F` vs `2AF`, `3F` vs `3AF`, `1F` vs `1AF/1BF`. The parser does a strict uppercase-trim compare, so `4F ≠ 4AF`.
2. **Genuine duplicates** in the file — same initials, same homeroom — must be resolved manually (parser cannot guess which student is which).
3. **Misleading "273 missing Student #" diagnostic** — this file format never has a roster ordinal, so the warning is noise.

### What this build will do

**1. `src/lib/backfillParser.ts` — smarter homeroom matching**

Add a homeroom equivalence layer used only when the strict match yields zero hits:

- Strip trailing letters from homeroom codes (`4AF` → `4`, `1BF` → `1`, `23F` → `23`) to get a "stem".
- When the strict `(initials, homeroom)` match returns 0 candidates, retry with `(initials, sameStem)` — i.e., find roster students whose initials match AND whose homeroom shares the file row's stem.
- If exactly one roster student matches across the stem, accept it (still write `externalStudentNumber`); record `matchSource: 'initialsHomeroomStem'` for the diagnostics view.
- If multiple match across the stem, route to ambiguous bucket as today.

This catches `J.P.E.` in file `3AF` → roster `3AF` only if such a student exists, but importantly catches `4F`↔`4AF`, `5F`↔`5AF` style mismatches that are the actual cause of most 164 unmatched rows.

**2. `src/lib/backfillParser.ts` — drop misleading roster-ordinal warning when format is initials-driven**

If the parsed sheet has `studentInitials` + `studentNumber` + `homeroom` but no `Student #` roster ordinal column, do NOT increment `missingRosterNumber` per row. Only count it when the file actually attempts to use coded IDs. This silences the "273 missing Student #" line when it's irrelevant.

**3. `src/components/tabs/StudentsTab.tsx` — actionable unmatched table**

Currently the unmatched table just lists rows. Add two columns / hints per unmatched row:

- "Closest roster initials in any homeroom" — show the homeroom code(s) where the same initials exist (e.g., `J.P.E. → roster has it in 3AF`). This makes the homeroom-mismatch problem instantly visible.
- "Resolve" button per row → opens a small inline picker listing candidate roster students (any homeroom, same initials). Picking one writes the `externalStudentNumber` to that student. Skipping leaves it unmatched.

**4. `src/components/tabs/StudentsTab.tsx` — inline ambiguity resolver**

For the 8 ambiguous rows (e.g. two `S.S.P.` in `1AF`), add a "Resolve" button per row in the existing ambiguous list:

- Opens a popover showing the candidate roster students with their `studentNumber` (coded ID like `1AF-3`), homeroom, grade, and any existing `externalStudentNumber`.
- User clicks the right one → that single mapping moves into the matched bucket (`matchSource: 'manualResolution'`).
- All resolutions are batched and written together when the user clicks Confirm.

**5. `src/components/tabs/StudentsTab.tsx` — trace output upgrade**

Extend the trace block so when `4F-14` is searched and no file row matched, it ALSO reports:

- "File rows with same initials (J.P.E.) in any homeroom: row 15, section=3AF, board=970591"

That's the single line that would have ended this debugging cycle on the first try.

### Files to update

- `src/lib/backfillParser.ts` — add homeroom-stem fallback in `buildMatchPlan`, suppress irrelevant ordinal warning, return `crossHomeroomInitialMatches` map for diagnostics.
- `src/components/tabs/StudentsTab.tsx` — render "Resolve" buttons in unmatched + ambiguous tables, wire manual selection into the matched batch, extend trace output.

### Out of scope

- No changes to roster homeroom codes (your roster's `4F` vs file's `4AF` is a real data discrepancy — the resolver lets you fix it case-by-case without re-uploading).
- No fuzzy initial matching (e.g., `J.P.E.` ≈ `J.E.P.`) — only homeroom is loosened.
- No persistence of the manual mappings beyond the current Confirm action.

### Expected outcome

- Re-upload `Class_Lists_by_HRM_Initials_For_Backfill.xlsx`.
- Most of the 164 unmatched collapse into matched once the homeroom-stem fallback catches `4F↔4AF` style mismatches.
- The remaining truly-unmatched rows (different student than the file expected) get a one-click "Resolve" picker showing candidate roster students.
- The 8 ambiguous rows each get a one-click resolver.
- Trace `4F-14` now reports: "File row 15 has J.P.E. in section 3AF — click to map" instead of just "NO FILE ROW".
- The "273 missing Student #" noise disappears for this file format.

