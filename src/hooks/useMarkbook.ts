import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MarkbookEntry } from '@/types';
import { MarkbookEntrySchema, validateData } from '@/lib/validations';
import { useAuth } from './useAuth';

export function useMarkbook(studentId?: string) {
  const [entries, setEntries] = useState<MarkbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchEntries = async () => {
    if (!studentId && !user?.schoolId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      
      // Build query with proper filtering
      let markbookQuery;
      
      if (studentId) {
        // Filter by specific student
        markbookQuery = query(
          collection(db, 'markbook'),
          where('studentId', '==', studentId)
        );
      } else if (user?.schoolId) {
        // Filter by user's school for data isolation
        markbookQuery = query(
          collection(db, 'markbook'),
          where('schoolId', '==', user.schoolId)
        );
      } else {
        // Fallback: fetch all (Firestore rules will still enforce access)
        markbookQuery = collection(db, 'markbook');
      }
      
      const querySnapshot = await getDocs(markbookQuery);
      const entriesData = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as DocumentData;
        return {
          id: docSnapshot.id,
          ...data,
          date: data.date?.toDate(),
          lastUpdated: data.lastUpdated?.toDate() || data.date?.toDate(),
        } as MarkbookEntry;
      });
      setEntries(entriesData);
      setError(null);
    } catch {
      setError('Failed to fetch markbook entries');
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async (entry: Omit<MarkbookEntry, 'id'>) => {
    // Validate input data
    const validation = validateData(MarkbookEntrySchema, entry);
    if (!validation.success) {
      const errorMsg = 'error' in validation ? validation.error : 'Validation failed';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, 'markbook'), {
        ...validation.data,
        schoolId: user?.schoolId,
        lastUpdated: now,
      });
      await fetchEntries();
      return docRef.id;
    } catch {
      setError('Failed to add markbook entry');
      throw new Error('Failed to add markbook entry');
    }
  };

  useEffect(() => {
    if (studentId || user?.schoolId) {
      fetchEntries();
    }
  }, [studentId, user?.schoolId]);

  return { entries, loading, error, addEntry, refetch: fetchEntries };
}
