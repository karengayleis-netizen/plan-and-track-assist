import type { Student, Benchmark } from '@/types';

export type RiskLevel = 'well-below' | 'below' | 'approaching' | 'at-or-above' | 'well-above' | 'unknown';

/**
 * Classify an Acadience-style status string into a risk level.
 * Order matters — check most specific patterns first.
 */
export function classifyScoreLabel(label: string | undefined | null): RiskLevel {
  if (!label) return 'unknown';
  const s = String(label).trim().toLowerCase();
  if (!s) return 'unknown';

  if (/well\s*below/.test(s)) return 'well-below';
  if (/well\s*above/.test(s)) return 'well-above';
  if (/\babove\b/.test(s)) return 'at-or-above';
  if (/at\s*\/?\s*above|at\s+or\s+above/.test(s)) return 'at-or-above';
  if (/\bbelow\b/.test(s)) return 'below';
  if (/\bnear\b|approach/.test(s)) return 'approaching';
  // Bare "at benchmark" / "benchmark" / "on track"
  if (/\bat\b.*benchmark|^benchmark$|on\s*track|meeting/.test(s)) return 'at-or-above';
  return 'unknown';
}

/**
 * Most recent risk level for a student. Prefers Composite measure if present,
 * falls back to the latest benchmark with a recognizable scoreLabel.
 * Manual `isHighNeed` flag forces 'well-below'.
 */
export function getStudentRiskLevel(
  student: Pick<Student, 'id' | 'isHighNeed'>,
  benchmarks: Benchmark[]
): RiskLevel {
  if (student.isHighNeed) return 'well-below';

  const mine = benchmarks.filter(b => b.studentId === student.id);
  if (mine.length === 0) return 'unknown';

  const sortByDateDesc = (a: Benchmark, b: Benchmark) =>
    new Date(b.date).getTime() - new Date(a.date).getTime();

  const composite = mine
    .filter(b => /composite/i.test(b.assessmentType || b.assessmentName || ''))
    .sort(sortByDateDesc);

  const candidates = composite.length > 0 ? composite : [...mine].sort(sortByDateDesc);

  for (const b of candidates) {
    const lvl = classifyScoreLabel(b.scoreLabel);
    if (lvl !== 'unknown') return lvl;
  }
  return 'unknown';
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  'well-below': 'Well Below / High Need',
  'below': 'Below / Needs Support',
  'approaching': 'Approaching / Watch',
  'at-or-above': 'On Track',
  'well-above': 'Well Above',
  'unknown': 'Unclassified',
};

export const RISK_COLOR: Record<RiskLevel, string> = {
  'well-below': 'hsl(var(--destructive))',
  'below': 'hsl(var(--chart-4, 38 92% 50%))',
  'approaching': 'hsl(var(--chart-3, 48 96% 53%))',
  'at-or-above': 'hsl(var(--chart-2, 142 71% 45%))',
  'well-above': 'hsl(var(--chart-1, 217 91% 60%))',
  'unknown': 'hsl(var(--muted-foreground))',
};
