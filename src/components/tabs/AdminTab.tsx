import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { GRADES } from '@/types';
import { Upload, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export function AdminTab() {
  const { students } = useStudents();
  const { benchmarks } = useBenchmarks();
  
  // Class Management state
  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffUid, setStaffUid] = useState('');
  const [canWrite, setCanWrite] = useState(false);

  // Calculate stats
  const totalStudents = students.length;
  const totalBenchmarks = benchmarks.length;
  const atRiskCount = students.filter(s => s.isHighNeed).length;
  const avgDataPerStudent = totalStudents > 0 ? (totalBenchmarks / totalStudents).toFixed(1) : '0';

  // Grade analytics
  const gradeAnalytics = GRADES.map(grade => {
    const gradeStudents = students.filter(s => s.grade === grade);
    const atRisk = gradeStudents.filter(s => s.isHighNeed).length;
    const stable = gradeStudents.length - atRisk;
    return {
      grade,
      students: gradeStudents.length,
      atRiskPercent: gradeStudents.length > 0 ? Math.round((atRisk / gradeStudents.length) * 100) : 0,
      stablePercent: gradeStudents.length > 0 ? Math.round((stable / gradeStudents.length) * 100) : 0
    };
  }).filter(g => g.students > 0);

  const handleCreateClass = () => {
    if (!classCode) {
      toast.error('Please enter a class code');
      return;
    }
    toast.success(`Class ${classCode} created`);
    setClassCode('');
    setClassName('');
  };

  const handleAnalyze = () => {
    toast.info('AI analysis coming soon');
  };

  return (
    <div className="space-y-6">
      {/* Class Management */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Class Management</CardTitle>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Paths: schools/folkstone_ps/classes/{'{classCode}'} • members/{'{uid}'} • roster/{'{studentId}'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Create classes, assign staff memberships, and upload classlists (CSV)
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create / Update Class */}
            <div className="space-y-4">
              <h3 className="font-semibold">Create / Update Class</h3>
              <Input
                placeholder="Class Code (e.g., 2F)"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
              />
              <Input
                placeholder="Class Name (optional)"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
              <Button className="w-full" onClick={handleCreateClass}>
                Create / Save Class
              </Button>
              <p className="text-xs text-muted-foreground">
                Note: If the CSV's homeroom differs by row, your existing upload logic already routes each student to that class field.
              </p>
            </div>

            {/* Memberships */}
            <div className="space-y-4">
              <h3 className="font-semibold">Memberships (Staff Access)</h3>
              <p className="text-sm text-muted-foreground">No classes yet</p>
              <div className="border rounded-lg p-3 space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide">Roster</span>
                <div className="text-sm text-muted-foreground">Select a class</div>
              </div>
              <div className="border rounded-lg p-3 space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide">Members</span>
                <div className="text-sm text-muted-foreground">Select a class</div>
              </div>
            </div>

            {/* Upload Classlist */}
            <div className="space-y-4">
              <h3 className="font-semibold">Upload Classlist (CSV)</h3>
              <p className="text-xs text-muted-foreground">
                Supported columns: <code>student name (last, first)</code>, <code>number (optional)</code>, <code>grade</code>, <code>homeroom</code>.
              </p>
              <Input type="file" accept=".csv" className="text-sm" />
              <Button className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Upload CSV to selected class
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Find staff (email search)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="type email or name..." 
                className="pl-8"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>UID</TableHead>
                  <TableHead>Use</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Search to find staff.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add/Update Staff Directory (one-time setup)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Staff UID</Label>
              <Input 
                placeholder="Paste staff Firebase UID"
                value={staffUid}
                onChange={(e) => setStaffUid(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="canWrite" 
                checked={canWrite}
                onCheckedChange={(checked) => setCanWrite(checked as boolean)}
              />
              <Label htmlFor="canWrite">Can upload/edit roster (canWrite)</Label>
            </div>
            <h4 className="font-medium mt-4">Current members</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>UID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>canWrite</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Select a class..
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* School Monitor */}
      <Card>
        <CardHeader>
          <CardTitle>School Monitor (Peel/ON)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <h3 className="font-semibold">All Grades</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{totalStudents}</div>
                <div className="text-xs text-muted-foreground uppercase">Total Students</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{totalBenchmarks}</div>
                <div className="text-xs text-muted-foreground uppercase">Total Benchmarks</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{atRiskCount}</div>
                <div className="text-xs text-muted-foreground uppercase">At Risk (Data/Flag)</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{avgDataPerStudent}</div>
                <div className="text-xs text-muted-foreground uppercase">Avg Data/Student</div>
              </div>
            </div>

            {/* School Risk Profile placeholder */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">School Risk Profile</h4>
              <div className="h-20 bg-muted rounded flex items-center justify-center text-muted-foreground">
                Chart visualization
              </div>
            </div>

            {/* Areas of Need */}
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Areas of Need</h4>
              <div className="text-muted-foreground text-sm">
                Analysis based on benchmark data will appear here.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grade & Teacher Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Grade Analytics & Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>At Risk % (Below)</TableHead>
                  <TableHead>Stable % (At/Above)</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradeAnalytics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No grade data yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  gradeAnalytics.map(grade => (
                    <TableRow key={grade.grade}>
                      <TableCell>Grade {grade.grade}</TableCell>
                      <TableCell>{grade.students}</TableCell>
                      <TableCell className="text-red-600">{grade.atRiskPercent}%</TableCell>
                      <TableCell className="text-green-600">{grade.stablePercent}%</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teacher Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Class Size</TableHead>
                  <TableHead>Benchmarks</TableHead>
                  <TableHead>Class Risk %</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No teacher data yet.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Tracked Students & AI Strategy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tracked Students (At-Risk)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.filter(s => s.isHighNeed).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No at-risk students flagged.
                    </TableCell>
                  </TableRow>
                ) : (
                  students.filter(s => s.isHighNeed).map(student => (
                    <TableRow key={student.id}>
                      <TableCell>{student.studentNumber}</TableCell>
                      <TableCell>{student.homeroom || '-'}</TableCell>
                      <TableCell>Manual flag</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">View</Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Strategy (Peel/ON)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select defaultValue="fi">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fi">French Immersion</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAnalyze}>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyze
              </Button>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Resource & Leadership Recommendations</h4>
              <p className="text-muted-foreground text-sm">
                Run analysis to generate AI-powered recommendations.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
