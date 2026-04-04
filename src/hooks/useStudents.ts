import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Student } from '@/types';
import { StudentSchema, validateData } from '@/lib/validations';
import { useAuth } from './useAuth';

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchStudents = async () => {
    try {
      setLoading(true);
      
      // If user has a schoolId, filter by school for data isolation
      let studentsQuery;
      if (user?.schoolId) {
        studentsQuery = query(
          collection(db, 'students'),
          where('schoolId', '==', user.schoolId)
        );
      } else {
        // Fallback: fetch all (Firestore rules will still enforce access)
        studentsQuery = collection(db, 'students');
      }
      
      const querySnapshot = await getDocs(studentsQuery);
      let studentsData = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as DocumentData;
        return {
          id: docSnapshot.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          lastUpdated: data.lastUpdated?.toDate() || data.updatedAt?.toDate(),
        } as Student;
      });

      // For teachers: filter to only students in their assigned homerooms
      if (user?.role === 'teacher' && user?.assignedHomerooms && user.assignedHomerooms.length > 0) {
        studentsData = studentsData.filter(s => 
          user.assignedHomerooms!.includes(s.homeroom)
        );
      }

      setStudents(studentsData);
      setError(null);
    } catch {
      setError('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const addStudent = async (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => {
    // Validate input data
    const validation = validateData(StudentSchema, student);
    if (!validation.success) {
      const errorMsg = 'error' in validation ? validation.error : 'Validation failed';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    // Check for duplicate stableStudentId within the school
    const normalizedId = validation.data.stableStudentId.trim();
    const duplicate = students.find(s => s.stableStudentId === normalizedId);
    if (duplicate) {
      const errorMsg = `A student with stable ID "${normalizedId}" already exists`;
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const docRef = await addDoc(collection(db, 'students'), {
        ...validation.data,
        stableStudentId: normalizedId,
        schoolId: user?.schoolId, // Associate with user's school
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await fetchStudents();
      return docRef.id;
    } catch {
      setError('Failed to add student');
      throw new Error('Failed to add student');
    }
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    // Basic validation for updates - ensure strings aren't too long
    if (updates.firstName && updates.firstName.length > 50) {
      throw new Error('First name must be 50 characters or less');
    }
    if (updates.lastName && updates.lastName.length > 50) {
      throw new Error('Last name must be 50 characters or less');
    }
    if (updates.studentNumber && updates.studentNumber.length > 20) {
      throw new Error('Student number must be 20 characters or less');
    }

    try {
      await updateDoc(doc(db, 'students', id), {
        ...updates,
        updatedAt: new Date(),
      });
      await fetchStudents();
    } catch {
      setError('Failed to update student');
      throw new Error('Failed to update student');
    }
  };

  const deleteStudent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'students', id));
      await fetchStudents();
    } catch {
      setError('Failed to delete student');
      throw new Error('Failed to delete student');
    }
  };

  useEffect(() => {
    if (user) {
      fetchStudents();
    }
  }, [user?.schoolId]);

  return { students, loading, error, addStudent, updateStudent, deleteStudent, refetch: fetchStudents };
}
