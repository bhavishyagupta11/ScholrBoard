/**
 * CoordinatorDashboard.jsx — Department Coordinator dashboard
 *
 * Routing: /coordinator (role: department_coordinator)
 * Layout: FacultyLayout (reused per spec)
 *
 * Coordinator sees:
 *  - Department student count
 *  - Department ticket summary
 *  - Quick actions for department management
 *
 * Scoped to department only — does NOT have admin-level system visibility.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Users, LifeBuoy, BookOpen, AlertCircle } from 'lucide-react';
import usersApi from '../api/users.api.js';
import ticketsApi from '../api/tickets.api.js';

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

export function CoordinatorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [ticketSummary, setTicketSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      usersApi.getAssignedStudents().catch(() => ({ students: [] })),
      ticketsApi.getTicketSummary().catch(() => ({ summary: null })),
    ]).then(([studentsRes, ticketRes]) => {
      setStudents(studentsRes?.students || []);
      setTicketSummary(ticketRes?.summary || null);
    }).catch(err => {
      setError(err.message || 'Failed to load dashboard data');
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Department Coordinator
        </h1>
        <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
          {user?.department ? `Managing ${user.department} department` : 'Department overview'}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          label="Department Students"
          loading={loading}
          value={students.length}
          color="var(--primary-blue)"
          icon={<Users size={20} />}
        />
        <StatCard
          label="Open Tickets"
          loading={loading}
          value={ticketSummary?.open}
          color="var(--warning-color)"
          icon={<LifeBuoy size={20} />}
        />
        <StatCard
          label="In Progress"
          loading={loading}
          value={ticketSummary?.in_progress}
          color="var(--primary-cyan)"
          icon={<BookOpen size={20} />}
        />
        <StatCard
          label="Resolved"
          loading={loading}
          value={ticketSummary?.resolved}
          color="var(--success-color)"
          icon={<LifeBuoy size={20} />}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => navigate('/coordinator/students')}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>👥 Department Students</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            View and monitor all students in {user?.department || 'your department'}
          </p>
          <button className="btn btn-outline w-full">View Students</button>
        </div>

        <div
          className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => navigate('/coordinator/support')}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>🎫 Department Tickets</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            {!loading && ticketSummary?.open > 0
              ? `${ticketSummary.open} open ticket${ticketSummary.open !== 1 ? 's' : ''} need attention`
              : 'View and manage department support tickets'}
          </p>
          <button className="btn btn-outline w-full">View Tickets</button>
        </div>

        <div
          className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => navigate('/coordinator/approvals')}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>📋 Activity Approvals</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Review pending activity submissions from department students
          </p>
          <button className="btn btn-outline w-full">Review Activities</button>
        </div>
      </div>

      {/* Department students preview */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>📚 Recent Department Students</h2>
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-12 w-full" />)}</div>
        ) : students.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No students found in your department.</p>
        ) : (
          <div className="space-y-2">
            {students.slice(0, 5).map(s => (
              <div key={s._id} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-medium)' }}>
                <div>
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                  <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{s.studentId} · Sem {s.semester}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.verified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {s.verified ? 'Verified' : 'Pending'}
                </span>
              </div>
            ))}
            {students.length > 5 && (
              <button onClick={() => navigate('/coordinator/students')} className="text-sm font-medium mt-2" style={{ color: 'var(--accent)' }}>
                View all {students.length} students →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
