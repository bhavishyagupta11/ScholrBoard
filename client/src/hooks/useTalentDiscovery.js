import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import talentDiscoveryApi from '../api/talentDiscovery.api.js';

export function useTalentDiscovery() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeRequestRef = useRef(null);

  // Extract all 13 filters + sort + pagination from searchParams
  const getFiltersFromParams = () => {
    return {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      sortBy: searchParams.get('sortBy') || 'developerScore',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      search: searchParams.get('search') || '',
      department: searchParams.get('department') || '',
      branch: searchParams.get('branch') || '',
      year: searchParams.get('year') || '',
      semester: searchParams.get('semester') || '',
      gpaMin: searchParams.get('gpaMin') || '',
      gpaMax: searchParams.get('gpaMax') || '',
      backlogsMax: searchParams.get('backlogsMax') || '',
      developerScoreMin: searchParams.get('developerScoreMin') || '',
      developerScoreMax: searchParams.get('developerScoreMax') || '',
      githubScoreMin: searchParams.get('githubScoreMin') || '',
      dsaScoreMin: searchParams.get('dsaScoreMin') || '',
      cpScoreMin: searchParams.get('cpScoreMin') || '',
      skills: searchParams.get('skills') || '',
      githubConnected: searchParams.get('githubConnected') || '',
      leetcodeConnected: searchParams.get('leetcodeConnected') || '',
      codeforcesConnected: searchParams.get('codeforcesConnected') || '',
      placementReadinessMin: searchParams.get('placementReadinessMin') || '',
      achievementPointsMin: searchParams.get('achievementPointsMin') || '',
      hasResumeAnalysis: searchParams.get('hasResumeAnalysis') || '',
      atsScoreMin: searchParams.get('atsScoreMin') || ''
    };
  };

  const filters = getFiltersFromParams();

  useEffect(() => {
    const controller = new AbortController();
    const requestId = Math.random().toString(36).substring(7);
    activeRequestRef.current = requestId;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await talentDiscoveryApi.getTalentDiscovery(filters, { signal: controller.signal });
        
        // Only update state if this is the newest request (cancellation protection)
        if (activeRequestRef.current === requestId) {
          setResults(res.data || []);
          setPagination(res.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
        }
      } catch (err) {
        if (err.name === 'AbortError' || (err.message && err.message.includes('aborted'))) {
          // Ignore aborted requests
          return;
        }
        if (activeRequestRef.current === requestId) {
          setError(err.message || 'Failed to fetch search results');
        }
      } finally {
        if (activeRequestRef.current === requestId) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [searchParams.toString()]); // Re-fetch whenever URL query parameters change

  const updateFilters = (newFilters) => {
    const updated = new URLSearchParams(searchParams);
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        updated.set(key, String(value));
      } else {
        updated.delete(key);
      }
    });
    // Reset page to 1 on filter mutation unless page index is explicitly supplied
    if (!newFilters.hasOwnProperty('page')) {
      updated.set('page', '1');
    }
    setSearchParams(updated);
  };

  const resetFilters = () => {
    setSearchParams(new URLSearchParams({
      page: '1',
      limit: '20',
      sortBy: 'developerScore',
      sortOrder: 'desc'
    }));
  };

  return {
    filters,
    results,
    pagination,
    loading,
    error,
    updateFilters,
    resetFilters
  };
}
