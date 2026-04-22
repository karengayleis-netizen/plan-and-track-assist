import * as XLSX from 'xlsx';

export type MatchSource = 'codedId' | 'initialsHomeroom';

export interface BackfillRow {
  initials: string;
  externalNumber: string;       // board ID e.g., "1027516"
  homeroom: string;             // section / class code e.g., "1AF"
  rosterNumber?: string;        // ordinal student # within class e.g., "3"
  derivedCodedId?: string;      // "1AF-3" if both section + roster# present
  grade?: string;
  rowIndex: number;
}

export interface BackfillMatch {
  row: BackfillRow;
  studentId: string;
  matchSource: MatchSource;
  currentExternal?: string;
}

export interface DetectedColumns {
  initials: string | null;
  externalNumber: string | null;
  homeroom: string | null;
  rosterNumber: string | null;
  grade: string | null;
}

export interface BackfillParseResult {
  rows: BackfillRow[];
  totalRowsRead: number;
  warnings: string[];
  detectedColumns: DetectedColumns;
  sampleRows: BackfillRow[];
  allHeaders: string[];
}

const HEADER_ALIASES = {
  initials: ['student initials', 'initials'],
  externalNumber: ['student number', 'board number', 'external student number', 'sis id', 'board student number'],
  homeroom: ['section number', 'section', 'homeroom', 'class', 'class name'],
  rosterNumber: ['student #', 'student number in class', 'roster number', 'number', 'student no', 'student no.', '#'],
  grade: ['grade', 'year group'],
};

export const normalizeInitials = (s: string): string =>
  (s || '').replace(/\./g, '').toUpperCase().trim();

export const normalizeHomeroom = (s: string): string =>
  (s || '').toUpperCase().trim();

const cleanCell = (v: unknown): string => {
  if (v == null) return '';
  let s = String(v).trim();
  // strip Excel-trailing ".0" on numeric-coerced ints
  if (/^\d+\.0+$/.test(s)) s = s.replace(/\.0+$/, '');
  return s;
};

const findHeaderIndex = (headers: string[], aliases: string[]): number => {
  const lower = headers.map(h => (h || '').toString().toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
};

interface SheetParseResult {
  rows: BackfillRow[];
  detected: DetectedColumns;
  headers: string[];
}

const parseSheet = (rows: unknown[][], sheetName: string, warnings: string[]): SheetParseResult => {
  if (rows.length < 2) return { rows: [], detected: { initials: null, externalNumber: null, homeroom: null, rosterNumber: null, grade: null }, headers: [] };
  const headers = (rows[0] as unknown[]).map(c => (c == null ? '' : String(c)));

  const iInit = findHeaderIndex(headers, HEADER_ALIASES.initials);
  const iExt = findHeaderIndex(headers, HEADER_ALIASES.externalNumber);
  const iHome = findHeaderIndex(headers, HEADER_ALIASES.homeroom);
  const iRoster = findHeaderIndex(headers, HEADER_ALIASES.rosterNumber);
  const iGrade = findHeaderIndex(headers, HEADER_ALIASES.grade);

  const detected: DetectedColumns = {
    initials: iInit !== -1 ? headers[iInit] : null,
    externalNumber: iExt !== -1 ? headers[iExt] : null,
    homeroom: iHome !== -1 ? headers[iHome] : null,
    rosterNumber: iRoster !== -1 ? headers[iRoster] : null,
    grade: iGrade !== -1 ? headers[iGrade] : null,
  };

  if (iInit === -1 || iExt === -1 || iHome === -1) {
    warnings.push(
      `Sheet "${sheetName}": missing required column(s). Need Initials, Student/Board Number, and Section/Homeroom. Found headers: ${headers.join(', ')}`
    );
    return { rows: [], detected, headers };
  }

  if (iRoster === -1) {
    warnings.push(
      `Sheet "${sheetName}": no "Student #" / roster ordinal column detected. Falling back to initials+homeroom matching for this sheet.`
    );
  }

  const out: BackfillRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!row || row.length === 0) continue;
    const initials = cleanCell(row[iInit]);
    const externalNumber = cleanCell(row[iExt]);
    const homeroom = cleanCell(row[iHome]);
    const rosterNumber = iRoster !== -1 ? cleanCell(row[iRoster]) : '';
    const grade = iGrade !== -1 ? cleanCell(row[iGrade]) : undefined;
    if (!initials || !externalNumber || !homeroom) continue;

    const derivedCodedId =
      rosterNumber && homeroom ? `${normalizeHomeroom(homeroom)}-${rosterNumber}` : undefined;

    out.push({
      initials,
      externalNumber,
      homeroom,
      rosterNumber: rosterNumber || undefined,
      derivedCodedId,
      grade,
      rowIndex: r + 1,
    });
  }
  return { rows: out, detected, headers };
};

