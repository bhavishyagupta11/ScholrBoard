/**
 * CodingPage.jsx — Dynamic coding profile visualization
 */
import { useState } from 'react';
import { RefreshCw, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useProfile } from '../contexts/ProfileContext.jsx';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';
import codingApi from '../api/coding.api.js';

export function CodingPage() {
  const { profile, isLoading, refreshProfile } = useProfile();
  const [handles, setHandles] = useState({});
  const [syncing, setSyncing] = useState(null);
  const [error, setError] = useState(null);

  // Scroll animation hooks
  const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  const chartRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.3 });
  
  // Staggered animations for platform cards
  const { containerRef: platformsContainerRef, setItemRef: setPlatformRef } = useStaggeredAnimation(7, 0.1);

  if (isLoading) {
    return <div className="skeleton h-64 w-full" />;
  }

  if (!profile) return null;

  const savedProfiles = profile.codingStats?.profiles || {};
  const platformDetails = profile.codingStats?.platformDetails || {};

  const platforms = [
    { 
      name: 'LeetCode', 
      key: 'leetcode',
      solved: profile.codingStats?.leetcodeProblemsSolved || 0, 
      rating: profile.codingStats?.leetcodeContestRating || 0, 
      action: codingApi.syncLeetcode,
      color: '#58A6FF' 
    },
    {
      name: 'GitHub',
      key: 'github',
      solved: profile.codingStats?.githubContributions || 0,
      rating: profile.codingStats?.githubRepos || 0,
      action: codingApi.syncGithub,
      color: '#f97316'
    },
    { 
      name: 'Codeforces', 
      key: 'codeforces',
      solved: profile.codingStats?.codeforcesRating || 0,
      rating: profile.codingStats?.codeforcesRating || 0, 
      action: codingApi.syncCodeforces,
      color: '#7c3aed' 
    },
    { 
      name: 'HackerRank', 
      key: 'hackerrank',
      solved: profile.codingStats?.hackerrankBadges || 0,
      rating: 0, 
      action: (username) => codingApi.linkProfile('hackerrank', username),
      color: '#22c55e' 
    },
    {
      name: 'GeeksforGeeks',
      key: 'geeksforgeeks',
      solved: profile.codingStats?.geeksforgeeksScore || 0,
      rating: 0,
      action: (username) => codingApi.linkProfile('geeksforgeeks', username),
      color: '#14b8a6'
    },
    {
      name: 'CodeChef',
      key: 'codechef',
      solved: profile.codingStats?.codechefRating || 0,
      rating: profile.codingStats?.codechefRating || 0,
      action: (username) => codingApi.linkProfile('codechef', username),
      color: '#a16207'
    },
    {
      name: 'LinkedIn',
      key: 'linkedin',
      solved: profile.codingStats?.linkedInConnected ? 1 : 0,
      rating: 0,
      action: (username) => codingApi.linkProfile('linkedin', username),
      color: '#0ea5e9'
    },
  ];

  const syncPlatform = async (platform) => {
    const username = (handles[platform.key] || savedProfiles[platform.key] || '').trim();
    if (!username) {
      setError(`Enter a ${platform.name} username or profile URL first.`);
      return;
    }

    setSyncing(platform.key);
    setError(null);
    try {
      await platform.action(username);
      await refreshProfile();
      setHandles((prev) => ({ ...prev, [platform.key]: '' }));
    } catch (err) {
      setError(err.message || `Failed to sync ${platform.name}`);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 ref={headerRef} className="headline gpu-accelerated">Coding Profiles</h1>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div ref={platformsContainerRef} className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {platforms.map((p, index) => (
          <div key={p.name} ref={setPlatformRef(index)} className="card p-4 gpu-accelerated">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm subtle">{savedProfiles[p.key] ? `@${savedProfiles[p.key]}` : 'Not connected'}</div>
              </div>
              {savedProfiles[p.key] && <LinkIcon size={18} style={{color:p.color}} />}
            </div>

            <div className="grid grid-cols-2 gap-3 my-4">
              <div>
                <div className="text-sm subtle">{p.key === 'github' ? 'Impact' : p.key === 'linkedin' ? 'Linked' : 'Score'}</div>
                <div className="text-2xl font-bold text-brand-blue">{p.solved}</div>
              </div>
              <div>
                <div className="text-sm subtle">{p.key === 'github' ? 'Repos' : 'Rating'}</div>
                <div className="text-2xl font-bold" style={{color:p.color}}>{p.rating || '—'}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                className="input-dark px-3 py-2 w-full"
                placeholder={savedProfiles[p.key] || `${p.name} username`}
                value={handles[p.key] || ''}
                onChange={(e) => setHandles((prev) => ({ ...prev, [p.key]: e.target.value }))}
              />
              <button
                className="btn btn-primary px-3"
                type="button"
                disabled={syncing === p.key}
                onClick={() => syncPlatform(p)}
                title={`Sync ${p.name}`}
              >
                <RefreshCw size={18} className={syncing === p.key ? 'animate-spin' : ''} />
              </button>
            </div>

            {platformDetails[p.key]?.syncedAt && (
              <div className="text-xs subtle mt-3">
                Synced {new Date(platformDetails[p.key].syncedAt).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>

      <div ref={chartRef} className="card p-6 gpu-accelerated hover:scale-[1.01] transition-transform">
        <div className="font-medium mb-4 text-lg">Activity by Platform</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={platforms.filter(p => p.solved > 0)}>
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: 'var(--surface-card)', border: 'none', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="solved" fill="var(--primary-blue)" radius={[4, 4, 0, 0]} name="Score/Activity" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
