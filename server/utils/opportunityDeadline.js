/**
 * opportunityDeadline.js — Single Source of Truth for Placement Opportunity Deadlines
 *
 * Explicit Policy:
 *  - Missing or unparseable deadlines NEVER silently appear as verified-open and
 *    NEVER fabricate a synthetic expiry timestamp. Instead they yield:
 *      isDeadlineVerified: false, isExpired: false, isOpenForApplication: false
 *      reason: 'Application deadline is missing or unverified'
 *  - Date-only strings ('YYYY-MM-DD') represent the end of that UTC calendar day
 *    (23:59:59.999Z) to avoid premature mid-day rejections.
 *  - Explicit ISO/Date timestamps (with timezone or UTC Z) compare against their exact instant.
 *  - At and past the exact deadline instant (evalTime >= deadlineTime), the drive is closed/expired.
 */

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses raw deadline input safely.
 * @param {Date|string|number|null|undefined} rawDeadline
 * @returns {{ valid: boolean, date: Date|null, isDateOnly: boolean, rawType: string }}
 */
export function parseOpportunityDeadline(rawDeadline) {
  if (rawDeadline === null || rawDeadline === undefined || rawDeadline === '') {
    return { valid: false, date: null, isDateOnly: false, rawType: 'missing' };
  }

  if (rawDeadline instanceof Date) {
    if (Number.isNaN(rawDeadline.getTime())) {
      return { valid: false, date: null, isDateOnly: false, rawType: 'invalid_date' };
    }
    return { valid: true, date: new Date(rawDeadline.getTime()), isDateOnly: false, rawType: 'date_object' };
  }

  if (typeof rawDeadline === 'string') {
    const trimmed = rawDeadline.trim();
    if (!trimmed) {
      return { valid: false, date: null, isDateOnly: false, rawType: 'missing' };
    }

    if (DATE_ONLY_REGEX.test(trimmed)) {
      const parsed = new Date(`${trimmed}T23:59:59.999Z`);
      if (Number.isNaN(parsed.getTime())) {
        return { valid: false, date: null, isDateOnly: true, rawType: 'invalid_date_only' };
      }
      // Verify calendar rollover didn't happen (e.g. 2026-02-31)
      if (parsed.toISOString().slice(0, 10) !== trimmed) {
        return { valid: false, date: null, isDateOnly: true, rawType: 'invalid_calendar_date' };
      }
      return { valid: true, date: parsed, isDateOnly: true, rawType: 'date_only' };
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return { valid: false, date: null, isDateOnly: false, rawType: 'invalid_string' };
    }
    return { valid: true, date: parsed, isDateOnly: false, rawType: 'timestamp_string' };
  }

  if (typeof rawDeadline === 'number' && Number.isFinite(rawDeadline)) {
    const parsed = new Date(rawDeadline);
    if (Number.isNaN(parsed.getTime())) {
      return { valid: false, date: null, isDateOnly: false, rawType: 'invalid_number' };
    }
    return { valid: true, date: parsed, isDateOnly: false, rawType: 'epoch_ms' };
  }

  return { valid: false, date: null, isDateOnly: false, rawType: typeof rawDeadline };
}

/**
 * Authoritative evaluator for an Opportunity's application openness and deadline state.
 * Shared identically by listing endpoints, application submission gate, and reconciliation scripts.
 *
 * @param {object} opportunity
 * @param {Date|string|number} [evalDate=new Date()]
 * @returns {{
 *   isClosedByStatus: boolean,
 *   isDeadlineVerified: boolean,
 *   isExpired: boolean,
 *   isOpenForApplication: boolean,
 *   deadlineDate: Date|null,
 *   deadlineStatus: 'OPEN'|'EXPIRED'|'CLOSED'|'UNVERIFIED_DEADLINE',
 *   reason: string|null
 * }}
 */
export function evaluateOpportunityDeadline(opportunity, evalDate = new Date()) {
  const now = evalDate instanceof Date ? evalDate : new Date(evalDate);
  const nowMs = now.getTime();
  if (Number.isNaN(nowMs)) {
    throw new Error('Invalid evaluation clock provided to evaluateOpportunityDeadline');
  }

  const status = opportunity?.status || null;
  const isClosedByStatus = status !== 'Published';
  const parsed = parseOpportunityDeadline(opportunity?.deadline);

  if (!parsed.valid) {
    return {
      isClosedByStatus,
      isDeadlineVerified: false,
      isExpired: false,
      isOpenForApplication: false,
      deadlineDate: null,
      deadlineStatus: 'UNVERIFIED_DEADLINE',
      reason: 'Application deadline is missing or unverified',
    };
  }

  // Exact boundary rule: at or past deadline instant -> expired/closed
  const isExpired = nowMs >= parsed.date.getTime();

  if (isExpired) {
    return {
      isClosedByStatus,
      isDeadlineVerified: true,
      isExpired: true,
      isOpenForApplication: false,
      deadlineDate: parsed.date,
      deadlineStatus: 'EXPIRED',
      reason: 'Application deadline has passed',
    };
  }

  if (isClosedByStatus) {
    return {
      isClosedByStatus: true,
      isDeadlineVerified: true,
      isExpired: false,
      isOpenForApplication: false,
      deadlineDate: parsed.date,
      deadlineStatus: 'CLOSED',
      reason: 'Applications are not open for this opportunity',
    };
  }

  return {
    isClosedByStatus: false,
    isDeadlineVerified: true,
    isExpired: false,
    isOpenForApplication: true,
    deadlineDate: parsed.date,
    deadlineStatus: 'OPEN',
    reason: null,
  };
}

export default {
  parseOpportunityDeadline,
  evaluateOpportunityDeadline,
};
