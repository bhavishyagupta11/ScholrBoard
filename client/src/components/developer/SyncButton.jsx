import React from 'react';
import { RefreshCw, Timer } from 'lucide-react';

/**
 * Formats remaining seconds into MM:SS format.
 */
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Formats remaining seconds into a detailed tooltip phrase.
 */
function formatTooltip(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `Sync available in ${m}m ${s}s`;
}

/**
 * SyncButton — Button component managing active sync mutations and cooldown countdowns.
 * 
 * Props:
 *  - onSync: Function (trigger sync callback)
 *  - isSyncing: Boolean (active syncing state)
 *  - cooldown: Number (remaining seconds left in cooldown)
 *  - disabled: Boolean (optional manual override)
 */
export function SyncButton({ onSync, isSyncing = false, cooldown = 0, disabled = false }) {
  const inCooldown = cooldown > 0;
  const isButtonDisabled = isSyncing || inCooldown || disabled;

  // Click handler
  const handleClick = (e) => {
    e.stopPropagation();
    if (isButtonDisabled || !onSync) return;
    onSync();
  };

  // Cooldown styling classes
  let btnClasses = "btn px-4 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-200 select-none ";
  
  if (isSyncing) {
    btnClasses += "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 cursor-not-allowed border border-transparent";
  } else if (inCooldown) {
    btnClasses += "bg-amber-500/10 text-amber-500 border border-amber-500/30 cursor-not-allowed hover:bg-amber-500/15";
  } else if (disabled) {
    btnClasses += "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 cursor-not-allowed border border-transparent";
  } else {
    btnClasses += "btn-primary hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm";
  }

  return (
    <button
      onClick={handleClick}
      disabled={isButtonDisabled}
      className={btnClasses}
      type="button"
      title={inCooldown ? formatTooltip(cooldown) : "Synchronize coding stats from profile"}
      aria-disabled={isButtonDisabled}
      aria-busy={isSyncing}
    >
      {isSyncing ? (
        <>
          <RefreshCw size={14} className="animate-spin" />
          <span>Syncing...</span>
        </>
      ) : inCooldown ? (
        <>
          <Timer size={14} />
          <span>Cooldown ({formatTime(cooldown)})</span>
        </>
      ) : (
        <>
          <RefreshCw size={14} />
          <span>Sync Profile</span>
        </>
      )}
    </button>
  );
}

export default SyncButton;
