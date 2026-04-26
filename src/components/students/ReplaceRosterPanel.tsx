import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, AlertTriangle } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { parseRosterCSV, type RosterParseResult } from '@/lib/rosterParser';
import { toast } from 'sonner';

interface Props {
  onAfterRun?: () => void;
}

interface ReplaceResult {
  created: number;
  updated: number;
  deactivated: number;
  deletedLegacyCoded: number;
  errors: Array<{ studentNumber: string; reason: string }>;
}

export function ReplaceRosterPanel({ onAfterRun }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<RosterParseResult | null>(null);
  const [committing, setCommitting] = useState(false);
  const [serverResult, setServerResult] = useState<ReplaceResult | null>(null);
  const [open, setOpen] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setServerResult(null);
    try {
      const r = await parseRosterCSV(file);
      setResult(r);
      setOpen(true);
    } catch (err) {
      console.error('[ReplaceRoster] parse error', err);
      toast.error('Failed to parse roster CSV');
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    if (!result || result.validRows.length === 0) return;
    setCommitting(true);
    try {
      const callable = httpsCallable(functions, 'replaceSchoolRoster');
      const payload = {
        rows: result.validRows.map(r => ({
          studentNumber: r.studentNumber,
          initials: r.initials,
          homeroom: r.homeroom,
          grade: r.grade,
        })),
      };
      const res = await callable(payload);
      const data = res.data as ReplaceResult;
      setServerResult(data);
      toast.success(
        `Roster replaced — created ${data.created}, updated ${data.updated}, deactivated ${data.deactivated}`,
      );
      onAfterRun?.();
    } catch (err) {
      console.error('[ReplaceRoster] commit error', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Replace failed: ${msg}`);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Replace Roster from Board CSV
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a board roster CSV with columns{' '}
            <code className="bg-muted px-1 rounded">Student Number</code>,{' '}
            <code className="bg-muted px-1 rounded">Student Initials</code>,{' '}
            <code className="bg-muted px-1 rounded">Homeroom</code> (or <code className="bg-muted px-1 rounded">Section Number</code>),{' '}
            <code className="bg-muted px-1 rounded">Grade</code>. This <strong>fully replaces</strong> the active roster for your school.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              disabled={parsing}
              className="max-w-md focus:ring-primary"
            />
            {parsing && (
              <span className="text-sm text-primary flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setOpen(false);
            setResult(null);
            setServerResult(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Roster Replace Preview</DialogTitle>
          </DialogHeader>

          {result && (
            <div className="space-y-4 text-sm">
              {/* Detected columns */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1 text-xs font-mono">
                <p className="font-semibold">Detected columns:</p>
                <p>• Student Number → {result.detected.studentNumberHeader || <span className="text-destructive">NOT FOUND</span>}</p>
                <p>• Initials → {result.detected.initialsHeader || <span className="text-warning">missing</span>}</p>
                <p>• Homeroom / Section → {result.detected.homeroomHeader || <span className="text-destructive">NOT FOUND</span>}</p>
                <p>• Grade → {result.detected.gradeHeader || <span className="text-destructive">NOT FOUND</span>}</p>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                  <div className="text-2xl font-semibold text-success">{result.validRows.length}</div>
                  <div className="text-xs text-muted-foreground">Usable rows</div>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="text-2xl font-semibold text-destructive">{result.errorCount}</div>
                  <div className="text-xs text-muted-foreground">Rows with errors</div>
                </div>
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <div className="text-2xl font-semibold text-warning">{result.warningCount}</div>
                  <div className="text-xs text-muted-foreground">Warnings</div>
                </div>
              </div>

              {!serverResult && (
                <div className="rounded border border-warning/40 bg-warning/5 p-2 text-xs flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p>
                    Confirming will <strong>deactivate every existing student in your school</strong> that is not in this CSV, and{' '}
                    <strong>permanently delete legacy coded-ID students</strong> (e.g. <code>4F-14</code>) that are not in this CSV.
                    Active students from the CSV will be created or updated.
                  </p>
                </div>
              )}

              {/* Server result */}
              {serverResult && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1">
                  <p className="font-semibold text-success">Roster replace complete</p>
                  <p>• Created: {serverResult.created}</p>
                  <p>• Updated: {serverResult.updated}</p>
                  <p>• Deactivated: {serverResult.deactivated}</p>
                  <p>• Deleted legacy coded-ID rows: {serverResult.deletedLegacyCoded}</p>
                  {serverResult.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-destructive font-semibold">{serverResult.errors.length} error(s):</p>
                      {serverResult.errors.slice(0, 10).map((e, i) => (
                        <p key={i} className="text-destructive">• {e.studentNumber}: {e.reason}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Preview table */}
              <div className="border rounded-lg overflow-auto max-h-[40vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Student Number</TableHead>
                      <TableHead>Initials</TableHead>
                      <TableHead>Homeroom</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.slice(0, 50).map(r => (
                      <TableRow key={r.rowIndex}>
                        <TableCell className="text-xs">{r.rowIndex}</TableCell>
                        <TableCell className="font-mono text-xs">{r.studentNumber || '—'}</TableCell>
                        <TableCell className="text-xs">{r.initials || '—'}</TableCell>
                        <TableCell className="text-xs font-mono">{r.homeroom || '—'}</TableCell>
                        <TableCell className="text-xs">{r.grade || '—'}</TableCell>
                        <TableCell>
                          {r.errors.length > 0 ? (
                            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                              error
                            </Badge>
                          ) : r.warnings.length > 0 ? (
                            <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
                              warn
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                              ok
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {result.rows.length > 50 && (
                <p className="text-xs text-muted-foreground text-center">
                  Showing first 50 of {result.rows.length} rows
                </p>
              )}

              {/* Errors detail */}
              {result.errorCount > 0 && (
                <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs space-y-0.5 max-h-32 overflow-auto">
                  <p className="font-semibold text-destructive">Error rows (first 20):</p>
                  {result.rows.filter(r => r.errors.length > 0).slice(0, 20).map(r => (
                    <p key={r.rowIndex} className="text-destructive">
                      • Row {r.rowIndex}: {r.errors.join('; ')}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={committing}>
              Close
            </Button>
            {!serverResult && (
              <Button
                onClick={handleConfirm}
                disabled={committing || !result || result.validRows.length === 0}
              >
                {committing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Replace Roster ({result?.validRows.length || 0})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
