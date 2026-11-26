/**
 * opportunityDeadline.js — Frontend mirror of server/utils/opportunityDeadline.js
 *
 * Ensures frontend and backend apply identical rules:
 *  - Calendar date-only strings ('YYYY-MM-DD') expire at 23:59:59.999+05:30 (Asia/Kolkata).
 *  - Timezone-naive datetime-local strings ('YYYY-MM-DDTHH:mm[:ss]') are interpreted in Asia/Kolkata (+05:30).
 *  - Explicit ISO timestamps ('Z' / '+HH:MM') and Date objects compare against their exact instant.
 *  - At and past the exact boundary (nowMs >= deadlineMs), the opportunity is closed/expired.
 *  - Missing or invalid deadlines report UNVERIFIED_DEADLINE rather than silently looking open.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET = '+05:30';
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const NAIVE_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

const isValidCalendarDate = (datePart) => {
  const check = new Date(`${datePart}T00:00:00.000Z`);
  return !Number.isNaN(check.getTime()) && check.toISOString().slice(0, 10) === datePart;
};

export function parseOpportunityDeadline(rawDeadline) {
  if (rawDeadline === null || rawDeadline === undefined || rawDeadline === '') {
    return { valid: false, date: null };
  }

  if (rawDeadline instanceof Date) {
    return Number.isNaN(rawDeadline.getTime())
      ? { valid: false, date: null }
      : { valid: true, date: new Date(rawDeadline.getTime()) };
  }

  if (typeof rawDeadline === 'string') {
    const trimmed = rawDeadline.trim();
    if (!trimmed) return { valid: false, date: null };

    if (DATE_ONLY_REGEX.test(trimmed)) {
      if (!isValidCalendarDate(trimmed)) return { valid: false, date: null };
      const parsed = new Date(`${trimmed}T23:59:59.999${IST_OFFSET}`);
      return Number.isNaN(parsed.getTime()) ? { valid: false, date: null } : { valid: true, date: parsed };
    }

    if (NAIVE_DATETIME_REGEX.test(trimmed)) {
      const normalized = trimmed.replace(' ', 'T');
      const datePart = normalized.slice(0, 10);
      if (!isValidCalendarDate(datePart)) return { valid: false, date: null };
      const parsed = new Date(`${normalized}${IST_OFFSET}`);
      return Number.isNaN(parsed.getTime()) ? { valid: false, date: null } : { valid: true, date: parsed };
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? { valid: false, date: null } : { valid: true, date: parsed };
  }

  if (typeof rawDeadline === 'number' && Number.isFinite(rawDeadline)) {
    const parsed = new Date(rawDeadline);
    return Number.isNaN(parsed.getTime()) ? { valid: false, date: null } : { valid: true, date: parsed };
  }

  return { valid: false, date: null };
}

export function evaluateFrontendOpportunityDeadline(op, evalNow = Date.now()) {
  const nowMs = evalNow instanceof Date ? evalNow.getTime() : Number(evalNow);
  const parsed = parseOpportunityDeadline(op?.deadline);
  const isDeadlineVerified =
    op?.isDeadlineVerified !== false &&
    op?.deadlineStatus !== 'UNVERIFIED_DEADLINE' &&
    parsed.valid;

  const deadlineMs = parsed.valid ? parsed.date.getTime() : NaN;
  const isExpired = Boolean(
    op?.isExpired ||
    op?.deadlineStatus === 'EXPIRED' ||
    op?.status === 'Closed' ||
    (isDeadlineVerified && nowMs >= deadlineMs)
  );
  const isClosedOrUnverified = isExpired || !isDeadlineVerified || op?.isOpenForApplication === false;

  return {
    isDeadlineVerified,
    deadlineMs,
    isExpired,
    isClosedOrUnverified,
  };
}

export function formatOpportunityDeadlineIst(rawDeadline) {
  const parsed = parseOpportunityDeadline(rawDeadline);
  if (!parsed.valid) return 'Unverified';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(parsed.date);
}

export function formatDeadlineForDatetimeLocalIst(rawDeadline) {
  const parsed = parseOpportunityDeadline(rawDeadline);
  if (!parsed.valid) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(parsed.date);
  const get = (t) => parts.find((p) => p.type === t)?.value || '00';
  const hh = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hh}:${get('minute')}`;
}
