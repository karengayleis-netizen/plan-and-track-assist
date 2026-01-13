import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudents } from '@/hooks/useStudents';

export function StudentsTab() {
  const { students, loading } = useStudents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Students</h2>
        <Button><Plus className="h-4 w-4 mr-2" />Add Student</Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading students...</p>
          ) : students.length === 0 ? (
            <p className="text-muted-foreground">No students found. Add your first student to get started.</p>
          ) : (
            <div className="space-y-2">
              {students.map(student => (
                <div key={student.id} className="p-3 border rounded-lg">
                  {student.firstName} {student.lastName} - {student.yearGroup}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
