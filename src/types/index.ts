export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  yearGroup: string;
  className: string;
  sen: boolean;
  pupilPremium: boolean;
  eal: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Benchmark {
  id: string;
  studentId: string;
  subject: string;
  assessmentName: string;
  score: number;
  maxScore: number;
  percentage: number;
  date: Date;
  term: string;
  createdAt: Date;
}

export interface MarkbookEntry {
  id: string;
  studentId: string;
  subject: string;
  topic: string;
  score: number;
  maxScore: number;
  date: Date;
  notes?: string;
}

export interface SupportPlan {
  id: string;
  studentId: string;
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
}
