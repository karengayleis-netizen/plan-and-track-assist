

## Make the backfill failure visible — add diagnostics + roster coverage indicator

We've changed the matcher twice and we're still guessing. The 448 failed rows all reference real board IDs (`1027516`, `1035148`...), and the only way these still fail is if the matching `externalStudentNumber` was never written to those students. Let's stop guessing and surface the truth in the UI.

### What we'll add

**1. Roster coverage indicator on the Students tab**
A small stat card at the top of the Students tab:

> **Board IDs backfilled: 47 / 252 students (19%)**

So you can see at a glance whether the backfill actually populated `externalStudentNumber` across the roster, without opening Firebase Console.

**2. "Detected columns" panel in the backfill upload preview**
Before showing the match summary, show what the parser actually saw in your file:

```
Detected columns from your file:
  • Initials column      → "Student Initials"   ✓
  • Board number column  → "Student Number"     ✓
  • Section/Homeroom     → "Section Number"     ✓
  • Roster ordinal (#)   → NOT FOUND  ✗ ← this is why nothing matched by coded ID
  • Grade column         → "Grade"              ✓
```

If "Roster ordinal" is `NOT FOUND`, the derived-ID match path can't run and everything falls back to fragile initials matching. This single line will tell us the answer immediately.

**3. Show 5 sample rows the parser actually built**
Right under detected columns, show the first 5 parsed rows with all extracted fields, so you can verify the parser read the right cells:

```
Sample parsed rows:
  Row 2: section="1AF" #="1" initials="SKB" board="1027516" → derives ID "1AF-1"
  Row 3: section="1AF" #="2" initials="JTM" board="1035148" → derives ID "1AF-2"
  ...
```

**4. Show the first 10 unmatched rows in full**
Currently the dialog shows counts. Switch the unmatched section to a small table with: row #, section, ordinal #, initials, derived ID, board ID, and the reason — exactly the info needed to compare against the actual roster.

**5. Benchmark wizard: list unique unmatched IDs, not just row count**
On the failed-rows screen, add a one-line summary:

> **448 failed rows represent 51 unique student IDs.**
> First 10 unmatched IDs: 1027516, 1035148, 1046969, 1049989, 1050879, ...
> Of these, 0 are present as `externalStudentNumber` on any student in the roster.

Then it's obvious whether the issue is "backfill didn't reach these students" vs. "matcher has a bug."

### Files to update

- `src/components/tabs/StudentsTab.tsx` — roster coverage stat at top; richer backfill preview dialog (detected columns, sample parsed rows, full unmatched table)
- `src/lib/backfillParser.ts` — return `detectedColumns` (which header was picked for each field, or `null`) and `sampleRows` (first 5 parsed `BackfillRow`s) on `BackfillParseResult`
- `src/components/benchmarks/PreviewStep.tsx` — unique unmatched ID summary with roster cross-check

### What this does NOT change

- No matcher logic changes
- No data writes
- No schema changes
- No Firestore rule changes

This is purely diagnostic instrumentation so we can see what's actually happening and fix the real cause on the next pass.

### Expected outcome

After this ships, re-upload the workbook in **Backfill Board Numbers**. The dialog will tell us in plain text which header was missed (almost certainly the ordinal column), or that the derived IDs don't exist in the roster. Then the fix is one line — either a new alias or a roster ID format adjustment — instead of another round of speculation.

