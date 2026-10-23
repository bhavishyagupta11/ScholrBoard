import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  ShieldCheck, 
  Code2, 
  Github, 
  Activity, 
  Globe, 
  Flame, 
  Star, 
  GitFork, 
  GitPullRequest 
} from 'lucide-react';

/**
 * ScoreExplanationPanel — Expandable explanation panel for Developer Score
 *
 * Invariants (V13 Part 23.1, 23.2, Part 27 Phase 9):
 *  - Accordion header: "[▼ Why is my score X?]"
 *  - Sub-signal status breakdown (LeetCode, GitHub, Streak, Codeforces, Languages, Merged PRs)
 *  - Recency level explanations:
 *      Level 1: "Verified 30-day activity frequency — full recency factor applied."
 *      Level 2: "Single submission date recorded (frequency unverified) — capped recency credit applied. Medium confidence."
 *      Level 3: "Recency data unavailable — problem-solving evidence preserved (benefit of doubt). Coverage reflects this."
 *  - Popularity disclaimer (stars & forks): "(popularity is not equivalent to technical quality)"
 *  - Private contribution disclosure notice (Option A GitHub GraphQL policy)
 */
export function ScoreExplanationPanel({ profile, developerScore: propScore, developerScoreMeta: propMeta }) {
  const [isOpen, setIsOpen] = useState(false);

  const score = propScore ?? profile?.developerScore ?? 0;
  const meta = propMeta || profile?.developerScoreMeta || {};
  const codingStats = profile?.codingStats || {};
  const rawMetrics = codingStats?.rawMetrics || {};

  // Resolve dimensions whether Map or plain Object
  const getDimension = (key) => {
    if (!meta.dimensions) return null;
    if (meta.dimensions instanceof Map) {
      return meta.dimensions.get(key);
    }
    return meta.dimensions[key] || null;
  };

  const dsaDim = getDimension('dsa');
  const engDim = getDimension('engActivity');
  const repoDim = getDimension('repoQuality');
  const cpDim = getDimension('cp');
  const breadthDim = getDimension('breadth');

  // Recency level resolution (L1, L2, L3)
  const recencyLevel = dsaDim?.recencyLevel || meta.recencyLevel || (
    rawMetrics.leetcode?.submissionCalendar ? 'Level 1' :
    rawMetrics.leetcode?.lastActivityDate ? 'Level 2' : 'Level 3'
  );

  const getRecencyExplanation = (lvl) => {
    switch (lvl) {
      case 'Level 1':
        return 'Verified 30-day activity frequency — full recency factor applied.';
      case 'Level 2':
        return 'Single submission date recorded (frequency unverified) — capped recency credit applied. Medium confidence.';
      case 'Level 3':
      default:
        return 'Recency data unavailable — problem-solving evidence preserved (benefit of doubt). Coverage reflects this.';
    }
  };

  // Metric values
  const lcSolved = rawMetrics.leetcode?.totalSolved || codingStats.leetcodeProblemsSolved || 0;
  const lcMedium = rawMetrics.leetcode?.mediumSolved || 0;
  const lcHard = rawMetrics.leetcode?.hardSolved || 0;
  const lcActiveDays = rawMetrics.leetcode?.activeSubmitDays || 0;

  const ghWeeks = profile?.githubContributionCalendar?.weeks || [];
  let ghActiveDays = 0;
  if (ghWeeks.length > 0) {
    ghActiveDays = ghWeeks.reduce((acc, w) => 
      acc + (w.contributionDays?.filter(d => (d.contributionCount || d.count) > 0).length || 0), 0
    );
  } else {
    ghActiveDays = codingStats.githubContributions || 0;
  }

  const streakDays = profile?.githubContributionCalendar?.currentStreak || codingStats.githubStreak || 0;
  const streakScore = Math.min(100, Math.round((streakDays / 60) * 100));

  const cfRating = rawMetrics.codeforces?.rating || codingStats.codeforcesRating || 0;
  const cfLastContestAt = rawMetrics.codeforces?.lastContestAt;
  let cfDecayText = 'active rating';
  if (cfLastContestAt) {
    const diffDays = Math.round((Date.now() - new Date(cfLastContestAt).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      const diffMonths = Math.round(diffDays / 30);
      cfDecayText = `last contest ${diffMonths} months ago; smooth decay applied`;
    } else {
      cfDecayText = `last contest ${diffDays} days ago; verified`;
    }
  }

  const distinctLanguages = rawMetrics.github?.topLanguages?.length || 0;
  const breadthScore = Math.min(100, distinctLanguages * 20);

  const qualifiedMergedPRs = rawMetrics.github?.qualifiedMergedPRsCount || 
    rawMetrics.github?.prsAndIssues?.qualifiedMergedPRs || 0;

  const stars = rawMetrics.github?.stars || 0;
  const forks = rawMetrics.github?.forks || 0;
  // Estimate ~pts contribution (repoQuality max 10 pts bonus * 20% weight = ~2-4 pts to final score)
  const starSignal = Math.min(5, Math.round((Math.min(stars, 200) / 200) * 5));
  const forkSignal = Math.min(5, Math.round((Math.min(forks, 50) / 50) * 5));
  const ptsContribution = Math.max(1, Math.round((starSignal + forkSignal) * 0.4));

  const lcContestRating = rawMetrics.leetcode?.contestRating || codingStats.leetcodeContestRating || null;
  const lcContestRank = rawMetrics.leetcode?.contestGlobalRanking || null;
  const cpBreakdown = cpDim?.breakdown || {};
  const isCrossPlatform = Boolean(cpBreakdown.crossPlatformComparison);

  // Sub-signal dimensions list
  const dimensionRows = [
    {
      name: 'DSA (Practice Volume)',
      score: dsaDim?.score ?? (codingStats.leetcodeProblemsSolved ? Math.min(100, Math.round(codingStats.leetcodeProblemsSolved / 3)) : null),
      cov: dsaDim?.dimensionCoverage ?? (codingStats.leetcodeProblemsSolved ? 85 : 0),
      effWeight: dsaDim?.effectiveWeight != null ? `${(dsaDim.effectiveWeight * 100).toFixed(1)}%` : '30%',
      status: recencyLevel === 'Level 3' 
        ? 'PARTIAL (no recency data; score not discounted)' 
        : recencyLevel === 'Level 2'
        ? 'PARTIAL (L2 recency cap applied)'
        : 'SYNCED',
    },
    {
      name: 'Activity Consistency',
      score: engDim?.score ?? (codingStats.githubContributions ? Math.min(100, Math.round(codingStats.githubContributions / 2)) : null),
      cov: engDim?.dimensionCoverage ?? (codingStats.githubContributions ? 100 : 0),
      effWeight: engDim?.effectiveWeight != null ? `${(engDim.effectiveWeight * 100).toFixed(1)}%` : '25%',
      status: codingStats.githubContributions ? 'SYNCED' : 'NOT_CONNECTED',
    },
    {
      name: 'Repository Quality',
      score: repoDim?.score ?? (rawMetrics.github?.stars ? 70 : null),
      cov: repoDim?.dimensionCoverage ?? (rawMetrics.github ? 100 : 0),
      effWeight: repoDim?.effectiveWeight != null ? `${(repoDim.effectiveWeight * 100).toFixed(1)}%` : '20%',
      status: rawMetrics.github ? 'SYNCED' : 'NOT_CONNECTED',
    },
    {
      name: 'Competitive Programming (Contests)',
      score: cpDim?.score ?? null,
      cov: cpDim?.dimensionCoverage ?? (cpDim?.score ? 100 : 0),
      effWeight: cpDim?.effectiveWeight != null ? `${(cpDim.effectiveWeight * 100).toFixed(1)}%` : (cpDim?.score ? '15%' : '0%'),
      status: isCrossPlatform 
        ? 'DUAL_PLATFORM (LeetCode + Codeforces)' 
        : (cpDim?.score ? 'SINGLE_PLATFORM' : 'UNRATED (excluded without penalty)'),
    },
    {
      name: 'Technical Breadth',
      score: breadthDim?.score ?? breadthScore,
      cov: breadthDim?.dimensionCoverage ?? (distinctLanguages > 0 ? 100 : 0),
      effWeight: breadthDim?.effectiveWeight != null ? `${(breadthDim.effectiveWeight * 100).toFixed(1)}%` : '10%',
      status: distinctLanguages > 0 ? 'SYNCED' : 'NOT_CONNECTED',
    },
  ];

  return (
    <div 
      className="card overflow-hidden border transition-all"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      {/* Accordion Trigger Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--card-hover)] transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <HelpCircle size={16} style={{ color: 'var(--primary-cyan)' }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
            Why is my score {score}?
          </span>
          <span className="text-[11px] subtle ml-2" style={{ color: 'var(--text-secondary)' }}>
            Sub-signal breakdown, recency factor & formula transparency
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--primary-cyan)' }}>
          <span>{isOpen ? 'Collapse' : 'Explain'}</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Accordion Expandable Content */}
      {isOpen && (
        <div 
          className="p-5 border-t space-y-5 text-xs animate-fade-in"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-medium)' }}
        >
          {/* Metadata Badges Bar */}
          <div className="flex flex-wrap items-center gap-3 pb-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Coverage:</span>
              <span className="font-bold text-emerald-400">{meta.coverage ?? 100}%</span>
            </div>
            <span className="opacity-30">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Confidence:</span>
              <span className="font-bold text-cyan-400">{meta.confidence ?? 'High'}</span>
            </div>
            <span className="opacity-30">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Freshness:</span>
              <span className="font-bold text-amber-400">{meta.freshness ?? 'Fresh'}</span>
            </div>
            <span className="opacity-30">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Recency Band:</span>
              <span className="font-bold text-purple-400">{recencyLevel}</span>
            </div>
          </div>

          {/* Sub-signals Evidence Breakdown (Part 23.1 Exact Format) */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Verified Evidence Signals
            </h4>
            
            <ul className="space-y-2.5 font-mono text-[11px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {/* LeetCode Practice Volume Sub-signal */}
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 shrink-0">→</span>
                <div>
                  <span className="font-semibold text-cyan-300">DSA Practice Volume:</span>{' '}
                  {lcSolved > 0 ? (
                    <>
                      <span>{lcSolved} problems solved ({lcMedium} medium, {lcHard} hard); {lcActiveDays} active submission days in last 30 days</span>
                      <span className="block text-[10px] text-neutral-400 font-sans mt-0.5">
                        (practice volume measures algorithmic fluency and preparation depth; evaluated under DSA dimension)
                      </span>
                    </>
                  ) : (
                    <span className="text-neutral-400 font-sans">No LeetCode activity verified (no penalty applied).</span>
                  )}
                </div>
              </li>

              {/* Recency Factor Explanation (Part 27 Phase 9 Items 2 & 3) */}
              <li className="flex items-start gap-2 bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800">
                <Info size={14} className="text-purple-400 shrink-0 mt-0.5" />
                <div className="font-sans text-[11px]">
                  <span className="font-semibold text-purple-300">Recency Status ({recencyLevel}):</span>{' '}
                  <span className="text-neutral-300">{getRecencyExplanation(recencyLevel)}</span>
                </div>
              </li>

              {/* GitHub Activity Days Sub-signal */}
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 shrink-0">→</span>
                <div>
                  <span className="font-semibold text-cyan-300">GitHub:</span>{' '}
                  <span>{ghActiveDays} activity days in last year</span>
                  <span className="block text-[10px] text-neutral-400 font-sans mt-0.5">
                    (includes anonymized private contributions if enabled in GitHub settings)
                  </span>
                </div>
              </li>

              {/* Streak Sub-signal */}
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 shrink-0">→</span>
                <div>
                  <span className="font-semibold text-cyan-300">Streak:</span>{' '}
                  <span>{streakDays} days; streakScore = min(100, {streakDays}/60 × 100) = {streakScore}</span>
                </div>
              </li>

              {/* Contest Performance Sub-signal (Platform-Aware Comparison) */}
              {isCrossPlatform ? (
                <li className="flex items-start gap-2 bg-neutral-900/40 p-2.5 rounded-lg border border-cyan-500/20">
                  <span className="text-cyan-400 shrink-0 font-bold">★</span>
                  <div>
                    <span className="font-semibold text-cyan-300">Cross-Platform Rating Comparison (Dual-Platform Calibrated):</span>{' '}
                    <span>
                      LeetCode contest rating {lcContestRating} ({cpBreakdown.leetcodePercentile ?? '—'}th percentile) + Codeforces rating {cfRating} ({cpBreakdown.codeforcesPercentile ?? '—'}th percentile; {cfDecayText}). Subscore: {cpDim?.score ?? '—'}/100.
                    </span>
                    <span className="block text-[10px] text-neutral-400 font-sans mt-0.5">
                      (Normalized independently against verified platform distributions to prevent raw rating scale distortion; practice volume remains separate; equal percentiles reflect relative standing within distinct platform populations)
                    </span>
                  </div>
                </li>
              ) : lcContestRating ? (
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 shrink-0">→</span>
                  <div>
                    <span className="font-semibold text-cyan-300">Contest Performance (LeetCode Single-Platform):</span>{' '}
                    <span>
                      rating {lcContestRating} ({cpBreakdown.leetcodePercentile ?? '—'}th percentile); Codeforces contest data unavailable; coverage 75% (no zero penalty).
                    </span>
                  </div>
                </li>
              ) : cfRating > 0 ? (
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 shrink-0">→</span>
                  <div>
                    <span className="font-semibold text-cyan-300">Contest Performance (Codeforces Single-Platform):</span>{' '}
                    <span>
                      rating {cfRating} ({cpBreakdown.codeforcesPercentile ?? '—'}th percentile; {cfDecayText}); LeetCode contest rating unavailable; coverage {cpDim?.dimensionCoverage ?? 75}%.
                    </span>
                  </div>
                </li>
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-neutral-500 shrink-0">→</span>
                  <div>
                    <span className="font-semibold text-neutral-400">Contest Performance:</span>{' '}
                    <span className="text-neutral-400 font-sans">
                      No contest rating verified (unrated accounts excluded from scoring denominator without penalty).
                    </span>
                  </div>
                </li>
              )}

              {/* Technical Breadth Sub-signal */}
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 shrink-0">→</span>
                <div>
                  <span className="font-semibold text-cyan-300">Languages:</span>{' '}
                  <span>{distinctLanguages} distinct (breadthScore = {breadthScore})</span>
                </div>
              </li>

              {/* Merged PRs Sub-signal */}
              <li className="flex items-start gap-2">
                <span className="text-cyan-400 shrink-0">→</span>
                <div>
                  <span className="font-semibold text-cyan-300">Pull Requests:</span>{' '}
                  <span>{qualifiedMergedPRs} qualified merged PRs (per-repo capped, non-trivial)</span>
                </div>
              </li>

              {/* Popularity Disclaimer (Part 23.1 & 23.6) */}
              <li className="flex items-start gap-2 bg-amber-500/5 p-2.5 rounded-lg border border-amber-500/20">
                <Star size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="font-sans text-[11px]">
                  <span className="font-semibold text-amber-300">Community:</span>{' '}
                  <span className="text-neutral-200">
                    {stars} stars, {forks} forks → starSignal + forkSignal → ~{ptsContribution} pts contribution to final score
                  </span>{' '}
                  <span className="text-amber-400/90 font-medium italic">
                    (popularity is not equivalent to technical quality)
                  </span>
                </div>
              </li>
            </ul>
          </div>

          {/* Dimensions Table Breakdown */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Dimension Weights & Status
            </h4>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}>
                    <th className="py-1.5 font-semibold">Dimension</th>
                    <th className="py-1.5 font-semibold">Score</th>
                    <th className="py-1.5 font-semibold">Cov.</th>
                    <th className="py-1.5 font-semibold">EffWeight</th>
                    <th className="py-1.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-850">
                  {dimensionRows.map((dim, i) => (
                    <tr key={i} className="hover:bg-neutral-800/20">
                      <td className="py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{dim.name}</td>
                      <td className="py-2 text-cyan-400">{dim.score != null ? dim.score : '—'}</td>
                      <td className="py-2">{dim.cov}%</td>
                      <td className="py-2">{dim.effWeight}</td>
                      <td className="py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-sans ${
                          dim.status.includes('PARTIAL') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          dim.status === 'SYNCED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          'bg-neutral-800 text-neutral-400'
                        }`}>
                          {dim.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Private Contribution Policy Disclosure Notice */}
          <div 
            className="p-3 rounded-lg text-[10px] leading-relaxed flex items-start gap-2 border font-sans"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.02)', 
              borderColor: 'var(--border-color)', 
              color: 'var(--text-secondary)' 
            }}
          >
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-cyan-400" />
            <div>
              <span className="font-semibold text-neutral-200">Private Contribution Disclosure (Option A):</span>{' '}
              GitHub activity consistency reflects contribution events returned by GitHub&apos;s GraphQL API. When you have
              enabled &quot;Include private contributions&quot; in your GitHub settings, anonymized private contribution
              counts are included in your totals. ScholrBoard cannot access private repository contents, code, or names.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScoreExplanationPanel;
