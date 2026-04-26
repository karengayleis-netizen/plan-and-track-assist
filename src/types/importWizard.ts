export type ImportSource = 'acadience' | 'dibels' | 'knowledgehook' | 'generic_csv';
export type AssessmentFamily = 'reading' | 'math' | 'other';

export enum WizardStep {
  ChooseSource = 0,
  UploadCSV = 1,
  MapColumns = 2,
  PreviewValidate = 3,
  ImportResults = 4,
  SaveTemplate = 5,
}

export const WIZARD_STEP_LABELS = [
  'Choose Source',
  'Upload CSV',
  'Map Columns',
  'Preview',
  'Results',
  'Save Template',
];

// Internal field names that CSV columns map to
export type InternalField =
  | 'studentIdentifier'
  | 'assessmentType'
  | 'score'
  | 'date'
  | 'notes'
  | 'ref'
  | 'strand'
  | 'benchmarkWindow'
  | 'teacher'
  | 'classCode'
  | 'rawScore'
  | 'percent'
  | 'status';

export const REQUIRED_FIELDS: InternalField[] = ['studentIdentifier', 'assessmentType', 'score', 'date'];
export const OPTIONAL_FIELDS: InternalField[] = ['notes', 'ref', 'strand', 'benchmarkWindow', 'teacher', 'classCode', 'rawScore', 'percent', 'status'];

// Column mapping: internal field → CSV column index (or -1 if unmapped)
export type ColumnMapping = Record<InternalField, number>;

export type RowStatus = 'ready' | 'warning' | 'error';

export interface ImportRow {
  rowIndex: number;
  rawValues: string[];
  status: RowStatus;
  errors: string[];
  warnings: string[];
  matchedStudentId?: string;
  matchedStudentNumber?: string;
  matchedStudentInitials?: string;
  csvHomeroom?: string;
  matchedHomeroom?: string;
  assessmentType: string;
  score: string;
  date: string;
  parsedDate?: Date;
}

export interface ImportResult {
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  unmatchedRows: number;
  errorRows: number;
  classSummary?: Record<string, number>;
}

export interface NormalizedBenchmark {
  schoolId: string;
  studentId: string;
  studentNumber: string;
  initials: string;
  source: ImportSource;
  assessmentFamily: AssessmentFamily;
  assessmentType: string;
  score: string;
  scoreLabel?: string;
  rawScore?: string;
  percent?: number;
  benchmarkWindow?: string;
  strand?: string;
  date: Date;
  notes?: string;
  ref?: string;
  importedAt: Date;
  importedBy: string;
  rawImportMeta: {
    fileName: string;
    columnMapping: Record<string, string>;
  };
}

export interface ImportTemplate {
  id?: string;
  schoolId: string;
  source: ImportSource;
  templateName: string;
  columnMap: ColumnMapping;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ImportRun {
  id?: string;
  schoolId: string;
  source: ImportSource;
  fileName: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  unmatchedRows: number;
  importedBy: string;
  createdAt: Date;
}

// ── Pre-import ID diagnosis (from diagnoseImportStudentIds callable) ─────────

export type IdClassification =
  | 'visibleMatch'
  | 'missingEverywhere'
  | 'hiddenMissingSchoolId'
  | 'hiddenWrongSchoolId'
  | 'duplicateExternalNumber';

export interface IdDiagnosis {
  rawId: string;
  normalized: string;
  status: IdClassification;
  matchedField?: 'studentNumber';
  docCount: number;
  docSchoolIds: string[];
}

export interface ImportIdDiagnosis {
  ran: boolean;
  loading: boolean;
  error?: string;
  callerSchoolId?: string;
  results: IdDiagnosis[];
  rosterStats?: {
    totalInSchool: number;
    withExternalStudentNumber: number;
    withStudentNumber: number;
    withStableStudentId: number;
  };
}
