/**
 * FacultyOdApprovals.jsx — Faculty Advisor review dashboard for OD Requests
 */
import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Clock, XCircle, FileText, ChevronDown, ChevronUp, X, ExternalLink } from 'lucide-react';
import odApi from '../api/od.api.js';
import { useScrollAnimation } from '../hooks/useScrollAnimation.js';

export function FacultyOdApprovals() {
  const [ods, setOds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Expanded card state to display the review remarks panel
  const [activeReviewId, setActiveReviewId] = useState(null);
  const [reviewStatus, setReviewStatus] = useState(''); // 'Approved', 'Rejected', 'Needs Revision'
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  const listRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });

  const fetchPendingOds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await odApi.getPendingOds();
      setOds(res.ods || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to fetch pending requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingOds();
  }, [fetchPendingOds]);

  const startReview = (id, initialStatus) => {
    setActiveReviewId(id);
    setReviewStatus(initialStatus);
    setRemarks('');
  };

  const submitReview = async (e, id) => {
    e.preventDefault();
    if (['Rejected', 'Needs Revision'].includes(reviewStatus) && !remarks.trim()) {
      setError(`Remarks describing the ${reviewStatus === 'Rejected' ? 'rejection' : 'required changes'} are required.`);
      return;
    }

    setSubmitting(true);
    try {
      await odApi.reviewOd(id, {
        status: reviewStatus,
        remarks: remarks.trim(),
      });

      // Remove from pending list
      setOds(prev => prev.filter(od => od._id !== id));
      setActiveReviewId(null);
      setReviewStatus('');
      setRemarks('');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div ref={headerRef} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 gpu-accelerated">
        <div>
          <h1 className="headline">On-Duty (OD) Approvals</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Review, reject, or request revisions for students requesting OD attendance exemptions.
          </p>
        </div>

        <div className="badge badge-blue">Assigned advisees only</div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-yellow-400">{ods.length}</div>
            <Clock size={20} className="text-yellow-400 opacity-50" />
          </div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Pending Reviews</div>
        </div>
      </div>

      {/* List */}
      <div ref={listRef} className="gpu-accelerated">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="skeleton h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : ods.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400 opacity-40" />
            <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>All Caught Up!</p>
            <p className="text-sm mt-1 subtle">No pending OD requests to review for the selected scope.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ods.map((od) => {
              const isCurrentReviewing = activeReviewId === od._id;
              const student = od.studentId || {};

              return (
                <div 
                  key={od._id} 
                  className="card p-5 space-y-4 border transition-all"
                  style={{ borderColor: 'var(--border-color)', background: 'var(--surface-card)' }}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Student Details */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base">{student.name || 'Unknown Student'}</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {student.studentId || 'N/A'}
                        </span>
                      </div>
                      <div className="text-xs mt-1.5 flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--text-secondary)' }}>
                        <span>Dept: {student.department || 'N/A'}</span>
                        <span>Semester: {student.semester || 'N/A'}</span>
                        <span>Requested On: {new Date(od.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Event & Proof Info */}
                    <div className="text-left md:text-right">
                      <div className="font-semibold text-sm">{od.eventName}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Event Date: {new Date(od.eventDate).toLocaleDateString()}
                      </div>
                      {od.proofUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewUrl(od.proofUrl)}
                          className="inline-flex items-center gap-1 text-xs hover:underline text-blue-400 mt-2 btn btn-outline px-3 py-1.5 font-semibold"
                        >
                          <FileText size={12} /> Preview Proof
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Review Buttons */}
                  {!isCurrentReviewing ? (
                    <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <button 
                        onClick={() => startReview(od._id, 'Approved')}
                        data-testid="approve-od"
                        className="btn btn-primary text-xs px-4 py-1.5 bg-green-600 hover:bg-green-500 border-none text-white font-semibold"
                      >
                        Approve Exempt
                      </button>
                      <button 
                        onClick={() => startReview(od._id, 'Needs Revision')}
                        className="btn btn-outline text-xs px-4 py-1.5 text-orange-400 border-orange-500/30 hover:bg-orange-500/10 font-semibold"
                      >
                        Request Revision
                      </button>
                      <button 
                        onClick={() => startReview(od._id, 'Rejected')}
                        className="btn btn-outline text-xs px-4 py-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10 font-semibold"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    /* Remarks Panel */
                    <form 
                      onSubmit={(e) => submitReview(e, od._id)} 
                      className="p-4 rounded-lg space-y-3 pt-3 border-t" 
                      style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{
                          color: reviewStatus === 'Approved' ? 'var(--success-color)' : reviewStatus === 'Needs Revision' ? '#f97316' : 'var(--danger-color)'
                        }}>
                          Reviewing: {reviewStatus}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => setActiveReviewId(null)}
                          className="text-xs subtle hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs subtle mb-1">
                          Remarks {['Rejected', 'Needs Revision'].includes(reviewStatus) ? '*' : '(Optional)'}
                        </label>
                        <textarea
                          rows="2"
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          required={['Rejected', 'Needs Revision'].includes(reviewStatus)}
                          placeholder={
                            reviewStatus === 'Approved' ? 'Excellent participation.' :
                            reviewStatus === 'Needs Revision' ? 'Please upload a clear certificate proof file.' :
                            'Rejection reason explanation.'
                          }
                          className="w-full input-dark py-2 px-3 text-sm"
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="submit"
                          data-testid="submit-od-review"
                          disabled={submitting}
                          className={`btn text-xs px-4 py-2 text-white ${
                            reviewStatus === 'Approved' ? 'bg-green-600 hover:bg-green-500' :
                            reviewStatus === 'Needs Revision' ? 'bg-orange-600 hover:bg-orange-500' :
                            'bg-red-600 hover:bg-red-500'
                          }`}
                        >
                          {submitting ? 'Submitting...' : `Submit ${reviewStatus}`}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      {/* ATTACHMENT PREVIEW MODAL */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="card w-full max-w-3xl flex flex-col p-6 space-y-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-color)' }}>
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Proof Attachment Preview</h2>
              <button 
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex items-center justify-center min-h-[45vh] max-h-[60vh] overflow-auto bg-black/20 rounded-lg p-2">
              {previewUrl.toLowerCase().includes('.pdf') ? (
                <iframe 
                  src={previewUrl} 
                  title="PDF Attachment Preview"
                  className="w-full h-[50vh] rounded border-0" 
                />
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
                  type="button"
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
    </div>
  );
}

export default FacultyOdApprovals;
