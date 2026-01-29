import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudents } from '@/hooks/useStudents';
import { useMarkbook } from '@/hooks/useMarkbook';
import { SUBJECTS, STRANDS } from '@/types';
import { Download, BookOpen, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

export function MarkbookTab() {
  const { students } = useStudents();
  const { entries, loading, addEntry } = useMarkbook();
  
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
      {/* New Observation & Markbook Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              New Observation
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

            <Select value={subject} onValueChange={(val) => { setSubject(val); setStrand(''); }}>
              <SelectTrigger className="focus:ring-primary">
                <SelectValue placeholder="Select Subject..." />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map(subj => (
                  <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={strand} onValueChange={setStrand} disabled={!subject}>
              <SelectTrigger className="focus:ring-primary">
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
              className="focus:ring-primary"
            />

            <Input
              placeholder="Score / Mark"
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

            <Input
              placeholder="Evidence URL (Drive/D2L)"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              className="focus:ring-primary"
            />

            <Textarea
              placeholder="Anecdotal Note / Observation"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="focus:ring-primary resize-none"
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

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Markbook Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : entries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No entries recorded yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Add your first observation using the form.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
                {entries.map(entry => (
                  <div key={entry.id} className="p-3 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors border-l-4 border-l-primary">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-foreground">{entry.taskName}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {entry.date?.toLocaleDateString?.() || 'No date'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        {entry.subject}
                      </span>
                      {entry.strand && (
                        <span className="text-xs text-muted-foreground">
                          {entry.strand}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Score: <span className="font-medium text-primary">{entry.score}</span>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">{entry.notes}</p>
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
