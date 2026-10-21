/**
 * scorePersistence.js — Authoritative Score Persistence & Idempotency Service
 *
 * Implements ScholrBoard V13 Part 17.1, 17.5.E.2, 17.5.E.3, 17.5.E.4 specifications.
 * Enforces:
 *   1. Path A vs Path B branching (Single-document CAS vs Multi-document ACID Transaction).
 *   2. Durable milestoneEventId idempotency with full canonical eligibility verification.
 *   3. Monotonic snapshotSequence numbering and CAS profile pointer ordering.
 *   4. Cryptographic snapshotHash chain (priorSnapshotHash -> snapshotHash).
 *   5. Bounded sequence collision retry recovery with SequenceCollisionRetryExhaustedError.
 *   6. Strict non-fabricated sourceDataUpdatedAt semantics.
 */
import crypto from 'crypto';
import mongoose from 'mongoose';
import ScoreHistory from '../models/ScoreHistory.js';
import Profile from '../models/Profile.js';

// -----------------------------------------------------------------------------
// Custom Domain Error Classes
// -----------------------------------------------------------------------------
export class MissingRequiredMilestoneEventIdError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MissingRequiredMilestoneEventIdError';
    this.statusCode = 400;
  }
}

export class IdempotencyConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IdempotencyConflictError';
    this.statusCode = 409;
  }
}

export class ProfilePointerUpdateFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProfilePointerUpdateFailedError';
    this.statusCode = 500;
  }
}

export class SequenceCollisionRetryExhaustedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SequenceCollisionRetryExhaustedError';
    this.statusCode = 409;
  }
}

export class StaleScoreCalculationPreemptedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StaleScoreCalculationPreemptedError';
    this.statusCode = 409;
  }
}

// -----------------------------------------------------------------------------
// Cryptographic & Canonical Serialization Helpers
// -----------------------------------------------------------------------------
export function canonicalJSON(val) {
  if (val === null || val === undefined) return 'null';

  // Normalize Mongoose documents and subdocuments to plain POJOs
  if (val && typeof val.toObject === 'function') {
    val = val.toObject();
  } else if (val && typeof val.toJSON === 'function' && !(val instanceof Date)) {
    val = val.toJSON();
  }
  if (val === null || val === undefined) return 'null';

  if (typeof val === 'number') {
    return Number.isFinite(val) ? String(val) : 'null';
  }
  if (typeof val === 'boolean' || typeof val === 'string') {
    return JSON.stringify(val);
  }
  if (val instanceof Date) {
    return JSON.stringify(val.toISOString());
  }
  if (val instanceof Map) {
    const plain = {};
    for (const [k, v] of val.entries()) {
      plain[k] = v;
    }
    return canonicalJSON(plain);
  }
  if (val instanceof Set) {
    return canonicalJSON(Array.from(val));
  }
  if (Array.isArray(val)) {
    return '[' + val.map(canonicalJSON).join(',') + ']';
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val)
      .filter(k => !k.startsWith('$') && k !== '_doc' && k !== '__v')
      .sort();
    const entries = keys.map(k => `${JSON.stringify(k)}:${canonicalJSON(val[k])}`);
    return '{' + entries.join(',') + '}';
  }
  return JSON.stringify(String(val));
}

export function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Normalizes the complete canonical eligibility object for hashing and comparison.
 * Compares status, isEligible, reasons, conditions, and ruleSetId / ruleSetVersion.
 */
export function canonicalizeEligibility(elig) {
  if (!elig || typeof elig !== 'object') {
    return null;
  }

  const rawConditions = Array.isArray(elig.conditions) ? elig.conditions : [];
  const normalizedConditions = rawConditions
    .filter(c => c && typeof c === 'object')
    .map(c => ({
      ruleId: c.ruleId != null ? String(c.ruleId).trim() : null,
      ruleSetId: c.ruleSetId != null ? String(c.ruleSetId).trim() : null,
      met: typeof c.met === 'boolean' ? c.met : null,
    }))
    .sort((a, b) => {
      const keyA = `${a.ruleSetId || ''}:${a.ruleId || ''}`;
      const keyB = `${b.ruleSetId || ''}:${b.ruleId || ''}`;
      return keyA.localeCompare(keyB);
    });

  const rawReasons = Array.isArray(elig.reasons) ? elig.reasons : [];
  const normalizedReasons = rawReasons
    .map(r => String(r).trim())
    .sort();

  return {
    status: elig.status != null ? String(elig.status).trim() : null,
    isEligible: typeof elig.isEligible === 'boolean' ? elig.isEligible : null,
    reasons: normalizedReasons,
    conditions: normalizedConditions,
    ruleSetId: elig.ruleSetId != null ? String(elig.ruleSetId).trim() : null,
    ruleSetVersion: elig.ruleSetVersion != null ? String(elig.ruleSetVersion).trim() : null,
  };
}

