import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LineChart, Line, Area, AreaChart } from 'recharts';
import { Users, AlertTriangle, Target, CheckCircle } from 'lucide-react';
import { StatCard, InsightChart, chartColors, tooltipStyle, SectionHeader } from '@/components/dashboard';

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

  // Calculate percentages
  const atRiskPercent = totalStudents > 0 ? Math.round((atRiskCount / totalStudents) * 100) : 0;
  const withDataPercent = totalStudents > 0 ? Math.round((studentsWithData / totalStudents) * 100) : 0;

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

  const selectedStudentInfo = students.find(s => s.id === selectedStudent);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent rounded-xl p-6 border border-primary/10">
        <SectionHeader 
          title="School Overview"
          description={`Dashboard updated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={totalStudents}
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="High Need"
          value={atRiskCount}
          subtitle={`${atRiskPercent}%`}
          icon={AlertTriangle}
          variant="destructive"
        />
        <StatCard
          title="Focus Students"
          value={focusCount}
          icon={Target}
          variant="purple"
        />
        <StatCard
          title="With Data"
          value={studentsWithData}
          subtitle={`${withDataPercent}%`}
          icon={CheckCircle}
          variant="success"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightChart title="Data Points per Student" description="Benchmark records by student">
          {dataCountByStudent.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataCountByStudent} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...tooltipStyle} />
                <Bar 
                  dataKey="count" 
                  fill={chartColors.primary}
                  radius={[4, 4, 0, 0]}
                  name="Data Points" 
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No benchmark data yet. Add benchmarks to see insights.
            </div>
          )}
        </InsightChart>

        <InsightChart title="Class Performance Distribution" description="At-risk vs stable students">
          {students.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="atRisk" stackId="a" fill={chartColors.destructive} name="At Risk" radius={[0, 0, 0, 0]} />
                <Bar dataKey="stable" stackId="a" fill={chartColors.success} name="Stable" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No students yet. Add students to see performance data.
            </div>
          )}
        </InsightChart>
      </div>

      {/* Student Deep Dive */}
      <InsightChart 
        title="Student Deep Dive" 
        description="Select a student to see their trend line and performance over time."
        action={
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger className="w-[220px]">
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
        }
      >
        {selectedStudent ? (
          selectedStudentData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={selectedStudentData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis 
                  domain={[0, 100]} 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip {...tooltipStyle} />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke={chartColors.primary}
                  strokeWidth={2}
                  fill="url(#scoreGradient)"
                  name="Score"
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke={chartColors.primary}
                  strokeWidth={2}
                  dot={{ fill: chartColors.primary, strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, stroke: chartColors.primary, strokeWidth: 2, fill: 'white' }}
                  name="Score"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p>No benchmark data for {selectedStudentInfo?.studentNumber || 'this student'} yet.</p>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a student to view their detailed analytics.
          </div>
        )}
      </InsightChart>
    </div>
  );
}
