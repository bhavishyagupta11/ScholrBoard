import React, { useId } from 'react';

/**
 * Maps a 0-100 score to a semantic color based on campus portal guidelines.
 */
function scoreColor(score) {
  if (score == null) return 'var(--text-secondary)';
  if (score < 50) return 'var(--danger-color)';
  if (score < 75) return 'var(--warning-color)';
  return 'var(--success-color)';
}

/**
 * DeveloperScoreRing — SVG-based radial progress ring.
 * Reuses and extends the circular progress math from ResumeImportPage.
 * 
 * Props:
 *  - score: Number (0-100)
 *  - size: Number (default 120, dimensions in px)
 *  - strokeWidth: Number (default 10)
 *  - label: String (text description under the ring)
 *  - loading: Boolean (renders a pulse skeleton loader)
 *  - showGradient: Boolean (renders a sleek cyan-to-blue progress gradient)
 *  - customColor: String (overrides score-based colors, e.g. "var(--primary-blue)")
 */
export function DeveloperScoreRing({
  score = 0,
  size = 120,
  strokeWidth = 10,
  label,
  loading = false,
  showGradient = true,
  customColor
}) {
  const uniqueId = useId();
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(score ?? 0, 0), 100);
  const dashOffset = circ - (pct / 100) * circ;
  
  // Generate a collision-safe unique ID for the gradient based on the label and useId
  const labelSlug = label ? label.replace(/\s+/g, '-').toLowerCase() : 'default';
  const gradientId = `scoreRingGradient-${labelSlug}-${uniqueId.replace(/:/g, '')}`;

  // Color configuration: gradient, custom override, or score-based color
  const color = customColor || scoreColor(pct);
  const strokeColorValue = showGradient ? `url(#${gradientId})` : color;

  if (loading) {
    return (
      <div 
        className="flex flex-col items-center gap-2 animate-pulse" 
        aria-busy="true" 
        aria-label="Loading score ring..."
      >
        <div 
          className="rounded-full bg-neutral-200 dark:bg-neutral-800" 
          style={{ width: size, height: size }} 
        />
        {label && <div className="h-3 w-16 bg-neutral-200 dark:bg-neutral-800 rounded" />}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <svg 
        width={size} 
        height={size} 
        style={{ transform: 'rotate(-90deg)' }}
        role="img" 
        aria-label={`${label || 'Score'}: ${pct} out of 100`}
      >
        <defs>
          {showGradient && (
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary-cyan)" />
              <stop offset="100%" stopColor="var(--primary-blue)" />
            </linearGradient>
          )}
        </defs>
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColorValue}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
        {/* Score text in center */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          style={{
            transform: 'rotate(90deg)',
            transformOrigin: '50% 50%',
            fontSize: size * 0.24,
            fontWeight: 800,
            fill: color,
          }}
        >
          {pct}
        </text>
      </svg>
      {label && (
        <span 
          className="text-xs font-bold uppercase tracking-wider select-none text-center"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export default DeveloperScoreRing;
