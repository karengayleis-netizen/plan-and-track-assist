import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudents } from '@/hooks/useStudents';
import { useMarkbook } from '@/hooks/useMarkbook';
import { SUBJECTS, STRANDS } from '@/types';
import { Search, RefreshCw, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';

export function MarkbookTab() {
  const { students } = useStudents();
  const { entries, loading, addEntry, refetch } = useMarkbook();
  
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [selectedStudent, setSelectedStudent] = useState('');
  const [subject, setSubject] = useState('');
  const [strand, setStrand] = useState('');
  const [taskName, setTaskName] = useState('');
  const [score, setScore] = useState('');
  const [date, setDate] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [notes, setNotes] = useState('');

  const availableStrands = subject ? STRANDS[subject] || [] : [];

  const handleSave = async () => {
    if (!selectedStudent || !subject || !taskName || !date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await addEntry({
        studentId: selectedStudent,
        subject,
        strand,
        taskName,
        topic: strand,
        score,
        maxScore: 100,
        date: new Date(date),
        evidenceUrl,
        notes,
      });
      toast.success('Entry saved successfully');
      // Reset form
      setSelectedStudent('');
      setSubject('');
      setStrand('');
      setTaskName('');
      setScore('');
      setDate('');
      setEvidenceUrl('');
      setNotes('');
    } catch (err) {
      toast.error('Failed to save entry');
    }
  };

  const handleDownloadCSV = () => {
    toast.info('CSV download coming soon');
  };

  return (
    <div className="space-y-6">
      {/* School Roster Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>School Roster (Class-based)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Lives beside your legacy teacher roster. Use for shared classes, FI flip model, ISSP/ELL access, and CSV classlists.
              </p>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Path: schools/folkstone_ps/classes/* + schools/folkstone_ps/students
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* My Classes */}
            <div className="space-y-4">
              <h3 className="font-semibold">My Classes (assigned)</h3>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="No classes assigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2F">2F - Grade 2 French</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Upload Classlist CSV</h4>
                <p className="text-xs text-muted-foreground">
                  Columns supported: <code>student name (last, first)</code>, <code>number (optional)</code>, <code>grade</code>, <code>homeroom</code>.
                </p>
                <Input type="file" accept=".csv" className="text-sm" />
                <Button className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload to Selected Class
                </Button>
              </div>
            </div>
            
            {/* Students in selected class */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Students in selected class</h3>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search name / number..." 
                      className="pl-8 w-48"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={refetch}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Homeroom</TableHead>
                    <TableHead>Seat</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No students in roster yet.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              <p className="text-xs text-muted-foreground">
                Tip: Edit names safely — the internal <code>studentId</code> stays stable.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Observation & Markbook Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>New Observation</CardTitle>
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

            <Select value={subject} onValueChange={(val) => { setSubject(val); setStrand(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select Subject..." />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map(subj => (
                  <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={strand} onValueChange={setStrand} disabled={!subject}>
              <SelectTrigger>
                <SelectValue placeholder="Select Strand..." />
              </SelectTrigger>
              <SelectContent>
                {availableStrands.map(str => (
                  <SelectItem key={str} value={str}>{str}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Task Name (e.g. Unit Test)"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
            />

            <Input
              placeholder="Score / Mark"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />

            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <Input
              placeholder="Evidence URL (Drive/D2L)"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
            />

            <Textarea
              placeholder="Anecdotal Note / Observation"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />

            <Button className="w-full" onClick={handleSave}>
              Save Entry
            </Button>

            <Button variant="outline" className="w-full" onClick={handleDownloadCSV}>
              <Download className="h-4 w-4 mr-2" />
              Download Markbook (CSV)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Markbook Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : entries.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No entries recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {entries.map(entry => (
                  <div key={entry.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between">
                      <span className="font-medium">{entry.taskName}</span>
                      <span className="text-sm text-muted-foreground">
                        {entry.date?.toLocaleDateString?.() || 'No date'}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {entry.subject} - {entry.strand}
                    </div>
                    <div className="text-sm">
                      Score: {entry.score}
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
