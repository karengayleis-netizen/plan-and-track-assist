import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fetch user role from Firestore user_roles collection (separate from user profile for security)
async function fetchUserRole(uid: string): Promise<'teacher' | 'admin'> {
  try {
    console.log('[Auth Debug] Fetching role for UID:', uid);
    const roleDocRef = doc(db, 'user_roles', uid);
    const roleDoc = await getDoc(roleDocRef);
    
    console.log('[Auth Debug] Role doc path:', `user_roles/${uid}`);
    console.log('[Auth Debug] Role doc exists:', roleDoc.exists());
    
    if (roleDoc.exists()) {
      const data = roleDoc.data();
      console.log('[Auth Debug] Role document data:', data);
      const role = data?.role;
      console.log('[Auth Debug] Raw role value:', role, 'type:', typeof role);
      if (role === 'admin' || role === 'teacher') {
        console.log('[Auth Debug] Returning role:', role);
        return role;
      }
    }
    console.log('[Auth Debug] No valid role found, defaulting to teacher');
    return 'teacher';
  } catch (error) {
    console.error('[Auth Debug] Error fetching role:', error);
    return 'teacher';
  }
}

// Fetch user's school ID from Firestore users collection
async function fetchUserSchoolId(uid: string): Promise<string | undefined> {
  try {
    console.log('[Auth Debug] Fetching schoolId for UID:', uid);
    const userDoc = await getDoc(doc(db, 'users', uid));
    console.log('[Auth Debug] User doc exists:', userDoc.exists());
    
    if (userDoc.exists()) {
      const schoolId = userDoc.data()?.schoolId;
      console.log('[Auth Debug] SchoolId found:', schoolId);
      return schoolId;
    }
    return undefined;
  } catch (error) {
    console.error('[Auth Debug] Error fetching schoolId:', error);
    return undefined;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Set basic user info immediately
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || undefined,
          role: 'teacher', // Default, will be updated
        });
        
        // Fetch role and school from Firestore asynchronously using setTimeout to avoid deadlock
        setTimeout(async () => {
          const [role, schoolId] = await Promise.all([
            fetchUserRole(firebaseUser.uid),
            fetchUserSchoolId(firebaseUser.uid)
          ]);
          
          console.log('[Auth Debug] Final user state:', { uid: firebaseUser.uid, role, schoolId });
          
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || undefined,
            role,
            schoolId,
          });
          setLoading(false);
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
