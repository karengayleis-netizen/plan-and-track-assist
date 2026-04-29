import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Users, Database, AlertTriangle, TrendingUp, Activity, Heart, FileWarning, Layers, Download, Filter, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { useMarkbook } from '@/hooks/useMarkbook';
import { StatCard } from '@/components/dashboard';
import { Heatmap, type HeatmapCell, type HeatmapMode } from './Heatmap';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Info } from 'lucide-react';

const MEASURE_GLOSSARY: Record<string, string> = {
  'FSF': 'First Sound Fluency — initial phoneme of a spoken word (Kindergarten, BOY/MOY)',
  'LNF': 'Letter Naming Fluency — letters named per minute (K–1, indicator only)',
  'PSF': 'Phoneme Segmentation Fluency — segmenting spoken words into sounds (K MOY → 1 MOY)',
  'NWF-CLS': 'Nonsense Word Fluency · Correct Letter Sounds — sound-by-sound decoding (K EOY → 2)',
  'NWF-WWR': 'Nonsense Word Fluency · Whole Words Read — blended whole-word decoding (1–2)',
  'ORF': 'Oral Reading Fluency — words correct per minute on grade-level passage (1 MOY → 6)',
  'Composite': 'Acadience Composite Score — overall risk indicator combining the grade/window sub-measures',
};
import { formatStudentDisplay } from '@/lib/studentDisplay';
import { RISK_LABEL, type RiskLevel } from '@/lib/studentRisk';
import {
  STANDARD_MEASURES,
  enrich,
  latestPerStudent,
  latestPerStudentMeasure,
  multipleBelowMeasures,
  bandPctsFromRisks,
  pct,
  isGenderRecorded,
  genderBucket,
  applyStudentFilters,
  inferWindow,
  DEFAULT_FILTERS,
  type FilterState,
  type WindowKey,
} from '@/lib/leadershipMetrics';
import { downloadCSV } from '@/lib/leadershipExport';
import { toast } from 'sonner';

const BAND_BADGE: Record<RiskLevel, string> = {
  'well-below': 'bg-destructive/15 text-destructive border-destructive/30',
  'below': 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400',
  'approaching': 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30 dark:text-yellow-400',
  'at-or-above': 'bg-green-500/15 text-green-700 border-green-500/30 dark:text-green-400',
  'well-above': 'bg-primary/15 text-primary border-primary/30',
  'unknown': 'bg-muted text-muted-foreground border-border',
};

