import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudents } from '@/hooks/useStudents';
import { useBenchmarks } from '@/hooks/useBenchmarks';
import { Search, RefreshCw, Upload, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { toast } from 'sonner';

export function InsightsTab() {
  const { students, addStudent, deleteStudent } = useStudents();
  const { benchmarks } = useBenchmarks();
  
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse CSV and create students with coded numbers
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

        // Parse CSV line (handles quoted values)
        const values = parseCSVLine(line);
        
        if (values.length < 2) {
          console.warn(`Skipping line ${i + 1}: insufficient columns`);
          errorCount++;
          continue;
        }

        const [number, initials] = values;
        
        // Generate coded student number: homeroom-number (e.g., "2A-1")
        const studentNumber = `${homeroom}-${number.trim()}`;
        
        try {
          await addStudent({
            studentNumber,
            initials: initials.trim(),
            firstName: '', // Not stored for privacy
            lastName: '',  // Not stored for privacy
            grade: selectedClass.match(/\d/)?.[0] || '', // Extract grade from class
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

  // Helper to parse CSV line (handles quoted values with commas)
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

  // Filter students by selected class
  const classStudents = selectedClass 
    ? students.filter(s => s.className === selectedClass || s.homeroom === selectedClass.split(' ')[0])
    : [];

  // Filter by search query
  const filteredStudents = classStudents.filter(s => 
    s.studentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.initials.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate data count per student
  const dataCountByStudent = students.map(student => ({
    name: student.initials || student.studentNumber,
    count: benchmarks.filter(b => b.studentId === student.id).length
  }));

  // Calculate risk vs stable
  const performanceData = students.map(student => {
    const studentBenchmarks = benchmarks.filter(b => b.studentId === student.id);
    const atRisk = studentBenchmarks.some(b => parseFloat(b.score) < 50) ? 1 : 0;
    return {
      name: student.initials || student.studentNumber,
      atRisk,
      stable: atRisk ? 0 : 1
    };
  });

  return (
    <div className="space-y-6">
      {/* School Roster Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>School Roster (Class-based)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Upload CSV with student numbers and initials. System generates coded IDs (e.g., 2A-1).
              </p>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              CSV format: Number, Initials
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
              
              <div className="border-2 border-dashed rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Upload Classlist CSV</h4>
                <p className="text-xs text-muted-foreground">
                  CSV format: <code>Number, Initials</code><br/>
                  Example: <code>1, JD</code> → becomes <code>{selectedClass ? selectedClass.split(' ')[0] : 'homeroom'}-1</code>
                </p>
                <Input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".csv" 
                  className="text-sm"
                  onChange={handleCSVUpload}
                  disabled={isUploading || !selectedClass}
                />
                <p className="text-xs text-muted-foreground">
                  {!selectedClass && '⚠️ Select a class before uploading'}
                </p>
              </div>
            </div>
            
            {/* Students in selected class */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Students in {selectedClass || 'selected class'}</h3>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search number / initials..." 
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
                    <TableHead>Initials</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Homeroom</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map(student => (
                      <TableRow key={student.id}>
                        <TableCell className="font-mono">{student.studentNumber}</TableCell>
                        <TableCell>{student.initials}</TableCell>
                        <TableCell>{student.grade}</TableCell>
                        <TableCell>{student.homeroom}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Delete student ${student.studentNumber}?`)) {
                                deleteStudent(student.id)
                                  .then(() => toast.success('Student deleted'))
                                  .catch(() => toast.error('Failed to delete student'));
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {selectedClass ? 'No students in this class yet.' : 'Select a class to view students.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              
              <p className="text-xs text-muted-foreground">
                Student IDs are coded as homeroom-number (e.g., 2A-1) for privacy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Data Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataCountByStudent}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#4f46e5" name="Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Class Performance (Risk vs Stable)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="atRisk" stackId="a" fill="#ef4444" name="At Risk" />
                  <Bar dataKey="stable" stackId="a" fill="#22c55e" name="Stable" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Deep Dive */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Student Deep Dive</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select a student to see their trend line and detailed history.
              </p>
            </div>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="-- Choose Student --" />
              </SelectTrigger>
              <SelectContent>
                {students.map(student => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.studentNumber} - {student.initials}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {selectedStudent ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Showing data for student: {students.find(s => s.id === selectedStudent)?.studentNumber}
              </p>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Select a student to view their detailed analytics.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
