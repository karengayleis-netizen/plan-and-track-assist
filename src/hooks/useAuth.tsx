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
    const roleDoc = await getDoc(doc(db, 'user_roles', uid));
    if (roleDoc.exists()) {
      const role = roleDoc.data()?.role;
      if (role === 'admin' || role === 'teacher') {
        return role;
      }
    }
    // Default to 'teacher' if no role document exists
    return 'teacher';
  } catch {
    // If Firestore query fails (e.g., no permissions), default to 'teacher'
    return 'teacher';
  }
}

// Fetch user's school ID from Firestore users collection
async function fetchUserSchoolId(uid: string): Promise<string | undefined> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data()?.schoolId;
    }
    return undefined;
  } catch {
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