/**
 * Computes canonical historical snapshot hash (snapshotHash).
 * Securely links to priorSnapshotHash and encapsulates all event-defining fields.
 */
export function computeHistoricalSnapshotHash({
  userId,
  scoreType,
  milestoneEventId,
  priorSnapshotHash = 'GENESIS',
  snapshotSequence = 1,
  score,
  coverage,
  confidence,
  freshness,
  eligibilitySnapshot = null,
  configHash,
  methodologyVersion,
  milestoneReason,
  evidenceFingerprint = null,
}) {
  if (!['developer', 'placement_readiness'].includes(scoreType)) {
    throw new Error(`Invalid scoreType: ${scoreType}`);
  }

  const canonical = {
    userId: String(userId),
    scoreType,
    milestoneEventId: String(milestoneEventId),
    priorSnapshotHash: priorSnapshotHash || 'GENESIS',
    snapshotSequence: Number(snapshotSequence),
    score: score != null ? Math.round(score * 100) / 100 : null,
    coverage: coverage != null ? Math.round(coverage * 100) / 100 : null,
    confidence: confidence || null,
    freshness: freshness || null,
    eligibilityStatus: scoreType === 'placement_readiness' ? canonicalizeEligibility(eligibilitySnapshot) : null,
    configHash: configHash || null,
    methodologyVersion: methodologyVersion || null,
    milestoneReason: milestoneReason || null,
    evidenceFingerprint: evidenceFingerprint || null,
  };

  return sha256(canonicalJSON(canonical));
}

/**
 * Computes calculation fingerprint across contributing source states and snapshots.
 */
export function computeCalculationFingerprint({
  scoreType,
  methodologyVersion,
  evidenceSnapshot,
  configSnapshot,
  platformSyncStatesAtCalc = {},
}) {
  if (!['developer', 'placement_readiness'].includes(scoreType)) {
    throw new Error(`Invalid scoreType: ${scoreType}`);
  }

  const contributingSources = {};
  const providers = scoreType === 'developer'
    ? ['github', 'leetcode', 'codeforces']
    : ['leetcode', 'resume', 'github', 'academic'];

  for (const prov of providers) {
    const p = platformSyncStatesAtCalc?.[prov];
    contributingSources[prov] = {
      syncStatus: p?.syncStatus ?? null,
      dataHash: p?.dataHash ?? null,
      sourceDataUpdatedAt: p?.sourceDataUpdatedAt instanceof Date
        ? p.sourceDataUpdatedAt.toISOString()
        : (typeof p?.sourceDataUpdatedAt === 'string' ? p.sourceDataUpdatedAt : null),
    };
  }

  const canonical = {
    scoreType,
    methodologyVersion: methodologyVersion ?? (scoreType === 'developer' ? 'v3.0.0' : 'v2.0.0'),
    evidenceSnapshot: evidenceSnapshot ?? null,
    configSnapshot: configSnapshot ?? null,
    contributingSources,
  };

  return sha256(canonicalJSON(canonical));
}

/**
 * Validates canonical equality across all event-defining fields of a ScoreHistory record.
 * Specifically validates full canonical eligibility comparison (status, isEligible, reasons, conditions, ruleSet).
 */
export function verifyMilestonePayloadMatch(existingRecord, incoming) {
  const {
    score,
    coverage,
    confidence,
    freshness,
    configHash,
    developerMethodologyVersion,
    placementMethodologyVersion,
    scoreType,
    evidenceFingerprint,
    eligibilitySnapshot,
  } = incoming;

  const scoreMatches = (existingRecord.score == null && score == null) ||
    (existingRecord.score != null && score != null && Math.round(existingRecord.score * 100) === Math.round(score * 100));

  const coverageMatches = (existingRecord.coverage == null && coverage == null) ||
    (existingRecord.coverage != null && coverage != null && Math.round(existingRecord.coverage * 100) === Math.round(coverage * 100));

  const confidenceMatches = (existingRecord.confidence || null) === (confidence || null);
  const freshnessMatches = (existingRecord.freshness || null) === (freshness || null);
  const configMatches = (existingRecord.configHash || null) === (configHash || null);
  const fpMatches = (existingRecord.evidenceFingerprint || null) === (evidenceFingerprint || null);

  const methVersion = scoreType === 'developer' ? developerMethodologyVersion : placementMethodologyVersion;
  const existingMeth = scoreType === 'developer' ? existingRecord.developerMethodologyVersion : existingRecord.placementMethodologyVersion;
  const methMatches = (existingMeth || null) === (methVersion || null);

  let eligMatches = true;
  if (scoreType === 'placement_readiness') {
    const existingCanonical = canonicalizeEligibility(existingRecord.eligibilitySnapshot);
    const incomingCanonical = canonicalizeEligibility(eligibilitySnapshot);
    eligMatches = canonicalJSON(existingCanonical) === canonicalJSON(incomingCanonical);
  }

  return scoreMatches && coverageMatches && confidenceMatches && freshnessMatches && configMatches && fpMatches && methMatches && eligMatches;
}

