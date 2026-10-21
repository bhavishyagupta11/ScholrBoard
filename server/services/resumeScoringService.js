/**
 * resumeScoringService.js — ScholrBoard V13 Phase 8
 *
 * Deterministic Resume Scoring Engine and Evidence Schema Validation.
 * Adheres strictly to authoritative V13 Section 7.4, Part 14, and Part 15:
 *   1. Deterministic scoring: section completeness (30), experience (25), skills (20),
 *      generic quality (10), projects (10), role alignment (5).
 *   2. When careerTrack is absent: role alignment is NOT_APPLICABLE and normalized
 *      over applicable 95 points.
 *   3. UNVERIFIED confidence or null boolean fields are excluded from scoring without penalty.
 *   4. Discrete UTC calendar-day age decay bands:
 *      BAND_0_FRESH (<= 180d, 1.00x), BAND_1_AGING (181-365d, 0.90x), BAND_2_EXPIRED (> 365d, 0.80x),
 *      BAND_UNAVAILABLE (missing/invalid date, 1.00x neutral, 90% coverage).
 *   5. Robust schema validator for AI-extracted structured evidence.
 */

import { getUtcCalendarDay } from './developerScoringService.js';
import { canonicalJSON, sha256 } from './scorePersistence.js';

export const RESUME_EVIDENCE_SCHEMA_VERSION = 'v1.0.0';
export const RESUME_SCORING_VERSION = 'v2.0.0';
export const RESUME_PROMPT_VERSION = 'v1.0.0';

/**
 * Validates the structured evidence extracted from a resume against the V13 schema.
 *
 * @param {object} evidence - Structured evidence object
 * @returns {{ isValid: boolean, reason: string|null }}
 */
export function validateResumeEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') {
    return { isValid: false, reason: 'Evidence must be a non-null object' };
  }

  // Must contain core sections object
  if (!evidence.sections || typeof evidence.sections !== 'object') {
    return { isValid: false, reason: 'Missing or invalid "sections" object in evidence' };
  }

  // Experience and projects must be arrays
  if (!Array.isArray(evidence.experience)) {
    return { isValid: false, reason: 'Evidence "experience" must be an array' };
  }

  if (!Array.isArray(evidence.technicalSkills)) {
    return { isValid: false, reason: 'Evidence "technicalSkills" must be an array' };
  }

  if (!Array.isArray(evidence.projects)) {
    return { isValid: false, reason: 'Evidence "projects" must be an array' };
  }

  if (!evidence.qualitySignals || typeof evidence.qualitySignals !== 'object') {
    return { isValid: false, reason: 'Missing or invalid "qualitySignals" object in evidence' };
  }

  return { isValid: true, reason: null };
}

/**
 * Computes deterministic Resume Readiness score from structured evidence and options.
 *
 * @param {object} evidence - Structured evidence
 * @param {object} [options={}] - Options (careerTrack, evalDate, analysisTimestamp, createdAt)
 * @returns {object} Calculated score, dimensions, age multiplier, coverage, and breakdown
 */
