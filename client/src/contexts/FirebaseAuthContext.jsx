import { useState, useEffect, createContext, useContext } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { auth } from '../config/firebase';

const FirebaseAuthContext = createContext();

export function FirebaseAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get the Firebase ID token
        const token = await user.getIdToken();
        
        try {
          // Sync with your backend
          const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser({ ...user, ...userData }); // Combine Firebase and MongoDB user data
          } else {
            console.error('Failed to sync user data with backend');
          }
        } catch (error) {
          console.error('Error syncing user data:', error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Register with email/password
  const register = async (email, password, userData) => {
    try {
      setError(null);
      console.log('Starting registration process...', { email, userData });
      
      // Create user in Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Firebase user created:', userCredential.user.uid);
      
      // Update Firebase profile
      await updateProfile(userCredential.user, {
        displayName: userData.name
      });
      console.log('Firebase profile updated');

      // Send email verification
      await sendEmailVerification(userCredential.user);
      console.log('Verification email sent');

      // Get fresh token
      const token = await userCredential.user.getIdToken(true);
      console.log('Got fresh token');

      // Create user in your backend
      const requestBody = {
        ...userData,
        firebaseUid: userCredential.user.uid,
        email: userCredential.user.email
      };
      console.log('Sending backend request:', requestBody);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Backend registration failed:', errorData);
        throw new Error(errorData.message || 'Failed to create user in backend');
      }

      return userCredential.user;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Sign in with email/password
  const login = async (email, password) => {
    try {
      setError(null);
      console.log('Starting login process...', { email });
      
      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Firebase login successful:', userCredential.user.uid);

      // Get fresh ID token
      const token = await userCredential.user.getIdToken(true);
      
      // Sync with backend
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('Failed to sync with backend during login');
        throw new Error('Failed to sync user data');
      }

      const userData = await response.json();
      console.log('Backend sync successful:', userData);
      
      // Update local user state with combined data
      setUser({
        ...userCredential.user,
        ...userData
      });

      return userCredential.user;
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message);
      throw error;
    }
  };

  // Sign out
  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {!loading && children}
    </FirebaseAuthContext.Provider>
  );
}

// Custom hook to use Firebase Auth
export function useFirebaseAuth() {
  const context = useContext(FirebaseAuthContext);
  if (context === undefined) {
    throw new Error('useFirebaseAuth must be used within a FirebaseAuthProvider');
  }
  return context;
}