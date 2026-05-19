/**
 * ProfileContext.jsx — Production profile context
 *
 * Replaces the old localStorage-only approach with real API calls.
 *
 * What changed:
 *   - defaultProfile with hardcoded "Ananya Sharma" data → REMOVED
 *   - localStorage.setItem('studentProfile') → REMOVED
 *   - Profile data now fetched from GET /api/profile/me
 *   - Updates go to PUT /api/profile/me (persisted in MongoDB)
 *   - User's real name/email/role from AuthContext
 *
 * Data flow:
 *   User logs in → AuthProvider sets user →
 *   ProfileProvider fetches profile from API →
 *   All pages read from this context (real data, not mock)
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import profileApi from '../api/profile.api.js';

const ProfileContext = createContext(undefined);

export function ProfileProvider({ children }) {
  const { user } = useAuth();
  const [profile, setProfile]     = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  // Fetch profile whenever the authenticated user changes
  const fetchProfile = useCallback(async () => {
    if (!user?._id) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await profileApi.getMyProfile();
      // Merge profile document with user document fields
      setProfile({
        ...result.profile,
        // User-level fields (for convenience access throughout the app)
        name:       result.profile.userId?.name       || user.name,
        email:      result.profile.userId?.email      || user.email,
        role:       result.profile.userId?.role       || user.role,
        avatar:     result.profile.userId?.avatar     || user.avatar || null,
        department: result.profile.userId?.department || user.department,
        semester:   result.profile.userId?.semester   || user.semester,
        studentId:  result.profile.userId?.studentId  || user.studentId,
        facultyId:  result.profile.userId?.facultyId  || user.facultyId,
        verified:   result.profile.userId?.verified   || user.verified,
      });
    } catch (err) {
      setError(err.message);
      // Fallback: show minimal profile from auth user data
      if (user) {
        setProfile({
          name:       user.name,
          email:      user.email,
          role:       user.role,
          avatar:     user.avatar || null,
          department: user.department,
          semester:   user.semester,
          studentId:  user.studentId,
          facultyId:  user.facultyId,
          verified:   user.verified,
          skills:     [],
          interests:  [],
          bio:        '',
          gpa:        null,
          codingStats: {},
          projects:    [],
          education:   [],
          certifications: [],
          socialLinks: {},
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  /**
   * Update profile fields — calls API and updates local state.
   * @param {object} updates - fields to update
   */
  const updateProfile = async (updates) => {
    setError(null);
    try {
      const result = await profileApi.updateMyProfile(updates);
      setProfile((prev) => ({
        ...prev,
        ...result.profile,
        // Re-merge user-level fields
        name:       result.profile.userId?.name       || prev.name,
        email:      result.profile.userId?.email      || prev.email,
        role:       result.profile.userId?.role       || prev.role,
        avatar:     result.profile.userId?.avatar     || prev.avatar,
        department: result.profile.userId?.department || prev.department,
      }));
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Update basic user info (name, avatar) — separate API call.
   */
  const updateBasicInfo = async (updates) => {
    setError(null);
    try {
      const result = await profileApi.updateBasicInfo(updates);
      setProfile((prev) => ({
        ...prev,
        name:   result.user.name   || prev.name,
        avatar: result.user.avatar || prev.avatar,
      }));
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Refresh profile from API.
   */
  const refreshProfile = () => fetchProfile();

  const value = {
    profile,
    isLoading,
    error,
    updateProfile,
    updateBasicInfo,
    refreshProfile,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
