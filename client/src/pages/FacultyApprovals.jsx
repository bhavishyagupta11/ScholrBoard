/**
 * FacultyApprovals.jsx — Dynamic activity review dashboard with proof preview
 */
import { useState, useEffect } from 'react';
import activitiesApi from '../api/activities.api.js';
import { BASE_URL } from '../api/index.js';
import { usePdfBlob } from '../hooks/usePdfBlob.js';
import analyticsApi from '../api/analytics.api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { AlertCircle, CheckCircle, XCircle, Clock, Search, ExternalLink, X } from 'lucide-react';

export function FacultyApprovals() {
  const { user } = useAuth();
  const role = user?.role || localStorage.getItem('role');

  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ Pending: 0, Approved: 0, Rejected: 0 });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('All');
  
  // Preview modal state
  const [previewUrl, setPreviewUrl] = useState(null);

  const proxyEndpoint = previewUrl?.toLowerCase().includes('.pdf') ? `/upload/proxy?url=${encodeURIComponent(previewUrl)}` : null;
  const { blobUrl, loading: pdfLoading, error: pdfError } = usePdfBlob(proxyEndpoint);

  useEffect(() => {
    fetchPending();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      let res;
      if (role === 'admin') {
        res = await analyticsApi.getSystemAnalytics();
        if (res.success && res.systemAnalytics?.activitySummary) {
          setStats(res.systemAnalytics.activitySummary);
        }
      } else {
        res = await analyticsApi.getFacultyActivityStats();
        if (res.success) {
          setStats({
            Pending: res.pending ?? 0,
            Approved: res.approved ?? 0,
            Rejected: res.rejected ?? 0
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

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
    let reviewComments = null;

    if (status === 'Rejected') {
      rejectionReason = window.prompt('Please enter a reason for rejection:');
      if (!rejectionReason) return; // Cancelled
    } else if (status === 'Needs Revision') {
      reviewComments = window.prompt('Specify the changes / revision feedback required:');
      if (!reviewComments) return; // Cancelled
    } else {
      if (!window.confirm('Are you sure you want to approve this activity? Points will be calculated automatically by the system.')) return;
    }

    try {
      await activitiesApi.review(id, { status, rejectionReason, reviewComments });
      // Remove from list after review
      setPendingList(prev => prev.filter(item => item._id !== id));
      fetchStats();
    } catch (err) {
      setError(err.message || 'Failed to review activity');
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
            <div className="text-2xl font-bold text-yellow-400">{stats.Pending}</div>
            <Clock size={20} className="text-yellow-400 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Pending Review</div>
        </div>
        <div className="card p-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-green-400">{stats.Approved}</div>
            <CheckCircle size={20} className="text-green-400 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Approved (Total)</div>
        </div>
        <div className="card p-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-red-400">{stats.Rejected}</div>
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
                    <td className="py-4 px-6 text-center animate-pulse-on-hover">
                      {item.proofUrl ? (
                        <button
                          onClick={() => setPreviewUrl(item.proofUrl)}
                          className="btn btn-outline text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold"
                        >
                          <ExternalLink size={12} /> Preview
                        </button>
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
                          onClick={() => handleReview(item._id, 'Needs Revision')}
                          className="btn px-3 py-1.5 text-xs bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600 hover:text-white border border-yellow-600/30"
                        >
                          Request Revision
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

      {/* ATTACHMENT PREVIEW MODAL */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="card w-full max-w-3xl flex flex-col p-6 space-y-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-color)' }}>
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Proof Attachment Preview</h2>
              <button 
                onClick={() => setPreviewUrl(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex items-center justify-center min-h-[45vh] max-h-[60vh] overflow-auto bg-black/20 rounded-lg p-2">
              {previewUrl.toLowerCase().includes('.pdf') ? (
                pdfLoading ? (
                  <div className="flex flex-col items-center justify-center p-8">
                    <span className="loader"></span>
                    <p className="mt-4 text-sm text-slate-400">Loading PDF securely...</p>
                  </div>
                ) : pdfError ? (
                  <div className="text-red-400 text-sm">Failed to load PDF: {pdfError}</div>
                ) : (
                  <iframe 
                    src={blobUrl} 
                    title="PDF Attachment Preview"
                    className="w-full h-[50vh] rounded border-0" 
                  />
                )
              ) : (
                <img 
                  src={previewUrl} 
                  alt="Attachment Preview" 
                  className="max-w-full max-h-[50vh] object-contain rounded" 
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <a 
                href={previewUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-outline text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <ExternalLink size={14} /> Open in New Tab
              </a>
              <div className="flex gap-2">
                <a 
                  href={previewUrl} 
                  download 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-outline text-xs px-4 py-2"
                >
                  Download File
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="btn btn-primary text-xs px-4 py-2"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
