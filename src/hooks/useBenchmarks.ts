import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Benchmark } from '@/types';

export function useBenchmarks(studentId?: string) {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBenchmarks = async () => {
    try {
      setLoading(true);
      let q = collection(db, 'benchmarks');
      
      if (studentId) {
        q = query(collection(db, 'benchmarks'), where('studentId', '==', studentId)) as any;
      }
      
      const querySnapshot = await getDocs(q);
      const benchmarksData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Benchmark[];
      setBenchmarks(benchmarksData);
      setError(null);
    } catch {
      setError('Failed to fetch benchmarks');
    } finally {
      setLoading(false);
    }
  };

  const addBenchmark = async (benchmark: Omit<Benchmark, 'id' | 'createdAt'>) => {
    try {
      const docRef = await addDoc(collection(db, 'benchmarks'), {
        ...benchmark,
        createdAt: new Date(),
      });
      await fetchBenchmarks();
      return docRef.id;
    } catch {
      setError('Failed to add benchmark');
      throw new Error('Failed to add benchmark');
    }
  };

  useEffect(() => {
    fetchBenchmarks();
  }, [studentId]);

  return { benchmarks, loading, error, addBenchmark, refetch: fetchBenchmarks };
}
