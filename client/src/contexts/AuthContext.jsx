/**
 * AuthContext.jsx — Native JWT Auth Context
 *
 * One-token flow:
 *   1. Client sends email/password to /api/auth/login or /api/auth/register
 *   2. Backend verifies credentials and returns a server JWT
 *   3. JWT is stored in localStorage
 *   4. All API calls use this JWT (handled by api/index.js interceptors)
 */
import { useState, useEffect, createContext, useContext } from 'react';
import authApi from '../api/auth.api.js';
import { clearToken, getToken } from '../api/index.js';

const AuthContext = createContext(undefined);

// ─── Local cache helpers ───────────────────────────────────────────────────────
const CACHE_KEY = 'scholrboardUser';

const getCachedUser = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  } catch {
    return null;
  }
};

const cacheUser = (userData) => {
  if (!userData) return;
  const data = {
    _id:         userData._id,
    name:        userData.name,
    email:       userData.email,
    role:        userData.role,
    avatar:      userData.avatar || null,
    studentId:   userData.studentId || null,
    facultyId:   userData.facultyId || null,
    department:  userData.department || null,
    semester:    userData.semester   || null,
    verified:    userData.verified   || false,
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  if (data.role) {
    localStorage.setItem('role', data.role);
    localStorage.setItem('isAuthenticated', 'true');
  }
};

const clearUserCache = () => {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem('role');
  localStorage.removeItem('isAuthenticated');
  clearToken();
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => getCachedUser());
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Listen for session expiry events from the API client
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      clearUserCache();
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  // Initial auth state check on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Validate token with backend and get fresh user data
        const res = await authApi.getMe();
        if (res.user) {
          cacheUser(res.user);
          setUser(res.user);
        }
      } catch (err) {
        console.warn('Session check failed, clearing auth cache', err);
        clearUserCache();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // ─── Register ───────────────────────────────────────────────────────────────
  const register = async (email, password, userData) => {
    setError(null);
    try {
      const payload = {
        email,
        password,
        ...userData
      };
      
      const result = await authApi.register(payload);
      
      const loggedInUser = { ...result.user };
      cacheUser(loggedInUser);
      setUser(loggedInUser);
      
      return loggedInUser;
    } catch (err) {
      const message = err.message || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  };

  // ─── Login ───────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    setError(null);
    try {
      const result = await authApi.login({ email, password });
      
      const loggedInUser = { ...result.user };
      cacheUser(loggedInUser);
      setUser(loggedInUser);
      
      return loggedInUser;
    } catch (err) {
      const message = err.message || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  // ─── Logout ──────────────────────────────────────────────────────────────────
  const logout = () => {
    setError(null);
    authApi.logout();
    clearUserCache();
    setUser(null);
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
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
