

## Make backfill outcomes verifiable per-student

The matcher and writer code is correct in principle:
- `handleConfirmBackfill` calls `updateStudent(studentId, { externalStudentNumber: ... })` for every row in `plan.matched`.
- `updateStudent` writes to Firestore.
- The schema accepts `externalStudentNumber`.

But for student `4F-14` you can see the field is still blank in Firestore. The current UI gives you only aggregate counts (matched / unmatched / ambiguous / already correct). It doesn't tell you which bucket `4F-14` landed in, or whether the Firestore write actually committed for that specific student. We're flying blind.

### Root-cause hypotheses (in order of likelihood)

1. **Row landed in `unmatched` or `ambiguous`** — the backfill file's row for that student didn't produce a `derivedCodedId = "4F-14"` (e.g. the "Section" cell wasn't `4F`, or "Student #" was missing/blank), and initials+homeroom matching also failed or was ambiguous. So no update was attempted and the silent skip never showed up.
2. **Row landed in `alreadyCorrect`** — meaning the file's external number for that row matched what was already on the student. If the student had `externalStudentNumber: ""` and the file row also had an empty/whitespace external number, the trim-equality check treats them as equal and skips.
3. **Write was attempted but failed** — `updateStudent` errors are swallowed into a generic toast count, with no per-student detail.
4. **Wrong school context / filtered out of `students` array** — the student wasn't in the in-memory roster passed to `buildMatchPlan`, so it was unmatchable.

### The fix — surface the truth, then fix the cause

**1. Add a per-student diagnostic lookup tool to the Backfill Preview dialog**

In `src/components/tabs/StudentsTab.tsx`, add a small input above the matched/unmatched cards: "Trace student by Student #" (e.g. type `4F-14`). It should report, against the current `backfillPlan`:

- Is the student present in the in-memory roster? (`students.find(s => s.studentNumber === input)`)
- If yes, what are its current `externalStudentNumber`, `homeroom`, `initials`, `id`?
- Did any backfill row produce `derivedCodedId === "4F-14"`?
- Which bucket did it land in (`matched` / `alreadyCorrect` / `unmatched` / `ambiguous`)?
- For unmatched: show the closest-by-initials-and-homeroom file rows.

This makes "why didn't this one update?" a 5-second answer instead of a research project.

**2. Tighten the `alreadyCorrect` check in `src/lib/backfillParser.ts`**

Change the equality so an empty/blank `externalStudentNumber` on the student is never treated as "already correct" when the file actually has a real board ID:

```ts
const current = (chosen.externalStudentNumber || '').trim();
const incoming = row.externalNumber.trim();
if (current && current === incoming) {
  alreadyCorrect.push(row);
} else {
  matched.push({ ... });
}
```

Today, if `current` and `incoming` are both empty strings, the row gets skipped as "already correct" — which is wrong for our case.

**3. Per-row write logging in `handleConfirmBackfill` (StudentsTab.tsx)**

Instead of a simple `ok++ / fail++`, build an array of per-row results:
```ts
{ studentId, studentNumber, externalNumber, status: 'updated' | 'failed', error?: string }
```
Log the array to console and show a post-commit summary panel ("Updated 412 of 448 — 36 failed; expand for details") with a button to download the result list as CSV. This way, when the user says "it didn't update student X", we can prove it from the write log.

**4. Re-fetch and verify after commit**

After the `for` loop completes in `handleConfirmBackfill`, call `refetch()` (already exists on the hook) and then re-check the previously-matched IDs against the new in-memory roster. If any matched row's student still has an empty `externalStudentNumber`, raise a red banner — that is the smoking gun for a Firestore-rule rejection.

**5. Surface unmatched/ambiguous rows inline (not just counts)**

Add expandable lists in the Backfill Preview dialog:
- "Show unmatched rows" → table of `initials | section | rosterNumber | externalNumber | derivedCodedId`
- "Show ambiguous rows" → same plus the candidate IDs

When the user can see that `4F-14` is sitting in the unmatched list with `derivedCodedId = "4F-14"` but the roster lookup failed, we'll know the issue is a roster vs. file mismatch on the coded ID itself (e.g. casing, hidden whitespace, or the student doc actually has `studentNumber: "4F-14 "` with a trailing space).

### Files to update

- `src/lib/backfillParser.ts` — fix the `alreadyCorrect` check so empty-vs-empty isn't "correct"
- `src/components/tabs/StudentsTab.tsx` — add the trace-by-student-# input, per-row write log, post-commit verification refetch, and expandable unmatched/ambiguous lists in the Backfill Preview dialog

### Out of scope

- No schema, Firestore rule, or matcher-algorithm changes beyond the `alreadyCorrect` correctness fix.
- No changes to the benchmark Import Wizard.

### Expected outcome

Re-open the Backfill Preview with the same file, type `4F-14` into the trace input, and you'll see exactly:
- whether the file produced a row for that student,
- which bucket it ended up in,
- and (after confirm) whether the Firestore write actually succeeded.

From there the real fix is one specific cause — not another speculative pass.

