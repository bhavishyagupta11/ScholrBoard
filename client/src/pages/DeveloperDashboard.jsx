import React, { useMemo, useState, useEffect } from 'react';
import { useProfile } from '../contexts/ProfileContext.jsx';
import { usePlatformSync } from '../hooks/usePlatformSync.js';
import { DeveloperScoreRing } from '../components/developer/DeveloperScoreRing.jsx';
import { ScoreBreakdownBar } from '../components/developer/ScoreBreakdownBar.jsx';
import { SyncButton } from '../components/developer/SyncButton.jsx';
import { 
  Github, 
  Award, 
  Code2, 
  Activity, 
  AlertTriangle, 
  TrendingUp, 
  UserCheck, 
  HelpCircle,
  ExternalLink,
  Flame,
  Globe,
  Star,
  GitFork,
  BookOpen
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

// ─── StatCard Pattern Reused from DashboardPage ──────────────────────────────────────────
function StatCard({ label, value, sub, color, loading }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (loading || value == null) return;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) {
      setCount(value);
      return;
    }
    const duration = 700;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setCount(Number((numVal * p).toFixed(1)));
      if (p < 1) requestAnimationFrame(step);
    };
    const frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value, loading]);

  return (
    <div className="card p-4 gpu-accelerated hover:scale-105 transition-transform flex flex-col justify-between min-h-[110px]">
      <div>
        <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </div>
        <div className="text-3xl font-extrabold mt-1" style={{ color: color || 'var(--text-primary)' }}>
          {loading ? '...' : (typeof value === 'string' && isNaN(parseFloat(value)) ? value : count)}
        </div>
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
        {sub}
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────────
export function DeveloperDashboard() {
  const { profile, isLoading, error: profileError } = useProfile();
  const {
    syncGithub,
    syncLeetcode,
    syncCodeforces,
    syncAll,
    cooldowns,
    syncing,
    error: syncError,
    setError: setSyncError
  } = usePlatformSync();

  // Faculty redaction check
  const isFaculty = profile?.role === 'faculty';
  const hasNoScores = profile && profile.developerScore === undefined;

  // Resolve platform user names
  const githubUser = profile?.codingStats?.profiles?.github || profile?.socialLinks?.github || '';
  const leetcodeUser = profile?.codingStats?.profiles?.leetcode || profile?.socialLinks?.leetcode || '';
  const codeforcesUser = profile?.codingStats?.profiles?.codeforces || profile?.socialLinks?.codeforces || '';

  const isAnyPlatformLinked = githubUser || leetcodeUser || codeforcesUser;

  // Codeforces activity decay (90 days)
  const cfLastContestAt = profile?.codingStats?.rawMetrics?.codeforces?.lastContestAt;
  const isCfDecayed = useMemo(() => {
    if (!cfLastContestAt) return false;
    const lastDate = new Date(cfLastContestAt).getTime();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    return (Date.now() - lastDate) > ninetyDaysMs;
  }, [cfLastContestAt]);

  // GitHub Language distributions
  const githubLanguages = useMemo(() => {
    const rawLanguages = profile?.codingStats?.rawMetrics?.github?.topLanguages || [];
    const totalCount = rawLanguages.reduce((sum, lang) => sum + (lang.count || 0), 0);
    if (totalCount === 0) return [];
    
    // Sort and calculate percentages
    return rawLanguages
      .slice()
      .sort((a, b) => b.count - a.count)
      .map(lang => ({
        name: lang.name,
        count: lang.count,
        pct: Math.round((lang.count / totalCount) * 100)
      }));
  }, [profile?.codingStats?.rawMetrics?.github?.topLanguages]);

  // Recharts platform activity chart (reused CodingPage bar chart pattern)
  const chartData = useMemo(() => {
    if (!profile || !profile.codingStats) return [];
    return [
      {
        name: 'GitHub',
        activity: profile.codingStats.githubContributions || 0,
        fill: 'var(--primary-cyan)'
      },
      {
        name: 'LeetCode',
        activity: profile.codingStats.leetcodeProblemsSolved || 0,
        fill: 'var(--primary-blue)'
      },
      {
        name: 'Codeforces',
        activity: profile.codingStats.codeforcesRating || 0,
        fill: 'var(--primary-orange)'
      }
    ].filter(p => p.activity > 0);
  }, [profile]);

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading developer dashboard...">
        <div className="skeleton h-12 w-1/4 rounded-lg" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="skeleton h-48 rounded-xl" />
          <div className="skeleton h-48 md:col-span-2 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="skeleton h-24 rounded-lg" />
          <div className="skeleton h-24 rounded-lg" />
          <div className="skeleton h-24 rounded-lg" />
          <div className="skeleton h-24 rounded-lg" />
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  // Error State Guard
  if (profileError) {
    return (
      <div className="card p-8 flex flex-col items-center gap-4 text-center max-w-lg mx-auto mt-12 border border-red-500/20 bg-red-500/5">
        <AlertTriangle size={48} className="text-red-500" />
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Failed to load profile</h2>
          <p className="text-sm subtle mt-1">{profileError}</p>
        </div>
      </div>
    );
  }

  // Faculty Redaction Guard
  if (isFaculty || hasNoScores) {
    return (
      <div className="card p-8 flex flex-col items-center gap-4 text-center max-w-lg mx-auto mt-12 border border-dashed" style={{ borderColor: 'var(--border-color)' }}>
        <Award size={48} style={{ color: 'var(--primary-blue)' }} />
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Developer Analytics Redacted</h2>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Under institutional privacy policies, developer scoring records, platform synchronizations, and coding stats are redacted for advisor and faculty accounts.
          </p>
        </div>
      </div>
    );
  }

  const {
    developerScore = 0,
    githubScore = 0,
    dsaScore = 0,
    cpScore = 0,
    scoreBreakdown = {},
    gpa = null,
    achievementPoints = 0,
    placementReadinessScore = 0,
    codingStats = {},
    lastSyncStatus = null,
    lastSyncError = null
  } = profile;

  const rawMetrics = codingStats?.rawMetrics || {};

  return (
    <div className="space-y-6 fade-in-up">
      {/* ─── Header Section ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="headline">Developer Dashboard</h1>
          <p className="text-sm subtle mt-1">
            Track your unified developer score, competitive programming weight, and metrics history.
          </p>
        </div>
        
        {isAnyPlatformLinked && (
          <div className="flex items-center gap-3">
            <span className="text-xs subtle">
              {codingStats?.lastSyncedAt ? (
                <>Last synced: {new Date(codingStats.lastSyncedAt).toLocaleString()}</>
              ) : (
                'Never synced'
              )}
            </span>
            <SyncButton 
              onSync={syncAll}
              isSyncing={syncing === 'all'}
              cooldown={cooldowns.all}
            />
          </div>
        )}
      </div>

      {/* Sync / Profile error alert banners */}
      {(syncError || lastSyncError) && (
        <div 
          className="flex items-start gap-3 p-4 rounded-xl border text-sm"
          style={{ 
            background: 'rgba(239, 68, 68, 0.08)', 
            borderColor: 'var(--danger-color)', 
            color: 'var(--danger-color)' 
          }}
          role="alert"
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold">Synchronization Error</div>
            <p className="text-xs">{syncError || lastSyncError}</p>
            {syncError && (
              <button 
                onClick={() => setSyncError(null)}
                className="text-xs font-semibold underline cursor-pointer mt-1 block"
                style={{ color: 'var(--danger-color)' }}
              >
                Dismiss notification
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Hero Overview Grid ─────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-6 flex flex-col items-center justify-center text-center">
          <DeveloperScoreRing 
            score={developerScore} 
            size={140} 
            strokeWidth={12} 
            label="Developer Score" 
          />
          <div className="mt-4 space-y-1">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-500">
              {developerScore >= 75 ? 'Elite Tier' : developerScore >= 50 ? 'Advanced Tier' : 'Developing'}
            </span>
            <p className="text-xs subtle">Unified derived algorithm scoring</p>
          </div>
        </div>

        <div className="card p-6 lg:col-span-2 flex flex-col justify-between space-y-6">
          <ScoreBreakdownBar scoreBreakdown={scoreBreakdown} />
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
            <div>
              <div className="text-[10px] uppercase font-semibold text-secondary" style={{ color: 'var(--text-secondary)' }}>GitHub Score</div>
              <div className="text-lg font-bold" style={{ color: 'var(--primary-cyan)' }}>{githubScore}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-secondary" style={{ color: 'var(--text-secondary)' }}>DSA Score</div>
              <div className="text-lg font-bold" style={{ color: 'var(--primary-blue)' }}>{dsaScore}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-secondary" style={{ color: 'var(--text-secondary)' }}>CP Score</div>
              <div className="text-lg font-bold" style={{ color: 'var(--primary-orange)' }}>{cpScore}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-semibold text-secondary" style={{ color: 'var(--text-secondary)' }}>Bonus points</div>
              <div className="text-lg font-bold text-emerald-500">
                +{(scoreBreakdown?.achievementBonus || 0) + (scoreBreakdown?.readinessBonus || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4-Up Score Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          label="GitHub Contributions"
          value={codingStats?.githubContributions || 0}
          sub="Commits, PRs, issues"
          color="var(--primary-cyan)"
        />
        <StatCard 
          label="LeetCode Problems"
          value={codingStats?.leetcodeProblemsSolved || 0}
          sub={`Streak: ${codingStats?.leetcodeStreak || 0} days`}
          color="var(--primary-blue)"
        />
        <StatCard 
          label="Codeforces Rating"
          value={codingStats?.codeforcesRating || 0}
          sub={codingStats?.codeforcesRank ? `Rank: ${codingStats.codeforcesRank}` : 'Unranked'}
          color="var(--primary-orange)"
        />
        <StatCard 
          label="Academic GPA"
          value={gpa != null ? gpa : '—'}
          sub={`Attendance: ${profile?.attendanceOverall != null ? `${profile.attendanceOverall}%` : 'N/A'}`}
          color="var(--primary-purple)"
        />
      </div>

      {/* ─── Empty state placeholder if no profiles are configured ───────────────── */}
      {!isAnyPlatformLinked ? (
        <div className="card p-8 text-center border-dashed flex flex-col items-center justify-center gap-3" style={{ borderColor: 'var(--border-color)' }}>
          <Code2 size={40} style={{ color: 'var(--text-secondary)' }} />
          <div>
            <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>No platforms connected</h2>
            <p className="text-xs subtle mt-1">Configure your GitHub, LeetCode, and Codeforces handles to populate analytics charts.</p>
          </div>
        </div>
      ) : (
        /* ─── Platform details and Recharts charts ─────────────────────────────── */
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recharts chart */}
          {chartData.length > 0 && (
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Activity Distribution</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-medium)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }} 
                    />
                    <Bar dataKey="activity" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <rect key={`rect-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* GitHub Detail Panel */}
          {githubUser && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Github size={16} style={{ color: 'var(--primary-cyan)' }} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>GitHub Analytics</span>
                </div>
                <span className="text-[10px] subtle px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                  @{githubUser}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-neutral-50 dark:bg-neutral-900 border" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="subtle font-semibold">Repositories</div>
                  <div className="text-sm font-bold mt-0.5">{rawMetrics.github?.publicRepos || codingStats.githubRepos || 0}</div>
                </div>
                <div className="p-2 rounded bg-neutral-50 dark:bg-neutral-900 border" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="subtle font-semibold">Stars</div>
                  <div className="text-sm font-bold mt-0.5">{rawMetrics.github?.stars || 0}</div>
                </div>
                <div className="p-2 rounded bg-neutral-50 dark:bg-neutral-900 border" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="subtle font-semibold">Followers</div>
                  <div className="text-sm font-bold mt-0.5">{rawMetrics.github?.followers || codingStats.githubFollowers || 0}</div>
                </div>
              </div>

              {/* Language Distribution Bar */}
              {githubLanguages.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold subtle">Language Stack</div>
                  <div className="h-2 w-full flex rounded-full overflow-hidden">
                    {githubLanguages.map((lang, idx) => {
                      // Palette of colors for languages
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                      const color = colors[idx % colors.length];
                      return (
                        <div 
                          key={lang.name}
                          style={{ width: `${lang.pct}%`, backgroundColor: color }}
                          title={`${lang.name}: ${lang.pct}%`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] subtle">
                    {githubLanguages.slice(0, 5).map((lang, idx) => {
                      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                      return (
                        <div key={lang.name} className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: colors[idx % colors.length] }} />
                          <span>{lang.name}</span>
                          <span className="font-bold">{lang.pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LeetCode Detail Panel */}
          {leetcodeUser && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={16} style={{ color: 'var(--primary-blue)' }} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>LeetCode Metrics</span>
                </div>
                <span className="text-[10px] subtle px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                  @{leetcodeUser}
                </span>
              </div>

              <div className="space-y-3">
                {/* Solved metrics */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between subtle font-semibold">
                    <span>Solved Problems</span>
                    <span>{rawMetrics.leetcode?.totalSolved || codingStats.leetcodeProblemsSolved || 0}</span>
                  </div>
                  
                  {/* Progress segment bars */}
                  <div className="space-y-1.5 pt-1">
                    <div>
                      <div className="flex justify-between text-[10px] subtle">
                        <span>Easy</span>
                        <span>{rawMetrics.leetcode?.easySolved || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{ width: `${Math.min(100, ((rawMetrics.leetcode?.easySolved || 0) / Math.max(1, rawMetrics.leetcode?.totalSolved || 1)) * 100)}%` }} 
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-[10px] subtle">
                        <span>Medium</span>
                        <span>{rawMetrics.leetcode?.mediumSolved || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full" 
                          style={{ width: `${Math.min(100, ((rawMetrics.leetcode?.mediumSolved || 0) / Math.max(1, rawMetrics.leetcode?.totalSolved || 1)) * 100)}%` }} 
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] subtle">
                        <span>Hard</span>
                        <span>{rawMetrics.leetcode?.hardSolved || 0}</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-rose-500 rounded-full" 
                          style={{ width: `${Math.min(100, ((rawMetrics.leetcode?.hardSolved || 0) / Math.max(1, rawMetrics.leetcode?.totalSolved || 1)) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {rawMetrics.leetcode?.contestRating > 0 && (
                  <div className="flex justify-between text-xs border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                    <div>
                      <span className="subtle block">Contest Rating</span>
                      <span className="font-bold text-sm">{rawMetrics.leetcode.contestRating}</span>
                    </div>
                    <div className="text-right">
                      <span className="subtle block">Global Rank</span>
                      <span className="font-bold text-sm">#{rawMetrics.leetcode.contestGlobalRanking || '—'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Codeforces Detail Panel */}
          {codeforcesUser && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={16} style={{ color: 'var(--primary-orange)' }} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Codeforces Standings</span>
                </div>
                <span className="text-[10px] subtle px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                  @{codeforcesUser}
                </span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="subtle block">Rating</span>
                    <span className="font-bold text-base mt-0.5 block" style={{ color: 'var(--primary-orange)' }}>
                      {rawMetrics.codeforces?.rating || codingStats.codeforcesRating || 0}
                    </span>
                  </div>
                  <div>
                    <span className="subtle block">Peak Rating</span>
                    <span className="font-bold text-base mt-0.5 block text-neutral-400">
                      {rawMetrics.codeforces?.maxRating || codingStats.codeforcesMaxRating || 0}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between text-xs border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <span className="subtle">Tier Rank</span>
                    <span className="font-semibold capitalize block mt-0.5">{rawMetrics.codeforces?.rank || codingStats.codeforcesRank || 'Unranked'}</span>
                  </div>
                  {rawMetrics.codeforces?.contribution !== undefined && (
                    <div className="text-right">
                      <span className="subtle">Contribution</span>
                      <span className="font-semibold block mt-0.5">{(rawMetrics.codeforces.contribution >= 0 ? '+' : '') + rawMetrics.codeforces.contribution}</span>
                    </div>
                  )}
                </div>

                {/* CF Decay Warning Badge */}
                {isCfDecayed && (
                  <div 
                    className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
                    style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-color)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
                  >
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <p>
                      CF decay warning: No contest activity tracked in the last 90 days. CP score has started to decay.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Platform Sync Configurations ────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Profile Sync Connections</h2>
        <div className="grid md:grid-cols-3 gap-4">
          
          {/* GitHub Connection */}
          <div className="card p-4 flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Github size={16} style={{ color: 'var(--primary-cyan)' }} />
                  <span className="font-semibold text-xs text-secondary" style={{ color: 'var(--text-secondary)' }}>GitHub Connection</span>
                </div>
                {githubUser ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Linked" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-700" title="Not connected" />
                )}
              </div>
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {githubUser ? `@${githubUser}` : 'Not Linked'}
              </p>
              {profile?.codingStats?.githubLastSyncedAt && (
                <span className="text-[10px] subtle block mt-1">
                  Synced: {new Date(profile.codingStats.githubLastSyncedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="pt-3">
              {githubUser ? (
                <SyncButton 
                  onSync={syncGithub}
                  isSyncing={syncing === 'github'}
                  cooldown={cooldowns.github}
                />
              ) : (
                <div className="text-[10px] subtle italic">Connect handle in profiles settings</div>
              )}
            </div>
          </div>

          {/* LeetCode Connection */}
          <div className="card p-4 flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Code2 size={16} style={{ color: 'var(--primary-blue)' }} />
                  <span className="font-semibold text-xs text-secondary" style={{ color: 'var(--text-secondary)' }}>LeetCode Connection</span>
                </div>
                {leetcodeUser ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Linked" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-700" title="Not connected" />
                )}
              </div>
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {leetcodeUser ? `@${leetcodeUser}` : 'Not Linked'}
              </p>
              {profile?.codingStats?.leetcodeLastSyncedAt && (
                <span className="text-[10px] subtle block mt-1">
                  Synced: {new Date(profile.codingStats.leetcodeLastSyncedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="pt-3">
              {leetcodeUser ? (
                <SyncButton 
                  onSync={syncLeetcode}
                  isSyncing={syncing === 'leetcode'}
                  cooldown={cooldowns.leetcode}
                />
              ) : (
                <div className="text-[10px] subtle italic">Connect handle in profiles settings</div>
              )}
            </div>
          </div>

          {/* Codeforces Connection */}
          <div className="card p-4 flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Globe size={16} style={{ color: 'var(--primary-orange)' }} />
                  <span className="font-semibold text-xs text-secondary" style={{ color: 'var(--text-secondary)' }}>Codeforces Connection</span>
                </div>
                {codeforcesUser ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Linked" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-700" title="Not connected" />
                )}
              </div>
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {codeforcesUser ? `@${codeforcesUser}` : 'Not Linked'}
              </p>
              {profile?.codingStats?.codeforcesLastSyncedAt && (
                <span className="text-[10px] subtle block mt-1">
                  Synced: {new Date(profile.codingStats.codeforcesLastSyncedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="pt-3">
              {codeforcesUser ? (
                <SyncButton 
                  onSync={syncCodeforces}
                  isSyncing={syncing === 'codeforces'}
                  cooldown={cooldowns.codeforces}
                />
              ) : (
                <div className="text-[10px] subtle italic">Connect handle in profiles settings</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default DeveloperDashboard;
