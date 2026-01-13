import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Student } from '@/types';

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'students'));
      const studentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      })) as Student[];
      setStudents(studentsData);
      setError(null);
    } catch (err) {
      setError('Failed to fetch students');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addStudent = async (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const docRef = await addDoc(collection(db, 'students'), {
        ...student,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await fetchStudents();
      return docRef.id;
    } catch (err) {
      setError('Failed to add student');
      console.error(err);
      throw err;
    }
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    try {
      await updateDoc(doc(db, 'students', id), {
        ...updates,
        updatedAt: new Date(),
      });
      await fetchStudents();
    } catch (err) {
      setError('Failed to update student');
      console.error(err);
      throw err;
    }
  };

  const deleteStudent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'students', id));
      await fetchStudents();
    } catch (err) {
      setError('Failed to delete student');
      console.error(err);
      throw err;
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  return { students, loading, error, addStudent, updateStudent, deleteStudent, refetch: fetchStudents };
}
