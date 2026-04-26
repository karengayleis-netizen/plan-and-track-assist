import { normalizeStudentNumber } from './studentDisplay';

export interface RosterRow {
  rowIndex: number;          // 1-based source row (after header)
  studentNumber: string;
  initials: string;
  homeroom: string;
  grade: string;
  errors: string[];
  warnings: string[];
}

export interface RosterParseResult {
  headers: string[];
  rows: RosterRow[];
  validRows: RosterRow[];
  errorCount: number;
  warningCount: number;
  detected: {
    studentNumberHeader: string | null;
    initialsHeader: string | null;
    homeroomHeader: string | null;
    gradeHeader: string | null;
  };
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function findHeader(headers: string[], candidates: string[]): { index: number; header: string | null } {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx >= 0) return { index: idx, header: headers[idx] };
  }
  // partial contains-match
  for (let i = 0; i < lower.length; i++) {
    for (const c of candidates) {
      if (lower[i].includes(c.toLowerCase())) return { index: i, header: headers[i] };
    }
  }
  return { index: -1, header: null };
}

export async function parseRosterCSV(file: File): Promise<RosterParseResult> {
  const text = await file.text();
  const rawLines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (rawLines.length === 0) {
    return {
      headers: [], rows: [], validRows: [], errorCount: 0, warningCount: 0,
      detected: { studentNumberHeader: null, initialsHeader: null, homeroomHeader: null, gradeHeader: null },
    };
  }

  const headers = parseCSVLine(rawLines[0]);
  const numCol = findHeader(headers, ['Student Number', 'StudentNumber', 'Board Number', 'Board Student Number']);
  const initCol = findHeader(headers, ['Student Initials', 'Initials']);
  const homeCol = findHeader(headers, ['Homeroom', 'Section Number', 'Section', 'Class', 'HR']);
  const gradeCol = findHeader(headers, ['Grade', 'Grade Level', 'Year']);

  const rows: RosterRow[] = [];
  const seen = new Map<string, number>(); // studentNumber → first row

  for (let i = 1; i < rawLines.length; i++) {
    const cells = parseCSVLine(rawLines[i]);
    const studentNumber = numCol.index >= 0 ? normalizeStudentNumber(cells[numCol.index]) : '';
    const initials = initCol.index >= 0 ? (cells[initCol.index] || '').trim() : '';
    const homeroom = homeCol.index >= 0 ? (cells[homeCol.index] || '').trim() : '';
    const grade = gradeCol.index >= 0 ? (cells[gradeCol.index] || '').trim() : '';

    const errors: string[] = [];
    const warnings: string[] = [];
    if (!studentNumber) errors.push('Missing Student Number');
    if (!homeroom) errors.push('Missing Homeroom / Section');
    if (!grade) errors.push('Missing Grade');
    if (!initials) warnings.push('Missing Initials');

    if (studentNumber) {
      const prev = seen.get(studentNumber);
      if (prev !== undefined) errors.push(`Duplicate Student Number (also row ${prev})`);
      else seen.set(studentNumber, i);
    }

    rows.push({ rowIndex: i, studentNumber, initials, homeroom, grade, errors, warnings });
  }

  const validRows = rows.filter(r => r.errors.length === 0);
  const errorCount = rows.reduce((n, r) => n + (r.errors.length > 0 ? 1 : 0), 0);
  const warningCount = rows.reduce((n, r) => n + (r.warnings.length > 0 ? 1 : 0), 0);

  return {
    headers,
    rows,
    validRows,
    errorCount,
    warningCount,
    detected: {
      studentNumberHeader: numCol.header,
      initialsHeader: initCol.header,
      homeroomHeader: homeCol.header,
      gradeHeader: gradeCol.header,
    },
  };
}
