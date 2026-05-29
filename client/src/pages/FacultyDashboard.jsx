/**
 * FacultyDashboard.jsx — Real dynamic faculty overview
 * Fetches real stats from /api/analytics/system
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';
import analyticsApi from '../api/analytics.api.js';
import { Users, Activity, CheckCircle, AlertCircle } from 'lucide-react';

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

export function FacultyDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Scroll animation hooks
  const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  
  // Staggered animations for stats cards
  const { containerRef: statsContainerRef } = useStaggeredAnimation(4, 0.1);

  useEffect(() => {
    analyticsApi.getSystemAnalytics()
      .then((res) => setData(res?.systemAnalytics || null))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header without Role Switcher */}
      <div ref={headerRef} className="flex justify-between items-center gpu-accelerated">
        <div>
          <h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Faculty Dashboard</h1>
          <p className="mt-2" style={{color:'var(--text-secondary)'}}>Welcome to your faculty portal</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Quick Stats */}
      <div ref={statsContainerRef} className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Students" loading={loading} value={data?.totalStudents} color="var(--primary-blue)" icon={<Users size={20} />} />
        <StatCard label="Pending Approvals" loading={loading} value={data?.activitySummary?.Pending} color="var(--primary-cyan)" icon={<Activity size={20} />} />
        <StatCard label="Approval Rate" loading={loading} value={data?.approvalRate != null ? `${data.approvalRate}%` : null} color="var(--success-color)" icon={<CheckCircle size={20} />} />
        <StatCard label="Total Activities" loading={loading} value={data?.activitySummary?.Total} color="var(--warning-color)" icon={<Activity size={20} />} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => navigate('/faculty/approvals')}
        >
          <h3 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>📋 Review Approvals</h3>
          <p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>
            {!loading && data?.activitySummary?.Pending > 0 ? `${data.activitySummary.Pending} activities waiting for your approval` : 'Review pending student activities'}
          </p>
          <button className="btn btn-outline w-full">View Pending</button>
        </div>
        
        <div 
          className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => navigate('/faculty/students')}
        >
          <h3 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>👥 Student Tracker</h3>
          <p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>Monitor student progress and activities</p>
          <button className="btn btn-outline w-full">View Students</button>
        </div>
        
        <div 
          className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => navigate('/faculty/mentor')}
        >
          <h3 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>🎯 Student 360°</h3>
          <p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>Comprehensive student progress view</p>
          <button className="btn btn-outline w-full">View 360°</button>
        </div>
      </div>

      {/* Recent Pending Activities */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4" style={{color:'var(--text-primary)'}}>Recent Pending Activities</h2>
        {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-10 w-full" />)}</div>
        ) : (data?.recentPendingActivities || []).length === 0 ? (
            <div className="text-sm subtle">No pending activities</div>
        ) : (
            <div className="space-y-3">
              {(data.recentPendingActivities || []).slice(0, 3).map((a) => (
                <div key={a._id} className="flex justify-between items-center py-3 border-b" style={{borderColor:'var(--border-color)'}}>
                  <div>
                    <div style={{color:'var(--text-primary)'}}>{a.title}</div>
                    <div className="text-sm" style={{color:'var(--text-secondary)'}}>{a.userId?.name} · {a.category}</div>
                  </div>
                  <div className="text-sm badge badge-yellow">Pending</div>
                </div>
              ))}
            </div>
        )}
      </div>

    </div>
  );
}
