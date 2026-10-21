/**
 * placementReadinessService.js
 *
 * ScholrBoard V13 Part 7: Placement Readiness v2 Methodology.
 * Evidence-based measure of student preparedness for the actual campus placement process.
 * Explicitly distinct from Developer Score v3, with separate formula, dimensions, weights,
 * eligibility status, and metadata versioning.
 *
 * Core Invariant:
 * - Absence of evidence must NEVER be interpreted as evidence of poor performance.
 * - Missing optional platforms/dimensions are excluded from the denominator (outer normalization).
 * - Hardcoded score fallbacks (e.g. 85) are strictly prohibited.
 * - An unscored profile evaluates to score = null.
 */

import crypto from 'crypto';
import Profile from '../models/Profile.js';
import ResumeAnalysis from '../models/ResumeAnalysis.js';
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
  releaseLock,
} from './scoreHistoryService.js';
import {
  deriveEligibilityStatus,
  buildEligibilityReasons,
} from './placementEligibilityService.js';
import {
  getUtcCalendarDay,
  evaluateTemporalEvidence,
} from './developerScoringService.js';
import { computeResumeScore } from './resumeScoringService.js';

export const PLACEMENT_FORMULA_VERSION = 'v2.0.0';
export const PLACEMENT_SCORE_VERSION = 2;
export const PLACEMENT_METHODOLOGY_VERSION = 'v2.0.0';

// Nominal Dimension Weights for Placement Readiness v2 (Sum must strictly equal 1.0)
export const PLACEMENT_NOMINAL_WEIGHTS = {
  placementDsa: 0.28,
  resumeReadiness: 0.22,
  portfolio: 0.17,
  academic: 0.17,
  achievements: 0.11,
  completeness: 0.05,
};

/**
 * Validates nominal weights summing to 1.0.
 */
