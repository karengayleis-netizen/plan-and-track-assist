import type { Student } from '@/types';

/**
 * Normalize an identifier value coming from a CSV cell or Firestore field.
 * Handles null/undefined, trailing ".0" from spreadsheet exports, and whitespace.
 */
export function normalizeStudentNumber(v: unknown): string {
  return String(v ?? '').trim().replace(/\.0$/, '');
}

/**
 * Teacher-facing display string. Hides full board number; shows last 3 digits only.
 *   formatStudentDisplay({ initials: "J.P.E.", homeroom: "4F", studentNumber: "970591" })
 *     → "J.P.E. · 4F · #591"
 */
export function formatStudentDisplay(
  student: Pick<Student, 'initials' | 'homeroom' | 'studentNumber'>
): string {
  const initials = (student.initials || '').trim() || '—';
  const homeroom = (student.homeroom || '').trim() || '—';
  const num = normalizeStudentNumber(student.studentNumber);
  const last3 = num ? `#${num.slice(-3)}` : '#---';
  return `${initials} · ${homeroom} · ${last3}`;
}
