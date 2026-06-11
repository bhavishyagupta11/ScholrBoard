/**
 * StudentOdPage.jsx — Student OD (On-Duty) Attendance Requests
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, AlertCircle, FileText, Check, Upload, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import odApi from '../api/od.api.js';
import uploadApi from '../api/upload.api.js';
import { useScrollAnimation } from '../hooks/useScrollAnimation.js';

export function StudentOdPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    eventName: '',
    eventDate: '',
  });

  const [editingOdId, setEditingOdId] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [ods, setOds] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Scroll animations
  const formAnimationRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  const historyAnimationRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });

  useEffect(() => {
    fetchOds();
  }, []);

  const fetchOds = async () => {
    setLoadingHistory(true);
    try {
      const res = await odApi.getMyOds();
      setOds(res.ods || []);
    } catch (err) {
      console.error('Failed to fetch OD requests:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError(null);
    }
  };

  const handleStartEdit = (od) => {
    setEditingOdId(od._id);
    setFormData({
      eventName: od.eventName,
      eventDate: od.eventDate ? od.eventDate.substring(0, 10) : '',
    });
    setFile(null);
    setError(null);
    setSuccess(false);
  };

  const handleCancelEdit = () => {
    setEditingOdId(null);
    setFormData({ eventName: '', eventDate: '' });
    setFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let proofUrl = undefined; // undefined means do not overwrite if editing, unless file is provided

      // Upload proof file if selected
      if (file) {
        setUploading(true);
        const uploadRes = await uploadApi.uploadProof(file);
        if (!uploadRes.proofUrl && !uploadRes.url) {
          throw new Error('Failed to upload proof document');
        }
        proofUrl = uploadRes.proofUrl || uploadRes.url;
        setUploading(false);
      }

      if (editingOdId) {
        await odApi.updateOd(editingOdId, {
          eventName: formData.eventName,
          eventDate: formData.eventDate,
          ...(proofUrl !== undefined ? { proofUrl } : {}),
        });
        setSuccess(true);
        setEditingOdId(null);
      } else {
        await odApi.requestOd({
          eventName: formData.eventName,
          eventDate: formData.eventDate,
          proofUrl: proofUrl || null,
        });
        setSuccess(true);
      }

      setFormData({ eventName: '', eventDate: '' });
      setFile(null);
      
      // Refresh list
      fetchOds();

      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to submit OD request');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="headline">On-Duty (OD) Requests</h1>
        <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
          Submit academic or extracurricular OD requests. Approved requests automatically grant attendance exemptions.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Submission Form */}
        <div ref={formAnimationRef} className="card p-6 md:col-span-1 h-fit gpu-accelerated">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            {editingOdId ? 'Revise Request' : 'New Request'}
          </h2>

          {success && (
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg text-sm bg-green-500/10 text-green-400 border border-green-500/20">
              <CheckCircle2 size={16} className="flex-shrink-0" />
              <span>{editingOdId ? 'OD request updated!' : 'OD request submitted successfully!'}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="od-event-name" className="block text-sm mb-1 subtle">Event Name *</label>
              <input
                id="od-event-name"
                data-testid="od-event-name"
                type="text"
                name="eventName"
                value={formData.eventName}
                onChange={handleInputChange}
                required
                placeholder="e.g., Inter-College Sports Meet"
                className="w-full input-dark py-2 px-3"
              />
            </div>

            <div>
              <label htmlFor="od-event-date" className="block text-sm mb-1 subtle">Event Date *</label>
              <input
                id="od-event-date"
                data-testid="od-event-date"
                type="date"
                name="eventDate"
                value={formData.eventDate}
                onChange={handleInputChange}
                required
                className="w-full input-dark py-2 px-3"
              />
            </div>

            <div>
              <label className="block text-sm mb-1 subtle">
                {editingOdId ? 'Update Proof Document' : 'Upload Proof (PDF or Image)'}
              </label>
              <div 
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-blue-500/50 transition-colors relative"
                style={{ borderColor: file ? 'var(--success-color)' : 'var(--border-color)' }}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-1">
                  <Upload size={24} className="mx-auto text-slate-400" />
                  <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                    {file ? file.name : 'Select or drop file'}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    Max 5MB (PDF/JPEG/PNG)
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                data-testid="od-submit"
                type="submit"
                disabled={loading || uploading}
                className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              >
                {loading || uploading ? (
                  <>
                    <Clock size={16} className="animate-spin" />
                    {uploading ? 'Uploading Proof...' : 'Submitting...'}
                  </>
                ) : (
                  editingOdId ? 'Update & Resubmit' : 'Submit Request'
                )}
              </button>
              {editingOdId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn btn-outline w-full py-2"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>

        {/* History List */}
        <div ref={historyAnimationRef} className="card p-6 md:col-span-2 gpu-accelerated">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>My Requests History</h2>

          {loadingHistory ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-20 w-full rounded-md" />
              ))}
            </div>
          ) : ods.length === 0 ? (
            <div className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
              <Calendar size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No OD requests found</p>
              <p className="text-sm mt-1">Submit your first OD attendance request using the form.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {ods.map((od) => (
                <div 
                  key={od._id} 
                  className="p-4 rounded-lg border flex flex-col md:flex-row md:items-start justify-between gap-4" 
                  style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                        {od.eventName}
                      </span>
                      {od.attendanceExemptionGranted && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold border border-green-500/30">
                          <CheckCircle2 size={10} /> Attendance Exempted
                        </span>
                      )}
                    </div>
                    <div className="text-xs flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--text-secondary)' }}>
                      <span>Event Date: {new Date(od.eventDate).toLocaleDateString()}</span>
                      <span>Submitted: {new Date(od.createdAt).toLocaleDateString()}</span>
                    </div>

                    {od.remarks && (
                      <div 
                        className="text-xs p-2 rounded mt-2 max-w-xl border" 
                        style={{ 
                          background: od.status === 'Needs Revision' ? 'rgba(249,115,22,0.1)' : od.status === 'Rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                          borderColor: od.status === 'Needs Revision' ? 'rgba(249,115,22,0.2)' : od.status === 'Rejected' ? 'rgba(239,68,68,0.2)' : 'var(--border-color)',
                          color: od.status === 'Needs Revision' ? '#f97316' : od.status === 'Rejected' ? 'var(--danger-color)' : 'var(--text-secondary)'
                        }}
                      >
                        <strong>Review Remarks:</strong> {od.remarks}
                      </div>
                    )}

                    {od.reviewedBy && (
                      <div className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Reviewed by {od.reviewedBy.name || 'Faculty Advisor'} on {new Date(od.reviewedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0 justify-between self-stretch">
                    <span className={`badge ${
                      od.status === 'Approved' ? 'badge-green' :
                      od.status === 'Pending' ? 'badge-yellow' :
                      od.status === 'Needs Revision' ? 'badge-orange' : 'badge-red'
                    }`}>
                      {od.status}
                    </span>

                    <div className="flex flex-col items-end gap-2 mt-auto">
                      {od.status === 'Needs Revision' && (
                        <button
                          onClick={() => handleStartEdit(od)}
                          className="text-xs text-orange-400 hover:underline font-semibold"
                        >
                          Revise Request
                        </button>
                      )}
                      {od.proofUrl && (
                        <a 
                          href={od.proofUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1 hover:underline text-blue-400"
                        >
                          <FileText size={12} /> View Proof
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentOdPage;
