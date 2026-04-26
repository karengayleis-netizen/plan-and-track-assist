import { useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { useClasses } from '@/hooks/useClasses';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LineChart, Line, Area, AreaChart, PieChart, Pie, Cell, Legend, ReferenceLine } from 'recharts';
import { Users, AlertTriangle, Target, CheckCircle, TrendingUp, Filter } from 'lucide-react';
import { StatCard, InsightChart, chartColors, tooltipStyle, SectionHeader } from '@/components/dashboard';
import { formatStudentDisplay } from '@/lib/studentDisplay';
import { getStudentRiskLevel, RISK_LABEL } from '@/lib/studentRisk';
import { formatGradeDisplay } from '@/types/homeroom';

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
  const { classes } = useClasses();

  // ── FILTERS ──
  const [gradeFilter, setGradeFilter] = useState('all');
  const [homeroomFilter, setHomeroomFilter] = useState('all');
  const [measureFilter, setMeasureFilter] = useState<string>('auto');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [deepDiveAssessment, setDeepDiveAssessment] = useState('auto');

  // Apply student-level filters
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (gradeFilter !== 'all' && String(s.grade) !== gradeFilter) return false;
      if (homeroomFilter !== 'all' && s.homeroom !== homeroomFilter) return false;
      return true;
    });
  }, [students, gradeFilter, homeroomFilter]);

  const filteredStudentIds = useMemo(() => new Set(filteredStudents.map(s => s.id)), [filteredStudents]);

  const filteredBenchmarks = useMemo(
    () => benchmarks.filter(b => filteredStudentIds.has(b.studentId)),
    [benchmarks, filteredStudentIds]
  );

  // Available grades / homerooms (always show all so admins can drill in)
  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => s.grade && set.add(String(s.grade)));
    return Array.from(set).sort((a, b) => {
      const an = a === 'K' ? 0 : Number(a);
      const bn = b === 'K' ? 0 : Number(b);
      return an - bn;
    });
  }, [students]);

  const availableHomerooms = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => s.homeroom && set.add(s.homeroom));
    classes.forEach(c => c.code && set.add(c.code));
    return Array.from(set).sort();
  }, [students, classes]);

  // Summary stats — driven by filtered set
  const totalStudents = filteredStudents.length;
  const atRiskCount = filteredStudents.filter(s => {
    const lvl = getStudentRiskLevel(s, filteredBenchmarks);
    return lvl === 'well-below' || lvl === 'below';
  }).length;
  const focusCount = filteredStudents.filter(s => s.isFocusStudent).length;
  const studentsWithData = filteredStudents.filter(s =>
    filteredBenchmarks.some(b => b.studentId === s.id)
  ).length;

  const atRiskPercent = totalStudents > 0 ? Math.round((atRiskCount / totalStudents) * 100) : 0;
  const withDataPercent = totalStudents > 0 ? Math.round((studentsWithData / totalStudents) * 100) : 0;

  // Data count per student
  const dataCountByStudent = filteredStudents.map(student => ({
    name: student.initials || student.studentNumber,
    count: filteredBenchmarks.filter(b => b.studentId === student.id).length
  })).filter(d => d.count > 0);

  // Risk distribution (replaces old "atRisk if score<50" which was meaningless for raw scores)
  const performanceData = filteredStudents
    .map(student => {
      const lvl = getStudentRiskLevel(student, filteredBenchmarks);
      return {
        name: student.initials || student.studentNumber,
        atRisk: lvl === 'well-below' || lvl === 'below' ? 1 : 0,
        stable: lvl === 'at-or-above' || lvl === 'well-above' ? 1 : 0,
      };
    })
    .filter(p => p.atRisk + p.stable > 0);

  // Gender distribution
  const genderData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredStudents.forEach(s => {
      const g = s.gender?.toUpperCase() || 'Unknown';
      counts[g] = (counts[g] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredStudents]);

  const genderColors = [chartColors.primary, chartColors.destructive, chartColors.purple, chartColors.warning];

  // Tag distribution
  const tagData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredStudents.forEach(s => {
      (s.tags || []).forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredStudents]);

  // Unique measures (assessmentTypes) in filtered data, with counts
  const measures = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredBenchmarks.forEach(b => {
      const t = b.assessmentType || b.assessmentName;
      if (t) counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [filteredBenchmarks]);

  // Effective measure: explicit pick > Composite if present > most common
  const effectiveMeasure = useMemo(() => {
    if (measureFilter !== 'auto') return measureFilter;
    const composite = measures.find(m => /composite/i.test(m.name));
    if (composite) return composite.name;
    return measures[0]?.name || '';
  }, [measureFilter, measures]);

  // ── CLASS-WIDE GROWTH TREND (measure-aware, raw score) ──
  const classGrowthData = useMemo(() => {
    if (filteredBenchmarks.length === 0 || !effectiveMeasure) return [];
    const measureRows = filteredBenchmarks.filter(
      b => (b.assessmentType || b.assessmentName) === effectiveMeasure
    );
    const byKey: Record<string, { sum: number; n: number; sortKey: string }> = {};
    measureRows.forEach(b => {
      const d = new Date(b.date);
      if (isNaN(d.getTime())) return;
      const score = parseFloat(b.score);
      if (isNaN(score)) return;
      // Prefer benchmark window (BOY/MOY/EOY) when present, otherwise group by month.
      const win = (b.benchmarkWindow || b.term || '').trim();
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = win || d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const sortKey = win ? `${d.getFullYear()}-${win}` : monthKey;
      const bucket = byKey[label] ??= { sum: 0, n: 0, sortKey };
      bucket.sum += score;
      bucket.n += 1;
      if (sortKey < bucket.sortKey) bucket.sortKey = sortKey;
    });
    return Object.entries(byKey)
      .sort(([, a], [, b]) => a.sortKey.localeCompare(b.sortKey))
      .map(([label, { sum, n }]) => ({
        period: label,
        avg: Math.round((sum / n) * 10) / 10,
        count: n,
      }));
  }, [filteredBenchmarks, effectiveMeasure]);

  const classAverage = useMemo(() => {
    if (classGrowthData.length === 0) return 0;
    return Math.round(classGrowthData.reduce((s, d) => s + d.avg, 0) / classGrowthData.length);
  }, [classGrowthData]);

  // ── STUDENT DEEP DIVE ──
  // Default the assessment filter to Composite for the picked student if available.
  const studentMeasures = useMemo(() => {
    if (!selectedStudent) return [];
    const set = new Set<string>();
    benchmarks.forEach(b => {
      if (b.studentId === selectedStudent) {
        const t = b.assessmentType || b.assessmentName;
        if (t) set.add(t);
      }
    });
    return Array.from(set).sort();
  }, [selectedStudent, benchmarks]);

  const effectiveDeepDiveAssessment = useMemo(() => {
    if (deepDiveAssessment !== 'auto') return deepDiveAssessment;
    const composite = studentMeasures.find(m => /composite/i.test(m));
    return composite || studentMeasures[0] || '';
  }, [deepDiveAssessment, studentMeasures]);

  const selectedStudentData = useMemo(() => {
    if (!selectedStudent) return [];
    return benchmarks
      .filter(b => b.studentId === selectedStudent && (!effectiveDeepDiveAssessment || (b.assessmentType || b.assessmentName) === effectiveDeepDiveAssessment))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(b => ({
        date: new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }),
        score: parseFloat(b.score),
        assessment: b.assessmentType || b.assessmentName,
        scoreLabel: b.scoreLabel || '',
      }))
      .filter(d => !isNaN(d.score));
  }, [selectedStudent, effectiveDeepDiveAssessment, benchmarks]);

  const selectedStudentInfo = students.find(s => s.id === selectedStudent);

  // Sorted student picker — by homeroom then initials so K-2 cluster together.
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const hr = (a.homeroom || '').localeCompare(b.homeroom || '');
      if (hr !== 0) return hr;
      return (a.initials || a.studentNumber).localeCompare(b.initials || b.studentNumber);
    });
  }, [students]);

  // ── FOCUS STUDENT COMPARISON (uses effective measure for fair compare) ──
  const focusStudentTrends = useMemo(() => {
    const focusStudents = filteredStudents.filter(s => s.isFocusStudent);
    if (focusStudents.length === 0 || !effectiveMeasure) return { data: [], studentNames: [] };

    const allKeys = new Set<string>();
    const studentData: Record<string, Record<string, number>> = {};

    focusStudents.forEach(student => {
      const key = student.initials || student.studentNumber;
      studentData[key] = {};
      benchmarks
        .filter(b => b.studentId === student.id && (b.assessmentType || b.assessmentName) === effectiveMeasure)
        .forEach(b => {
          const d = new Date(b.date);
          if (isNaN(d.getTime())) return;
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          allKeys.add(monthKey);
          const score = parseFloat(b.score);
          if (!isNaN(score)) {
            studentData[key][monthKey] = studentData[key][monthKey]
              ? Math.round((studentData[key][monthKey] + score) / 2)
              : score;
          }
        });
    });

    const sortedKeys = Array.from(allKeys).sort();
    const studentNames = Object.keys(studentData);
    const data = sortedKeys.map(month => {
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
  }, [filteredStudents, benchmarks, effectiveMeasure]);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent rounded-xl p-6 border border-primary/10">
        <SectionHeader
          title="School Overview"
          description={`Dashboard updated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`}
        />
      </div>

      {/* ── FILTER BAR ── */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/30">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filter:
        </div>
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {availableGrades.map(g => (
              <SelectItem key={g} value={g}>
                {g === 'K' ? 'Kindergarten' : `Grade ${g}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={homeroomFilter} onValueChange={setHomeroomFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Homerooms</SelectItem>
            {availableHomerooms.map(h => (
              <SelectItem key={h} value={h}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(gradeFilter !== 'all' || homeroomFilter !== 'all') && (
          <button
            onClick={() => { setGradeFilter('all'); setHomeroomFilter('all'); }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear filters
          </button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          Showing <strong className="text-foreground">{filteredStudents.length}</strong> students · <strong className="text-foreground">{filteredBenchmarks.length}</strong> benchmarks
        </div>
      </div>

      {/* ── Diagnostic Card (temporary) ── */}
      <div className="border border-dashed border-amber-400/60 rounded-lg p-4 bg-amber-50/40 dark:bg-amber-950/20 text-xs">
        <div className="font-medium text-amber-800 dark:text-amber-300 mb-2">🔍 Diagnostic (temporary)</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 font-mono">
          <div>Benchmark docs loaded: <strong>{benchmarks.length}</strong></div>
          <div>Unique students with benchmarks: <strong>{new Set(benchmarks.map(b => b.studentId)).size}</strong></div>
          <div>Reading: <strong>{(gradeFilter !== 'all' || homeroomFilter !== 'all' || measureFilter !== 'auto') ? 'FILTERED' : 'WHOLE SCHOOL'}</strong></div>
          <div>In view — students: <strong>{filteredStudents.length}</strong></div>
          <div>In view — benchmarks: <strong>{filteredBenchmarks.length}</strong></div>
          <div>Filters: g=<strong>{gradeFilter}</strong> hr=<strong>{homeroomFilter}</strong> m=<strong>{measureFilter}</strong></div>
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-amber-800 dark:text-amber-300">First 5 benchmark records</summary>
          <pre className="mt-2 p-2 bg-background/80 rounded overflow-x-auto text-[10px] leading-tight">
{JSON.stringify(benchmarks.slice(0, 5).map(b => ({
  studentId: b.studentId,
  measure: b.assessmentType || b.assessmentName,
  score: b.score,
  scoreLabel: b.scoreLabel,
  window: b.benchmarkWindow || b.term,
  date: b.date instanceof Date ? b.date.toISOString().slice(0,10) : String(b.date),
})), null, 2)}
          </pre>
        </details>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={totalStudents} icon={Users} variant="primary" />
        <StatCard title="At Risk" value={atRiskCount} subtitle={`${atRiskPercent}% (Acadience)`} icon={AlertTriangle} variant="destructive" />
        <StatCard title="Focus Students" value={focusCount} icon={Target} variant="purple" />
        <StatCard title="With Data" value={studentsWithData} subtitle={`${withDataPercent}%`} icon={CheckCircle} variant="success" />
      </div>

      {/* ── CLASS GROWTH TREND ── */}
      <InsightChart
        title="Class Growth Trend"
        description={effectiveMeasure
          ? `Average raw score for ${effectiveMeasure} over time. Use the dropdown to switch measures.`
          : 'Import benchmarks to see growth.'}
        action={
          <div className="flex items-center gap-2">
            <Select value={measureFilter} onValueChange={setMeasureFilter}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Measure" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Composite)</SelectItem>
                {measures.map(m => (
                  <SelectItem key={m.name} value={m.name}>
                    {m.name} ({m.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {classAverage > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Avg: {classAverage}</span>
              </div>
            )}
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
              <XAxis dataKey="period" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => name === 'avg' ? [`${value}`, `Avg ${effectiveMeasure}`] : [value, name]} />
              {classAverage > 0 && (
                <ReferenceLine y={classAverage} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: `Avg ${classAverage}`, position: 'right', fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              )}
              <Area type="monotone" dataKey="avg" stroke={chartColors.success} strokeWidth={2.5} fill="url(#classGrowthGrad)" name="avg" />
              <Line type="monotone" dataKey="avg" stroke={chartColors.success} strokeWidth={2.5} dot={{ fill: chartColors.success, strokeWidth: 0, r: 4 }} activeDot={{ r: 6, stroke: chartColors.success, strokeWidth: 2, fill: 'white' }} name="avg" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-center px-6">
            {!effectiveMeasure
              ? 'No benchmark data in current filter. Import benchmarks or clear filters.'
              : classGrowthData.length === 1
                ? `Only one assessment window for ${effectiveMeasure} so far — need a second window (e.g. MOY) to plot a trend.`
                : `No data for ${effectiveMeasure} in current filter.`}
          </div>
        )}
      </InsightChart>

      {/* ── FOCUS STUDENT COMPARISON ── */}
      {focusStudentTrends.studentNames.length > 0 && focusStudentTrends.data.length > 1 && (
        <InsightChart
          title="Focus Student Comparison"
          description={`${effectiveMeasure} — trend lines for each focus student.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={focusStudentTrends.data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
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
              No benchmark data in current filter.
            </div>
          )}
        </InsightChart>

        <InsightChart title="Class Performance Distribution" description="At-risk vs stable (Acadience scoreLabel)">
          {performanceData.length > 0 ? (
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
              No risk data in current filter (need Acadience Status / scoreLabel).
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
              No gender data available.
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

      {/* Student Deep Dive */}
      <InsightChart
        title="Student Deep Dive"
        description={selectedStudentInfo
          ? `${formatStudentDisplay(selectedStudentInfo)} — grade ${selectedStudentInfo.grade ? formatGradeDisplay(Number(selectedStudentInfo.grade) || 0) : '—'}${effectiveDeepDiveAssessment ? ` · ${effectiveDeepDiveAssessment}` : ''}`
          : 'Pick a student. Sorted by homeroom so K–2 cluster together.'}
        action={
          <div className="flex items-center gap-2">
            <Select value={deepDiveAssessment} onValueChange={setDeepDiveAssessment} disabled={!selectedStudent}>
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue placeholder="Auto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Composite)</SelectItem>
                {studentMeasures.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStudent} onValueChange={(v) => { setSelectedStudent(v); setDeepDiveAssessment('auto'); }}>
              <SelectTrigger className="w-[240px] h-9">
                <SelectValue placeholder="-- Choose Student --" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {sortedStudents.map(student => (
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
            <div className="h-full flex flex-col">
              {selectedStudentInfo && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    Risk: {RISK_LABEL[getStudentRiskLevel(selectedStudentInfo, benchmarks)]}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {selectedStudentData.length} data point{selectedStudentData.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
              <div className="flex-1">
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
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value: number, _name: string, props: { payload?: { scoreLabel?: string } }) => {
                        const lbl = props.payload?.scoreLabel;
                        return lbl ? [`${value} (${lbl})`, 'Score'] : [value, 'Score'];
                      }}
                    />
                    <Area type="monotone" dataKey="score" stroke={chartColors.primary} strokeWidth={2} fill="url(#scoreGradient)" name="Score" />
                    <Line type="monotone" dataKey="score" stroke={chartColors.primary} strokeWidth={2} dot={{ fill: chartColors.primary, strokeWidth: 0, r: 4 }} activeDot={{ r: 6, stroke: chartColors.primary, strokeWidth: 2, fill: 'white' }} name="Score" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center px-6">
              <p>No {effectiveDeepDiveAssessment || 'benchmark'} data for {selectedStudentInfo ? formatStudentDisplay(selectedStudentInfo) : 'this student'} yet.</p>
              {studentMeasures.length > 0 && (
                <p className="text-xs mt-2">Available measures: {studentMeasures.join(', ')}</p>
              )}
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
