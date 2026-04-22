import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ImportRow } from '@/types/importWizard';
import { ArrowLeft, Loader2, Filter } from 'lucide-react';

interface PreviewStepProps {
  rows: ImportRow[];
  onImport: () => void;
  importing: boolean;
  onBack: () => void;
  studentsLoading?: boolean;
  classCodeMapped?: boolean;
  students?: Array<{ externalStudentNumber?: string; stableStudentId?: string; studentNumber?: string }>;
}

const statusColors: Record<string, string> = {
  ready: 'bg-green-500/10 text-green-700 border-green-500/30',
  warning: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function PreviewStep({ rows, onImport, importing, onBack, studentsLoading, classCodeMapped, students }: PreviewStepProps) {
  const [homeroomFilter, setHomeroomFilter] = useState<string>('all');

  // Collect unique homerooms from rows
  const homerooms = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      const hr = r.matchedHomeroom || r.csvHomeroom;
      if (hr) set.add(hr);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (homeroomFilter === 'all') return rows;
    if (homeroomFilter === 'unassigned') return rows.filter(r => !r.matchedHomeroom && !r.csvHomeroom);
    return rows.filter(r => (r.matchedHomeroom || r.csvHomeroom) === homeroomFilter);
  }, [rows, homeroomFilter]);

  // Importable = matched + not error (matches runImport logic; warnings are OK)
  const importableCount = rows.filter(r => r.matchedStudentId && r.status !== 'error').length;
  const matchedCount = rows.filter(r => r.matchedStudentId).length;
  const warningCount = rows.filter(r => r.status === 'warning').length;
  const errorCount = rows.filter(r => r.status === 'error').length;
  const unmatchedCount = rows.filter(r => !r.matchedStudentId && r.status !== 'error').length;
  const homeroomMismatchCount = rows.filter(r => r.matchedStudentId && r.csvHomeroom && r.matchedHomeroom && r.csvHomeroom !== r.matchedHomeroom).length;

  return (
    <div className="space-y-4">
      {/* Roster still loading */}
      {studentsLoading && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm">
          <p className="font-medium text-yellow-700 mb-1">Roster still loading</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Matching has not run yet — please wait a moment, then go Back and click Preview again.
          </p>
        </div>
      )}

      {/* Class Name not mapped warning */}
      {!studentsLoading && classCodeMapped === false && rows.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm">
          <p className="font-medium text-yellow-700 mb-1">Class Name was not mapped to Homeroom / Class Code</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Imports will still run, but homeroom information from the CSV won't be saved with each benchmark. Go Back to map the Class Name column.
          </p>
        </div>
      )}

      {/* No-match diagnostic banner */}
      {!studentsLoading && matchedCount === 0 && rows.length > 0 && (() => {
        const uniqueIds = Array.from(new Set(rows.map(r => r.matchedStudentNumber || (r.rawValues?.[0] ?? '')).filter(Boolean))).slice(0, 6);
        return (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive mb-1">Student IDs did not match any roster records</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              This benchmark file is using <strong>board IDs</strong> (e.g. <code className="px-1 bg-muted rounded">1027516</code>), but those board IDs are not yet present on your roster — your students are stored under coded IDs like <code className="px-1 bg-muted rounded">1AF-3</code>.
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed mt-1">
              Re-run the <strong>Backfill Board Numbers (whole-school)</strong> tool on the Students tab using a class list with <strong>Section Number</strong> + <strong>Student #</strong> columns. Then come back and re-import this file.
            </p>
            <p className="text-muted-foreground text-[11px] mt-1">
              {rows.length} row(s) failed across approximately {new Set(rows.map(r => r.rawValues?.[0])).size} unique student IDs.
            </p>
          </div>
        );
      })()}

      {/* Homeroom mismatch info banner */}
      {!studentsLoading && homeroomMismatchCount > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm">
          <p className="font-medium text-yellow-700 mb-1">{homeroomMismatchCount} row{homeroomMismatchCount === 1 ? '' : 's'} matched by student ID but homeroom differs</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            These will still import — student ID is the primary identity key. CSV homeroom is stored for audit.
          </p>
        </div>
      )}


      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Importable', count: importableCount, color: 'text-green-600' },
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

      {/* Homeroom Filter */}
      {homerooms.length > 0 && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={homeroomFilter} onValueChange={setHomeroomFilter}>
            <SelectTrigger className="w-[200px] h-8 text-sm">
              <SelectValue placeholder="Filter by homeroom" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All homerooms ({rows.length})</SelectItem>
              {homerooms.map(hr => {
                const count = rows.filter(r => (r.matchedHomeroom || r.csvHomeroom) === hr).length;
                return <SelectItem key={hr} value={hr}>{hr} ({count})</SelectItem>;
              })}
              <SelectItem value="unassigned">No homeroom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Preview Table */}
      <div className="border rounded-lg overflow-auto max-h-[40vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Student</TableHead>
              {homerooms.length > 0 && <TableHead>Homeroom</TableHead>}
              <TableHead>Assessment</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-20">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.slice(0, 10).map(row => (
              <TableRow key={row.rowIndex}>
                <TableCell className="text-xs text-muted-foreground">{row.rowIndex + 1}</TableCell>
                <TableCell className="text-sm">
                  {row.matchedStudentId
                    ? <span className="font-medium">{row.matchedStudentInitials} <span className="text-muted-foreground text-xs">({row.matchedStudentNumber})</span></span>
                    : <span className="text-muted-foreground italic">Unmatched</span>
                  }
                </TableCell>
                {homerooms.length > 0 && (
                  <TableCell className="text-sm">
                    {row.matchedHomeroom || row.csvHomeroom || <span className="text-muted-foreground">—</span>}
                    {row.csvHomeroom && row.matchedHomeroom && row.csvHomeroom !== row.matchedHomeroom && (
                      <Badge variant="outline" className="ml-1 text-[9px] bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                        mismatch
                      </Badge>
                    )}
                  </TableCell>
                )}
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

      {filteredRows.length > 10 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing first 10 of {filteredRows.length} rows
        </p>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button onClick={onImport} disabled={importing || importableCount === 0}>
          {importing ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
          ) : (
            `Import ${importableCount} Rows`
          )}
        </Button>
      </div>
    </div>
  );
}
