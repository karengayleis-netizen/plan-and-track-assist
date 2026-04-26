## Problem

1. **Kindergarten shows zero.** Grade matching uses literal string equality against `'K'`, but rosters often store kindergarten as `JK`, `SK`, `Kindergarten`, `k`, `0`, `KG`, etc. Any non-`'K'` variant disappears from grade-based filters, the Grade Analytics table, the risk-by-grade chart, and the Leadership Dashboard grade dropdown.
2. **Teacher Analytics is hardcoded "No teacher data yet."** The card renders a placeholder row — it never reads from `useStaff()` / homerooms / students. Nothing is computed.

## Fix

### 1. Grade normalization helper

Add `normalizeGrade(raw)` to `src/types/homeroom.ts` (or a small `src/lib/grade.ts`) that maps anything kindergarten-like to `'K'`:

- Trim, uppercase.
- `JK`, `SK`, `K`, `KG`, `KINDER`, `KINDERGARTEN`, `0`, `00` → `'K'`
- Numeric strings → that digit (e.g. `'01'` → `'1'`).
- Otherwise return cleaned string.

Apply at the read boundary in `src/hooks/useStudents.ts` (line 74) so every consumer sees a normalized `grade`. This is the cleanest fix and avoids touching every analytics file. Add a matching `normalizeGrade` call in `src/lib/rosterParser.ts` for new imports so what's saved matches what's read.

### 2. Teacher Analytics card (AdminTab.tsx, lines 1038–1062)

Replace the placeholder with a real table built from data already in scope:

- Source: `staffMembers` from `useStaff()` (already loaded in `AdminTab`) filtered to `role === 'teacher'`.
- For each teacher, compute from their `assignedHomerooms`:
  - **Class size** — count of active students whose `homeroom ∈ assignedHomerooms`.
  - **Benchmarks** — count of `benchmarks` whose `studentId` is in that class.
  - **Class Risk %** — % of those students whose `getStudentRiskLevel(s, benchmarks)` is `well-below` or `below`.
- Display teacher name (`displayName ?? email`), homeroom badges, the three metrics, and a View action.
- Keep the empty-state row for when no teachers are configured, but only show it when `staffMembers.filter(role=='teacher').length === 0`.
- Co-teaching: a homeroom can appear under multiple teachers — that's expected and fine.

### 3. Leadership Dashboard label

In `LeadershipDashboard.tsx` and `AdminTab.tsx` grade selects, the existing `g === 'K' ? 'Kindergarten' : 'Grade ${g}'` will now correctly fire for normalized values.

## Files

- **edit** `src/types/homeroom.ts` — add `normalizeGrade`.
- **edit** `src/hooks/useStudents.ts` — apply `normalizeGrade` to incoming `grade`.
- **edit** `src/lib/rosterParser.ts` — normalize grade during import.
- **edit** `src/components/tabs/AdminTab.tsx` — implement Teacher Analytics body using `staffMembers`, `students`, `benchmarks`.

## Out of scope

- No data migration for already-saved students with raw `JK`/`SK`. The read-time normalization in `useStudents` ensures they appear correctly in the UI without touching Firestore. If you'd like a one-time backfill script later, that can be a separate task.
