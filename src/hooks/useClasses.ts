import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  DocumentData 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Homeroom, CreateHomeroomInput } from '@/types/homeroom';
import { useAuth } from './useAuth';

export function useClasses() {
  const [classes, setClasses] = useState<Homeroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchClasses = useCallback(async () => {
    // Use schoolId from user profile, or fall back to a default for development
    const schoolId = user?.schoolId || 'default-school';
    
    if (!user?.uid) {
      setClasses([]);
      setLoading(false);
      return;
    }
    
    if (!user.schoolId) {
      console.warn('[useClasses] User has no schoolId - using default-school for fetching');
    }

    try {
      setLoading(true);
      
      const classesQuery = query(
        collection(db, 'homerooms'),
        where('schoolId', '==', schoolId)
      );
      
      const querySnapshot = await getDocs(classesQuery);
      const classesData = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as DocumentData;
        return {
          id: docSnapshot.id,
          code: data.code,
          name: data.name,
          allowedGrades: data.allowedGrades || [],
          schoolId: data.schoolId,
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Homeroom;
      });
      
      // Sort by code alphabetically
      classesData.sort((a, b) => a.code.localeCompare(b.code));
      
      setClasses(classesData);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch classes:', err);
      setError('Failed to fetch classes');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId]);

  const addClass = async (input: Omit<CreateHomeroomInput, 'schoolId' | 'createdBy'>) => {
    if (!user?.uid) {
      throw new Error('User must be authenticated');
    }

    // Use schoolId from user profile, or fall back to a default for development
    const schoolId = user.schoolId || 'default-school';
    
    if (!user.schoolId) {
      console.warn('[useClasses] User has no schoolId set - using default-school. Set schoolId in Firestore users/{uid} document for production.');
    }

    // Validate input
    if (!input.code || input.code.trim().length === 0) {
      throw new Error('Class code is required');
    }
    if (!input.allowedGrades || input.allowedGrades.length === 0) {
      throw new Error('At least one allowed grade is required');
    }

    // Check for duplicate code
    const existingClass = classes.find(
      c => c.code.toLowerCase() === input.code.trim().toLowerCase()
    );
    if (existingClass) {
      throw new Error(`Class "${input.code}" already exists`);
    }

    try {
      const docRef = await addDoc(collection(db, 'homerooms'), {
        code: input.code.trim().toUpperCase(),
        name: input.name?.trim() || '',
        allowedGrades: input.allowedGrades,
        schoolId: schoolId,
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      await fetchClasses();
      return docRef.id;
    } catch (err) {
      console.error('Failed to add class:', err);
      // Provide more helpful error message
      if (err instanceof Error && err.message.includes('permission')) {
        throw new Error('Permission denied. Make sure your user has admin role in Firestore user_roles collection.');
      }
      throw new Error('Failed to create class');
    }
  };

  const updateClass = async (id: string, updates: Partial<Pick<Homeroom, 'code' | 'name' | 'allowedGrades'>>) => {
    try {
      await updateDoc(doc(db, 'homerooms', id), {
        ...updates,
        updatedAt: new Date(),
      });
      await fetchClasses();
    } catch (err) {
      console.error('Failed to update class:', err);
      throw new Error('Failed to update class');
    }
  };

  const deleteClass = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'homerooms', id));
      await fetchClasses();
    } catch (err) {
      console.error('Failed to delete class:', err);
      throw new Error('Failed to delete class');
    }
  };

  // Get a class by its code
  const getClassByCode = useCallback((code: string): Homeroom | undefined => {
    return classes.find(c => c.code.toLowerCase() === code.toLowerCase());
  }, [classes]);

  // Check if user can access a class (admin = all, teacher = assigned only)
  const canAccessClass = useCallback((classId: string): boolean => {
    if (user?.role === 'admin') return true;
    // TODO: Check teacher assignment when membership system is implemented
    // For now, teachers can access all classes in their school
    return classes.some(c => c.id === classId);
  }, [user?.role, classes]);

  useEffect(() => {
    if (user?.schoolId) {
      fetchClasses();
    }
  }, [user?.schoolId, fetchClasses]);

  return {
    classes,
    loading,
    error,
    addClass,
    updateClass,
    deleteClass,
    getClassByCode,
    canAccessClass,
    refetch: fetchClasses,
  };
}
