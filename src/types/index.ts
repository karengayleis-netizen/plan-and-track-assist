// Default student tags available across the system
export const STUDENT_TAGS = [
  'IEP',
  'ELL',
  'At Risk',
  'Tier 2',
  'Tier 3',
  'Attendance Concern',
  'Gifted',
  'SEN',
  'Pupil Premium',
] as const;

export type StudentTag = string;

export interface Student {
  id: string;
  /** Board student number from roster CSV. The single identity key. */
  studentNumber: string;
  /** Student initials, e.g. "J.P.E." */
  initials: string;
  /** Homeroom / section code, e.g. "4F" */
  homeroom: string;
  /** Grade, e.g. "4" */
  grade: string;
  /** School this student belongs to. */
  schoolId: string;
  /** Whether this student is on the current active roster. */
  active: boolean;

  // Optional non-identity attributes (not part of identity, may be absent).
  isFocusStudent?: boolean;
  isHighNeed?: boolean;
  gender?: string;
  tags?: string[];
  lastUpdated?: Date;

  createdAt: Date;
  updatedAt: Date;

  // ── Deprecated legacy fields (kept optional for read-time tolerance only) ──
  /** @deprecated removed from new identity model */
  stableStudentId?: string;
  /** @deprecated removed from new identity model */
  externalStudentNumber?: string;
  /** @deprecated removed from new identity model */
  displayCode?: string;
  /** @deprecated removed from new identity model */
  firstName?: string;
  /** @deprecated removed from new identity model */
  lastName?: string;
  /** @deprecated removed from new identity model */
  seat?: string;
  /** @deprecated removed from new identity model */
  yearGroup?: string;
  /** @deprecated removed from new identity model */
  className?: string;
  /** @deprecated removed from new identity model */
  sen?: boolean;
  /** @deprecated removed from new identity model */
  pupilPremium?: boolean;
  /** @deprecated removed from new identity model */
  eal?: boolean;
}

export interface Class {
  id: string;
  classCode: string;
  className: string;
  grade: string;
  members: ClassMember[];
  createdAt: Date;
}

export interface ClassMember {
  uid: string;
  email: string;
  name: string;
  role: string;
  canWrite: boolean;
}

export interface Benchmark {
  id: string;
  studentId: string;
  studentName?: string;
  assessmentType: string;
  subject: string;
  assessmentName: string;
  score: string;
  level?: string;
  maxScore: number;
  percentage: number;
  date: Date;
  term: string;
  notes?: string;
  reference?: string;
  lastUpdated?: Date;
  createdAt: Date;
  // Import wizard fields (all optional for backward compat)
  source?: string;
  assessmentFamily?: string;
  scoreLabel?: string;
  rawScore?: string;
  percent?: number;
  benchmarkWindow?: string;
  strand?: string;
  importedAt?: Date;
  importedBy?: string;
  rawImportMeta?: {
    fileName: string;
    columnMapping: Record<string, string>;
  };
}

export interface MarkbookEntry {
  id: string;
  studentId: string;
  studentName?: string;
  subject: string;
  strand: string;
  taskName: string;
  topic: string;
  score: string;
  maxScore: number;
  date: Date;
  evidenceUrl?: string;
  notes?: string;
  lastUpdated?: Date;
}

export interface SupportPlan {
  id: string;
  studentId: string;
  gradeLevel: string;
  specialConsiderations: string[];
  observedStruggles: string[];
  primaryConcern: string;
  strengths: string;
  additionalContext?: string;
  stressors?: string;
  strategiesThatWorked?: string;
  whatHasntWorked?: string;
  generatedPlan?: string;
  generatedAt: Date;
  recommendations: string[];
  strategies: string[];
  targets: string[];
  reviewDate: Date;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: 'teacher' | 'admin';
  schoolId?: string;
  assignedHomerooms?: string[];
}

export interface SchoolStats {
  totalStudents: number;
  totalBenchmarks: number;
  atRiskCount: number;
  avgDataPerStudent: number;
}

export interface GradeAnalytics {
  grade: string;
  students: number;
  atRiskPercent: number;
  stablePercent: number;
}

export interface TeacherAnalytics {
  teacher: string;
  classSize: number;
  benchmarks: number;
  classRiskPercent: number;
}

// Assessment types for Benchmarks
export const ASSESSMENT_TYPES = [
  'Acadience Reading',
  'DIBELS',
  'GB+ Reading',
  'PM Benchmark',
  'Running Record',
  'DRA',
  'Heggerty',
  'UFLI',
  'Knowledgehook',
  'MathUp',
  'Mathology',
  'Math Interview',
  'Writing Sample',
  'Other'
];

// Subjects for Markbook
export const SUBJECTS = [
  'Language Arts',
  'Mathematics',
  'French',
  'Science',
  'Social Studies',
  'Health',
  'Arts',
  'Physical Education'
];

// Strands by subject
export const STRANDS: Record<string, string[]> = {
  'Language Arts': ['Reading', 'Writing', 'Oral Communication', 'Media Literacy'],
  'Mathematics': ['Number Sense', 'Algebra', 'Measurement', 'Geometry', 'Data Management'],
  'French': ['Oral Communication', 'Reading', 'Writing'],
  'Science': ['Life Systems', 'Matter & Energy', 'Structures', 'Earth & Space'],
  'Social Studies': ['Heritage & Identity', 'People & Environments'],
  'Health': ['Personal Safety', 'Healthy Living', 'Growth & Development'],
  'Arts': ['Visual Arts', 'Music', 'Drama', 'Dance'],
  'Physical Education': ['Movement', 'Active Living', 'Living Skills']
};

export const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];

// Support Plan struggle categories
export const STRUGGLE_CATEGORIES = {
  learningSkills: [
    'Responsibility',
    'Organization', 
    'Independent Work',
    'Collaboration',
    'Initiative',
    'Self-Regulation'
  ],
  literacyReading: [
    'Phonological Awareness',
    'Decoding (Sounding out words)',
    'Fluency (Speed/Expression)',
    'Reading Comprehension',
    'Sight Word Recognition',
    'Vocabulary'
  ],
  literacyWriting: [
    'Idea Generation',
    'Organization of Ideas',
    'Sentence Structure (Syntax)',
    'Grammar & Punctuation',
    'Spelling',
    'Handwriting / Motor Skills'
  ],
  literacyOral: [
    'Articulation / Pronunciation',
    'Vocabulary Retrieval',
    'Expressing Ideas Clearly',
    'Following Multi-Step Directions',
    'Social Communication',
    'Listening Comprehension'
  ],
  numeracy: [
    'Number Sense & Place Value',
    'Basic Operations (+)',
    'Problem Solving / Word Problems',
    'Mathematical Language',
    'Measurement & Geometry',
    'Data & Graphing'
  ],
  frenchImmersion: [
    'Oral Comprehension (Listening)',
    'Oral Production (Speaking)',
    'Reading in French',
    'Writing in French',
    'French Vocabulary Retrieval',
    'French Grammar (verbs, gender)',
    'Confidence to Speak French'
  ]
};
