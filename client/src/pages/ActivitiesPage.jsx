/**
 * ActivitiesPage.jsx — Student Activities List
 * Fetches and manages activities via API
 */
import { useEffect, useState } from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation.js';
import activitiesApi from '../api/activities.api.js';
import { Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ActivitiesPage() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  // Scroll animation hooks
  const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  const tableRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await activitiesApi.getMyActivities();
      setActivities(res.activities || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Are you sure you want to archive this activity?')) return;
    try {
      await activitiesApi.archive(id);
      setActivities(activities.filter(a => a._id !== id));
    } catch (err) {
      setError(err.message || 'Failed to delete activity');
    }
  };

  return (
    <div className="space-y-6">
      <div ref={headerRef} className="flex flex-col md:flex-row md:items-center md:justify-between gpu-accelerated gap-4">
        <div>
          <h1 className="headline">My Activities</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>Track your submissions and approval status</p>
        </div>
        <Link to="/student/upload" className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> Submit New
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div ref={tableRef} className="card p-0 overflow-hidden gpu-accelerated">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider" style={{ background: 'var(--bg-medium)', color: 'var(--text-secondary)' }}>
                <th className="px-6 py-4 font-semibold">Title</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ divideColor: 'var(--border-color)' }}>
              {loading ? (
                [1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-48" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-24" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-6 w-20 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="skeleton h-5 w-24" /></td>
                    <td className="px-6 py-4 flex justify-end"><div className="skeleton h-8 w-16" /></td>
                  </tr>
                ))
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center" style={{ color: 'var(--text-secondary)' }}>
                    No activities found. Submit your first activity to get started.
                  </td>
                </tr>
              ) : (
                activities.map((a) => (
                  <tr key={a._id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{a.title}</div>
                      {a.subCategory && <div className="text-xs subtle mt-1">{a.subCategory}</div>}
                      {a.status === 'Needs Revision' && a.reviewComments && (
                        <div className="text-xs mt-1.5 p-2 rounded max-w-md" style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', color: '#f97316' }}>
                          <strong>Revision required:</strong> {a.reviewComments}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">{a.category}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${
                        a.status === 'Approved'
                          ? 'badge-green'
                          : a.status === 'Pending'
                          ? 'badge-yellow'
                          : a.status === 'Needs Revision'
                          ? 'badge-orange'
                          : 'badge-red'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 subtle">
                      {new Date(a.activityDate || a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {(a.status === 'Pending' || a.status === 'Needs Revision') && (
                          <button onClick={() => onDelete(a._id)} className="p-1.5 rounded hover:bg-white/10 text-red-400 transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
