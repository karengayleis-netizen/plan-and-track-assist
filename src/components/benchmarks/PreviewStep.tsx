import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ImportRow, ImportIdDiagnosis, IdClassification } from '@/types/importWizard';
import { ArrowLeft, Loader2, Filter, Download } from 'lucide-react';

interface PreviewStepProps {
  rows: ImportRow[];
  onImport: () => void;
  importing: boolean;
  onBack: () => void;
  studentsLoading?: boolean;
  classCodeMapped?: boolean;
  students?: Array<{ studentNumber?: string }>;
  identifierColumnIndex?: number;
  idDiagnosis?: ImportIdDiagnosis;
}

const statusColors: Record<string, string> = {
  ready: 'bg-green-500/10 text-green-700 border-green-500/30',
  warning: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function PreviewStep({ rows, onImport, importing, onBack, studentsLoading, classCodeMapped, students, identifierColumnIndex, idDiagnosis }: PreviewStepProps) {
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

      {/* Identifier mapping invalid — block diagnostics */}
      {!studentsLoading && (typeof identifierColumnIndex !== 'number' || identifierColumnIndex < 0) && rows.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive mb-1">Student Number column is not mapped</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Preview cannot determine matches until the Student Number / board ID column is mapped. Go Back and select it on the Map Columns step.
          </p>
        </div>
      )}

      {/* Pre-import unmatched ID diagnosis — runs whenever any rows are unmatched */}
      {!studentsLoading && unmatchedCount > 0 && rows.length > 0 && typeof identifierColumnIndex === 'number' && identifierColumnIndex >= 0 && (() => {
        const idCol = identifierColumnIndex;
        const uniqueUnmatchedIdsRaw = Array.from(
          new Set(
            rows
              .filter(r => !r.matchedStudentId)
              .map(r => String(r.rawValues?.[idCol] ?? '').trim())
              .filter(Boolean)
          )
        );

        const d = idDiagnosis;
        const grouped: Record<IdClassification, typeof d.results> = {
          visibleMatch: [],
          missingEverywhere: [],
          hiddenMissingSchoolId: [],
          hiddenWrongSchoolId: [],
          duplicateExternalNumber: [],
        };
        (d?.results ?? []).forEach(r => grouped[r.status].push(r));

        const downloadReport = () => {
          if (!d?.ran || d.results.length === 0) return;
          const headers = ['CSV Student ID', 'Status', 'Suggested Action', 'Doc Count', 'Doc School IDs'];
          const actionFor: Record<IdClassification, string> = {
            visibleMatch: 'Re-run preview — should now match',
            missingEverywhere: 'Backfill Board Number on Students tab',
            hiddenMissingSchoolId: 'Repair schoolId on the student doc',
            hiddenWrongSchoolId: 'Student belongs to another school',
            duplicateExternalNumber: 'Duplicate board number in roster — deduplicate',
          };
          const escape = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
          const lines = d.results.map(r => [
            escape(r.rawId),
            r.status,
            escape(actionFor[r.status]),
            String(r.docCount),
            escape(r.docSchoolIds.filter(Boolean).join('|')),
          ].join(','));
          const csv = [headers.join(','), ...lines].join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `unmatched_ids_${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        };

        return (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-destructive">
                Unmatched student IDs before import
              </p>
              {d?.ran && d.results.length > 0 && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={downloadReport}>
                  <Download className="h-3 w-3 mr-1" /> Report CSV
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">
              <strong>{unmatchedCount}</strong> unmatched rows represent <strong>{uniqueUnmatchedIdsRaw.length}</strong> unique IDs.
            </p>

            {d?.loading && (
              <p className="text-muted-foreground text-xs flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Running cross-school diagnosis…
              </p>
            )}

            {d?.error && (
              <p className="text-xs text-destructive">
                Diagnosis call failed: {d.error}. Showing local view only.
              </p>
            )}

            {d?.ran && !d.loading && !d.error && (
              <>
                {grouped.missingEverywhere.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-background/40 p-2">
                    <p className="text-xs font-medium text-destructive mb-0.5">
                      Missing board numbers — {grouped.missingEverywhere.length} ID{grouped.missingEverywhere.length === 1 ? '' : 's'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Not on any student record in any school. Sample:{' '}
                      <code className="px-1 bg-muted rounded">{grouped.missingEverywhere.slice(0, 5).map(r => r.rawId).join(', ')}</code>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      → Run the <strong>Backfill Board Numbers</strong> tool on the Students tab.
                    </p>
                  </div>
                )}

                {(grouped.hiddenMissingSchoolId.length > 0 || grouped.hiddenWrongSchoolId.length > 0) && (
                  <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-2">
                    <p className="text-xs font-medium text-yellow-700 mb-0.5">
                      Hidden student records — {grouped.hiddenMissingSchoolId.length + grouped.hiddenWrongSchoolId.length} ID{grouped.hiddenMissingSchoolId.length + grouped.hiddenWrongSchoolId.length === 1 ? '' : 's'}
                    </p>
                    {grouped.hiddenMissingSchoolId.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {grouped.hiddenMissingSchoolId.length} found on student doc(s) with missing schoolId. Sample:{' '}
                        <code className="px-1 bg-muted rounded">{grouped.hiddenMissingSchoolId.slice(0, 5).map(r => r.rawId).join(', ')}</code>
                      </p>
                    )}
                    {grouped.hiddenWrongSchoolId.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        {grouped.hiddenWrongSchoolId.length} assigned to a different school. Sample:{' '}
                        <code className="px-1 bg-muted rounded">{grouped.hiddenWrongSchoolId.slice(0, 5).map(r => r.rawId).join(', ')}</code>
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      → Repair the <strong>schoolId</strong> field on those student docs (Firestore Console or admin tool).
                    </p>
                  </div>
                )}

                {grouped.duplicateExternalNumber.length > 0 && (
                  <div className="rounded-md border border-yellow-500/40 bg-yellow-500/5 p-2">
                    <p className="text-xs font-medium text-yellow-700 mb-0.5">
                      Duplicate board numbers — {grouped.duplicateExternalNumber.length} ID{grouped.duplicateExternalNumber.length === 1 ? '' : 's'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Same board number on more than one student in your school. Deduplicate before importing.{' '}
                      Sample: <code className="px-1 bg-muted rounded">{grouped.duplicateExternalNumber.slice(0, 5).map(r => r.rawId).join(', ')}</code>
                    </p>
                  </div>
                )}

                {grouped.visibleMatch.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {grouped.visibleMatch.length} ID{grouped.visibleMatch.length === 1 ? '' : 's'} now appear visible —
                    go Back and click Preview again to refresh matches.
                  </p>
                )}

                {d.rosterStats && (
                  <p className="text-[11px] text-muted-foreground border-t border-border/50 pt-1">
                    Visible roster: <strong>{d.rosterStats.totalInSchool}</strong> students ·{' '}
                    {d.rosterStats.withExternalStudentNumber} with externalStudentNumber ·{' '}
                    {d.rosterStats.withStudentNumber} with studentNumber ·{' '}
                    {d.rosterStats.withStableStudentId} with stableStudentId
                  </p>
                )}
              </>
            )}

            {!d?.ran && !d?.loading && (
              <p className="text-[11px] text-muted-foreground">
                Cross-school diagnosis is admin-only. Sample unmatched IDs:{' '}
                <code className="px-1 bg-muted rounded">{uniqueUnmatchedIdsRaw.slice(0, 8).join(', ')}</code>
              </p>
            )}
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
