import { useState, useRef } from 'react';
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
import { Search, RefreshCw, Upload, Edit, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatGradeDisplay, parseGradeToNumber } from '@/types/homeroom';
import { Student } from '@/types';

export function StudentsTab() {
  const { students, loading, addStudent, updateStudent, deleteStudent, refetch } = useStudents();
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editFocus, setEditFocus] = useState(false);
  const [editHighNeed, setEditHighNeed] = useState(false);
  const [editGender, setEditGender] = useState('');
  const { classes, loading: classesLoading, getClassByCode } = useClasses();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // Handle CSV upload - format: StudentNumber, Initials, Grade
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
        
        // Expected format: StudentNumber, Initials, Grade
        if (values.length < 3) {
          errors.push(`Row ${i + 1}: Expected 3 columns (StudentNumber, Initials, Grade), got ${values.length}`);
          errorCount++;
          continue;
        }

        const [number, studentInitials, gradeStr, genderStr] = values;
        
        // Validate grade against homeroom
        const gradeValidation = validateGradeForHomeroom(gradeStr, selectedClass);
        if (!gradeValidation.valid) {
          errors.push(`Row ${i + 1}: ${gradeValidation.error}`);
          errorCount++;
          continue;
        }

        // Generate coded student number: homeroom-number (e.g., "2AF-1")
        const codedStudentNumber = `${selectedClass.code}-${number.trim()}`;
        
        try {
          await addStudent({
            studentNumber: codedStudentNumber,
            initials: studentInitials.trim(),
            firstName: '', // Not stored for privacy
            lastName: '',  // Not stored for privacy
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
          console.error(`Failed to add student from row ${i + 1}:`, err);
          errors.push(`Row ${i + 1}: Failed to save student`);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} student(s)`);
      }
      if (errorCount > 0) {
        toast.warning(`${errorCount} row(s) could not be imported`);
        // Log first few errors for debugging
        errors.slice(0, 5).forEach(err => console.warn(err));
        if (errors.length > 5) {
          console.warn(`... and ${errors.length - 5} more errors`);
        }
      }
    } catch (err) {
      console.error('CSV parsing error:', err);
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
    
    try {
      await addStudent({
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
      // Reset form
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

  // Filter students by selected homeroom
  const classStudents = selectedClass 
    ? students.filter(s => s.homeroom === selectedClass.code)
    : students;

  // Filter by search query
  const filteredStudents = classStudents
    .filter(s => 
      s.studentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.initials?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const numA = parseInt(a.studentNumber?.split('-').pop() || '0', 10);
      const numB = parseInt(b.studentNumber?.split('-').pop() || '0', 10);
      return numA - numB;
    });

  return (
    <div className="space-y-6">
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
              CSV: StudentNumber, Initials, Grade, Gender
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
                    CSV format: <code className="bg-muted px-1 rounded">StudentNumber, Initials, Grade, Gender</code>
                  </p>
                  <p>
                    Example: <code className="bg-muted px-1 rounded">1, JD, 4, M</code> → becomes <code className="bg-muted px-1 rounded">{selectedClass?.code || 'homeroom'}-1</code>
                  </p>
                  <p className="text-muted-foreground/70">Gender column is optional (M/F/X)</p>
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

      {/* Student Roster Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {selectedClass ? `Students in ${selectedClass.code}` : 'All Students'}
              {selectedClass && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({filteredStudents.length} students)
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search..." 
                  className="pl-8 w-48 focus:ring-primary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
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
                  <TableHead>Student #</TableHead>
                  <TableHead>Initials</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Homeroom</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map(student => (
                    <TableRow key={student.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono font-medium">{student.studentNumber}</TableCell>
                      <TableCell>{student.initials}</TableCell>
                      <TableCell>{student.grade}</TableCell>
                      <TableCell>{student.gender || '—'}</TableCell>
                      <TableCell className="font-mono">{student.homeroom}</TableCell>
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
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary">
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
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
    </div>
  );
}
