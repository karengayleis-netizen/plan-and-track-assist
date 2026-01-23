import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Firebase configuration using environment variables
// These are publishable client-side keys, safe for Vite's VITE_ prefix
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCwYVT2UFqAfXw40wXEhzGG3s1Xr_RPVpY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "school-data-intervention-tool.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "school-data-intervention-tool",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "school-data-intervention-tool.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "923408519266",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:923408519266:web:88289c592655602596413b",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-WVHPNM1NEM"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app;
