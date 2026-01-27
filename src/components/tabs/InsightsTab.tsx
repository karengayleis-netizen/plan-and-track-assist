import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip, LineChart, Line } from 'recharts';
import { TrendingUp, Users, AlertTriangle, CheckCircle } from 'lucide-react';

export function InsightsTab() {
  const { students } = useStudents();
  const { benchmarks } = useBenchmarks();
  const [selectedStudent, setSelectedStudent] = useState('');

  // Summary stats
  const totalStudents = students.length;
  const atRiskCount = students.filter(s => s.isHighNeed).length;
  const focusCount = students.filter(s => s.isFocusStudent).length;
  const studentsWithData = students.filter(s => 
    benchmarks.some(b => b.studentId === s.id)
  ).length;

  // Calculate data count per student
  const dataCountByStudent = students.map(student => ({
    name: student.initials || student.studentNumber,
    count: benchmarks.filter(b => b.studentId === student.id).length
  })).filter(d => d.count > 0);

  // Calculate risk vs stable distribution
  const performanceData = students.map(student => {
    const studentBenchmarks = benchmarks.filter(b => b.studentId === student.id);
    const atRisk = studentBenchmarks.some(b => parseFloat(b.score) < 50) ? 1 : 0;
    return {
      name: student.initials || student.studentNumber,
      atRisk,
      stable: atRisk ? 0 : 1
    };
  });

  // Get selected student's benchmark trend
  const selectedStudentData = selectedStudent 
    ? benchmarks
        .filter(b => b.studentId === selectedStudent)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(b => ({
          date: new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          score: parseFloat(b.score),
          assessment: b.assessmentType
        }))
    : [];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{atRiskCount}</p>
                <p className="text-sm text-muted-foreground">High Need</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{focusCount}</p>
                <p className="text-sm text-muted-foreground">Focus Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{studentsWithData}</p>
                <p className="text-sm text-muted-foreground">With Data</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Data Points per Student</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {dataCountByStudent.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataCountByStudent}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="Data Points" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No benchmark data yet. Add benchmarks to see insights.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Class Performance Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {students.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="atRisk" stackId="a" fill="hsl(var(--destructive))" name="At Risk" />
                    <Bar dataKey="stable" stackId="a" fill="hsl(var(--primary))" name="Stable" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No students yet. Add students to see performance data.
                </div>
              )}
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
                Select a student to see their trend line and performance over time.
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
              <div className="h-[300px]">
                {selectedStudentData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedStudentData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                        name="Score"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No benchmark data for this student yet.
                  </div>
                )}
              </div>
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
