## Goal

Transform the Admin tab from a "data summary" into a Principal Leadership Dashboard: comprehensive filters, KPI cards focused on action, two heatmaps, leadership action lists, a Data Meeting view with export, and a separate gender-completeness card.

All risk classification continues to flow through `getStudentRiskLevel` / `classifyScoreLabel` (Acadience `scoreLabel`-based), and student-facing labels stay privacy-friendly via `formatStudentDisplay` (initials · homeroom · #last3). Full `studentNumber` is shown only in the Data Meeting CSV export.

This work is additive — existing Class Management, Staff Directory, AI Strategy and the recently-added Class Deep Dive cards are preserved. The new content goes at the top of the Admin tab, above existing cards.

---

## 1. New shared utilities

### `src/lib/leadershipMetrics.ts` (new)
Pure functions, no React, fully unit-testable:

- `inferWindow(b: Benchmark): 'BOY'|'MOY'|'EOY'|'unknown'` — derived from `benchmarkWindow` / `term` strings (`/beginning|boy|fall/i` → BOY, `/middle|moy|winter/i` → MOY, `/end|eoy|spring/i` → EOY).
- `STANDARD_MEASURES = ['FSF','LNF','PSF','NWF-CLS','NWF-WWR','ORF','Composite']`.
- `inferMeasure(b: Benchmark): string` — normalizes `assessmentType`/`assessmentName` to one of `STANDARD_MEASURES` (fallback to raw string).
- `latestBenchmarkPerStudentMeasure(benchmarks)` — Map keyed by `${studentId}|${measure}` → most recent benchmark.
- `riskFromBenchmark(b)` → `RiskLevel` via `classifyScoreLabel(b.scoreLabel)`.
- `studentsMissingData(students, benchmarks, {window?, measure?})` — students with zero benchmarks matching the scope.
- `multipleBelowMeasures(student, benchmarks)` — count of distinct measures where the latest score is below or well-below.
- `pctByBand(items)` → `{ atOrAbove, near, below, total }`.

### `src/lib/leadershipExport.ts` (new)
- `toCSV(rows: Record<string,string|number>[])` — minimal CSV serializer with quoting.
- `downloadCSV(filename, rows)` — triggers a browser download via Blob/URL.
- Used by Data Meeting export. This is the only place full `studentNumber` is included.

---

## 2. New component: `src/components/admin/LeadershipDashboard.tsx`

Self-contained section rendered at the top of `AdminTab`. Owns its filter state and reads `useStudents()` + `useBenchmarks()`.

### Filter bar (sticky row at top of the section)

A single responsive grid of selects + toggles:

- Grade (`all` + each grade present)
- Homeroom (`all` + each homeroom present)
- Gender (`all`, `M`, `F`, `X`, `Unknown / Not recorded`) — admin-only (always true here)
- Window (`all`, `BOY`, `MOY`, `EOY`)
- Measure (`all` + the seven standard measures actually present in data)
- Status band (`all`, `at-or-above`, `approaching`, `below`, `well-below`)
- Toggle: **No data only**
- Toggle: **Focus students only**
- "Reset filters" button

Filters compose: `filteredStudents` is derived by applying student-level filters (grade/homeroom/gender/focus); `filteredBenchmarks` is derived by intersecting with `filteredStudents` + window + measure. Status band filter applies to the per-student computed risk level.

### Gender completeness card

Small horizontal card immediately below the filter bar, ignoring student filters except `Active`:

- "Gender recorded for **N / Total** active students" with a thin progress bar.
- Subtext: "M: x · F: y · X: z · Unknown: u". Treats gender as "recorded" if the field is a non-empty string other than literal "unknown".

### KPI card row

Eight `StatCard`s, all driven by the active filters (and current Window when set, otherwise "any window"):

1. **Total active students** — count of `filteredStudents`.
2. **Students with benchmark data** — distinct studentIds in `filteredBenchmarks`.
3. **Students missing data** — `filteredStudents` − assessed.
4. **% At/Above Benchmark** — across students whose latest scoped benchmark classifies as `at-or-above` or `well-above`.
5. **% Near Benchmark** — `approaching`.
6. **% Below / Well Below** — `below` + `well-below` (red emphasis).
7. **High-need students** — `student.isHighNeed === true` within `filteredStudents`.
8. **High-need w/o support plan** — high-need students with no `SupportPlan` doc. (See §5 for data source.)

Plus a 9th compact card: **Multiple risk indicators** — students with `multipleBelowMeasures(...) ≥ 2`.

### Heatmaps

Built with a custom CSS-grid heatmap (no extra deps) — cell color interpolates a `hsl` red ramp on `% below + well-below`; cell shows percentage and `n=` count; tooltip via title attribute.

1. **Grade × Measure heatmap** — rows = grades present, columns = `STANDARD_MEASURES` present.
2. **Homeroom × Measure heatmap** — rows = homerooms present (sorted), columns = `STANDARD_MEASURES` present. Vertically scrollable beyond ~12 rows.

Both respect the active Window filter (default "all" uses each student's most recent benchmark per measure).

Cells with `n < 3` are rendered muted gray with the text "—" to avoid privacy/false-signal issues.

### Leadership action lists

A 3-column responsive grid of compact list cards. Each card shows up to 10 students with a "View all (N)" expander:

1. **Well Below Benchmark** (latest scoped Composite or fallback) — sorted by latest date desc.
2. **Below Benchmark** — same.
3. **No data this window** — when Window filter is set: students with no benchmark in that window. When not set: students with zero benchmarks at all.
4. **Multiple below-benchmark measures** — `multipleBelowMeasures ≥ 2`, sorted by count desc.
5. **High need but no support plan**.
6. **High need but no recent evidence/markbook entry** — no markbook entry in last 30 days.

Each row uses `formatStudentDisplay(student)` plus a small risk badge and a measure/score chip when relevant. Clicking a row opens the existing student deep dive (we'll forward via a callback prop the parent can wire to `setSelectedStudent` if available; otherwise the row is a non-interactive summary in this first pass — see §6).

### Data Meeting View

Collapsible card titled "Data Meeting View". Inputs (independent of the top filter bar so a meeting can be focused without disrupting the dashboard):

- Grade select
- Homeroom select
- Measure select (defaults to Composite)
- Window select (defaults to most recent window present)

Output:

- Header line: "Showing N students needing support in {homeroom or grade} · {measure} · {window}".
- Table with columns: Student (privacy-friendly via `formatStudentDisplay`), Grade, Homeroom, Status (risk badge), Latest Score, Date.
- "Suggested groupings" — students grouped by status band (Well Below / Below / Near), each group shown as a chip stack of student labels; intent is to seed small-group instruction planning.
- **Export button** — downloads `data-meeting_{measure}_{window}_{date}.csv` with columns: `studentNumber, initials, homeroom, grade, measure, window, score, scoreLabel, statusBand, date`. This is the one place full `studentNumber` is exposed (admin-only context).

---

## 3. Risk classification rules (no change in behavior, just enforced consistently)

- All status decisions go through `classifyScoreLabel` / `getStudentRiskLevel`.
- "Has data" is never used as a proxy for "doing well": the missing-data and below-benchmark KPIs are computed independently, and KPI percentages always use `assessedCount` as the denominator (not total roster) so K-2-only data is not diluted.

---

## 4. Privacy / labeling rules

- Every student row in dashboard cards/lists/tables uses `formatStudentDisplay(student)` → `J.P.E. · 2A · #591`.
- Full `studentNumber` appears only in:
  - The Data Meeting CSV export (admin-initiated download).
  - Existing import/debug surfaces (unchanged).
- Heatmaps never display individual students.

---

## 5. Support plans data source

We don't currently fetch SupportPlans in `AdminTab`. Add a lightweight one-off fetch inside `LeadershipDashboard`:

- `useEffect` reads `collection('supportPlans')` filtered by `schoolId` (if rules require it; otherwise top-level) using `getDocs`, stored as `Set<studentId>` of students who have at least one plan.
- Used only for the "High need w/o support plan" KPI and list. If the collection doesn't exist yet or returns an error, the card shows "—" and the list collapses with a "Support plans not available" hint (no console noise beyond a single warn). No new hook file is required for this read-only one-shot.

If the codebase already has a `useSupportPlans` hook, we'll use that instead — to be confirmed when implementing.

---

## 6. Wiring to AdminTab

`src/components/tabs/AdminTab.tsx`:

- Import and render `<LeadershipDashboard />` as the first child of the returned fragment.
- Move the existing top-of-tab filter bar (Grade/Homeroom/Measure/Window) and Risk Distribution chart into the new dashboard so there is one canonical filter bar (the existing chart becomes part of the dashboard's heatmap/KPI section). The Diagnostic Card and Class Deep Dive are kept under the new dashboard.
- The student deep dive click-through is best-effort: if `AdminTab` already manages a `selectedStudent` state for the Class Deep Dive, we reuse it; otherwise list rows are non-interactive in this pass and a follow-up can wire navigation.

---

## 7. Files

**New**
- `src/lib/leadershipMetrics.ts`
- `src/lib/leadershipExport.ts`
- `src/components/admin/LeadershipDashboard.tsx`
- `src/components/admin/Heatmap.tsx` — small reusable grid heatmap (rows × cols, value → color, value formatter, low-n masking).

**Edited**
- `src/components/tabs/AdminTab.tsx` — mount the dashboard, deduplicate the old filter bar / risk chart.

No backend changes; no Firestore schema changes. Existing data already carries `scoreLabel`, `benchmarkWindow`, `assessmentType`, `gender`, `isHighNeed`, etc.

---

## 8. Out of scope (intentionally)

- Backfilling gender for students whose roster import predates Gender-column support.
- Editing support plans from the dashboard (cards are read-only).
- Multi-school comparison — this is single-school only, scoped by `schoolId`.
