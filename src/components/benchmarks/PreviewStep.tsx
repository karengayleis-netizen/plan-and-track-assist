import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ImportRow } from '@/types/importWizard';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface PreviewStepProps {
  rows: ImportRow[];
  onImport: () => void;
  importing: boolean;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  ready: 'bg-green-500/10 text-green-700 border-green-500/30',
  warning: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function PreviewStep({ rows, onImport, importing, onBack }: PreviewStepProps) {
  const readyCount = rows.filter(r => r.status === 'ready' && r.matchedStudentId).length;
  const warningCount = rows.filter(r => r.status === 'warning').length;
  const errorCount = rows.filter(r => r.status === 'error').length;
  const unmatchedCount = rows.filter(r => !r.matchedStudentId && r.status !== 'error').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Ready', count: readyCount, color: 'text-green-600' },
          { label: 'Warnings', count: warningCount, color: 'text-yellow-600' },
          { label: 'Errors', count: errorCount, color: 'text-destructive' },
          { label: 'Unmatched', count: unmatchedCount, color: 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="text-center p-2 rounded-lg bg-muted/30">
            <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Preview Table */}
      <div className="border rounded-lg overflow-auto max-h-[40vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Assessment</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-20">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 10).map(row => (
              <TableRow key={row.rowIndex}>
                <TableCell className="text-xs text-muted-foreground">{row.rowIndex + 1}</TableCell>
                <TableCell className="text-sm">
                  {row.matchedStudentId
                    ? <span className="font-medium">{row.matchedStudentInitials} <span className="text-muted-foreground text-xs">({row.matchedStudentNumber})</span></span>
                    : <span className="text-muted-foreground italic">Unmatched</span>
                  }
                </TableCell>
                <TableCell className="text-sm">{row.assessmentType}</TableCell>
                <TableCell className="text-sm font-medium">{row.score}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.date || 'Today'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${statusColors[row.status]}`}>
                    {row.status === 'ready' ? 'Ready' : row.status === 'warning' ? 'Warn' : 'Error'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {rows.length > 10 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first 10 of {rows.length} rows
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={onImport} disabled={importing || readyCount === 0}>
          {importing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
          ) : (
            `Import ${readyCount} Rows`
          )}
        </Button>
      </div>
    </div>
  );
}
