import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ImportResult, ImportRow } from '@/types/importWizard';
import type { ErrorSummary } from '@/lib/csvParser';
import { CheckCircle2, AlertTriangle, Download, Save, FileWarning, XCircle, School, Loader2, FlaskConical } from 'lucide-react';

interface ResultsStepProps {
  result: ImportResult;
  rows: ImportRow[];
  errorSummary: ErrorSummary;
  onDownloadErrors: () => void;
  onSaveTemplate: () => void;
  onProbeWrite?: () => Promise<{ ok: boolean; code?: string; message?: string }>;
  onClose: () => void;
}

export function ResultsStep({ result, rows, errorSummary, onDownloadErrors, onSaveTemplate, onProbeWrite, onClose }: ResultsStepProps) {
  const failedToSave = result.failedToSaveRows ?? result.errorRows ?? 0;
  const hasErrors = result.skippedRows > 0 || result.unmatchedRows > 0 || failedToSave > 0;

  // Diagnostics: rows that vanished (not imported, not skipped, not unmatched, not failed)
  const accountedFor = result.accountedFor ?? (result.importedRows + result.skippedRows + result.unmatchedRows + failedToSave);
  const unaccountedFor = result.unaccountedFor ?? (result.totalRows - accountedFor);
  const showDiagnostics = unaccountedFor !== 0 || result.loopAborted || (result.importedRows === 0 && result.attemptedRows && result.attemptedRows > 0);

  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{ ok: boolean; code?: string; message?: string } | null>(null);

  const runProbe = async () => {
    if (!onProbeWrite) return;
    setProbing(true);
    setProbeResult(null);
    try {
      const r = await onProbeWrite();
      setProbeResult(r);
    } finally {
      setProbing(false);
    }
  };


  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        {result.importedRows > 0 ? (
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
        ) : (
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
        )}
        <h3 className="text-lg font-semibold">
          {result.importedRows > 0 ? 'Import Complete' : 'No Rows Imported'}
        </h3>
      </div>

      {failedToSave > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">
                {failedToSave} row{failedToSave !== 1 ? 's' : ''} matched a student but failed to save
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The database rejected these writes. First error{result.writeErrors && result.writeErrors.length > 1 ? 's' : ''} below — share with support if you need help.
              </p>
            </div>
          </div>
          {result.writeErrors && result.writeErrors.length > 0 && (
            <ul className="text-xs font-mono bg-background/60 rounded p-2 space-y-1 ml-6 list-disc list-inside">
              {result.writeErrors.map((e, i) => (
                <li key={i} className="break-words">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Rows', value: result.totalRows },
          { label: 'Imported', value: result.importedRows, color: 'text-green-600' },
          { label: 'Skipped (validation)', value: result.skippedRows, color: 'text-yellow-600' },
          { label: 'Unmatched', value: result.unmatchedRows, color: 'text-muted-foreground' },
          { label: 'Failed to Save', value: failedToSave, color: failedToSave > 0 ? 'text-destructive' : 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-lg bg-muted/30 text-center">
            <p className={`text-xl font-bold ${s.color || 'text-foreground'}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Per-Class Breakdown */}
      {result.classSummary && Object.keys(result.classSummary).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <School className="h-4 w-4 text-primary" />
            Import by homeroom
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(result.classSummary)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([homeroom, count]) => (
                <Badge key={homeroom} variant="secondary" className="text-xs px-2.5 py-1">
                  {homeroom}: {count} row{count !== 1 ? 's' : ''}
                </Badge>
              ))}
          </div>
        </div>
      )}

      {/* Error Reason Breakdown */}
      {hasErrors && errorSummary.reasons.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <FileWarning className="h-4 w-4 text-yellow-500" />
            Why rows failed
          </h4>
          <div className="space-y-1.5">
            {errorSummary.reasons.map(({ reason, count }) => (
              <div key={reason} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 text-sm">
                <span className="text-muted-foreground">{reason}</span>
                <Badge variant="secondary" className="text-xs ml-2 shrink-0">{count} row{count !== 1 ? 's' : ''}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed Rows Preview */}
      {hasErrors && errorSummary.failedRows.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-destructive" />
            Failed rows ({errorSummary.failedRows.length})
          </h4>
          <ScrollArea className="h-[160px] rounded-md border border-border">
            <div className="divide-y divide-border">
              {errorSummary.failedRows.slice(0, 50).map((row) => (
                <div key={row.rowNumber} className="px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={row.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
                      Row {row.rowNumber}
                    </Badge>
                    <span className="text-muted-foreground truncate">
                      {row.reasons.join(' · ')}
                    </span>
                  </div>
                  <p className="text-muted-foreground/70 truncate">
                    {Object.entries(row.originalValues).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                  </p>
                </div>
              ))}
              {errorSummary.failedRows.length > 50 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                  + {errorSummary.failedRows.length - 50} more — download CSV for full list
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {hasErrors && (
          <Button variant="outline" className="w-full" onClick={onDownloadErrors}>
            <Download className="h-4 w-4 mr-2" />
            Download Error Report (.csv)
          </Button>
        )}
        <Button variant="outline" className="w-full" onClick={onSaveTemplate}>
          <Save className="h-4 w-4 mr-2" />
          Save Column Mapping as Template
        </Button>
        <Button className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
