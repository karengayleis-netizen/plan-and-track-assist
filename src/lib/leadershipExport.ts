type Row = Record<string, string | number | null | undefined>;

function escapeCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(rows: Row[]): string {
  if (rows.length === 0) return '';
  const headers = Array.from(
    rows.reduce((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set; }, new Set<string>())
  );
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => escapeCell(r[h])).join(','));
  return lines.join('\n');
}

export function downloadCSV(filename: string, rows: Row[]): void {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
