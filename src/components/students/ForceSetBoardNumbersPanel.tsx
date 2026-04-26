import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Wrench, Download } from 'lucide-react';
import { toast } from 'sonner';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

type ForceSetAction =
  | 'verified'
  | 'verifyMismatch'
  | 'alreadyCorrect'
  | 'notFound'
  | 'wrongSchool'
  | 'errored'
  | 'skippedInvalidInput';

interface ForceSetRowResult {
  docId: string;
  action: ForceSetAction;
  before?: string;
  after: string;
  actualAfterRead?: string;
  schoolId?: string;
  reason?: string;
}

interface ForceSetResponse {
  callerSchoolId: string;
  totals: Record<ForceSetAction, number>;
  results: ForceSetRowResult[];
}

const ACTION_LABEL: Record<ForceSetAction, string> = {
  verified: 'Verified',
  verifyMismatch: 'Verify mismatch',
  alreadyCorrect: 'Already correct',
  notFound: 'Not found',
  wrongSchool: 'Wrong school',
  errored: 'Errored',
  skippedInvalidInput: 'Skipped (invalid)',
};

const ACTION_VARIANT: Record<ForceSetAction, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  verified: 'default',
  verifyMismatch: 'destructive',
  alreadyCorrect: 'secondary',
  notFound: 'outline',
  wrongSchool: 'destructive',
  errored: 'destructive',
  skippedInvalidInput: 'outline',
};

const KNOWN_MISMATCHES = `zczv996viRquAHpxxyvc,1057559
b7mKc4bGpP5uU0RWFbq0,1058132
CdlP82WK0Y5PWzODIsbU,1051601
SejuBADMIeMew6syECrv,1047318`;

function parseEntries(text: string): { docId: string; externalStudentNumber: string }[] {
  const out: { docId: string; externalStudentNumber: string }[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Skip header
    if (/docid/i.test(line) && /external|board|number/i.test(line)) continue;
    const parts = line.split(/[,\t]/).map(p => p.trim());
    if (parts.length < 2) continue;
    const [docId, externalStudentNumber] = parts;
    if (!docId || !externalStudentNumber) continue;
    out.push({ docId, externalStudentNumber });
  }
  return out;
}

export function ForceSetBoardNumbersPanel({ onAfterRun }: { onAfterRun?: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<ForceSetResponse | null>(null);

  const run = async () => {
    const entries = parseEntries(text);
    if (entries.length === 0) {
      toast.error('No valid entries. Use one "docId,externalStudentNumber" per line.');
      return;
    }
    setBusy(true);
    setResponse(null);
    try {
      const callable = httpsCallable<{ entries: typeof entries }, ForceSetResponse>(
        functions,
        'forceSetExternalStudentNumbers',
      );
      const res = await callable({ entries });
      setResponse(res.data);
      const t = res.data.totals;
      toast.success(
        `Force-set complete — ${t.verified} verified, ${t.alreadyCorrect} already correct, ${t.verifyMismatch + t.errored + t.notFound + t.wrongSchool} problems`,
      );
      onAfterRun?.();
    } catch (err: any) {
      console.error('[ForceSetBoardNumbersPanel] failed', err);
      toast.error(err?.message || 'Force-set failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = () => {
    if (!response) return;
    const header = ['docId', 'action', 'before', 'after', 'actualAfterRead', 'schoolId', 'reason'];
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [header.join(',')];
    for (const r of response.results) {
      lines.push([
        r.docId, r.action, r.before ?? '', r.after, r.actualAfterRead ?? '',
        r.schoolId ?? '', r.reason ?? '',
      ].map(escape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `force_set_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = response?.totals;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Force-set board numbers by document ID
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Bypasses all matching logic. Writes <code className="bg-muted px-1 rounded">externalStudentNumber</code> directly
          to the specified student docs and re-reads to verify the value stuck.
          Use when the regular backfill resolved a CSV row to the wrong student.
          Format: one <code className="bg-muted px-1 rounded">docId,externalStudentNumber</code> per line.
        </p>

        <Textarea
          rows={6}
          placeholder={'docId,externalStudentNumber\nabc123xyz,1057559\n...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-xs"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={run} disabled={busy}>
            {busy ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running…</>
            ) : (
              'Run force-set'
            )}
          </Button>
          <Button variant="outline" onClick={() => setText(KNOWN_MISMATCHES)} disabled={busy}>
            Load known mismatches (4)
          </Button>
          <Button variant="ghost" onClick={() => { setText(''); setResponse(null); }} disabled={busy}>
            Clear
          </Button>
          {response && (
            <Button variant="outline" onClick={downloadReport}>
              <Download className="mr-2 h-4 w-4" /> Download report CSV
            </Button>
          )}
        </div>

        {totals && (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(totals) as ForceSetAction[]).map((k) => (
              totals[k] > 0 && (
                <Badge key={k} variant={ACTION_VARIANT[k]}>
                  {ACTION_LABEL[k]}: {totals[k]}
                </Badge>
              )
            ))}
          </div>
        )}

        {response && response.results.length > 0 && (
          <div className="max-h-80 overflow-auto rounded border text-xs">
            <table className="w-full text-left">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-2">Doc ID</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">Before → After</th>
                  <th className="p-2">Verified read</th>
                  <th className="p-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {response.results.map((r) => (
                  <tr key={r.docId + r.action} className="border-t">
                    <td className="p-2 font-mono">{r.docId}</td>
                    <td className="p-2">
                      <Badge variant={ACTION_VARIANT[r.action]}>{ACTION_LABEL[r.action]}</Badge>
                    </td>
                    <td className="p-2">{(r.before || '∅')} → {r.after || '∅'}</td>
                    <td className="p-2">{r.actualAfterRead ?? '—'}</td>
                    <td className="p-2 text-muted-foreground">{r.reason || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
