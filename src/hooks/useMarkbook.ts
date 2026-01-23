import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MarkbookEntry } from '@/types';

export function useMarkbook(studentId?: string) {
  const [entries, setEntries] = useState<MarkbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      let q = collection(db, 'markbook');
      
      if (studentId) {
        q = query(collection(db, 'markbook'), where('studentId', '==', studentId)) as any;
      }
      
      const querySnapshot = await getDocs(q);
      const entriesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
      })) as MarkbookEntry[];
      setEntries(entriesData);
      setError(null);
    } catch {
      setError('Failed to fetch markbook entries');
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async (entry: Omit<MarkbookEntry, 'id'>) => {
    try {
      const docRef = await addDoc(collection(db, 'markbook'), entry);
      await fetchEntries();
      return docRef.id;
    } catch {
      setError('Failed to add markbook entry');
      throw new Error('Failed to add markbook entry');
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [studentId]);

  return { entries, loading, error, addEntry, refetch: fetchEntries };
}
