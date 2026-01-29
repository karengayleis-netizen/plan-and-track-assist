import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { useMarkbook } from '@/hooks/useMarkbook';
import { Triangle, Search } from 'lucide-react';

export function TriangulationTab() {
  const { students, loading } = useStudents();
  const { benchmarks } = useBenchmarks();
  const { entries } = useMarkbook();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'focus'>('all');

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.studentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.initials?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterMode === 'all' || student.isFocusStudent;
    return matchesSearch && matchesFilter;
  });

  // Get data points count for each student
  const getStudentDataPoints = (studentId: string) => {
    const benchmarkCount = benchmarks.filter(b => b.studentId === studentId).length;
    const markbookCount = entries.filter(e => e.studentId === studentId).length;
    return benchmarkCount + markbookCount;
  };

  return (
    <div className="space-y-6">
      {/* Student Triangulation */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Triangle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Student Triangulation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Holistic view of all data points.
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search students..." 
                  className="pl-8 w-full sm:w-48 focus:ring-primary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button 
                variant={filterMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('all')}
              >
                All
              </Button>
              <Button 
                variant={filterMode === 'focus' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('focus')}
              >
                Focus
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filteredStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No students found for this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Student</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Focus</TableHead>
                    <TableHead>High Need</TableHead>
                    <TableHead>Data Points</TableHead>
                    <TableHead>Benchmarks</TableHead>
                    <TableHead>Markbook</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map(student => {
                    const studentBenchmarks = benchmarks.filter(b => b.studentId === student.id);
                    const studentEntries = entries.filter(e => e.studentId === student.id);
                    const dataPoints = getStudentDataPoints(student.id);
                    
                    return (
                      <TableRow key={student.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          {student.studentNumber}
                          {student.initials && <span className="ml-1 text-muted-foreground">({student.initials})</span>}
                        </TableCell>
                        <TableCell>{student.grade}</TableCell>
                        <TableCell>
                          {student.isFocusStudent && (
                            <span className="bg-chart-3/10 text-chart-3 px-2 py-1 rounded-full text-xs font-medium">Yes</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.isHighNeed && (
                            <span className="bg-destructive/10 text-destructive px-2 py-1 rounded-full text-xs font-medium">Yes</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-primary">{dataPoints}</span>
                        </TableCell>
                        <TableCell>{studentBenchmarks.length}</TableCell>
                        <TableCell>{studentEntries.length}</TableCell>
                        <TableCell>
                          {student.isHighNeed ? (
                            <span className="bg-destructive/10 text-destructive px-2 py-1 rounded-full text-xs font-medium">At Risk</span>
                          ) : dataPoints > 0 ? (
                            <span className="bg-success/10 text-success px-2 py-1 rounded-full text-xs font-medium">Stable</span>
                          ) : (
                            <span className="bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs font-medium">No Data</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
