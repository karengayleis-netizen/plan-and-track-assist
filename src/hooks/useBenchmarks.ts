import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Benchmark } from '@/types';
import { BenchmarkSchema, validateData } from '@/lib/validations';
import { useAuth } from './useAuth';

export function useBenchmarks(studentId?: string) {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchBenchmarks = async () => {
    try {
      setLoading(true);
      
      // Build query with proper filtering
      let benchmarksQuery;
      
      if (studentId) {
        // Filter by specific student
        benchmarksQuery = query(
          collection(db, 'benchmarks'),
          where('studentId', '==', studentId)
        );
      } else if (user?.schoolId) {
        // Filter by user's school for data isolation
        benchmarksQuery = query(
          collection(db, 'benchmarks'),
          where('schoolId', '==', user.schoolId)
        );
      } else {
        // Fallback: fetch all (Firestore rules will still enforce access)
        benchmarksQuery = collection(db, 'benchmarks');
      }
      
      const querySnapshot = await getDocs(benchmarksQuery);
      const benchmarksData = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as DocumentData;
        return {
          id: docSnapshot.id,
          ...data,
          date: data.date?.toDate(),
          createdAt: data.createdAt?.toDate(),
          lastUpdated: data.lastUpdated?.toDate() || data.createdAt?.toDate(),
        } as Benchmark;
      });
      setBenchmarks(benchmarksData);
      setError(null);
    } catch {
      setError('Failed to fetch benchmarks');
    } finally {
      setLoading(false);
    }
  };

  const addBenchmark = async (benchmark: Omit<Benchmark, 'id' | 'createdAt'>) => {
    // Validate input data
    const validation = validateData(BenchmarkSchema, benchmark);
    if (!validation.success) {
      const errorMsg = 'error' in validation ? validation.error : 'Validation failed';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, 'benchmarks'), {
        ...validation.data,
        schoolId: user?.schoolId,
        createdAt: now,
        lastUpdated: now,
      });
      await fetchBenchmarks();
      return docRef.id;
    } catch {
      setError('Failed to add benchmark');
      throw new Error('Failed to add benchmark');
    }
  };

  useEffect(() => {
    if (user) {
      fetchBenchmarks();
    }
  }, [studentId, user?.schoolId]);

  return { benchmarks, loading, error, addBenchmark, refetch: fetchBenchmarks };
}
