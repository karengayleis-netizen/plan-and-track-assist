## What you're seeing and why

The Acadience import succeeded (971 benchmarks saved), but the dashboards were never wired to read Acadience-style data. Three independent gaps:

**1. Class Growth Trend is blank**
The chart averages `benchmark.percentage`. The Acadience importer writes `percentage: 0` for every row because Acadience CSVs don't have a percent column — the score field holds the raw score (45, 77, 103…). With percentage=0 on all 971 rows, the trend line is flat at 0. Compounded by a hard `Y: [0, 100]` axis that clips real raw scores like 103.

**2. Admin says "all students doing well"**
"At Risk" only counts students with the manual `isHighNeed` flag set in the roster. It never looks at benchmark scores or Acadience status labels (`well below benchmark`, `below benchmark`, `at/above benchmark`, `well above`). With 0 students manually flagged, the number is 0 regardless of imported data.

Also: `Avg Data/Student = totalBenchmarks ÷ totalStudents` divides by the whole roster (K–8). Since Acadience is K–2 only, the average is artificially low.

**3. Cannot deep-dive K–2 students**
The students appear in the dropdown, but the chart is empty because:
- It plots `percentage ?? parseFloat(score)` → for Acadience the fallback to `score` does work, but
- Y-axis is locked `[0, 100]` so any composite score above 100 is clipped, and
- Each Acadience subtest (NWF-CLS, NWF-WWR, Composite, etc.) has a totally different scale, so plotting them on one axis is meaningless without filtering by measure.

There's also no class/homeroom filter on Insights — admins only ever see the whole school.

## Plan

### Fix 1 — Derive risk from Acadience status (Admin + Insights)

Add a helper `getStudentRiskLevel(student, benchmarks)` in `src/lib/studentRisk.ts` that returns `'well-below' | 'below' | 'at-or-above' | 'well-above' | 'unknown'` based on the student's most recent Acadience `scoreLabel` (Composite preferred, else latest). Treat manual `isHighNeed` as an override that forces "well-below".

Update Admin tab "At Risk (Data/Flag)" to count `well-below + below + isHighNeed`. Add a sibling KPI "Students Assessed" = students with ≥1 benchmark, and change "Avg Data/Student" denominator to **assessed students only** (so K–2 averages aren't diluted by 3–8).

Add a new Admin section **"Acadience Risk Distribution"** showing a stacked bar: Well Below / Below / At or Above / Well Above, with counts per grade (K, 1, 2). This is the missing "School Risk Profile" placeholder.

### Fix 2 — Make Class Growth Trend work with Acadience

Replace the percentage-based aggregation with a **measure-aware trend**:
- Add a measure dropdown above the chart (Composite / NWF-CLS / NWF-WWR / LNF / PSF / etc., populated from imported assessmentTypes).
- Plot average `parseFloat(score)` (raw) for the selected measure over time (by benchmark window: BOY / MOY / EOY, fallback to month).
- Auto-scale Y-axis (`domain={['auto', 'auto']}`) so raw scores like 103 aren't clipped.
- Add an optional **Homeroom filter** (dropdown of the user's homerooms or "All") so admins can drill down.

When no measure is selected, default to "Composite" if present, otherwise the most common measure.

### Fix 3 — Student Deep Dive for Acadience

In the Deep Dive chart:
- The existing assessment-type filter already exists — make it the primary filter (default to "Composite" when Acadience data is present).
- Auto-scale Y-axis instead of `[0, 100]`.
- Show `scoreLabel` (status badge) next to each tooltip point.
- Sort dropdown by homeroom then initials so K–2 students cluster together and are findable.

### Fix 4 — Insights filters for admins

Add a small filter bar at the top of the Insights tab:
- **Grade** (All, K, 1, 2, 3…)
- **Homeroom** (All, then the school's homerooms)

Apply both filters to all charts (KPIs, Class Growth, Performance Distribution, Deep Dive list). For an admin, "All" is the default; for teachers, default to their assigned homerooms (existing behavior).

### Files to change

- `src/lib/studentRisk.ts` — new helper
- `src/components/tabs/AdminTab.tsx` — risk KPI logic, new Acadience risk distribution chart, fix Avg Data/Student denominator
- `src/components/tabs/InsightsTab.tsx` — measure-aware Class Growth Trend, grade+homeroom filter bar, auto-scale Y axes, default Composite, sorted student dropdown
- `src/components/dashboard/InsightChart.tsx` — no change expected

### Out of scope (will not touch)

- CSV import / mapping (it's working — 971 rows saved)
- Student matching (the 9 unmatched rows for student 1093503 require adding that student to the roster)
- Firestore rules
- The student display format (`J.P.E. · 4F · #591`) is already in place

### Acceptance

- Admin tab shows non-zero "At Risk" reflecting Acadience well-below + below counts.
- Avg Data/Student calculated against assessed students (K–2), giving a realistic number.
- New Acadience Risk Distribution chart shows stacked bars by grade.
- Insights "Class Growth Trend" renders an actual line for the selected measure (default Composite), with a working homeroom filter.
- Selecting any K–2 student in Deep Dive renders their score history with auto-scaled Y axis and the assessment filter pre-set to Composite.