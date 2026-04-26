import { useState } from 'react';
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
import { Search, RefreshCw, Edit, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatGradeDisplay } from '@/types/homeroom';
import { Student } from '@/types';
import { freshnessLabel, isStale } from '@/lib/freshness';
import { formatStudentDisplay } from '@/lib/studentDisplay';
import { StudentSummaryPanel } from '@/components/students/StudentSummaryPanel';
import { BulkActionsBar } from '@/components/students/BulkActionsBar';
import { TagInput } from '@/components/ui/tag-input';
import { Badge } from '@/components/ui/badge';
import { ReplaceRosterPanel } from '@/components/students/ReplaceRosterPanel';

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
  const { classes, loading: classesLoading } = useClasses();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterTag, setFilterTag] = useState('all');

  // Manual add form
  const [studentNumber, setStudentNumber] = useState('');
  const [initials, setInitials] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [isFocusStudent, setIsFocusStudent] = useState(false);
  const [isHighNeed, setIsHighNeed] = useState(false);
  const [selectedGender, setSelectedGender] = useState('');

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const isAdmin = user?.role === 'admin';

  const handleSaveStudent = async () => {
    if (!selectedClass) {
      toast.error('Please select a homeroom first');
      return;
    }
    if (!studentNumber.trim()) {
      toast.error('Please enter a Student Number');
      return;
    }
    if (!selectedGrade) {
      toast.error('Please select a grade');
      return;
    }
    try {
      await addStudent({
        studentNumber: studentNumber.trim(),
        initials: initials.trim(),
        homeroom: selectedClass.code,
        grade: selectedGrade,
        schoolId: user?.schoolId || '',
        active: true,
        isFocusStudent,
        isHighNeed,
        gender: selectedGender || '',
      });
      toast.success('Student saved');
      setStudentNumber('');
      setInitials('');
      setSelectedGrade('');
      setIsFocusStudent(false);
      setIsHighNeed(false);
      setSelectedGender('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save student');
    }
  };

  const handleDeleteStudent = async (id: string, label: string) => {
    if (confirm(`Delete student ${label}?`)) {
      try {
        await deleteStudent(id);
        toast.success('Student deleted');
      } catch {
        toast.error('Failed to delete student');
      }
    }
  };

  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    setEditFocus(student.isFocusStudent ?? false);
    setEditHighNeed(student.isHighNeed ?? false);
    setEditGender(student.gender || '');
    setEditTags(student.tags || []);
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    try {
      await updateStudent(editingStudent.id, {
        isFocusStudent: editFocus,
        isHighNeed: editHighNeed,
        gender: editGender,
        tags: editTags,
      });
      toast.success('Student updated');
      setEditingStudent(null);
    } catch {
      toast.error('Failed to update student');
    }
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

  // Active-only roster view (deactivated students stay in DB but are hidden)
  const activeStudents = students.filter(s => s.active !== false);

  const classStudents = selectedClass
    ? activeStudents.filter(s => s.homeroom === selectedClass.code)
    : activeStudents;

  const allTags = [...new Set(activeStudents.flatMap(s => s.tags || []))].sort();

  const filteredStudents = classStudents
    .filter(s => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        s.studentNumber?.toLowerCase().includes(q) ||
        s.initials?.toLowerCase().includes(q) ||
        s.homeroom?.toLowerCase().includes(q);
      const matchesTag = filterTag === 'all' || (s.tags || []).includes(filterTag);
      return matchesSearch && matchesTag;
    })
    .sort((a, b) => {
      const homeCmp = (a.homeroom || '').localeCompare(b.homeroom || '');
      if (homeCmp !== 0) return homeCmp;
      return (a.studentNumber || '').localeCompare(b.studentNumber || '');
    });

  const selectedStudents = filteredStudents.filter(s => selectedIds.has(s.id));

  return (
    <div className="space-y-6">
      {/* Admin: Replace Roster from Board CSV */}
      {isAdmin && <ReplaceRosterPanel onAfterRun={() => refetch()} />}

      {/* Manual add (small) */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Student Manually</CardTitle>
          <p className="text-xs text-muted-foreground">
            For small fixes only. Use <strong>Replace Roster from Board CSV</strong> above for bulk updates.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label>Homeroom *</Label>
                {classesLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="focus:ring-primary mt-1">
                      <SelectValue placeholder="Select a homeroom" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>
                          <span className="font-mono font-medium">{cls.code}</span>
                          {cls.name && <span className="text-muted-foreground ml-2">— {cls.name}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label htmlFor="studentNumber">Student Number * (board number)</Label>
                <Input
                  id="studentNumber"
                  placeholder="e.g. 970591"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  className="focus:ring-primary mt-1 font-mono"
                  disabled={!selectedClass}
                />
              </div>
              <div>
                <Label htmlFor="initials">Initials</Label>
                <Input
                  id="initials"
                  placeholder="e.g. J.P.E."
                  value={initials}
                  onChange={(e) => setInitials(e.target.value)}
                  className="focus:ring-primary mt-1"
                  disabled={!selectedClass}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label>Grade *</Label>
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
                  <p className="text-xs text-muted-foreground mt-1">Pick a homeroom first.</p>
                )}
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={selectedGender} onValueChange={setSelectedGender}>
                  <SelectTrigger className="focus:ring-primary mt-1">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="X">Non-binary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center space-x-2 p-2 bg-primary/10 rounded-lg flex-1 border border-primary/20">
                  <Checkbox
                    id="focusStudent"
                    checked={isFocusStudent}
                    onCheckedChange={(c) => setIsFocusStudent(c as boolean)}
                    disabled={!selectedClass}
                  />
                  <Label htmlFor="focusStudent" className="text-primary text-sm font-medium">Focus</Label>
                </div>
                <div className="flex items-center space-x-2 p-2 bg-destructive/10 rounded-lg flex-1 border border-destructive/20">
                  <Checkbox
                    id="highNeed"
                    checked={isHighNeed}
                    onCheckedChange={(c) => setIsHighNeed(c as boolean)}
                    disabled={!selectedClass}
                  />
                  <Label htmlFor="highNeed" className="text-destructive text-sm font-medium">High Need</Label>
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

      {/* Roster table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <CardTitle>
              {selectedClass ? `Students in ${selectedClass.code}` : (isAdmin ? 'All Active Students' : 'Active Students')}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({filteredStudents.length})
              </span>
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search initials, #, homeroom…"
                  className="pl-8 w-64 focus:ring-primary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {classes.length > 0 && (
                <Select value={selectedClassId || 'all'} onValueChange={(v) => setSelectedClassId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-44 focus:ring-primary">
                    <SelectValue placeholder="All homerooms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All homerooms</SelectItem>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
              Loading students…
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
                  <TableHead>Student</TableHead>
                  {isAdmin && <TableHead>Full Number</TableHead>}
                  <TableHead>Grade</TableHead>
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
                    <TableRow
                      key={student.id}
                      className={`hover:bg-muted/30 cursor-pointer ${selectedIds.has(student.id) ? 'bg-primary/5' : ''}`}
                      onClick={() => setSummaryStudent(student)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(student.id)}
                          onCheckedChange={() => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(student.id)) next.delete(student.id);
                              else next.add(student.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatStudentDisplay(student)}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {student.studentNumber}
                        </TableCell>
                      )}
                      <TableCell>{student.grade}</TableCell>
                      <TableCell className="font-mono">{student.homeroom}</TableCell>
                      <TableCell>
                        <span className={`text-xs ${isStale(student.lastUpdated) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {freshnessLabel(student.lastUpdated)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {(student.tags || []).map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={(e) => { e.stopPropagation(); openEditDialog(student); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); handleDeleteStudent(student.id, formatStudentDisplay(student)); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 9 : 8} className="text-center text-muted-foreground py-8">
                      No active students found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit {editingStudent ? formatStudentDisplay(editingStudent) : ''}
              {editingStudent && (
                <span className="block text-xs font-mono font-normal text-muted-foreground mt-1">
                  Full #: {editingStudent.studentNumber}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                <Checkbox id="editFocus" checked={editFocus} onCheckedChange={(c) => setEditFocus(c as boolean)} />
                <Label htmlFor="editFocus" className="text-primary text-sm font-medium">Focus Student</Label>
              </div>
              <div className="flex items-center space-x-2 p-2 bg-destructive/10 rounded-lg flex-1 border border-destructive/20">
                <Checkbox id="editHighNeed" checked={editHighNeed} onCheckedChange={(c) => setEditHighNeed(c as boolean)} />
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

      <StudentSummaryPanel
        student={summaryStudent}
        open={!!summaryStudent}
        onClose={() => setSummaryStudent(null)}
        benchmarks={benchmarks}
        markbookEntries={markbookEntries}
      />

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
