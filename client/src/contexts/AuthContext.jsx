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
  const [user, setUser]             = useState(() => getCachedUser());
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [resilientMode, setResilientMode] = useState(false);

  // Listen for session expiry events from the API client
  useEffect(() => {
    const handleSessionExpired = () => {
      console.warn('[AuthContext] Session expired event received. Clearing user session.');
      setUser(null);
      clearUserCache();
      setResilientMode(false);
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  // Listen for storage changes (cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'scholrmind_token' || e.key === CACHE_KEY || e.key === 'role' || e.key === 'isAuthenticated') {
        const token = localStorage.getItem('scholrmind_token');
        const cachedUser = getCachedUser();
        
        console.log('[AuthContext] Storage event detected. Syncing auth state.');
        if (!token || !cachedUser) {
          console.warn('[AuthContext] Token or user cache cleared in another tab. Logging out.');
          setUser(null);
          setResilientMode(false);
        } else {
          console.log('[AuthContext] Active session detected in another tab. Syncing user.');
          setUser(cachedUser);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Listen for browser online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      console.log('[AuthContext] Browser back online. Re-validating session...');
      try {
        const res = await authApi.getMe();
        if (res.user) {
          console.log('[AuthContext] Connection re-established. Syncing user.');
          cacheUser(res.user);
          setUser(res.user);
          setResilientMode(false);
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          console.warn('[AuthContext] Re-validation returned auth error. Logging out.');
          clearUserCache();
          setUser(null);
          setResilientMode(false);
        } else {
          console.warn('[AuthContext] Re-validation failed due to server error. Remaining in resilient mode.');
        }
      }
    };

    const handleOffline = () => {
      console.log('[AuthContext] Browser went offline. Activating Resilient Mode.');
      setResilientMode(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine === false) {
      setResilientMode(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodic recovery check when in resilient mode and online
  useEffect(() => {
    if (!resilientMode) return;

    const interval = setInterval(async () => {
      if (navigator.onLine === false) return;

      console.log('[AuthContext] Periodic check: attempting to re-establish connection to backend...');
      try {
        const res = await authApi.getMe();
        if (res.user) {
          console.log('[AuthContext] Connection restored. Exiting resilient mode.');
          cacheUser(res.user);
          setUser(res.user);
          setResilientMode(false);
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          console.warn('[AuthContext] Periodic check returned auth error. Logging out.');
          clearUserCache();
          setUser(null);
          setResilientMode(false);
        } else {
          console.log('[AuthContext] Periodic check failed due to network/server. Remaining in resilient mode.');
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [resilientMode]);

  // Initial auth check on mount
  useEffect(() => {
    const fetchMeWithRetry = async () => {
      const maxRetries = 3;
      const backoffs = [1000, 2000, 4000];
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const timestamp = new Date().toISOString();
        try {
          console.log(`[AuthContext] getMe attempt ${attempt + 1} at ${timestamp}`);
          return await authApi.getMe();
        } catch (err) {
          const status = err.status;
          const isAuthError = status === 401 || status === 403;
          
          if (isAuthError) {
            console.warn(`[AuthContext] getMe attempt ${attempt + 1} failed with Auth Error ${status} at ${timestamp}. Aborting retries.`);
            throw err;
          }
          
          if (attempt === maxRetries) {
            console.error(`[AuthContext] getMe attempt ${attempt + 1} failed at ${timestamp}. Out of retries.`);
            throw err;
          }
          
          const delay = backoffs[attempt] || 4000;
          console.warn(`[AuthContext] getMe attempt ${attempt + 1} failed at ${timestamp}. Retrying in ${delay}ms...`, err);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };

    const initAuth = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetchMeWithRetry();
        if (res.user) {
          cacheUser(res.user);
          setUser(res.user);
          setResilientMode(false);
        }
      } catch (err) {
        const status = err.status;
        const isAuthError = status === 401 || status === 403;

        if (isAuthError) {
          console.warn('[AuthContext] Initial check failed (Authentication invalid): clearing auth cache', err);
          clearUserCache();
          setUser(null);
          setResilientMode(false);
        } else {
          console.warn('[AuthContext] Initial check failed due to infrastructure issue. Entering resilient mode with cached user.', err);
          setResilientMode(true);
          const cached = getCachedUser();
          if (cached) {
            setUser(cached);
          } else {
            setUser(null);
          }
        }
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
      const payload = { email, password, ...userData };
      const result = await authApi.register(payload);
      const loggedInUser = { ...result.user };
      cacheUser(loggedInUser);
      setUser(loggedInUser);
      setResilientMode(false);
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
      setResilientMode(false);
      return loggedInUser;
    } catch (err) {
      const message = err.message || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  };

  // ─── Logout ──────────────────────────────────────────────────────────────────
  const logout = () => {
    console.log('[AuthContext] Explicit logout triggered.');
    setError(null);
    authApi.logout();
    clearUserCache();
    setUser(null);
    setResilientMode(false);
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    resilientMode,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {resilientMode && (
        <>
          <style>{`
            @keyframes resilientPulse {
              0% { opacity: 0.4; }
              50% { opacity: 1; }
              100% { opacity: 0.4; }
            }
            @keyframes resilientSlideUp {
              from { transform: translate(-50%, 20px); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
          `}</style>
          <div
            id="resilient-mode-banner"
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(12px)',
              color: '#f8fafc',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
              padding: '12px 24px',
              borderRadius: '9999px',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '14px',
              fontWeight: '500',
              fontFamily: 'Inter, system-ui, sans-serif',
              animation: 'resilientSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              boxShadow: '0 0 10px #ef4444',
              animation: 'resilientPulse 2s infinite ease-in-out'
            }} />
            <span>Connection temporarily unavailable. Working with cached data.</span>
          </div>
        </>
      )}
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
