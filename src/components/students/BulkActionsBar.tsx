import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { BarChart3, StickyNote, Tag, Home, X, Loader2 } from 'lucide-react';
import { Student, ASSESSMENT_TYPES } from '@/types';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type BulkAction = 'benchmark' | 'note' | 'tag' | 'homeroom';

interface BulkActionsBarProps {
  selectedStudents: Student[];
  onClearSelection: () => void;
  onUpdateStudents: (ids: string[], updates: Partial<Student>) => Promise<void>;
  onRefetch: () => void;
  homerooms: { id: string; code: string; name: string }[];
}

export function BulkActionsBar({
  selectedStudents,
  onClearSelection,
  onUpdateStudents,
  onRefetch,
  homerooms,
}: BulkActionsBarProps) {
  const { user } = useAuth();
  const [activeAction, setActiveAction] = useState<BulkAction | null>(null);
  const [saving, setSaving] = useState(false);

  // Benchmark form
  const [bulkAssessmentType, setBulkAssessmentType] = useState('');
  const [bulkScore, setBulkScore] = useState('');
  const [bulkDate, setBulkDate] = useState('');

  // Note form
  const [bulkNote, setBulkNote] = useState('');

  // Tag form
  const [bulkFocus, setBulkFocus] = useState<'set' | 'clear' | ''>('');
  const [bulkHighNeed, setBulkHighNeed] = useState<'set' | 'clear' | ''>('');

  // Homeroom form
  const [bulkHomeroom, setBulkHomeroom] = useState('');

  if (selectedStudents.length === 0) return null;

  const resetForms = () => {
    setBulkAssessmentType('');
    setBulkScore('');
    setBulkDate('');
    setBulkNote('');
    setBulkFocus('');
    setBulkHighNeed('');
    setBulkHomeroom('');
  };

  const closeAction = () => {
    setActiveAction(null);
    resetForms();
  };

  const handleBulkBenchmark = async () => {
    if (!bulkAssessmentType || !bulkScore || !bulkDate) {
      toast.error('Fill in all benchmark fields');
      return;
    }
    setSaving(true);
    try {
      let count = 0;
      for (const student of selectedStudents) {
        await addDoc(collection(db, 'benchmarks'), {
          schoolId: user?.schoolId || '',
          studentId: student.id,
          studentNumber: student.studentNumber,
          assessmentType: bulkAssessmentType,
          assessmentName: bulkAssessmentType,
          subject: '',
          score: bulkScore,
          maxScore: 100,
          percentage: 0,
          date: new Date(bulkDate),
          term: '',
          createdAt: new Date(),
          lastUpdated: new Date(),
        });
        count++;
      }
      toast.success(`Benchmark added to ${count} student${count !== 1 ? 's' : ''}`);
      onRefetch();
      closeAction();
    } catch {
      toast.error('Failed to add benchmarks');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkNote = async () => {
    if (!bulkNote.trim()) {
      toast.error('Please enter a note');
      return;
    }
    setSaving(true);
    try {
      let count = 0;
      for (const student of selectedStudents) {
        await addDoc(collection(db, 'evidence'), {
          schoolId: user?.schoolId || '',
          studentId: student.id,
          studentNumber: student.studentNumber,
          type: 'observation',
          note: bulkNote.trim(),
          tag: null,
          timestamp: new Date(),
          createdBy: user?.uid || '',
          lastUpdated: new Date(),
        });
        count++;
      }
      toast.success(`Note added to ${count} student${count !== 1 ? 's' : ''}`);
      closeAction();
    } catch {
      toast.error('Failed to add notes');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkTag = async () => {
    if (!bulkFocus && !bulkHighNeed) {
      toast.error('Select at least one tag to update');
      return;
    }
    setSaving(true);
    try {
      const updates: Partial<Student> = {};
      if (bulkFocus === 'set') updates.isFocusStudent = true;
      if (bulkFocus === 'clear') updates.isFocusStudent = false;
      if (bulkHighNeed === 'set') updates.isHighNeed = true;
      if (bulkHighNeed === 'clear') updates.isHighNeed = false;

      await onUpdateStudents(
        selectedStudents.map(s => s.id),
        updates,
      );
      toast.success(`Tags updated for ${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''}`);
      closeAction();
    } catch {
      toast.error('Failed to update tags');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkHomeroom = async () => {
    if (!bulkHomeroom) {
      toast.error('Select a homeroom');
      return;
    }
    setSaving(true);
    try {
      await onUpdateStudents(
        selectedStudents.map(s => s.id),
        { homeroom: bulkHomeroom },
      );
      toast.success(`Homeroom updated for ${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''}`);
      closeAction();
    } catch {
      toast.error('Failed to update homeroom');
    } finally {
      setSaving(false);
    }
  };

  const actions: { key: BulkAction; label: string; icon: typeof BarChart3 }[] = [
    { key: 'benchmark', label: 'Add Benchmark', icon: BarChart3 },
    { key: 'note', label: 'Add Note', icon: StickyNote },
    { key: 'tag', label: 'Update Tags', icon: Tag },
    { key: 'homeroom', label: 'Move Homeroom', icon: Home },
  ];

  return (
    <>
      {/* Sticky action bar */}
      <div className="sticky bottom-4 z-40 mx-auto max-w-3xl">
        <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-xs font-semibold">
              {selectedStudents.length} selected
            </Badge>
            <button
              onClick={onClearSelection}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="h-6 w-px bg-border shrink-0" />

          <div className="flex gap-2 flex-wrap">
            {actions.map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setActiveAction(key)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Dialogs */}
      <Dialog open={activeAction === 'benchmark'} onOpenChange={(o) => !o && closeAction()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Benchmark to {selectedStudents.length} Students</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Assessment Type *</Label>
              <Select value={bulkAssessmentType} onValueChange={setBulkAssessmentType}>
                <SelectTrigger className="mt-1 focus:ring-primary">
                  <SelectValue placeholder="Select assessment…" />
                </SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Score *</Label>
              <Input
                className="mt-1 focus:ring-primary"
                placeholder="e.g. Level 42"
                value={bulkScore}
                onChange={e => setBulkScore(e.target.value)}
              />
            </div>
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                className="mt-1 focus:ring-primary"
                value={bulkDate}
                onChange={e => setBulkDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAction} disabled={saving}>Cancel</Button>
            <Button onClick={handleBulkBenchmark} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeAction === 'note'} onOpenChange={(o) => !o && closeAction()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note to {selectedStudents.length} Students</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Enter note for all selected students…"
              rows={4}
              className="focus:ring-primary resize-none"
              value={bulkNote}
              onChange={e => setBulkNote(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAction} disabled={saving}>Cancel</Button>
            <Button onClick={handleBulkNote} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeAction === 'tag'} onOpenChange={(o) => !o && closeAction()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Tags for {selectedStudents.length} Students</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Focus Student</Label>
              <Select value={bulkFocus} onValueChange={(v) => setBulkFocus(v as 'set' | 'clear' | '')}>
                <SelectTrigger className="mt-1 focus:ring-primary">
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No change</SelectItem>
                  <SelectItem value="set">Set as Focus</SelectItem>
                  <SelectItem value="clear">Remove Focus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>High Need</Label>
              <Select value={bulkHighNeed} onValueChange={(v) => setBulkHighNeed(v as 'set' | 'clear' | '')}>
                <SelectTrigger className="mt-1 focus:ring-primary">
                  <SelectValue placeholder="No change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No change</SelectItem>
                  <SelectItem value="set">Set as High Need</SelectItem>
                  <SelectItem value="clear">Remove High Need</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAction} disabled={saving}>Cancel</Button>
            <Button onClick={handleBulkTag} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activeAction === 'homeroom'} onOpenChange={(o) => !o && closeAction()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move {selectedStudents.length} Students to Homeroom</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>New Homeroom *</Label>
            <Select value={bulkHomeroom} onValueChange={setBulkHomeroom}>
              <SelectTrigger className="mt-1 focus:ring-primary">
                <SelectValue placeholder="Select homeroom…" />
              </SelectTrigger>
              <SelectContent>
                {homerooms.map(h => (
                  <SelectItem key={h.id} value={h.code}>
                    <span className="font-mono font-medium">{h.code}</span>
                    {h.name && <span className="text-muted-foreground ml-2">— {h.name}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAction} disabled={saving}>Cancel</Button>
            <Button onClick={handleBulkHomeroom} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
