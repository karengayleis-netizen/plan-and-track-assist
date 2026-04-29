## Goals

1. Demystify the Acadience measure acronyms (FSF, LNF, PSF, NWF-CLS, NWF-WWR, ORF, Composite) right where they appear.
2. Let the user flip the Grade and Homeroom heatmaps between risk views without overcrowding the grid.

Both changes are presentation-only. No data model or hook changes.

---

## 1. Measure acronym legend

Add a small, dismissible legend section directly above the two measure heatmaps in `LeadershipDashboard.tsx`.

Content (Acadience Reading, K–6):

- **FSF** — First Sound Fluency (K, BOY/MOY)
- **LNF** — Letter Naming Fluency (K–1, indicator)
- **PSF** — Phoneme Segmentation Fluency (K MOY → 1 MOY)
- **NWF-CLS** — Nonsense Word Fluency · Correct Letter Sounds (K EOY → 2)
- **NWF-WWR** — Nonsense Word Fluency · Whole Words Read (1–2)
- **ORF** — Oral Reading Fluency · words correct per minute (1 MOY → 6)
- **Composite** — Acadience Composite Score · overall risk indicator combining sub-measures for the grade/window

Display options considered:

- **Chosen:** A single `Card` with a compact two-column grid of acronym → expansion. Always visible, sits just above the "Grade × Measure" heatmap. Low cognitive load, no clicks needed for a glance.
- Also wire the same labels into the heatmap column headers as a native `title` tooltip (browser hover) so they're discoverable in-context too. Cheap, no new component.

Optional small touch: a `(?)` icon next to each measure in the **Measure** filter `SelectItem` is messy in shadcn `Select`, so we'll skip it and rely on the legend + column tooltips.

---

## 2. Heatmap view mode

Today both heatmaps show "% below + well-below" only. Add a single segmented control above the **two heatmaps** (shared, so both stay in sync) with three options:

- **At Risk** (default) — % Below + Well Below · red ramp (current behaviour)
- **On Track** — % At/Above + Well Above · green ramp
- **Mixed** — three thin stacked bars per cell showing Below / Near / On Track percentages

Implementation:

- Extend `Heatmap.tsx` with a `mode: 'risk' | 'success' | 'mixed'` prop (default `'risk'`) and a `colorRamp: 'red' | 'green'` prop. The `'mixed'` mode renders a stacked mini-bar instead of a single coloured cell, using the existing risk colour tokens (`destructive`, `chart-3` yellow, `chart-2` green). Cell tooltip lists all three percentages plus `n`.
- Update `buildHeatmap` in `LeadershipDashboard.tsx` to return per-cell band counts (`below`, `near`, `atOrAbove`, `total`) instead of just a single `value`. The `HeatmapCell` interface gains optional `bands?: { below: number; near: number; atOrAbove: number }`. The single-mode renderers compute the displayed % from these on the fly, so we only walk the data once per filter change.
- Privacy: keep `n < 3` suppression rule unchanged across all modes.

User experience: the segmented control sits to the right of the "Grade × Measure" / "Homeroom × Measure" section header, so it's obvious it controls both grids. View mode is local UI state — not persisted.

---

## Files to touch

- `src/components/admin/LeadershipDashboard.tsx`
  - Add `MEASURE_GLOSSARY` constant and a legend `Card` above the heatmaps.
  - Add `heatmapMode` state + `ToggleGroup` segmented control.
  - Update `buildHeatmap` to return band counts.
  - Add `title` tooltips on heatmap column headers via the legend map.
- `src/components/admin/Heatmap.tsx`
  - New `mode` and `colorRamp` props.
  - New "mixed" render path (3-segment stacked bar).
  - Tooltip text adjusted per mode.

No changes to `leadershipMetrics.ts`, hooks, types, or Firestore.

---

## Out of scope (per user "open to feedback")

- No new filter chip or persisted preference for the view mode — keeping it ephemeral keeps the UI simple. Easy to add later if leaders ask.
- Not splitting into separate tabs; the segmented control achieves the same outcome with less navigation.
