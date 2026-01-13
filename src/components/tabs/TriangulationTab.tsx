import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { useMarkbook } from '@/hooks/useMarkbook';
import { Search, RefreshCw, Upload } from 'lucide-react';

export function TriangulationTab() {
  const { students, loading } = useStudents();
  const { benchmarks } = useBenchmarks();
  const { entries } = useMarkbook();
  
  const [selectedClass, setSelectedClass] = useState<string>('');
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
      {/* School Roster Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>School Roster (Class-based)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Lives beside your legacy teacher roster. Use for shared classes, FI flip model, ISSP/ELL access, and CSV classlists.
              </p>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Path: schools/folkstone_ps/classes/* + schools/folkstone_ps/students
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* My Classes */}
            <div className="space-y-4">
              <h3 className="font-semibold">My Classes (assigned)</h3>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="No classes assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2F">2F - Grade 2 French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Upload Classlist CSV</h4>
                <p className="text-xs text-muted-foreground">
                  Columns supported: <code>student name (last, first)</code>, <code>number (optional)</code>, <code>grade</code>, <code>homeroom</code>.
                </p>
                <Input type="file" accept=".csv" className="text-sm" />
                <Button className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload to Selected Class
                </Button>
              </div>
            </div>
            
            {/* Students in selected class */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Students in selected class</h3>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search name / number..." 
                      className="pl-8 w-48"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Homeroom</TableHead>
                    <TableHead>Seat</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No students in roster yet.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              <p className="text-xs text-muted-foreground">
                Tip: Edit names safely — the internal <code>studentId</code> stays stable.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
