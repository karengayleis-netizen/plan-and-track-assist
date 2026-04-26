import type { Student, Benchmark } from '@/types';
import { classifyScoreLabel, type RiskLevel } from './studentRisk';

export type WindowKey = 'BOY' | 'MOY' | 'EOY' | 'unknown';

export const STANDARD_MEASURES = ['FSF', 'LNF', 'PSF', 'NWF-CLS', 'NWF-WWR', 'ORF', 'Composite'] as const;
export type StandardMeasure = typeof STANDARD_MEASURES[number];

export function inferWindow(b: Pick<Benchmark, 'benchmarkWindow' | 'term'>): WindowKey {
  const s = `${b.benchmarkWindow ?? ''} ${b.term ?? ''}`.toLowerCase();
  if (!s.trim()) return 'unknown';
  if (/\b(boy|beginning|fall)\b/.test(s)) return 'BOY';
  if (/\b(moy|middle|winter|mid)\b/.test(s)) return 'MOY';
  if (/\b(eoy|end|spring)\b/.test(s)) return 'EOY';
  return 'unknown';
}

export function inferMeasure(b: Pick<Benchmark, 'assessmentType' | 'assessmentName' | 'strand'>): string {
  const raw = `${b.assessmentType ?? ''} ${b.assessmentName ?? ''} ${b.strand ?? ''}`.trim();
  const s = raw.toLowerCase().replace(/[_\s]+/g, '-');
  if (/composite/.test(s)) return 'Composite';
  if (/nwf.*(cls|correct.*letter)/.test(s)) return 'NWF-CLS';
  if (/nwf.*(wwr|whole.*word)/.test(s)) return 'NWF-WWR';
  if (/\borf\b|oral.*reading.*flu/.test(s)) return 'ORF';
  if (/\bpsf\b|phoneme.*seg/.test(s)) return 'PSF';
  if (/\blnf\b|letter.*naming/.test(s)) return 'LNF';
  if (/\bfsf\b|first.*sound/.test(s)) return 'FSF';
  return raw || 'Other';
}

export interface EnrichedBenchmark {
  b: Benchmark;
  measure: string;
  window: WindowKey;
  risk: RiskLevel;
  scoreNum: number | null;
}

export function enrich(benchmarks: Benchmark[]): EnrichedBenchmark[] {
  return benchmarks.map(b => {
    const measure = inferMeasure(b);
    const win = inferWindow(b);
    const risk = classifyScoreLabel(b.scoreLabel);
    const num = parseFloat(String(b.rawScore ?? b.score ?? ''));
    return { b, measure, window: win, risk, scoreNum: Number.isFinite(num) ? num : null };
  });
}

/** Latest enriched benchmark per (studentId, measure). */
export function latestPerStudentMeasure(
  enriched: EnrichedBenchmark[],
  windowFilter?: WindowKey | 'all'
): Map<string, EnrichedBenchmark> {
  const out = new Map<string, EnrichedBenchmark>();
  for (const e of enriched) {
    if (windowFilter && windowFilter !== 'all' && e.window !== windowFilter) continue;
    const key = `${e.b.studentId}|${e.measure}`;
    const prev = out.get(key);
    const ts = new Date(e.b.date).getTime();
    if (!prev || ts > new Date(prev.b.date).getTime()) out.set(key, e);
  }
  return out;
}

/** Most-recent enriched benchmark per student (any measure, optionally window). */
export function latestPerStudent(
  enriched: EnrichedBenchmark[],
  windowFilter?: WindowKey | 'all',
  measureFilter?: string | 'all'
): Map<string, EnrichedBenchmark> {
  const out = new Map<string, EnrichedBenchmark>();
  for (const e of enriched) {
    if (windowFilter && windowFilter !== 'all' && e.window !== windowFilter) continue;
    if (measureFilter && measureFilter !== 'all' && e.measure !== measureFilter) continue;
    // Prefer Composite if available for the student.
    const prev = out.get(e.b.studentId);
    if (!prev) { out.set(e.b.studentId, e); continue; }
    const isCompNew = e.measure === 'Composite';
    const isCompPrev = prev.measure === 'Composite';
    if (isCompNew && !isCompPrev) { out.set(e.b.studentId, e); continue; }
    if (!isCompNew && isCompPrev) continue;
    if (new Date(e.b.date).getTime() > new Date(prev.b.date).getTime()) out.set(e.b.studentId, e);
  }
  return out;
}

export function multipleBelowMeasures(
  studentId: string,
  enriched: EnrichedBenchmark[]
): number {
  const latest = latestPerStudentMeasure(enriched.filter(e => e.b.studentId === studentId));
  let n = 0;
  for (const e of latest.values()) {
    if (e.risk === 'below' || e.risk === 'well-below') n++;
  }
  return n;
}

export interface BandPct {
  atOrAbove: number; // includes well-above
  near: number;
  below: number;    // includes well-below
  unknown: number;
  total: number;
}

export function bandPctsFromRisks(risks: RiskLevel[]): BandPct {
  const out: BandPct = { atOrAbove: 0, near: 0, below: 0, unknown: 0, total: risks.length };
  for (const r of risks) {
    if (r === 'at-or-above' || r === 'well-above') out.atOrAbove++;
    else if (r === 'approaching') out.near++;
    else if (r === 'below' || r === 'well-below') out.below++;
    else out.unknown++;
  }
  return out;
}

export function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export function isGenderRecorded(g: string | undefined | null): boolean {
  if (!g) return false;
  const s = String(g).trim().toLowerCase();
  return s.length > 0 && s !== 'unknown' && s !== 'n/a' && s !== 'na' && s !== '-';
}

export function genderBucket(g: string | undefined | null): 'M' | 'F' | 'X' | 'Unknown' {
  if (!isGenderRecorded(g)) return 'Unknown';
  const s = String(g).trim().toUpperCase();
  if (s.startsWith('M')) return 'M';
  if (s.startsWith('F')) return 'F';
  return 'X';
}

export interface FilterState {
  grade: string;
  homeroom: string;
  gender: string; // 'all' | 'M' | 'F' | 'X' | 'Unknown'
  window: WindowKey | 'all';
  measure: string; // 'all' or measure name
  band: 'all' | 'at-or-above' | 'approaching' | 'below' | 'well-below';
  noDataOnly: boolean;
  focusOnly: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  grade: 'all',
  homeroom: 'all',
  gender: 'all',
  window: 'all',
  measure: 'all',
  band: 'all',
  noDataOnly: false,
  focusOnly: false,
};

export function applyStudentFilters(students: Student[], f: FilterState): Student[] {
  return students.filter(s => {
    if (s.active === false) return false;
    if (f.grade !== 'all' && String(s.grade) !== f.grade) return false;
    if (f.homeroom !== 'all' && s.homeroom !== f.homeroom) return false;
    if (f.gender !== 'all' && genderBucket(s.gender) !== f.gender) return false;
    if (f.focusOnly && !s.isFocusStudent) return false;
    return true;
  });
}
