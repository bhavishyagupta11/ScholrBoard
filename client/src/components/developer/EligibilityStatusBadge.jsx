import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

/**
 * EligibilityStatusBadge — Renders institutional placement eligibility status
 * 
 * Invariants (V13 Part 23.5, 23.6, Part 27 Phase 9):
 *  - Displays ELIGIBLE, INELIGIBLE, or UNKNOWN.
 *  - NEVER renders UNKNOWN as a success state (no green checkmark).
 *  - Explicitly explains WHY unknown when status is UNKNOWN (e.g. attendance unavailable, no rules configured).
 * 
 * Props:
 *  - eligibility: Object { status, isEligible, reasons, conditions, notes } OR String ('ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN')
 *  - showDetails: Boolean (whether to render details inline or as a collapsible/tooltip popover, default false)
 *  - compact: Boolean (concise badge for table cells)
 */
export function EligibilityStatusBadge({ eligibility, showDetails = false, compact = false }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Normalize input (can be string or structured object)
  let status = 'UNKNOWN';
  let reasons = [];
  let conditions = [];
  let notes = '';

  if (typeof eligibility === 'string') {
    status = eligibility.toUpperCase();
  } else if (eligibility && typeof eligibility === 'object') {
    status = (eligibility.status || 'UNKNOWN').toUpperCase();
    reasons = Array.isArray(eligibility.reasons) ? eligibility.reasons : [];
    conditions = Array.isArray(eligibility.conditions) ? eligibility.conditions : [];
    notes = eligibility.notes || '';
  }

  // Determine why UNKNOWN if no explicit reasons provided
  if (status === 'UNKNOWN' && reasons.length === 0) {
    if (notes) {
      reasons = [notes];
    } else {
      reasons = ['Attendance or academic prerequisite data not available — eligibility cannot be determined.'];
    }
  }

  // Configuration per status
  const config = {
    ELIGIBLE: {
      label: 'ELIGIBLE',
      icon: CheckCircle2,
      textColor: '#10b981', // emerald-500
      bgColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.25)',
      defaultSummary: 'All institutional criteria met',
    },
    INELIGIBLE: {
      label: 'INELIGIBLE',
      icon: XCircle,
      textColor: '#ef4444', // red-500
      bgColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: 'rgba(239, 68, 68, 0.25)',
      defaultSummary: 'Does not meet placement criteria',
    },
    UNKNOWN: {
      label: 'UNKNOWN',
      icon: AlertTriangle,
      textColor: '#f59e0b', // amber-500
      bgColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.25)',
      defaultSummary: reasons[0] || 'Prerequisites unverified',
    },
  };

  const current = config[status] || config.UNKNOWN;
  const IconComponent = current.icon;

  if (compact) {
    return (
      <div className="relative inline-block group">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-help select-none"
          style={{
            color: current.textColor,
            backgroundColor: current.bgColor,
            borderColor: current.borderColor,
          }}
          title={reasons.length > 0 ? reasons.join('; ') : current.defaultSummary}
          aria-label={`Eligibility Status: ${current.label}`}
        >
          <IconComponent size={11} className="shrink-0" />
          <span>{current.label}</span>
        </span>

        {/* Hover popover tooltip for compact mode */}
        {reasons.length > 0 && (
          <div
            className="hidden group-hover:block absolute z-30 bottom-full left-0 mb-1.5 w-64 p-2 rounded-lg text-[10px] leading-tight border shadow-xl pointer-events-none"
            style={{
              backgroundColor: 'var(--bg-medium, #18181b)',
              borderColor: 'var(--border-color, #27272a)',
              color: 'var(--text-primary, #f4f4f5)',
            }}
          >
            <div className="font-semibold mb-1 flex items-center gap-1" style={{ color: current.textColor }}>
              <IconComponent size={12} />
              <span>{current.label} Breakdown:</span>
            </div>
            <ul className="space-y-0.5 text-neutral-300">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="opacity-60">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="p-3 rounded-lg border text-xs space-y-2 transition-all"
      style={{
        backgroundColor: current.bgColor,
        borderColor: current.borderColor,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IconComponent size={16} style={{ color: current.textColor }} className="shrink-0" />
          <span className="font-bold uppercase tracking-wider" style={{ color: current.textColor }}>
            {current.label}
          </span>
        </div>

        {reasons.length > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[10px] font-semibold underline cursor-pointer hover:opacity-80"
            style={{ color: current.textColor }}
          >
            {isExpanded ? 'Hide details' : 'View details'}
          </button>
        )}
      </div>

      {/* Primary summary text */}
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary, #a1a1aa)' }}>
        {status === 'ELIGIBLE' && (reasons.length > 0 ? reasons.join(' • ') : 'Candidate meets all institutional placement prerequisites.')}
        {status === 'INELIGIBLE' && (reasons[0] || 'Candidate does not satisfy minimum academic or discipline requirements.')}
        {status === 'UNKNOWN' && (reasons[0] || 'Prerequisite evidence is incomplete or unverified. Eligibility cannot be determined.')}
      </p>

      {/* Expanded detailed breakdown if available */}
      {(showDetails || isExpanded) && reasons.length > 1 && (
        <div
          className="pt-2 border-t text-[10px] space-y-1"
          style={{ borderColor: current.borderColor }}
        >
          <span className="font-semibold block" style={{ color: 'var(--text-primary, #fff)' }}>
            Evaluation Conditions:
          </span>
          <ul className="space-y-1">
            {reasons.map((reason, idx) => (
              <li key={`reason-${idx}`} className="flex items-start gap-1.5" style={{ color: 'var(--text-secondary, #d4d4d8)' }}>
                <span className="opacity-60 mt-0.5">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default EligibilityStatusBadge;
