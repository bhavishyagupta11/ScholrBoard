/**
 * CodingPage.jsx — Dynamic coding profile visualization
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
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
      action: null, 
      color: '#22c55e' 
    },
    {
      name: 'GeeksforGeeks',
      key: 'geeksforgeeks',
      solved: profile.codingStats?.geeksforgeeksScore || 0,
      rating: 0,
      action: null,
      color: '#14b8a6'
    },
    { 
      name: 'CodeChef', 
      key: 'codechef',
      solved: 0,
      rating: 0,
      action: null,
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
    const inputVal = (handles[platform.key] || '').trim();
    const savedVal = (savedProfiles[platform.key] || '').trim();
    const username = inputVal || savedVal;
    const isLinked = !!savedVal;

    if (!isLinked && !inputVal) {
      setError(`Enter a ${platform.name} username or profile URL first.`);
      return;
    }

    setSyncing(platform.key);
    setError(null);
    try {
      if (!isLinked || inputVal) {
        await codingApi.linkProfile(platform.key, username);
      }
      
      if (platform.action) {
        await platform.action();
      }
      
      await refreshProfile();
      setHandles((prev) => ({ ...prev, [platform.key]: '' }));
    } catch (err) {
      setError(err.message || `Failed to sync ${platform.name}`);
    } finally {
      setSyncing(null);
    }
  };

  const devScore = profile.developerScore || 0;
  const devTier = devScore >= 75 ? 'Elite Tier' : devScore >= 50 ? 'Advanced Tier' : 'Developing';

  return (
    <div className="space-y-6">
      <h1 ref={headerRef} className="headline gpu-accelerated">Coding Profiles</h1>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Developer Score CTA Banner */}
      <div className="card p-6 relative overflow-hidden bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-lg shadow-blue-950/20">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center justify-center w-20 h-20 rounded-full border-4 border-blue-500/20 bg-blue-950/40 relative shrink-0">
            <span className="text-3xl font-extrabold">{devScore}</span>
            <div className="absolute -bottom-1 bg-blue-500 text-[10px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Score</div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Developer Intelligence Dashboard</h2>
            <p className="text-sm text-slate-350 max-w-xl">
              Track your unified developer metrics, algorithm proficiency, and platform synchronization cooldowns.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-slate-400">Current Standing:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                devScore >= 75 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : devScore >= 50 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {devTier}
              </span>
            </div>
          </div>
        </div>
        <div>
          <Link 
            to="/student/developer" 
            className="btn btn-primary whitespace-nowrap shadow-lg shadow-blue-500/20 flex items-center gap-2 hover:translate-x-0.5 transition-transform"
          >
            View Developer Dashboard
          </Link>
        </div>
      </div>

      <div ref={platformsContainerRef} className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {platforms.map((p, index) => {
          const isStaticLinkOnly = p.key === 'geeksforgeeks' || p.key === 'hackerrank' || p.key === 'codechef';
          const isLinkedIn = p.key === 'linkedin';

          return (
            <div key={p.name} ref={setPlatformRef(index)} className="card p-4 gpu-accelerated flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm subtle">{savedProfiles[p.key] ? `@${savedProfiles[p.key]}` : 'Not connected'}</div>
                  </div>
                  {savedProfiles[p.key] && <LinkIcon size={18} style={{color:p.color}} />}
                </div>

                {isStaticLinkOnly ? (
                  <div className="my-4 space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1.5" style={{ borderColor: 'var(--border-color)' }}>
                      <span className="subtle">Profile Link Status</span>
                      <span className="font-semibold text-emerald-500">{savedProfiles[p.key] ? 'Linked' : 'Not Linked'}</span>
                    </div>
                    {savedProfiles[p.key] && (
                      <div className="flex justify-between border-b pb-1.5" style={{ borderColor: 'var(--border-color)' }}>
                        <span className="subtle">Username / URL</span>
                        <span className="font-semibold truncate max-w-[150px]">{savedProfiles[p.key]}</span>
                      </div>
                    )}
                    <div className="text-[10px] subtle italic" style={{ color: 'var(--text-muted)' }}>
                      Live sync is not currently supported.
                    </div>
                  </div>
                ) : isLinkedIn ? (
                  <div className="my-4 space-y-2 text-xs">
                    <div className="flex justify-between border-b pb-1.5" style={{ borderColor: 'var(--border-color)' }}>
                      <span className="subtle">Profile Status</span>
                      <span className="font-semibold" style={{ color: savedProfiles[p.key] ? 'var(--primary-cyan)' : 'var(--text-muted)' }}>
                        {savedProfiles[p.key] ? 'Connected' : 'Not Connected'}
                      </span>
                    </div>
                    {savedProfiles[p.key] && (
                      <div className="flex justify-between" style={{ borderColor: 'var(--border-color)' }}>
                        <span className="subtle">LinkedIn Username</span>
                        <span className="font-semibold truncate max-w-[150px]">{savedProfiles[p.key]}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 my-4">
                    <div>
                      <div className="text-sm subtle">{p.key === 'github' ? 'Impact' : 'Score'}</div>
                      <div className="text-2xl font-bold text-brand-blue">{p.solved}</div>
                    </div>
                    <div>
                      <div className="text-sm subtle">{p.key === 'github' ? 'Repos' : 'Rating'}</div>
                      <div className="text-2xl font-bold" style={{color:p.color}}>{p.rating || '—'}</div>
                    </div>
                  </div>
                )}
              </div>

              <div>
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
                    title={savedProfiles[p.key] ? `Sync ${p.name}` : `Link ${p.name}`}
                  >
                    <RefreshCw size={18} className={syncing === p.key ? 'animate-spin' : ''} />
                  </button>
                </div>

                {platformDetails[p.key]?.syncedAt && (
                  <div className="text-xs subtle mt-3">
                    {isStaticLinkOnly || isLinkedIn ? 'Linked' : 'Synced'} {new Date(platformDetails[p.key].syncedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div ref={chartRef} className="card p-6 gpu-accelerated hover:scale-[1.01] transition-transform">
        <div className="font-medium mb-4 text-lg">Activity by Platform</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={platforms.filter(p => p.solved > 0)}>
              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} />
              <Tooltip 
                cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-medium)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }} 
              />
              <Legend />
              <Bar dataKey="solved" fill="var(--primary-blue)" radius={[4, 4, 0, 0]} name="Score/Activity" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
