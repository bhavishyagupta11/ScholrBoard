/**
 * DashboardPage.jsx — Fully dynamic student dashboard
 *
 * All data is fetched from the real API:
 *   - Analytics (activity counts, streak, GPA) → /api/analytics/dashboard
 *   - Learning progress chart → /api/analytics/progress
 *   - Activities (recent 3) → /api/activities/my?limit=3
 *   - Placements (personalized) → /api/placements/my?limit=3
 *   - Events (upcoming personalized) → /api/events/my?limit=3
 *   - AI recommendations → /api/ai/recommendations
 *
 * Built with reusable Dashboard UI Primitives (DashboardState, EmptyStateCard, ProgressChecklist)
 */
import { lazy, Suspense, useEffect, useMemo, useState, useCallback } from 'react';
import { useProfile } from '../contexts/ProfileContext.jsx';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  ArrowRight, BellRing, BriefcaseBusiness, CalendarDays,
  CheckCircle2, Code2, FileText, Lightbulb, UploadCloud,
  ShieldCheck, RefreshCw, TrendingUp, Flame, BookOpen, LifeBuoy, Sparkles
} from 'lucide-react';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';
import analyticsApi from '../api/analytics.api.js';
import activitiesApi from '../api/activities.api.js';
import placementsApi from '../api/placements.api.js';
import eventsApi from '../api/events.api.js';
import aiApi from '../api/ai.api.js';
import announcementsApi from '../api/announcements.api.js';
import ticketsApi from '../api/tickets.api.js';

import {
  ProgressChecklist, DashboardCard, DashboardState, SkeletonCard, ActionCTA
} from '../components/dashboard/DashboardPrimitives.jsx';

const AcademicActivityChart = lazy(() =>
  import('../components/StudentDashboardCharts.jsx').then((m) => ({ default: m.AcademicActivityChart }))
);
const ContributionsChart = lazy(() =>
  import('../components/StudentDashboardCharts.jsx').then((m) => ({ default: m.ContributionsChart }))
);

const ChartSkeleton = () => <SkeletonCard height="h-full min-h-48" />;

// ─── Reusable stat card ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, loading, innerRef }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (loading || value == null) return;
    const numVal = parseFloat(value);
    if (isNaN(numVal)) { setCount(value); return; }
    const duration = 700;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      setCount(Number((numVal * p).toFixed(1)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, loading]);

  return (
    <div ref={innerRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
      <div className="text-sm subtle">{label}</div>
      {loading ? (
        <div className="skeleton h-9 w-20 mt-1" />
      ) : (
        <div className="text-3xl font-bold" style={{ color }}>
          {typeof value === 'string' && isNaN(parseFloat(value)) ? value : count}
        </div>
      )}
      <div className="text-xs subtle mt-1">{sub}</div>
    </div>
  );
}

