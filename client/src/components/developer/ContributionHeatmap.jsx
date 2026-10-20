import React, { useMemo, useState } from 'react';
import { Calendar, Flame, Trophy, Info, AlertCircle, ShieldCheck } from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Quartile colors aligned with modern GitHub dark mode palette
const LEVEL_COLORS = {
  NONE: 'rgba(255, 255, 255, 0.05)',
  FIRST_QUARTILE: '#0e4429',
  SECOND_QUARTILE: '#006d32',
  THIRD_QUARTILE: '#26a641',
  FOURTH_QUARTILE: '#39d353',
};

export function ContributionHeatmap({ calendar, username }) {
  const [hoveredDay, setHoveredDay] = useState(null);

  const weeks = calendar?.weeks || [];
  const totalContributions = calendar?.calendarTotalContributions ?? 0;
  const currentStreak = calendar?.currentStreak ?? 0;
  const longestStreak = calendar?.longestStreak ?? 0;
  const restrictedContributions = calendar?.restrictedContributionsCount ?? 0;
  const hasRestricted = Boolean(calendar?.hasAnyRestrictedContributions);
  const syncStatus = calendar?.syncStatus || null;
  const isStaleOrPartial = syncStatus === 'STALE' || syncStatus === 'PARTIAL';

  // Calculate month labels positioned along weeks
  const monthLabels = useMemo(() => {
    if (!weeks.length) return [];
    const labels = [];
    let lastMonth = -1;

    weeks.forEach((week, wi) => {
      const firstDay = week.contributionDays?.[0];
      if (firstDay?.date) {
        const d = new Date(firstDay.date + 'T00:00:00Z');
        const month = d.getUTCMonth();
        if (month !== lastMonth) {
          labels.push({ weekIndex: wi, label: MONTH_NAMES[month] });
          lastMonth = month;
        }
      }
    });

    return labels;
  }, [weeks]);

  // Formatter for tooltip date display
  const formatTooltipDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr + 'T00:00:00Z');
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return dateStr;
    }
  };

  if (!weeks.length) {
    return (
      <div
        className="card p-6 flex flex-col items-center justify-center text-center space-y-3 border-dashed"
        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
      >
        <Calendar size={36} style={{ color: 'var(--text-secondary)' }} />
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            No Contribution Heatmap Available
          </h3>
          <p className="text-xs subtle mt-1 max-w-md" style={{ color: 'var(--text-secondary)' }}>
            {username
              ? `Sync ${username}'s GitHub account to view contribution frequency, streaks, and activity days.`
              : 'Link your GitHub account in your profile and click Sync to load your contribution heatmap.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="card p-5 space-y-4"
      style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      {/* Header and Summary Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar size={18} style={{ color: 'var(--primary-cyan)' }} />
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              GitHub Activity Consistency
            </h3>
            <span className="text-[11px] subtle" style={{ color: 'var(--text-secondary)' }}>
              Daily activity aggregate over the past 365 days
            </span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div
            className="px-2.5 py-1 rounded-full border flex items-center gap-1.5"
            style={{
              backgroundColor: 'rgba(57, 211, 83, 0.1)',
              borderColor: 'rgba(57, 211, 83, 0.3)',
              color: '#39d353',
            }}
          >
            <ShieldCheck size={13} />
            <span className="font-semibold">{totalContributions}</span>
            <span className="opacity-80">contributions</span>
          </div>

          <div
            className="px-2.5 py-1 rounded-full border flex items-center gap-1.5"
            style={{
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              borderColor: 'rgba(249, 115, 22, 0.3)',
              color: '#f97316',
            }}
          >
            <Flame size={13} />
            <span className="font-semibold">{currentStreak}</span>
            <span className="opacity-80">day streak</span>
          </div>

          <div
            className="px-2.5 py-1 rounded-full border flex items-center gap-1.5"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderColor: 'rgba(59, 130, 246, 0.3)',
              color: '#60a5fa',
            }}
          >
            <Trophy size={13} />
            <span className="font-semibold">{longestStreak}</span>
            <span className="opacity-80">longest</span>
          </div>

          {isStaleOrPartial && (
            <div
              className="px-2 py-0.5 rounded text-[11px] border flex items-center gap-1"
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                borderColor: 'rgba(234, 179, 8, 0.3)',
                color: '#eab308',
              }}
            >
              <AlertCircle size={12} />
              <span>Cached (Stale)</span>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Heatmap Container */}
      <div className="relative overflow-x-auto pb-2 pt-1">
        <div className="inline-block min-w-full">
          {/* Month labels header */}
          <div className="flex text-[10px] mb-1 pl-7" style={{ color: 'var(--text-secondary)' }}>
            <div className="relative w-full h-4">
              {monthLabels.map(({ weekIndex, label }) => (
                <span
                  key={`${weekIndex}-${label}`}
                  className="absolute transform -translate-x-1/2 font-medium"
                  style={{ left: `${(weekIndex / Math.max(1, weeks.length)) * 100}%` }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Grid Layout: 7 rows for days, dynamic weeks columns */}
          <div className="flex gap-1">
            {/* Weekday labels column */}
            <div className="flex flex-col justify-between text-[9px] pr-1 py-0.5 select-none" style={{ color: 'var(--text-secondary)', height: '88px' }}>
              <span className="h-2.5 leading-none">Mon</span>
              <span className="h-2.5 leading-none">Wed</span>
              <span className="h-2.5 leading-none">Fri</span>
            </div>

            {/* Weeks Columns */}
            <div className="flex gap-[3px]">
              {weeks.map((week, wi) => (
                <div key={`week-${wi}`} className="flex flex-col gap-[3px]">
                  {Array.from({ length: 7 }).map((_, weekdayIndex) => {
                    const day = week.contributionDays?.find((d) => d.weekday === weekdayIndex);
                    if (!day) {
                      return (
                        <div
                          key={`empty-${wi}-${weekdayIndex}`}
                          className="w-[11px] h-[11px] rounded-[2px] opacity-0 pointer-events-none"
                        />
                      );
                    }

                    const count = Number(day.contributionCount ?? day.count ?? 0);
                    const level = day.contributionLevel || (count > 0 ? 'FIRST_QUARTILE' : 'NONE');
                    const cellColor = LEVEL_COLORS[level] || day.color || LEVEL_COLORS.NONE;

                    return (
                      <div
                        key={`day-${day.date}-${wi}-${weekdayIndex}`}
                        className="w-[11px] h-[11px] rounded-[2px] transition-transform duration-100 hover:scale-125 hover:z-10 cursor-pointer"
                        style={{
                          backgroundColor: cellColor,
                          border: count === 0 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                        }}
                        onMouseEnter={() => setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend and Active Day Tooltip Info Bar */}
          <div className="flex flex-wrap items-center justify-between text-[11px] mt-3 pt-2 border-t" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
            <div className="min-h-[18px]">
              {hoveredDay ? (
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  <span className="font-bold text-emerald-400">
                    {hoveredDay.contributionCount ?? hoveredDay.count ?? 0}
                  </span>{' '}
                  {(hoveredDay.contributionCount ?? hoveredDay.count ?? 0) === 1 ? 'contribution' : 'contributions'} on{' '}
                  {formatTooltipDate(hoveredDay.date)}
                </span>
              ) : (
                <span className="subtle">Hover over any day square for details</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[10px]">
              <span>Less</span>
              {['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'].map((lvl) => (
                <div
                  key={lvl}
                  className="w-2.5 h-2.5 rounded-[2px]"
                  style={{
                    backgroundColor: LEVEL_COLORS[lvl],
                    border: lvl === 'NONE' ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                  }}
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </div>

      {/* Option A Disclosure Notice (V13 Part 10.1 & Part 23.1) */}
      <div
        className="p-3 rounded-lg text-[11px] leading-relaxed flex items-start gap-2.5 border"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-secondary)',
        }}
      >
        <Info size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--primary-cyan)' }} />
        <div>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
            Private contribution policy (Option A):
          </span>{' '}
          GitHub activity consistency reflects contribution events returned by GitHub&apos;s GraphQL API. When you have
          enabled &quot;Include private contributions&quot; in your GitHub account settings, anonymized private
          contribution counts are included in your calendar totals
          {hasRestricted || restrictedContributions > 0 ? ` (${restrictedContributions} restricted contributions detected)` : ''}.
          ScholrBoard cannot access private repository contents, code, or names. Active days reflect GitHub events — used
          as an activity consistency signal, not proof of engineering quality.
        </div>
      </div>
    </div>
  );
}

export default ContributionHeatmap;
