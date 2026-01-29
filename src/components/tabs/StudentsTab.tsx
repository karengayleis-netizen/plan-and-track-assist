import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudents } from '@/hooks/useStudents';
import { GRADES } from '@/types';
import { Search, RefreshCw, Upload, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function StudentsTab() {
  const { students, loading, addStudent, deleteStudent, refetch } = useStudents();
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form state for manual add
  const [studentNumber, setStudentNumber] = useState('');
  const [initials, setInitials] = useState('');
  const [grade, setGrade] = useState('');
  const [isFocusStudent, setIsFocusStudent] = useState(false);
  const [isHighNeed, setIsHighNeed] = useState(false);

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

  // Handle CSV upload
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedClass) {
      toast.error('Please select a class first');
      return;
    }

    // Extract homeroom from selected class (e.g., "2F" from "2F - Grade 2 French")
    const homeroom = selectedClass.split(' ')[0] || selectedClass;

    setIsUploading(true);
    
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header row if present
      const startIndex = lines[0]?.toLowerCase().includes('number') || 
                        lines[0]?.toLowerCase().includes('initial') ? 1 : 0;
      
      let successCount = 0;
      let errorCount = 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        
        if (values.length < 2) {
          console.warn(`Skipping line ${i + 1}: insufficient columns`);
          errorCount++;
          continue;
        }

        const [number, studentInitials] = values;
        
        // Generate coded student number: homeroom-number (e.g., "2A-1")
        const codedStudentNumber = `${homeroom}-${number.trim()}`;
        
        try {
          await addStudent({
            studentNumber: codedStudentNumber,
            initials: studentInitials.trim(),
            firstName: '', // Not stored for privacy
            lastName: '',  // Not stored for privacy
            grade: selectedClass.match(/\d/)?.[0] || '',
            homeroom,
            yearGroup: '',
            className: selectedClass,
            sen: false,
            pupilPremium: false,
            eal: false,
            isFocusStudent: false,
            isHighNeed: false,
          });
          successCount++;
        } catch (err) {
          console.error(`Failed to add student from line ${i + 1}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} student(s)`);
      }
      if (errorCount > 0) {
        toast.warning(`${errorCount} row(s) could not be imported`);
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
    if (!studentNumber || !grade) {
      toast.error('Please fill in required fields');
      return;
    }

    // Generate coded ID if a class is selected
    const homeroom = selectedClass ? selectedClass.split(' ')[0] : '';
    const codedStudentNumber = homeroom ? `${homeroom}-${studentNumber}` : studentNumber;
    
    try {
      await addStudent({
        studentNumber: codedStudentNumber,
        initials,
        firstName: '',
        lastName: '',
        grade,
        homeroom: homeroom || '',
        yearGroup: grade,
        className: selectedClass || '',
        sen: false,
        pupilPremium: false,
        eal: false,
        isFocusStudent,
        isHighNeed,
      });
      toast.success('Student saved successfully');
      // Reset form
      setStudentNumber('');
      setInitials('');
      setGrade('');
      setIsFocusStudent(false);
      setIsHighNeed(false);
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

  // Filter students by selected class
  const classStudents = selectedClass 
    ? students.filter(s => s.className === selectedClass || s.homeroom === selectedClass.split(' ')[0])
    : students;

  // Filter by search query
  const filteredStudents = classStudents.filter(s => 
    s.studentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.initials?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Class Selection & CSV Upload */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>School Roster</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Upload CSV or manually add students. System generates coded IDs (e.g., 2A-1) for privacy.
              </p>
            </div>
            <p className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
              CSV format: Number, Initials
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Class selection & CSV upload */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="focus:ring-primary">
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2A - Grade 2A">2A - Grade 2A</SelectItem>
                    <SelectItem value="2B - Grade 2B">2B - Grade 2B</SelectItem>
                    <SelectItem value="2F - Grade 2 French">2F - Grade 2 French</SelectItem>
                    <SelectItem value="3A - Grade 3A">3A - Grade 3A</SelectItem>
                    <SelectItem value="3B - Grade 3B">3B - Grade 3B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
                <h4 className="font-medium flex items-center gap-2 text-primary">
                  <Upload className="h-4 w-4" />
                  Upload Classlist CSV
                </h4>
                <p className="text-xs text-muted-foreground">
                  CSV format: <code className="bg-muted px-1 rounded">Number, Initials</code><br/>
                  Example: <code className="bg-muted px-1 rounded">1, JD</code> → becomes <code className="bg-muted px-1 rounded">{selectedClass ? selectedClass.split(' ')[0] : 'homeroom'}-1</code>
                </p>
                <Input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".csv" 
                  className="text-sm focus:ring-primary"
                  onChange={handleCSVUpload}
                  disabled={isUploading || !selectedClass}
                />
                {!selectedClass && (
                  <p className="text-xs text-warning flex items-center gap-1">⚠️ Select a class before uploading</p>
                )}
              </div>
            </div>
            
            {/* Right: Manual add form */}
            <div className="space-y-4">
              <h4 className="font-medium">Add Student Manually</h4>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Student # (e.g. 1, 2, 3)"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  className="focus:ring-primary"
                />
                <Input
                  placeholder="Initials (e.g. JD)"
                  value={initials}
                  onChange={(e) => setInitials(e.target.value)}
                  className="focus:ring-primary"
                />
              </div>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger className="focus:ring-primary">
                  <SelectValue placeholder="Select Grade..." />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map(g => (
                    <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex gap-4">
                <div className="flex items-center space-x-2 p-2 bg-primary/10 rounded-lg flex-1 border border-primary/20">
                  <Checkbox 
                    id="focusStudent" 
                    checked={isFocusStudent}
                    onCheckedChange={(checked) => setIsFocusStudent(checked as boolean)}
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
                  />
                  <Label htmlFor="highNeed" className="text-destructive text-sm font-medium">
                    High Need
                  </Label>
                </div>
              </div>
              
              <Button className="w-full" onClick={handleSaveStudent}>
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
              {selectedClass ? `Students in ${selectedClass}` : 'All Students'}
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
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Student #</TableHead>
                  <TableHead>Initials</TableHead>
                  <TableHead>Grade</TableHead>
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
                      <TableCell>{student.homeroom}</TableCell>
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {selectedClass ? 'No students in this class yet.' : 'No students added yet.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          
          <p className="text-xs text-muted-foreground mt-4">
            Student IDs are coded as homeroom-number (e.g., 2A-1) for privacy. First/last names are not stored.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