/**
 * Evaluates evidence hash changes across 7 operational provider states.
 */
export function evaluateEvidenceHashChange(oldEvidenceHash, newEvidenceHash, syncStatus = 'SUCCESS', connectionStatus = 'LINKED') {
  // Case 1: Provider is unlinked or structurally unavailable
  if (connectionStatus !== 'LINKED' || syncStatus === 'UNAVAILABLE') {
    return { hasChanged: false, event: 'UNLINKED_OR_UNAVAILABLE', retainPrior: true, updateTimestamp: false };
  }
  // Case 2: Transient provider failure / rate limit / auth expired
  if (['ERROR', 'RATE_LIMITED', 'AUTH_EXPIRED'].includes(syncStatus)) {
    return { hasChanged: false, event: 'TRANSIENT_PROVIDER_FAILURE', retainPrior: true, updateTimestamp: false };
  }
  // Case 4: Neither old nor new hash exists
  if (!oldEvidenceHash && !newEvidenceHash) {
    return { hasChanged: false, event: 'NO_EVIDENCE_EVER', retainPrior: false, updateTimestamp: false };
  }
  // Case 3: Incomplete or malformed successful payload (had prior evidence, but success payload missing hash)
  if (syncStatus === 'SUCCESS' && !newEvidenceHash) {
    return { hasChanged: false, event: 'INCOMPLETE_MALFORMED_PAYLOAD', retainPrior: true, updateTimestamp: false };
  }
  // Case 5: First valid evidence obtained
  if (!oldEvidenceHash && Boolean(newEvidenceHash)) {
    return { hasChanged: true, event: 'FIRST_VALID_EVIDENCE', retainPrior: false, updateTimestamp: true };
  }
  // Case 6: Existing valid evidence is unchanged
  if (Boolean(oldEvidenceHash) && Boolean(newEvidenceHash) && oldEvidenceHash === newEvidenceHash) {
    return { hasChanged: false, event: 'VALID_EVIDENCE_UNCHANGED', retainPrior: true, updateTimestamp: false };
  }
  // Case 7: Existing valid evidence has changed
  if (Boolean(oldEvidenceHash) && Boolean(newEvidenceHash) && oldEvidenceHash !== newEvidenceHash) {
    return { hasChanged: true, event: 'VALID_EVIDENCE_CHANGED', retainPrior: false, updateTimestamp: true };
  }
  return { hasChanged: false, event: 'NO_CHANGE', retainPrior: true, updateTimestamp: false };
}

/**
 * Authoritative decision function: determines if a new ScoreHistory record should be persisted.
 */
export function shouldAppendScoreHistory({
  currentEval,
  latestHistoryRecord,
  evidenceDataHashChanged,
  triggerReason,
}) {
  // 1. Initial snapshot: always record first calculation
  if (!latestHistoryRecord) return true;

  // 2. Underlying provider evidence changed
  if (evidenceDataHashChanged || triggerReason === 'PROVIDER_SYNC_CHANGED') return true;

  // 3. Effective scoring configuration or methodology version changed
  if (currentEval.configHash !== latestHistoryRecord.configHash) return true;

  const scoreType = currentEval.scoreType;
  const currentMethodology = scoreType === 'developer'
    ? currentEval.developerMethodologyVersion
    : currentEval.placementMethodologyVersion;
  const latestMethodology = scoreType === 'developer'
    ? latestHistoryRecord.developerMethodologyVersion
    : latestHistoryRecord.placementMethodologyVersion;
  if (currentMethodology !== latestMethodology) return true;

  // 4. Institutional placement eligibility state transition
  if (scoreType === 'placement_readiness') {
    const curElig = canonicalizeEligibility(currentEval.eligibilitySnapshot);
    const prevElig = canonicalizeEligibility(latestHistoryRecord?.eligibilitySnapshot);
    if (curElig && prevElig) {
      if (canonicalJSON(curElig) !== canonicalJSON(prevElig)) return true;
    } else if ((curElig && !prevElig) || (!curElig && prevElig)) {
      return true;
    }
  }

  // 5. Significant score progress or decay milestone:
  // Score decrease >= 1 pt (decay) OR score increase >= 3 pts (progression)
  const currentRoundedScore = Math.round(currentEval.score ?? 0);
  const latestRecordedScore = Math.round(latestHistoryRecord.score ?? 0);
  const scoreDiff = currentRoundedScore - latestRecordedScore;
  if (scoreDiff <= -1 || scoreDiff >= 3) return true;

  // 6. Operational metadata milestones: data freshness or confidence band crossed
  if (currentEval.freshness !== latestHistoryRecord.freshness) return true;
  if (currentEval.confidence !== latestHistoryRecord.confidence) return true;

  // 7. Coverage milestone: >= 5 percentage points change
  if (Math.abs(Math.round(currentEval.coverage ?? 0) - Math.round(latestHistoryRecord.coverage ?? 0)) >= 5) return true;

  return false;
}

