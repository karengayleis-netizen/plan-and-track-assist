import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { useMarkbook } from '@/hooks/useMarkbook';
import { useClasses } from '@/hooks/useClasses';
import { GRADES, SUBJECTS } from '@/types';
import { AlertTriangle, Loader2 } from 'lucide-react';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export function MissingDataTab() {
  const { students, loading: studentsLoading } = useStudents();
  const { benchmarks, loading: benchmarksLoading } = useBenchmarks();
  const { entries: markbookEntries, loading: markbookLoading } = useMarkbook();
  const { classes } = useClasses();

  const [filterClass, setFilterClass] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterTag, setFilterTag] = useState('all');

  const loading = studentsLoading || benchmarksLoading || markbookLoading;

  const gaps = useMemo(() => {
    const now = Date.now();

    return students
      .filter(s => {
        if (filterClass !== 'all' && s.homeroom !== filterClass) return false;
        if (filterGrade !== 'all' && s.grade !== filterGrade) return false;
        if (filterTag !== 'all' && !(s.tags || []).includes(filterTag)) return false;
        return true;
      })
      .map(student => {
        const studentBenchmarks = benchmarks.filter(b => b.studentId === student.id);
        const studentMarkbook = markbookEntries.filter(e => e.studentId === student.id);

        // Subject filter narrows benchmark/markbook checks
        const filteredBenchmarks = filterSubject !== 'all'
          ? studentBenchmarks.filter(b => b.subject === filterSubject)
          : studentBenchmarks;
        const filteredMarkbook = filterSubject !== 'all'
          ? studentMarkbook.filter(e => e.subject === filterSubject)
          : studentMarkbook;

        const missingBenchmark = filteredBenchmarks.length === 0;
        const missingEvidence = filteredMarkbook.length === 0;

        // "No Recent Data" = no benchmark or markbook entry in last 30 days
        const allDates = [
          ...filteredBenchmarks.map(b => b.date instanceof Date ? b.date.getTime() : 0),
          ...filteredMarkbook.map(e => e.date instanceof Date ? e.date.getTime() : 0),
        ].filter(d => d > 0);
        const latestDate = allDates.length > 0 ? Math.max(...allDates) : 0;
        const noRecentData = allDates.length > 0 && (now - latestDate) > THIRTY_DAYS;

        // Triangulation: need at least 2 of 3 evidence types (benchmark, markbook, observation)
        const triangulationSources = [
          filteredBenchmarks.length > 0,
          filteredMarkbook.length > 0,
        ].filter(Boolean).length;
        const missingTriangulation = triangulationSources < 2;

        const hasGap = missingBenchmark || missingEvidence || noRecentData || missingTriangulation;

        return {
          student,
          missingBenchmark,
          missingEvidence,
          noRecentData,
          missingTriangulation,
          hasGap,
          gapCount: [missingBenchmark, missingEvidence, noRecentData, missingTriangulation].filter(Boolean).length,
        };
      })
      .filter(g => g.hasGap)
      .sort((a, b) => b.gapCount - a.gapCount);
  }, [students, benchmarks, markbookEntries, filterClass, filterGrade, filterSubject]);

  const uniqueHomerooms = [...new Set(students.map(s => s.homeroom).filter(Boolean))].sort();
  const uniqueGrades = [...new Set(students.map(s => s.grade).filter(Boolean))].sort();

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Missing Data
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Students with incomplete benchmarks, markbook entries, or triangulation evidence.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="w-44">
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="focus:ring-primary">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {uniqueHomerooms.map(h => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger className="focus:ring-primary">
                  <SelectValue placeholder="All Grades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {uniqueGrades.map(g => (
                    <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="focus:ring-primary">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {SUBJECTS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {loading ? 'Loading…' : `${gaps.length} student${gaps.length !== 1 ? 's' : ''} with gaps`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Analyzing data coverage…
            </div>
          ) : gaps.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-medium">No gaps found</p>
              <p className="text-xs text-muted-foreground mt-1">
                All students have complete data for the current filters.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Student #</TableHead>
                  <TableHead>Initials</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Homeroom</TableHead>
                  <TableHead>Missing Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gaps.map(({ student, missingBenchmark, missingEvidence, noRecentData, missingTriangulation }) => (
                  <TableRow key={student.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono font-medium">{student.studentNumber}</TableCell>
                    <TableCell>{student.initials || '—'}</TableCell>
                    <TableCell>{student.grade}</TableCell>
                    <TableCell className="font-mono">{student.homeroom}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {missingBenchmark && (
                          <Badge variant="destructive" className="text-xs font-medium">
                            Missing Benchmark
                          </Badge>
                        )}
                        {missingEvidence && (
                          <Badge variant="outline" className="text-xs font-medium border-warning text-warning">
                            Missing Evidence
                          </Badge>
                        )}
                        {noRecentData && (
                          <Badge variant="secondary" className="text-xs font-medium">
                            No Recent Data
                          </Badge>
                        )}
                        {missingTriangulation && (
                          <Badge variant="outline" className="text-xs font-medium border-chart-3 text-chart-3">
                            Incomplete Triangulation
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
