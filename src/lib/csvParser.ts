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

// Headers that must NEVER be auto-selected — or even manually selected — as
// the student identifier. These are roster ordinals (1, 2, 3...) not board IDs.
export const STUDENT_IDENTIFIER_DENY_LIST = new Set([
  'student #', 'student#',
  'number', '#',
  'roster number', 'roster #',
  'class number', 'seat number',
  'student number in class', 'student no. in class',
  'line number', 'row number',
]);

// The ONLY headers allowed to be auto-mapped as `studentIdentifier`.
// No fuzzy matching, no "contains number", no fallbacks. Strict allow-list.
export const STUDENT_IDENTIFIER_ALLOW_LIST = new Set([
  'student number', 'studentnumber', 'student_number',
  'board student number', 'board number', 'board id',
  'student id', 'student_id',
  'external student number', 'externalstudentnumber',
  'sis student number',
]);

const COLUMN_ALIASES: Record<InternalField, string[]> = {
  // studentIdentifier intentionally uses the strict allow-list above — this
  // array is left empty so generic alias logic can never widen it.
  studentIdentifier: [],
  assessmentType: ['type', 'measure', 'assessment', 'subtest', 'domain', 'skill', 'assessment type', 'assessment_type', 'test'],
  score: ['score', 'raw score', 'composite', 'percent', 'result', 'total', 'raw_score'],
  date: ['date', 'assessment date', 'completed on', 'assessment_date', 'test date', 'test_date'],
  notes: ['notes', 'comments', 'teacher notes', 'teacher_notes', 'comment'],
  ref: ['ref', 'reference', 'ref id', 'ref_id'],
  strand: ['strand', 'category', 'area', 'content area'],
  benchmarkWindow: ['window', 'benchmark window', 'period', 'term', 'season'],
  teacher: ['teacher', 'instructor', 'teacher name', 'teacher_name'],
  classCode: ['class', 'class code', 'class_code', 'section', 'homeroom', 'class name', 'classname', 'classroom', 'class_name'],
  rawScore: ['raw score', 'raw_score', 'raw'],
  percent: ['percent', 'percentage', 'pct', '%'],
  status: ['status', 'level', 'benchmark status', 'performance level', 'risk'],
};

export function detectColumnMapping(headers: string[], source: ImportSource): ColumnMapping {
  const preset = getPreset(source);
  const mapping: ColumnMapping = {} as ColumnMapping;
  const headerLower = headers.map(h => h.toLowerCase().trim());

  const allFields: InternalField[] = Object.keys(COLUMN_ALIASES) as InternalField[];
  for (const field of allFields) {
    mapping[field] = -1;
  }

  for (const field of allFields) {
    if (field === 'studentIdentifier') {
      // Strict allow-list ONLY. No preset shortcut, no fuzzy match, no fallback.
      // If no approved header exists, leave studentIdentifier = -1.
      for (let i = 0; i < headerLower.length; i++) {
        const h = headerLower[i];
        if (STUDENT_IDENTIFIER_DENY_LIST.has(h)) continue;
        if (STUDENT_IDENTIFIER_ALLOW_LIST.has(h)) {
          mapping[field] = i;
          break;
        }
      }
      continue;
    }

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

// ── Student Identifier Validation ────────────────────────────────────────────

export type IdentifierValidity =
  | { valid: true; columnIndex: number; headerName: string }
  | { valid: false; reason: 'unmapped' | 'denied' | 'not-allowed'; columnIndex: number; headerName: string };

/**
 * Centralized validation for the studentIdentifier mapping.
 * Used by detection, manual selection, template application, preview, and import
 * so they all enforce the exact same rule.
 */
export function validateStudentIdentifierMapping(
  columnIndex: number,
  headers: string[],
): IdentifierValidity {
  if (columnIndex < 0 || columnIndex >= headers.length) {
    return { valid: false, reason: 'unmapped', columnIndex: -1, headerName: '' };
  }
  const headerName = headers[columnIndex] || '';
  const h = headerName.toLowerCase().trim();
  if (STUDENT_IDENTIFIER_DENY_LIST.has(h)) {
    return { valid: false, reason: 'denied', columnIndex, headerName };
  }
  if (!STUDENT_IDENTIFIER_ALLOW_LIST.has(h)) {
    return { valid: false, reason: 'not-allowed', columnIndex, headerName };
  }
  return { valid: true, columnIndex, headerName };
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

export interface ErrorSummary {
  totalFailed: number;
  reasons: { reason: string; count: number }[];
  failedRows: {
    rowNumber: number;
    status: RowStatus;
    reasons: string[];
    originalValues: Record<string, string>;
  }[];
}

/**
 * Build a structured error summary from import rows.
 * Only includes data the user originally uploaded — no internal IDs.
 */
export function buildErrorSummary(rows: ImportRow[], headers: string[]): ErrorSummary {
  const failed = rows.filter(r => r.status === 'error' || r.status === 'warning' || !r.matchedStudentId);

  const reasonCounts: Record<string, number> = {};
  const failedRows = failed.map(r => {
    const reasons = [
      ...r.errors,
      ...r.warnings,
      ...(r.matchedStudentId ? [] : ['No matching student found in roster']),
    ];
    reasons.forEach(reason => {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    // Map raw values back to original column names — no internal IDs exposed
    const originalValues: Record<string, string> = {};
    r.rawValues.forEach((val, i) => {
      if (i < headers.length) {
        originalValues[headers[i]] = val;
      }
    });

    return {
      rowNumber: r.rowIndex + 2, // +1 for 0-index, +1 for header row
      status: r.status,
      reasons,
      originalValues,
    };
  });

  const reasons = Object.entries(reasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return { totalFailed: failed.length, reasons, failedRows };
}

/**
 * Generate a downloadable CSV of failed/warning rows.
 * Includes: Row Number, Status, Reason, and all original CSV columns.
 * Does NOT include any internal system IDs.
 */
export function generateErrorReportCSV(rows: ImportRow[], headers: string[] = []): string {
  const failed = rows.filter(r => r.status === 'error' || !r.matchedStudentId);
  if (failed.length === 0) return '';

  // Build header: Row Number | Status | Reason | ...original columns
  const csvHeaders = ['Row Number', 'Status', 'Reason', ...headers];
  const csvEscape = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = failed.map(r => {
    const reasons = [
      ...r.errors,
      ...r.warnings,
      ...(r.matchedStudentId ? [] : ['No matching student found in roster']),
    ].join('; ');

    const statusLabel = r.status === 'error' ? 'Error' : 'Warning';

    return [
      String(r.rowIndex + 2),
      statusLabel,
      csvEscape(reasons),
      ...r.rawValues.map(v => csvEscape(v || '')),
    ].join(',');
  });

  return [csvHeaders.map(csvEscape).join(','), ...lines].join('\n');
}
