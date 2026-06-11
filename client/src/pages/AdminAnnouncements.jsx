/**
 * AdminAnnouncements.jsx — Admin dashboard for posting announcements and tracking OD requests
 */
import { useState, useEffect, useCallback } from 'react';
import { Megaphone, Trash2, Calendar, AlertCircle, CheckCircle2, Search, ChevronLeft, ChevronRight, FileText, Info } from 'lucide-react';
import announcementsApi from '../api/announcements.api.js';
import odApi from '../api/od.api.js';
import { useScrollAnimation } from '../hooks/useScrollAnimation.js';

export function AdminAnnouncements() {
  // --- Announcements state ---
  const [anns, setAnns] = useState([]);
  const [loadingAnns, setLoadingAnns] = useState(true);
  
  // Compose form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [deptFilter, setDeptFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [annSuccess, setAnnSuccess] = useState(false);
  const [annError, setAnnError] = useState(null);

  // --- OD Requests Tracker state ---
  const [ods, setOds] = useState([]);
  const [loadingOds, setLoadingOds] = useState(true);
  const [odStatusFilter, setOdStatusFilter] = useState('');
  const [odPage, setOdPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Tabs: 'compose' (Announcements) or 'od-tracker' (OD request lists)
  const [activeTab, setActiveTab] = useState('compose');

  const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  const contentRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });

  const fetchAnnouncements = useCallback(async () => {
    setLoadingAnns(true);
    try {
      // announcementsApi.getMyAnnouncements returns announcements filtered for current user,
      // but since admin is logged in, this returns all admin-composed/matching alerts.
      const res = await announcementsApi.getMyAnnouncements();
      setAnns(res.announcements || []);
    } catch (err) {
      setAnnError(err.message || 'Failed to load announcements');
    } finally {
      setLoadingAnns(false);
    }
  }, []);

  const fetchOds = useCallback(async () => {
    setLoadingOds(true);
    try {
      const res = await odApi.getAllOds({
        status: odStatusFilter || undefined,
        page: odPage,
        limit: 10
      });
      setOds(res.ods || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalItems(res.pagination?.totalItems || 0);
    } catch (err) {
      setAnnError(err.message || 'Failed to load OD requests');
    } finally {
      setLoadingOds(false);
    }
  }, [odPage, odStatusFilter]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    if (activeTab === 'od-tracker') {
      fetchOds();
    }
  }, [activeTab, fetchOds]);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    setAnnSuccess(false);
    setAnnError(null);

    const filters = {};
    if (deptFilter.trim()) filters.department = deptFilter.trim().toUpperCase();
    if (yearFilter) filters.year = Number(yearFilter);
    if (sectionFilter.trim()) filters.section = sectionFilter.trim().toUpperCase();
    filters.role = roleFilter;

    try {
      await announcementsApi.create({
        title: title.trim(),
        content: content.trim(),
        category,
        filters
      });

      setAnnSuccess(true);
      setTitle('');
      setContent('');
      setDeptFilter('');
      setYearFilter('');
      setSectionFilter('');
      setRoleFilter('all');
      
      // Refresh list
      fetchAnnouncements();
      setTimeout(() => setAnnSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setAnnError(err.response?.data?.message || err.message || 'Failed to post announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Are you sure you want to remove this announcement? All related notifications will be deleted.')) return;
    try {
      await announcementsApi.delete(id);
      setAnns(prev => prev.filter(ann => ann._id !== id));
    } catch (err) {
      setAnnError(err.message || 'Failed to delete announcement');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div ref={headerRef} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 gpu-accelerated">
        <div>
          <h1 className="headline">Admin Portal</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Compose targeted notices for departments/years and audit student OD attendance requests.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-lg border p-1" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('compose')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'compose' ? 'bg-blue-500 text-white shadow-sm' : 'subtle hover:text-white'
            }`}
          >
            📢 Announcements Manager
          </button>
          <button
            onClick={() => setActiveTab('od-tracker')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === 'od-tracker' ? 'bg-blue-500 text-white shadow-sm' : 'subtle hover:text-white'
            }`}
          >
            📋 Compliance OD Tracker
          </button>
        </div>
      </div>

      {/* Main content container */}
      <div ref={contentRef} className="gpu-accelerated">
        {activeTab === 'compose' ? (
          /* ================================================================= */
          /* ANNOUNCEMENTS MANAGER                                             */
          /* ================================================================= */
          <div className="grid md:grid-cols-3 gap-6">
            {/* Compose Form */}
            <div className="card p-6 md:col-span-1 h-fit">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Compose Notice</h2>

              {annSuccess && (
                <div data-testid="announcement-success-alert" className="mb-4 flex items-center gap-2 p-3 rounded-lg text-sm bg-green-500/10 text-green-400 border border-green-500/20">
                  <CheckCircle2 size={16} />
                  <span>Announcement published and notifications sent!</span>
                </div>
              )}

              {annError && (
                <div className="mb-4 flex items-start gap-2 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{annError}</span>
                </div>
              )}

              <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                <div>
                  <label htmlFor="announcement-title" className="block text-sm mb-1 subtle">Title *</label>
                  <input
                    id="announcement-title"
                    data-testid="announcement-title"
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                    placeholder="e.g., TCS Recruitment Drive 2026"
                    className="w-full input-dark py-2 px-3"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1 subtle">Category *</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full input-dark py-2 px-3"
                  >
                    <option value="General">General</option>
                    <option value="Placement">Placement</option>
                    <option value="Scholarship">Scholarship</option>
                    <option value="Event">Event</option>
                    <option value="Academic">Academic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm mb-1 subtle">Target Role</label>
                  <select
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value)}
                    className="w-full input-dark py-2 px-3"
                  >
                    <option value="all">All Roles</option>
                    <option value="student">Students Only</option>
                    <option value="faculty">Faculty Only</option>
                  </select>
                </div>

                <div className="border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Granular Filters (Optional)
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs subtle mb-1">Target Department</label>
                      <input
                        type="text"
                        value={deptFilter}
                        onChange={e => setDeptFilter(e.target.value)}
                        placeholder="e.g. CSE"
                        className="w-full input-dark py-1.5 px-3 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs subtle mb-1">Target Year</label>
                      <select
                        value={yearFilter}
                        onChange={e => setYearFilter(e.target.value)}
                        className="w-full input-dark py-1.5 px-3 text-xs"
                      >
                        <option value="">All Years</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs subtle mb-1">Target Section</label>
                      <input
                        type="text"
                        value={sectionFilter}
                        onChange={e => setSectionFilter(e.target.value)}
                        placeholder="e.g. A"
                        className="w-full input-dark py-1.5 px-3 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="announcement-content" className="block text-sm mb-1 subtle">Message Content *</label>
                  <textarea
                    id="announcement-content"
                    data-testid="announcement-content"
                    rows="4"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    required
                    placeholder="Provide full description details..."
                    className="w-full input-dark py-2 px-3 text-sm"
                  />
                </div>

                <button
                  id="announcement-submit"
                  data-testid="announcement-submit"
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary w-full py-2.5 font-semibold"
                >
                  {submitting ? 'Publishing...' : 'Publish Announcement'}
                </button>
              </form>
            </div>

            {/* List View */}
            <div className="card p-6 md:col-span-2">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Published Notices</h2>

              {loadingAnns ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton h-20 w-full rounded-md" />
                  ))}
                </div>
              ) : anns.length === 0 ? (
                <div className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                  <Megaphone size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No announcements published</p>
                  <p className="text-sm mt-1">Compose and publish a notice to broadcast to targeted campus users.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                  {anns.map((ann) => (
                    <div 
                      key={ann._id} 
                      className="p-4 rounded-lg border space-y-2 group" 
                      style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-base">{ann.title}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                              ann.category === 'Placement' ? 'bg-blue-500/20 text-blue-400' :
                              ann.category === 'Scholarship' ? 'bg-green-500/20 text-green-400' :
                              ann.category === 'Event' ? 'bg-purple-500/20 text-purple-400' :
                              ann.category === 'Academic' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-500/20 text-slate-400'
                            }`}>
                              {ann.category}
                            </span>
                          </div>
                          <div className="text-[10px] mt-1 flex flex-wrap gap-x-3 gap-y-1" style={{ color: 'var(--text-secondary)' }}>
                            <span>Role: {ann.filters?.role || 'all'}</span>
                            {ann.filters?.department && <span>Dept: {ann.filters.department}</span>}
                            {ann.filters?.year && <span>Year: {ann.filters.year}</span>}
                            {ann.filters?.section && <span>Section: {ann.filters.section}</span>}
                            <span>• Posted on {new Date(ann.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleDeleteAnnouncement(ann._id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-red-400 hover:bg-red-500/10 transition-all"
                          title="Delete notice"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <p className="text-xs subtle leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* COMPLIANCE OD TRACKER (READ-ONLY)                                */
          /* ================================================================= */
          <div className="card p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">College OD Requests Audit Log</h2>
                <p className="text-xs subtle mt-0.5">Read-only system-wide log for academic and NAAC accreditation audits.</p>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={odStatusFilter}
                  onChange={e => { setOdStatusFilter(e.target.value); setOdPage(1); }}
                  className="input-dark py-1.5 px-3 text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Needs Revision">Needs Revision</option>
                </select>
              </div>
            </div>

            {loadingOds ? (
              <div className="space-y-3 py-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton h-12 w-full rounded" />
                ))}
              </div>
            ) : ods.length === 0 ? (
              <div className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
                <Calendar size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No OD requests found</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th className="p-3 font-semibold">Student</th>
                        <th className="p-3 font-semibold">Event Details</th>
                        <th className="p-3 font-semibold">Exemption</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 font-semibold">Reviewed By</th>
                        <th className="p-3 font-semibold">Review Date / Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ divideColor: 'var(--border-color)' }}>
                      {ods.map((od) => {
                        const student = od.studentId || {};
                        const reviewer = od.reviewedBy || {};
                        return (
                          <tr key={od._id} className="hover:bg-white/5 transition-colors">
                            <td className="p-3">
                              <div className="font-semibold text-white">{student.name || 'N/A'}</div>
                              <div className="subtle mt-0.5">{student.studentId || 'N/A'}</div>
                              <div className="subtle">{student.department || 'N/A'} · Sem {student.semester || 'N/A'}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-semibold text-white">{od.eventName}</div>
                              <div className="subtle mt-0.5">Event Date: {new Date(od.eventDate).toLocaleDateString()}</div>
                              {od.proofUrl && (
                                <a href={od.proofUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-0.5 mt-1">
                                  <FileText size={10} /> Proof
                                </a>
                              )}
                            </td>
                            <td className="p-3">
                              <span className={`badge ${od.attendanceExemptionGranted ? 'badge-green' : 'badge-red'}`}>
                                {od.attendanceExemptionGranted ? 'Exempted' : 'No Exemption'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`badge ${
                                od.status === 'Approved' ? 'badge-green' :
                                od.status === 'Pending' ? 'badge-yellow' :
                                od.status === 'Needs Revision' ? 'badge-orange' : 'badge-red'
                              }`}>
                                {od.status}
                              </span>
                            </td>
                            <td className="p-3">
                              {od.reviewedBy ? (
                                <>
                                  <div className="font-medium text-white">{reviewer.name || 'Advisor'}</div>
                                  <div className="subtle">{reviewer.email || ''}</div>
                                </>
                              ) : (
                                <span className="subtle">—</span>
                              )}
                            </td>
                            <td className="p-3 max-w-xs">
                              {od.reviewedAt ? (
                                <>
                                  <div className="subtle">{new Date(od.reviewedAt).toLocaleDateString()}</div>
                                  {od.remarks && (
                                    <div className="p-1 rounded mt-1 bg-white/5 border border-white/10 truncate font-mono text-[10px]" title={od.remarks}>
                                      {od.remarks}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="subtle">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xs subtle">Showing page {odPage} of {totalPages} ({totalItems} items)</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setOdPage(prev => Math.max(1, prev - 1))}
                        disabled={odPage === 1}
                        className="btn btn-outline p-1.5 text-xs disabled:opacity-50"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() => setOdPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={odPage === totalPages}
                        className="btn btn-outline p-1.5 text-xs disabled:opacity-50"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminAnnouncements;
