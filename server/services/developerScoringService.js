import crypto from 'crypto';
import Profile from '../models/Profile.js';
import AuditLog from '../models/AuditLog.js';
import {
  persistScoreCalculationWithRetry,
  canonicalJSON,
  sha256,
  deriveConfidence,
  computeScoreFreshness,
} from './scorePersistence.js';
import {
  acquireLock,
  renewLease,
  releaseLock,
} from './scoreHistoryService.js';

export const FORMULA_VERSION = 'v3.0.0';
export const SCORE_VERSION = 3;
export const DEVELOPER_METHODOLOGY_VERSION = 'v3.0.0';
export const DEVELOPER_SCORE_VERSION = 3;

// Nominal Dimension Weights for Developer Score v3 (Sum must strictly equal 1.0)
export const NOMINAL_WEIGHTS = {
  dsa: 0.30,
  engActivity: 0.25,
  repoQuality: 0.20,
  cp: 0.15,
  breadth: 0.10,
};

/**
 * Validates that dimension weights are non-negative numbers and sum to exactly 1.0.
 * Fails fast at startup if weights are misconfigured.
 */
export function validateWeights(weights, label = 'DeveloperScore') {
  for (const [k, v] of Object.entries(weights)) {
    if (typeof v !== 'number' || v < 0 || v > 1) {
      throw new Error(`[FATAL] ${label}.${k} = ${v} not in [0,1]`);
    }
  }
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(`[FATAL] ${label} weights sum = ${sum.toFixed(4)}, must be 1.0`);
  }
}
validateWeights(NOMINAL_WEIGHTS, 'DeveloperScore');

/**
 * Single authoritative evaluation-date convention: UTC calendar-day boundary.
 */
export function getUtcCalendarDay(date = new Date()) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Computes elapsed calendar months between two UTC dates.
 */
export function getElapsedUtcMonths(startDate, evalDate = new Date()) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const end = new Date(evalDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  return Math.max(0, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()));
}

/**
 * Evaluates raw evidence into UTC-discretized score-driving temporal inputs (V13 Part 17.1).
 */
export function evaluateTemporalEvidence(evidence = {}, evalDate = new Date(), config = {}) {
  const evalDateUtc = getUtcCalendarDay(evalDate);
  const evaluated = { ...evidence, evalDateUtc: evalDateUtc ? evalDateUtc.toISOString() : null };

  const dsaFloor = config.dsaRecencyFloor ?? evidence.dsaRecencyFloor ?? 0.55;
  const placementFloor = config.placementDsaRecencyFloor ?? evidence.placementDsaRecencyFloor ?? 0.25;
  const l2Cap = config.l2RecencyCap ?? evidence.l2RecencyCap ?? 50;

  // 1. LeetCode Recency
  if (evidence.recencyLevel === 'L1') {
    const w30 = evidence.activeSubmitDays30d;
    const w90 = evidence.activeSubmitDays90d;
    const w365 = evidence.activeSubmitDays365d;

    const hasValidWindows = (
      typeof w30 === 'number' && Number.isFinite(w30) && w30 >= 0 &&
      typeof w90 === 'number' && Number.isFinite(w90) && w90 >= 0 &&
      typeof w365 === 'number' && Number.isFinite(w365) && w365 >= 0
    );

    if (!hasValidWindows) {
      evaluated.dsaRecencyFactor = 1.0000;
      evaluated.placementRecencyFactor = 1.0000;
      evaluated.l2DecayFactor = null;
      evaluated.temporalStatus = 'TEMPORAL_UNAVAILABLE';
      evaluated.recencySubSignalAvailable = false;
    } else {
      const devScore = (Math.min(1.0, w30 / 20.0) * 0.40 + Math.min(1.0, w90 / 50.0) * 0.35 + Math.min(1.0, w365 / 150.0) * 0.25) * 100.0;
      evaluated.dsaRecencyFactor = Number((dsaFloor + (1.0 - dsaFloor) * (devScore / 100.0)).toFixed(4));

      const placeScore = (Math.min(1.0, w30 / 20.0) * 0.50 + Math.min(1.0, w90 / 45.0) * 0.30 + Math.min(1.0, w365 / 120.0) * 0.20) * 100.0;
      evaluated.placementRecencyFactor = Number((placementFloor + (1.0 - placementFloor) * (placeScore / 100.0)).toFixed(4));
      evaluated.l2DecayFactor = null;
      evaluated.temporalStatus = 'OBTAINED';
      evaluated.recencySubSignalAvailable = true;
    }
  } else if (evidence.recencyLevel === 'L2') {
    const lastActivityUtc = getUtcCalendarDay(evidence.lastActivityDate);
    if (lastActivityUtc && evalDateUtc && lastActivityUtc <= evalDateUtc) {
      const elapsedDays = Math.max(0, Math.floor((evalDateUtc.getTime() - lastActivityUtc.getTime()) / 86400000));
      const clampedDays = Math.min(elapsedDays, 730);
      evaluated.elapsedDays = elapsedDays;
      evaluated.l2DecayFactor = Number((Math.max(0, 1 - clampedDays / 730)).toFixed(4));
      const recentScoreL2 = evaluated.l2DecayFactor * l2Cap;
      evaluated.dsaRecencyFactor = Number((dsaFloor + (1.0 - dsaFloor) * (recentScoreL2 / 100.0)).toFixed(4));
      evaluated.placementRecencyFactor = Number((placementFloor + (1.0 - placementFloor) * (recentScoreL2 / 100.0)).toFixed(4));
      evaluated.temporalStatus = 'OBTAINED';
      evaluated.recencySubSignalAvailable = true;
    } else {
      evaluated.elapsedDays = null;
      evaluated.l2DecayFactor = null;
      evaluated.dsaRecencyFactor = 1.0000;
      evaluated.placementRecencyFactor = 1.0000;
      evaluated.temporalStatus = 'TEMPORAL_UNAVAILABLE';
      evaluated.recencySubSignalAvailable = false;
    }
  } else if (evidence.recencyLevel === 'L3') {
    evaluated.l2DecayFactor = null;
    evaluated.dsaRecencyFactor = 1.0000;
    evaluated.placementRecencyFactor = 1.0000;
    evaluated.temporalStatus = 'RECENCY_UNAVAILABLE';
    evaluated.recencySubSignalAvailable = false;
  } else {
    evaluated.l2DecayFactor = null;
    evaluated.dsaRecencyFactor = 1.0000;
    evaluated.placementRecencyFactor = 1.0000;
    evaluated.temporalStatus = 'TEMPORAL_UNAVAILABLE';
    evaluated.recencySubSignalAvailable = false;
  }

  // 2. Codeforces Monthly Band
  const rawMaxMonths = config.cpMaxDecayMonths;
  const cpMaxMonths = (Number.isInteger(rawMaxMonths) && rawMaxMonths > 0) ? rawMaxMonths : 36;
  const cpFloor = config.cpRecencyFloor ?? 0.45;

  const contestsCount = evidence.contestsParticipated;
  const lastContestUtc = getUtcCalendarDay(evidence.lastContestAt);

  if (contestsCount === 0) {
    evaluated.cpRecencyMonths = null;
    evaluated.cpRecencyFactor = 1.0000;
    evaluated.cpTemporalStatus = 'CONFIRMED_ZERO_CONTESTS';
    evaluated.cpSubSignalAvailable = true;
  } else if (typeof contestsCount === 'number' && contestsCount > 0) {
    if (lastContestUtc && evalDateUtc && lastContestUtc <= evalDateUtc) {
      evaluated.cpRecencyMonths = Math.min(cpMaxMonths, getElapsedUtcMonths(evidence.lastContestAt, evalDateUtc));
      evaluated.cpRecencyFactor = Number((cpFloor + (1.0 - cpFloor) * (1 - evaluated.cpRecencyMonths / cpMaxMonths)).toFixed(4));
      evaluated.cpTemporalStatus = 'OBTAINED';
      evaluated.cpSubSignalAvailable = true;
    } else {
      evaluated.cpRecencyMonths = null;
      evaluated.cpRecencyFactor = 1.0000;
      evaluated.cpTemporalStatus = 'TEMPORAL_UNAVAILABLE';
      evaluated.cpSubSignalAvailable = false;
    }
  } else {
    evaluated.cpRecencyMonths = null;
    evaluated.cpRecencyFactor = 1.0000;
    evaluated.cpTemporalStatus = 'CONTESTS_UNAVAILABLE';
    evaluated.cpSubSignalAvailable = false;
  }

  return evaluated;
}

