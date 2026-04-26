// Homeroom (Class) types for the new data model
// Homeroom is the primary class identifier, created by admins

export interface Homeroom {
  id: string;
  code: string;           // e.g., "2AF", "45E" - primary identifier
  name?: string;          // Optional display name e.g., "Grade 2 French"
  allowedGrades: number[]; // e.g., [4, 5] for split grades, [2] for single grade
  teacherIds?: string[];  // UIDs of assigned teachers (supports co-teaching)
  schoolId: string;       // For multi-tenant isolation
  createdBy: string;      // UID of admin who created
  createdAt: Date;
  updatedAt: Date;
}

// For creating a new homeroom (without id and timestamps)
export type CreateHomeroomInput = Omit<Homeroom, 'id' | 'createdAt' | 'updatedAt'>;

// Validation helper to check if a grade is allowed in a homeroom
export function isGradeAllowedInHomeroom(grade: number, homeroom: Homeroom): boolean {
  return homeroom.allowedGrades.includes(grade);
}

// Parse grade string to number (handles "K" as 0)
export function parseGradeToNumber(gradeStr: string): number | null {
  if (gradeStr.toUpperCase() === 'K') return 0;
  const num = parseInt(gradeStr, 10);
  return isNaN(num) ? null : num;
}

// Format grade number to display string
export function formatGradeDisplay(grade: number): string {
  return grade === 0 ? 'K' : String(grade);
}

/**
 * Normalize any grade-like string into the canonical form used everywhere
 * in the app: 'K' for kindergarten (incl. JK/SK/Kindergarten/0), or the
 * numeric digit (e.g. '01' → '1'). Unrecognized values are returned trimmed.
 */
export function normalizeGrade(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const u = s.toUpperCase().replace(/[\s_-]+/g, '');
  if (['K', 'JK', 'SK', 'KG', 'KINDER', 'KINDERGARTEN', '0', '00'].includes(u)) return 'K';
  // Numeric (with possible leading zero) → bare digit
  if (/^\d+$/.test(u)) {
    const n = parseInt(u, 10);
    if (!Number.isNaN(n)) return String(n);
  }
  // "Grade 3", "GR3", "GRADE03"
  const m = u.match(/^(?:GR|GRADE)(\d+)$/);
  if (m) return String(parseInt(m[1], 10));
  return s;
}
