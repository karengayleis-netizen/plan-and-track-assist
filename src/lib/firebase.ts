import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCwYVT2UFqAfXw40wXEhzGG3s1Xr_RPVpY",
  authDomain: "school-data-intervention-tool.firebaseapp.com",
  projectId: "school-data-intervention-tool",
  storageBucket: "school-data-intervention-tool.firebasestorage.app",
  messagingSenderId: "923408519266",
  appId: "1:923408519266:web:88289c592655602596413b",
  measurementId: "G-WVHPNM1NEM"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app;
