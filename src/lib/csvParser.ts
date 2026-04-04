import type { ColumnMapping, ImportRow, InternalField, RowStatus } from '@/types/importWizard';
import type { ImportSource } from '@/types/importWizard';
import { getPreset } from './importPresets';

// ── CSV Parsing ──────────────────────────────────────────────────────────────

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export function parseCSV(text: string): ParsedCSV {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];

  for (const line of lines) {
    if (line.trim().length === 0) continue;
    result.push(parseLine(line));
  }

  if (result.length === 0) return { headers: [], rows: [] };

  return {
    headers: result[0],
    rows: result.slice(1),
  };
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

// ── Column Alias Detection ───────────────────────────────────────────────────

const COLUMN_ALIASES: Record<InternalField, string[]> = {
  studentIdentifier: ['student number', 'studentnumber', 'student_number', 'number', 'student id', 'student_id', 'id', 'pupil id'],
  assessmentType: ['type', 'measure', 'assessment', 'subtest', 'domain', 'skill', 'assessment type', 'assessment_type', 'test'],
  score: ['score', 'raw score', 'composite', 'percent', 'result', 'total', 'raw_score'],
  date: ['date', 'assessment date', 'completed on', 'assessment_date', 'test date', 'test_date'],
  notes: ['notes', 'comments', 'teacher notes', 'teacher_notes', 'comment'],
  ref: ['ref', 'reference', 'ref id', 'ref_id'],
  strand: ['strand', 'category', 'area', 'content area'],
  benchmarkWindow: ['window', 'benchmark window', 'period', 'term', 'season'],
  teacher: ['teacher', 'instructor', 'teacher name', 'teacher_name'],
  classCode: ['class', 'class code', 'class_code', 'section', 'homeroom'],
  rawScore: ['raw score', 'raw_score', 'raw'],
  percent: ['percent', 'percentage', 'pct', '%'],
  status: ['status', 'level', 'benchmark status', 'performance level', 'risk'],
};

export function detectColumnMapping(headers: string[], source: ImportSource): ColumnMapping {
  const preset = getPreset(source);
  const mapping: ColumnMapping = {} as ColumnMapping;
  const headerLower = headers.map(h => h.toLowerCase().trim());

  // Initialize all fields to -1
  const allFields: InternalField[] = Object.keys(COLUMN_ALIASES) as InternalField[];
  for (const field of allFields) {
    mapping[field] = -1;
  }

  // Try preset suggested headers first, then aliases
  for (const field of allFields) {
    const suggested = preset.suggestedHeaders[field] || [];
    const aliases = [...suggested.map(s => s.toLowerCase()), ...COLUMN_ALIASES[field]];

    for (let i = 0; i < headerLower.length; i++) {
      if (aliases.includes(headerLower[i])) {
        mapping[field] = i;
        break;
      }
    }
  }

  return mapping;
}

// ── Row Validation ───────────────────────────────────────────────────────────

export function validateRow(
  row: string[],
  mapping: ColumnMapping,
): { status: RowStatus; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const identifierIdx = mapping.studentIdentifier;
  const typeIdx = mapping.assessmentType;
  const scoreIdx = mapping.score;
  const dateIdx = mapping.date;

  if (identifierIdx < 0 || !row[identifierIdx]?.trim()) {
    errors.push('Missing student identifier');
  }
  if (typeIdx < 0 || !row[typeIdx]?.trim()) {
    errors.push('Missing assessment type');
  }
  if (scoreIdx < 0 || !row[scoreIdx]?.trim()) {
    errors.push('Missing score');
  }
  if (dateIdx < 0 || !row[dateIdx]?.trim()) {
    warnings.push('Missing date — will use today');
  } else {
    const parsed = new Date(row[dateIdx].trim());
    if (isNaN(parsed.getTime())) {
      warnings.push('Invalid date format');
    }
  }

  const status: RowStatus = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'ready';
  return { status, errors, warnings };
}

// ── Build Import Rows (without student matching — that happens in the hook) ─

export function buildImportRows(
  rows: string[][],
  mapping: ColumnMapping,
): ImportRow[] {
  return rows.map((row, idx) => {
    const { status, errors, warnings } = validateRow(row, mapping);

    const dateStr = mapping.date >= 0 ? row[mapping.date]?.trim() || '' : '';
    let parsedDate: Date | undefined;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) parsedDate = d;
    }

    return {
      rowIndex: idx,
      rawValues: row,
      status,
      errors,
      warnings,
      assessmentType: mapping.assessmentType >= 0 ? row[mapping.assessmentType]?.trim() || '' : '',
      score: mapping.score >= 0 ? row[mapping.score]?.trim() || '' : '',
      date: dateStr,
      parsedDate,
    };
  });
}

// ── Error Report CSV ─────────────────────────────────────────────────────────

export function generateErrorReportCSV(rows: ImportRow[]): string {
  const skipped = rows.filter(r => r.status === 'error' || !r.matchedStudentId);
  const header = 'Row,StudentNumber,AssessmentType,Score,Date,Status,Reason';
  const lines = skipped.map(r => {
    const studentNum = r.matchedStudentNumber || 'Unmatched';
    const reason = [...r.errors, ...(r.matchedStudentId ? [] : ['No student match'])].join('; ');
    return [r.rowIndex + 2, studentNum, r.assessmentType, r.score, r.date, r.status, `"${reason}"`].join(',');
  });
  return [header, ...lines].join('\n');
}