/**
 * Computes deterministic Developer Score snapshot hash (V13 Part 17.1).
 */
export function computeDevSnapshotHash(evidence = {}, config = {}, evalDate = new Date()) {
  const temporal = evaluateTemporalEvidence(evidence, evalDate, config);
  const effectiveConfig = {
    version:               config.version || FORMULA_VERSION,
    weights:               config.weights || NOMINAL_WEIGHTS,
    dsaEasyWeight:         config.dsaEasyWeight ?? 1.0,
    dsaMediumWeight:       config.dsaMediumWeight ?? 2.5,
    dsaHardWeight:         config.dsaHardWeight ?? 5.0,
    dsaProblemCap:         config.dsaProblemCap ?? 500,
    dsaRecencyFloor:       config.dsaRecencyFloor ?? 0.55,
    l2RecencyCap:          config.l2RecencyCap ?? 50,
    dsaWindowWeights:      config.dsaWindowWeights || { w30: 0.40, w90: 0.35, w365: 0.25 },
    dsaActiveDayCeilings:  config.dsaActiveDayCeilings || { ceil30: 20, ceil90: 50, ceil365: 150 },
    contestMin:            config.contestMin ?? 3,
    contestRatingMin:      config.contestRatingMin ?? 1200,
    activeDaysCap:         config.activeDaysCap ?? 200,
    streakCap:             config.streakCap ?? 60,
    engSignalWeights:      config.engSignalWeights || { consistency: 0.55, streak: 0.10, pr: 0.25, issue: 0.10 },
    prCapPerRepo:          config.prCapPerRepo ?? 5,
    issueCapPerRepo:       config.issueCapPerRepo ?? 10,
    cpRecencyFloor:        config.cpRecencyFloor ?? 0.45,
    cpMaxDecayMonths:      config.cpMaxDecayMonths ?? 36,
    repoPresenceCap:       config.repoPresenceCap ?? 15,
    maintenanceCap:        config.maintenanceCap ?? 35,
    structureCap:          config.structureCap ?? 30,
    communityCap:          config.communityCap ?? 20,
  };

  const canonical = {
    scoreType: 'developer',
    evidence: {
      dsa: {
        easySolved:           evidence.easySolved ?? 0,
        mediumSolved:         evidence.mediumSolved ?? 0,
        hardSolved:           evidence.hardSolved ?? 0,
        activeSubmitDays30d:  evidence.activeSubmitDays30d  ?? null,
        activeSubmitDays90d:  evidence.activeSubmitDays90d  ?? null,
        activeSubmitDays365d: evidence.activeSubmitDays365d ?? null,
        recencyLevel:         evidence.recencyLevel ?? null,
        l2DecayFactor:        evidence.recencyLevel === 'L2' ? temporal.l2DecayFactor : null,
        recencyFactor:        temporal.dsaRecencyFactor,
        contestRating:        evidence.contestRating       ?? null,
        attendedContestsCount:evidence.attendedContestsCount ?? null,
      },
      engActivity: {
        activeDays:           evidence.activeDays ?? 0,
        longestStreak:        evidence.longestStreak ?? 0,
        qualifiedMergedPRs:   evidence.qualifiedMergedPRs ?? 0,
        qualifiedIssues:      evidence.qualifiedIssues ?? 0,
        calendarAvailable:    evidence.calendarAvailable ?? false,
        prSearchAvailable:    evidence.prSearchAvailable ?? false,
        issueSearchAvailable: evidence.issueSearchAvailable ?? false,
      },
      repoQuality: {
        meaningfulRepoCount:  evidence.meaningfulRepoCount ?? 0,
        recentlyActiveRepos:  evidence.recentlyActiveRepos ?? 0,
        totalStars:           evidence.totalStars ?? 0,
        totalForks:           evidence.totalForks ?? 0,
        structureBonus:       evidence.structureBonus ?? 0,
      },
      cp: {
        rating:               evidence.rating               ?? null,
        maxRating:            evidence.maxRating            ?? null,
        contestsParticipated: evidence.contestsParticipated ?? 0,
        cpRecencyMonths:      temporal.cpRecencyMonths      ?? null,
        cpRecencyFactor:      temporal.cpRecencyFactor      ?? null,
      },
      breadth: {
        uniqueLanguages:      evidence.uniqueLanguages ?? 0,
      },
    },
    config: effectiveConfig,
  };

  return sha256(canonicalJSON(canonical));
}

/**
 * Computes calculation fingerprint across evidence snapshot, config snapshot, and provider states.
 */
