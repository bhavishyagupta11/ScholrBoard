/**
 * CoordinatorDashboard.jsx — Department Coordinator dashboard
 *
 * Routing: /faculty (role: faculty + facultyLevel: coordinator)
 * Layout: FacultyLayout (reused per spec)
 *
 * Coordinator sees:
 *  - Department student counts (Total, Active, Placement Ready, At Risk)
 *  - Faculty advisor metrics (Total Faculty, Workload, Pending Approvals, Pending ODs)
 *  - Support Ticket metrics (Open, Resolved, Escalated)
 *
 * Scoped to department only — does NOT have admin-level system visibility.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { 
  Users, 
  LifeBuoy, 
  BookOpen, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  UserCheck, 
  ShieldAlert, 
  Clock, 
  Briefcase 
} from 'lucide-react';
import usersApi from '../api/users.api.js';
import analyticsApi from '../api/analytics.api.js';

function StatCard({ label, value, color, icon, loading, subtitle }) {
  return (
    <div className="card p-6 flex flex-col justify-between hover:translate-y-[-2px] transition-transform duration-200" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-color)' }}>
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</div>
          <div className="p-2 rounded-lg" style={{ background: `rgba(${color}, 0.1)`, color: `rgb(${color})` }}>{icon}</div>
        </div>
        <div className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {loading ? <div className="skeleton h-8 w-20" /> : (value ?? '0')}
        </div>
      </div>
      {subtitle && (
        <div className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

export function CoordinatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      analyticsApi.getCoordinatorAnalytics().catch((err) => {
        console.error('Coordinator analytics fetch error:', err);
        throw new Error('Failed to load department analytics stats.');
      }),
      usersApi.getAssignedStudents().catch(() => ({ students: [] })),
    ])
      .then(([analyticsRes, studentsRes]) => {
        setStats(analyticsRes?.stats || null);
        setStudents(studentsRes?.students || []);
      })
      .catch(err => {
        setError(err.message || 'Failed to load coordinator dashboard data');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Department Coordinator Portal
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {user?.department 
              ? `Operational oversight, analytics, and workflow management for ${user.department}` 
              : 'Scoped department management'}
          </p>
        </div>
        <span className="badge badge-blue text-xs font-semibold px-3 py-1">
          {user?.department || 'Department View'}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* --- Section 1: Students Performance --- */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Students Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            label="Total Students"
            loading={loading}
            value={stats?.students?.total}
            color="59, 130, 246" // Blue
            icon={<Users size={20} />}
            subtitle="Registered in department"
          />
          <StatCard
            label="Active Students"
            loading={loading}
            value={stats?.students?.active}
            color="6, 182, 212" // Cyan
            icon={<UserCheck size={20} />}
            subtitle="Currently active students"
          />
          <StatCard
            label="Placement Ready"
            loading={loading}
            value={stats?.students?.placementReady}
            color="34, 197, 94" // Green
            icon={<Briefcase size={20} />}
            subtitle="Ready for drive (Score >= 75)"
          />
          <StatCard
            label="At Risk"
            loading={loading}
            value={stats?.students?.atRisk}
            color="239, 68, 68" // Red
            icon={<ShieldAlert size={20} />}
            subtitle="GPA < 6 / Attendance < 75% / Backlogs"
          />
        </div>
      </div>

      {/* --- Section 2: Faculty & Operations --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Operations (Approvals / ODs) */}
        <div className="card p-6 flex flex-col justify-between lg:col-span-2" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-color)' }}>
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Faculty & Academic Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              
              <div className="p-4 rounded-lg flex flex-col justify-between" style={{ background: 'var(--bg-medium)' }}>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Total Faculty</span>
                  <span className="text-blue-400"><TrendingUp size={16} /></span>
                </div>
                <div className="text-2xl font-bold mt-2" style={{ color: 'var(--text-primary)' }}>
                  {loading ? '...' : (stats?.faculty?.total ?? 0)}
                </div>
              </div>

              <div className="p-4 rounded-lg flex flex-col justify-between cursor-pointer hover:bg-white/5 transition-colors" style={{ background: 'var(--bg-medium)' }} onClick={() => navigate('/faculty/approvals')}>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Pending Approvals</span>
                  <span className="text-yellow-400"><BookOpen size={16} /></span>
                </div>
                <div className="text-2xl font-bold mt-2 text-yellow-400">
                  {loading ? '...' : (stats?.faculty?.pendingApprovals ?? 0)}
                </div>
              </div>

              <div className="p-4 rounded-lg flex flex-col justify-between cursor-pointer hover:bg-white/5 transition-colors" style={{ background: 'var(--bg-medium)' }} onClick={() => navigate('/faculty/approvals')}>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Pending OD Requests</span>
                  <span className="text-cyan-400"><Clock size={16} /></span>
                </div>
                <div className="text-2xl font-bold mt-2 text-cyan-400">
                  {loading ? '...' : (stats?.faculty?.pendingOds ?? 0)}
                </div>
              </div>

            </div>
            
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Coordinators maintain oversight over all pending activity verification steps and OD requests submitted by students in {user?.department || 'their department'}.
            </p>
          </div>
          <div className="mt-6 flex gap-4">
            <button className="btn btn-outline flex-1" onClick={() => navigate('/faculty/approvals')}>
              Review Activities
            </button>
          </div>
        </div>

        {/* Tickets Breakdown */}
        <div className="card p-6 flex flex-col justify-between" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-color)' }}>
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <LifeBuoy size={20} className="text-blue-400" /> Support Tickets
            </h3>
            
            <div className="space-y-3 my-4">
              <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'var(--bg-medium)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Open Tickets</span>
                <span className="text-lg font-bold text-blue-400">{loading ? '...' : (stats?.tickets?.open ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'var(--bg-medium)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Escalated (Urgent/High)</span>
                <span className="text-lg font-bold text-red-400">{loading ? '...' : (stats?.tickets?.escalated ?? 0)}</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: 'var(--bg-medium)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Resolved Tickets</span>
                <span className="text-lg font-bold text-green-400">{loading ? '...' : (stats?.tickets?.resolved ?? 0)}</span>
              </div>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Department tickets include direct inquiries from students to faculty or department coordinators.
            </p>
          </div>
          <button className="btn btn-outline w-full mt-6" onClick={() => navigate('/faculty/support')}>
            Manage Department Tickets
          </button>
        </div>

      </div>

      {/* --- Section 3: Workload & Student List Preview --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Advisor Workload */}
        <div className="card p-6" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-color)' }}>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Faculty Advisor Workload</h3>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-12 w-full" />)}</div>
          ) : !stats?.faculty?.workload || stats.faculty.workload.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--text-secondary)' }}>No faculty registered in department.</p>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {stats.faculty.workload.map(fac => (
                <div key={fac.facultyId} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-medium)' }}>
                  <div>
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{fac.name}</span>
                    <span className="text-xs block" style={{ color: 'var(--text-secondary)' }}>Faculty Advisor</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fac.adviseeCount}</span>
                    <span className="text-[10px] block" style={{ color: 'var(--text-secondary)' }}>Advisees</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Department Students */}
        <div className="card p-6" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-color)' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Department Students</h3>
            <button className="text-xs text-blue-400 hover:underline" onClick={() => navigate('/faculty/students')}>
              View All
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-12 w-full" />)}</div>
          ) : students.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--text-secondary)' }}>No students found in your department.</p>
          ) : (
            <div className="space-y-3">
              {students.slice(0, 5).map(s => (
                <div key={s._id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-medium)' }}>
                  <div>
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                    <span className="text-xs block" style={{ color: 'var(--text-secondary)' }}>{s.studentId} · Sem {s.semester}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${s.verified ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                    {s.verified ? 'Verified' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
