/**
 * FacultyApprovals.jsx — Dynamic activity review dashboard
 */
import { useState, useEffect } from 'react';
import activitiesApi from '../api/activities.api.js';
import { AlertCircle, CheckCircle, XCircle, Clock, Search, ExternalLink } from 'lucide-react';

export function FacultyApprovals() {
  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await activitiesApi.getPending();
      setPendingList(res.activities || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id, status) => {
    let rejectionReason = null;
    let points = 10; // Default points, could be dynamic

    if (status === 'Rejected') {
      rejectionReason = window.prompt('Please enter a reason for rejection:');
      if (!rejectionReason) return; // Cancelled
    } else {
      if (!window.confirm('Are you sure you want to approve this activity?')) return;
      const pts = window.prompt('Assign points for this activity (default 10):', '10');
      points = parseInt(pts, 10) || 10;
    }

    try {
      await activitiesApi.review(id, { status, rejectionReason, points });
      // Remove from list after review
      setPendingList(prev => prev.filter(item => item._id !== id));
    } catch (err) {
      alert(err.message || 'Failed to review activity');
    }
  };

  const filteredPending = pendingList.filter(item => {
    const studentName = item.userId?.name || '';
    const activityName = item.title || '';
    const dept = item.userId?.department || '';

    const matchesSearch = studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          activityName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'All' || dept === filterDept;

    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Activity Approvals</h1>
        <p className="mt-2" style={{color:'var(--text-secondary)'}}>Review and approve student activity submissions</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-yellow-400">{pendingList.length}</div>
            <Clock size={20} className="text-yellow-400 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Pending Review</div>
        </div>
        <div className="card p-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-green-400">–</div>
            <CheckCircle size={20} className="text-green-400 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Approved (Total)</div>
        </div>
        <div className="card p-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-red-400">–</div>
            <XCircle size={20} className="text-red-400 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Rejected (Total)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search students or activities..."
            className="input-dark pl-9 py-2 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="input-dark px-3 py-2"
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
        >
          <option value="All">All Departments</option>
          {/* Extract unique departments from the current list for dynamic filtering */}
          {Array.from(new Set(pendingList.map(p => p.userId?.department).filter(Boolean))).map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Approvals Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{borderColor:'var(--border-color)', background: 'var(--bg-medium)'}}>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Student</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Activity</th>
                <th className="text-left py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Date</th>
                <th className="text-center py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Proof</th>
                <th className="text-right py-4 px-6 font-semibold" style={{color:'var(--text-secondary)'}}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ divideColor: 'var(--border-color)' }}>
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i}>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-32" /><div className="skeleton h-3 w-20 mt-1" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-40" /><div className="skeleton h-3 w-24 mt-1" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-5 w-24" /></td>
                    <td className="py-4 px-6 text-center"><div className="skeleton h-5 w-16 inline-block" /></td>
                    <td className="py-4 px-6"><div className="skeleton h-8 w-32 float-right" /></td>
                  </tr>
                ))
              ) : filteredPending.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-8 text-center subtle">No pending activities found.</td>
                </tr>
              ) : (
                filteredPending.map((item) => (
                  <tr key={item._id} className="hover:bg-white/5 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-medium" style={{color:'var(--text-primary)'}}>{item.userId?.name || 'Unknown User'}</div>
                      <div className="text-xs subtle mt-1">{item.userId?.studentId || 'No ID'} • {item.userId?.department || 'No Dept'}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-medium" style={{color:'var(--text-primary)'}}>{item.title}</div>
                      <div className="text-xs subtle mt-1">{item.category} {item.subCategory ? `> ${item.subCategory}` : ''}</div>
                      {item.description && <div className="text-xs subtle mt-1 max-w-xs truncate">{item.description}</div>}
                    </td>
                    <td className="py-4 px-6 subtle">
                      {new Date(item.activityDate || item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {item.proofUrl ? (
                        <a href={item.proofUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1">
                          <ExternalLink size={14} /> View
                        </a>
                      ) : (
                        <span className="text-xs subtle">No proof</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleReview(item._id, 'Approved')}
                          className="btn px-3 py-1.5 text-xs bg-green-600/20 text-green-400 hover:bg-green-600 hover:text-white border border-green-600/30"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReview(item._id, 'Rejected')}
                          className="btn px-3 py-1.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-600/30"
                        >
                          Reject
                        </button>
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