export function computeCalculationFingerprint({
  scoreType = 'developer',
  methodologyVersion = FORMULA_VERSION,
  evidenceSnapshot = {},
  configSnapshot = {},
  platformSyncStatesAtCalc = {},
}) {
  const contributingSources = {};
  for (const prov of ['github', 'leetcode', 'codeforces']) {
    const p = platformSyncStatesAtCalc?.[prov];
    contributingSources[prov] = {
      syncStatus: p?.syncStatus ?? null,
      dataHash: p?.dataHash ?? null,
      sourceDataUpdatedAt: p?.sourceDataUpdatedAt?.toISOString?.() ?? (typeof p?.sourceDataUpdatedAt === 'string' ? p.sourceDataUpdatedAt : null),
    };
  }

  const canonical = {
    scoreType,
    methodologyVersion,
    evidenceSnapshot,
    configSnapshot,
    contributingSources,
  };
  return sha256(canonicalJSON(canonical));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Problem Solving / DSA Dimension (Key: 'dsa', Nominal Weight: 30%)
// ─────────────────────────────────────────────────────────────────────────────
export function computeDsaDimension(leetcodeMetrics = {}, evalDate = new Date(), config = {}, platformStatus = null, handle = null) {
  const hasSolvedCounts = Boolean(
    leetcodeMetrics &&
    (
      (leetcodeMetrics.easySolved !== null && leetcodeMetrics.easySolved !== undefined) ||
      (leetcodeMetrics.mediumSolved !== null && leetcodeMetrics.mediumSolved !== undefined) ||
      (leetcodeMetrics.hardSolved !== null && leetcodeMetrics.hardSolved !== undefined) ||
      (leetcodeMetrics.totalSolved !== null && leetcodeMetrics.totalSolved !== undefined)
    )
  );

  const isPlatformAbsent = (
    (platformStatus === 'NOT_CONNECTED' && !handle && !hasSolvedCounts) ||
    platformStatus === 'UNAVAILABLE' ||
    platformStatus === 'ERROR' ||
    (!hasSolvedCounts && !handle)
  );

  if (isPlatformAbsent || !hasSolvedCounts) {
    return {
      key: 'dsa',
      nominalWeight: NOMINAL_WEIGHTS.dsa,
      score: null,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      recencyLevel: null,
      subSignalStatus: {
        volume: 'UNAVAILABLE',
        recency: 'UNAVAILABLE',
        contest: 'UNAVAILABLE',
      },
      breakdown: {
        problemScore: 0,
        recencyFactor: 1.0,
        contestBonus: 0,
      },
      explanation: 'LeetCode problem-solving evidence is unavailable.',
    };
  }

  const easySolved = Number(leetcodeMetrics.easySolved || 0);
  const mediumSolved = Number(leetcodeMetrics.mediumSolved || 0);
  const hardSolved = Number(leetcodeMetrics.hardSolved || 0);

  // Step 1: Problem volume score (Cap: 500 weighted problems)
  const weightedProblems = easySolved * 1.0 + mediumSolved * 2.5 + hardSolved * 5.0;
  const problemScore = Math.min(100, (weightedProblems / 500) * 100);

  // Step 2: Distribution-aware recency
  const recencyLevel = leetcodeMetrics.recencyLevel ?? null;
  const temporal = evaluateTemporalEvidence(
    {
      recencyLevel,
      activeSubmitDays30d: leetcodeMetrics.activeSubmitDays30d,
      activeSubmitDays90d: leetcodeMetrics.activeSubmitDays90d,
      activeSubmitDays365d: leetcodeMetrics.activeSubmitDays365d,
      lastActivityDate: leetcodeMetrics.lastActivityDate,
    },
    evalDate,
    config
  );
  const recencyFactor = temporal.dsaRecencyFactor;
  const problemScoreAdjusted = problemScore * recencyFactor;

  let recencyCoverage = 0;
  let recencyStatus = 'UNAVAILABLE';
  if (recencyLevel === 'L1' && temporal.recencySubSignalAvailable) {
    recencyCoverage = 25.0;
    recencyStatus = 'OBTAINED';
  } else if (recencyLevel === 'L2' && temporal.recencySubSignalAvailable) {
    recencyCoverage = 12.5;
    recencyStatus = 'PARTIAL';
  } else if (recencyLevel === 'L3') {
    recencyCoverage = 0.0;
    recencyStatus = 'UNAVAILABLE';
  }

  // Step 3: Contest bonus (15% coverage weight, max 20 pts)
  let contestBonus = 0;
  let contestCoverage = 0;
  let contestStatus = 'UNAVAILABLE';

  const isContestFailed = Boolean(
    leetcodeMetrics.isPartial &&
    String(leetcodeMetrics.partialError || '').toLowerCase().includes('contest')
  );

  if (isContestFailed) {
    contestStatus = 'ERROR';
    contestCoverage = 0;
    contestBonus = 0;
  } else if (
    leetcodeMetrics.attendedContestsCount !== null &&
    leetcodeMetrics.attendedContestsCount !== undefined
  ) {
    const attended = Number(leetcodeMetrics.attendedContestsCount);
    const rating = Number(leetcodeMetrics.contestRating || 0);
    contestStatus = 'OBTAINED';
    contestCoverage = 15.0;

    if (attended > 0 && rating > 1200) {
      contestBonus = Math.min(20, ((rating - 1200) / 1600) * 20);
    } else {
      contestBonus = 0;
    }
  }

  const dimensionCoverage = Math.min(100, Math.round((60.0 + recencyCoverage + contestCoverage) * 10) / 10);
  const effectiveWeight = Number((NOMINAL_WEIGHTS.dsa * (dimensionCoverage / 100)).toFixed(4));
  const dsaScore = Math.min(100, Math.max(0, Math.round(problemScoreAdjusted + contestBonus)));

  let dimensionConfidence = 'Low';
  if (recencyLevel === 'L1' && temporal.recencySubSignalAvailable) {
    dimensionConfidence = 'High';
  } else if (recencyLevel === 'L2' && temporal.recencySubSignalAvailable) {
    dimensionConfidence = 'Medium';
  }

  const explanation = `DSA Score: ${dsaScore}/100 (Problem volume: ${Math.round(problemScore)} pts [${easySolved} easy, ${mediumSolved} medium, ${hardSolved} hard]; Recency multiplier: ${recencyFactor.toFixed(4)} [Level ${recencyLevel || 'Unknown'}]; Contest bonus: +${Math.round(contestBonus)} pts [status: ${contestStatus}]). Coverage: ${dimensionCoverage}%.`;

  return {
    key: 'dsa',
    nominalWeight: NOMINAL_WEIGHTS.dsa,
    score: dsaScore,
    dimensionCoverage,
    dimensionConfidence,
    effectiveWeight,
    recencyLevel,
    subSignalStatus: {
      volume: 'OBTAINED',
      recency: recencyStatus,
      contest: contestStatus,
    },
    breakdown: {
      easySolved,
      mediumSolved,
      hardSolved,
      problemScore: Number(problemScore.toFixed(2)),
      recencyFactor,
      problemScoreAdjusted: Number(problemScoreAdjusted.toFixed(2)),
      contestBonus: Number(contestBonus.toFixed(2)),
      contestRating: leetcodeMetrics.contestRating ?? null,
      attendedContestsCount: leetcodeMetrics.attendedContestsCount ?? null,
    },
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GitHub Activity Consistency Dimension (Key: 'engActivity', Nominal Weight: 25%)
// ─────────────────────────────────────────────────────────────────────────────
export function computeEngActivityDimension(githubMetrics = {}, calendar = null, evalDate = new Date(), config = {}) {
  const activeCalendar = calendar || githubMetrics?.calendar;
  const hasCalendar = Boolean(
    activeCalendar &&
    Array.isArray(activeCalendar.weeks) &&
    activeCalendar.weeks.length > 0 &&
    activeCalendar.syncStatus !== 'UNAVAILABLE'
  );

  if (!hasCalendar) {
    return {
      key: 'engActivity',
      nominalWeight: NOMINAL_WEIGHTS.engActivity,
      score: null,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      subSignalStatus: {
        consistency: 'UNAVAILABLE',
        streak: 'UNAVAILABLE',
        pr: 'UNAVAILABLE',
        issue: 'UNAVAILABLE',
      },
      breakdown: {
        consistencyScore: 0,
        streakScore: 0,
        prScore: 0,
        issueScore: 0,
      },
      explanation: 'GitHub contribution calendar is unavailable (primary anchor signal missing).',
    };
  }

  // Active days in last 365 days
  let activeDays = 0;
  const evalDateUtc = getUtcCalendarDay(evalDate);
  const ms365 = 365 * 24 * 60 * 60 * 1000;

  for (const week of activeCalendar.weeks) {
    if (!Array.isArray(week.contributionDays)) continue;
    for (const day of week.contributionDays) {
      const dayDate = day.date ? new Date(day.date) : null;
      if (dayDate && evalDateUtc) {
        const ageMs = evalDateUtc.getTime() - dayDate.getTime();
        if (ageMs <= ms365 && ageMs >= -86400000) {
          const count = Number(day.contributionCount || day.count || 0);
          if (count > 0) activeDays++;
        }
      } else {
        const count = Number(day.contributionCount || day.count || 0);
        if (count > 0) activeDays++;
      }
    }
  }

  if (activeDays === 0 && githubMetrics.activeDaysLast365 !== undefined && githubMetrics.activeDaysLast365 !== null) {
    activeDays = Number(githubMetrics.activeDaysLast365);
  }

  const consistencyScore = Math.min(100, (activeDays / 200) * 100);
  const longestStreak = Number(activeCalendar.longestStreak || githubMetrics.longestStreak || 0);
  const streakScore = Math.min(100, (longestStreak / 60) * 100);

  // PR Sub-signal (Weight: 25%)
  let prSearchAvailable = false;
  let prScore = 0;
  let prStatus = 'UNAVAILABLE';
  const prsError = githubMetrics.prsError;

  if (prsError) {
    prStatus = 'ERROR';
    prSearchAvailable = false;
  } else if (githubMetrics.qualifiedMergedPRsCount !== undefined && githubMetrics.qualifiedMergedPRsCount !== null) {
    prSearchAvailable = true;
    prStatus = 'OBTAINED';
    prScore = Math.min(100, Number(githubMetrics.qualifiedMergedPRsCount) * 5);
  } else if (githubMetrics.prsAndIssues?.qualifiedMergedPRs !== undefined && githubMetrics.prsAndIssues?.qualifiedMergedPRs !== null) {
    prSearchAvailable = true;
    prStatus = 'OBTAINED';
    prScore = Math.min(100, Number(githubMetrics.prsAndIssues.qualifiedMergedPRs) * 5);
  }

  // Issue Sub-signal (Weight: 10%)
  let issueSearchAvailable = false;
  let issueScore = 0;
  let issueStatus = 'UNAVAILABLE';

  if (prsError) {
    issueStatus = 'ERROR';
    issueSearchAvailable = false;
  } else if (githubMetrics.qualifiedIssuesCount !== undefined && githubMetrics.qualifiedIssuesCount !== null) {
    issueSearchAvailable = true;
    issueStatus = 'OBTAINED';
    issueScore = Math.min(100, Number(githubMetrics.qualifiedIssuesCount) * 3);
  } else if (githubMetrics.prsAndIssues?.qualifiedIssues !== undefined && githubMetrics.prsAndIssues?.qualifiedIssues !== null) {
    issueSearchAvailable = true;
    issueStatus = 'OBTAINED';
    issueScore = Math.min(100, Number(githubMetrics.prsAndIssues.qualifiedIssues) * 3);
  }

  // Inner normalization over available score weights (V13 Part 5.1.B & Part 6.3.B)
  let obtainedScoreWeight = 0.55 + 0.10; // consistency (55%) + streak (10%) obtained from calendar
  let weightedScoreSum = (consistencyScore * 0.55) + (streakScore * 0.10);

  if (prSearchAvailable) {
    obtainedScoreWeight += 0.25;
    weightedScoreSum += (prScore * 0.25);
  }
  if (issueSearchAvailable) {
    obtainedScoreWeight += 0.10;
    weightedScoreSum += (issueScore * 0.10);
  }

  const engActivityScore = Math.min(100, Math.max(0, Math.round(weightedScoreSum / obtainedScoreWeight)));
  const dimensionCoverage = Math.min(100, Math.round((obtainedScoreWeight / 1.00) * 100));
  const effectiveWeight = Number((NOMINAL_WEIGHTS.engActivity * (dimensionCoverage / 100)).toFixed(4));

  const explanation = `GitHub Consistency Score: ${engActivityScore}/100 (Active days: ${activeDays}/200 [${Math.round(consistencyScore)} pts]; Longest streak: ${longestStreak}/60 [${Math.round(streakScore)} pts]; Merged PRs: ${Math.round(prScore)} pts [status: ${prStatus}]; Issue participation: ${Math.round(issueScore)} pts [status: ${issueStatus}]). Coverage: ${dimensionCoverage}%.`;

  return {
    key: 'engActivity',
    nominalWeight: NOMINAL_WEIGHTS.engActivity,
    score: engActivityScore,
    dimensionCoverage,
    dimensionConfidence: dimensionCoverage >= 90 ? 'High' : (dimensionCoverage >= 65 ? 'Medium' : 'Low'),
    effectiveWeight,
    subSignalStatus: {
      consistency: 'OBTAINED',
      streak: 'OBTAINED',
      pr: prStatus,
      issue: issueStatus,
    },
    breakdown: {
      activeDays,
      longestStreak,
      consistencyScore: Number(consistencyScore.toFixed(2)),
      streakScore: Number(streakScore.toFixed(2)),
      prScore: Number(prScore.toFixed(2)),
      issueScore: Number(issueScore.toFixed(2)),
      obtainedScoreWeight: Number(obtainedScoreWeight.toFixed(2)),
    },
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Repository Quality Dimension (Key: 'repoQuality', Nominal Weight: 20%)
// ─────────────────────────────────────────────────────────────────────────────
export function computeRepoQualityDimension(githubMetrics = {}, evalDate = new Date(), config = {}) {
  const hasAnchor = Boolean(
    githubMetrics &&
    (githubMetrics.effectiveRepositoryCount !== undefined ||
     githubMetrics.publicRepos !== undefined ||
     githubMetrics.recentlyActiveRepos !== undefined)
  );

  if (!hasAnchor) {
    return {
      key: 'repoQuality',
      nominalWeight: NOMINAL_WEIGHTS.repoQuality,
      score: null,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      subSignalStatus: {
        presenceMaintenance: 'UNAVAILABLE',
        structure: 'UNAVAILABLE',
        community: 'UNAVAILABLE',
      },
      breakdown: {
        presenceMaintenance: 0,
        structureBonus: 0,
        communitySignal: 0,
      },
      explanation: 'GitHub repository metadata is unavailable (primary anchor signal missing).',
    };
  }

  const meaningfulRepos = Number(githubMetrics.effectiveRepositoryCount || githubMetrics.publicRepos || 0);
  const repoPresence = Math.min(15, meaningfulRepos * 3);
  const recentlyActiveRepos = Number(githubMetrics.recentlyActiveRepos ?? 0);
  const maintenanceSignal = Math.min(35, recentlyActiveRepos * 7);
  const presenceMaintenance = repoPresence + maintenanceSignal; // max 50 pts

  // Sub-signal 2: Engineering structure (max 30 pts)
  let structureBonus = 0;
  let structureSearchAvailable = true;

  if (githubMetrics.structureBonus !== undefined && githubMetrics.structureBonus !== null) {
    structureBonus = Math.min(30, Number(githubMetrics.structureBonus));
  } else {
    // Derive from topics and repo counts when detailed per-repo calls are not available
    const topicCount = Array.isArray(githubMetrics.topics) ? githubMetrics.topics.length : 0;
    structureBonus = Math.min(30, Math.min(10, topicCount * 2) + Math.min(20, meaningfulRepos * 2));
  }

  // Sub-signal 3: Community signal (max 20 pts: stars log-scale 12 pts, forks log-scale 8 pts)
  const totalStars = Number(githubMetrics.stars || 0);
  const totalForks = Number(githubMetrics.forks || 0);
  const starSignal = Math.min(12, (Math.log2(totalStars + 1) / Math.log2(200)) * 12);
  const forkSignal = Math.min(8, (Math.log2(totalForks + 1) / Math.log2(50)) * 8);
  const communitySignal = Number((starSignal + forkSignal).toFixed(2));
  const communitySearchAvailable = true;

  // Inner normalization over available score weights (V13 Part 5.1.B & Part 6.3.C)
  let repoObtainedWeight = 0.50; // presenceMaintenance obtained
  let repoWeightedSum = presenceMaintenance;

  if (structureSearchAvailable) {
    repoObtainedWeight += 0.30;
    repoWeightedSum += structureBonus;
  }
  if (communitySearchAvailable) {
    repoObtainedWeight += 0.20;
    repoWeightedSum += communitySignal;
  }

  const repoQualityScore = Math.min(100, Math.max(0, Math.round(repoWeightedSum / repoObtainedWeight)));
  const dimensionCoverage = Math.min(100, Math.round((repoObtainedWeight / 1.00) * 100));
  const effectiveWeight = Number((NOMINAL_WEIGHTS.repoQuality * (dimensionCoverage / 100)).toFixed(4));

  const explanation = `Repository Quality Score: ${repoQualityScore}/100 (Presence & maintenance: ${Math.round(presenceMaintenance)}/50 pts [${meaningfulRepos} meaningful repos, ${recentlyActiveRepos} active within 90d]; Structure: ${Math.round(structureBonus)}/30 pts; Community popularity: ${communitySignal}/20 pts [${totalStars} stars, ${totalForks} forks]. Disclaimer: popularity signals do not measure technical quality). Coverage: ${dimensionCoverage}%.`;

  return {
    key: 'repoQuality',
    nominalWeight: NOMINAL_WEIGHTS.repoQuality,
    score: repoQualityScore,
    dimensionCoverage,
    dimensionConfidence: dimensionCoverage >= 90 ? 'High' : 'Medium',
    effectiveWeight,
    subSignalStatus: {
      presenceMaintenance: 'OBTAINED',
      structure: 'OBTAINED',
      community: 'OBTAINED',
    },
    breakdown: {
      meaningfulRepos,
      recentlyActiveRepos,
      presenceMaintenance: Number(presenceMaintenance.toFixed(2)),
      structureBonus: Number(structureBonus.toFixed(2)),
      communitySignal,
      totalStars,
      totalForks,
    },
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Competitive Programming Dimension (Key: 'cp', Nominal Weight: 15%)
// ─────────────────────────────────────────────────────────────────────────────
export function computeCpDimension(codeforcesMetrics = {}, evalDate = new Date(), config = {}, platformStatus = null, handle = null) {
  const isPlatformAbsent = (
    (platformStatus === 'NOT_CONNECTED' && !handle && !codeforcesMetrics?.contestsParticipated) ||
    platformStatus === 'UNAVAILABLE' ||
    platformStatus === 'ERROR'
  );
  if (isPlatformAbsent) {
    return {
      key: 'cp',
      nominalWeight: NOMINAL_WEIGHTS.cp,
      score: null,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      subSignalStatus: {
        contest: 'UNAVAILABLE',
        recency: 'UNAVAILABLE',
      },
      breakdown: {
        contestsParticipated: null,
        rating: 0,
      },
      explanation: 'Competitive programming contest data is unavailable; excluded from scoring denominator.',
    };
  }

  const contestsCount = codeforcesMetrics?.contestsParticipated;
  const rating = Number(codeforcesMetrics?.rating || 0);

  // 1. Confirmed Zero Contests (contestsParticipated === 0):
  // Excluded from denominator (cpScore = null; benefit of doubt; no penalty)
  if (contestsCount === 0) {
    return {
      key: 'cp',
      nominalWeight: NOMINAL_WEIGHTS.cp,
      score: null,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      subSignalStatus: {
        contest: 'CONFIRMED_ZERO',
        recency: 'NOT_APPLICABLE',
      },
      breakdown: {
        contestsParticipated: 0,
        rating: 0,
      },
      explanation: 'Codeforces account has confirmed zero contest participations; excluded from scoring denominator (benefit of doubt).',
    };
  }

  // 2. Missing, Null, or Unlinked:
  // Excluded from denominator (cpScore = null; no penalty)
  if (contestsCount === null || contestsCount === undefined || rating === 0) {
    return {
      key: 'cp',
      nominalWeight: NOMINAL_WEIGHTS.cp,
      score: null,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      subSignalStatus: {
        contest: 'UNAVAILABLE',
        recency: 'UNAVAILABLE',
      },
      breakdown: {
        contestsParticipated: null,
        rating: 0,
      },
      explanation: 'Competitive programming contest data is unavailable; excluded from scoring denominator.',
    };
  }

  // 3. Active Contests (contestsParticipated > 0):
  const maxRating = Number(codeforcesMetrics.maxRating || rating);
  const cpRaw = Math.max(0, Math.min(100, ((rating - 800) / 1600) * 100));
  const maxRatingBonus = Math.max(0, Math.min(10, ((maxRating - rating) / 1600) * 10));

  const temporal = evaluateTemporalEvidence(
    {
      contestsParticipated: contestsCount,
      lastContestAt: codeforcesMetrics.lastContestAt,
    },
    evalDate,
    config
  );
  const cpRecencyFactor = temporal.cpRecencyFactor;
  const cpScore = Math.min(100, Math.max(0, Math.round((cpRaw + maxRatingBonus) * cpRecencyFactor)));

  const dimensionCoverage = temporal.cpSubSignalAvailable ? 100 : 85;
  const effectiveWeight = Number((NOMINAL_WEIGHTS.cp * (dimensionCoverage / 100)).toFixed(4));

  const explanation = `Competitive Programming Score: ${cpScore}/100 (Codeforces rating ${rating} [${Math.round(cpRaw)} pts]; Peak rating bonus: +${Math.round(maxRatingBonus)} pts; Contest recency factor: ${cpRecencyFactor.toFixed(4)} [elapsed: ${temporal.cpRecencyMonths ?? 'unverified'} months]). Coverage: ${dimensionCoverage}%.`;

  return {
    key: 'cp',
    nominalWeight: NOMINAL_WEIGHTS.cp,
    score: cpScore,
    dimensionCoverage,
    dimensionConfidence: dimensionCoverage >= 90 ? 'High' : 'Medium',
    effectiveWeight,
    subSignalStatus: {
      contest: 'OBTAINED',
      recency: temporal.cpSubSignalAvailable ? 'OBTAINED' : 'UNAVAILABLE',
    },
    breakdown: {
      rating,
      maxRating,
      contestsParticipated: contestsCount,
      cpRaw: Number(cpRaw.toFixed(2)),
      maxRatingBonus: Number(maxRatingBonus.toFixed(2)),
      cpRecencyFactor,
      cpRecencyMonths: temporal.cpRecencyMonths,
    },
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Technical Breadth Dimension (Key: 'breadth', Nominal Weight: 10%)
// ─────────────────────────────────────────────────────────────────────────────
export function computeBreadthDimension(githubMetrics = {}, evalDate = new Date(), config = {}) {
  const hasAnchor = Boolean(
    githubMetrics &&
    (githubMetrics.effectiveRepositoryCount !== undefined ||
     githubMetrics.publicRepos !== undefined)
  );

  if (!hasAnchor) {
    return {
      key: 'breadth',
      nominalWeight: NOMINAL_WEIGHTS.breadth,
      score: null,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      subSignalStatus: {
        languages: 'UNAVAILABLE',
      },
      breakdown: {
        uniqueLanguagesCount: 0,
      },
      explanation: 'GitHub repository language data is unavailable; excluded from scoring denominator.',
    };
  }

  const rawLanguages = Array.isArray(githubMetrics.topLanguages) ? githubMetrics.topLanguages : [];
  const distinctLanguages = new Set(
    rawLanguages
      .map(lang => (typeof lang === 'string' ? lang.trim() : (lang?.name ? String(lang.name).trim() : null)))
      .filter(Boolean)
      .map(l => l.toLowerCase())
  );

  const uniqueLanguagesCount = distinctLanguages.size;
  const breadthScore = Math.min(100, Math.max(0, Math.round(uniqueLanguagesCount * 12)));
  const dimensionCoverage = 100;
  const effectiveWeight = Number((NOMINAL_WEIGHTS.breadth * (dimensionCoverage / 100)).toFixed(4));

  const explanation = `Technical Breadth Score: ${breadthScore}/100 (${uniqueLanguagesCount} distinct programming languages observed across public repositories). Coverage: 100%.`;

  return {
    key: 'breadth',
    nominalWeight: NOMINAL_WEIGHTS.breadth,
    score: breadthScore,
    dimensionCoverage,
    dimensionConfidence: 'High',
    effectiveWeight,
    subSignalStatus: {
      languages: 'OBTAINED',
    },
    breakdown: {
      uniqueLanguagesCount,
      languages: Array.from(distinctLanguages),
    },
    explanation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Composite Developer Score v3 Aggregation
// ─────────────────────────────────────────────────────────────────────────────
export function calculateDeveloperScore(profile, options = {}) {
  if (!profile) {
    return {
      score: null,
      coverage: 0,
      confidence: 'Low',
      freshness: 'Stale',
      evidenceCount: 0,
      dimensions: new Map(),
      dimensionRecords: {},
      breakdown: {},
      explanations: {},
      evidenceFingerprint: null,
      snapshotHash: null,
      configSnapshotHash: null,
    };
  }

  const evalDate = options.now || new Date();
  const raw = profile.codingStats?.rawMetrics?.toObject
    ? profile.codingStats.rawMetrics.toObject()
    : (profile.codingStats?.rawMetrics || {});
  const calendar = profile.githubContributionCalendar;

  const lcHandle = profile.codingStats?.profiles?.leetcode || profile.codingStats?.leetcode || null;
  const cfHandle = profile.codingStats?.profiles?.codeforces || profile.codingStats?.codeforces || null;

  const leetcodeStatus = profile.platformSyncStates?.leetcode?.syncStatus ?? null;
  const codeforcesStatus = profile.platformSyncStates?.codeforces?.syncStatus ?? null;

  const dsaDim = computeDsaDimension(raw.leetcode, evalDate, options.config, leetcodeStatus, lcHandle);
  const engDim = computeEngActivityDimension(raw.github, calendar, evalDate, options.config);
  const repoDim = computeRepoQualityDimension(raw.github, evalDate, options.config);
  const cpDim = computeCpDimension(raw.codeforces, evalDate, options.config, codeforcesStatus, cfHandle);
  const breadthDim = computeBreadthDimension(raw.github, evalDate, options.config);

  const dimensionList = [dsaDim, engDim, repoDim, cpDim, breadthDim];
  const activeDimensions = dimensionList.filter(d => d.score !== null);

  const totalEffectiveWeight = activeDimensions.reduce((acc, d) => acc + d.effectiveWeight, 0);

  let developerScore = null;
  if (totalEffectiveWeight > 0) {
    const rawWeightedSum = activeDimensions.reduce((acc, d) => acc + (d.score * d.effectiveWeight), 0);
    developerScore = Math.min(100, Math.max(0, Math.round(rawWeightedSum / totalEffectiveWeight)));
  }

  const coverage = Math.min(100, Math.max(0, Math.round(totalEffectiveWeight * 100)));
  const freshness = computeScoreFreshness(profile, 'developer', evalDate);
  const confidence = deriveConfidence({
    coverage,
    freshness,
    recencyLevel: dsaDim.recencyLevel,
  });

  const evidenceCount = (profile.codingStats?.githubRepos || 0) +
                        (profile.codingStats?.leetcodeProblemsSolved || 0) +
                        (profile.codingStats?.codeforcesRating ? 1 : 0);

  const dimensionsMap = new Map();
  const dimensionRecords = {};
  for (const d of dimensionList) {
    dimensionsMap.set(d.key, {
      score: d.score,
      nominalWeight: d.nominalWeight,
      dimensionCoverage: d.dimensionCoverage,
      dimensionConfidence: d.dimensionConfidence,
      effectiveWeight: d.effectiveWeight,
      subSignalStatus: d.subSignalStatus,
      recencyLevel: d.recencyLevel ?? null,
      breakdown: d.breakdown,
      explanation: d.explanation,
    });
    dimensionRecords[d.key] = dimensionsMap.get(d.key);
  }

  const breakdown = {
    dsaScore: dsaDim.score,
    dsaWeight: dsaDim.effectiveWeight,
    engActivityScore: engDim.score,
    engActivityWeight: engDim.effectiveWeight,
    repoQualityScore: repoDim.score,
    repoQualityWeight: repoDim.effectiveWeight,
    cpScore: cpDim.score,
    cpWeight: cpDim.effectiveWeight,
    breadthScore: breadthDim.score,
    breadthWeight: breadthDim.effectiveWeight,
    totalEffectiveWeight: Number(totalEffectiveWeight.toFixed(4)),
  };

  const explanations = {
    overall: developerScore !== null
      ? `Developer Score: ${developerScore}/100 across ${activeDimensions.length} verified dimensions (Coverage: ${coverage}%, Confidence: ${confidence}, Freshness: ${freshness}).`
      : 'No verified developer activity observed; score evaluates to null (no penalty applied).',
    dsa: dsaDim.explanation,
    engActivity: engDim.explanation,
    repoQuality: repoDim.explanation,
    cp: cpDim.explanation,
    breadth: breadthDim.explanation,
  };

  const evidenceSnapshot = {
    easySolved: raw.leetcode?.easySolved ?? 0,
    mediumSolved: raw.leetcode?.mediumSolved ?? 0,
    hardSolved: raw.leetcode?.hardSolved ?? 0,
    activeSubmitDays30d: raw.leetcode?.activeSubmitDays30d ?? null,
    activeSubmitDays90d: raw.leetcode?.activeSubmitDays90d ?? null,
    activeSubmitDays365d: raw.leetcode?.activeSubmitDays365d ?? null,
    recencyLevel: dsaDim.recencyLevel,
    contestRating: raw.leetcode?.contestRating ?? null,
    attendedContestsCount: raw.leetcode?.attendedContestsCount ?? null,
    activeDays: engDim.breakdown?.activeDays ?? 0,
    longestStreak: engDim.breakdown?.longestStreak ?? 0,
    qualifiedMergedPRs: raw.github?.qualifiedMergedPRsCount ?? raw.github?.prsAndIssues?.qualifiedMergedPRs ?? 0,
    qualifiedIssues: raw.github?.qualifiedIssuesCount ?? raw.github?.prsAndIssues?.qualifiedIssues ?? 0,
    calendarAvailable: Boolean(calendar?.weeks?.length),
    prSearchAvailable: !raw.github?.prsError,
    issueSearchAvailable: !raw.github?.prsError,
    meaningfulRepoCount: repoDim.breakdown?.meaningfulRepos ?? 0,
    recentlyActiveRepos: repoDim.breakdown?.recentlyActiveRepos ?? 0,
    totalStars: raw.github?.stars ?? 0,
    totalForks: raw.github?.forks ?? 0,
    structureBonus: repoDim.breakdown?.structureBonus ?? 0,
    rating: raw.codeforces?.rating ?? null,
    maxRating: raw.codeforces?.maxRating ?? null,
    contestsParticipated: raw.codeforces?.contestsParticipated ?? 0,
    lastContestAt: raw.codeforces?.lastContestAt ? new Date(raw.codeforces.lastContestAt).toISOString() : null,
    uniqueLanguages: breadthDim.breakdown?.uniqueLanguagesCount ?? 0,
  };

  const snapshotHash = computeDevSnapshotHash(evidenceSnapshot, options.config || {}, evalDate);
  const configSnapshotHash = sha256(canonicalJSON({
    version: FORMULA_VERSION,
    weights: NOMINAL_WEIGHTS,
  }));
  const evidenceFingerprint = sha256(canonicalJSON(evidenceSnapshot));

  return {
    score: developerScore,
    coverage,
    confidence,
    freshness,
    evidenceCount,
    dimensions: dimensionsMap,
    dimensionRecords,
    breakdown,
    explanations,
    evidenceFingerprint,
    snapshotHash,
    configSnapshotHash,
    developerMethodologyVersion: FORMULA_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Compatibility Wrappers for Legacy Callers & Isolated Unit Tests
// ─────────────────────────────────────────────────────────────────────────────
export const calculateUnifiedScore = (profile) => {
  if (!profile) return { score: 0, breakdown: {} };

  const raw = profile.codingStats?.rawMetrics;
  const hasRawGithub = Boolean(raw?.github && (raw.github.publicRepos !== undefined || raw.github.effectiveRepositoryCount !== undefined));
  const hasRawLeetcode = Boolean(raw?.leetcode && (raw.leetcode.easySolved !== undefined || raw.leetcode.totalSolved !== undefined));

  // If full raw metrics or contribution calendar are present, execute Developer Score v3
  if ((hasRawGithub || hasRawLeetcode || profile.githubContributionCalendar?.weeks?.length) && (!profile.githubScore || hasRawGithub)) {
    const result = calculateDeveloperScore(profile);
    return {
      score: result.score ?? 0,
      breakdown: {
        ...result.breakdown,
        githubWeight: Number(((result.breakdown.engActivityWeight || 0) + (result.breakdown.repoQualityWeight || 0) + (result.breakdown.breadthWeight || 0)).toFixed(4)),
        dsaWeight: result.breakdown.dsaWeight || 0,
        cpWeight: result.breakdown.cpWeight || 0,
      },
      developerScore: result.score,
      developerResult: result,
    };
  }

  // Legacy fallback for tests that construct mock objects without raw metrics
  const githubUser = profile.codingStats?.profiles?.github;
  const leetcodeUser = profile.codingStats?.profiles?.leetcode;
  const cfUser = profile.codingStats?.profiles?.codeforces;

  const hasGithub = Boolean(String(githubUser || '').trim());
  const hasLeetcode = Boolean(String(leetcodeUser || '').trim());
  const hasCf = Boolean(String(cfUser || '').trim());

  const gScore = Number(profile.githubScore || 0);
  const dsaScore = Number(profile.dsaScore || 0);
  const cpScore = calculateCpScore(raw?.codeforces);

  let sum = 0;
  let denominator = 0;
  let githubWeightUsed = 0;
  let dsaWeightUsed = 0;
  let cpWeightUsed = 0;

  if (hasGithub) {
    sum += gScore * 0.30;
    denominator += 0.30;
    githubWeightUsed = 0.30;
  }
  if (hasLeetcode) {
    sum += dsaScore * 0.35;
    denominator += 0.35;
    dsaWeightUsed = 0.35;
  }
  if (hasCf && cpScore !== null) {
    sum += cpScore * 0.20;
    denominator += 0.20;
    cpWeightUsed = 0.20;
  }

  let finalScore = 0;
  if (denominator > 0) {
    finalScore = Math.round(sum / denominator);
  }

  return {
    score: finalScore,
    breakdown: {
      githubWeight: githubWeightUsed,
      dsaWeight: dsaWeightUsed,
      cpWeight: cpWeightUsed,
    },
  };
};

export const calculateGithubScore = (metrics) => {
  if (!metrics) return 0;
  const repoDim = computeRepoQualityDimension(metrics);
  return repoDim.score ?? 0;
};

export const calculateDsaScore = (metrics) => {
  if (!metrics) return 0;
  const dsaDim = computeDsaDimension(metrics);
  return dsaDim.score ?? 0;
};

export const calculateCpScore = (metrics) => {
  if (!metrics) return null;
  const cpDim = computeCpDimension(metrics);
  return cpDim.score;
};

// ─────────────────────────────────────────────────────────────────────────────
// Authoritative recalculateAndSaveScore with Concurrency Locking & CAS
// ─────────────────────────────────────────────────────────────────────────────
export const recalculateAndSaveScore = async (profileId, reason, options = {}) => {
  const profile = await Profile.findById(profileId);
  if (!profile) {
    throw new Error(`Profile not found for ID: ${profileId}`);
  }

  // Generate unique calculation job ID for scoring lock
  const jobId = options.jobId || `calc_${profileId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const lockAcquired = await acquireLock(profile._id, 'developer', jobId);

  if (!lockAcquired) {
    // Check if an existing lock is held by caller
    console.warn(`[recalculateAndSaveScore] Concurrent scoring lock active on profile ${profileId}`);
  }

  try {
    // Capture baseEvaluationRevision BEFORE scoring starts (Path A concurrency contract)
    const baseEvaluationRevision = options.baseEvaluationRevision ?? profile.developerScoreMeta?.evaluationRevision ?? 0;

    // Execute Authoritative Developer Score v3 Calculation
    const scoringResult = calculateDeveloperScore(profile, options);
    const { score, coverage, confidence, freshness, dimensions, breakdown, snapshotHash, configSnapshotHash, evidenceFingerprint, evidenceCount } = scoringResult;

    // Update Profile base score fields
    profile.developerScore = score;
    profile.githubScore = breakdown.engActivityScore ?? breakdown.repoQualityScore ?? 0;
    profile.dsaScore = breakdown.dsaScore ?? 0;
    profile.cpScore = breakdown.cpScore ?? 0;
    profile.scoreBreakdown = breakdown;

    profile.developerScoreVersion = score !== null ? SCORE_VERSION : null;
    profile.scoringFormulaVersion = score !== null ? FORMULA_VERSION : null;
    profile.lastScoreCalculatedAt = options.now || new Date();
    profile.lastScoreCalculationReason = String(reason || 'manual recalculation').slice(0, 150);

    // Composite calculation fingerprint
    const calculationFingerprint = computeCalculationFingerprint({
      scoreType: 'developer',
      methodologyVersion: FORMULA_VERSION,
      evidenceSnapshot: scoringResult.evidenceSnapshot,
      configSnapshot: { version: FORMULA_VERSION, weights: NOMINAL_WEIGHTS },
      platformSyncStatesAtCalc: profile.platformSyncStates,
    });

    // Milestone Event ID propagation
    let effectiveMilestoneEventId = options.milestoneEventId || options.eventId || options.deliveryId;
    if (!effectiveMilestoneEventId) {
      if (profile.developerScoreMeta?.activeMilestoneEventId) {
        effectiveMilestoneEventId = profile.developerScoreMeta.activeMilestoneEventId;
      } else {
        effectiveMilestoneEventId = `recalc_dev_${profile.userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        if (!profile.developerScoreMeta) profile.developerScoreMeta = {};
        profile.developerScoreMeta.activeMilestoneEventId = effectiveMilestoneEventId;
        await Profile.updateOne({ _id: profile._id }, {
          $set: { 'developerScoreMeta.activeMilestoneEventId': effectiveMilestoneEventId },
        });
      }
    }

    // Persist score calculation using transactional persistence and CAS
    const persistedRecord = await persistScoreCalculationWithRetry({
      profile,
      scoreType: 'developer',
      result: {
        score,
        coverage,
        confidence,
        freshness,
        dimensions,
        scoreBreakdown: breakdown,
        developerScoreVersion: score !== null ? SCORE_VERSION : null,
        developerMethodologyVersion: score !== null ? FORMULA_VERSION : null,
        recencyLevel: dimensions.get('dsa')?.recencyLevel ?? null,
        evidenceCount,
        configSnapshotHash,
        evidenceFingerprint,
        snapshotHash,
        evidenceSnapshot: scoringResult.evidenceSnapshot,
        configSnapshot: { version: FORMULA_VERSION, weights: NOMINAL_WEIGHTS },
      },
      evaluationHash: snapshotHash,
      triggerReason: reason,
      oldEvidenceHash: options.oldEvidenceHash || null,
      newEvidenceHash: options.newEvidenceHash || null,
      syncStatus: options.syncStatus || 'SUCCESS',
      connectionStatus: options.connectionStatus || 'LINKED',
      milestoneEventId: effectiveMilestoneEventId,
      sourceDataUpdatedAt: options.sourceDataUpdatedAt || null,
      baseEvaluationRevision,
      options,
    });

    // Re-fetch updated profile
    const updatedProfile = await Profile.findById(profileId);

    // Audit Log
    try {
      await AuditLog.create({
        action: 'developer_score_recalculated',
        performedBy: profile.userId,
        role: 'student',
        targetModel: 'User',
        targetId: profile.userId,
        details: {
          reason,
          developerScore: score,
          scoreBreakdown: breakdown,
          coverage,
          confidence,
          freshness,
          milestoneEventId: effectiveMilestoneEventId,
          persistedSequence: persistedRecord?.snapshotSequence ?? null,
        },
      });
    } catch (auditErr) {
      console.error('Failed to create developer_score_recalculated audit log:', auditErr.message);
    }

    return updatedProfile;
  } finally {
    await releaseLock(profile._id, 'developer', jobId).catch(() => {});
  }
};

export default {
  FORMULA_VERSION,
  SCORE_VERSION,
  DEVELOPER_METHODOLOGY_VERSION,
  DEVELOPER_SCORE_VERSION,
  NOMINAL_WEIGHTS,
  validateWeights,
  getUtcCalendarDay,
  getElapsedUtcMonths,
  evaluateTemporalEvidence,
  computeDevSnapshotHash,
  computeCalculationFingerprint,
  computeDsaDimension,
  computeEngActivityDimension,
  computeRepoQualityDimension,
  computeCpDimension,
  computeBreadthDimension,
  calculateDeveloperScore,
  calculateUnifiedScore,
  calculateGithubScore,
  calculateDsaScore,
  calculateCpScore,
  recalculateAndSaveScore,
};
