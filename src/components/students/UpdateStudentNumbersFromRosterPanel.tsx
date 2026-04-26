import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Database, Eye, Save, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { parseBackfillFile } from '@/lib/backfillParser';

type UpdateAction = 'update' | 'create' | 'ambiguous' | 'skipped' | 'alreadyMigrated' | 'errored';

interface RowResult {
  rowIndex: number;
  action: UpdateAction;
  docId?: string;
  candidateIds?: string[];
  before?: { studentNumber?: string; externalStudentNumber?: string; stableStudentId?: string; displayCode?: string };
  after?: { studentNumber?: string; externalStudentNumber?: string; stableStudentId?: string; displayCode?: string };
  verified?: boolean;
  reason?: string;
  csvBoardNumber: string;
  csvInitials: string;
  csvHomeroom: string;
}

interface ServerResponse {
  callerSchoolId: string;
  dryRun: boolean;
  totals: {
    update: number; create: number; ambiguous: number; skipped: number;
    alreadyMigrated: number; errored: number; verified: number; verifyFailed: number;
  };
  results: RowResult[];
}

interface InputRow {
  boardStudentNumber: string;
  initials: string;
  homeroom: string;
  grade?: string;
  rowIndex: number;
}

const ACTION_LABEL: Record<UpdateAction, string> = {
  update: 'Update',
  create: 'Create',
  ambiguous: 'Ambiguous',
  skipped: 'Skipped',
  alreadyMigrated: 'Already migrated',
  errored: 'Errored',
};

const ACTION_VARIANT: Record<UpdateAction, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  update: 'default',
  create: 'default',
  ambiguous: 'outline',
  skipped: 'secondary',
  alreadyMigrated: 'secondary',
  errored: 'destructive',
};

