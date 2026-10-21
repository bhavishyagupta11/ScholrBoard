/**
 * placementEligibilityService.js
 *
 * ScholrBoard V13 Part 7.6: Authoritative Institutional Placement Eligibility Derivation.
 * Evaluates student conditions against an active institutional rule set using strict three-state logic:
 *   - 'ELIGIBLE': All required rules are explicitly verified with met === true, activeRuleSet valid, zero malformed conditions.
 *   - 'INELIGIBLE': At least one required rule is conclusively evaluated with met === false.
 *   - 'UNKNOWN': Incomplete, unconfigured, empty, malformed, or contradictory conditions.
 */

/**
 * Authoritative placement eligibility derivation.
 *
 * @param {Array<Object>} conditions - Evaluated student conditions [{ ruleId, met, ruleSetId, ... }]
 * @param {Object} activeRuleSet - Active institutional rule set { ruleSetId, requiredRuleIds: string[], ... }
 * @returns {"ELIGIBLE" | "INELIGIBLE" | "UNKNOWN"}
 */
export function deriveEligibilityStatus(conditions, activeRuleSet) {
  // 1. Guard: Active rule set must be valid, present, and contain non-empty array of valid requiredRuleIds
  if (!activeRuleSet || typeof activeRuleSet !== 'object') {
    return 'UNKNOWN'; // Unconfigured institutional rule set -> UNKNOWN
  }

  const { ruleSetId, requiredRuleIds } = activeRuleSet;
  if (!ruleSetId || typeof ruleSetId !== 'string' || ruleSetId.trim().length === 0) {
    return 'UNKNOWN';
  }

  if (
    !Array.isArray(requiredRuleIds) ||
    requiredRuleIds.length === 0 ||
    !requiredRuleIds.every(id => typeof id === 'string' && id.trim().length > 0)
  ) {
    return 'UNKNOWN'; // Empty or invalid required-rule set cannot establish ELIGIBLE or INELIGIBLE -> UNKNOWN
  }

  // Reject duplicate required rule IDs rather than silently deduplicating them:
  const trimmedRequired = requiredRuleIds.map(id => String(id).trim());
  const requiredSet = new Set(trimmedRequired);
  if (requiredSet.size !== trimmedRequired.length) {
    return 'UNKNOWN'; // Duplicate required rule IDs rejected
  }

  // 2. Guard: conditions must be a non-empty array
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return 'UNKNOWN';
  }

  // Helper: validate structural integrity of a condition object
  const isValidCondition = c => (
    c !== null &&
    typeof c === 'object' &&
    'ruleId' in c &&
    typeof c.ruleId === 'string' &&
    c.ruleId.trim().length > 0 &&
    typeof c.met === 'boolean'
  );

  const activeSetId = ruleSetId.trim();

  // 3. Map valid conditions for active required rules and check for malformed entries
  const conditionMap = new Map();
  let hasMalformed = false;

  for (const c of conditions) {
    if (!isValidCondition(c)) {
      hasMalformed = true;
      continue;
    }

    // If ruleSetId is present on condition, an empty string or mismatched value is ignored/skipped:
    if ('ruleSetId' in c) {
      const cSetId = c.ruleSetId != null ? String(c.ruleSetId).trim() : '';
      if (!cSetId || cSetId !== activeSetId) {
        continue;
      }
    }

    const rid = c.ruleId.trim();
    if (requiredSet.has(rid)) {
      if (!conditionMap.has(rid)) {
        conditionMap.set(rid, []);
      }
      conditionMap.get(rid).push(c);
    }
  }

  // 4. Check for contradictory duplicate conditions or required false:
  for (const [reqId, cList] of conditionMap.entries()) {
    const hasTrue = cList.some(c => c.met === true);
    const hasFalse = cList.some(c => c.met === false);
    if (hasTrue && hasFalse) {
      return 'UNKNOWN'; // Conflicting conditions for same required rule
    }
    if (hasFalse) {
      return 'INELIGIBLE'; // Conclusive failure on required rule
    }
  }

  // Malformed conditions prevent ELIGIBLE determination (completeness uncertain) -> UNKNOWN
  if (hasMalformed) {
    return 'UNKNOWN';
  }

  // 5. Every required rule must have at least one condition and all matching conditions must have met === true
  for (const requiredId of requiredSet) {
    const matchingConditions = conditionMap.get(requiredId);
    if (!matchingConditions || matchingConditions.length === 0) {
      return 'UNKNOWN';
    }
    if (!matchingConditions.every(c => c.met === true)) {
      return 'UNKNOWN';
    }
  }

  return 'ELIGIBLE';
}

/**
 * Builds standard reasons array from conditions and derived status.
 */
export function buildEligibilityReasons(conditions, status, activeRuleSet) {
  if (status === 'ELIGIBLE') {
    return ['Meets all required institutional placement criteria'];
  }
  if (status === 'INELIGIBLE') {
    const failed = (conditions || []).filter(c => c?.met === false && c?.ruleId);
    if (failed.length > 0) {
      return failed.map(c => c.description || c.reason || `Disqualified on required rule: ${c.ruleId}`);
    }
    return ['Failed institutional placement criteria'];
  }
  // UNKNOWN
  if (!activeRuleSet || !activeRuleSet.ruleSetId) {
    return ['Institutional eligibility rule set unconfigured'];
  }
  if (!conditions || conditions.length === 0) {
    return ['Attendance or academic eligibility evidence unavailable'];
  }
  return ['Eligibility determination incomplete or pending verification'];
}

export default {
  deriveEligibilityStatus,
  buildEligibilityReasons,
};
