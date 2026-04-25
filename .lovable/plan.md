## Make Option A actually work — server-side backfill of `externalStudentNumber`

### Why the previous backfill failed silently

Tracing the earlier "37 succeeded, 4 didn't persist" symptom against the current code and rules:

1. **Client-side writes go through Firestore rules.** The `students` update rule requires both `resourceSameSchool()` and `requestSameSchool()` — meaning the existing doc *and* the update payload both need a `schoolId` matching the caller's. If those 4 student docs had a missing/different `schoolId`, the write looks "successful" from the SDK's optimistic perspective but is rejected on the server, so the value never persists.
2. **`updateDoc` from the client doesn't always surface a hard error** in mixed batches when the optimistic local cache write happens before the server roundtrip — especially if the calling code didn't `await` and inspect each promise individually.
3. **`studentNumber` on your docs is the coded ID** (`4F-14`), not the board number. Nothing in your roster currently holds the board number, so the import wizard cannot match. Backfill is the missing prerequisite.

### Goal

A reliable, one-shot way to write the real board number into `externalStudentNumber` on every student doc — with a per-row report of exactly what happened, and zero dependence on client-side rules quirks.

### Approach

Add a new admin-only callable Cloud Function that does the backfill server-side using the Admin SDK (which bypasses Firestore rules entirely). The teacher/admin uploads the same CSV they already have (initials + board number + section + ordinal). The function:

1. Loads the caller's full school roster once.
2. For each CSV row, finds the matching student via the same 3-tier match used elsewhere (Section + Student #, then Initials + Homeroom).
3. Compares the CSV board number to the doc's current `externalStudentNumber`.
4. Writes only when different/missing.
5. Returns a structured report: `updated`, `alreadyCorrect`, `noMatch`, `ambiguous`, `errored`, plus per-row details.

Because the function runs as Admin SDK, the `schoolId`-mismatch / missing-`schoolId` cases that silently failed before will now succeed (and the function can also *repair* the `schoolId` on the same write when it's missing).

### UI surface

Add a small "Backfill board numbers" panel inside the existing Students tab admin section (near the existing CSV import). It accepts the same roster CSV the user already has, calls the new function, then renders the result counts and lets them download a per-row CSV report (`student_id, action, before, after, reason`).

### Files to change

**`functions/src/index.ts`**
- New callable `backfillExternalStudentNumbers`.
  - Auth: `assertIsAdmin` + caller must have `schoolId`.
  - Input: `{ rows: Array<{ section?: string; ordinal?: string; initials?: string; homeroom?: string; boardNumber: string }> }` (max 2000 rows).
  - For each row: find candidate doc via `studentNumber == "{section}-{ordinal}"` first, fall back to `(initials, homeroom)` within the caller's `schoolId`. If still no match, also try a cross-school lookup *only* for docs whose `schoolId` is empty (those are the "hidden missing schoolId" cases) and repair the `schoolId` in the same write.
  - Skip when `externalStudentNumber` already equals the normalized board number.
  - Return per-row results + totals.

**`src/components/tabs/StudentsTab.tsx`** (or a new sibling component imported here)
- New "Backfill board numbers" card: file picker → parse CSV client-side → call the function → show counts + downloadable report. Reuse `parseCSV` from `src/lib/csvParser.ts`.

**`src/lib/firebase.ts`** — no change; already exports `functions`.

**No rules change required** — the function bypasses rules. (Optional follow-up: tighten the existing `students` create/update rules later, since backfill no longer relies on the client.)

### Deployment

After implementation, the user runs:

```text
firebase deploy --only functions:backfillExternalStudentNumbers
```

Then uses the new panel once. After it finishes, the Acadience import wizard will match every row against `externalStudentNumber` on the first try.

### What this does NOT do

- Does not remove `externalStudentNumber` from the data model — keeps it as the canonical board-number field, exactly as the rest of the codebase expects.
- Does not change the import wizard matching logic — that's already correct, it just needs the field populated.
- Does not change `studentNumber` (`4F-14` style codes stay intact for UI display, sorting, and audit).