export function DashboardPage() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const track = user?.trackId;

  const [analytics,        setAnalytics]        = useState(null);
  const [progress,         setProgress]         = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [placements,       setPlacements]       = useState([]);
  const [events,           setEvents]           = useState([]);
  const [recommendations,  setRecommendations]  = useState([]);
  const [announcements,    setAnnouncements]    = useState([]);
  const [tickets,          setTickets]          = useState([]);

  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingActivities,setLoadingActivities]= useState(true);
  const [loadingPlacements,setLoadingPlacements]= useState(true);
  const [loadingEvents,    setLoadingEvents]    = useState(true);
  const [loadingRecs,      setLoadingRecs]      = useState(true);
  const [loadingAnns,      setLoadingAnns]      = useState(true);
  const [loadingTickets,   setLoadingTickets]   = useState(true);

  const [analyticsError,   setAnalyticsError]   = useState(null);
  const [recsError,        setRecsError]        = useState(null);
  const [dashboardError,   setDashboardError]   = useState(null);

  const headerRef = useScrollAnimation({ direction: 'up', delay: 0.1 });
  const chartsRef = useScrollAnimation({ direction: 'up', delay: 0.3 });
  const { containerRef: statsContainerRef, setItemRef: setStatRef } = useStaggeredAnimation(4, 0.1);

  const firstName = profile?.name?.split(' ')[0] || 'there';
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Build contributions chart data from learning progress
  const contributions = useMemo(() => {
    if (!progress.length) return [];
    return progress.map((r) => ({
      d: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      c: Math.min(9, Math.floor((r.totalMinutesStudied || 0) / 10) + (r.goalAchieved ? 2 : 0)),
    }));
  }, [progress]);

  // Fetch all dashboard data in parallel
  const fetchDashboard = useCallback(async () => {
    setDashboardError(null);
    setAnalyticsError(null);
    setRecsError(null);

    // Analytics + progress
    Promise.all([
      analyticsApi.getDashboard().catch((err) => { setAnalyticsError(err.message); return null; }),
      analyticsApi.getProgress(14).catch(() => ({ progress: [] })),
    ]).then(([analyticsData, progressData]) => {
      setAnalytics(analyticsData?.analytics || null);
      setProgress(progressData?.progress || []);
    }).finally(() => setLoadingAnalytics(false));

    // Recent activities
    activitiesApi.getMyActivities({ limit: 3 }).then((data) => {
      setRecentActivities(data?.activities || []);
    }).catch((err) => setDashboardError(err.message || 'Failed to load recent activities')).finally(() => setLoadingActivities(false));

    // Personalized placements
    placementsApi.getMyPlacements({ limit: 3 }).then((data) => {
      setPlacements(data?.placements || []);
    }).catch((err) => setDashboardError(err.message || 'Failed to load placements')).finally(() => setLoadingPlacements(false));

    // Upcoming events
    eventsApi.getMyEvents({ limit: 3, upcoming: 'true' }).then((data) => {
      setEvents(data?.events || []);
    }).catch((err) => setDashboardError(err.message || 'Failed to load events')).finally(() => setLoadingEvents(false));

    // AI Recommendations
    aiApi.getRecommendations().then((data) => {
      setRecommendations(data?.recommendations || []);
    }).catch((err) => {
      setRecsError(err.message || 'AI recommendations unavailable');
    }).finally(() => setLoadingRecs(false));

    // Targeted Announcements
    announcementsApi.getMyAnnouncements().then((data) => {
      setAnnouncements(data?.announcements || []);
    }).catch((err) => setDashboardError(err.message || 'Failed to load announcements')).finally(() => setLoadingAnns(false));

    // Support tickets
    ticketsApi.getMyTickets({ limit: 3 }).then((data) => {
      setTickets(data?.tickets || []);
    }).catch((err) => console.error('Failed to load support tickets', err)).finally(() => setLoadingTickets(false));
  }, []);

  // Reactive Auto-Sync: Re-fetch dashboard data whenever profile updates in Context!
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard, profile]);

  const nextActions = [
    { title: 'Upload activity proof', desc: 'Upload certificates or event photos while they are easy to find.', to: '/student/upload', icon: <UploadCloud size={18} /> },
    { title: 'Review pending items', desc: 'A quick cleanup makes faculty approval faster.', to: '/student/activities', icon: <ShieldCheck size={18} /> },
    { title: 'Polish your portfolio', desc: 'Make your verified work easier for recruiters to scan.', to: '/student/portfolio', icon: <FileText size={18} /> },
  ];

  return (
    <div className="space-y-6">
      {dashboardError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          <BellRing size={16} /> {dashboardError}
        </div>
      )}

      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div ref={headerRef} className="gpu-accelerated rounded-xl border p-5 md:p-6" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-color)', boxShadow: 'var(--shadow-soft)' }}>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="headline">{greeting}, {firstName}</h1>
            <p className="mt-2 max-w-2xl text-sm md:text-base" style={{ color: 'var(--text-secondary)' }}>
              Here is what needs attention, what is already verified, and what can make your portfolio stronger today.
            </p>
          </div>
          {analytics?.currentStreak > 0 && (
            <div className="flex items-center gap-2 rounded-xl border px-4 py-3" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
              <Flame size={20} className="text-orange-400" />
              <div>
                <div className="text-lg font-bold text-orange-400">{analytics.currentStreak} day streak</div>
                <div className="text-xs subtle">Keep it going!</div>
              </div>
            </div>
          )}
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-6">
          {nextActions.map((action) => (
            <Link key={action.title} to={action.to} className="group rounded-lg border p-4 transition-all hover:-translate-y-0.5" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-medium)' }}>
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg flex-shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--primary-blue)' }}>{action.icon}</div>
                <div>
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <span>{action.title}</span>
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{action.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ─── Onboarding Checklist & Progress Card ─────────────────────────── */}
      <ProgressChecklist profile={profile} analytics={analytics} ticketsCount={tickets.length} />

      {/* ─── Stat Cards ─────────────────────────────────────────────────────── */}
      <div ref={statsContainerRef} className={`grid gap-4 ${(track && !track.enableCodingModule) ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
        <StatCard
          innerRef={setStatRef(0)}
          label="GPA" loading={loadingAnalytics}
          value={analytics?.gpa}
          sub={analytics?.gpa ? `Attendance: ${analytics?.attendance ?? '–'}%` : 'Update in your profile'}
          color="var(--primary-blue)"
        />
        {(!track || track.enableActivities) && (
          <StatCard
            innerRef={setStatRef(1)}
            label="Approved Activities" loading={loadingAnalytics}
            value={analytics?.activities?.Approved ?? 0}
            sub={`${analytics?.activities?.Pending ?? 0} pending review`}
            color="var(--success-color)"
          />
        )}
        {(!track || (track.enableCodingModule && track.enableDeveloperScore)) && (
          <StatCard
            innerRef={setStatRef(2)}
            label="Study This Week" loading={loadingAnalytics}
            value={analytics ? `${Math.round((analytics.weeklyStudyMinutes || 0) / 60)}h` : null}
            sub={`Longest streak: ${analytics?.longestStreak ?? 0} days`}
            color="var(--primary-blue)"
          />
        )}
        <StatCard
          innerRef={setStatRef(3)}
          label="Total Points" loading={loadingAnalytics}
          value={analytics?.totalPoints ?? 0}
          sub={analytics?.percentileRank ? `Top ${100 - Math.round(analytics.percentileRank)}% of your batch` : 'Earn points by getting activities approved'}
          color="var(--warning-color)"
        />
      </div>

      {/* ─── Track & Career Progress & Support Ticket Summary ───────────────── */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Track Widget */}
        <DashboardCard title="Active Track">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{track?.icon || '📚'}</span>
            <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
              {track?.name || 'Assigned Track'}
            </h3>
          </div>
          <p className="text-xs leading-relaxed subtle mb-3">
            {track?.description || 'Customized platform modules mapped to your degree branch.'}
          </p>
          <div className="flex flex-wrap gap-1">
            {(!track || track.enableCodingModule) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-medium">Coding</span>}
            {(!track || track.enablePlacements) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-medium">Placements</span>}
            {(!track || track.enableInternships) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-medium">Internships</span>}
            {(!track || track.enableResearch) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">Research</span>}
            {(!track || track.enableCertifications) && <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-medium">Certificates</span>}
          </div>
        </DashboardCard>

        {/* Career Progress Widget */}
        <DashboardCard title="Career Readiness Progress">
          <div className="space-y-2">
            {[
              { label: 'Academic profile complete (GPA set)', done: Boolean(analytics?.gpa && analytics?.gpa > 0) },
              { label: 'Activity verified by Faculty Mentor', done: (analytics?.activities?.Approved || 0) > 0 },
              { label: 'Support desk registered', done: tickets.length > 0 }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className={item.done ? 'text-green-400 font-bold' : 'text-slate-500'}>
                  {item.done ? '✓' : '○'}
                </span>
                <span className={item.done ? 'text-slate-300' : 'text-slate-500'}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Ticket Summary Widget */}
        <DashboardCard title="Support Ticket Summary">
          <div className="grid grid-cols-3 gap-1.5 text-center mb-3">
            <div className="p-1.5 rounded bg-blue-500/10">
              <div className="text-base font-bold text-blue-400">
                {tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length}
              </div>
              <div className="text-[9px] subtle">Active</div>
            </div>
            <div className="p-1.5 rounded bg-green-500/10">
              <div className="text-base font-bold text-green-400">
                {tickets.filter(t => t.status === 'resolved').length}
              </div>
              <div className="text-[9px] subtle">Resolved</div>
            </div>
            <div className="p-1.5 rounded bg-slate-500/10">
              <div className="text-base font-bold text-slate-400">
                {tickets.filter(t => t.status === 'closed').length}
              </div>
              <div className="text-[9px] subtle">Closed</div>
            </div>
          </div>
          <Link to="/student/support" className="text-xs flex items-center justify-between text-blue-400 hover:underline">
            <span>Access Support Desk</span> <ArrowRight size={12} />
          </Link>
        </DashboardCard>
      </div>

      {/* ─── Charts ─────────────────────────────────────────────────────────── */}
      <div ref={chartsRef} className={`grid gap-4 gpu-accelerated ${(track && !track.enableCodingModule) ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
        {(!track || track.enableActivities) && (
          <DashboardCard title="Activity Distribution" icon={TrendingUp}>
            <div className="h-64">
              <Suspense fallback={<ChartSkeleton />}>
                <AcademicActivityChart activities={analytics?.activities} />
              </Suspense>
            </div>
          </DashboardCard>
        )}
        {(!track || (track.enableCodingModule && track.enableDeveloperScore)) && (
          <DashboardCard title="Daily Study (last 14 days)" icon={BookOpen}>
            <div className="h-64">
              <Suspense fallback={<ChartSkeleton />}>
                <ContributionsChart contributions={contributions} />
              </Suspense>
            </div>
          </DashboardCard>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ─── Recent Activities ───────────────────────────────────────────────── */}
        <DashboardCard
          title="Recent Activity Submissions"
          headerAction={<Link to="/student/activities" className="text-xs text-blue-400 hover:underline">View all →</Link>}
        >
          <DashboardState
            loading={loadingActivities}
            error={null}
            isEmpty={recentActivities.length === 0}
            emptyIcon={UploadCloud}
            emptyTitle="No activity submissions found"
            emptyExplanation="You haven't submitted any activities or certificates yet."
            emptyRecommendation="Upload certificates, workshop proofs, or competition achievements."
            emptyCtaLabel="Upload Activity"
            emptyCtaTo="/student/upload"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2">Title</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivities.map((r) => (
                    <tr key={r._id} className="border-t hover:bg-white/5 transition-colors">
                      <td className="py-2">{r.title}</td>
                      <td className="py-2">{r.category}</td>
                      <td className="py-2">
                        <span className={`badge ${r.status === 'Approved' ? 'badge-green' : r.status === 'Pending' ? 'badge-yellow' : 'badge-red'}`}>{r.status}</span>
                      </td>
                      <td className="py-2 subtle">{new Date(r.activityDate || r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardState>
        </DashboardCard>

        {/* ─── Support Tickets ───────────────────────────────────────────────── */}
        <DashboardCard
          title="My Support Tickets"
          icon={LifeBuoy}
          headerAction={<Link to="/student/support" className="text-xs text-blue-400 hover:underline">View all / Create →</Link>}
        >
          <DashboardState
            loading={loadingTickets}
            error={null}
            isEmpty={tickets.length === 0}
            emptyIcon={LifeBuoy}
            emptyTitle="No support tickets requested"
            emptyExplanation="Have questions about activity verification or platform features?"
            emptyRecommendation="Open a support ticket to get help from your department admin."
            emptyCtaLabel="Create Ticket"
            emptyCtaTo="/student/support"
          >
            <div className="space-y-3">
              {tickets.map((t) => (
                <div key={t._id} className="p-3 rounded-md border" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        #{t.ticketNumber}: {t.subject}
                      </div>
                      <div className="text-xs subtle mt-1">
                        Category: {t.category} · Updated {new Date(t.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                      t.status === 'open' ? 'bg-blue-500/20 text-blue-400' :
                      t.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                      t.status === 'waiting_for_response' ? 'bg-purple-500/20 text-purple-400' :
                      t.status === 'resolved' ? 'bg-green-500/20 text-green-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </DashboardState>
        </DashboardCard>
      </div>

      {/* ─── AI Recommendations ──────────────────────────────────────────────── */}
      <DashboardCard
        title="AI Smart Suggestions"
        icon={Lightbulb}
        headerAction={recsError ? (
          <button onClick={() => { setRecsError(null); setLoadingRecs(true); aiApi.getRecommendations().then((d) => setRecommendations(d?.recommendations || [])).catch((err) => setRecsError(err.message)).finally(() => setLoadingRecs(false)); }} className="flex items-center gap-1 text-xs text-blue-400">
            <RefreshCw size={12} /> Retry
          </button>
        ) : null}
      >
        <DashboardState
          loading={loadingRecs}
          error={recsError}
          isEmpty={recommendations.length === 0}
          onRetry={() => { setRecsError(null); setLoadingRecs(true); aiApi.getRecommendations().then((d) => setRecommendations(d?.recommendations || [])).catch((err) => setRecsError(err.message)).finally(() => setLoadingRecs(false)); }}
          emptyIcon={Sparkles}
          emptyTitle="No AI suggestions available"
          emptyExplanation="Personalized AI recommendations require profile details and activities."
          emptyRecommendation="Fill out your bio, skills, and target career goals in your profile."
          emptyCtaLabel="Complete Profile"
          emptyCtaTo="/student/profile"
        >
          <div className="space-y-3">
            {recommendations.map((rec, i) => (
              <div key={i} className="p-3 rounded-md border-l-4" style={{
                background: 'var(--bg-medium)',
                borderLeftColor: rec.priority === 'high' ? 'var(--danger-color)' : rec.priority === 'medium' ? 'var(--primary-blue)' : 'var(--success-color)',
              }}>
                <div className="text-sm">{rec.text}</div>
                <div className="text-xs mt-1 flex items-center gap-2" style={{ color: rec.priority === 'high' ? 'var(--danger-color)' : 'var(--primary-blue)' }}>
                  <span>{rec.priority?.toUpperCase()} PRIORITY</span>
                  {rec.category && <span className="opacity-60">· {rec.category}</span>}
                </div>
              </div>
            ))}
          </div>
        </DashboardState>
      </DashboardCard>

      {/* ─── Announcements ─────────────────────────────────────────────────── */}
      <DashboardCard title="Targeted Announcements" icon={BellRing}>
        <DashboardState
          loading={loadingAnns}
          error={null}
          isEmpty={announcements.length === 0}
          emptyIcon={BellRing}
          emptyTitle="No announcements today"
          emptyExplanation="There are no active announcements posted for your department right now."
          emptyRecommendation="Check back later for university updates and deadline notifications."
        >
          <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
            {announcements.map((ann) => (
              <div key={ann._id} className="p-3 rounded-md border" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
                <div className="flex justify-between items-start">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{ann.title}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
                    ann.category === 'Placement' ? 'bg-blue-500/20 text-blue-400' :
                    ann.category === 'Scholarship' ? 'bg-green-500/20 text-green-400' :
                    ann.category === 'Event' ? 'bg-purple-500/20 text-purple-400' :
                    ann.category === 'Academic' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-500/20 text-slate-400'
                  }`}>
                    {ann.category}
                  </span>
                </div>
                <p className="text-xs subtle mt-1.5 leading-relaxed">{ann.content}</p>
                <div className="text-[10px] subtle mt-2 text-right">
                  Posted by {ann.postedBy?.name || 'Admin'} on {new Date(ann.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </DashboardState>
      </DashboardCard>

      {/* ─── Placements + Events ─────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Personalized Placements */}
        <DashboardCard
          title="Placements & Internships"
          icon={BriefcaseBusiness}
          headerAction={<Link to="/student/placements" className="text-xs text-blue-400 hover:underline">View all →</Link>}
        >
          <DashboardState
            loading={loadingPlacements}
            error={null}
            isEmpty={placements.length === 0}
            emptyIcon={BriefcaseBusiness}
            emptyTitle="No placement drives found"
            emptyExplanation="No active placement drives matching your profile currently."
            emptyRecommendation="Keep your profile skills and resume updated for upcoming recruiter postings."
            emptyCtaLabel="View Placements"
            emptyCtaTo="/student/placements"
          >
            <div className="space-y-3">
              {placements.map((job) => (
                <div key={job._id} className="p-3 rounded-md border hover:border-blue-500/30 transition-colors" style={{ background: 'var(--bg-medium)', border: '1px solid var(--border-color)' }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{job.company}</div>
                      <div className="text-sm text-blue-400">{job.role}</div>
                      <div className="text-xs subtle">Deadline: {new Date(job.deadline).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-green-400">{job.package || job.stipend || '–'}</div>
                      <span className={`text-xs px-2 py-1 rounded ${job.jobType === 'Internship' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {job.jobType}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <button
                      onClick={() => placementsApi.apply(job._id).catch((err) => setDashboardError(err.message || 'Failed to apply'))}
                      className="btn btn-primary text-xs px-3 py-1"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </DashboardState>
        </DashboardCard>

        {/* Upcoming Events */}
        <DashboardCard
          title="Upcoming Events"
          icon={CalendarDays}
          headerAction={<Link to="/student/events" className="text-xs text-blue-400 hover:underline">View all →</Link>}
        >
          <DashboardState
            loading={loadingEvents}
            error={null}
            isEmpty={events.length === 0}
            emptyIcon={CalendarDays}
            emptyTitle="No upcoming events"
            emptyExplanation="There are no upcoming hackathons, guest lectures, or workshops scheduled right now."
            emptyRecommendation="Check back soon for university events."
            emptyCtaLabel="Browse Events"
            emptyCtaTo="/student/events"
          >
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event._id} className="p-3 rounded-md border hover:border-green-500/30 transition-colors" style={{ background: 'var(--bg-medium)', border: '1px solid var(--border-color)' }}>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{event.title}</div>
                  <div className="text-sm text-cyan-400 mt-1">
                    {new Date(event.startDate).toLocaleDateString()} {event.startTime ? `at ${event.startTime}` : ''}
                  </div>
                  {event.venue && <div className="text-xs subtle">Venue: {event.venue}</div>}
                  {event.requiresRegistration && (
                    <div className="mt-2">
                      {event.isRegistered ? (
                        <span className="badge badge-green text-xs font-semibold py-1 px-2.5 flex items-center gap-1 w-fit">
                          <CheckCircle2 size={13} /> Registered
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            eventsApi.register(event._id)
                              .then(() => fetchDashboard())
                              .catch((err) => setDashboardError(err.message || 'Failed to register for event'));
                          }}
                          className="btn btn-primary text-xs px-3 py-1 flex items-center gap-1"
                        >
                          <CheckCircle2 size={13} /> Register
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </DashboardState>
        </DashboardCard>
      </div>

      {/* ─── Quick Links ─────────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { title: 'Portfolio', desc: 'View and share your verified portfolio', to: '/student/portfolio', icon: <FileText size={18} /> },
          { title: 'Coding Profiles', desc: 'See your coding stats across platforms', to: '/student/coding', icon: <Code2 size={18} />, enabled: !track || (track.enableCodingModule && track.enableDeveloperScore) },
          { title: 'Resume Analyzer', desc: 'Upload and analyze your resume with AI', to: '/student/resume-analyzer', icon: <UploadCloud size={18} /> },
        ].filter(item => item.enabled !== false).map((c) => (
          <Link key={c.title} to={c.to} className="card p-4 flex items-start gap-3 hover:opacity-90">
            <div className="grid h-9 w-9 place-items-center rounded-lg flex-shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--primary-blue)' }}>{c.icon}</div>
            <div>
              <div className="font-semibold text-sm">{c.title}</div>
              <div className="text-xs subtle">{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
