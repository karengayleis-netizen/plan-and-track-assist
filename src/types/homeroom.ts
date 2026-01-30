// Homeroom (Class) types for the new data model
// Homeroom is the primary class identifier, created by admins

export interface Homeroom {
  id: string;
  code: string;           // e.g., "2AF", "45E" - primary identifier
  name?: string;          // Optional display name e.g., "Grade 2 French"
  allowedGrades: number[]; // e.g., [4, 5] for split grades, [2] for single grade
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
