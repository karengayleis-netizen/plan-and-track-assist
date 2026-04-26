import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Student } from '@/types';
import { StudentSchema, validateData } from '@/lib/validations';
import { normalizeGrade } from '@/types/homeroom';
import { useAuth } from './useAuth';

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchStudents = async () => {
    console.log('[useStudents] fetchStudents called, schoolId:', user?.schoolId, 'role:', user?.role);
    if (!user?.schoolId) {
      console.log('[useStudents] Skipping fetch — no schoolId yet');
      setLoading(false);
      return;
    }
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
          // Normalize grade at the read boundary so Kindergarten variants
          // (JK, SK, "Kindergarten", "0", etc.) all surface as 'K'.
          grade: normalizeGrade(data.grade),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          lastUpdated: data.lastUpdated?.toDate() || data.updatedAt?.toDate(),
        } as Student;
      });
      console.log('[useStudents] Fetched', studentsData.length, 'students');

      // For teachers: filter to only students in their assigned homerooms
      if (user?.role === 'teacher' && user?.assignedHomerooms && user.assignedHomerooms.length > 0) {
        studentsData = studentsData.filter(s => 
          user.assignedHomerooms!.includes(s.homeroom)
        );
      }

      setStudents(studentsData);
      setError(null);
    } catch (err) {
      console.error('[useStudents] Fetch error:', err);
      setError('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const addStudent = async (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!user?.schoolId) {
      throw new Error('No schoolId available — cannot add student');
    }
    const payload = {
      studentNumber: String(student.studentNumber ?? '').trim().replace(/\.0$/, ''),
      initials: (student.initials ?? '').trim(),
      homeroom: (student.homeroom ?? '').trim(),
      grade: normalizeGrade(student.grade),
      schoolId: user.schoolId,
      active: student.active ?? true,
      isFocusStudent: student.isFocusStudent ?? false,
      isHighNeed: student.isHighNeed ?? false,
      gender: student.gender ?? '',
      tags: student.tags ?? [],
    };

    const validation = validateData(StudentSchema, payload);
    if (!validation.success) {
      const errorMsg = 'error' in validation ? validation.error : 'Validation failed';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    // Upsert-by-studentNumber within this school.
    const duplicate = students.find(
      s => s.studentNumber === validation.data.studentNumber && s.schoolId === user.schoolId,
    );
    if (duplicate) {
      const errorMsg = `A student with number "${validation.data.studentNumber}" already exists`;
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const docRef = await addDoc(collection(db, 'students'), {
        ...validation.data,
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

  const updateStudent = async (id: string, updates: Partial<Student>, opts?: { skipRefetch?: boolean }) => {
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
      const now = new Date();
      const payload: Record<string, unknown> = {
        ...updates,
        updatedAt: now,
        lastUpdated: now,
      };
      // Always include schoolId so requestSameSchool() passes and legacy docs self-heal.
      if (user?.schoolId) {
        payload.schoolId = user.schoolId;
      }
      await updateDoc(doc(db, 'students', id), payload);
      if (!opts?.skipRefetch) {
        await fetchStudents();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update student';
      setError(msg);
      // Re-throw the original error so callers can inspect Firestore error codes.
      throw e instanceof Error ? e : new Error(msg);
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
    if (user?.schoolId) {
      fetchStudents();
    }
  }, [user?.schoolId, user?.role]);

  return { students, loading, error, addStudent, updateStudent, deleteStudent, refetch: fetchStudents };
}
