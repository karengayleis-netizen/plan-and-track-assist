import { z } from 'zod';
import { GRADES, SUBJECTS, ASSESSMENT_TYPES } from '@/types';

// Student validation schema
export const StudentSchema = z.object({
  studentNumber: z.string().min(1, 'Student number is required').max(20, 'Student number must be 20 characters or less'),
  initials: z.string().max(10, 'Initials must be 10 characters or less').default(''),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be 50 characters or less'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be 50 characters or less'),
  grade: z.string().min(1, 'Grade is required'),
  homeroom: z.string().max(20, 'Homeroom must be 20 characters or less').default(''),
  seat: z.string().max(10, 'Seat must be 10 characters or less').optional(),
  yearGroup: z.string().max(20, 'Year group must be 20 characters or less').default(''),
  className: z.string().max(50, 'Class name must be 50 characters or less').default(''),
  sen: z.boolean().default(false),
  pupilPremium: z.boolean().default(false),
  eal: z.boolean().default(false),
  isFocusStudent: z.boolean().default(false),
  isHighNeed: z.boolean().default(false),
  gender: z.string().max(10, 'Gender must be 10 characters or less').optional(),
});

export type ValidatedStudent = z.infer<typeof StudentSchema>;

// Benchmark validation schema
export const BenchmarkSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  studentName: z.string().max(100, 'Student name must be 100 characters or less').optional(),
  assessmentType: z.string().min(1, 'Assessment type is required'),
  subject: z.string().max(50, 'Subject must be 50 characters or less').default(''),
  assessmentName: z.string().max(100, 'Assessment name must be 100 characters or less').default(''),
  score: z.string().min(1, 'Score is required').max(20, 'Score must be 20 characters or less'),
  level: z.string().max(20, 'Level must be 20 characters or less').optional(),
  maxScore: z.number().min(0, 'Max score must be positive').max(10000, 'Max score is too large').default(100),
  percentage: z.number().min(0, 'Percentage must be at least 0').max(100, 'Percentage cannot exceed 100').default(0),
  date: z.date(),
  term: z.string().max(20, 'Term must be 20 characters or less').default(''),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
  reference: z.string().max(200, 'Reference must be 200 characters or less').optional(),
});

export type ValidatedBenchmark = z.infer<typeof BenchmarkSchema>;

// Markbook entry validation schema
export const MarkbookEntrySchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  studentName: z.string().max(100, 'Student name must be 100 characters or less').optional(),
  subject: z.string().min(1, 'Subject is required').max(50, 'Subject must be 50 characters or less'),
  strand: z.string().max(50, 'Strand must be 50 characters or less').default(''),
  taskName: z.string().min(1, 'Task name is required').max(100, 'Task name must be 100 characters or less'),
  topic: z.string().max(100, 'Topic must be 100 characters or less').default(''),
  score: z.string().min(1, 'Score is required').max(20, 'Score must be 20 characters or less'),
  maxScore: z.number().min(0, 'Max score must be positive').max(10000, 'Max score is too large').default(100),
  date: z.date(),
  evidenceUrl: z.string().url('Invalid URL format').max(500, 'URL is too long').optional().or(z.literal('')),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional(),
});

export type ValidatedMarkbookEntry = z.infer<typeof MarkbookEntrySchema>;

// Class validation schema
export const ClassSchema = z.object({
  classCode: z.string().min(1, 'Class code is required').max(20, 'Class code must be 20 characters or less')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Class code can only contain letters, numbers, hyphens, and underscores'),
  className: z.string().min(1, 'Class name is required').max(50, 'Class name must be 50 characters or less'),
  grade: z.string().min(1, 'Grade is required'),
});

export type ValidatedClass = z.infer<typeof ClassSchema>;

// User ID validation for staff operations
export const UserIdSchema = z.string()
  .min(1, 'User ID is required')
  .max(128, 'User ID is too long')
  .regex(/^[a-zA-Z0-9]+$/, 'Invalid user ID format');

// Validation helper function
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstError = err.errors[0];
      return { success: false, error: firstError?.message || 'Validation failed' };
    }
    return { success: false, error: 'Validation failed' };
  }
}
