import { useState, useCallback, useMemo } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './useAuth';
import { useStudents } from './useStudents';
import { parseCSV, detectColumnMapping, buildImportRows, generateErrorReportCSV, buildErrorSummary } from '@/lib/csvParser';
import { getPreset } from '@/lib/importPresets';
import type {
  ImportSource,
  WizardStep,
  ColumnMapping,
  ImportRow,
  ImportResult,
  ImportTemplate,
  InternalField,
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
}

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
    // Build rows + match students by studentNumber
    const rows = buildImportRows(state.rawRows, state.columnMapping);

    // Normalize identifier: trim, strip leading zeros (for numeric IDs)
    const normalize = (v: string | undefined): string => {
      if (!v) return '';
      const trimmed = v.trim();
      if (/^\d+$/.test(trimmed)) return trimmed.replace(/^0+/, '') || '0';
      return trimmed;
    };

    const matched = rows.map((row) => {
      const identifierIdx = state.columnMapping.studentIdentifier;
      const rawIdentifier = identifierIdx >= 0 ? row.rawValues[identifierIdx]?.trim() : '';
      const normIdentifier = normalize(rawIdentifier);

      // Extract CSV homeroom if mapped
      const classCodeIdx = state.columnMapping.classCode;
      const csvHomeroom = classCodeIdx >= 0 ? row.rawValues[classCodeIdx]?.trim() || '' : '';

      if (!rawIdentifier) return { ...row, csvHomeroom: csvHomeroom || undefined };

      // 3-tier match: stableStudentId → studentNumber → externalStudentNumber
      const student = students.find(s => normalize(s.stableStudentId) === normIdentifier)
        || students.find(s => normalize(s.studentNumber) === normIdentifier)
        || students.find(s => normalize(s.externalStudentNumber) === normIdentifier);

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
          matchedStudentInitials: student.initials || `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`,
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

    setState(s => ({ ...s, importRows: matched, step: WS.PreviewValidate }));
  }, [state.rawRows, state.columnMapping, students, studentsLoading]);

  // Step 4 → 5 Import
  const runImport = useCallback(async () => {
    if (!user || !state.source) return;

    setState(s => ({ ...s, importing: true }));

    const preset = getPreset(state.source);
    const validRows = state.importRows.filter(r => r.status !== 'error' && r.matchedStudentId);
    let importedCount = 0;
    let errorCount = 0;

    const columnNameMap: Record<string, string> = {};
    for (const [field, idx] of Object.entries(state.columnMapping)) {
      if (idx >= 0 && idx < state.headers.length) {
        columnNameMap[field] = state.headers[idx];
      }
    }

    const classSummary: Record<string, number> = {};

    for (const row of validRows) {
      try {
        const m = state.columnMapping;
        const getVal = (field: InternalField) =>
          m[field] >= 0 ? row.rawValues[m[field]]?.trim() || '' : '';

        const percentStr = getVal('percent');
        const percentVal = percentStr ? parseFloat(percentStr) : undefined;

        const classCode = row.csvHomeroom || getVal('classCode') || '';

        await addDoc(collection(db, 'benchmarks'), {
          schoolId: user.schoolId || '',
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
          date: row.parsedDate || new Date(),
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
        });
        importedCount++;

        // Track per-class summary
        const summaryKey = row.matchedHomeroom || classCode || 'Unknown';
        classSummary[summaryKey] = (classSummary[summaryKey] || 0) + 1;
      } catch {
        errorCount++;
      }
    }

    const unmatchedCount = state.importRows.filter(r => !r.matchedStudentId && r.status !== 'error').length;
    const result: ImportResult = {
      totalRows: state.importRows.length,
      importedRows: importedCount,
      skippedRows: state.importRows.length - validRows.length,
      unmatchedRows: unmatchedCount,
      errorRows: errorCount,
      classSummary: Object.keys(classSummary).length > 0 ? classSummary : undefined,
    };

    try {
      await addDoc(collection(db, 'benchmark_import_runs'), {
        schoolId: user.schoolId || '',
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
  }, [user, state.source, state.importRows, state.columnMapping, state.headers, state.fileName, onComplete]);

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
    setState(s => ({ ...s, columnMapping: template.columnMap }));
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
    });
  }, []);

  return {
    state,
    errorSummary,
    studentsLoading,
    setStep,
    selectSource,
    uploadFile,
    updateMapping,
    confirmMapping,
    runImport,
    loadTemplates,
    applyTemplate,
    saveTemplate,
    downloadErrorReport,
    reset,
  };
}