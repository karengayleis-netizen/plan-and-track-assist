import { useState, useCallback, useMemo } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { useStudents } from './useStudents';
import { parseCSV, detectColumnMapping, buildImportRows, generateErrorReportCSV, buildErrorSummary, validateStudentIdentifierMapping } from '@/lib/csvParser';
import { getPreset } from '@/lib/importPresets';
import type {
  ImportSource,
  WizardStep,
  ColumnMapping,
  ImportRow,
  ImportResult,
  ImportTemplate,
  InternalField,
  ImportIdDiagnosis,
} from '@/types/importWizard';
import { WizardStep as WS } from '@/types/importWizard';

export interface WizardState {
  step: WizardStep;
  source: ImportSource | null;
  fileName: string;
  headers: string[];
  rawRows: string[][];
  columnMapping: ColumnMapping;
  importRows: ImportRow[];
  result: ImportResult | null;
  importing: boolean;
  templates: ImportTemplate[];
  idDiagnosis: ImportIdDiagnosis;
}

const emptyDiagnosis = (): ImportIdDiagnosis => ({
  ran: false,
  loading: false,
  results: [],
});

const emptyMapping = (): ColumnMapping => {
  const m: Partial<ColumnMapping> = {};
  const fields: InternalField[] = [
    'studentIdentifier', 'assessmentType', 'score', 'date',
    'notes', 'ref', 'strand', 'benchmarkWindow', 'teacher',
    'classCode', 'rawScore', 'percent', 'status',
  ];
  for (const f of fields) m[f] = -1;
  return m as ColumnMapping;
};

