import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Clock, Link2, ShieldAlert } from 'lucide-react';

/**
 * PlatformStatusBadge — ScholrBoard V13 Phase 7
 *
 * Displays honest, granular platform connection and synchronization states.
 * Strictly distinguishes a linked social connection from live activity sync.
 */
export function PlatformStatusBadge({
  platform,
  connectionStatus = 'UNLINKED',
  syncStatus = 'NOT_CONNECTED',
  identityVerified = false,
  error = null,
  className = '',
}) {
  const isLinkedIn = platform === 'linkedin';

  // Normalize effective status
  const effectiveConnection = connectionStatus || (syncStatus !== 'NOT_CONNECTED' ? 'LINKED' : 'UNLINKED');
  const effectiveSync = syncStatus || 'NOT_CONNECTED';

  if (effectiveSync === 'SYNCING') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 ${className}`}
        title="Synchronization in progress"
      >
        <Loader2 size={12} className="animate-spin" />
        Syncing...
      </span>
    );
  }

  if (effectiveSync === 'AUTH_EXPIRED') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 ${className}`}
        title={error || 'Authorization expired. Please re-authenticate.'}
      >
        <ShieldAlert size={12} />
        Auth Expired
      </span>
    );
  }

  if (effectiveSync === 'RATE_LIMITED') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 ${className}`}
        title={error || 'Provider rate limit exceeded. Retry later.'}
      >
        <Clock size={12} />
        Rate Limited
      </span>
    );
  }

  if (effectiveSync === 'ERROR') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 ${className}`}
        title={error || 'Provider synchronization error.'}
      >
        <AlertCircle size={12} />
        Sync Error
      </span>
    );
  }

  // LinkedIn-specific status discrimination
  if (isLinkedIn) {
    if (effectiveSync === 'SUCCESS') {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${className}`}
          title="OAuth identity and activity metrics verified and synchronized"
        >
          <CheckCircle2 size={12} />
          Synced & Verified
        </span>
      );
    }

    if (effectiveSync === 'PARTIAL' || identityVerified) {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${className}`}
          title="OAuth identity verified by LinkedIn. Activity metrics unavailable under current approved permissions."
        >
          <CheckCircle2 size={12} />
          Verified Identity
        </span>
      );
    }

    if (effectiveConnection === 'LINKED') {
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30 ${className}`}
          title="User-provided profile reference. Identity and activity metrics unverified by OAuth provider."
        >
          <Link2 size={12} />
          Profile Link (User-Provided)
        </span>
      );
    }
  }

  if (effectiveSync === 'SYNCED' || effectiveSync === 'SUCCESS') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${className}`}
        title="Live metrics successfully verified and synchronized"
      >
        <CheckCircle2 size={12} />
        Synced
      </span>
    );
  }

  if (effectiveSync === 'PARTIAL') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 ${className}`}
        title={error || 'Partial synchronization. Some sub-signals unavailable.'}
      >
        <AlertCircle size={12} />
        Partial
      </span>
    );
  }

  if (effectiveConnection === 'LINKED') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/40 text-slate-300 border border-slate-600/40 ${className}`}
        title="Profile handle linked"
      >
        <Link2 size={12} />
        Linked
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800/40 text-slate-400 border border-slate-700/40 ${className}`}
      title="Platform not linked or configured"
    >
      Not Connected
    </span>
  );
}

export default PlatformStatusBadge;
