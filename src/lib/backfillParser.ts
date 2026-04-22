import * as XLSX from 'xlsx';

export interface BackfillRow {
  initials: string;
  externalNumber: string;
  homeroom: string;
  grade?: string;
  rowIndex: number;
}

export interface BackfillMatch {
  row: BackfillRow;
  studentId: string;
  currentExternal?: string;
}

export interface BackfillParseResult {
  rows: BackfillRow[];
  totalRowsRead: number;
  warnings: string[];
}

const HEADER_ALIASES = {
  initials: ['student initials', 'initials'],
  externalNumber: ['student number', 'board number', 'external student number', 'sis id', 'board student number'],
  homeroom: ['section number', 'section', 'homeroom', 'class', 'class name'],
  grade: ['grade', 'year group'],
};

export const normalizeInitials = (s: string): string =>
  (s || '').replace(/\./g, '').toUpperCase().trim();

export const normalizeHomeroom = (s: string): string =>
  (s || '').toUpperCase().trim();

const findHeaderIndex = (headers: string[], aliases: string[]): number => {
  const lower = headers.map(h => (h || '').toString().toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
};

const parseSheet = (rows: unknown[][], sheetName: string, warnings: string[]): BackfillRow[] => {
  if (rows.length < 2) return [];
  const headers = (rows[0] as unknown[]).map(c => (c == null ? '' : String(c)));

  const iInit = findHeaderIndex(headers, HEADER_ALIASES.initials);
  const iExt = findHeaderIndex(headers, HEADER_ALIASES.externalNumber);
  const iHome = findHeaderIndex(headers, HEADER_ALIASES.homeroom);
  const iGrade = findHeaderIndex(headers, HEADER_ALIASES.grade);

  if (iInit === -1 || iExt === -1 || iHome === -1) {
    warnings.push(
      `Sheet "${sheetName}": missing required column(s). Need Initials, Student/Board Number, and Section/Homeroom. Found headers: ${headers.join(', ')}`
    );
    return [];
  }

  const out: BackfillRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!row || row.length === 0) continue;
    const initials = String(row[iInit] ?? '').trim();
    const externalNumber = String(row[iExt] ?? '').trim();
    const homeroom = String(row[iHome] ?? '').trim();
    const grade = iGrade !== -1 ? String(row[iGrade] ?? '').trim() : undefined;
    if (!initials || !externalNumber || !homeroom) continue;
    out.push({ initials, externalNumber, homeroom, grade, rowIndex: r + 1 });
  }
  return out;
};

export async function parseBackfillFile(file: File): Promise<BackfillParseResult> {
  const warnings: string[] = [];
  const rows: BackfillRow[] = [];

  const isXlsx = /\.xlsx$|\.xls$/i.test(file.name);

  if (isXlsx) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      rows.push(...parseSheet(json, sheetName, warnings));
    }
  } else {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const matrix = lines.map(line => {
      const out: string[] = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ''; }
        else cur += ch;
      }
      out.push(cur.trim());
      return out;
    });
    rows.push(...parseSheet(matrix, 'CSV', warnings));
  }

  return { rows, totalRowsRead: rows.length, warnings };
}

export interface MatchPlan {
  matched: BackfillMatch[];
  alreadyCorrect: BackfillRow[];
  unmatched: BackfillRow[];
  ambiguous: { row: BackfillRow; candidateIds: string[] }[];
}

export function buildMatchPlan(
  rows: BackfillRow[],
  students: { id: string; initials: string; homeroom: string; grade?: string; externalStudentNumber?: string }[]
): MatchPlan {
  const matched: BackfillMatch[] = [];
  const alreadyCorrect: BackfillRow[] = [];
  const unmatched: BackfillRow[] = [];
  const ambiguous: { row: BackfillRow; candidateIds: string[] }[] = [];

  for (const row of rows) {
    const targetInit = normalizeInitials(row.initials);
    const targetHome = normalizeHomeroom(row.homeroom);

    let candidates = students.filter(
      s => normalizeInitials(s.initials) === targetInit && normalizeHomeroom(s.homeroom) === targetHome
    );

    // Tiebreaker: grade
    if (candidates.length > 1 && row.grade) {
      const byGrade = candidates.filter(s => String(s.grade ?? '').trim() === String(row.grade).trim());
      if (byGrade.length === 1) candidates = byGrade;
    }

    if (candidates.length === 0) {
      unmatched.push(row);
    } else if (candidates.length > 1) {
      ambiguous.push({ row, candidateIds: candidates.map(c => c.id) });
    } else {
      const s = candidates[0];
      if ((s.externalStudentNumber || '').trim() === row.externalNumber.trim()) {
        alreadyCorrect.push(row);
      } else {
        matched.push({ row, studentId: s.id, currentExternal: s.externalStudentNumber });
      }
    }
  }

  return { matched, alreadyCorrect, unmatched, ambiguous };
}