export function useImportWizard(onComplete?: () => void) {
  const { user } = useAuth();
  const { students, loading: studentsLoading } = useStudents();

  const [state, setState] = useState<WizardState>({
    step: WS.ChooseSource,
    source: null,
    fileName: '',
    headers: [],
    rawRows: [],
    columnMapping: emptyMapping(),
    importRows: [],
    result: null,
    importing: false,
    templates: [],
    idDiagnosis: emptyDiagnosis(),
  });

  const setStep = (step: WizardStep) => setState(s => ({ ...s, step }));

  // Step 1
  const selectSource = useCallback((source: ImportSource) => {
    setState(s => ({ ...s, source, step: WS.UploadCSV }));
  }, []);

  // Step 2
  const uploadFile = useCallback((file: File) => {
    file.text().then(text => {
      const { headers, rows } = parseCSV(text);
      const source = state.source || 'generic_csv';
      const mapping = detectColumnMapping(headers, source);

      const idValidity = validateStudentIdentifierMapping(mapping.studentIdentifier, headers);
      let reasonStr = 'ok';
      if (idValidity.valid === false) {
        reasonStr = idValidity.reason;
      }
      const sampleVals = idValidity.valid
        ? rows.slice(0, 5).map(r => r[idValidity.columnIndex]?.trim() || '')
        : [];
      console.log('[ImportWizard] Auto-detect studentIdentifier:', {
        source: 'auto-detect',
        columnIndex: mapping.studentIdentifier,
        headerName: idValidity.headerName,
        valid: idValidity.valid,
        reason: reasonStr,
        first5Values: sampleVals,
      });

      setState(s => ({
        ...s,
        fileName: file.name,
        headers,
        rawRows: rows,
        columnMapping: mapping,
        step: WS.MapColumns,
      }));
    });
  }, [state.source]);

  // Step 3
  const updateMapping = useCallback((field: InternalField, colIndex: number) => {
    setState(s => ({
      ...s,
      columnMapping: { ...s.columnMapping, [field]: colIndex },
    }));
  }, []);

  const confirmMapping = useCallback(() => {
    // Guard: do not run matching while roster is still loading — would produce false unmatched
    if (studentsLoading) {
      console.warn('[ImportWizard] confirmMapping called before students loaded — skipping');
      return;
    }

    // Hard block: identifier must be valid (in allow-list, not in deny-list).
    const idValidity = validateStudentIdentifierMapping(state.columnMapping.studentIdentifier, state.headers);
    let validReason = 'ok';
    if (idValidity.valid === false) {
      validReason = idValidity.reason;
    }
    const sample = idValidity.valid
      ? state.rawRows.slice(0, 5).map(r => r[idValidity.columnIndex]?.trim() || '')
      : [];
    console.log('[ImportWizard] confirmMapping studentIdentifier check:', {
      columnIndex: state.columnMapping.studentIdentifier,
      headerName: idValidity.headerName,
      valid: idValidity.valid,
      reason: validReason,
      first5Values: sample,
    });
    if (!idValidity.valid) {
      console.warn('[ImportWizard] confirmMapping blocked — invalid studentIdentifier mapping');
      return;
    }

    // Build rows + match students by board studentNumber ONLY (active students only).
    const rows = buildImportRows(state.rawRows, state.columnMapping);

    const normalize = (v: unknown): string =>
      String(v ?? '').trim().replace(/\.0$/, '');

    const byStudentNumber = new Map<string, typeof students[number]>();
    for (const s of students) {
      if (s.active === false) continue;
      const num = normalize(s.studentNumber);
      if (num && !byStudentNumber.has(num)) byStudentNumber.set(num, s);
    }

    console.log('[ImportWizard] Roster indexed for matching (studentNumber-only):', {
      activeRosterCount: byStudentNumber.size,
      totalRosterDocs: students.length,
      sampleStudentNumber: Array.from(byStudentNumber.keys()).slice(0, 5),
    });

    let firstMissLogged = 0;

    const matched = rows.map((row) => {
      const identifierIdx = state.columnMapping.studentIdentifier;
      const rawIdentifier = identifierIdx >= 0 ? row.rawValues[identifierIdx] : '';
      const normIdentifier = normalize(rawIdentifier);

      const classCodeIdx = state.columnMapping.classCode;
      const csvHomeroom = classCodeIdx >= 0 ? row.rawValues[classCodeIdx]?.trim() || '' : '';

      if (!normIdentifier) return { ...row, csvHomeroom: csvHomeroom || undefined };

      const student = byStudentNumber.get(normIdentifier);

      if (!student && firstMissLogged < 5) {
        firstMissLogged++;
        console.log('[ImportWizard] No match for row', row.rowIndex, {
          rawIdentifier: String(rawIdentifier ?? ''),
          normalized: normIdentifier,
          csvHomeroom,
        });
      }

      if (student) {
        const matchedHomeroom = student.homeroom || '';
        const homeroomMismatch = csvHomeroom && matchedHomeroom && csvHomeroom !== matchedHomeroom;
        const warnings = [...row.warnings];
        if (homeroomMismatch) {
          warnings.push(`Homeroom mismatch: CSV says "${csvHomeroom}" but student is in "${matchedHomeroom}"`);
        }

        return {
          ...row,
          matchedStudentId: student.id,
          matchedStudentNumber: student.studentNumber,
          matchedStudentInitials: student.initials || '',
          csvHomeroom: csvHomeroom || undefined,
          matchedHomeroom: matchedHomeroom || undefined,
          status: row.status === 'error' ? 'error' as const : (homeroomMismatch ? 'warning' as const : row.status),
          warnings,
        };
      }

      return {
        ...row,
        csvHomeroom: csvHomeroom || undefined,
        status: row.errors.length > 0 ? 'error' as const : 'warning' as const,
        warnings: [...row.warnings, 'No student match found'],
      };
    });

    setState(s => ({
      ...s,
      importRows: matched,
      step: WS.PreviewValidate,
      idDiagnosis: { ran: false, loading: false, results: [] },
    }));
  }, [state.rawRows, state.columnMapping, students, studentsLoading]);

  // Step 4 → 5 Import
  const runImport = useCallback(async () => {
    if (!user || !state.source) return;

    // Hard block: identifier mapping must still be valid before importing.
    const idValidity = validateStudentIdentifierMapping(state.columnMapping.studentIdentifier, state.headers);
    let runReason = 'ok';
    if (idValidity.valid === false) {
      runReason = idValidity.reason;
    }
    const sample = idValidity.valid
      ? state.rawRows.slice(0, 5).map(r => r[idValidity.columnIndex]?.trim() || '')
      : [];
    console.log('[ImportWizard] runImport studentIdentifier check:', {
      columnIndex: state.columnMapping.studentIdentifier,
      headerName: idValidity.headerName,
      valid: idValidity.valid,
      reason: runReason,
      first5Values: sample,
    });
    if (!idValidity.valid) {
      console.warn('[ImportWizard] runImport blocked — invalid studentIdentifier mapping');
      return;
    }

    // Hard guard: must have a non-empty schoolId before writing 971 docs that
    // would all be rejected by Firestore rules with PERMISSION_DENIED.
    const schoolIdUsed = (user.schoolId || '').trim();
    if (!schoolIdUsed) {
      console.error('[ImportWizard] runImport aborted — user.schoolId is empty', { user });
      const blockedResult: ImportResult = {
        totalRows: state.importRows.length,
        importedRows: 0,
        skippedRows: 0,
        unmatchedRows: state.importRows.filter(r => !r.matchedStudentId && r.status !== 'error').length,
        errorRows: 0,
        failedToSaveRows: 0,
        writeErrors: ['Aborted before writing: your account is not assigned to a school (schoolId is empty). Reload the page and try again, or contact support.'],
        attemptedRows: 0,
        accountedFor: 0,
        unaccountedFor: state.importRows.length,
        schoolIdUsed: '',
        loopAborted: true,
        loopAbortReason: 'empty-schoolId',
      };
      setState(s => ({ ...s, result: blockedResult, importing: false, step: WS.ImportResults }));
      return;
    }

    setState(s => ({ ...s, importing: true }));

    const preset = getPreset(state.source);
    const validRows = state.importRows.filter(r => r.status !== 'error' && r.matchedStudentId);
    const attemptedCount = validRows.length;
    let importedCount = 0;
    let errorCount = 0;
    let loopAborted = false;
    let loopAbortReason = '';
    let lastErrorCode = '';

    console.log('[ImportWizard] runImport starting', {
      totalRows: state.importRows.length,
      validRows: attemptedCount,
      schoolId: schoolIdUsed,
    });

    const columnNameMap: Record<string, string> = {};
    for (const [field, idx] of Object.entries(state.columnMapping)) {
      if (idx >= 0 && idx < state.headers.length) {
        columnNameMap[field] = state.headers[idx];
      }
    }

    const classSummary: Record<string, number> = {};
    const writeErrors: string[] = [];

    try {
      for (const row of validRows) {
        const m = state.columnMapping;
        const getVal = (field: InternalField) =>
          m[field] >= 0 ? row.rawValues[m[field]]?.trim() || '' : '';

        const percentStr = getVal('percent');
        const percentVal = percentStr ? parseFloat(percentStr) : undefined;
        const classCode = row.csvHomeroom || getVal('classCode') || '';
        const safeDate = row.parsedDate && !isNaN(row.parsedDate.getTime())
          ? row.parsedDate
          : new Date();

        const payload = {
          schoolId: schoolIdUsed,
          studentId: row.matchedStudentId,
          studentNumber: row.matchedStudentNumber || '',
          initials: row.matchedStudentInitials || '',
          source: state.source,
          assessmentFamily: preset.assessmentFamily,
          assessmentType: row.assessmentType,
          assessmentName: row.assessmentType,
          score: row.score,
          scoreLabel: getVal('status') || undefined,
          rawScore: getVal('rawScore') || undefined,
          maxScore: 100,
          percent: percentVal,
          percentage: percentVal || 0,
          benchmarkWindow: getVal('benchmarkWindow') || undefined,
          strand: getVal('strand') || undefined,
          classCode: classCode || undefined,
          subject: preset.assessmentFamily === 'reading' ? 'Language Arts' : preset.assessmentFamily === 'math' ? 'Mathematics' : '',
          date: safeDate,
          term: getVal('benchmarkWindow') || '',
          notes: getVal('notes') || undefined,
          ref: getVal('ref') || undefined,
          reference: getVal('ref') || undefined,
          importedAt: new Date(),
          importedBy: user.uid,
          rawImportMeta: {
            fileName: state.fileName,
            columnMapping: columnNameMap,
          },
          createdAt: new Date(),
        };

        try {
          await addDoc(collection(db, 'benchmarks'), payload);
          importedCount++;

          // Track per-class summary
          const summaryKey = row.matchedHomeroom || classCode || 'Unknown';
          classSummary[summaryKey] = (classSummary[summaryKey] || 0) + 1;
        } catch (err) {
          errorCount++;
          const e = err as { code?: string; message?: string };
          const code = e?.code || 'unknown';
          const msg = e?.message || String(err);
          lastErrorCode = code;
          console.error('[ImportWizard] addDoc failed for row', row.rowIndex, {
            code,
            message: msg,
            studentId: row.matchedStudentId,
            studentNumber: row.matchedStudentNumber,
            schoolId: schoolIdUsed,
            assessmentType: row.assessmentType,
            score: row.score,
            payload,
          });
          if (writeErrors.length < 5) {
            writeErrors.push(
              `Row ${row.rowIndex + 2} · student ${row.matchedStudentNumber || '?'} · [${code}] ${msg}`
            );
          }
        }
      }
    } catch (loopErr) {
      loopAborted = true;
      const e = loopErr as { code?: string; message?: string };
      loopAbortReason = `${e?.code || 'unknown'}: ${e?.message || String(loopErr)}`;
      console.error('[ImportWizard] Loop aborted unexpectedly:', loopErr);
      writeErrors.push(`Loop aborted: ${loopAbortReason}`);
    }

    const unmatchedCount = state.importRows.filter(r => !r.matchedStudentId && r.status !== 'error').length;
    const skippedCount = state.importRows.length - attemptedCount - unmatchedCount;
    const accountedFor = importedCount + errorCount + skippedCount + unmatchedCount;
    const unaccountedFor = state.importRows.length - accountedFor;

    if (unaccountedFor !== 0) {
      console.error('[ImportWizard] COUNT MISMATCH', {
        total: state.importRows.length,
        attempted: attemptedCount,
        imported: importedCount,
        errors: errorCount,
        skipped: skippedCount,
        unmatched: unmatchedCount,
        accountedFor,
        unaccountedFor,
      });
    }

    const result: ImportResult = {
      totalRows: state.importRows.length,
      importedRows: importedCount,
      skippedRows: skippedCount,
      unmatchedRows: unmatchedCount,
      errorRows: errorCount,
      failedToSaveRows: errorCount,
      writeErrors,
      classSummary: Object.keys(classSummary).length > 0 ? classSummary : undefined,
      attemptedRows: attemptedCount,
      accountedFor,
      unaccountedFor,
      lastErrorCode: lastErrorCode || undefined,
      schoolIdUsed,
      loopAborted,
      loopAbortReason: loopAbortReason || undefined,
    };

    try {
      await addDoc(collection(db, 'benchmark_import_runs'), {
        schoolId: schoolIdUsed,
        source: state.source,
        fileName: state.fileName,
        totalRows: result.totalRows,
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        unmatchedRows: result.unmatchedRows,
        importedBy: user.uid,
        createdAt: new Date(),
      });
    } catch {
      // non-critical
    }

    setState(s => ({ ...s, result, importing: false, step: WS.ImportResults }));
    onComplete?.();
  }, [user, state.source, state.importRows, state.columnMapping, state.headers, state.fileName, state.rawRows, onComplete]);

  // Probe: try to write exactly ONE benchmark doc to surface the raw Firestore error.
  // Used from the Results screen when 0 imported and 0 failed-to-save (the impossible case).
  const probeWrite = useCallback(async (): Promise<{
    ok: boolean;
    code?: string;
    message?: string;
    rowNumber?: number;
    studentNumber?: string;
    schoolIdUsed?: string;
    payload?: Record<string, unknown>;
  }> => {
    if (!user || !state.source) return { ok: false, message: 'No user/source' };
    const schoolIdUsed = (user.schoolId || '').trim();
    if (!schoolIdUsed) return { ok: false, code: 'empty-schoolId', message: 'user.schoolId is empty', schoolIdUsed: '' };
    const firstMatched = state.importRows.find(r => r.matchedStudentId && r.status !== 'error');
    if (!firstMatched) return { ok: false, message: 'No matched row available to probe', schoolIdUsed };

    const preset = getPreset(state.source);
    const m = state.columnMapping;
    const getVal = (field: InternalField) =>
      m[field] >= 0 ? firstMatched.rawValues[m[field]]?.trim() || '' : '';
    const classCode = firstMatched.csvHomeroom || getVal('classCode') || '';
    const safeDate = firstMatched.parsedDate && !isNaN(firstMatched.parsedDate.getTime())
      ? firstMatched.parsedDate
      : new Date();

    const payload = {
      schoolId: schoolIdUsed,
      studentId: firstMatched.matchedStudentId,
      studentNumber: firstMatched.matchedStudentNumber || '',
      initials: firstMatched.matchedStudentInitials || '',
      source: state.source,
      assessmentFamily: preset.assessmentFamily,
      assessmentType: firstMatched.assessmentType || 'PROBE',
      assessmentName: firstMatched.assessmentType || 'PROBE',
      score: firstMatched.score || '0',
      scoreLabel: getVal('status') || undefined,
      benchmarkWindow: getVal('benchmarkWindow') || undefined,
      classCode: classCode || undefined,
      date: safeDate,
      importedAt: new Date(),
      importedBy: user.uid,
      createdAt: new Date(),
      probe: true,
    };

    try {
      await addDoc(collection(db, 'benchmarks'), payload);
      console.log('[ImportWizard] probeWrite SUCCEEDED', { payload });
      return {
        ok: true,
        rowNumber: firstMatched.rowIndex + 2,
        studentNumber: firstMatched.matchedStudentNumber,
        schoolIdUsed,
        payload,
      };
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.error('[ImportWizard] probeWrite FAILED', {
        code: e?.code,
        message: e?.message,
        rowNumber: firstMatched.rowIndex + 2,
        studentNumber: firstMatched.matchedStudentNumber,
        schoolIdUsed,
        payload,
        raw: err,
      });
      return {
        ok: false,
        code: e?.code,
        message: e?.message || String(err),
        rowNumber: firstMatched.rowIndex + 2,
        studentNumber: firstMatched.matchedStudentNumber,
        schoolIdUsed,
        payload,
      };
    }
  }, [user, state.source, state.importRows, state.columnMapping]);


  // Step 6: Templates
  const loadTemplates = useCallback(async () => {
    if (!user?.schoolId || !state.source) return;
    try {
      const q = query(
        collection(db, 'benchmark_import_templates'),
        where('schoolId', '==', user.schoolId),
        where('source', '==', state.source),
      );
      const snap = await getDocs(q);
      const templates = snap.docs.map(d => ({ id: d.id, ...d.data() } as ImportTemplate));
      setState(s => ({ ...s, templates }));
    } catch {
      // ignore
    }
  }, [user?.schoolId, state.source]);

  const applyTemplate = useCallback((template: ImportTemplate) => {
    setState(s => {
      const incoming = { ...template.columnMap };
      // Revalidate the template's identifier choice against current file's headers.
      const v = validateStudentIdentifierMapping(incoming.studentIdentifier, s.headers);
      let tplReason = 'ok';
      if (v.valid === false) tplReason = v.reason;
      console.log('[ImportWizard] Template applied — studentIdentifier check:', {
        source: 'template',
        columnIndex: incoming.studentIdentifier,
        headerName: v.headerName,
        valid: v.valid,
        reason: tplReason,
      });
      if (!v.valid) {
        // Refuse to carry over a denied/non-allowed identifier mapping.
        incoming.studentIdentifier = -1;
      }
      return { ...s, columnMapping: incoming };
    });
  }, []);

  const saveTemplate = useCallback(async (name: string) => {
    if (!user?.schoolId || !state.source) return;
    await addDoc(collection(db, 'benchmark_import_templates'), {
      schoolId: user.schoolId,
      source: state.source,
      templateName: name,
      columnMap: state.columnMapping,
      createdBy: user.uid,
      createdAt: new Date(),
    });
    await loadTemplates();
  }, [user, state.source, state.columnMapping, loadTemplates]);

  const errorSummary = useMemo(
    () => buildErrorSummary(state.importRows, state.headers),
    [state.importRows, state.headers]
  );

  const downloadErrorReport = useCallback(() => {
    const csv = generateErrorReportCSV(state.importRows, state.headers);
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_errors_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.importRows, state.headers]);

  const reset = useCallback(() => {
    setState({
      step: WS.ChooseSource,
      source: null,
      fileName: '',
      headers: [],
      rawRows: [],
      columnMapping: emptyMapping(),
      importRows: [],
      result: null,
      importing: false,
      templates: [],
      idDiagnosis: emptyDiagnosis(),
    });
  }, []);

  return {
    state,
    errorSummary,
    studentsLoading,
    students,
    setStep,
    selectSource,
    uploadFile,
    updateMapping,
    confirmMapping,
    runImport,
    probeWrite,
    loadTemplates,
    applyTemplate,
    saveTemplate,
    downloadErrorReport,
    reset,
  };
}