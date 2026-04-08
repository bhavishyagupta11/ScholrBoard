import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA6aPPV8GyUFS_uQQ9VxywkhjNhUPzDAlE",
  authDomain: "codevengers-4c036.firebaseapp.com",
  projectId: "codevengers-4c036",
  storageBucket: "codevengers-4c036.firebasestorage.app",
  messagingSenderId: "698897660521",
  appId: "1:698897660521:web:e6fa9e8734bf9e60fd40f8",
  measurementId: "G-77153Y5KZ4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get Auth instance
export const auth = getAuth(app);

export default app;
