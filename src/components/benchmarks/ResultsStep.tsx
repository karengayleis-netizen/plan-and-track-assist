import { Button } from '@/components/ui/button';
import type { ImportResult, ImportRow } from '@/types/importWizard';
import { CheckCircle2, AlertTriangle, Download, Save } from 'lucide-react';

interface ResultsStepProps {
  result: ImportResult;
  rows: ImportRow[];
  onDownloadErrors: () => void;
  onSaveTemplate: () => void;
  onClose: () => void;
}

export function ResultsStep({ result, rows, onDownloadErrors, onSaveTemplate, onClose }: ResultsStepProps) {
  const hasErrors = result.skippedRows > 0 || result.unmatchedRows > 0;

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

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Rows', value: result.totalRows },
          { label: 'Imported', value: result.importedRows, color: 'text-green-600' },
          { label: 'Skipped', value: result.skippedRows, color: 'text-yellow-600' },
          { label: 'Unmatched', value: result.unmatchedRows, color: 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-lg bg-muted/30 text-center">
            <p className={`text-xl font-bold ${s.color || 'text-foreground'}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {hasErrors && (
          <Button variant="outline" className="w-full" onClick={onDownloadErrors}>
            <Download className="h-4 w-4 mr-2" />
            Download Error Report
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
