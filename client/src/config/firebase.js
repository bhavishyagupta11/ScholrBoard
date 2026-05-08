import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAlu7UoeJ8FBd84sDRfFhCt4iv223i9ah8",
  authDomain: "scholrboard.firebaseapp.com",
  projectId: "scholrboard",
  storageBucket: "scholrboard.firebasestorage.app",
  messagingSenderId: "785005963380",
  appId: "1:785005963380:web:6d4d9785f3a2ab2f820921"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Auth instance
export const auth = getAuth(app);

export default app;
