/**
 * AdminDashboard.jsx — Real dynamic admin overview
 * Fetches real stats from /api/analytics/system
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';
import analyticsApi from '../api/analytics.api.js';
import { Users, Activity, CheckCircle, TrendingUp, AlertCircle } from 'lucide-react';

function StatCard({ label, value, color, icon, loading }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ color }}>{icon}</div>
      </div>
      {loading ? (
        <div className="skeleton h-9 w-24" />
      ) : (
        <div className="text-3xl font-bold" style={{ color }}>{value ?? '–'}</div>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  const { containerRef: statsContainerRef } = useStaggeredAnimation(4, 0.1);

  useEffect(() => {
    analyticsApi.getSystemAnalytics()
      .then((res) => setData(res?.systemAnalytics || null))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div ref={headerRef} className="flex justify-between items-center gpu-accelerated">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Dashboard</h1>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>Complete system administration and oversight</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Real stats */}
      <div ref={statsContainerRef} className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Students" loading={loading} value={data?.totalStudents} color="var(--primary-blue)" icon={<Users size={20} />} />
        <StatCard label="Total Activities" loading={loading} value={data?.activitySummary?.Total} color="var(--primary-cyan)" icon={<Activity size={20} />} />
        <StatCard label="Approval Rate" loading={loading} value={data?.approvalRate != null ? `${data.approvalRate}%` : null} color="var(--success-color)" icon={<CheckCircle size={20} />} />
        <StatCard label="Total Faculty" loading={loading} value={data?.totalFaculty} color="var(--warning-color)" icon={<TrendingUp size={20} />} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: '📊 Analytics & Reports', desc: 'Generate NAAC/NIRF reports and view analytics', path: '/admin/analytics', btn: 'View Analytics' },
          { title: '💼 Placements & Internships', desc: 'Manage job postings and internship opportunities', path: '/admin/placements', btn: 'Manage Placements' },
          { title: '📅 Events Management', desc: 'Organize and manage university events', path: '/admin/events', btn: 'Manage Events' },
          { title: '🔍 Talent Discovery', desc: 'Search and filter student profiles by developer score, skills, and resume ATS', path: '/admin/talent-discovery', btn: 'Discover Talent' },
        ].map((card) => (
          <div key={card.title} className="card p-6 cursor-pointer hover:bg-white/5 transition-colors flex flex-col justify-between" onClick={() => navigate(card.path)}>
            <div>
              <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{card.title}</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{card.desc}</p>
            </div>
            <button className="btn btn-outline w-full">{card.btn}</button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => navigate('/admin/approvals')}>
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>📋 Activity Approvals</h2>
          {!loading && data?.activitySummary?.Pending > 0 && (
            <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold" style={{ background: 'rgba(234,179,8,0.2)', color: 'var(--warning-color)' }}>
              {data.activitySummary.Pending} pending review
            </div>
          )}
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Review and approve student activities</p>
          <button className="btn btn-outline w-full">Review Approvals</button>
        </div>
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>📋 Recent Pending Activities</h2>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-10 w-full" />)}</div>
          ) : (data?.recentPendingActivities || []).length === 0 ? (
            <div className="text-sm subtle">No pending activities</div>
          ) : (
            <div className="space-y-2">
              {(data.recentPendingActivities || []).slice(0, 5).map((a) => (
                <div key={a._id} className="flex justify-between items-center text-sm p-2 rounded" style={{ background: 'var(--bg-medium)' }}>
                  <div>
                    <div style={{ color: 'var(--text-primary)' }}>{a.title}</div>
                    <div className="subtle">{a.userId?.name} · {a.category}</div>
                  </div>
                  <span className="badge badge-yellow">Pending</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
