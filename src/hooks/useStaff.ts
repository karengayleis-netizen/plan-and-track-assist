import { useState, useCallback } from 'react';
import { 
  collection, 
  doc,
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  DocumentData 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { StaffMember, CreateStaffInput, UpdateStaffInput } from '@/types/staff';
import { useAuth } from './useAuth';

export function useStaff() {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [searchResults, setSearchResults] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  /**
   * Fetch all staff members for the current school
   */
  const fetchStaffMembers = useCallback(async () => {
    if (!user?.uid || !user?.schoolId) {
      setStaffMembers([]);
      return;
    }
    const schoolId = user.schoolId;

    try {
      setLoading(true);
      setError(null);
      
      const staffQuery = query(
        collection(db, 'teachers'),
        where('schoolId', '==', schoolId)
      );
      
      const querySnapshot = await getDocs(staffQuery);
      const staffData = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as DocumentData;
        return {
          uid: docSnapshot.id,
          email: data.email,
          emailLower: data.emailLower,
          schoolId: data.schoolId,
          role: data.role || 'teacher',
          canWrite: data.canWrite || false,
          assignedHomerooms: data.assignedHomerooms || [],
          displayName: data.displayName,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as StaffMember;
      });
      
      // Sort by email
      staffData.sort((a, b) => a.email.localeCompare(b.email));
      
      setStaffMembers(staffData);
    } catch (err) {
      console.error('Failed to fetch staff members:', err);
      setError('Failed to fetch staff members');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.schoolId]);

  /**
   * Search for staff by email (case-insensitive)
   */
  const searchStaffByEmail = useCallback(async (email: string) => {
    if (!user?.uid || !user?.schoolId) {
      setSearchResults([]);
      return;
    }

    if (!email.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      setError(null);
      
      const searchLower = email.trim().toLowerCase();
      const schoolId = user.schoolId;
      
      // Query Firestore for exact email match (case-insensitive via emailLower)
      const staffQuery = query(
        collection(db, 'teachers'),
        where('schoolId', '==', schoolId),
        where('emailLower', '==', searchLower)
      );
      
      const querySnapshot = await getDocs(staffQuery);
      const results = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as DocumentData;
        return {
          uid: docSnapshot.id,
          email: data.email,
          emailLower: data.emailLower,
          schoolId: data.schoolId,
          role: data.role || 'teacher',
          canWrite: data.canWrite || false,
          assignedHomerooms: data.assignedHomerooms || [],
          displayName: data.displayName,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as StaffMember;
      });
      
      setSearchResults(results);
    } catch (err) {
      console.error('Failed to search staff:', err);
      setError('Failed to search staff');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [user?.uid, user?.schoolId]);

  /**
   * Get a single staff member by UID
   */
  const getStaffByUid = useCallback(async (uid: string): Promise<StaffMember | null> => {
    if (!uid.trim()) return null;

    try {
      const docRef = doc(db, 'teachers', uid);
      const docSnapshot = await getDoc(docRef);
      
      if (!docSnapshot.exists()) {
        return null;
      }

      const data = docSnapshot.data() as DocumentData;
      return {
        uid: docSnapshot.id,
        email: data.email,
        emailLower: data.emailLower,
        schoolId: data.schoolId,
        role: data.role || 'teacher',
        canWrite: data.canWrite || false,
        assignedHomerooms: data.assignedHomerooms || [],
        displayName: data.displayName,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as StaffMember;
    } catch (err) {
      console.error('Failed to get staff member:', err);
      return null;
    }
  }, []);

  /**
   * Add or update a staff member (docId = uid)
   */
  const saveStaffMember = async (input: CreateStaffInput): Promise<void> => {
    if (!user?.uid) {
      throw new Error('User must be authenticated');
    }

    if (!user.schoolId) {
      throw new Error('User has no school assigned. Contact your administrator.');
    }
    const schoolId = user.schoolId;

    // Validate input
    if (!input.uid || input.uid.trim().length === 0) {
      throw new Error('Staff UID is required');
    }
    if (!input.email || input.email.trim().length === 0) {
      throw new Error('Staff email is required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.email.trim())) {
      throw new Error('Invalid email format');
    }

    try {
      const docRef = doc(db, 'teachers', input.uid.trim());
      
      // Check if doc exists
      const existingDoc = await getDoc(docRef);
      const now = new Date();

      if (existingDoc.exists()) {
        // Update existing
      await updateDoc(docRef, {
          email: input.email.trim(),
          emailLower: input.email.trim().toLowerCase(),
          schoolId: schoolId,
          role: input.role || 'teacher',
          canWrite: input.canWrite ?? false,
          assignedHomerooms: input.assignedHomerooms || [],
          displayName: input.displayName?.trim() || null,
          updatedAt: now,
        });
      } else {
        // Create new
        await setDoc(docRef, {
          email: input.email.trim(),
          emailLower: input.email.trim().toLowerCase(),
          schoolId: schoolId,
          role: input.role || 'teacher',
          canWrite: input.canWrite ?? false,
          assignedHomerooms: input.assignedHomerooms || [],
          displayName: input.displayName?.trim() || null,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Refresh the list
      await fetchStaffMembers();
    } catch (err) {
      console.error('Failed to save staff member:', err);
      if (err instanceof Error && err.message.includes('permission')) {
        throw new Error('Permission denied. Admin role required.');
      }
      throw new Error('Failed to save staff member');
    }
  };

  /**
   * Update a staff member
   */
  const updateStaffMember = async (uid: string, updates: UpdateStaffInput): Promise<void> => {
    if (!user?.uid) {
      throw new Error('User must be authenticated');
    }

    try {
      const docRef = doc(db, 'teachers', uid);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date(),
      });
      
      await fetchStaffMembers();
    } catch (err) {
      console.error('Failed to update staff member:', err);
      throw new Error('Failed to update staff member');
    }
  };

  /**
   * Delete a staff member
   */
  const deleteStaffMember = async (uid: string): Promise<void> => {
    if (!user?.uid) {
      throw new Error('User must be authenticated');
    }

    try {
      await deleteDoc(doc(db, 'teachers', uid));
      await fetchStaffMembers();
    } catch (err) {
      console.error('Failed to delete staff member:', err);
      throw new Error('Failed to delete staff member');
    }
  };

  /**
   * Clear search results
   */
  const clearSearch = () => {
    setSearchResults([]);
  };

  return {
    staffMembers,
    searchResults,
    loading,
    searchLoading,
    error,
    fetchStaffMembers,
    searchStaffByEmail,
    getStaffByUid,
    saveStaffMember,
    updateStaffMember,
    deleteStaffMember,
    clearSearch,
  };
}
