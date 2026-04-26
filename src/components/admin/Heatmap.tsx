import { cn } from '@/lib/utils';

export interface HeatmapCell {
  value: number | null; // 0-100, or null for n/a
  count: number;        // sample size
  label?: string;       // tooltip extra
}

interface HeatmapProps {
  rows: string[];
  cols: string[];
  data: HeatmapCell[][]; // [rowIdx][colIdx]
  rowHeader?: string;
  /** Cells with count below this render muted (privacy/low-n). Default 3. */
  minN?: number;
  /** Max value used for color scaling. Default 100. */
  maxValue?: number;
}

/**
 * Red-ramp heatmap. Higher value = more saturated destructive.
 * Used for "% below/well-below" — higher = worse.
 */
export function Heatmap({ rows, cols, data, rowHeader = '', minN = 3, maxValue = 100 }: HeatmapProps) {
  if (rows.length === 0 || cols.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No data to display.</p>;
  }
  return (
    <div className="overflow-auto">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card z-10 text-left px-2 py-1.5 font-medium text-muted-foreground border-b border-border">
              {rowHeader}
            </th>
            {cols.map(c => (
              <th key={c} className="px-2 py-1.5 font-medium text-muted-foreground border-b border-border whitespace-nowrap">
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
                  return <td key={c} className="border-b border-border p-0.5"><div className="h-9 w-16 rounded bg-muted/30 text-muted-foreground/50 flex items-center justify-center">·</div></td>;
                }
                if (cell.count < minN) {
                  return (
                    <td key={c} className="border-b border-border p-0.5" title={`n=${cell.count} (suppressed for low sample)`}>
                      <div className="h-9 w-16 rounded bg-muted/40 text-muted-foreground flex items-center justify-center">—</div>
                    </td>
                  );
                }
                const v = cell.value ?? 0;
                const intensity = Math.min(1, Math.max(0, v / maxValue));
                // HSL ramp from neutral muted -> destructive red.
                const bg = `hsl(var(--destructive) / ${(0.08 + intensity * 0.85).toFixed(2)})`;
                const fg = intensity > 0.45 ? 'hsl(var(--destructive-foreground))' : 'hsl(var(--foreground))';
                return (
                  <td key={c} className="border-b border-border p-0.5">
                    <div
                      className={cn('h-9 w-16 rounded flex flex-col items-center justify-center font-medium')}
                      style={{ backgroundColor: bg, color: fg }}
                      title={`${r} · ${c}: ${v}% below/well-below (n=${cell.count})${cell.label ? ` · ${cell.label}` : ''}`}
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
