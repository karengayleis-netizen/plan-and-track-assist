import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ServerCog, Download } from 'lucide-react';
import { toast } from 'sonner';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { parseBackfillFile } from '@/lib/backfillParser';

type BackfillAction =
  | 'updated'
  | 'alreadyCorrect'
  | 'noMatch'
  | 'ambiguous'
  | 'errored'
  | 'repairedSchoolIdAndUpdated'
  | 'skippedInvalidInput';

interface BackfillRowResult {
  rowIndex: number;
  studentId?: string;
  studentNumber?: string;
  initials?: string;
  homeroom?: string;
  before?: string;
  after: string;
  action: BackfillAction;
  reason?: string;
}

interface BackfillResponse {
  callerSchoolId: string;
  totals: Record<BackfillAction, number>;
  results: BackfillRowResult[];
}

const ACTION_LABEL: Record<BackfillAction, string> = {
  updated: 'Updated',
  alreadyCorrect: 'Already correct',
  noMatch: 'No match',
  ambiguous: 'Ambiguous',
  errored: 'Errored',
  repairedSchoolIdAndUpdated: 'Repaired schoolId + updated',
  skippedInvalidInput: 'Skipped (invalid input)',
};

const ACTION_VARIANT: Record<BackfillAction, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  updated: 'default',
  alreadyCorrect: 'secondary',
  noMatch: 'outline',
  ambiguous: 'outline',
  errored: 'destructive',
  repairedSchoolIdAndUpdated: 'default',
  skippedInvalidInput: 'outline',
};

export function ServerBackfillPanel({ onAfterRun }: { onAfterRun?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<BackfillResponse | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResponse(null);
    try {
      const parsed = await parseBackfillFile(file, null);
      const rows = parsed.rows.map((r) => {
        // Section + ordinal derive coded ID; we send both and let the function try coded-id first
        let section: string | undefined;
        let ordinal: string | undefined;
        if (r.derivedCodedId && r.derivedCodedId.includes('-')) {
          const idx = r.derivedCodedId.lastIndexOf('-');
          section = r.derivedCodedId.slice(0, idx);
          ordinal = r.derivedCodedId.slice(idx + 1);
        } else if (r.rosterNumber) {
          section = r.homeroom;
          ordinal = r.rosterNumber;
        }
        return {
          section,
          ordinal,
          initials: r.initials,
          homeroom: r.homeroom,
          boardNumber: r.externalNumber,
          rowIndex: r.rowIndex,
        };
      }).filter(r => r.boardNumber);

      if (rows.length === 0) {
        toast.error('No usable rows found in file');
        setBusy(false);
        return;
      }

      const callable = httpsCallable<{ rows: typeof rows }, BackfillResponse>(
        functions,
        'backfillExternalStudentNumbers',
      );
      const res = await callable({ rows });
      setResponse(res.data);
      const t = res.data.totals;
      const wrote = t.updated + t.repairedSchoolIdAndUpdated;
      toast.success(`Backfill complete — ${wrote} written, ${t.alreadyCorrect} already correct, ${t.noMatch} unmatched`);
      onAfterRun?.();
    } catch (err: any) {
      console.error('[ServerBackfillPanel] failed', err);
      toast.error(err?.message || 'Backfill failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const downloadReport = () => {
    if (!response) return;
    const header = ['rowIndex', 'action', 'studentId', 'studentNumber', 'initials', 'homeroom', 'before', 'after', 'reason'];
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [header.join(',')];
    for (const r of response.results) {
      lines.push([
        r.rowIndex, r.action, r.studentId ?? '', r.studentNumber ?? '',
        r.initials ?? '', r.homeroom ?? '', r.before ?? '', r.after, r.reason ?? '',
      ].map(escape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backfill_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = response?.totals;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ServerCog className="h-5 w-5" />
          Server-side board number backfill
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload your roster CSV (initials + board number + section + student #).
          Runs server-side as admin — bypasses Firestore rules so writes that previously
          failed silently will succeed. Also repairs students with a missing schoolId.
        </p>

        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running…</>
            ) : (
              'Upload roster CSV and run backfill'
            )}
          </Button>
          {response && (
            <Button variant="outline" onClick={downloadReport}>
              <Download className="mr-2 h-4 w-4" /> Download report CSV
            </Button>
          )}
        </div>

        {totals && (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(totals) as BackfillAction[]).map((k) => (
              totals[k] > 0 && (
                <Badge key={k} variant={ACTION_VARIANT[k]}>
                  {ACTION_LABEL[k]}: {totals[k]}
                </Badge>
              )
            ))}
          </div>
        )}

        {response && response.results.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Show first 25 row results
            </summary>
            <div className="mt-2 max-h-64 overflow-auto rounded border">
              <table className="w-full text-left">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2">Row</th>
                    <th className="p-2">Action</th>
                    <th className="p-2">Student #</th>
                    <th className="p-2">Initials</th>
                    <th className="p-2">Homeroom</th>
                    <th className="p-2">Before → After</th>
                    <th className="p-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {response.results.slice(0, 25).map((r) => (
                    <tr key={r.rowIndex} className="border-t">
                      <td className="p-2">{r.rowIndex}</td>
                      <td className="p-2">{ACTION_LABEL[r.action]}</td>
                      <td className="p-2">{r.studentNumber || '—'}</td>
                      <td className="p-2">{r.initials || '—'}</td>
                      <td className="p-2">{r.homeroom || '—'}</td>
                      <td className="p-2">{(r.before || '∅')} → {r.after || '∅'}</td>
                      <td className="p-2 text-muted-foreground">{r.reason || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