/**
 * Derives confidence based on coverage, freshness, and recency level.
 */
export function deriveConfidence({ coverage = 0, freshness = 'Fresh', recencyLevel = null }) {
  if (!recencyLevel) {
    return 'Low';
  }
  const cov = coverage != null ? Math.round(coverage) : 0;
  if (cov >= 75 && freshness === 'Fresh' && (recencyLevel === 'L1' || recencyLevel === 'L2')) {
    return 'High';
  }
  if (cov >= 50 && freshness !== 'Stale') {
    return 'Medium';
  }
  return 'Low';
}

/**
 * Computes freshness string based on contributing platform sync dates (V13 Part 5.4).
 * - <= 14 days: "Fresh"
 * - <= 30 days: "Aging"
 * - > 30 days: "Stale"
 */
export function computeScoreFreshness(profile, scoreType, evalDate = new Date()) {
  const syncStates = profile?.platformSyncStates;
  if (syncStates) {
    const evalMs = (evalDate instanceof Date ? evalDate : new Date(evalDate)).getTime();
    const contributingDates = [];

    if (scoreType === 'developer') {
      if (profile.codingStats?.profiles?.github && syncStates.github?.lastSuccessfulSync) {
        contributingDates.push(new Date(syncStates.github.lastSuccessfulSync).getTime());
      }
      if (profile.codingStats?.profiles?.leetcode && syncStates.leetcode?.lastSuccessfulSync) {
        contributingDates.push(new Date(syncStates.leetcode.lastSuccessfulSync).getTime());
      }
      if (
        profile.codingStats?.profiles?.codeforces &&
        syncStates.codeforces?.syncStatus &&
        syncStates.codeforces.syncStatus !== 'NOT_CONNECTED' &&
        syncStates.codeforces?.lastSuccessfulSync
      ) {
        contributingDates.push(new Date(syncStates.codeforces.lastSuccessfulSync).getTime());
      }
    } else if (scoreType === 'placement_readiness') {
      if (syncStates.leetcode?.lastSuccessfulSync) contributingDates.push(new Date(syncStates.leetcode.lastSuccessfulSync).getTime());
      if (syncStates.github?.lastSuccessfulSync) contributingDates.push(new Date(syncStates.github.lastSuccessfulSync).getTime());
      if (syncStates.resume?.lastVerifiedAt) contributingDates.push(new Date(syncStates.resume.lastVerifiedAt).getTime());
    }

    const validDates = contributingDates.filter(t => !isNaN(t));
    if (validDates.length > 0) {
      const oldestSyncMs = Math.min(...validDates);
      const oldestAgeDays = Math.max(0, (evalMs - oldestSyncMs) / (24 * 60 * 60 * 1000));
      if (oldestAgeDays <= 14) return 'Fresh';
      if (oldestAgeDays <= 30) return 'Aging';
      return 'Stale';
    }
  }

  const scoreMetaPath = scoreType === 'developer' ? 'developerScoreMeta' : 'placementReadinessMeta';
  const meta = profile?.[scoreMetaPath];
  if (meta?.freshness) return meta.freshness;
  return 'Fresh';
}

/**
 * Extracts typed recency level from calculation result.
 */
export function extractRecencyLevel(result, scoreType) {
  if (result?.recencyLevel !== undefined && result?.recencyLevel !== null) {
    return result.recencyLevel;
  }
  if (scoreType === 'developer') {
    if (result?.dimensions?.get && typeof result.dimensions.get === 'function') {
      return result.dimensions.get('dsa')?.recencyLevel ?? null;
    }
    return result?.dimensions?.dsa?.recencyLevel || null;
  }
  if (result?.dimensions?.get && typeof result.dimensions.get === 'function') {
    return result.dimensions.get('placementDsa')?.recencyLevel ?? null;
  }
  return result?.dimensions?.placementDsa?.recencyLevel || null;
}

