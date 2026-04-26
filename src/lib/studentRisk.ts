import type { Student, Benchmark } from '@/types';

export type RiskLevel = 'well-below' | 'below' | 'at-or-above' | 'well-above' | 'unknown';

const LABEL_MAP: Array<[RegExp, RiskLevel]> = [
  [/well\s*below/i, 'well-below'],
  [/well\s*above/i, 'well-above'],
  [/at\s*\/?\s*above|at\s+or\s+above|above\s+benchmark|benchmark/i, 'at-or-above'],
  [/below/i, 'below'],
];

export function classifyScoreLabel(label: string | undefined | null): RiskLevel {
  if (!label) return 'unknown';
  for (const [re, lvl] of LABEL_MAP) {
    if (re.test(label)) return lvl;
  }
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
  'well-below': 'Well Below',
  'below': 'Below',
  'at-or-above': 'At/Above',
  'well-above': 'Well Above',
  'unknown': 'No Data',
};

export const RISK_COLOR: Record<RiskLevel, string> = {
  'well-below': 'hsl(var(--destructive))',
  'below': 'hsl(var(--chart-4))',
  'at-or-above': 'hsl(var(--chart-2))',
  'well-above': 'hsl(var(--chart-1))',
  'unknown': 'hsl(var(--muted-foreground))',
};
