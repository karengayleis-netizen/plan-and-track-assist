import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LineChart, Line, Area, AreaChart, PieChart, Pie, Cell, Legend, ReferenceLine } from 'recharts';
import { Users, AlertTriangle, Target, CheckCircle, TrendingUp } from 'lucide-react';
import { StatCard, InsightChart, chartColors, tooltipStyle, SectionHeader } from '@/components/dashboard';
import { formatStudentDisplay } from '@/lib/studentDisplay';

const trendLineColors = [
  chartColors.primary,
  chartColors.success,
  chartColors.purple,
  chartColors.warning,
  chartColors.destructive,
  '#0ea5e9',
  '#64748b',
  '#f43f5e',
];

export function InsightsTab() {
  const { students } = useStudents();
  const { benchmarks } = useBenchmarks();
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState('all');

  // Summary stats
  const totalStudents = students.length;
  const atRiskCount = students.filter(s => s.isHighNeed).length;
  const focusCount = students.filter(s => s.isFocusStudent).length;
  const studentsWithData = students.filter(s =>
    benchmarks.some(b => b.studentId === s.id)
  ).length;

  const atRiskPercent = totalStudents > 0 ? Math.round((atRiskCount / totalStudents) * 100) : 0;
  const withDataPercent = totalStudents > 0 ? Math.round((studentsWithData / totalStudents) * 100) : 0;

  // Data count per student
  const dataCountByStudent = students.map(student => ({
    name: student.initials || student.studentNumber,
    count: benchmarks.filter(b => b.studentId === student.id).length
  })).filter(d => d.count > 0);

  // Risk distribution
  const performanceData = students.map(student => {
    const studentBenchmarks = benchmarks.filter(b => b.studentId === student.id);
    const atRisk = studentBenchmarks.some(b => parseFloat(b.score) < 50) ? 1 : 0;
    return {
      name: student.initials || student.studentNumber,
      atRisk,
      stable: atRisk ? 0 : 1
    };
  });

  // Gender distribution
  const genderData = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach(s => {
      const g = s.gender?.toUpperCase() || 'Unknown';
      counts[g] = (counts[g] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [students]);

  const genderColors = [chartColors.primary, chartColors.destructive, chartColors.purple, chartColors.warning];

  // Tag distribution
  const tagData = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach(s => {
      (s.tags || []).forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [students]);

  // Unique assessment types in data
  const assessmentTypes = useMemo(() => {
    const types = new Set<string>();
    benchmarks.forEach(b => { if (b.assessmentType) types.add(b.assessmentType); });
    return Array.from(types).sort();
  }, [benchmarks]);

  // ── CLASS-WIDE GROWTH TREND ──
  // Group benchmarks by month, compute class average score
  const classGrowthData = useMemo(() => {
    if (benchmarks.length === 0) return [];
    const byMonth: Record<string, number[]> = {};
    benchmarks.forEach(b => {
      const d = new Date(b.date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const score = b.percentage ?? parseFloat(b.score);
      if (!isNaN(score)) {
        (byMonth[key] ??= []).push(score);
      }
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, scores]) => {
        const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
        const d = new Date(month + '-01');
        return {
          month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          avg,
          count: scores.length,
        };
      });
  }, [benchmarks]);

  // Overall class average for reference line
  const classAverage = useMemo(() => {
    if (classGrowthData.length === 0) return 0;
    return Math.round(classGrowthData.reduce((s, d) => s + d.avg, 0) / classGrowthData.length);
  }, [classGrowthData]);

  // ── STUDENT DEEP DIVE (with assessment filter) ──
  const selectedStudentData = useMemo(() => {
    if (!selectedStudent) return [];
    return benchmarks
      .filter(b => b.studentId === selectedStudent && (selectedAssessment === 'all' || b.assessmentType === selectedAssessment))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(b => ({
        date: new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: b.percentage ?? parseFloat(b.score),
        assessment: b.assessmentType
      }));
  }, [selectedStudent, selectedAssessment, benchmarks]);

  const selectedStudentInfo = students.find(s => s.id === selectedStudent);

  // ── FOCUS STUDENT COMPARISON ──
  // Show trend lines for all focus students overlaid
  const focusStudentTrends = useMemo(() => {
    const focusStudents = students.filter(s => s.isFocusStudent);
    if (focusStudents.length === 0) return { data: [], studentNames: [] };

    // Collect all unique months
    const allMonths = new Set<string>();
    const studentData: Record<string, Record<string, number>> = {};

    focusStudents.forEach(student => {
      const key = student.initials || student.studentNumber;
      studentData[key] = {};
      benchmarks
        .filter(b => b.studentId === student.id)
        .forEach(b => {
          const d = new Date(b.date);
          if (isNaN(d.getTime())) return;
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          allMonths.add(monthKey);
          const score = b.percentage ?? parseFloat(b.score);
          if (!isNaN(score)) {
            // Average if multiple in same month
            studentData[key][monthKey] = studentData[key][monthKey]
              ? Math.round((studentData[key][monthKey] + score) / 2)
              : score;
          }
        });
    });

    const sortedMonths = Array.from(allMonths).sort();
    const studentNames = Object.keys(studentData);

    const data = sortedMonths.map(month => {
      const d = new Date(month + '-01');
      const point: Record<string, string | number | null> = {
        month: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      };
      studentNames.forEach(name => {
        point[name] = studentData[name][month] ?? null;
      });
      return point;
    });

    return { data, studentNames };
  }, [students, benchmarks]);

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
        <StatCard title="Total Students" value={totalStudents} icon={Users} variant="primary" />
        <StatCard title="High Need" value={atRiskCount} subtitle={`${atRiskPercent}%`} icon={AlertTriangle} variant="destructive" />
        <StatCard title="Focus Students" value={focusCount} icon={Target} variant="purple" />
        <StatCard title="With Data" value={studentsWithData} subtitle={`${withDataPercent}%`} icon={CheckCircle} variant="success" />
      </div>

      {/* ── CLASS GROWTH TREND ── */}
      <InsightChart
        title="Class Growth Trend"
        description="Average benchmark score over time — shows whether the class is trending up."
        action={
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Avg: {classAverage}%</span>
          </div>
        }
      >
        {classGrowthData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={classGrowthData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="classGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.success} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={chartColors.success} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => name === 'avg' ? [`${value}%`, 'Class Avg'] : [value, name]} />
              <ReferenceLine y={classAverage} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: `Avg ${classAverage}%`, position: 'right', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Area type="monotone" dataKey="avg" stroke={chartColors.success} strokeWidth={2.5} fill="url(#classGrowthGrad)" name="avg" />
              <Line type="monotone" dataKey="avg" stroke={chartColors.success} strokeWidth={2.5} dot={{ fill: chartColors.success, strokeWidth: 0, r: 4 }} activeDot={{ r: 6, stroke: chartColors.success, strokeWidth: 2, fill: 'white' }} name="avg" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {classGrowthData.length === 1
              ? 'Need benchmarks across multiple months to show a trend.'
              : 'No benchmark data yet. Import benchmarks to see class growth.'}
          </div>
        )}
      </InsightChart>

      {/* ── FOCUS STUDENT COMPARISON ── */}
      {focusStudentTrends.studentNames.length > 0 && focusStudentTrends.data.length > 1 && (
        <InsightChart
          title="Focus Student Comparison"
          description="Trend lines for each focus student — compare growth side by side."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={focusStudentTrends.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {focusStudentTrends.studentNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={trendLineColors[i % trendLineColors.length]}
                  strokeWidth={2}
                  dot={{ fill: trendLineColors[i % trendLineColors.length], strokeWidth: 0, r: 3 }}
                  activeDot={{ r: 5, strokeWidth: 2, fill: 'white' }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </InsightChart>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InsightChart title="Data Points per Student" description="Benchmark records by student">
          {dataCountByStudent.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataCountByStudent} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill={chartColors.primary} radius={[4, 4, 0, 0]} name="Data Points" />
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
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
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

        <InsightChart title="Gender Distribution" description="Student breakdown by gender">
          {genderData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {genderData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={genderColors[index % genderColors.length]} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No gender data available yet.
            </div>
          )}
        </InsightChart>
      </div>

      {/* Tag Distribution */}
      {tagData.length > 0 && (
        <InsightChart title="Tag Distribution" description="Students by assigned tags">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tagData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={120} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" name="Students" fill={chartColors.primary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </InsightChart>
      )}

      {/* Student Deep Dive — with assessment filter */}
      <InsightChart
        title="Student Deep Dive"
        description="Select a student and optionally filter by assessment type to see growth over time."
        action={
          <div className="flex items-center gap-2">
            <Select value={selectedAssessment} onValueChange={setSelectedAssessment}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Assessments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assessments</SelectItem>
                {assessmentTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="-- Choose Student --" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    {formatStudentDisplay(student)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {selectedStudent ? (
          selectedStudentData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={selectedStudentData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="score" stroke={chartColors.primary} strokeWidth={2} fill="url(#scoreGradient)" name="Score" />
                <Line type="monotone" dataKey="score" stroke={chartColors.primary} strokeWidth={2} dot={{ fill: chartColors.primary, strokeWidth: 0, r: 4 }} activeDot={{ r: 6, stroke: chartColors.primary, strokeWidth: 2, fill: 'white' }} name="Score" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p>No benchmark data for {selectedStudentInfo?.studentNumber || 'this student'}{selectedAssessment !== 'all' ? ` (${selectedAssessment})` : ''} yet.</p>
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
