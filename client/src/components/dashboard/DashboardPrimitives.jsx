/**
 * DashboardPrimitives.jsx — Reusable Dashboard UI Primitives
 *
 * Core primitives:
 *   - SkeletonCard: Loading state skeleton container
 *   - EmptyStateCard: Actionable empty state with explanation, recommendation, and CTA button
 *   - ActionCTA: Standardized action button component
 *   - DashboardCard: Consistent card container with header icon and controls
 *   - DashboardState: Wrapper handling Loading / Error / Empty / Success states
 *   - ProgressChecklist: Guided onboarding checklist card for top of dashboard
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, ArrowRight, CheckCircle2, ChevronRight,
  Sparkles, RefreshCw, X, Award, FileText, Code2, LifeBuoy, BookOpen
} from 'lucide-react';

// ─── 1. Skeleton Loader ────────────────────────────────────────────────────────
export function SkeletonCard({ height = 'h-48', rows = 3, type = 'card' }) {
  if (type === 'list') {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton h-14 w-full rounded-lg" style={{ background: 'var(--bg-medium)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className={`skeleton w-full ${height} rounded-xl animate-pulse`} style={{ background: 'var(--bg-medium)' }} />
  );
}

// ─── 2. Action CTA Button ──────────────────────────────────────────────────────
export function ActionCTA({ to, onClick, label, icon: Icon = ArrowRight, variant = 'primary', className = '' }) {
  const baseClasses = "inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98]";
  
  const styles = {
    primary: { background: 'var(--primary-blue)', color: '#ffffff' },
    secondary: { background: 'var(--accent-soft)', color: 'var(--primary-blue)', border: '1px solid var(--border-color)' },
    outline: { background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)' },
  };

  const style = styles[variant] || styles.primary;

  if (to) {
    return (
      <Link to={to} className={`${baseClasses} ${className}`} style={style}>
        <span>{label}</span>
        {Icon && <Icon size={14} className="transition-transform group-hover:translate-x-0.5" />}
      </Link>
    );
  }

  return (
    <button onClick={onClick} type="button" className={`${baseClasses} ${className}`} style={style}>
      <span>{label}</span>
      {Icon && <Icon size={14} />}
    </button>
  );
}

// ─── 3. Actionable Empty State ────────────────────────────────────────────────
export function EmptyStateCard({
  icon: Icon = Sparkles,
  title,
  explanation,
  recommendation,
  ctaLabel,
  ctaTo,
  ctaOnClick,
  minHeight = 'min-h-[220px]'
}) {
  return (
    <div className={`w-full ${minHeight} flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed transition-all`}
      style={{ borderColor: 'var(--border-color)', background: 'var(--bg-medium)' }}>
      <div className="grid h-12 w-12 place-items-center rounded-xl mb-3" style={{ background: 'var(--accent-soft)', color: 'var(--primary-blue)' }}>
        <Icon size={24} />
      </div>
      {title && <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{title}</h4>}
      <p className="text-xs max-w-md leading-relaxed subtle mb-1">{explanation}</p>
      {recommendation && (
        <p className="text-xs font-medium max-w-md mb-4" style={{ color: 'var(--primary-blue)' }}>
          {recommendation}
        </p>
      )}
      {(ctaLabel && (ctaTo || ctaOnClick)) && (
        <ActionCTA to={ctaTo} onClick={ctaOnClick} label={ctaLabel} variant="primary" />
      )}
    </div>
  );
}

// ─── 4. Dashboard Card Container ─────────────────────────────────────────────
export function DashboardCard({
  title,
  icon: Icon,
  headerAction,
  children,
  className = '',
  bodyClassName = ''
}) {
  return (
    <div className={`card p-5 gpu-accelerated ${className}`}>
      {(title || Icon || headerAction) && (
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2.5 font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {Icon && <Icon size={18} className="text-blue-400" />}
            <span>{title}</span>
          </div>
          {headerAction}
        </div>
      )}
      <div className={bodyClassName}>
        {children}
      </div>
    </div>
  );
}

// ─── 5. 4-State Wrapper (Loading / Error / Empty / Success) ────────────────────
export function DashboardState({
  loading,
  error,
  isEmpty,
  onRetry,
  skeletonHeight = 'h-48',
  skeletonType = 'card',
  emptyTitle,
  emptyExplanation,
  emptyRecommendation,
  emptyCtaLabel,
  emptyCtaTo,
  emptyCtaOnClick,
  emptyIcon = Sparkles,
  children
}) {
  if (loading) {
    return <SkeletonCard height={skeletonHeight} type={skeletonType} />;
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border flex items-center justify-between gap-3 text-xs" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.08)', color: '#f87171' }}>
        <div className="flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{typeof error === 'string' ? error : 'Failed to load widget data'}</span>
        </div>
        {onRetry && (
          <button onClick={onRetry} className="flex items-center gap-1 font-semibold underline hover:opacity-80">
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <EmptyStateCard
        icon={emptyIcon}
        title={emptyTitle}
        explanation={emptyExplanation}
        recommendation={emptyRecommendation}
        ctaLabel={emptyCtaLabel}
        ctaTo={emptyCtaTo}
        ctaOnClick={emptyCtaOnClick}
      />
    );
  }

  return <>{children}</>;
}

// ─── 6. Onboarding Progress Checklist & Completion Card ─────────────────────
export function ProgressChecklist({ profile, analytics, ticketsCount = 0 }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem('scholrboard_onboarding_dismissed') === 'true';
    setDismissed(isDismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('scholrboard_onboarding_dismissed', 'true');
    setDismissed(true);
  };

  if (dismissed) return null;

  // Evaluate core onboarding tasks
  const tasks = [
    {
      id: 'gpa',
      title: 'Academic Profile Complete',
      desc: 'Set your CGPA and bio in your profile',
      done: Boolean(profile?.gpa && profile?.gpa > 0),
      to: '/student/profile',
      cta: 'Update GPA',
      icon: BookOpen,
    },
    {
      id: 'activity',
      title: 'Upload First Activity / Proof',
      desc: 'Submit a certificate, workshop, or competition proof',
      done: Boolean((analytics?.activities?.Approved || 0) + (analytics?.activities?.Pending || 0) > 0),
      to: '/student/upload',
      cta: 'Upload Activity',
      icon: Award,
    },
    {
      id: 'coding',
      title: 'Connect Coding Profiles',
      desc: 'Link LeetCode or GitHub handles',
      done: Boolean(profile?.codingStats?.leetcodeProblemsSolved || profile?.codingStats?.githubContributions),
      to: '/student/coding',
      cta: 'Connect Profiles',
      icon: Code2,
    },
    {
      id: 'support',
      title: 'Explore Support & Resources',
      desc: 'Check department announcements and support desk',
      done: ticketsCount > 0,
      to: '/student/support',
      cta: 'Open Ticket',
      icon: LifeBuoy,
    },
  ];

  const completedCount = tasks.filter((t) => t.done).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);
  const isAllComplete = progressPercent === 100;
  const nextTask = tasks.find((t) => !t.done);

  // If 100% complete, show lightweight completion card with dismissal
  if (isAllComplete) {
    return (
      <div className="rounded-xl border p-5 transition-all relative overflow-hidden gpu-accelerated mb-6"
        style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
        <button onClick={handleDismiss} className="absolute top-4 right-4 text-xs subtle hover:text-white transition-colors" title="Dismiss">
          <X size={16} />
        </button>
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400 flex-shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h3 className="font-bold text-base text-emerald-400 flex items-center gap-2">
              Onboarding Complete! 🎉
            </h3>
            <p className="text-xs leading-relaxed subtle mt-1 max-w-xl">
              Great job! Your profile is fully set up. You have unlocked personalized AI recommendations, full developer score analytics, and placement readiness tracking.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1">
                <Sparkles size={14} /> AI Suggestions Unlocked
              </span>
              <button onClick={handleDismiss} className="text-xs underline subtle hover:text-white">
                Dismiss Notice
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-5 transition-all gpu-accelerated space-y-4 mb-6"
      style={{ background: 'var(--surface-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-soft)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Onboarding Checklist</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-500/10 text-blue-400">
              {progressPercent}% Complete
            </span>
          </div>
          <h3 className="font-bold text-base mt-1" style={{ color: 'var(--text-primary)' }}>
            Complete your profile to unlock full analytics
          </h3>
        </div>
        {nextTask && (
          <ActionCTA to={nextTask.to} label={nextTask.cta} icon={ChevronRight} variant="primary" />
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 rounded-full overflow-hidden bg-slate-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, var(--primary-blue), #3b82f6)' }}
        />
      </div>

      {/* Tasks Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {tasks.map((task) => {
          const TaskIcon = task.icon;
          return (
            <Link
              key={task.id}
              to={task.to}
              className={`p-3 rounded-lg border transition-all flex items-start gap-3 hover:-translate-y-0.5 ${
                task.done ? 'bg-emerald-500/5 border-emerald-500/20' : 'hover:border-blue-500/40'
              }`}
              style={{ background: task.done ? undefined : 'var(--bg-medium)', borderColor: task.done ? undefined : 'var(--border-color)' }}
            >
              <div className={`grid h-7 w-7 place-items-center rounded-md flex-shrink-0 text-xs font-bold ${
                task.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
              }`}>
                {task.done ? <CheckCircle2 size={16} /> : <TaskIcon size={16} />}
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-semibold truncate ${task.done ? 'text-emerald-400 line-through opacity-80' : 'text-slate-200'}`}>
                  {task.title}
                </div>
                <div className="text-[10px] subtle truncate mt-0.5">{task.desc}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