export function UpdateStudentNumbersFromRosterPanel({ onAfterRun }: { onAfterRun?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [parsedRows, setParsedRows] = useState<InputRow[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [createMissing, setCreateMissing] = useState(false);
  const [preview, setPreview] = useState<ServerResponse | null>(null);
  const [committed, setCommitted] = useState<ServerResponse | null>(null);

  const reset = () => {
    setParsedRows(null);
    setFileName('');
    setPreview(null);
    setCommitted(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setPreview(null);
    setCommitted(null);
    try {
      const parsed = await parseBackfillFile(file);
      const rows: InputRow[] = parsed.rows
        .map((r) => ({
          boardStudentNumber: r.externalNumber,
          initials: r.initials,
          homeroom: r.homeroom,
          grade: r.grade,
          rowIndex: r.rowIndex,
        }))
        .filter((r) => r.boardStudentNumber && r.initials && r.homeroom);

      if (rows.length === 0) {
        toast.error('No usable rows found. Need columns: Student Number, Initials, Homeroom/Section.');
        setBusy(false);
        return;
      }
      setParsedRows(rows);
      setFileName(file.name);
      toast.success(`Parsed ${rows.length} rows from ${file.name}`);
    } catch (err: any) {
      console.error('[UpdateStudentNumbersFromRosterPanel] parse failed', err);
      toast.error(err?.message || 'Failed to parse file');
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async () => {
    if (!parsedRows) return;
    setBusy(true);
    try {
      const callable = httpsCallable<{ rows: InputRow[]; dryRun: boolean; createMissing: boolean }, ServerResponse>(
        functions,
        'updateStudentNumbersFromRoster',
      );
      const res = await callable({ rows: parsedRows, dryRun: true, createMissing });
      setPreview(res.data);
      setCommitted(null);
      toast.success('Preview ready — review then confirm.');
    } catch (err: any) {
      console.error('[UpdateStudentNumbersFromRosterPanel] preview failed', err);
      toast.error(err?.message || 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    if (!parsedRows) return;
    setBusy(true);
    try {
      const callable = httpsCallable<{ rows: InputRow[]; dryRun: boolean; createMissing: boolean }, ServerResponse>(
        functions,
        'updateStudentNumbersFromRoster',
      );
      const res = await callable({ rows: parsedRows, dryRun: false, createMissing });
      setCommitted(res.data);
      const t = res.data.totals;
      toast.success(
        `Committed — ${t.update} updated, ${t.create} created, ${t.verified} verified` +
        (t.verifyFailed ? `, ${t.verifyFailed} failed verify` : '')
      );
      onAfterRun?.();
    } catch (err: any) {
      console.error('[UpdateStudentNumbersFromRosterPanel] commit failed', err);
      toast.error(err?.message || 'Commit failed');
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = (resp: ServerResponse) => {
    const header = [
      'rowIndex', 'action', 'docId', 'csvBoardNumber', 'csvInitials', 'csvHomeroom',
      'before.studentNumber', 'before.externalStudentNumber', 'before.stableStudentId', 'before.displayCode',
      'after.studentNumber', 'after.externalStudentNumber', 'after.stableStudentId', 'after.displayCode',
      'verified', 'candidateIds', 'reason',
    ];
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [header.join(',')];
    for (const r of resp.results) {
      lines.push([
        r.rowIndex, r.action, r.docId ?? '', r.csvBoardNumber, r.csvInitials, r.csvHomeroom,
        r.before?.studentNumber ?? '', r.before?.externalStudentNumber ?? '', r.before?.stableStudentId ?? '', r.before?.displayCode ?? '',
        r.after?.studentNumber ?? '', r.after?.externalStudentNumber ?? '', r.after?.stableStudentId ?? '', r.after?.displayCode ?? '',
        r.verified == null ? '' : (r.verified ? 'yes' : 'no'),
        (r.candidateIds || []).join('|'),
        r.reason ?? '',
      ].map(escape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `update_student_numbers_${resp.dryRun ? 'preview' : 'committed'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const active = committed || preview;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Update Student Numbers from Board Roster
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            One-time migration. Replaces each student's <code>studentNumber</code> with the board Student Number,
            sets <code>externalStudentNumber</code> + <code>stableStudentId</code> to the same value, and preserves
            the old coded value (e.g. <code>4F-14</code>) as <code>displayCode</code>. Match key is initials + homeroom.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFile}
          />
          <Button onClick={() => inputRef.current?.click()} disabled={busy} variant="outline">
            {busy && !parsedRows ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Parsing…</> : '1. Upload roster CSV/XLSX'}
          </Button>

          {parsedRows && (
            <span className="text-xs text-muted-foreground">
              {parsedRows.length} usable rows from <strong>{fileName}</strong>
            </span>
          )}

          {parsedRows && (
            <Button onClick={runPreview} disabled={busy}>
              {busy && parsedRows && !preview ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Previewing…</>
              ) : (
                <><Eye className="mr-2 h-4 w-4" /> 2. Preview changes</>
              )}
            </Button>
          )}

          {preview && !committed && (
            <Button onClick={runCommit} disabled={busy} variant="default">
              {busy ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Writing…</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> 3. Confirm & write</>
              )}
            </Button>
          )}

          {(parsedRows || preview || committed) && (
            <Button variant="ghost" onClick={reset} disabled={busy}>Reset</Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="create-missing"
            checked={createMissing}
            onCheckedChange={(c) => {
              setCreateMissing(!!c);
              setPreview(null); // require re-preview if toggle changes
              setCommitted(null);
            }}
            disabled={busy}
          />
          <Label htmlFor="create-missing" className="text-sm">
            Create new student records for unmatched roster rows
          </Label>
        </div>

        {active && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant={ACTION_VARIANT.update}>Update: {active.totals.update}</Badge>
              <Badge variant={ACTION_VARIANT.create}>Create: {active.totals.create}</Badge>
              <Badge variant={ACTION_VARIANT.ambiguous}>Ambiguous: {active.totals.ambiguous}</Badge>
              <Badge variant={ACTION_VARIANT.skipped}>Skipped: {active.totals.skipped}</Badge>
              <Badge variant={ACTION_VARIANT.alreadyMigrated}>Already migrated: {active.totals.alreadyMigrated}</Badge>
              {active.totals.errored > 0 && (
                <Badge variant={ACTION_VARIANT.errored}>Errored: {active.totals.errored}</Badge>
              )}
              {committed && (
                <>
                  <Badge variant="secondary">Verified: {active.totals.verified}</Badge>
                  {active.totals.verifyFailed > 0 && (
                    <Badge variant="destructive">Verify failed: {active.totals.verifyFailed}</Badge>
                  )}
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => downloadReport(active)}>
                <Download className="mr-2 h-3 w-3" /> Download {committed ? 'commit' : 'preview'} CSV
              </Button>
            </div>

            <div className="max-h-96 overflow-auto rounded border text-xs">
              <table className="w-full text-left">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2">Row</th>
                    <th className="p-2">CSV #</th>
                    <th className="p-2">Initials</th>
                    <th className="p-2">Homeroom</th>
                    <th className="p-2">Doc id</th>
                    <th className="p-2">Old studentNumber</th>
                    <th className="p-2">New studentNumber</th>
                    <th className="p-2">displayCode</th>
                    <th className="p-2">Action</th>
                    {committed && <th className="p-2">Verified</th>}
                  </tr>
                </thead>
                <tbody>
                  {active.results.map((r) => (
                    <tr key={r.rowIndex} className="border-t">
                      <td className="p-2">{r.rowIndex}</td>
                      <td className="p-2 font-mono">{r.csvBoardNumber}</td>
                      <td className="p-2">{r.csvInitials}</td>
                      <td className="p-2">{r.csvHomeroom}</td>
                      <td className="p-2 font-mono text-[10px]">{r.docId || '—'}</td>
                      <td className="p-2 font-mono">{r.before?.studentNumber || '—'}</td>
                      <td className="p-2 font-mono">{r.after?.studentNumber || '—'}</td>
                      <td className="p-2 font-mono">{r.after?.displayCode || r.before?.displayCode || '—'}</td>
                      <td className="p-2">
                        <Badge variant={ACTION_VARIANT[r.action]}>{ACTION_LABEL[r.action]}</Badge>
                        {r.action === 'ambiguous' && r.candidateIds && (
                          <div className="mt-1 text-[10px] text-muted-foreground">
                            {r.candidateIds.length} candidates
                          </div>
                        )}
                        {r.reason && r.action !== 'update' && r.action !== 'create' && (
                          <div className="mt-1 text-[10px] text-muted-foreground">{r.reason}</div>
                        )}
                      </td>
                      {committed && (
                        <td className="p-2">
                          {r.verified == null ? '—' : r.verified ? '✓' : '✗'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
