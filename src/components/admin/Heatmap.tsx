import { cn } from '@/lib/utils';

export interface HeatmapCell {
  /** Primary value 0-100, or null for n/a. Meaning depends on `mode`. */
  value: number | null;
  /** Sample size used for the cell. */
  count: number;
  /** Optional band breakdown for `mixed` mode and richer tooltips. */
  bands?: { below: number; near: number; atOrAbove: number };
  /** Extra tooltip text. */
  label?: string;
}

export type HeatmapMode = 'risk' | 'success' | 'mixed';
export type HeatmapRamp = 'red' | 'green';

interface HeatmapProps {
  rows: string[];
  cols: string[];
  data: HeatmapCell[][]; // [rowIdx][colIdx]
  rowHeader?: string;
  /** Cells with count below this render muted (privacy/low-n). Default 3. */
  minN?: number;
  /** Max value used for color scaling. Default 100. */
  maxValue?: number;
  /** What the cell value represents. */
  mode?: HeatmapMode;
  /** Color ramp for single-value modes. Default infers from mode. */
  colorRamp?: HeatmapRamp;
  /** Optional tooltip text per column header (e.g. acronym expansion). */
  colTooltips?: Record<string, string>;
}

/**
 * Heatmap with selectable view mode.
 * - `risk`    → red ramp on % below + well-below (higher = worse)
 * - `success` → green ramp on % at/above + well-above (higher = better)
 * - `mixed`   → 3-segment stacked bar (Below / Near / On Track)
 */
export function Heatmap({
  rows,
  cols,
  data,
  rowHeader = '',
  minN = 3,
  maxValue = 100,
  mode = 'risk',
  colorRamp,
  colTooltips,
}: HeatmapProps) {
  if (rows.length === 0 || cols.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No data to display.</p>;
  }

  const ramp: HeatmapRamp = colorRamp ?? (mode === 'success' ? 'green' : 'red');
  const rampVar = ramp === 'green' ? '--chart-2' : '--destructive';
  const rampFgVar = ramp === 'green' ? '--chart-2' : '--destructive-foreground';

  return (
    <div className="overflow-auto">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card z-10 text-left px-2 py-1.5 font-medium text-muted-foreground border-b border-border">
              {rowHeader}
            </th>
            {cols.map(c => (
              <th
                key={c}
                className="px-2 py-1.5 font-medium text-muted-foreground border-b border-border whitespace-nowrap cursor-help"
                title={colTooltips?.[c] ?? c}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}>
              <td className="sticky left-0 bg-card z-10 px-2 py-1 font-medium text-foreground border-b border-border whitespace-nowrap">
                {r}
              </td>
              {cols.map((c, j) => {
                const cell = data[i]?.[j];
                if (!cell || cell.count === 0) {
                  return (
                    <td key={c} className="border-b border-border p-0.5">
                      <div className="h-9 w-16 rounded bg-muted/30 text-muted-foreground/50 flex items-center justify-center">·</div>
                    </td>
                  );
                }
                if (cell.count < minN) {
                  return (
                    <td key={c} className="border-b border-border p-0.5" title={`n=${cell.count} (suppressed for low sample)`}>
                      <div className="h-9 w-16 rounded bg-muted/40 text-muted-foreground flex items-center justify-center">—</div>
                    </td>
                  );
                }

                // Mixed mode: stacked 3-segment bar
                if (mode === 'mixed' && cell.bands) {
                  const { below, near, atOrAbove } = cell.bands;
                  const total = below + near + atOrAbove;
                  const pBelow = total ? Math.round((below / total) * 100) : 0;
                  const pNear = total ? Math.round((near / total) * 100) : 0;
                  const pAbove = total ? 100 - pBelow - pNear : 0;
                  const tip = `${r} · ${c}: ${pAbove}% on track · ${pNear}% near · ${pBelow}% below (n=${cell.count})`;
                  return (
                    <td key={c} className="border-b border-border p-0.5">
                      <div
                        className="h-9 w-16 rounded overflow-hidden flex flex-col justify-between bg-muted/30 p-0.5"
                        title={tip}
                      >
                        <div className="flex h-3 rounded-sm overflow-hidden">
                          <div style={{ width: `${pAbove}%`, background: 'hsl(var(--chart-2, 142 71% 45%))' }} />
                          <div style={{ width: `${pNear}%`, background: 'hsl(var(--chart-3, 48 96% 53%))' }} />
                          <div style={{ width: `${pBelow}%`, background: 'hsl(var(--destructive))' }} />
                        </div>
                        <div className="flex justify-between text-[8px] leading-none px-0.5 text-muted-foreground">
                          <span style={{ color: 'hsl(var(--chart-2, 142 71% 45%))' }}>{pAbove}</span>
                          <span>n={cell.count}</span>
                          <span className="text-destructive">{pBelow}</span>
                        </div>
                      </div>
                    </td>
                  );
                }

                const baseV = cell.value ?? 0;
                const v = mode === 'success' && cell.bands
                  ? Math.round((cell.bands.atOrAbove / cell.count) * 100)
                  : baseV;
                const intensity = Math.min(1, Math.max(0, v / maxValue));
                const bg = `hsl(var(${rampVar}) / ${(0.08 + intensity * 0.85).toFixed(2)})`;
                const fg = intensity > 0.45 ? `hsl(var(${rampFgVar}))` : 'hsl(var(--foreground))';
                const meaning = mode === 'success' ? 'on track' : 'below/well-below';
                const extraTip = cell.bands
                  ? ` · ${Math.round((cell.bands.atOrAbove / cell.count) * 100)}% on track · ${Math.round((cell.bands.near / cell.count) * 100)}% near · ${Math.round((cell.bands.below / cell.count) * 100)}% below`
                  : '';
                return (
                  <td key={c} className="border-b border-border p-0.5">
                    <div
                      className={cn('h-9 w-16 rounded flex flex-col items-center justify-center font-medium')}
                      style={{ backgroundColor: bg, color: fg }}
                      title={`${r} · ${c}: ${v}% ${meaning} (n=${cell.count})${extraTip}${cell.label ? ` · ${cell.label}` : ''}`}
                    >
                      <span className="leading-none text-[11px]">{v}%</span>
                      <span className="leading-none text-[9px] opacity-80">n={cell.count}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