export function computeResumeScore(evidence = {}, options = {}) {
  const sections = evidence.sections || {};
  const fieldConfidence = evidence.fieldConfidence || {};

  // 1. Section completeness (max 30 pts — always applicable)
  let sectionScore = 0;
  if (fieldConfidence.sections !== 'UNVERIFIED') {
    if (sections.hasSummary === true) sectionScore += 5;
    if (sections.hasEducation === true) sectionScore += 5;
    if (sections.hasExperience === true) sectionScore += 5;
    if (sections.hasProjects === true) sectionScore += 5;
    if (sections.hasSkills === true) sectionScore += 5;
    if (sections.hasContactInfo === true) sectionScore += 5;
  }

  // 2. Experience (max 25 pts — always applicable)
  let experienceScore = 0;
  if (fieldConfidence.experience !== 'UNVERIFIED') {
    const experiences = Array.isArray(evidence.experience) ? evidence.experience : [];
    const technicalMonths = experiences
      .filter((exp) => exp && (exp.isTechnical === true || exp.isTechnical == null))
      .reduce((acc, exp) => acc + (Number(exp.durationMonths) || 0), 0);
    experienceScore = Math.min(25, technicalMonths / 3.0);
  }

  // 3. Technical skills (max 20 pts — always applicable)
  let skillScore = 0;
  if (fieldConfidence.technicalSkills !== 'UNVERIFIED') {
    const skills = Array.isArray(evidence.technicalSkills) ? evidence.technicalSkills : [];
    skillScore = Math.min(20, skills.length * 2.0);
  }

  // 4. Generic quality signals (max 10 pts — always applicable)
  let genericQualityScore = 0;
  if (fieldConfidence.qualitySignals !== 'UNVERIFIED') {
    const quality = evidence.qualitySignals || {};
    if (quality.hasQuantifiedItems === true) genericQualityScore += 5;
    if (quality.hasActionVerbs === true) genericQualityScore += 5;
  }

  // 5. Project evidence (max 10 pts — always applicable)
  let projectScore = 0;
  if (fieldConfidence.projects !== 'UNVERIFIED') {
    const projects = Array.isArray(evidence.projects) ? evidence.projects : [];
    projectScore = Math.min(10, projects.length * 2.0);
  }

  // 6. Role alignment (max 5 pts — ONLY when careerTrack is configured)
  const careerTrack = options.careerTrack || evidence.careerTrackAtAnalysis || null;
  let roleAlignmentScore = 0;
  let roleAlignmentApplicable = false;
  let applicableMax = 95.0;

  if (careerTrack && evidence.keywordAlignment != null) {
    roleAlignmentScore = Math.min(5, Number(evidence.keywordAlignment) * 10.0);
    roleAlignmentApplicable = true;
    applicableMax = 100.0;
  }

  const rawApplicable =
    sectionScore +
    experienceScore +
    skillScore +
    genericQualityScore +
    projectScore +
    roleAlignmentScore;

  const normalizedResumeScore = (rawApplicable / applicableMax) * 100.0;

  // 7. Recency decay with UTC discrete calendar age bands (V13 Part 7.4)
  const evalDate = options.evalDate || new Date();
  const evalDateUtc = getUtcCalendarDay(evalDate);
  const rawTimestamp = options.analysisTimestamp ?? options.createdAt ?? evidence.analysisTimestamp ?? null;
  const analysisCreatedAtUtc = rawTimestamp ? getUtcCalendarDay(rawTimestamp) : null;
  const isResumeDateValid = Boolean(analysisCreatedAtUtc && evalDateUtc && analysisCreatedAtUtc <= evalDateUtc);
  const resumeAgeInDays = isResumeDateValid
    ? Math.max(0, Math.floor((evalDateUtc.getTime() - analysisCreatedAtUtc.getTime()) / 86400000))
    : null;

  let resumeAgeBand = 'BAND_0_FRESH';
  let resumeAgeMultiplier = 1.00;

  if (!isResumeDateValid) {
    resumeAgeBand = 'BAND_UNAVAILABLE';
    resumeAgeMultiplier = 1.00;
  } else if (resumeAgeInDays > 365) {
    resumeAgeBand = 'BAND_2_EXPIRED';
    resumeAgeMultiplier = 0.80;
  } else if (resumeAgeInDays > 180) {
    resumeAgeBand = 'BAND_1_AGING';
    resumeAgeMultiplier = 0.90;
  }

  // 8. Dimension Coverage & Confidence Calculation (V13 Part 7.4)
  let applicableCoverageTotal = 95.0; // 30 + 25 + 20 + 10 + 10
  let obtainedCoverage = 0.0;

  if (fieldConfidence.sections !== 'UNVERIFIED') obtainedCoverage += 30.0;
  if (fieldConfidence.experience !== 'UNVERIFIED') obtainedCoverage += 25.0;
  if (fieldConfidence.technicalSkills !== 'UNVERIFIED') obtainedCoverage += 20.0;
  if (fieldConfidence.qualitySignals !== 'UNVERIFIED') obtainedCoverage += 10.0;
  if (fieldConfidence.projects !== 'UNVERIFIED') obtainedCoverage += 10.0;

  if (roleAlignmentApplicable) {
    applicableCoverageTotal += 5.0; // 100.0
    obtainedCoverage += 5.0;
  }

  let dimensionCoverage = Math.round((obtainedCoverage / applicableCoverageTotal) * 100.0);
  if (!isResumeDateValid) {
    // Missing/invalid timestamp excludes age sub-signal: coverage loses 10%
    dimensionCoverage = Math.max(0, dimensionCoverage - 10);
  }

  const score = Math.min(100, Math.round(normalizedResumeScore * resumeAgeMultiplier));
  const dimensionConfidence =
    (!isResumeDateValid || dimensionCoverage < 70 || resumeAgeBand === 'BAND_2_EXPIRED')
      ? 'Low'
      : (dimensionCoverage >= 90 && resumeAgeBand === 'BAND_0_FRESH')
      ? 'High'
      : 'Medium';

  return {
    score,
    rawScore: Number(normalizedResumeScore.toFixed(2)),
    rawApplicable: Number(rawApplicable.toFixed(2)),
    applicableMax,
    roleAlignmentApplicable,
    dimensionCoverage,
    dimensionConfidence,
    resumeAgeBand,
    resumeAgeMultiplier,
    resumeAgeInDays,
    breakdown: {
      sectionScore,
      experienceScore: Number(experienceScore.toFixed(2)),
      skillScore: Number(skillScore.toFixed(2)),
      genericQualityScore,
      projectScore: Number(projectScore.toFixed(2)),
      roleAlignmentScore: Number(roleAlignmentScore.toFixed(2)),
      rawApplicable: Number(rawApplicable.toFixed(2)),
      applicableMax,
      roleAlignmentApplicable,
      resumeAgeBand,
      resumeAgeMultiplier,
    },
    evidenceSchemaVersion: RESUME_EVIDENCE_SCHEMA_VERSION,
    scoringVersion: RESUME_SCORING_VERSION,
  };
}

export default {
  RESUME_EVIDENCE_SCHEMA_VERSION,
  RESUME_SCORING_VERSION,
  RESUME_PROMPT_VERSION,
  validateResumeEvidence,
  computeResumeScore,
};
