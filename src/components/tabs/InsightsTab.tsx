import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { Search, RefreshCw, Upload } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export function InsightsTab() {
  const { students } = useStudents();
  const { benchmarks } = useBenchmarks();
  
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  // Calculate data count per student
  const dataCountByStudent = students.map(student => ({
    name: student.initials || student.studentNumber,
    count: benchmarks.filter(b => b.studentId === student.id).length
  }));

  // Calculate risk vs stable (mock data for now)
  const performanceData = students.map(student => {
    const studentBenchmarks = benchmarks.filter(b => b.studentId === student.id);
    const atRisk = studentBenchmarks.some(b => parseFloat(b.score) < 50) ? 1 : 0;
    return {
      name: student.initials || student.studentNumber,
      atRisk,
      stable: atRisk ? 0 : 1
    };
  });

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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Data Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataCountByStudent}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#4f46e5" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Class Performance (Risk vs Stable)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="atRisk" stackId="a" fill="#ef4444" name="At Risk" />
                  <Bar dataKey="stable" stackId="a" fill="#22c55e" name="Stable" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Deep Dive */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Student Deep Dive</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select a student to see their trend line and detailed history.
              </p>
            </div>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="-- Choose Student --" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.studentNumber} - {student.initials}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {selectedStudent ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Showing data for student: {students.find(s => s.id === selectedStudent)?.studentNumber}
              </p>
              {/* Add trend chart here when data is available */}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Select a student to view their detailed analytics.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
