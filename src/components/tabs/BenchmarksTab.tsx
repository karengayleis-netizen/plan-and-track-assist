import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { ASSESSMENT_TYPES } from '@/types';
import { Download, Calendar, FileText, Upload, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { ImportWizard } from '@/components/benchmarks/ImportWizard';

export function BenchmarksTab() {
  const { students } = useStudents();
  const { benchmarks, loading, addBenchmark, refetch } = useBenchmarks();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  
  // Form state
  const [selectedStudent, setSelectedStudent] = useState('');
  const [assessmentType, setAssessmentType] = useState('');
  const [score, setScore] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = async () => {
    if (!selectedStudent || !assessmentType || !score || !date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await addBenchmark({
        studentId: selectedStudent,
        assessmentType,
        subject: '',
        assessmentName: assessmentType,
        score,
        maxScore: 100,
        percentage: 0,
        date: new Date(date),
        term: '',
        notes,
      });
      toast.success('Benchmark saved successfully');
      setSelectedStudent('');
      setAssessmentType('');
      setScore('');
      setDate('');
      setNotes('');
    } catch (err) {
      toast.error('Failed to save benchmark');
    }
  };

  const handleCSVUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error('Please select a CSV file first');
      return;
    }

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Skip header if it looks like one
    const headerLower = lines[0]?.toLowerCase() || '';
    const startIdx = headerLower.includes('studentnumber') || headerLower.includes('student number') || headerLower.includes('type') ? 1 : 0;

    let successCount = 0;
    let errorCount = 0;

    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 3) { errorCount++; continue; }

      const [identifier, type, scoreVal, dateVal, notesVal, refVal] = cols;
      
      // Match by studentNumber
      let student = null;
      if (identifier) {
        student = students.find(s => s.studentNumber === identifier.trim());
      }
      
      if (!student) { errorCount++; continue; }

      try {
        await addBenchmark({
          studentId: student.id,
          assessmentType: type || '',
          subject: '',
          assessmentName: type || '',
          score: scoreVal || '',
          maxScore: 100,
          percentage: 0,
          date: dateVal ? new Date(dateVal) : new Date(),
          term: '',
          notes: notesVal || '',
          reference: refVal || '',
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    toast.success(`Imported ${successCount} benchmarks${errorCount > 0 ? `, ${errorCount} rows failed` : ''}`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCSVDownload = () => {
    if (benchmarks.length === 0) {
      toast.error('No benchmarks to export');
      return;
    }

    const headers = 'StudentNumber,Type,Score,Date,Notes,Ref';
    const rows = benchmarks.map(b => {
      const student = students.find(s => s.id === b.studentId);
      const studentNum = student?.studentNumber || b.studentId;
      const dateStr = b.date instanceof Date ? b.date.toISOString().split('T')[0] : '';
      return [studentNum, b.assessmentType, b.score, dateStr, b.notes || '', b.reference || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmarks_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  return (
    <div className="space-y-6">
      {/* Import Wizard Button */}
      <div className="flex justify-end">
        <Button onClick={() => setWizardOpen(true)} className="gap-2">
          <Wand2 className="h-4 w-4" />
          Import CSV Wizard
        </Button>
      </div>

      <ImportWizard open={wizardOpen} onOpenChange={setWizardOpen} onComplete={refetch} />

      {/* Record Data & Recent Benchmarks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Record Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="focus:ring-primary">
                <SelectValue placeholder="-- Choose Student --" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.studentNumber} - {student.initials || student.firstName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assessmentType} onValueChange={setAssessmentType}>
              <SelectTrigger className="focus:ring-primary">
                <SelectValue placeholder="Select Assessment..." />
              </SelectTrigger>
              <SelectContent>
                {ASSESSMENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Score / Level"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="focus:ring-primary"
            />

            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="focus:ring-primary"
            />

            <Textarea
              placeholder="Notes (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="focus:ring-primary resize-none"
            />

            <Button className="w-full" onClick={handleSave}>
              Save Benchmark
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Recent Benchmarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : benchmarks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No benchmarks recorded yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Add your first benchmark using the form.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-2">
                {benchmarks.slice(0, 10).map(benchmark => (
                  <div key={benchmark.id} className="p-3 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-foreground">{benchmark.assessmentType}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {benchmark.date?.toLocaleDateString?.() || 'No date'}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Score: <span className="font-medium text-primary">{benchmark.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk CSV Actions */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Bulk CSV Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              CSV columns: <code className="bg-muted px-1.5 py-0.5 rounded">OEN or StudentNumber</code>, <code className="bg-muted px-1.5 py-0.5 rounded">Type</code>, <code className="bg-muted px-1.5 py-0.5 rounded">Score</code>, <code className="bg-muted px-1.5 py-0.5 rounded">Date</code>, <code className="bg-muted px-1.5 py-0.5 rounded">Notes</code>, <code className="bg-muted px-1.5 py-0.5 rounded">Ref</code>
            </p>
            <p className="text-muted-foreground/70">
              Matches by OEN hash first, then falls back to coded student number (e.g., 1AF-3).
            </p>
            <p className="text-muted-foreground/70">
              Example: <code className="bg-muted px-1.5 py-0.5 rounded">123456789, Acadience Reading, Level 42, 2026-03-15, Spring assessment, REF-001</code>
            </p>
          </div>
          <Input ref={fileInputRef} type="file" accept=".csv" className="text-sm focus:ring-primary" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCSVUpload}>
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleCSVDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