export function validatePlacementWeights(weights, label = 'PlacementReadiness') {
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
validatePlacementWeights(PLACEMENT_NOMINAL_WEIGHTS);

// ─────────────────────────────────────────────────────────────────────────────
// Dimension 1: Placement DSA (`placementDsa`, 28%)
// Sub-signals: volume 55%, recency 30%/15%/0%, contest 15%
// ─────────────────────────────────────────────────────────────────────────────
export function computePlacementDsaDimension(metrics = {}, evalDate = new Date(), config = {}) {
  const nominalWeight = PLACEMENT_NOMINAL_WEIGHTS.placementDsa;

  const easySolved = Math.max(0, Number(metrics.easySolved) || 0);
  const mediumSolved = Math.max(0, Number(metrics.mediumSolved) || 0);
  const hardSolved = Math.max(0, Number(metrics.hardSolved) || 0);
  const totalSolved = easySolved + mediumSolved + hardSolved;

  if (totalSolved === 0 && !metrics.recencyLevel && !metrics.lastActivityDate) {
    return {
      score: null,
      nominalWeight,
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
        problemScore: null,
        recencyFactor: null,
        contestBonus: null,
      },
      explanation: 'LeetCode problem-solving evidence is unavailable; excluded from scoring denominator.',
    };
  }

  // 1. Problem Volume (55%)
  const easyW = config.placementDsaEasyWeight ?? 0.5;
  const mediumW = config.placementDsaMediumWeight ?? 3.0;
  const hardW = config.placementDsaHardWeight ?? 6.0;
  const cap = config.placementDsaCap ?? 400;

  const weightedProblems = easySolved * easyW + mediumSolved * mediumW + hardSolved * hardW;
  const problemScore = Math.min(100.0, (weightedProblems / cap) * 100.0);

  // 2. Recency (30% L1 / 15% L2 / 0% L3)
  const floor = config.placementDsaRecencyFloor ?? 0.25;
  const l2Cap = config.l2RecencyCap ?? 50;
  const recencyLevel = metrics.recencyLevel ?? (metrics.lastActivityDate ? 'L2' : 'L3');

  let recencyFactor = 1.0000;
  let recencySubSignalWeight = 0;
  let recencyStatus = 'RECENCY_UNAVAILABLE';
  let recentScoreCalculated = null;

  if (recencyLevel === 'L1') {
    const w30 = metrics.activeSubmitDays30d;
    const w90 = metrics.activeSubmitDays90d;
    const w365 = metrics.activeSubmitDays365d;

    const hasValidWindows = (
      typeof w30 === 'number' && Number.isFinite(w30) && w30 >= 0 &&
      typeof w90 === 'number' && Number.isFinite(w90) && w90 >= 0 &&
      typeof w365 === 'number' && Number.isFinite(w365) && w365 >= 0
    );

    if (hasValidWindows) {
      const ceil30 = config.placementDsaActiveDayCeilings?.d30 ?? 20;
      const ceil90 = config.placementDsaActiveDayCeilings?.d90 ?? 50;
      const ceil365 = config.placementDsaActiveDayCeilings?.d365 ?? 150;

      const r30 = Math.min(1.0, w30 / ceil30);
      const r90 = Math.min(1.0, w90 / ceil90);
      const r365 = Math.min(1.0, w365 / ceil365);

      const recentScore = (r30 * 0.50 + r90 * 0.30 + r365 * 0.20) * 100.0;
      recentScoreCalculated = recentScore;
      recencyFactor = Number((floor + (1.0 - floor) * (recentScore / 100.0)).toFixed(4));
      recencySubSignalWeight = 30; // 30% coverage
      recencyStatus = 'OBTAINED';
    } else {
      recencyFactor = 1.0000; // Neutral multiplier; volume preserved without penalty
      recencySubSignalWeight = 0;
      recencyStatus = 'TEMPORAL_UNAVAILABLE';
    }
  } else if (recencyLevel === 'L2') {
    const evalDateUtc = getUtcCalendarDay(evalDate);
    const lastActivityUtc = getUtcCalendarDay(metrics.lastActivityDate);

    if (lastActivityUtc && evalDateUtc && lastActivityUtc <= evalDateUtc) {
      const elapsedDays = Math.max(0, Math.floor((evalDateUtc.getTime() - lastActivityUtc.getTime()) / 86400000));
      const clampedDays = Math.min(elapsedDays, 730);
      const decayFactor = Math.max(0, 1 - clampedDays / 730.0);
      // Per V13 line 1297: 0.9986 * 50 = 49.93 ≈ 50 (capped at L2_RECENCY_CAP = 50)
      const recentScoreL2 = clampedDays <= 1 ? l2Cap : Number((decayFactor * l2Cap).toFixed(2));
      recentScoreCalculated = recentScoreL2;
      recencyFactor = Number((floor + (1.0 - floor) * (recentScoreL2 / 100.0)).toFixed(4));
      recencySubSignalWeight = 15; // 15% coverage
      recencyStatus = 'OBTAINED';
    } else {
      recencyFactor = floor; // Neutral floor
      recencySubSignalWeight = 0;
      recencyStatus = 'TEMPORAL_UNAVAILABLE';
    }
  } else {
    // Level 3: missing recency evidence -> neutral factor 1.0000
    recencyFactor = 1.0000;
    recencySubSignalWeight = 0;
    recencyStatus = 'RECENCY_UNAVAILABLE';
  }

  const placementProblemScore = problemScore * recencyFactor;

  // 3. Contest Sub-Signal (15%)
  let contestBonus = 0;
  let contestSubSignalWeight = 0;
  let contestStatus = 'UNAVAILABLE';

  const attendedContests = metrics.attendedContestsCount;
  const rating = metrics.contestRating ?? metrics.rating;
  const hasContestEvidence = (typeof attendedContests === 'number' || typeof rating === 'number');

  if (!hasContestEvidence || metrics.contestStatus === 'UNAVAILABLE' || metrics.contestStatus === 'ERROR' || metrics.contestStatus === 'RATE_LIMITED') {
    contestStatus = metrics.contestStatus || 'UNAVAILABLE';
    contestSubSignalWeight = 0;
    contestBonus = 0;
  } else if (attendedContests === 0 || (typeof rating === 'number' && rating <= 1200)) {
    contestStatus = 'OBTAINED';
    contestSubSignalWeight = 15;
    contestBonus = 0;
  } else if (typeof rating === 'number' && rating > 1200) {
    contestStatus = 'OBTAINED';
    contestSubSignalWeight = 15;
    contestBonus = Math.min(25.0, ((rating - 1200.0) / 1600.0) * 25.0);
  } else {
    contestStatus = 'UNAVAILABLE';
    contestSubSignalWeight = 0;
  }

  const rawPlacementDsaScore = Math.min(100.0, placementProblemScore + contestBonus);
  const score = Math.round(rawPlacementDsaScore);

  const dimensionCoverage = 55 + recencySubSignalWeight + contestSubSignalWeight;
  const dimensionConfidence = dimensionCoverage >= 80 && recencyLevel === 'L1'
    ? 'High'
    : (recencyLevel === 'L2' || dimensionCoverage >= 60 ? 'Medium' : 'Low');

  return {
    score,
    nominalWeight,
    dimensionCoverage,
    dimensionConfidence,
    effectiveWeight: Number((nominalWeight * (dimensionCoverage / 100.0)).toFixed(4)),
    recencyLevel,
    subSignalStatus: {
      volume: 'OBTAINED',
      recency: recencyStatus,
      contest: contestStatus,
    },
    breakdown: {
      weightedProblems,
      problemScore: Math.round(problemScore),
      recencyFactor,
      recentScore: recentScoreCalculated !== null ? Number(recentScoreCalculated.toFixed(2)) : null,
      contestBonus: Number(contestBonus.toFixed(2)),
    },
    explanation: `Placement DSA Score: ${score}/100 (Problem volume: ${Math.round(problemScore)}/100, Recency factor: ${recencyFactor}, Contest bonus: +${Math.round(contestBonus)}). Coverage: ${dimensionCoverage}%.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dimension 2: Resume Readiness (`resumeReadiness`, 22%)
// ─────────────────────────────────────────────────────────────────────────────
export function computeResumeReadinessDimension(analysis = null, profile = {}, evalDate = new Date()) {
  const nominalWeight = PLACEMENT_NOMINAL_WEIGHTS.resumeReadiness;

  if (!analysis || analysis.analysisStatus !== 'completed') {
    return {
      score: null,
      nominalWeight,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      breakdown: null,
      explanation: 'Resume analysis is unavailable; excluded from scoring denominator without penalty.',
    };
  }

  const res = computeResumeScore(analysis, {
    careerTrack: profile.careerTrack || analysis.careerTrackAtAnalysis || null,
    evalDate,
    analysisTimestamp: analysis.createdAt || analysis.analysisTimestamp,
  });

  return {
    score: res.score,
    nominalWeight,
    dimensionCoverage: res.dimensionCoverage,
    dimensionConfidence: res.dimensionConfidence,
    effectiveWeight: Number((nominalWeight * (res.dimensionCoverage / 100.0)).toFixed(4)),
    breakdown: res.breakdown,
    explanation: `Resume Readiness Score: ${res.score}/100 (Sections: ${res.breakdown.sectionScore}/30, Exp: ${Math.round(res.breakdown.experienceScore)}/25, Skills: ${Math.round(res.breakdown.skillScore)}/20, Quality: ${res.breakdown.genericQualityScore}/10, Projects: ${res.breakdown.projectScore}/10, Age multiplier: ${res.breakdown.resumeAgeMultiplier}). Coverage: ${res.dimensionCoverage}%.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dimension 3: Development Portfolio (`portfolio`, 17%)
// ─────────────────────────────────────────────────────────────────────────────
export function computePortfolioDimension(profile = {}) {
  const nominalWeight = PLACEMENT_NOMINAL_WEIGHTS.portfolio;

  const rawProjects = profile.projects || [];
  const githubReposCount = profile.codingStats?.githubRepos || profile.codingStats?.rawMetrics?.github?.effectiveRepositoryCount || 0;
  const approvedInternships = (profile.experience || []).filter(e => e.type === 'internship' && e.verified).length;
  const approvedHackathons = (profile.achievements || []).filter(a => a.category === 'hackathon' && a.verified).length;
  const approvedOpenSourceContributions = (profile.achievements || []).filter(a => a.category === 'open_source' && a.verified).length;

  const hasAnyEvidence = (rawProjects.length > 0 || githubReposCount > 0 || approvedInternships > 0 || approvedHackathons > 0 || approvedOpenSourceContributions > 0);
  if (!hasAnyEvidence) {
    return {
      score: null,
      nominalWeight,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      breakdown: null,
      explanation: 'Portfolio evidence unavailable; excluded from scoring denominator without penalty.',
    };
  }

  // Deduplicate projects against GitHub repos
  const deduplicatedProjectCount = Math.max(rawProjects.length, Math.min(rawProjects.length + githubReposCount, 10));
  const projectEvidence = Math.min(25, deduplicatedProjectCount * 5);
  const internshipEvidence = Math.min(40, approvedInternships * 20);
  const hackathonEvidence = Math.min(20, approvedHackathons * 10);
  const openSourceEvidence = Math.min(15, approvedOpenSourceContributions * 5);

  const rawScore = projectEvidence + internshipEvidence + hackathonEvidence + openSourceEvidence;
  const score = Math.min(100, Math.round(rawScore));

  return {
    score,
    nominalWeight,
    dimensionCoverage: 100,
    dimensionConfidence: 'High',
    effectiveWeight: nominalWeight,
    breakdown: {
      projectEvidence,
      internshipEvidence,
      hackathonEvidence,
      openSourceEvidence,
    },
    explanation: `Development Portfolio Score: ${score}/100 (Projects: ${projectEvidence}/25, Internships: ${internshipEvidence}/40, Hackathons: ${hackathonEvidence}/20, Open Source: ${openSourceEvidence}/15). Coverage: 100%.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dimension 4: Academic Performance (`academic`, 17%)
// ─────────────────────────────────────────────────────────────────────────────
export function computeAcademicDimension(profile = {}) {
  const nominalWeight = PLACEMENT_NOMINAL_WEIGHTS.academic;

  const gpa = profile.gpa;
  const gpaScale = profile.gpaScale;

  if (gpa == null || gpaScale == null || typeof gpaScale !== 'number' || gpaScale <= 0) {
    return {
      score: null,
      nominalWeight,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      breakdown: null,
      explanation: 'Academic GPA or GPA scale is unconfigured; excluded from scoring denominator without penalty.',
    };
  }

  const rawScore = Math.min(100.0, Math.max(0, (gpa / gpaScale) * 100.0));
  const score = Math.round(rawScore);

  return {
    score,
    nominalWeight,
    dimensionCoverage: 100,
    dimensionConfidence: 'High',
    effectiveWeight: nominalWeight,
    breakdown: { gpa, gpaScale },
    explanation: `Academic Performance Score: ${score}/100 (GPA: ${gpa} on ${gpaScale} scale). Coverage: 100%.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dimension 5: Verified Achievements (`achievements`, 11%)
// ─────────────────────────────────────────────────────────────────────────────
export function computeAchievementsDimension(profile = {}, config = {}) {
  const nominalWeight = PLACEMENT_NOMINAL_WEIGHTS.achievements;
  const ceiling = config.achievementCeiling ?? 1000;

  const points = Math.max(0, Number(profile.achievementPoints) || 0);
  const hasAchievementsList = Array.isArray(profile.achievements) && profile.achievements.length > 0;

  if (profile.achievementPoints == null || (points === 0 && !hasAchievementsList)) {
    return {
      score: null,
      nominalWeight,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      breakdown: null,
      explanation: 'Achievement evidence unavailable; excluded from scoring denominator without penalty.',
    };
  }

  const rawScore = Math.min(100.0, (points / ceiling) * 100.0);
  const score = Math.round(rawScore);

  return {
    score,
    nominalWeight,
    dimensionCoverage: 100,
    dimensionConfidence: 'High',
    effectiveWeight: nominalWeight,
    breakdown: { achievementPoints: points, ceiling },
    explanation: `Verified Achievements Score: ${score}/100 (${points} points against ceiling ${ceiling}). Coverage: 100%.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dimension 6: Profile Completeness (`completeness`, 5%)
// ─────────────────────────────────────────────────────────────────────────────
export function computeCompletenessDimension(profile = {}) {
  const nominalWeight = PLACEMENT_NOMINAL_WEIGHTS.completeness;

  const checks = [
    { key: 'bio', met: Boolean(profile.bio && profile.bio.trim().length >= 50), weight: 1 },
    { key: 'skills', met: Boolean(Array.isArray(profile.skills) && profile.skills.length >= 3), weight: 2 },
    { key: 'projects', met: Boolean(Array.isArray(profile.projects) && profile.projects.length >= 1), weight: 2 },
    { key: 'education', met: Boolean(Array.isArray(profile.education) && profile.education.length >= 1), weight: 2 },
    { key: 'resume', met: Boolean(profile.resumeUrl), weight: 2 },
    { key: 'career', met: Boolean(profile.careerGoal && profile.careerGoal.trim().length > 0), weight: 1 },
  ];

  const metWeight = checks.reduce((acc, c) => acc + (c.met ? c.weight : 0), 0);
  if (metWeight === 0) {
    return {
      score: null,
      nominalWeight,
      dimensionCoverage: 0,
      dimensionConfidence: 'Low',
      effectiveWeight: 0,
      breakdown: null,
      explanation: 'Profile completeness criteria uninitialized; excluded from scoring denominator.',
    };
  }

  const score = Math.round((metWeight / 10.0) * 100.0);

  return {
    score,
    nominalWeight,
    dimensionCoverage: 100,
    dimensionConfidence: 'High',
    effectiveWeight: nominalWeight,
    breakdown: {
      checksMet: checks.filter(c => c.met).map(c => c.key),
      totalScore: score,
    },
    explanation: `Profile Completeness Score: ${score}/100 (${metWeight}/10 criteria met). Coverage: 100%.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Authoritative Placement Readiness v2 Composite Calculation
// ─────────────────────────────────────────────────────────────────────────────
export function calculatePlacementScore(profile, options = {}) {
  const evalDate = options.now || new Date();
  const config = options.config || {};

  // Extract dimensions
  const dsaDim = computePlacementDsaDimension(profile.codingStats?.rawMetrics?.leetcode, evalDate, config);
  const resumeDim = computeResumeReadinessDimension(options.resumeAnalysis || profile.resumeAnalysis, profile, evalDate);
  const portfolioDim = computePortfolioDimension(profile);
  const academicDim = computeAcademicDimension(profile);
  const achievementsDim = computeAchievementsDimension(profile, config);
  const completenessDim = computeCompletenessDimension(profile);

  const dimensions = new Map([
    ['placementDsa', dsaDim],
    ['resumeReadiness', resumeDim],
    ['portfolio', portfolioDim],
    ['academic', academicDim],
    ['achievements', achievementsDim],
    ['completeness', completenessDim],
  ]);

  // Eligibility Status Derivation
  const activeRuleSet = options.activeRuleSet || {
    ruleSetId: 'CAMPUS_DEFAULT_2026',
    requiredRuleIds: ['cgpa_min', 'no_backlogs'],
  };
  const eligibilityConditions = options.eligibilityConditions || profile.placementReadinessMeta?.eligibilityStatus?.conditions || [];
  const eligibilityStatusString = deriveEligibilityStatus(eligibilityConditions, activeRuleSet);
  const eligibilityReasons = buildEligibilityReasons(eligibilityConditions, eligibilityStatusString, activeRuleSet);

  const eligibilitySnapshot = {
    status: eligibilityStatusString,
    isEligible: eligibilityStatusString === 'ELIGIBLE',
    reasons: eligibilityReasons,
    conditions: eligibilityConditions,
    ruleSetId: activeRuleSet?.ruleSetId || null,
    ruleSetVersion: activeRuleSet?.version || null,
    evaluatedAt: evalDate,
    notes: null,
  };

  // Outer Normalization over available applicable weights
  let totalEffectiveWeight = 0;
  let weightedSum = 0;
  let availableDimensionsCount = 0;

  for (const [key, dim] of dimensions.entries()) {
    if (dim.score !== null) {
      availableDimensionsCount++;
      totalEffectiveWeight += dim.effectiveWeight;
      weightedSum += dim.score * dim.effectiveWeight;
    }
  }

  // If no eligible evidence exists
  if (totalEffectiveWeight === 0 || availableDimensionsCount === 0) {
    return {
      score: null,
      coverage: 0,
      confidence: 'Low',
      freshness: 'Fresh',
      dimensions,
      dimensionRecords: Object.fromEntries(dimensions),
      eligibilitySnapshot,
      explanations: {
        overall: 'Placement Readiness evaluates to null: insufficient verified evidence available.',
      },
      evidenceSnapshot: {},
      configSnapshotHash: sha256(canonicalJSON({ version: PLACEMENT_FORMULA_VERSION, weights: PLACEMENT_NOMINAL_WEIGHTS })),
      snapshotHash: sha256(canonicalJSON({ score: null, coverage: 0 })),
      placementMethodologyVersion: PLACEMENT_FORMULA_VERSION,
    };
  }

  const rawScore = weightedSum / totalEffectiveWeight;
  const score = Math.round(rawScore);
  const coverage = Math.min(100, Math.round((totalEffectiveWeight / 1.00) * 100.0));

  const freshness = computeScoreFreshness(profile, 'placement_readiness', evalDate);
  const confidence = deriveConfidence({
    coverage,
    freshness,
    recencyLevel: dsaDim.recencyLevel,
  });

  const evidenceSnapshot = {
    easySolved: profile.codingStats?.rawMetrics?.leetcode?.easySolved,
    mediumSolved: profile.codingStats?.rawMetrics?.leetcode?.mediumSolved,
    hardSolved: profile.codingStats?.rawMetrics?.leetcode?.hardSolved,
    recencyLevel: dsaDim.recencyLevel,
    activeSubmitDays30d: profile.codingStats?.rawMetrics?.leetcode?.activeSubmitDays30d,
    activeSubmitDays90d: profile.codingStats?.rawMetrics?.leetcode?.activeSubmitDays90d,
    activeSubmitDays365d: profile.codingStats?.rawMetrics?.leetcode?.activeSubmitDays365d,
    gpa: profile.gpa,
    gpaScale: profile.gpaScale,
    achievementPoints: profile.achievementPoints,
    resumeAnalysisId: options.resumeAnalysis?._id?.toString() || null,
  };

  const snapshotHash = computePlacementSnapshotHash(
    {
      ...evidenceSnapshot,
      eligibilityConditions,
      eligibilityRuleSetId: activeRuleSet?.ruleSetId,
    },
    {
      placementVersion: PLACEMENT_FORMULA_VERSION,
      weights: PLACEMENT_NOMINAL_WEIGHTS,
    },
    evalDate
  );

  return {
    score,
    coverage,
    confidence,
    freshness,
    dimensions,
    dimensionRecords: Object.fromEntries(dimensions),
    eligibilitySnapshot,
    snapshotHash,
    configSnapshotHash: sha256(canonicalJSON({ version: PLACEMENT_FORMULA_VERSION, weights: PLACEMENT_NOMINAL_WEIGHTS })),
    evidenceSnapshot,
    placementMethodologyVersion: PLACEMENT_FORMULA_VERSION,
    explanations: {
      overall: `Placement Readiness: ${score}/100 across ${availableDimensionsCount} verified dimensions (Coverage: ${coverage}%, Confidence: ${confidence}, Freshness: ${freshness}).`,
      placementDsa: dsaDim.explanation,
      resumeReadiness: resumeDim.explanation,
      portfolio: portfolioDim.explanation,
      academic: academicDim.explanation,
      achievements: achievementsDim.explanation,
      completeness: completenessDim.explanation,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Placement Snapshot Hash (V13 Part 17.1)
// ─────────────────────────────────────────────────────────────────────────────
export function computePlacementSnapshotHash(evidence = {}, config = {}, evalDate = new Date()) {
  const temporal = evaluateTemporalEvidence(evidence, evalDate, config);

  const canonical = {
    scoreType: 'placement_readiness',
    evidence: {
      placementDsa: {
        easySolved: evidence.easySolved ?? null,
        mediumSolved: evidence.mediumSolved ?? null,
        hardSolved: evidence.hardSolved ?? null,
        activeSubmitDays30d: evidence.activeSubmitDays30d ?? null,
        activeSubmitDays90d: evidence.activeSubmitDays90d ?? null,
        activeSubmitDays365d: evidence.activeSubmitDays365d ?? null,
        recencyLevel: evidence.recencyLevel ?? null,
        l2DecayFactor: evidence.recencyLevel === 'L2' ? temporal.l2DecayFactor : null,
        recencyFactor: temporal.placementRecencyFactor,
        contestRating: evidence.contestRating ?? null,
        attendedContestsCount: evidence.attendedContestsCount ?? null,
      },
      resume: {
        analysisId: evidence.resumeAnalysisId?.toString() ?? null,
        evidenceSchemaVersion: evidence.evidenceSchemaVersion ?? null,
        promptVersion: evidence.resumePromptVersion ?? null,
        extractedEvidenceHash: evidence.extractedEvidenceHash ?? null,
        careerTrack: evidence.careerTrack ?? null,
        ageBand: temporal.resumeAgeBand ?? 'BAND_UNAVAILABLE',
        ageMultiplier: temporal.resumeAgeMultiplier ?? 1.00,
      },
      portfolio: {
        deduplicatedProjectCount: evidence.deduplicatedProjectCount ?? null,
        approvedInternships: evidence.approvedInternships ?? 0,
        approvedHackathons: evidence.approvedHackathons ?? 0,
        approvedOpenSourceContribs: evidence.approvedOpenSourceContribs ?? 0,
      },
      academic: {
        gpa: evidence.gpa ?? null,
        gpaScale: evidence.gpaScale ?? null,
      },
      achievements: {
        achievementPoints: evidence.achievementPoints ?? 0,
      },
      completeness: {
        checksHash: evidence.completenessChecksHash ?? null,
      },
      eligibility: {
        conditions: (evidence.eligibilityConditions || []).map(c => ({
          ruleId: c.ruleId,
          met: c.met,
          data: c.data,
        })),
        ruleSetId: evidence.eligibilityRuleSetId ?? null,
      },
    },
    config: {
      version: config.placementVersion || PLACEMENT_FORMULA_VERSION,
      weights: config.weights || PLACEMENT_NOMINAL_WEIGHTS,
    },
  };

  return sha256(canonicalJSON(canonical));
}

// ─────────────────────────────────────────────────────────────────────────────
// Transactional Recalculate and Save Placement Score
// ─────────────────────────────────────────────────────────────────────────────
export async function recalculateAndSavePlacementScore(profileId, reason = 'placement recalculation', options = {}) {
  const profile = await Profile.findById(profileId);
  if (!profile) {
    throw new Error(`Profile not found for ID: ${profileId}`);
  }

  const jobId = options.jobId || `calc_place_${profileId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const lockAcquired = await acquireLock(profile._id, 'placementReadiness', jobId);

  if (!lockAcquired) {
    console.warn(`[recalculateAndSavePlacementScore] Concurrent placement scoring lock active on profile ${profileId}`);
  }

  try {
    const baseEvaluationRevision = options.baseEvaluationRevision ?? profile.placementReadinessMeta?.evaluationRevision ?? 0;

    // Load active resume analysis if available
    let resumeAnalysis = options.resumeAnalysis;
    if (!resumeAnalysis && profile.userId) {
      resumeAnalysis = await ResumeAnalysis.findOne({ userId: profile.userId, isCurrent: true });
    }

    const scoringResult = calculatePlacementScore(profile, { ...options, resumeAnalysis });
    const { score, coverage, confidence, freshness, dimensions, snapshotHash, configSnapshotHash, eligibilitySnapshot } = scoringResult;

    // Update in-memory profile fields
    profile.placementReadinessScore = score;
    if (!profile.placementReadinessMeta) profile.placementReadinessMeta = {};
    profile.placementReadinessMeta.score = score;
    profile.placementReadinessMeta.coverage = coverage;
    profile.placementReadinessMeta.confidence = confidence;
    profile.placementReadinessMeta.freshness = freshness;
    profile.placementReadinessMeta.placementMethodologyVersion = score !== null ? PLACEMENT_FORMULA_VERSION : null;
    profile.placementReadinessMeta.calculatedAt = options.now || new Date();
    profile.placementReadinessMeta.dimensions = dimensions;
    profile.placementReadinessMeta.eligibilityStatus = eligibilitySnapshot;

    let effectiveMilestoneEventId = options.milestoneEventId || options.eventId || options.deliveryId;
    if (!effectiveMilestoneEventId) {
      effectiveMilestoneEventId = `recalc_place_${profile.userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    const persistedRecord = await persistScoreCalculationWithRetry({
      profile,
      scoreType: 'placement_readiness',
      result: {
        score,
        coverage,
        confidence,
        freshness,
        dimensions,
        placementMethodologyVersion: score !== null ? PLACEMENT_FORMULA_VERSION : null,
        eligibilitySnapshot,
        configSnapshotHash,
        snapshotHash,
        evidenceSnapshot: scoringResult.evidenceSnapshot,
        configSnapshot: { version: PLACEMENT_FORMULA_VERSION, weights: PLACEMENT_NOMINAL_WEIGHTS },
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

    const updatedProfile = await Profile.findById(profileId);

    // Audit log
    try {
      await AuditLog.create({
        action: 'placement_readiness_recalculated',
        performedBy: profile.userId,
        role: 'student',
        targetModel: 'User',
        targetId: profile.userId,
        details: {
          reason,
          placementReadinessScore: score,
          coverage,
          confidence,
          freshness,
          eligibilityStatus: eligibilitySnapshot?.status,
          milestoneEventId: effectiveMilestoneEventId,
          persistedSequence: persistedRecord?.snapshotSequence ?? null,
        },
      });
    } catch (auditErr) {
      console.error('Failed to create placement_readiness_recalculated audit log:', auditErr.message);
    }

    return updatedProfile;
  } finally {
    await releaseLock(profile._id, 'placementReadiness', jobId).catch(() => {});
  }
}

export default {
  PLACEMENT_FORMULA_VERSION,
  PLACEMENT_SCORE_VERSION,
  PLACEMENT_METHODOLOGY_VERSION,
  PLACEMENT_NOMINAL_WEIGHTS,
  validatePlacementWeights,
  computePlacementDsaDimension,
  computeResumeReadinessDimension,
  computePortfolioDimension,
  computeAcademicDimension,
  computeAchievementsDimension,
  computeCompletenessDimension,
  calculatePlacementScore,
  computePlacementSnapshotHash,
  recalculateAndSavePlacementScore,
};
