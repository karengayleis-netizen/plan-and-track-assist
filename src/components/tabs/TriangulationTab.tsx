import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { useMarkbook } from '@/hooks/useMarkbook';

export function TriangulationTab() {
  const { students, loading } = useStudents();
  const { benchmarks } = useBenchmarks();
  const { entries } = useMarkbook();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'focus'>('all');

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.studentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.firstName?.toLowerCase().includes(searchQuery.toLowerCase());
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
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Student Triangulation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Holistic view of all data points.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={filterMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('all')}
              >
                Show All
              </Button>
              <Button 
                variant={filterMode === 'focus' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('focus')}
              >
                Focus Group Only
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
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        {student.studentNumber}
                        {student.initials && <span className="ml-1 text-muted-foreground">({student.initials})</span>}
                      </TableCell>
                      <TableCell>{student.grade}</TableCell>
                      <TableCell>
                        {student.isFocusStudent && (
                          <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs">Yes</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.isHighNeed && (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">Yes</span>
                        )}
                      </TableCell>
                      <TableCell>{dataPoints}</TableCell>
                      <TableCell>{studentBenchmarks.length}</TableCell>
                      <TableCell>{studentEntries.length}</TableCell>
                      <TableCell>
                        {student.isHighNeed ? (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">At Risk</span>
                        ) : dataPoints > 0 ? (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Stable</span>
                        ) : (
                          <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">No Data</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
