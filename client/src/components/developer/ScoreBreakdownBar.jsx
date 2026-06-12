import React from 'react';

/**
 * ScoreBreakdownBar — Segmented progress bar representing unified score weight distributions.
 * 
 * Props:
 *  - scoreBreakdown: Object { githubWeight, dsaWeight, cpWeight, achievementBonus, readinessBonus }
 *  - loading: Boolean
 */
export function ScoreBreakdownBar({ scoreBreakdown, loading = false }) {
  if (loading) {
    return (
      <div className="space-y-2 animate-pulse" aria-busy="true" aria-label="Loading score breakdown...">
        <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="flex justify-between gap-4">
          <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>
      </div>
    );
  }

  // Null guard / Faculty-redaction guard
  if (!scoreBreakdown || typeof scoreBreakdown !== 'object') {
    return (
      <div className="text-xs subtle text-center py-2 border border-dashed rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
        Score breakdown details unavailable.
      </div>
    );
  }

  const {
    githubWeight = 0,
    dsaWeight = 0,
    cpWeight = 0,
    achievementBonus = 0,
    readinessBonus = 0
  } = scoreBreakdown;

  // Convert weights (which sum to 1 or 100) to percentages
  const totalWeight = githubWeight + dsaWeight + cpWeight;
  const isZero = totalWeight === 0;

  let githubPct = 0;
  let dsaPct = 0;
  let cpPct = 0;

  if (!isZero) {
    const active = [];
    if (githubWeight > 0) active.push('github');
    if (dsaWeight > 0) active.push('dsa');
    if (cpWeight > 0) active.push('cp');

    if (active.length === 1) {
      if (active[0] === 'github') githubPct = 100;
      else if (active[0] === 'dsa') dsaPct = 100;
      else cpPct = 100;
    } else if (active.length === 2) {
      if (!githubWeight) {
        dsaPct = Math.round((dsaWeight / totalWeight) * 100);
        cpPct = 100 - dsaPct;
      } else if (!dsaWeight) {
        githubPct = Math.round((githubWeight / totalWeight) * 100);
        cpPct = 100 - githubPct;
      } else {
        githubPct = Math.round((githubWeight / totalWeight) * 100);
        dsaPct = 100 - githubPct;
      }
    } else {
      githubPct = Math.round((githubWeight / totalWeight) * 100);
      dsaPct = Math.round((dsaWeight / totalWeight) * 100);
      cpPct = 100 - githubPct - dsaPct;
    }
  }

  const segments = [
    { label: 'GitHub', pct: githubPct, color: 'var(--primary-cyan)', count: githubWeight },
    { label: 'DSA (LeetCode)', pct: dsaPct, color: 'var(--primary-blue)', count: dsaWeight },
    { label: 'CP (Codeforces)', pct: cpPct, color: 'var(--primary-orange)', count: cpWeight }
  ];

  return (
    <div className="space-y-4" role="img" aria-label={`Score Breakdown: GitHub ${githubPct}%, DSA ${dsaPct}%, CP ${cpPct}%`}>
      <div className="text-sm font-semibold select-none" style={{ color: 'var(--text-primary)' }}>
        Scoring Weight Distribution
      </div>

      {/* Segmented Progress bar */}
      <div 
        className="h-5 w-full flex rounded-full overflow-hidden border"
        style={{ background: 'var(--bg-dark)', borderColor: 'var(--border-color)' }}
      >
        {isZero ? (
          <div className="w-full h-full flex items-center justify-center text-[10px] subtle">
            No active weights calculated
          </div>
        ) : (
          segments.map((s, idx) => {
            if (s.pct <= 0) return null;
            return (
              <div
                key={s.label}
                className="h-full flex items-center justify-center text-[10px] font-bold text-white transition-all duration-300"
                style={{
                  width: `${s.pct}%`,
                  backgroundColor: s.color,
                }}
                title={`${s.label}: ${s.pct}%`}
              >
                {s.pct >= 10 && `${s.pct}%`}
              </div>
            );
          })
        )}
      </div>

      {/* Legends and Bonuses */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 text-xs">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{s.label}:</span>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isZero ? '—' : `${s.pct}%`}
            </span>
          </div>
        ))}

        {/* Achievement Bonus */}
        <div className="flex items-center gap-2">
          <span 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ backgroundColor: 'var(--success-color)' }} 
          />
          <span style={{ color: 'var(--text-secondary)' }}>Achievements:</span>
          <span className="font-bold text-green-500">
            +{achievementBonus} pts
          </span>
        </div>

        {/* Placement Readiness Bonus */}
        <div className="flex items-center gap-2">
          <span 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ backgroundColor: 'var(--primary-blue)' }} 
          />
          <span style={{ color: 'var(--text-secondary)' }}>Readiness:</span>
          <span className="font-bold text-blue-500">
            +{readinessBonus} pts
          </span>
        </div>
      </div>
    </div>
  );
}

export default ScoreBreakdownBar;
