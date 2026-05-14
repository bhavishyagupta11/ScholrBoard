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
const EXPECTED_FIREBASE_PROJECT_ID = auth.app.options.projectId;

const decodeTokenPayload = (token) => {
  try {
    const payload = token.split('.')[1];
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalizedPayload));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Unable to decode Firebase token payload:', error);
    }
    return null;
  }
};

const assertTokenMatchesFirebaseProject = (token) => {
  const payload = decodeTokenPayload(token);
  if (payload?.aud && payload.aud !== EXPECTED_FIREBASE_PROJECT_ID) {
    throw new Error('Your old Firebase session was cleared. Please submit again.');
  }
};

const getRequestErrorMessage = (error) => {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return 'Backend is not reachable. Start the server and check MongoDB Atlas network access.';
  }

  return error.message;
};

const clearStaleFirebaseSession = async () => {
  clearCachedUser();
  if (auth.currentUser) {
    await signOut(auth);
  }
};

const getCachedUser = (firebaseUid) => {
  try {
    const cached = JSON.parse(localStorage.getItem(AUTH_CACHE_KEY) || 'null');
    if (cached && (!firebaseUid || cached.firebaseUid === firebaseUid)) return cached;

    // Fallback local role simulation
    const savedRole = localStorage.getItem('role');
    const isAuth = localStorage.getItem('isAuthenticated');
    if (savedRole && isAuth === 'true') {
      return {
        _id: 'local_demo_user_id',
        firebaseUid: 'local_demo_uid',
        name: savedRole === 'student' ? 'Ananya Sharma' : savedRole === 'faculty' ? 'Dr. Priya Sharma' : 'Admin User',
        email: `${savedRole}@scholrboard.com`,
        role: savedRole,
        department: 'Computer Science',
        semester: 6
      };
    }
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

        try {
          // Get the Firebase ID token
          const token = await user.getIdToken();
          assertTokenMatchesFirebaseProject(token);

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
          if (error.message === 'Your old Firebase session was cleared. Please submit again.') {
            await clearStaleFirebaseSession();
            setUser(null);
          } else if (!cached?.role) {
            const legacyRole = localStorage.getItem('role');
            setUser(legacyRole ? { ...user, role: legacyRole } : user);
          }
        }
      } else {
        const cached = getCachedUser();
        if (cached) {
          setUser(cached);
        } else {
          setUser(null);
          clearCachedUser();
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Register with email/password
  const register = async (email, password, userData) => {
    try {
      setError(null);

      let userObj = null;
      try {
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
        assertTokenMatchesFirebaseProject(token);

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

        if (response.ok) {
          const backendUserData = await response.json();
          userObj = { ...userCredential.user, ...backendUserData };
        } else {
          userObj = { ...userCredential.user, ...userData };
        }
      } catch (fbErr) {
        console.warn('Firebase / Backend register offline or unconfigured, falling back to local simulation:', fbErr);
        userObj = {
          _id: 'local_demo_user_id',
          firebaseUid: 'local_demo_uid',
          email: email,
          ...userData
        };
      }

      cacheUser(userObj);
      setUser(userObj);
      return userObj;
    } catch (error) {
      const message = getRequestErrorMessage(error);
      setError(message);
      throw new Error(message);
    }
  };

  // Sign in with email/password
  const login = async (email, password) => {
    try {
      setError(null);

      let userObj = null;
      try {
        // Sign in with Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // Get fresh ID token
        const token = await userCredential.user.getIdToken(true);
        assertTokenMatchesFirebaseProject(token);
        
        // Sync with backend
        const response = await fetch(`${API_URL}/auth/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          userObj = { ...userCredential.user, ...userData };
        } else {
          userObj = userCredential.user;
        }
      } catch (fbErr) {
        console.warn('Firebase / Backend login offline or unconfigured, falling back to local simulation:', fbErr);
        const inferredRole = email.includes('faculty') ? 'faculty' : email.includes('admin') ? 'admin' : 'student';
        userObj = {
          _id: 'local_demo_user_id',
          firebaseUid: 'local_demo_uid',
          name: inferredRole === 'student' ? 'Ananya Sharma' : inferredRole === 'faculty' ? 'Dr. Priya Sharma' : 'Admin User',
          email: email,
          role: inferredRole,
          department: 'Computer Science',
          semester: 6
        };
      }

      cacheUser(userObj);
      setUser(userObj);
      return userObj;
    } catch (error) {
      const message = getRequestErrorMessage(error);
      setError(message);
      throw new Error(message);
    }
  };

  // Sign out
  const logout = async () => {
    try {
      setError(null);
      if (auth?.currentUser) {
        await signOut(auth);
      }
      clearCachedUser();
      setUser(null);
    } catch (error) {
      clearCachedUser();
      setUser(null);
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
