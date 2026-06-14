/**
 * FacultyDashboard.jsx — Real dynamic faculty overview
 * Fetches real stats from /api/analytics/system
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';
import usersApi from '../api/users.api.js';
import activitiesApi from '../api/activities.api.js';
import { Users, Activity, CheckCircle, AlertCircle } from 'lucide-react';
import announcementsApi from '../api/announcements.api.js';

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
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnns, setLoadingAnns] = useState(true);

  // Scroll animation hooks
  const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  
  // Staggered animations for stats cards
  const { containerRef: statsContainerRef } = useStaggeredAnimation(4, 0.1);

  useEffect(() => {
    Promise.all([usersApi.getAssignedStudents(), activitiesApi.getPending({ limit: 5 })])
      .then(([studentsRes, activitiesRes]) => setData({
        totalStudents: studentsRes?.students?.length || 0,
        activitySummary: { Pending: activitiesRes?.pagination?.totalItems || 0 },
        recentPendingActivities: activitiesRes?.activities || [],
      }))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    announcementsApi.getMyAnnouncements()
      .then((res) => setAnnouncements(res?.announcements || []))
      .catch((err) => setError(err.message || 'Failed to load announcements'))
      .finally(() => setLoadingAnns(false));
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
        <StatCard label="Assigned Queue" loading={loading} value={data?.activitySummary?.Pending} color="var(--success-color)" icon={<CheckCircle size={20} />} />
        <StatCard label="Access Scope" loading={loading} value="Advisees" color="var(--warning-color)" icon={<Activity size={20} />} />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => navigate('/faculty/approvals')}
        >
          <h2 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>📋 Review Approvals</h2>
          <p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>
            {!loading && data?.activitySummary?.Pending > 0 ? `${data.activitySummary.Pending} activities waiting for your approval` : 'Review pending student activities'}
          </p>
          <button className="btn btn-outline w-full">View Pending</button>
        </div>
        
        <div 
          className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => navigate('/faculty/students')}
        >
          <h2 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>👥 Student Tracker</h2>
          <p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>Monitor student progress and activities</p>
          <button className="btn btn-outline w-full">View Students</button>
        </div>
        
        <div 
          className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => navigate('/faculty/mentor')}
        >
          <h2 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>🎯 Student 360°</h2>
          <p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>Comprehensive student progress view</p>
          <button className="btn btn-outline w-full">View 360°</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        {/* Recent Announcements */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4" style={{color:'var(--text-primary)'}}>📢 Recent Announcements</h2>
          {loadingAnns ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-10 w-full" />)}</div>
          ) : announcements.length === 0 ? (
            <div className="text-sm subtle">No announcements posted today.</div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
              {announcements.map((ann) => (
                <div key={ann._id} className="py-2 border-b" style={{borderColor:'var(--border-color)'}}>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold" style={{color:'var(--text-primary)'}}>{ann.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      ann.category === 'Placement' ? 'bg-blue-500/20 text-blue-400' :
                      ann.category === 'Scholarship' ? 'bg-green-500/20 text-green-400' :
                      ann.category === 'Event' ? 'bg-purple-500/20 text-purple-400' :
                      ann.category === 'Academic' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-500/20 text-slate-400'
                    }`}>{ann.category}</span>
                  </div>
                  <p className="text-xs mt-1.5 leading-relaxed" style={{color:'var(--text-secondary)'}}>{ann.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
