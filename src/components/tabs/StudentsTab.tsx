import { useState } from 'react';
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
  const { students, loading, addStudent, deleteStudent } = useStudents();
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [studentNumber, setStudentNumber] = useState('');
  const [initials, setInitials] = useState('');
  const [grade, setGrade] = useState('');
  const [isFocusStudent, setIsFocusStudent] = useState(false);
  const [isHighNeed, setIsHighNeed] = useState(false);
  
  const handleSaveStudent = async () => {
    if (!studentNumber || !grade) {
      toast.error('Please fill in required fields');
      return;
    }
    
    try {
      await addStudent({
        studentNumber,
        initials,
        firstName: '',
        lastName: '',
        grade,
        homeroom: selectedClass || '',
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

  const handleDeleteStudent = async (id: string) => {
    try {
      await deleteStudent(id);
      toast.success('Student deleted');
    } catch (err) {
      toast.error('Failed to delete student');
    }
  };

  const filteredStudents = students.filter(s => 
    s.studentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const classStudents = selectedClass 
    ? filteredStudents.filter(s => s.homeroom === selectedClass)
    : filteredStudents;

  return (
    <div className="space-y-6">
      {/* Add/Edit Student Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add / Edit Student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Student # (e.g. 123456)"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Initials"
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Grade..." />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map(g => (
                    <SelectItem key={g} value={g}>Grade {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg">
              <Checkbox 
                id="focusStudent" 
                checked={isFocusStudent}
                onCheckedChange={(checked) => setIsFocusStudent(checked as boolean)}
              />
              <Label htmlFor="focusStudent" className="text-purple-700 font-medium">
                Focus Student (Triangulation)
              </Label>
            </div>
            
            <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg">
              <Checkbox 
                id="highNeed" 
                checked={isHighNeed}
                onCheckedChange={(checked) => setIsHighNeed(checked as boolean)}
              />
              <Label htmlFor="highNeed" className="text-red-600 font-medium">
                Flag as "High Need" (Manual Override)
              </Label>
            </div>
            
            <Button className="w-full" onClick={handleSaveStudent}>
              Save Student
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Class Roster</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : classStudents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No students in roster yet.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {classStudents.map(student => (
                  <div key={student.id} className="p-3 border rounded-lg flex justify-between items-center">
                    <div>
                      <span className="font-medium">{student.studentNumber}</span>
                      {student.initials && <span className="ml-2 text-muted-foreground">({student.initials})</span>}
                      <span className="ml-2 text-sm text-muted-foreground">Grade {student.grade}</span>
                    </div>
                    <div className="flex gap-2">
                      {student.isFocusStudent && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Focus</span>
                      )}
                      {student.isHighNeed && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">High Need</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* School Roster (Class-based) */}
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
            {/* My Classes (assigned) */}
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
                    <SelectItem value="3E">3E - Grade 3 English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Upload CSV Section */}
              <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Upload Classlist CSV</h4>
                <p className="text-xs text-muted-foreground">
                  Columns supported: <code>student name (last, first)</code>, <code>number (optional)</code>, <code>grade</code>, <code>homeroom</code>.
                </p>
                <div className="flex items-center gap-2">
                  <Input type="file" accept=".csv" className="text-sm" />
                </div>
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
                  <Button variant="outline" size="sm">
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
                  {classStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No students in roster yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    classStudents.map(student => (
                      <TableRow key={student.id}>
                        <TableCell>{student.studentNumber}</TableCell>
                        <TableCell>{student.firstName} {student.lastName}</TableCell>
                        <TableCell>{student.grade}</TableCell>
                        <TableCell>{student.homeroom}</TableCell>
                        <TableCell>{student.seat || '-'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-500"
                              onClick={() => handleDeleteStudent(student.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              <p className="text-xs text-muted-foreground">
                Tip: Edit names safely — the internal <code>studentId</code> stays stable.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
