import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { useMarkbook } from '@/hooks/useMarkbook';
import { Triangle, Search, Eye, MessageCircle, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { freshnessLabel, isStale } from '@/lib/freshness';

type EvidenceType = 'observation' | 'conversation' | 'product';

const EVIDENCE_CONFIG: Record<EvidenceType, { label: string; icon: typeof Eye; color: string }> = {
  observation: { label: 'Observation', icon: Eye, color: 'bg-chart-1/10 text-chart-1 border-chart-1/30' },
  conversation: { label: 'Conversation', icon: MessageCircle, color: 'bg-chart-2/10 text-chart-2 border-chart-2/30' },
  product: { label: 'Product', icon: Package, color: 'bg-chart-3/10 text-chart-3 border-chart-3/30' },
};

const EVIDENCE_TAGS = ['Reading', 'Writing', 'Math', 'Behaviour', 'Social', 'SEL', 'French', 'Other'];

export function TriangulationTab() {
  const { user } = useAuth();
  const { students, loading } = useStudents();
  const { benchmarks } = useBenchmarks();
  const { entries } = useMarkbook();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'focus'>('all');

  // Quick-entry modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('observation');
  const [evidenceStudentId, setEvidenceStudentId] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [evidenceTag, setEvidenceTag] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.studentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.homeroom?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.initials?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterMode === 'all' || student.isFocusStudent;
    return matchesSearch && matchesFilter;
  });

  const getStudentDataPoints = (studentId: string) => {
    const benchmarkCount = benchmarks.filter(b => b.studentId === studentId).length;
    const markbookCount = entries.filter(e => e.studentId === studentId).length;
    return benchmarkCount + markbookCount;
  };

  const openQuickEntry = (type: EvidenceType, studentId?: string) => {
    setEvidenceType(type);
    setEvidenceStudentId(studentId || '');
    setEvidenceNote('');
    setEvidenceTag('');
    setModalOpen(true);
  };

  const handleSaveEvidence = async () => {
    if (!evidenceStudentId) {
      toast.error('Please select a student');
      return;
    }
    if (!evidenceNote.trim()) {
      toast.error('Please add a note');
      return;
    }

    setSaving(true);
    try {
      const student = students.find(s => s.id === evidenceStudentId);
      await addDoc(collection(db, 'evidence'), {
        schoolId: user?.schoolId || '',
        studentId: evidenceStudentId,
        studentNumber: student?.studentNumber || '',
        type: evidenceType,
        note: evidenceNote.trim(),
        tag: evidenceTag || null,
        timestamp: new Date(),
        createdBy: user?.uid || '',
        lastUpdated: new Date(),
      });
      toast.success(`${EVIDENCE_CONFIG[evidenceType].label} saved`);
      setModalOpen(false);
    } catch {
      toast.error('Failed to save evidence');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Entry Buttons */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Quick Evidence Entry
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            1-click capture for classroom evidence. Auto-timestamped.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(EVIDENCE_CONFIG) as [EvidenceType, typeof EVIDENCE_CONFIG[EvidenceType]][]).map(([type, config]) => {
              const Icon = config.icon;
              return (
                <Button
                  key={type}
                  variant="outline"
                  className={`gap-2 border ${config.color} hover:opacity-80 transition-opacity`}
                  onClick={() => openQuickEntry(type)}
                >
                  <Icon className="h-4 w-4" />
                  {config.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Student Triangulation Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Triangle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Student Triangulation</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Holistic view of all data points.
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  className="pl-8 w-full sm:w-48 focus:ring-primary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                variant={filterMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('all')}
              >
                All
              </Button>
              <Button
                variant={filterMode === 'focus' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('focus')}
              >
                Focus
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filteredStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No students found for this filter.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Student</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Focus</TableHead>
                    <TableHead>High Need</TableHead>
                    <TableHead>Data Points</TableHead>
                    <TableHead>Benchmarks</TableHead>
                    <TableHead>Markbook</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[120px]">Quick Add</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map(student => {
                    const studentBenchmarks = benchmarks.filter(b => b.studentId === student.id);
                    const studentEntries = entries.filter(e => e.studentId === student.id);
                    const dataPoints = getStudentDataPoints(student.id);

                    return (
                      <TableRow key={student.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          {student.studentNumber}
                          {student.initials && <span className="ml-1 text-muted-foreground">({student.initials})</span>}
                        </TableCell>
                        <TableCell>{student.grade}</TableCell>
                        <TableCell>
                          {student.isFocusStudent && (
                            <span className="bg-chart-3/10 text-chart-3 px-2 py-1 rounded-full text-xs font-medium">Yes</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.isHighNeed && (
                            <span className="bg-destructive/10 text-destructive px-2 py-1 rounded-full text-xs font-medium">Yes</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-primary">{dataPoints}</span>
                        </TableCell>
                        <TableCell>{studentBenchmarks.length}</TableCell>
                        <TableCell>{studentEntries.length}</TableCell>
                        <TableCell>
                          {student.isHighNeed ? (
                            <span className="bg-destructive/10 text-destructive px-2 py-1 rounded-full text-xs font-medium">At Risk</span>
                          ) : dataPoints > 0 ? (
                            <span className="bg-success/10 text-success px-2 py-1 rounded-full text-xs font-medium">Stable</span>
                          ) : (
                            <span className="bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs font-medium">No Data</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <button
                              title="Observation"
                              className="p-1.5 rounded hover:bg-chart-1/10 text-chart-1 transition-colors"
                              onClick={() => openQuickEntry('observation', student.id)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              title="Conversation"
                              className="p-1.5 rounded hover:bg-chart-2/10 text-chart-2 transition-colors"
                              onClick={() => openQuickEntry('conversation', student.id)}
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </button>
                            <button
                              title="Product"
                              className="p-1.5 rounded hover:bg-chart-3/10 text-chart-3 transition-colors"
                              onClick={() => openQuickEntry('product', student.id)}
                            >
                              <Package className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Evidence Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {(() => {
                const Icon = EVIDENCE_CONFIG[evidenceType].icon;
                return <Icon className="h-5 w-5" />;
              })()}
              {EVIDENCE_CONFIG[evidenceType].label}
              <Badge variant="secondary" className="text-xs font-normal ml-auto">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Student selector (pre-filled if clicked from row) */}
            <Select value={evidenceStudentId} onValueChange={setEvidenceStudentId}>
              <SelectTrigger className="focus:ring-primary">
                <SelectValue placeholder="Select student…" />
              </SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.studentNumber} {s.initials ? `(${s.initials})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Note */}
            <Textarea
              placeholder="What did you observe / hear / see?"
              value={evidenceNote}
              onChange={(e) => setEvidenceNote(e.target.value)}
              rows={3}
              className="focus:ring-primary resize-none"
              autoFocus
            />

            {/* Optional tag */}
            <div className="flex flex-wrap gap-1.5">
              {EVIDENCE_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    evidenceTag === tag
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40'
                  }`}
                  onClick={() => setEvidenceTag(evidenceTag === tag ? '' : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEvidence} disabled={saving || !evidenceNote.trim() || !evidenceStudentId}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
