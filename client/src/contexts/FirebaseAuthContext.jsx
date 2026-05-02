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
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const AUTH_CACHE_KEY = 'scholrboardUser';

const getCachedUser = (firebaseUid) => {
  try {
    const cached = JSON.parse(localStorage.getItem(AUTH_CACHE_KEY) || 'null');
    if (cached && (!firebaseUid || cached.firebaseUid === firebaseUid)) return cached;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Unable to read cached auth user:', error);
    }
  }
  return null;
};

const cacheUser = (userData) => {
  if (!userData) return;
  const data = {
    _id: userData._id,
    firebaseUid: userData.firebaseUid || userData.uid,
    name: userData.name || userData.displayName,
    email: userData.email,
    role: userData.role,
    studentId: userData.studentId,
    facultyId: userData.facultyId,
    department: userData.department,
    semester: userData.semester
  };
  localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(data));
  if (data.role) {
    localStorage.setItem('role', data.role);
    localStorage.setItem('isAuthenticated', 'true');
  }
};

const clearCachedUser = () => {
  localStorage.removeItem(AUTH_CACHE_KEY);
  localStorage.removeItem('role');
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('studentProfile');
};

export function FirebaseAuthProvider({ children }) {
  const [user, setUser] = useState(() => getCachedUser());
  const [loading, setLoading] = useState(() => !getCachedUser());
  const [error, setError] = useState(null);

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const cached = getCachedUser(user.uid);
        if (cached?.role) {
          setUser({ ...user, ...cached });
          setLoading(false);
        }

        // Get the Firebase ID token
        const token = await user.getIdToken();
        
        try {
          // Sync with your backend
          const response = await fetch(`${API_URL}/auth/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            const combinedUser = { ...user, ...userData };
            cacheUser(combinedUser);
            setUser(combinedUser); // Combine Firebase and MongoDB user data
          } else {
            if (!cached?.role) {
              const legacyRole = localStorage.getItem('role');
              setUser(legacyRole ? { ...user, role: legacyRole } : user);
            }
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('Error syncing user data:', error);
          }
          if (!cached?.role) {
            const legacyRole = localStorage.getItem('role');
            setUser(legacyRole ? { ...user, role: legacyRole } : user);
          }
        }
      } else {
        setUser(null);
        clearCachedUser();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Register with email/password
  const register = async (email, password, userData) => {
    try {
      setError(null);

      // Create user in Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Update Firebase profile
      await updateProfile(userCredential.user, {
        displayName: userData.name
      });

      // Send email verification
      await sendEmailVerification(userCredential.user);

      // Get fresh token
      const token = await userCredential.user.getIdToken(true);

      // Create user in your backend
      const requestBody = {
        ...userData,
        firebaseUid: userCredential.user.uid,
        email: userCredential.user.email
      };

      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user in backend');
      }

      const backendUserData = await response.json();
      const combinedUser = { ...userCredential.user, ...backendUserData };
      cacheUser(combinedUser);
      setUser(combinedUser);
      return combinedUser;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Sign in with email/password
  const login = async (email, password) => {
    try {
      setError(null);

      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Get fresh ID token
      const token = await userCredential.user.getIdToken(true);
      
      // Sync with backend
      const response = await fetch(`${API_URL}/auth/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to sync user data');
      }

      const userData = await response.json();

      // Update local user state with combined data
      const combinedUser = {
        ...userCredential.user,
        ...userData
      };
      cacheUser(combinedUser);
      setUser(combinedUser);

      return combinedUser;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Sign out
  const logout = async () => {
    try {
      setError(null);
      await signOut(auth);
      clearCachedUser();
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
      {children}
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
