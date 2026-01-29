import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { ASSESSMENT_TYPES } from '@/types';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

export function BenchmarksTab() {
  const { students } = useStudents();
  const { benchmarks, loading, addBenchmark } = useBenchmarks();
  
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
      // Reset form
      setSelectedStudent('');
      setAssessmentType('');
      setScore('');
      setDate('');
      setNotes('');
    } catch (err) {
      toast.error('Failed to save benchmark');
    }
  };

  const handleCSVUpload = () => {
    toast.info('CSV upload coming soon');
  };

  const handleCSVDownload = () => {
    toast.info('CSV download coming soon');
  };

  return (
    <div className="space-y-6">
      {/* Record Data & Recent Benchmarks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Record Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue placeholder="-- Choose Student --" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.studentNumber} - {student.firstName} {student.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={assessmentType} onValueChange={setAssessmentType}>
              <SelectTrigger>
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
            />

            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <Textarea
              placeholder="Notes (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />

            <Button className="w-full" onClick={handleSave}>
              Save
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Benchmarks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : benchmarks.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No benchmarks recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {benchmarks.slice(0, 10).map(benchmark => (
                  <div key={benchmark.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-medium">{benchmark.assessmentType}</span>
                      <span className="text-sm text-muted-foreground">
                        {benchmark.date?.toLocaleDateString?.() || 'No date'}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Score: {benchmark.score}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bulk CSV Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">Bulk CSV Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Import Format: <code>ID</code>, <code>Type</code>, <code>Score</code>, <code>Date</code>, <code>Notes</code>, <code>Ref</code>
          </p>
          <Input type="file" accept=".csv" className="text-sm" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCSVUpload}>
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