// -----------------------------------------------------------------------------
// Core Persistence Function: persistScoreCalculation
// -----------------------------------------------------------------------------
export async function persistScoreCalculation({
  profile,
  scoreType,
  result,
  evaluationHash,
  triggerReason,
  oldEvidenceHash,
  newEvidenceHash,
  syncStatus = 'SUCCESS',
  connectionStatus = 'LINKED',
  milestoneEventId = null,
  sourceDataUpdatedAt = null,
  baseEvaluationRevision = null,
  options = {},
}) {
  if (!['developer', 'placement_readiness'].includes(scoreType)) {
    throw new Error(`Invalid scoreType: ${scoreType}`);
  }

  const scoreMetaPath = scoreType === 'developer' ? 'developerScoreMeta' : 'placementReadinessMeta';
  const now = options.now || new Date();
  const effectiveBaseRevision = baseEvaluationRevision ?? profile[scoreMetaPath]?.evaluationRevision ?? 0;

  // 1. Evaluate evidence hash changes
  const hashEval = evaluateEvidenceHashChange(oldEvidenceHash, newEvidenceHash, syncStatus, connectionStatus);
  const evidenceDataHashChanged = hashEval.hasChanged;

  // 2. Derive freshness and confidence
  const currentFreshness = computeScoreFreshness(profile, scoreType);
  const recencyLevel = extractRecencyLevel(result, scoreType);
  const derivedConfidence = deriveConfidence({
    coverage: result.coverage,
    freshness: currentFreshness,
    recencyLevel,
  });

  // 3. Determine authoritative sourceDataUpdatedAt (Non-Fabricated Semantics)
  let validSourceDataUpdatedAt = null;
  if (hashEval.updateTimestamp) {
    validSourceDataUpdatedAt = sourceDataUpdatedAt || options.observedDataChangeAt || null;
  } else if (profile[scoreMetaPath]?.sourceDataUpdatedAt) {
    validSourceDataUpdatedAt = profile[scoreMetaPath].sourceDataUpdatedAt;
  } else {
    validSourceDataUpdatedAt = null; // Strictly NULL! Never fabricated when unknown!
  }

  // 4. Retrieve latest historical record
  const latestHistoryRecord = await ScoreHistory.findOne({
    userId: profile.userId,
    scoreType,
  }).sort({ snapshotSequence: -1, calculatedAt: -1 });

  // 5. Check authoritative shouldAppendScoreHistory decision rule
  const shouldAppend = shouldAppendScoreHistory({
    currentEval: {
      scoreType,
      score: result.score,
      coverage: result.coverage,
      confidence: derivedConfidence,
      freshness: currentFreshness,
      configHash: result.configSnapshotHash,
      developerMethodologyVersion: result.developerMethodologyVersion,
      placementMethodologyVersion: result.placementMethodologyVersion,
      eligibilitySnapshot: result.eligibilitySnapshot,
    },
    latestHistoryRecord,
    evidenceDataHashChanged,
    triggerReason,
  });

  // PATH A: Non-Milestone Evaluation -> Single-Document Profile Update with Concurrency CAS
  if (!shouldAppend) {
    const profileUpdates = {
      [`${scoreMetaPath}.score`]:                 result.score,
      [`${scoreMetaPath}.coverage`]:              result.coverage,
      [`${scoreMetaPath}.confidence`]:            derivedConfidence,
      [`${scoreMetaPath}.freshness`]:             currentFreshness,
      [`${scoreMetaPath}.evaluationHash`]:        evaluationHash,
      [`${scoreMetaPath}.calculatedAt`]:          now,
      [`${scoreMetaPath}.dimensions`]:            result.dimensions,
      [`${scoreMetaPath}.activeMilestoneEventId`]: null,
      ...(scoreType === 'developer' ? {
        developerScore: result.score,
        developerScoreVersion: result.score !== null ? (result.developerScoreVersion || 3) : null,
        scoringFormulaVersion: result.score !== null ? (result.developerMethodologyVersion || 'v3.0.0') : null,
        [`${scoreMetaPath}.developerMethodologyVersion`]: result.score !== null ? (result.developerMethodologyVersion || 'v3.0.0') : null,
        scoreBreakdown: result.scoreBreakdown || profile.scoreBreakdown,
        lastScoreCalculatedAt: now,
        lastScoreCalculationReason: triggerReason,
      } : {
        placementReadinessScore: result.score,
        [`${scoreMetaPath}.placementMethodologyVersion`]: result.score !== null ? (result.placementMethodologyVersion || 'v2.0.0') : null,
      }),
    };
    if (validSourceDataUpdatedAt) {
      profileUpdates[`${scoreMetaPath}.sourceDataUpdatedAt`] = validSourceDataUpdatedAt;
    }
    if (scoreType === 'placement_readiness' && result.eligibilitySnapshot) {
      profileUpdates['placementReadinessMeta.eligibilityStatus'] = {
        status: result.eligibilitySnapshot.status,
        isEligible: Boolean(result.eligibilitySnapshot.isEligible),
        reasons: result.eligibilitySnapshot.reasons || [],
        conditions: result.eligibilitySnapshot.conditions || [],
        ruleSetId: result.eligibilitySnapshot.ruleSetId || null,
        ruleSetVersion: result.eligibilitySnapshot.ruleSetVersion || null,
        evaluatedAt: result.eligibilitySnapshot.evaluatedAt || now,
        notes: result.eligibilitySnapshot.notes || null,
      };
    }

    const casFilterA = {
      _id: profile._id,
      $or: [
        { [`${scoreMetaPath}.evaluationRevision`]: effectiveBaseRevision },
        { [`${scoreMetaPath}.evaluationRevision`]: { $exists: false } },
      ],
    };

    const updateResult = await Profile.updateOne(casFilterA, {
      $set: profileUpdates,
      $inc: { [`${scoreMetaPath}.evaluationRevision`]: 1 },
    });

    if (updateResult.matchedCount === 0) {
      return {
        success: false,
        preempted: true,
        reason: 'CONCURRENCY_PREEMPTED',
        record: latestHistoryRecord,
      };
    }

    return latestHistoryRecord;
  }

  // PATH B: Milestone Event -> Multi-Document ACID Transaction
  if (!milestoneEventId || typeof milestoneEventId !== 'string' || !milestoneEventId.trim()) {
    throw new MissingRequiredMilestoneEventIdError(
      `MissingRequiredMilestoneEventIdError: milestoneEventId is required to persist milestone ScoreHistory for ${scoreType} (userId: ${profile.userId})`
    );
  }
  const effectiveEventId = milestoneEventId.trim();

  const session = await mongoose.startSession();
  let committedRecord = null;
  let computedSnapshotHash = null;

  try {
    await session.withTransaction(async () => {
      // Step B1: Check for existing record with same milestoneEventId
      let historyRecord = await ScoreHistory.findOne({
        userId: profile.userId,
        scoreType,
        milestoneEventId: effectiveEventId,
      }, null, { session });

      if (historyRecord) {
        // Validate canonical payload consistency across all event-defining fields
        const isMatch = verifyMilestonePayloadMatch(historyRecord, {
          score: result.score,
          coverage: result.coverage,
          confidence: derivedConfidence,
          freshness: currentFreshness,
          configHash: result.configSnapshotHash,
          developerMethodologyVersion: result.developerMethodologyVersion,
          placementMethodologyVersion: result.placementMethodologyVersion,
          scoreType,
          evidenceFingerprint: result.evidenceFingerprint,
          eligibilitySnapshot: result.eligibilitySnapshot,
        });

        if (!isMatch) {
          throw new IdempotencyConflictError(
            `Idempotency conflict for milestoneEventId "${effectiveEventId}": existing record fields do not match incoming calculation payload.`
          );
        }
      } else {
        // Step B2: Read latest sequence under transaction
        const latestUnderTx = await ScoreHistory.findOne({
          userId: profile.userId,
          scoreType,
        }, null, { session }).sort({ snapshotSequence: -1, calculatedAt: -1 });

        const snapshotSequence = (latestUnderTx?.snapshotSequence ?? 0) + 1;
        const priorSnapshotHash = latestUnderTx?.snapshotHash ?? 'GENESIS';

        // Step B3: Compute deterministic calculationFingerprint and snapshotHash
        const calculationFingerprint = computeCalculationFingerprint({
          scoreType,
          methodologyVersion: scoreType === 'developer' ? result.developerMethodologyVersion : result.placementMethodologyVersion,
          evidenceSnapshot: result.evidenceSnapshot,
          configSnapshot: result.configSnapshot,
          platformSyncStatesAtCalc: profile.platformSyncStates,
        });

        const snapshotHash = computeHistoricalSnapshotHash({
          userId: profile.userId,
          scoreType,
          milestoneEventId: effectiveEventId,
          priorSnapshotHash,
          snapshotSequence,
          score: result.score,
          coverage: result.coverage,
          confidence: derivedConfidence,
          freshness: currentFreshness,
          eligibilitySnapshot: result.eligibilitySnapshot || null,
          configHash: result.configSnapshotHash,
          methodologyVersion: scoreType === 'developer' ? result.developerMethodologyVersion : result.placementMethodologyVersion,
          milestoneReason: triggerReason,
          evidenceFingerprint: result.evidenceFingerprint || null,
        });
        computedSnapshotHash = snapshotHash;

        // Step B4: Insert ScoreHistory record passing session
        const [created] = await ScoreHistory.create([{
          userId: profile.userId,
          profileId: profile._id,
          scoreType,
          milestoneEventId: effectiveEventId,
          snapshotSequence,
          priorSnapshotHash,
          snapshotHash,
          calculationFingerprint,
          score: result.score,
          coverage: result.coverage,
          confidence: derivedConfidence,
          freshness: currentFreshness,
          evidenceCount: result.evidenceCount,
          eligibilitySnapshot: result.eligibilitySnapshot || null,
          dimensions: result.dimensions,
          evidenceSnapshot: result.evidenceSnapshot,
          configSnapshot: result.configSnapshot,
          configHash: result.configSnapshotHash,
          developerMethodologyVersion: result.developerMethodologyVersion,
          placementMethodologyVersion: result.placementMethodologyVersion,
          calculatedAt: now,
          sourceDataUpdatedAt: validSourceDataUpdatedAt,
          evidenceFingerprint: result.evidenceFingerprint || null,
          triggerReason,
        }], { session });

        historyRecord = created;
      }

      // Failure-injection hook for testing transaction rollback atomicity
      // STRICT SAFEGUARD: Only permissible when NODE_ENV === 'test'.
      // Completely ignored in production and non-test environments to prevent arbitrary client activation.
      if (process.env.NODE_ENV === 'test' && options._injectFailureBeforeProfileUpdate === true) {
        throw new Error('INJECTED_FAILURE_AFTER_HISTORY_CREATE');
      }

      // Step B5: Update Profile with compare-and-swap on snapshotSequence inside SAME transaction
      const updateResult = await Profile.updateOne({
        _id: profile._id,
        $or: [
          { [`${scoreMetaPath}.snapshotSequence`]: { $lt: historyRecord.snapshotSequence } },
          { [`${scoreMetaPath}.snapshotSequence`]: { $exists: false } },
        ],
      }, {
        $set: {
          [`${scoreMetaPath}.score`]:                 result.score,
          [`${scoreMetaPath}.coverage`]:              result.coverage,
          [`${scoreMetaPath}.confidence`]:            derivedConfidence,
          [`${scoreMetaPath}.freshness`]:             currentFreshness,
          [`${scoreMetaPath}.evaluationHash`]:        evaluationHash,
          [`${scoreMetaPath}.calculatedAt`]:          now,
          [`${scoreMetaPath}.lastSnapshotHash`]:      historyRecord.snapshotHash,
          [`${scoreMetaPath}.snapshotSequence`]:      historyRecord.snapshotSequence,
          [`${scoreMetaPath}.dimensions`]:            result.dimensions,
          [`${scoreMetaPath}.activeMilestoneEventId`]: null,
          ...(scoreType === 'developer' ? {
            developerScore: result.score,
            developerScoreVersion: result.score !== null ? (result.developerScoreVersion || 3) : null,
            scoringFormulaVersion: result.score !== null ? (result.developerMethodologyVersion || 'v3.0.0') : null,
            [`${scoreMetaPath}.developerMethodologyVersion`]: result.score !== null ? (result.developerMethodologyVersion || 'v3.0.0') : null,
            scoreBreakdown: result.scoreBreakdown || profile.scoreBreakdown,
            lastScoreCalculatedAt: now,
            lastScoreCalculationReason: triggerReason,
          } : {
            placementReadinessScore: result.score,
            [`${scoreMetaPath}.placementMethodologyVersion`]: result.score !== null ? (result.placementMethodologyVersion || 'v2.0.0') : null,
          }),
          ...(validSourceDataUpdatedAt ? { [`${scoreMetaPath}.sourceDataUpdatedAt`]: validSourceDataUpdatedAt } : {}),
          ...(scoreType === 'placement_readiness' && result.eligibilitySnapshot ? {
            'placementReadinessMeta.eligibilityStatus': {
              status: result.eligibilitySnapshot.status,
              isEligible: Boolean(result.eligibilitySnapshot.isEligible),
              reasons: result.eligibilitySnapshot.reasons || [],
              conditions: result.eligibilitySnapshot.conditions || [],
              ruleSetId: result.eligibilitySnapshot.ruleSetId || null,
              ruleSetVersion: result.eligibilitySnapshot.ruleSetVersion || null,
              evaluatedAt: result.eligibilitySnapshot.evaluatedAt || now,
              notes: result.eligibilitySnapshot.notes || null,
            }
          } : {}),
        },
        $inc: { [`${scoreMetaPath}.evaluationRevision`]: 1 },
      }, { session });

      // Path B Concurrency Guard: Verify updateResult.matchedCount
      if (updateResult.matchedCount === 0) {
        const currentProfile = await Profile.findById(profile._id).select(scoreMetaPath).session(session);
        if (!currentProfile) {
          throw new ProfilePointerUpdateFailedError(
            `Profile document ${profile._id} not found during Path B milestone persistence.`
          );
        }

        const liveSequence = currentProfile[scoreMetaPath]?.snapshotSequence ?? 0;
        if (liveSequence >= historyRecord.snapshotSequence) {
          // A concurrent newer milestone already advanced live pointer; do not regress!
          // Clear activeMilestoneEventId so it doesn't linger
          await Profile.updateOne({ _id: profile._id }, {
            $set: { [`${scoreMetaPath}.activeMilestoneEventId`]: null }
          }, { session });
        } else {
          throw new ProfilePointerUpdateFailedError(
            `Path B CAS update failed unexpectedly on profile ${profile._id} (liveSeq: ${liveSequence}, targetSeq: ${historyRecord.snapshotSequence}). Transaction aborted.`
          );
        }
      }

      committedRecord = historyRecord;
    });
  } catch (err) {
    if (err.code === 11000) {
      // E11000 Unique Index Conflict Handling:
      // Case A: Duplicate milestoneEventId (idempotent recovery race)
      if (err.keyPattern?.milestoneEventId || String(err.message).includes('milestoneEventId')) {
        committedRecord = await ScoreHistory.findOne({
          userId: profile.userId,
          scoreType,
          milestoneEventId: effectiveEventId,
        });
        if (!committedRecord) {
          throw new Error(`E11000 conflict occurred but ScoreHistory record for ${effectiveEventId} could not be retrieved.`);
        }
        const isMatch = verifyMilestonePayloadMatch(committedRecord, {
          score: result.score,
          coverage: result.coverage,
          confidence: derivedConfidence,
          freshness: currentFreshness,
          configHash: result.configSnapshotHash,
          developerMethodologyVersion: result.developerMethodologyVersion,
          placementMethodologyVersion: result.placementMethodologyVersion,
          scoreType,
          evidenceFingerprint: result.evidenceFingerprint,
          eligibilitySnapshot: result.eligibilitySnapshot,
        });
        if (!isMatch) {
          throw new IdempotencyConflictError(
            `Idempotency conflict during E11000 recovery for milestoneEventId "${effectiveEventId}": existing record fields do not match incoming calculation payload.`
          );
        }
      }
      // Case B: Sequence Collision between two DIFFERENT concurrent events
      else if (err.keyPattern?.snapshotSequence || String(err.message).includes('snapshotSequence')) {
        return await persistScoreCalculationWithRetry({
          profile, scoreType, result, evaluationHash, triggerReason,
          oldEvidenceHash, newEvidenceHash, syncStatus, connectionStatus,
          milestoneEventId, sourceDataUpdatedAt, baseEvaluationRevision,
          options, attempt: 1,
        });
      }
      // Case C: SnapshotHash conflict (identical state already persisted in history)
      else if (err.keyPattern?.snapshotHash || String(err.message).includes('snapshotHash')) {
        committedRecord = await ScoreHistory.findOne({
          userId: profile.userId,
          scoreType,
          snapshotHash: computedSnapshotHash,
        });
        if (!committedRecord) {
          throw err;
        }
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  } finally {
    await session.endSession();
  }

  return committedRecord;
}

// -----------------------------------------------------------------------------
// Bounded Sequence Collision Retry Wrapper
// -----------------------------------------------------------------------------
export async function persistScoreCalculationWithRetry(params) {
  const {
    profile,
    scoreType,
    result,
    evaluationHash,
    triggerReason,
    oldEvidenceHash,
    newEvidenceHash,
    syncStatus,
    connectionStatus,
    milestoneEventId,
    sourceDataUpdatedAt,
    baseEvaluationRevision,
    options = {},
    maxRetries = 3,
    attempt = 1,
  } = params;

  try {
    return await persistScoreCalculation({
      profile,
      scoreType,
      result,
      evaluationHash,
      triggerReason,
      oldEvidenceHash,
      newEvidenceHash,
      syncStatus,
      connectionStatus,
      milestoneEventId, // Preserves the exact durable logical event ID across retries
      sourceDataUpdatedAt,
      baseEvaluationRevision,
      options: { ...options, _retryAttempt: attempt },
    });
  } catch (err) {
    const isSequenceCollision = err.code === 11000 && (
      err.keyPattern?.snapshotSequence ||
      String(err.message).includes('snapshotSequence')
    );

    if (isSequenceCollision) {
      if (attempt >= maxRetries) {
        throw new SequenceCollisionRetryExhaustedError(
          `Failed to persist milestone after ${maxRetries} attempts due to concurrent sequence collisions for ${scoreType} (userId: ${profile.userId}, eventId: ${milestoneEventId})`
        );
      }

      // Exponential backoff with random jitter: (50ms * 2^attempt) + random(0, 50ms)
      const jitterMs = Math.floor(Math.random() * 50);
      const backoffMs = (50 * Math.pow(2, attempt)) + jitterMs;
      await new Promise(resolve => setTimeout(resolve, backoffMs));

      return await persistScoreCalculationWithRetry({
        ...params,
        attempt: attempt + 1,
      });
    }

    throw err;
  }
}
