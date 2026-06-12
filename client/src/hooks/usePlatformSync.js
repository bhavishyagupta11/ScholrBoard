import { useState, useEffect, useRef } from 'react';
import { useProfile } from '../contexts/ProfileContext.jsx';
import developerSyncApi from '../api/developerSync.api.js';

export function usePlatformSync() {
  const { profile, refreshProfile } = useProfile();
  const [syncing, setSyncing] = useState(null);
  const [error, setError] = useState(null);
  const [cooldowns, setCooldowns] = useState({ github: 0, leetcode: 0, codeforces: 0, all: 0 });

  const intervalRef = useRef(null);

  // Extract raw timestamps to avoid depending on the entire profile object reference
  const githubSyncTime = profile?.codingStats?.githubLastSyncedAt;
  const leetcodeSyncTime = profile?.codingStats?.leetcodeLastSyncedAt;
  const codeforcesSyncTime = profile?.codingStats?.codeforcesLastSyncedAt;
  const allSyncTime = profile?.codingStats?.lastSyncedAt;

  const calculateSeconds = (timeStr) => {
    if (!timeStr) return 0;
    const elapsed = Date.now() - new Date(timeStr).getTime();
    const cooldownMs = 15 * 60 * 1000; // 15 mins
    return elapsed < cooldownMs ? Math.ceil((cooldownMs - elapsed) / 1000) : 0;
  };

  // Recalculate cooldowns when sync timestamps change
  useEffect(() => {
    const initialGithub = calculateSeconds(githubSyncTime);
    const initialLeetcode = calculateSeconds(leetcodeSyncTime);
    const initialCodeforces = calculateSeconds(codeforcesSyncTime);
    const initialAll = calculateSeconds(allSyncTime);

    setCooldowns({
      github: initialGithub,
      leetcode: initialLeetcode,
      codeforces: initialCodeforces,
      all: initialAll
    });
  }, [githubSyncTime, leetcodeSyncTime, codeforcesSyncTime, allSyncTime]);

  // Handle countdown ticking
  useEffect(() => {
    const hasActiveCooldown = cooldowns.github > 0 || cooldowns.leetcode > 0 || cooldowns.codeforces > 0 || cooldowns.all > 0;

    if (hasActiveCooldown) {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          setCooldowns(prev => {
            const next = {
              github: Math.max(0, prev.github - 1),
              leetcode: Math.max(0, prev.leetcode - 1),
              codeforces: Math.max(0, prev.codeforces - 1),
              all: Math.max(0, prev.all - 1)
            };

            const stillActive = next.github > 0 || next.leetcode > 0 || next.codeforces > 0 || next.all > 0;
            if (!stillActive && intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return next;
          });
        }, 1000);
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      // Clean up on unmount or when cooldown existence flips
    };
  }, [cooldowns.github > 0, cooldowns.leetcode > 0, cooldowns.codeforces > 0, cooldowns.all > 0]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleSync = async (platformKey, apiCall) => {
    if (syncing) return;
    setSyncing(platformKey);
    setError(null);
    try {
      const res = await apiCall();
      if (res.cooldown) {
        // Intercept cooldown payload (HTTP 200)
        const match = res.message?.match(/in (\d+) seconds/);
        const secs = match ? parseInt(match[1], 10) : 900;
        setCooldowns(prev => ({ ...prev, [platformKey]: secs }));
      }
      await refreshProfile();
    } catch (err) {
      if (err.status === 409) {
        setError('Sync operation is already in progress. Please wait a few minutes.');
      } else if (err.status === 429) {
        setError('Sync temporarily disabled due to repeated failures.');
      } else {
        setError(err.message || 'Sync failed');
      }
    } finally {
      setSyncing(null);
    }
  };

  return {
    syncGithub: () => handleSync('github', developerSyncApi.syncGithub),
    syncLeetcode: () => handleSync('leetcode', developerSyncApi.syncLeetcode),
    syncCodeforces: () => handleSync('codeforces', developerSyncApi.syncCodeforces),
    syncAll: () => handleSync('all', developerSyncApi.syncAll),
    cooldowns,
    syncing,
    error,
    setError
  };
}
