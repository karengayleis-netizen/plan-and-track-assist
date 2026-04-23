import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudents } from '@/hooks/useStudents';
import { useClasses } from '@/hooks/useClasses';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { useMarkbook } from '@/hooks/useMarkbook';
import { useAuth } from '@/hooks/useAuth';
import { Search, RefreshCw, Upload, Edit, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatGradeDisplay, parseGradeToNumber } from '@/types/homeroom';
import { Student, STUDENT_TAGS } from '@/types';
import { freshnessLabel, isStale } from '@/lib/freshness';
import { StudentSummaryPanel } from '@/components/students/StudentSummaryPanel';
import { BulkActionsBar } from '@/components/students/BulkActionsBar';
import { TagInput } from '@/components/ui/tag-input';
import { Badge } from '@/components/ui/badge';
import { parseBackfillFile, buildMatchPlan, type MatchPlan, type BackfillRow, type DetectedColumns } from '@/lib/backfillParser';

export function StudentsTab() {
  const { user } = useAuth();
  const { students, loading, addStudent, updateStudent, deleteStudent, refetch } = useStudents();
  const { benchmarks } = useBenchmarks();
  const { entries: markbookEntries } = useMarkbook();
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [summaryStudent, setSummaryStudent] = useState<Student | null>(null);
  const [editFocus, setEditFocus] = useState(false);
  const [editHighNeed, setEditHighNeed] = useState(false);
  const [editGender, setEditGender] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editExternalNumber, setEditExternalNumber] = useState('');
  const { classes, loading: classesLoading, getClassByCode } = useClasses();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterTag, setFilterTag] = useState('all');

  // Backfill state
  const backfillInputRef = useRef<HTMLInputElement>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillPlan, setBackfillPlan] = useState<MatchPlan | null>(null);
  const [backfillWarnings, setBackfillWarnings] = useState<string[]>([]);
  const [backfillDetected, setBackfillDetected] = useState<DetectedColumns | null>(null);
  const [backfillSampleRows, setBackfillSampleRows] = useState<BackfillRow[]>([]);
  const [backfillCommitting, setBackfillCommitting] = useState(false);
  const [backfillTraceQuery, setBackfillTraceQuery] = useState('');
  const [backfillResults, setBackfillResults] = useState<Array<{ studentId: string; studentNumber: string; externalNumber: string; status: 'updated' | 'failed'; error?: string }> | null>(null);
  const [backfillVerifyMisses, setBackfillVerifyMisses] = useState<Array<{ studentId: string; studentNumber: string; expected: string }>>([]);
  const [backfillFile, setBackfillFile] = useState<File | null>(null);
  const [backfillAllHeaders, setBackfillAllHeaders] = useState<string[]>([]);
  const [backfillColumnOverride, setBackfillColumnOverride] = useState<string | null>(null);
  const [backfillReparsing, setBackfillReparsing] = useState(false);
  
  // Form state for manual add
  const [studentNumber, setStudentNumber] = useState('');
  const [initials, setInitials] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [isFocusStudent, setIsFocusStudent] = useState(false);
  const [isHighNeed, setIsHighNeed] = useState(false);
  const [selectedGender, setSelectedGender] = useState('');

  // Get selected class details
  const selectedClass = classes.find(c => c.id === selectedClassId);

  // Parse CSV line (handles quoted values with commas)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    
    return result;
  };

  // Validate grade against homeroom's allowedGrades
  const validateGradeForHomeroom = (gradeStr: string, homeroom: typeof selectedClass): { valid: boolean; gradeNum: number | null; error?: string } => {
    if (!homeroom) {
      return { valid: false, gradeNum: null, error: 'No homeroom selected' };
    }

    const gradeNum = parseGradeToNumber(gradeStr);
    if (gradeNum === null) {
      return { valid: false, gradeNum: null, error: `Invalid grade: "${gradeStr}"` };
    }

    if (!homeroom.allowedGrades.includes(gradeNum)) {
      const allowed = homeroom.allowedGrades.map(g => formatGradeDisplay(g)).join(', ');
      return { 
        valid: false, 
        gradeNum, 
        error: `Grade ${formatGradeDisplay(gradeNum)} not allowed in ${homeroom.code}. Allowed: ${allowed}` 
      };
    }

    return { valid: true, gradeNum };
  };

  // Handle CSV upload - format: StudentNumber, Initials, Grade, Gender
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedClass) {
      toast.error('Please select a homeroom first');
      return;
    }

    setIsUploading(true);
    
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header row if present
      const headerLine = lines[0]?.toLowerCase() || '';
      const hasHeader = headerLine.includes('student') || 
                       headerLine.includes('number') || 
                       headerLine.includes('initial') ||
                       headerLine.includes('grade');
      const startIndex = hasHeader ? 1 : 0;
      
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        
        // Expected format: StudentNumber, Initials, Grade, Gender, ExternalStudentNumber
        // (Gender + ExternalStudentNumber optional)
        if (values.length < 3) {
          errors.push(`Row ${i + 1}: Expected at least 3 columns (StudentNumber, Initials, Grade), got ${values.length}`);
          errorCount++;
          continue;
        }

        const [number, studentInitials, gradeStr, genderStr, externalNumStr] = values;
        
        // Validate grade against homeroom
        const gradeValidation = validateGradeForHomeroom(gradeStr, selectedClass);
        if (!gradeValidation.valid) {
          errors.push(`Row ${i + 1}: ${gradeValidation.error}`);
          errorCount++;
          continue;
        }

        // Generate coded student number: homeroom-number (e.g., "2AF-1")
        const codedStudentNumber = `${selectedClass.code}-${number.trim()}`;
        const stableId = `${selectedClass.code}-${number.trim()}`.trim();
        const externalNumber = externalNumStr?.trim() || '';

        try {
          // Check if student already exists — update externalStudentNumber instead of duplicate-error
          const existing = students.find(s => s.stableStudentId === stableId);
          if (existing) {
            if (externalNumber && existing.externalStudentNumber !== externalNumber) {
              await updateStudent(existing.id, { externalStudentNumber: externalNumber });
              successCount++;
            } else {
              errors.push(`Row ${i + 1}: ${codedStudentNumber} already exists (no changes)`);
              errorCount++;
            }
            continue;
          }

          await addStudent({
            stableStudentId: stableId,
            studentNumber: codedStudentNumber,
            externalStudentNumber: externalNumber || undefined,
            initials: studentInitials.trim(),
            firstName: '',
            lastName: '',
            grade: String(gradeValidation.gradeNum),
            homeroom: selectedClass.code,
            yearGroup: '',
            className: selectedClass.name || selectedClass.code,
            sen: false,
            pupilPremium: false,
            eal: false,
            isFocusStudent: false,
            isHighNeed: false,
            gender: genderStr?.trim().toUpperCase() || '',
          });
          successCount++;
        } catch (err) {
          errors.push(`Row ${i + 1}: Failed to save student`);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} student(s)`);
      }
      if (errorCount > 0) {
        toast.warning(`${errorCount} row(s) could not be imported`);
        errors.slice(0, 5).forEach(err => console.warn(err));
        if (errors.length > 5) {
          console.warn(`... and ${errors.length - 5} more errors`);
        }
      }
    } catch (err) {
      toast.error('Failed to parse CSV file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleSaveStudent = async () => {
    if (!selectedClass) {
      toast.error('Please select a homeroom first');
      return;
    }
    if (!studentNumber.trim()) {
      toast.error('Please enter a student number');
      return;
    }
    if (!selectedGrade) {
      toast.error('Please select a grade');
      return;
    }

    // Validate grade against homeroom
    const gradeValidation = validateGradeForHomeroom(selectedGrade, selectedClass);
    if (!gradeValidation.valid) {
      toast.error(gradeValidation.error);
      return;
    }

    const codedStudentNumber = `${selectedClass.code}-${studentNumber.trim()}`;
    const stableId = codedStudentNumber.trim();
    
    try {
      await addStudent({
        stableStudentId: stableId,
        studentNumber: codedStudentNumber,
        initials: initials.trim(),
        firstName: '',
        lastName: '',
        grade: selectedGrade,
        homeroom: selectedClass.code,
        yearGroup: selectedGrade,
        className: selectedClass.name || selectedClass.code,
        sen: false,
        pupilPremium: false,
        eal: false,
        isFocusStudent,
        isHighNeed,
        gender: selectedGender || '',
      });
      toast.success('Student saved successfully');
      setStudentNumber('');
      setInitials('');
      setSelectedGrade('');
      setIsFocusStudent(false);
      setIsHighNeed(false);
      setSelectedGender('');
    } catch (err) {
      toast.error('Failed to save student');
    }
  };

  const handleDeleteStudent = async (id: string, number: string) => {
    if (confirm(`Delete student ${number}?`)) {
      try {
        await deleteStudent(id);
        toast.success('Student deleted');
      } catch (err) {
        toast.error('Failed to delete student');
      }
    }
  };

  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    setEditFocus(student.isFocusStudent);
    setEditHighNeed(student.isHighNeed);
    setEditGender(student.gender || '');
    setEditTags(student.tags || []);
    setEditExternalNumber(student.externalStudentNumber || '');
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    try {
      const updates: Partial<Student> = {
        isFocusStudent: editFocus,
        isHighNeed: editHighNeed,
        gender: editGender,
        tags: editTags,
        externalStudentNumber: editExternalNumber.trim() || undefined,
      };

      await updateStudent(editingStudent.id, updates);
      toast.success('Student updated');
      setEditingStudent(null);
    } catch {
      toast.error('Failed to update student');
    }
  };

  const isAdmin = user?.role === 'admin';

  // Selection helpers
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  const bulkUpdateStudents = async (ids: string[], updates: Partial<Student>) => {
    for (const id of ids) {
      await updateStudent(id, updates);
    }
    await refetch();
    setSelectedIds(new Set());
  };

  // For teachers: only show students in their assigned homerooms (already filtered by useStudents)
  // For admins: show all or filter by selected class
  const classStudents = selectedClass 
    ? students.filter(s => s.homeroom === selectedClass.code)
    : students;

  // Collect all unique tags for the filter dropdown
  const allTags = [...new Set(students.flatMap(s => s.tags || []))].sort();

  // Filter by search query and tag
  const filteredStudents = classStudents
    .filter(s => {
      const matchesSearch = s.studentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.initials?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = filterTag === 'all' || (s.tags || []).includes(filterTag);
      return matchesSearch && matchesTag;
    })
    .sort((a, b) => {
      const homeA = a.homeroom || '';
      const homeB = b.homeroom || '';
      const homeCmp = homeA.localeCompare(homeB);
      if (homeCmp !== 0) return homeCmp;
      const numA = parseInt(a.studentNumber?.split('-').pop() || '0', 10);
      const numB = parseInt(b.studentNumber?.split('-').pop() || '0', 10);
      return numA - numB;
    });

  const selectedStudents = filteredStudents.filter(s => selectedIds.has(s.id));

  const runBackfillParse = async (file: File, override: string | null) => {
    const { rows, warnings, detectedColumns, sampleRows, allHeaders } = await parseBackfillFile(
      file,
      override ? { externalNumber: override } : undefined,
    );
    setBackfillDetected(detectedColumns);
    setBackfillSampleRows(sampleRows);
    setBackfillAllHeaders(allHeaders);
    if (rows.length === 0) {
      setBackfillWarnings(warnings);
      setBackfillPlan({ matched: [], alreadyCorrect: [], unmatched: [], ambiguous: [], matchedByCodedId: 0, matchedByInitials: 0, missingRosterNumber: 0, missingSection: 0, derivedIdNotInRoster: 0 });
      return;
    }
    const plan = buildMatchPlan(rows, students.map(s => ({
      id: s.id,
      initials: s.initials,
      homeroom: s.homeroom,
      grade: s.grade,
      externalStudentNumber: s.externalStudentNumber,
      stableStudentId: s.stableStudentId,
      studentNumber: s.studentNumber,
    })));
    setBackfillPlan(plan);
    setBackfillWarnings(warnings);
  };

  const handleBackfillFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBackfillBusy(true);
    setBackfillFile(file);
    setBackfillColumnOverride(null);
    try {
      await runBackfillParse(file, null);
    } catch (err) {
      console.error('[backfill] parse error', err);
      toast.error('Failed to parse file');
    } finally {
      setBackfillBusy(false);
      if (backfillInputRef.current) backfillInputRef.current.value = '';
    }
  };

  const handlePickBoardColumn = async (header: string) => {
    if (!backfillFile) return;
    setBackfillReparsing(true);
    setBackfillColumnOverride(header);
    try {
      await runBackfillParse(backfillFile, header);
    } catch (err) {
      console.error('[backfill] reparse error', err);
      toast.error('Failed to re-parse with selected column');
    } finally {
      setBackfillReparsing(false);
    }
  };

  const handleConfirmBackfill = async () => {
    if (!backfillPlan) return;
    setBackfillCommitting(true);
    setBackfillResults(null);
    setBackfillVerifyMisses([]);
    const results: Array<{ studentId: string; studentNumber: string; externalNumber: string; status: 'updated' | 'failed'; error?: string }> = [];
    for (const m of backfillPlan.matched) {
      const studentDoc = students.find(s => s.id === m.studentId);
      const studentNumber = studentDoc?.studentNumber || '(unknown)';
      try {
        await updateStudent(m.studentId, { externalStudentNumber: m.row.externalNumber });
        results.push({ studentId: m.studentId, studentNumber, externalNumber: m.row.externalNumber, status: 'updated' });
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error('[backfill] update failed', { studentId: m.studentId, studentNumber, externalNumber: m.row.externalNumber, error }, e);
        results.push({ studentId: m.studentId, studentNumber, externalNumber: m.row.externalNumber, status: 'failed', error });
      }
    }
    const ok = results.filter(r => r.status === 'updated').length;
    const fail = results.filter(r => r.status === 'failed').length;
    console.log('[backfill] write results', { ok, fail, results });
    setBackfillResults(results);

    // Re-fetch and verify writes actually persisted
    try {
      await refetch();
    } catch (e) {
      console.warn('[backfill] refetch failed', e);
    }
    setBackfillCommitting(false);

    if (ok > 0) toast.success(`Backfilled ${ok} board number${ok === 1 ? '' : 's'}`);
    if (fail > 0) toast.error(`${fail} update${fail === 1 ? '' : 's'} failed`);
  };

  // Verify writes after refetch — runs reactively when students reload
  // Compare results against fresh roster
  const verifyBackfillResults = (results: typeof backfillResults) => {
    if (!results) return [];
    const misses: Array<{ studentId: string; studentNumber: string; expected: string }> = [];
    for (const r of results) {
      if (r.status !== 'updated') continue;
      const fresh = students.find(s => s.id === r.studentId);
      const current = (fresh?.externalStudentNumber || '').trim();
      if (!current || current !== r.externalNumber.trim()) {
        misses.push({ studentId: r.studentId, studentNumber: r.studentNumber, expected: r.externalNumber });
      }
    }
    return misses;
  };

  const downloadBackfillResultsCsv = () => {
    if (!backfillResults) return;
    const header = 'studentId,studentNumber,externalNumber,status,error\n';
    const rows = backfillResults
      .map(r => `${r.studentId},${r.studentNumber},${r.externalNumber},${r.status},"${(r.error || '').replace(/"/g, '""')}"`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backfill-results-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Roster coverage stats for board ID backfill
  const totalStudents = students.length;
  const studentsWithBoardId = students.filter(s => s.externalStudentNumber && String(s.externalStudentNumber).trim().length > 0).length;
  const coveragePct = totalStudents > 0 ? Math.round((studentsWithBoardId / totalStudents) * 100) : 0;

  // Re-verify backfill writes whenever roster reloads after a commit
  useEffect(() => {
    if (!backfillResults) return;
    const misses = verifyBackfillResults(backfillResults);
    setBackfillVerifyMisses(misses);
    if (misses.length > 0) {
      console.warn('[backfill] post-commit verification: writes not visible in roster', misses);
    } else {
      console.log('[backfill] post-commit verification: all writes confirmed in roster');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, backfillResults]);

  // Trace lookup: find a student by studentNumber and report which bucket their row landed in
  const backfillTrace = (() => {
    const q = backfillTraceQuery.trim().toUpperCase();
    if (!q || !backfillPlan) return null;
    const student = students.find(s => (s.studentNumber || '').trim().toUpperCase() === q);
    const matchedHit = backfillPlan.matched.find(m =>
      m.row.derivedCodedId?.toUpperCase() === q ||
      (students.find(s => s.id === m.studentId)?.studentNumber || '').toUpperCase() === q
    );
    const correctHit = backfillPlan.alreadyCorrect.find(r => r.derivedCodedId?.toUpperCase() === q);
    const unmatchedHit = backfillPlan.unmatched.find(r => r.derivedCodedId?.toUpperCase() === q);
    const ambiguousHit = backfillPlan.ambiguous.find(a => a.row.derivedCodedId?.toUpperCase() === q);

    let bucket: 'matched' | 'alreadyCorrect' | 'unmatched' | 'ambiguous' | 'no-row' = 'no-row';
    if (matchedHit) bucket = 'matched';
    else if (correctHit) bucket = 'alreadyCorrect';
    else if (unmatchedHit) bucket = 'unmatched';
    else if (ambiguousHit) bucket = 'ambiguous';

    let closest: BackfillRow[] = [];
    if (student && bucket === 'no-row') {
      const initU = (student.initials || '').toUpperCase().replace(/\./g, '').trim();
      const homeU = (student.homeroom || '').toUpperCase().trim();
      closest = backfillPlan.unmatched
        .filter(r =>
          r.initials.toUpperCase().replace(/\./g, '').trim() === initU ||
          r.homeroom.toUpperCase().trim() === homeU
        )
        .slice(0, 5);
    }
    return { query: q, student, bucket, matchedHit, correctHit, unmatchedHit, ambiguousHit, closest };
  })();

  return (
    <div className="space-y-6">
      {/* Roster Coverage Indicator */}
      {isAdmin && totalStudents > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="py-3 px-4 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm">
              <span className="font-medium">Board IDs backfilled:</span>{' '}
              <span className={coveragePct === 100 ? 'text-success font-semibold' : coveragePct > 0 ? 'text-warning font-semibold' : 'text-destructive font-semibold'}>
                {studentsWithBoardId} / {totalStudents} students ({coveragePct}%)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Benchmark imports keyed on board IDs (e.g. <code className="bg-muted px-1 rounded">1027516</code>) require this to be high.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Class Selection & CSV Upload */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>School Roster</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Upload CSV or manually add students. System generates coded IDs (e.g., 2AF-1) for privacy.
              </p>
            </div>
            <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
              CSV: StudentNumber, Initials, Grade, Gender, ExternalStudentNumber
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Class selection & CSV upload */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Homeroom *</Label>
                {classesLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading homerooms...
                  </div>
                ) : classes.length === 0 ? (
                  <div className="border border-dashed border-warning rounded-lg p-3 bg-warning/5">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-warning mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-warning">No homerooms available</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ask an admin to create homerooms in the Admin tab first.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="focus:ring-primary">
                      <SelectValue placeholder="Select a homeroom" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>
                          <span className="font-mono font-medium">{cls.code}</span>
                          {cls.name && <span className="text-muted-foreground ml-2">— {cls.name}</span>}
                          <span className="text-xs text-muted-foreground ml-2">
                            (Grades: {cls.allowedGrades.map(g => formatGradeDisplay(g)).join(', ')})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              <div className={`border-2 border-dashed rounded-lg p-4 space-y-3 ${
                selectedClass ? 'border-primary/30 bg-primary/5' : 'border-muted bg-muted/20'
              }`}>
                <h4 className={`font-medium flex items-center gap-2 ${selectedClass ? 'text-primary' : 'text-muted-foreground'}`}>
                  <Upload className="h-4 w-4" />
                  Upload Classlist CSV
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    CSV format: <code className="bg-muted px-1 rounded">StudentNumber, Initials, Grade, Gender, ExternalStudentNumber</code>
                  </p>
                  <p>
                    Example: <code className="bg-muted px-1 rounded">1, JD, 4, M, 1027516</code> → becomes <code className="bg-muted px-1 rounded">{selectedClass?.code || 'homeroom'}-1</code>
                  </p>
                  <p className="text-muted-foreground/70">Gender and ExternalStudentNumber are optional. Re-uploading with an ExternalStudentNumber will backfill it on existing students.</p>
                  {selectedClass && (
                    <p className="text-primary">
                      ✓ Allowed grades for {selectedClass.code}: {selectedClass.allowedGrades.map(g => formatGradeDisplay(g)).join(', ')}
                    </p>
                  )}
                </div>
                <Input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".csv" 
                  className="text-sm focus:ring-primary"
                  onChange={handleCSVUpload}
                  disabled={isUploading || !selectedClass}
                />
                {!selectedClass && (
                  <p className="text-xs text-warning flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Select a homeroom before uploading
                  </p>
                )}
                {isUploading && (
                  <div className="flex items-center gap-2 text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing students...
                  </div>
                )}
              </div>
            </div>
            
            {/* Right: Manual add form */}
            <div className="space-y-4">
              <h4 className="font-medium">Add Student Manually</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="studentNumber">Student # *</Label>
                  <Input
                    id="studentNumber"
                    placeholder="e.g. 1, 2, 3"
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(e.target.value)}
                    className="focus:ring-primary mt-1"
                    disabled={!selectedClass}
                  />
                </div>
                <div>
                  <Label htmlFor="initials">Initials</Label>
                  <Input
                    id="initials"
                    placeholder="e.g. JD"
                    value={initials}
                    onChange={(e) => setInitials(e.target.value)}
                    className="focus:ring-primary mt-1"
                    disabled={!selectedClass}
                  />
                </div>
              </div>
              
              <div>
              <div>
                <Label>Gender</Label>
                <Select value={selectedGender} onValueChange={setSelectedGender}>
                  <SelectTrigger className="focus:ring-primary mt-1">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="X">Non-binary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Label>Grade * (must match homeroom's allowed grades)</Label>
                {selectedClass ? (
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger className="focus:ring-primary mt-1">
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedClass.allowedGrades.map(g => (
                        <SelectItem key={g} value={String(g)}>
                          Grade {formatGradeDisplay(g)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Select a homeroom to see available grades
                  </p>
                )}
              </div>
              
              <div className="flex gap-4">
                <div className="flex items-center space-x-2 p-2 bg-primary/10 rounded-lg flex-1 border border-primary/20">
                  <Checkbox 
                    id="focusStudent" 
                    checked={isFocusStudent}
                    onCheckedChange={(checked) => setIsFocusStudent(checked as boolean)}
                    disabled={!selectedClass}
                  />
                  <Label htmlFor="focusStudent" className="text-primary text-sm font-medium">
                    Focus Student
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 p-2 bg-destructive/10 rounded-lg flex-1 border border-destructive/20">
                  <Checkbox 
                    id="highNeed" 
                    checked={isHighNeed}
                    onCheckedChange={(checked) => setIsHighNeed(checked as boolean)}
                    disabled={!selectedClass}
                  />
                  <Label htmlFor="highNeed" className="text-destructive text-sm font-medium">
                    High Need
                  </Label>
                </div>
              </div>
              
              <Button 
                className="w-full" 
                onClick={handleSaveStudent}
                disabled={!selectedClass || !studentNumber.trim() || !selectedGrade}
              >
                Save Student
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Whole-school Board Number Backfill */}
      {isAdmin && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Backfill Board Numbers (whole-school)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Upload one Excel/CSV with <strong>Student #</strong>, <strong>Student Initials</strong>, <strong>Student Number</strong> (board ID), and <strong>Section Number</strong>. Matches primarily by derived coded ID (e.g. <code className="bg-muted px-1 rounded">1AF-3</code>), falling back to Initials + Homeroom. Only writes board number; never overwrites other fields.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                ref={backfillInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleBackfillFile}
                disabled={backfillBusy}
                className="max-w-md focus:ring-primary"
              />
              {backfillBusy && (
                <span className="text-sm text-primary flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Parsing…
                </span>
              )}
            </div>
            {backfillWarnings.length > 0 && (
              <div className="mt-3 text-xs text-warning space-y-1">
                {backfillWarnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Backfill Preview Dialog */}
      <Dialog open={!!backfillPlan} onOpenChange={(open) => { if (!open) { setBackfillPlan(null); setBackfillDetected(null); setBackfillSampleRows([]); setBackfillTraceQuery(''); setBackfillResults(null); setBackfillVerifyMisses([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Backfill Preview</DialogTitle>
          </DialogHeader>
          {backfillPlan && (
            <div className="space-y-4 text-sm">
              {/* Detected columns panel */}
              {backfillDetected && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs font-semibold mb-1">Detected columns from your file:</p>
                  {[
                    { key: 'initials' as const, label: 'Initials column' },
                    { key: 'externalNumber' as const, label: 'Board number column' },
                    { key: 'homeroom' as const, label: 'Section/Homeroom' },
                    { key: 'rosterNumber' as const, label: 'Roster ordinal (#)' },
                    { key: 'grade' as const, label: 'Grade column' },
                  ].map(({ key, label }) => {
                    const value = backfillDetected[key];
                    const isCritical = key === 'rosterNumber';
                    return (
                      <div key={key} className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-muted-foreground w-44">• {label}</span>
                        <span className="text-muted-foreground">→</span>
                        {value ? (
                          <span className="text-success">"{value}" ✓</span>
                        ) : (
                          <span className={isCritical ? 'text-destructive font-semibold' : 'text-warning'}>
                            NOT FOUND ✗ {isCritical && '← derived-ID match cannot run'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sample parsed rows */}
              {backfillSampleRows.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-semibold mb-1">Sample parsed rows (first {backfillSampleRows.length}):</p>
                  <div className="space-y-1">
                    {backfillSampleRows.map((r, i) => (
                      <div key={i} className="text-[11px] font-mono text-muted-foreground">
                        Row {r.rowIndex}: section="{r.homeroom}" #="{r.rosterNumber || '—'}" initials="{r.initials}" board="{r.externalNumber}"
                        {r.derivedCodedId && <span className="text-success"> → derives ID "{r.derivedCodedId}"</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trace by Student # */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold whitespace-nowrap">Trace student by Student #</Label>
                  <Input
                    placeholder="e.g. 4F-14"
                    value={backfillTraceQuery}
                    onChange={(e) => setBackfillTraceQuery(e.target.value)}
                    className="h-8 text-xs max-w-xs"
                  />
                </div>
                {backfillTrace && (
                  <div className="text-[11px] font-mono space-y-1">
                    {backfillTrace.student ? (
                      <p className="text-muted-foreground">
                        Roster: <span className="text-foreground">id={backfillTrace.student.id}</span>, initials="{backfillTrace.student.initials}", homeroom="{backfillTrace.student.homeroom}", externalStudentNumber="{backfillTrace.student.externalStudentNumber || '∅'}"
                      </p>
                    ) : (
                      <p className="text-destructive">Student "{backfillTrace.query}" not found in current in-memory roster.</p>
                    )}
                    <p className="text-muted-foreground">
                      Bucket:{' '}
                      <span className={
                        backfillTrace.bucket === 'matched' ? 'text-success' :
                        backfillTrace.bucket === 'alreadyCorrect' ? 'text-foreground' :
                        backfillTrace.bucket === 'no-row' ? 'text-destructive' :
                        'text-warning'
                      }>
                        {backfillTrace.bucket === 'no-row' ? 'NO FILE ROW produced this derived ID' : backfillTrace.bucket}
                      </span>
                    </p>
                    {backfillTrace.matchedHit && (
                      <p className="text-success">→ will write externalStudentNumber="{backfillTrace.matchedHit.row.externalNumber}" via {backfillTrace.matchedHit.matchSource}</p>
                    )}
                    {backfillTrace.unmatchedHit && (
                      <p className="text-warning">→ file row {backfillTrace.unmatchedHit.rowIndex}: section="{backfillTrace.unmatchedHit.homeroom}" #="{backfillTrace.unmatchedHit.rosterNumber}" initials="{backfillTrace.unmatchedHit.initials}" board="{backfillTrace.unmatchedHit.externalNumber}" — derived ID not in roster</p>
                    )}
                    {backfillTrace.ambiguousHit && (
                      <p className="text-warning">→ ambiguous: {backfillTrace.ambiguousHit.candidateIds.length} roster candidates</p>
                    )}
                    {backfillTrace.closest.length > 0 && (
                      <div>
                        <p className="text-muted-foreground">Closest unmatched file rows by initials/homeroom:</p>
                        {backfillTrace.closest.map((r, i) => (
                          <p key={i} className="text-muted-foreground pl-3">• row {r.rowIndex}: section="{r.homeroom}" #="{r.rosterNumber || '—'}" initials="{r.initials}" derived="{r.derivedCodedId || '—'}" board="{r.externalNumber}"</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Post-commit results */}
              {backfillResults && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">
                      Write results: <span className="text-success">{backfillResults.filter(r => r.status === 'updated').length} updated</span>
                      {backfillResults.some(r => r.status === 'failed') && (
                        <span className="text-destructive"> · {backfillResults.filter(r => r.status === 'failed').length} failed</span>
                      )}
                      {' '}of {backfillResults.length}
                    </p>
                    <Button size="sm" variant="outline" onClick={downloadBackfillResultsCsv}>Download CSV</Button>
                  </div>
                  {backfillVerifyMisses.length > 0 && (
                    <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] font-mono">
                      <p className="text-destructive font-semibold mb-1">⚠ {backfillVerifyMisses.length} write(s) reported success but did NOT persist in the roster after refetch — likely Firestore rules rejection.</p>
                      <div className="max-h-32 overflow-auto">
                        {backfillVerifyMisses.slice(0, 10).map((m, i) => (
                          <p key={i}>• {m.studentNumber} (id={m.studentId}) expected="{m.expected}"</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {backfillResults.some(r => r.status === 'failed') && (
                    <div className="max-h-40 overflow-auto rounded border border-destructive/40 bg-destructive/5 p-2 text-[11px] font-mono">
                      {backfillResults.filter(r => r.status === 'failed').slice(0, 20).map((r, i) => (
                        <p key={i} className="text-destructive">• {r.studentNumber} → {r.error || 'unknown error'}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                  <div className="text-2xl font-semibold text-success">{backfillPlan.matched.length}</div>
                  <div className="text-xs text-muted-foreground">Matched — ready to update</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {backfillPlan.matchedByCodedId} by Section + Student # · {backfillPlan.matchedByInitials} by Initials + Homeroom
                  </div>
                </div>
                <div className="rounded-lg border border-muted bg-muted/30 p-3">
                  <div className="text-2xl font-semibold">{backfillPlan.alreadyCorrect.length}</div>
                  <div className="text-xs text-muted-foreground">Already correct — will skip</div>
                </div>
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <div className="text-2xl font-semibold text-warning">{backfillPlan.unmatched.length}</div>
                  <div className="text-xs text-muted-foreground">No student match</div>
                </div>
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <div className="text-2xl font-semibold text-warning">{backfillPlan.ambiguous.length}</div>
                  <div className="text-xs text-muted-foreground">Ambiguous (multiple matches)</div>
                </div>
              </div>

              {(backfillPlan.missingRosterNumber > 0 || backfillPlan.missingSection > 0 || backfillPlan.derivedIdNotInRoster > 0 || backfillPlan.matchedByInitials > 0) && (
                <div className="rounded border border-warning/30 bg-warning/5 p-2 text-xs space-y-1">
                  <p className="font-medium text-warning">Diagnostics</p>
                  {backfillPlan.missingRosterNumber > 0 && <p className="text-muted-foreground">• {backfillPlan.missingRosterNumber} row(s) missing Student # (ordinal)</p>}
                  {backfillPlan.missingSection > 0 && <p className="text-muted-foreground">• {backfillPlan.missingSection} row(s) missing Section Number</p>}
                  {backfillPlan.derivedIdNotInRoster > 0 && <p className="text-muted-foreground">• {backfillPlan.derivedIdNotInRoster} row(s) had a derived ID (e.g. 1AF-3) that doesn't exist in the current roster</p>}
                  {backfillPlan.matchedByInitials > 0 && <p className="text-muted-foreground">• {backfillPlan.matchedByInitials} row(s) only matched by Initials fallback — verify these are the correct students</p>}
                </div>
              )}

              {backfillPlan.unmatched.length > 0 && (
                <div className="rounded border border-warning/30 bg-warning/5 p-2">
                  <p className="text-xs font-medium text-warning mb-2">First {Math.min(10, backfillPlan.unmatched.length)} unmatched rows (of {backfillPlan.unmatched.length}):</p>
                  <div className="overflow-auto max-h-60">
                    <table className="w-full text-[11px] font-mono">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left p-1">Row</th>
                          <th className="text-left p-1">Section</th>
                          <th className="text-left p-1">#</th>
                          <th className="text-left p-1">Initials</th>
                          <th className="text-left p-1">Derived ID</th>
                          <th className="text-left p-1">Board #</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backfillPlan.unmatched.slice(0, 10).map((r, i) => (
                          <tr key={i} className="border-b border-border/30">
                            <td className="p-1">{r.rowIndex}</td>
                            <td className="p-1">{r.homeroom || '—'}</td>
                            <td className="p-1">{r.rosterNumber || '—'}</td>
                            <td className="p-1">{r.initials}</td>
                            <td className="p-1">{r.derivedCodedId || '—'}</td>
                            <td className="p-1">{r.externalNumber}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {backfillPlan.unmatched.length > 10 && (
                    <p className="text-[11px] text-muted-foreground italic mt-1">…and {backfillPlan.unmatched.length - 10} more</p>
                  )}
                </div>
              )}

              {backfillPlan.ambiguous.length > 0 && (
                <div className="max-h-32 overflow-auto rounded border border-warning/30 p-2 bg-warning/5">
                  <p className="text-xs font-medium text-warning mb-1">Ambiguous rows (resolve manually in Edit Student):</p>
                  {backfillPlan.ambiguous.map((a, i) => (
                    <div key={i} className="text-xs text-muted-foreground font-mono">
                      Row {a.row.rowIndex}: {a.row.initials} in {a.row.homeroom} matches {a.candidateIds.length} students
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBackfillPlan(null); setBackfillDetected(null); setBackfillSampleRows([]); }} disabled={backfillCommitting}>
              Close
            </Button>
            <Button
              onClick={handleConfirmBackfill}
              disabled={backfillCommitting || !backfillPlan || backfillPlan.matched.length === 0}
            >
              {backfillCommitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Backfill ({backfillPlan?.matched.length ?? 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Roster Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {selectedClass ? `Students in ${selectedClass.code}` : (isAdmin ? 'All Students' : 'Select a homeroom')}
              {selectedClass && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filteredStudents.length} students)
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search..." 
                  className="pl-8 w-48 focus:ring-primary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {allTags.length > 0 && (
                <Select value={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger className="w-36 focus:ring-primary">
                    <SelectValue placeholder="All Tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading students...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredStudents.length > 0 && selectedIds.size === filteredStudents.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Student #</TableHead>
                  <TableHead>Board #</TableHead>
                  <TableHead>Initials</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Homeroom</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map(student => (
                    <TableRow key={student.id} className={`hover:bg-muted/30 cursor-pointer ${selectedIds.has(student.id) ? 'bg-primary/5' : ''}`} onClick={() => setSummaryStudent(student)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(student.id)}
                          onCheckedChange={() => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              next.has(student.id) ? next.delete(student.id) : next.add(student.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">{student.studentNumber}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{student.externalStudentNumber || '—'}</TableCell>
                      <TableCell>{student.initials}</TableCell>
                      <TableCell>{student.grade}</TableCell>
                      <TableCell>{student.gender || '—'}</TableCell>
                      <TableCell className="font-mono">{student.homeroom}</TableCell>
                      <TableCell>
                        <span className={`text-xs ${isStale(student.lastUpdated) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {freshnessLabel(student.lastUpdated)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {(student.tags || []).map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {student.isFocusStudent && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Focus</span>
                          )}
                          {student.isHighNeed && (
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">High Need</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => openEditDialog(student)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:text-destructive"
                            onClick={() => handleDeleteStudent(student.id, student.studentNumber)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      {selectedClass ? 'No students in this homeroom yet.' : 'No students added yet.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          
          <p className="text-xs text-muted-foreground mt-4">
            Student IDs are coded as homeroom-number (e.g., 2AF-1) for privacy. First/last names are not stored.
          </p>
        </CardContent>
      </Card>

      {/* Edit Student Dialog */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Student {editingStudent?.studentNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="editExternalNumber">External / Board Student # (from SIS)</Label>
              <Input
                id="editExternalNumber"
                placeholder="e.g. 1027516"
                value={editExternalNumber}
                onChange={(e) => setEditExternalNumber(e.target.value)}
                className="mt-1 font-mono"
                disabled={!isAdmin}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Used to match Acadience / DIBELS imports. {!isAdmin && '(Admin only)'}
              </p>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={editGender} onValueChange={setEditGender}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Male</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                  <SelectItem value="X">Non-binary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2 p-2 bg-primary/10 rounded-lg flex-1 border border-primary/20">
                <Checkbox
                  id="editFocus"
                  checked={editFocus}
                  onCheckedChange={(checked) => setEditFocus(checked as boolean)}
                />
                <Label htmlFor="editFocus" className="text-primary text-sm font-medium">Focus Student</Label>
              </div>
              <div className="flex items-center space-x-2 p-2 bg-destructive/10 rounded-lg flex-1 border border-destructive/20">
                <Checkbox
                  id="editHighNeed"
                  checked={editHighNeed}
                  onCheckedChange={(checked) => setEditHighNeed(checked as boolean)}
                />
                <Label htmlFor="editHighNeed" className="text-destructive text-sm font-medium">High Need</Label>
              </div>
            </div>
            <div>
              <Label>Tags</Label>
              <div className="mt-1">
                <TagInput value={editTags} onChange={setEditTags} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStudent(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Summary Panel */}
      <StudentSummaryPanel
        student={summaryStudent}
        open={!!summaryStudent}
        onClose={() => setSummaryStudent(null)}
        benchmarks={benchmarks}
        markbookEntries={markbookEntries}
      />

      {/* Bulk Actions */}
      <BulkActionsBar
        selectedStudents={selectedStudents}
        onClearSelection={() => setSelectedIds(new Set())}
        onUpdateStudents={bulkUpdateStudents}
        onRefetch={refetch}
        homerooms={classes.map(c => ({ id: c.id, code: c.code, name: c.name }))}
      />
    </div>
  );
}