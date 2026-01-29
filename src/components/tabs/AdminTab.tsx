import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
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
import { Upload, Search, Sparkles, Loader2, Users, BarChart3, AlertTriangle, Activity, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { StatCard } from '@/components/dashboard';

interface AnalyzeSchoolDataResponse {
  recommendations: string;
}

export function AdminTab() {
  const { students } = useStudents();
  const { benchmarks } = useBenchmarks();
  
  // Class Management state
  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffUid, setStaffUid] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  
  // AI Strategy state
  const [selectedProgram, setSelectedProgram] = useState('fi');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState('');

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

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    
    try {
      const analyzeSchoolData = httpsCallable<object, AnalyzeSchoolDataResponse>(
        functions, 
        'analyzeSchoolData'
      );
      
      const atRiskStudents = students.filter(s => s.isHighNeed).map(s => ({
        id: s.id,
        studentNumber: s.studentNumber,
        grade: s.grade,
        homeroom: s.homeroom
      }));
      
      const result = await analyzeSchoolData({
        program: selectedProgram,
        schoolStats: {
          totalStudents,
          totalBenchmarks,
          atRiskCount,
          avgDataPerStudent: parseFloat(avgDataPerStudent)
        },
        gradeAnalytics,
        atRiskStudents
      });
      
      setAiRecommendations(result.data.recommendations);
      toast.success('AI analysis complete!');
    } catch {
      toast.error('Failed to analyze. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Class Management */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Class Management</CardTitle>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Paths: schools/folkstone_ps/classes/{'{classCode}'} • members/{'{uid}'} • roster/{'{studentId}'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Create classes, assign staff memberships, and upload classlists (CSV)
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create / Update Class */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Create / Update Class</h3>
              <Input
                placeholder="Class Code (e.g., 2F)"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                className="focus:ring-primary"
              />
              <Input
                placeholder="Class Name (optional)"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="focus:ring-primary"
              />
              <Button className="w-full" onClick={handleCreateClass}>
                Create / Save Class
              </Button>
              <p className="text-xs text-muted-foreground">
                Students will be assigned coded IDs based on the class code (e.g., 2F-1, 2F-2).
              </p>
            </div>

            {/* Memberships */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Memberships (Staff Access)</h3>
              <p className="text-sm text-muted-foreground">No classes yet</p>
              <div className="border border-border/50 rounded-lg p-3 space-y-2 bg-muted/20">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Roster</span>
                <div className="text-sm text-muted-foreground">Select a class</div>
              </div>
              <div className="border border-border/50 rounded-lg p-3 space-y-2 bg-muted/20">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Members</span>
                <div className="text-sm text-muted-foreground">Select a class</div>
              </div>
            </div>

            {/* Upload Classlist */}
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Upload Classlist (CSV)</h3>
              <p className="text-xs text-muted-foreground">
                CSV format: <code className="bg-muted px-1 rounded">Number, Initials</code> — Example: <code className="bg-muted px-1 rounded">1, JD</code> in class 2F → becomes <code className="bg-muted px-1 rounded">2F-1</code>
              </p>
              <p className="text-xs text-muted-foreground">
                The number will be prefixed with the selected class code to create the coded student ID.
              </p>
              <Input type="file" accept=".csv" className="text-sm focus:ring-primary" />
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
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Find staff (email search)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="type email or name..." 
                className="pl-8 focus:ring-primary"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
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

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Add/Update Staff Directory (one-time setup)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Staff UID</Label>
              <Input 
                placeholder="Paste staff Firebase UID"
                value={staffUid}
                onChange={(e) => setStaffUid(e.target.value)}
                className="focus:ring-primary"
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
            <h4 className="font-medium mt-4 text-foreground">Current members</h4>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
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
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle>School Monitor (Peel/ON)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <h3 className="font-semibold text-foreground">All Grades</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Students"
                value={totalStudents}
                icon={Users}
                variant="primary"
              />
              <StatCard
                title="Total Benchmarks"
                value={totalBenchmarks}
                icon={BarChart3}
                variant="default"
              />
              <StatCard
                title="At Risk (Data/Flag)"
                value={atRiskCount}
                icon={AlertTriangle}
                variant="destructive"
              />
              <StatCard
                title="Avg Data/Student"
                value={avgDataPerStudent}
                icon={Activity}
                variant="success"
              />
            </div>

            {/* School Risk Profile placeholder */}
            <div className="border border-border/50 rounded-lg p-4 bg-muted/20">
              <h4 className="font-medium mb-2 text-foreground">School Risk Profile</h4>
              <div className="h-20 bg-muted/50 rounded flex items-center justify-center text-muted-foreground">
                Chart visualization
              </div>
            </div>

            {/* Areas of Need */}
            <div className="border border-border/50 rounded-lg p-4 bg-muted/20">
              <h4 className="font-medium mb-2 text-foreground">Areas of Need</h4>
              <div className="text-muted-foreground text-sm">
                Analysis based on benchmark data will appear here.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grade & Teacher Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Grade Analytics & Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Grade</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>At Risk %</TableHead>
                  <TableHead>Stable %</TableHead>
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
                    <TableRow key={grade.grade} className="hover:bg-muted/30">
                      <TableCell className="font-medium">Grade {grade.grade}</TableCell>
                      <TableCell>{grade.students}</TableCell>
                      <TableCell>
                        <span className="text-destructive font-medium">{grade.atRiskPercent}%</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-success font-medium">{grade.stablePercent}%</span>
                      </TableCell>
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

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Teacher Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
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
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle>Tracked Students (At-Risk)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
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
                    <TableRow key={student.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{student.studentNumber}</TableCell>
                      <TableCell>{student.homeroom || '-'}</TableCell>
                      <TableCell>
                        <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">Manual flag</span>
                      </TableCell>
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

        <Card className="border-border/50 shadow-sm border-l-4 border-l-primary">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Strategy (Peel/ON)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger className="focus:ring-primary">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fi">French Immersion</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {isAnalyzing ? 'Analyzing...' : 'Analyze'}
              </Button>
            </div>
            <div className="border border-border/50 rounded-lg p-4 bg-muted/20">
              <h4 className="font-medium mb-2 text-foreground">Resource & Leadership Recommendations</h4>
              {aiRecommendations ? (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm text-foreground">
                  {aiRecommendations}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Run analysis to generate AI-powered recommendations.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