export function LeadershipDashboard() {
  const { students } = useStudents();
  const { benchmarks } = useBenchmarks();
  const { entries: markbookEntries } = useMarkbook();

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const update = <K extends keyof FilterState>(k: K, v: FilterState[K]) => setFilters(p => ({ ...p, [k]: v }));
  const reset = () => setFilters(DEFAULT_FILTERS);

  // Active roster (gender card uses this regardless of filters)
  const activeStudents = useMemo(() => students.filter(s => s.active !== false), [students]);

  // Available filter values
  const grades = useMemo(() => Array.from(new Set(activeStudents.map(s => String(s.grade)).filter(Boolean))).sort(), [activeStudents]);
  const homerooms = useMemo(() => Array.from(new Set(activeStudents.map(s => s.homeroom).filter(Boolean))).sort(), [activeStudents]);

  const enriched = useMemo(() => enrich(benchmarks), [benchmarks]);
  const measuresPresent = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach(e => set.add(e.measure));
    const standard: string[] = STANDARD_MEASURES.filter(m => set.has(m));
    const extra: string[] = Array.from(set).filter(m => !STANDARD_MEASURES.includes(m as never)).sort();
    return [...standard, ...extra];
  }, [enriched]);

  // Apply student-level filters
  const studentsBase = useMemo(() => applyStudentFilters(activeStudents, filters), [activeStudents, filters]);
  const studentIdSet = useMemo(() => new Set(studentsBase.map(s => s.id)), [studentsBase]);

  // Benchmarks scoped to filtered students + window + measure
  const scopedBenchmarks = useMemo(() => enriched.filter(e => {
    if (!studentIdSet.has(e.b.studentId)) return false;
    if (filters.window !== 'all' && e.window !== filters.window) return false;
    if (filters.measure !== 'all' && e.measure !== filters.measure) return false;
    return true;
  }), [enriched, studentIdSet, filters.window, filters.measure]);

  // Latest per student in scope (for risk classification)
  const latestByStudent = useMemo(
    () => latestPerStudent(scopedBenchmarks, 'all', 'all'),
    [scopedBenchmarks]
  );

  // Compute per-student risk in scope
  const studentRisk = useMemo(() => {
    const m = new Map<string, RiskLevel>();
    studentsBase.forEach(s => {
      if (s.isHighNeed) { m.set(s.id, 'well-below'); return; }
      const e = latestByStudent.get(s.id);
      m.set(s.id, e ? e.risk : 'unknown');
    });
    return m;
  }, [studentsBase, latestByStudent]);

  // Apply band + noData filters to produce final visible students
  const visibleStudents = useMemo(() => studentsBase.filter(s => {
    const has = latestByStudent.has(s.id);
    if (filters.noDataOnly && has) return false;
    if (filters.band !== 'all') {
      const r = studentRisk.get(s.id);
      if (filters.band === 'below') {
        if (r !== 'below' && r !== 'well-below') return false;
      } else if (r !== filters.band) return false;
    }
    return true;
  }), [studentsBase, latestByStudent, studentRisk, filters.band, filters.noDataOnly]);

  // KPIs
  const totalActive = visibleStudents.length;
  const assessedIds = new Set(scopedBenchmarks.map(e => e.b.studentId).filter(id => visibleStudents.some(s => s.id === id)));
  const withData = assessedIds.size;
  const missing = totalActive - withData;

  const visibleRisks: RiskLevel[] = visibleStudents
    .map(s => studentRisk.get(s.id) ?? 'unknown')
    .filter(r => r !== 'unknown');
  const bands = bandPctsFromRisks(visibleRisks);
  const pctAtAbove = pct(bands.atOrAbove, bands.total);
  const pctNear = pct(bands.near, bands.total);
  const pctBelow = pct(bands.below, bands.total);

  const highNeed = visibleStudents.filter(s => s.isHighNeed).length;
  const multiBelow = visibleStudents.filter(s => multipleBelowMeasures(s.id, scopedBenchmarks) >= 2).length;

  // Markbook recency for "no recent evidence"
  const recentMarkbookByStudent = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const set = new Set<string>();
    (markbookEntries ?? []).forEach(m => {
      const t = m.date ? new Date(m.date).getTime() : 0;
      if (t >= cutoff) set.add(m.studentId);
    });
    return set;
  }, [markbookEntries]);

  // Gender completeness (whole active roster, ignores filters)
  const genderStats = useMemo(() => {
    const stats = { recorded: 0, total: activeStudents.length, M: 0, F: 0, X: 0, Unknown: 0 };
    activeStudents.forEach(s => {
      const b = genderBucket(s.gender);
      stats[b]++;
      if (isGenderRecorded(s.gender)) stats.recorded++;
    });
    return stats;
  }, [activeStudents]);

  // Heatmaps — % below+well-below per (group, measure), using latest per (student, measure) within window scope.
  const buildHeatmap = (
    groupKeys: string[],
    groupOf: (studentId: string) => string | undefined
  ): HeatmapCell[][] => {
    const latest = latestPerStudentMeasure(
      enriched.filter(e => studentIdSet.has(e.b.studentId)),
      filters.window
    );
    const cols = STANDARD_MEASURES.filter(m => measuresPresent.includes(m));
    return groupKeys.map(g => {
      return cols.map(measure => {
        let total = 0, below = 0;
        for (const s of studentsBase) {
          if (groupOf(s.id) !== g) continue;
          const e = latest.get(`${s.id}|${measure}`);
          if (!e) continue;
          total++;
          if (e.risk === 'below' || e.risk === 'well-below') below++;
        }
        return { value: total > 0 ? pct(below, total) : null, count: total } as HeatmapCell;
      });
    });
  };

  const heatmapMeasureCols = useMemo(
    () => STANDARD_MEASURES.filter(m => measuresPresent.includes(m)) as string[],
    [measuresPresent]
  );

  const studentToGrade = useMemo(() => {
    const m = new Map<string, string>();
    studentsBase.forEach(s => m.set(s.id, String(s.grade)));
    return m;
  }, [studentsBase]);
  const studentToHomeroom = useMemo(() => {
    const m = new Map<string, string>();
    studentsBase.forEach(s => m.set(s.id, s.homeroom));
    return m;
  }, [studentsBase]);

  const presentGrades = useMemo(() => Array.from(new Set(studentsBase.map(s => String(s.grade)))).sort(), [studentsBase]);
  const presentHomerooms = useMemo(() => Array.from(new Set(studentsBase.map(s => s.homeroom))).sort(), [studentsBase]);

  const gradeHeatmap = useMemo(
    () => buildHeatmap(presentGrades, id => studentToGrade.get(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presentGrades, studentToGrade, enriched, studentIdSet, filters.window, measuresPresent, studentsBase]
  );
  const homeroomHeatmap = useMemo(
    () => buildHeatmap(presentHomerooms, id => studentToHomeroom.get(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [presentHomerooms, studentToHomeroom, enriched, studentIdSet, filters.window, measuresPresent, studentsBase]
  );

  // Leadership lists
  const wellBelowList = visibleStudents.filter(s => studentRisk.get(s.id) === 'well-below');
  const belowList = visibleStudents.filter(s => studentRisk.get(s.id) === 'below');
  const noDataList = visibleStudents.filter(s => !latestByStudent.has(s.id));
  const multiBelowList = visibleStudents
    .map(s => ({ s, n: multipleBelowMeasures(s.id, scopedBenchmarks) }))
    .filter(x => x.n >= 2)
    .sort((a, b) => b.n - a.n);
  const highNeedList = visibleStudents.filter(s => s.isHighNeed);
  const highNeedNoEvidence = highNeedList.filter(s => !recentMarkbookByStudent.has(s.id));

  // ── Data Meeting view (independent inputs) ──
  const [dmGrade, setDmGrade] = useState<string>('all');
  const [dmHomeroom, setDmHomeroom] = useState<string>('all');
  const [dmMeasure, setDmMeasure] = useState<string>('Composite');
  const [dmWindow, setDmWindow] = useState<WindowKey | 'all'>(() => {
    const wins = new Set<WindowKey>();
    benchmarks.forEach(b => { const w = inferWindow(b); if (w !== 'unknown') wins.add(w); });
    if (wins.has('EOY')) return 'EOY';
    if (wins.has('MOY')) return 'MOY';
    if (wins.has('BOY')) return 'BOY';
    return 'all';
  });
  const [dmOpen, setDmOpen] = useState(false);

  const dmStudents = useMemo(() => activeStudents.filter(s => {
    if (dmGrade !== 'all' && String(s.grade) !== dmGrade) return false;
    if (dmHomeroom !== 'all' && s.homeroom !== dmHomeroom) return false;
    return true;
  }), [activeStudents, dmGrade, dmHomeroom]);

  const dmRows = useMemo(() => {
    const ids = new Set(dmStudents.map(s => s.id));
    const latest = latestPerStudentMeasure(
      enriched.filter(e => ids.has(e.b.studentId) && e.measure === dmMeasure),
      dmWindow
    );
    return dmStudents.map(s => {
      const e = latest.get(`${s.id}|${dmMeasure}`);
      const risk: RiskLevel = s.isHighNeed ? 'well-below' : (e?.risk ?? 'unknown');
      return { s, e, risk };
    }).filter(r => r.risk === 'well-below' || r.risk === 'below' || r.risk === 'approaching');
  }, [dmStudents, enriched, dmMeasure, dmWindow]);

  const dmGroupings = useMemo(() => ({
    'well-below': dmRows.filter(r => r.risk === 'well-below'),
    'below': dmRows.filter(r => r.risk === 'below'),
    'approaching': dmRows.filter(r => r.risk === 'approaching'),
  }), [dmRows]);

  const handleExport = () => {
    if (dmRows.length === 0) { toast.error('No rows to export.'); return; }
    const rows = dmRows.map(({ s, e, risk }) => ({
      studentNumber: s.studentNumber,
      initials: s.initials,
      homeroom: s.homeroom,
      grade: s.grade,
      measure: dmMeasure,
      window: dmWindow,
      score: e?.b.rawScore ?? e?.b.score ?? '',
      scoreLabel: e?.b.scoreLabel ?? '',
      statusBand: RISK_LABEL[risk],
      date: e?.b.date ? new Date(e.b.date).toISOString().slice(0, 10) : '',
    }));
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(`data-meeting_${dmMeasure}_${dmWindow}_${date}.csv`, rows);
    toast.success(`Exported ${rows.length} rows.`);
  };

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Filter className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Leadership Dashboard</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Whole-school view. Filters compose — defaults show all active students.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">Grade</Label>
              <Select value={filters.grade} onValueChange={v => update('grade', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All grades</SelectItem>
                  {grades.map(g => <SelectItem key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Homeroom</Label>
              <Select value={filters.homeroom} onValueChange={v => update('homeroom', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All homerooms</SelectItem>
                  {homerooms.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Gender (admin)</Label>
              <Select value={filters.gender} onValueChange={v => update('gender', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="M">M</SelectItem>
                  <SelectItem value="F">F</SelectItem>
                  <SelectItem value="X">X / Other</SelectItem>
                  <SelectItem value="Unknown">Unknown / Not recorded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Window</Label>
              <Select value={filters.window} onValueChange={v => update('window', v as WindowKey | 'all')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All windows</SelectItem>
                  <SelectItem value="BOY">Beginning (BOY)</SelectItem>
                  <SelectItem value="MOY">Middle (MOY)</SelectItem>
                  <SelectItem value="EOY">End (EOY)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Measure</Label>
              <Select value={filters.measure} onValueChange={v => update('measure', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All measures</SelectItem>
                  {measuresPresent.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status band</Label>
              <Select value={filters.band} onValueChange={v => update('band', v as FilterState['band'])}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All bands</SelectItem>
                  <SelectItem value="at-or-above">Above / At</SelectItem>
                  <SelectItem value="approaching">Near</SelectItem>
                  <SelectItem value="below">Below + Well Below</SelectItem>
                  <SelectItem value="well-below">Well Below only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Switch id="noDataOnly" checked={filters.noDataOnly} onCheckedChange={v => update('noDataOnly', v)} />
              <Label htmlFor="noDataOnly" className="text-sm">Students with no data</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="focusOnly" checked={filters.focusOnly} onCheckedChange={v => update('focusOnly', v)} />
              <Label htmlFor="focusOnly" className="text-sm">Focus students only</Label>
            </div>
            <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Gender completeness */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-muted-foreground">Gender data completeness</p>
              <p className="text-xl font-semibold mt-1">
                Gender recorded for <span className="text-primary">{genderStats.recorded}</span> / {genderStats.total} active students
              </p>
              <Progress value={pct(genderStats.recorded, genderStats.total)} className="mt-3 h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                M: {genderStats.M} · F: {genderStats.F} · X: {genderStats.X} · Unknown: {genderStats.Unknown}
              </p>
            </div>
            <Badge variant="outline" className="text-xs">{pct(genderStats.recorded, genderStats.total)}% recorded</Badge>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total active students" value={totalActive} icon={Users} variant="primary" />
        <StatCard title="Students with data" value={withData} subtitle={`/ ${totalActive}`} icon={Database} variant="default" />
        <StatCard title="Missing data" value={missing} icon={FileWarning} variant="warning" />
        <StatCard title="% At/Above benchmark" value={`${pctAtAbove}%`} subtitle={`${bands.atOrAbove}/${bands.total}`} icon={TrendingUp} variant="success" />
        <StatCard title="% Near benchmark" value={`${pctNear}%`} subtitle={`${bands.near}/${bands.total}`} icon={Activity} variant="warning" />
        <StatCard title="% Below / Well below" value={`${pctBelow}%`} subtitle={`${bands.below}/${bands.total}`} icon={AlertTriangle} variant="destructive" />
        <StatCard title="High-need students" value={highNeed} icon={Heart} variant="destructive" />
        <StatCard title="Multiple risk indicators" value={multiBelow} subtitle="≥2 below measures" icon={Layers} variant="purple" />
      </div>

      {/* Heatmaps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Grade × Measure — % Below / Well Below</CardTitle>
            <p className="text-xs text-muted-foreground">Latest score per student per measure {filters.window !== 'all' ? `· ${filters.window}` : '· any window'}. Cells with n&lt;3 hidden.</p>
          </CardHeader>
          <CardContent>
            <Heatmap rowHeader="Grade" rows={presentGrades} cols={heatmapMeasureCols} data={gradeHeatmap} />
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Homeroom × Measure — % Below / Well Below</CardTitle>
            <p className="text-xs text-muted-foreground">Same scope; scrolls vertically.</p>
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-auto">
            <Heatmap rowHeader="Homeroom" rows={presentHomerooms} cols={heatmapMeasureCols} data={homeroomHeatmap} />
          </CardContent>
        </Card>
      </div>

      {/* Leadership lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ListCard title="Well Below Benchmark" icon={AlertTriangle} accent="destructive" students={wellBelowList} risk={studentRisk} />
        <ListCard title="Below Benchmark" icon={AlertTriangle} accent="warning" students={belowList} risk={studentRisk} />
        <ListCard
          title={filters.window !== 'all' ? `No data this window (${filters.window})` : 'No data'}
          icon={FileWarning}
          accent="default"
          students={noDataList}
          risk={studentRisk}
        />
        <ListCard
          title="Multiple below-benchmark measures"
          icon={Layers}
          accent="destructive"
          students={multiBelowList.map(x => x.s)}
          risk={studentRisk}
          extraText={id => {
            const n = multiBelowList.find(x => x.s.id === id)?.n ?? 0;
            return `${n} measures`;
          }}
        />
        <ListCard
          title="High need (review support plan)"
          icon={Heart}
          accent="destructive"
          students={highNeedList}
          risk={studentRisk}
        />
        <ListCard
          title="High need · no recent evidence (30d)"
          icon={FileWarning}
          accent="warning"
          students={highNeedNoEvidence}
          risk={studentRisk}
        />
      </div>

      {/* Data Meeting View */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 cursor-pointer" onClick={() => setDmOpen(o => !o)}>
          <div className="flex items-center gap-3">
            {dmOpen ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-primary" />}
            <div>
              <CardTitle>Data Meeting View</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">Pick a grade/homeroom + measure + window to plan small groups. Independent of top filters.</p>
            </div>
          </div>
        </CardHeader>
        {dmOpen && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Grade</Label>
                <Select value={dmGrade} onValueChange={setDmGrade}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {grades.map(g => <SelectItem key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Homeroom</Label>
                <Select value={dmHomeroom} onValueChange={setDmHomeroom}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {homerooms.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Measure</Label>
                <Select value={dmMeasure} onValueChange={setDmMeasure}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {measuresPresent.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Window</Label>
                <Select value={dmWindow} onValueChange={v => setDmWindow(v as WindowKey | 'all')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="BOY">BOY</SelectItem>
                    <SelectItem value="MOY">MOY</SelectItem>
                    <SelectItem value="EOY">EOY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm">
                Showing <strong>{dmRows.length}</strong> students needing support · {dmMeasure} · {dmWindow}
              </p>
              <Button onClick={handleExport} disabled={dmRows.length === 0} size="sm">
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </Button>
            </div>

            {/* Suggested groupings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['well-below', 'below', 'approaching'] as RiskLevel[]).map(band => (
                <div key={band} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className={BAND_BADGE[band]}>{RISK_LABEL[band]}</Badge>
                    <span className="text-xs text-muted-foreground">{dmGroupings[band as 'well-below' | 'below' | 'approaching'].length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {dmGroupings[band as 'well-below' | 'below' | 'approaching'].slice(0, 30).map(({ s }) => (
                      <span key={s.id} className="text-[11px] px-1.5 py-0.5 rounded bg-background border border-border">
                        {formatStudentDisplay(s)}
                      </span>
                    ))}
                    {dmGroupings[band as 'well-below' | 'below' | 'approaching'].length === 0 && (
                      <span className="text-xs text-muted-foreground">None</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="border rounded-lg overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Homeroom</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Latest score</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dmRows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No students needing support in this scope.</TableCell></TableRow>
                  ) : dmRows.map(({ s, e, risk }) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{formatStudentDisplay(s)}</TableCell>
                      <TableCell className="text-xs">{s.grade}</TableCell>
                      <TableCell className="text-xs font-mono">{s.homeroom}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={BAND_BADGE[risk]}>{RISK_LABEL[risk]}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{e?.b.rawScore ?? e?.b.score ?? '—'}</TableCell>
                      <TableCell className="text-xs">{e?.b.date ? new Date(e.b.date).toLocaleDateString() : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

interface ListCardProps {
  title: string;
  icon: typeof Users;
  accent: 'default' | 'warning' | 'destructive';
  students: Array<{ id: string; initials: string; homeroom: string; studentNumber: string; grade: string }>;
  risk: Map<string, RiskLevel>;
  extraText?: (id: string) => string;
}

function ListCard({ title, icon: Icon, accent, students, risk, extraText }: ListCardProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? students : students.slice(0, 10);
  const accentClass =
    accent === 'destructive' ? 'text-destructive bg-destructive/10' :
    accent === 'warning' ? 'text-orange-600 dark:text-orange-400 bg-orange-500/10' :
    'text-muted-foreground bg-muted';
  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${accentClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="outline" className="ml-auto text-xs">{students.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {students.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">None.</p>
        ) : (
          <ul className="space-y-1">
            {visible.map(s => {
              const r = risk.get(s.id) ?? 'unknown';
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                  <span className="truncate">{formatStudentDisplay(s)} <span className="text-muted-foreground">· Gr {s.grade}</span></span>
                  <span className="flex items-center gap-1 shrink-0">
                    {extraText && <span className="text-[10px] text-muted-foreground">{extraText(s.id)}</span>}
                    <Badge variant="outline" className={`${BAND_BADGE[r]} text-[10px]`}>{RISK_LABEL[r]}</Badge>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {students.length > 10 && (
          <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Show less' : `View all ${students.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