export async function parseBackfillFile(file: File): Promise<BackfillParseResult> {
  const warnings: string[] = [];
  const rows: BackfillRow[] = [];
  let detectedColumns: DetectedColumns = { initials: null, externalNumber: null, homeroom: null, rosterNumber: null, grade: null };
  let allHeaders: string[] = [];

  const isXlsx = /\.xlsx$|\.xls$/i.test(file.name);

  const mergeDetected = (d: DetectedColumns) => {
    detectedColumns = {
      initials: detectedColumns.initials ?? d.initials,
      externalNumber: detectedColumns.externalNumber ?? d.externalNumber,
      homeroom: detectedColumns.homeroom ?? d.homeroom,
      rosterNumber: detectedColumns.rosterNumber ?? d.rosterNumber,
      grade: detectedColumns.grade ?? d.grade,
    };
  };

  if (isXlsx) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      const result = parseSheet(json, sheetName, warnings);
      rows.push(...result.rows);
      mergeDetected(result.detected);
      if (result.headers.length && !allHeaders.length) allHeaders = result.headers;
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
    const result = parseSheet(matrix, 'CSV', warnings);
    rows.push(...result.rows);
    mergeDetected(result.detected);
    allHeaders = result.headers;
  }

  return {
    rows,
    totalRowsRead: rows.length,
    warnings,
    detectedColumns,
    sampleRows: rows.slice(0, 5),
    allHeaders,
  };
}

export interface MatchPlan {
  matched: BackfillMatch[];
  alreadyCorrect: BackfillRow[];
  unmatched: BackfillRow[];
  ambiguous: { row: BackfillRow; candidateIds: string[] }[];
  // diagnostics
  matchedByCodedId: number;
  matchedByInitials: number;
  missingRosterNumber: number;
  missingSection: number;
  derivedIdNotInRoster: number;
}

interface RosterStudent {
  id: string;
  initials: string;
  homeroom: string;
  grade?: string;
  externalStudentNumber?: string;
  stableStudentId?: string;
  studentNumber?: string;
}

export function buildMatchPlan(rows: BackfillRow[], students: RosterStudent[]): MatchPlan {
  const matched: BackfillMatch[] = [];
  const alreadyCorrect: BackfillRow[] = [];
  const unmatched: BackfillRow[] = [];
  const ambiguous: { row: BackfillRow; candidateIds: string[] }[] = [];

  let matchedByCodedId = 0;
  let matchedByInitials = 0;
  let missingRosterNumber = 0;
  let missingSection = 0;
  let derivedIdNotInRoster = 0;

  // Index roster by stableStudentId / studentNumber for fast lookup
  const byCodedId = new Map<string, RosterStudent>();
  for (const s of students) {
    if (s.stableStudentId) byCodedId.set(s.stableStudentId.trim().toUpperCase(), s);
    if (s.studentNumber) byCodedId.set(s.studentNumber.trim().toUpperCase(), s);
  }

  for (const row of rows) {
    if (!row.homeroom) missingSection++;
    if (!row.rosterNumber) missingRosterNumber++;

    let chosen: RosterStudent | undefined;
    let source: MatchSource | undefined;

    // 1) Try derived coded ID
    if (row.derivedCodedId) {
      const key = row.derivedCodedId.toUpperCase();
      const hit = byCodedId.get(key);
      if (hit) {
        chosen = hit;
        source = 'codedId';
      } else {
        derivedIdNotInRoster++;
      }
    }

    // 2) Fallback: initials + homeroom
    if (!chosen) {
      const targetInit = normalizeInitials(row.initials);
      const targetHome = normalizeHomeroom(row.homeroom);
      let candidates = students.filter(
        s => normalizeInitials(s.initials) === targetInit && normalizeHomeroom(s.homeroom) === targetHome
      );
      if (candidates.length > 1 && row.grade) {
        const byGrade = candidates.filter(s => String(s.grade ?? '').trim() === String(row.grade).trim());
        if (byGrade.length === 1) candidates = byGrade;
      }
      if (candidates.length === 0) {
        unmatched.push(row);
        continue;
      } else if (candidates.length > 1) {
        ambiguous.push({ row, candidateIds: candidates.map(c => c.id) });
        continue;
      }
      chosen = candidates[0];
      source = 'initialsHomeroom';
    }

    if (!chosen || !source) {
      unmatched.push(row);
      continue;
    }

    if ((chosen.externalStudentNumber || '').trim() === row.externalNumber.trim()) {
      alreadyCorrect.push(row);
    } else {
      matched.push({
        row,
        studentId: chosen.id,
        matchSource: source,
        currentExternal: chosen.externalStudentNumber,
      });
      if (source === 'codedId') matchedByCodedId++;
      else matchedByInitials++;
    }
  }

  return {
    matched,
    alreadyCorrect,
    unmatched,
    ambiguous,
    matchedByCodedId,
    matchedByInitials,
    missingRosterNumber,
    missingSection,
    derivedIdNotInRoster,
  };
}
