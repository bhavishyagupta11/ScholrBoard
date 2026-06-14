/**
 * AdminPlacementDashboard.jsx — Admin Career drive composer and statistics dashboard
 */
import { useState, useEffect } from 'react';
import { 
  Briefcase, Award, TrendingUp, BarChart3, Plus, Trash2, Calendar, 
  MapPin, Clock, Search, ChevronRight, CheckCircle2, AlertCircle, Loader, FileText, X
} from 'lucide-react';
import opportunitiesApi from '../api/opportunities.api.js';
import applicationsApi from '../api/applications.api.js';
import scholarshipsApi from '../api/scholarships.api.js';
import { api } from '../api/index.js';
import { useScrollAnimation } from '../hooks/useScrollAnimation.js';

export function AdminPlacementDashboard() {
  // Placement Stats State
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Open lists
  const [ops, setOps] = useState([]);
  const [scholarships, setScholarships] = useState([]);
  const [loadingOps, setLoadingOps] = useState(true);
  const [loadingScholarships, setLoadingScholarships] = useState(true);

  // Active review lists
  const [selectedOp, setSelectedOp] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const [selectedScholarship, setSelectedScholarship] = useState(null);
  const [scholarshipApps, setScholarshipApps] = useState([]);
  const [loadingScholarshipApps, setLoadingScholarshipApps] = useState(false);

  // Form states
  const [driveForm, setDriveForm] = useState({
    driveCode: '', title: '', company: '', type: 'Full-time', description: '',
    requirements: '', minCGPA: '6.0', eligibleDepartments: '', minSemester: '5',
    passingYear: '2026', maxActiveBacklogs: '0', minPlacementReadinessScore: '75',
    salaryPackage: '', deadline: ''
  });

  const [scholarshipForm, setScholarshipForm] = useState({
    title: '', provider: '', amount: '', description: '', minCGPA: '6.0',
    eligibleDepartments: '', minAchievementPoints: '50', maxAnnualIncome: '500000',
    deadline: ''
  });

  const [reviewRemarks, setReviewRemarks] = useState('');
  const [interviewData, setInterviewData] = useState({ dateTime: '', venue: '', instructions: '' });
  const [schedulingAppId, setSchedulingAppId] = useState(null);
  const [previewAppId, setPreviewAppId] = useState(null);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'compose-drive' | 'compose-scholarship' | 'applicant-reviews'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  const contentRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });

  useEffect(() => {
    fetchStats();
    fetchDrivesAndScholarships();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.get('/analytics/placements');
      setStats(res.stats || null);
    } catch (err) {
      setError(err.message || 'Failed to load placement analytics');
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchDrivesAndScholarships = async () => {
    setLoadingOps(true);
    setLoadingScholarships(true);
    try {
      const [opsRes, schRes] = await Promise.all([
        opportunitiesApi.getAll(),
        scholarshipsApi.getAll(),
      ]);
      setOps(opsRes.opportunities || []);
      setScholarships(schRes.scholarships || []);
    } catch (err) {
      setError(err.message || 'Failed to load drives and scholarships');
    } finally {
      setLoadingOps(false);
      setLoadingScholarships(false);
    }
  };

  const handleCreateDrive = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const data = {
      ...driveForm,
      requirements: driveForm.requirements.split(',').map(s => s.trim()).filter(Boolean),
      salaryPackage: Number(driveForm.salaryPackage) || 0,
      eligibility: {
        minCGPA: Number(driveForm.minCGPA) || 0,
        eligibleDepartments: driveForm.eligibleDepartments.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
        minSemester: Number(driveForm.minSemester) || 1,
        passingYear: Number(driveForm.passingYear) || 2026,
        maxActiveBacklogs: Number(driveForm.maxActiveBacklogs) || 0,
        minPlacementReadinessScore: driveForm.minPlacementReadinessScore ? Number(driveForm.minPlacementReadinessScore) : null
      }
    };

    try {
      await opportunitiesApi.create(data);
      setSuccess('Placement drive draft composed successfully!');
      setDriveForm({
        driveCode: '', title: '', company: '', type: 'Full-time', description: '',
        requirements: '', minCGPA: '6.0', eligibleDepartments: '', minSemester: '5',
        passingYear: '2026', maxActiveBacklogs: '0', minPlacementReadinessScore: '75',
        salaryPackage: '', deadline: ''
      });
      fetchDrivesAndScholarships();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to compose placement drive');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateScholarship = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const data = {
      ...scholarshipForm,
      amount: Number(scholarshipForm.amount) || 0,
      eligibility: {
        minCGPA: Number(scholarshipForm.minCGPA) || 0,
        eligibleDepartments: scholarshipForm.eligibleDepartments.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
        minAchievementPoints: Number(scholarshipForm.minAchievementPoints) || 0,
        maxAnnualIncome: scholarshipForm.maxAnnualIncome ? Number(scholarshipForm.maxAnnualIncome) : null
      }
    };

    try {
      await scholarshipsApi.create(data);
      setSuccess('Scholarship draft composed successfully!');
      setScholarshipForm({
        title: '', provider: '', amount: '', description: '', minCGPA: '6.0',
        eligibleDepartments: '', minAchievementPoints: '50', maxAnnualIncome: '500000',
        deadline: ''
      });
      fetchDrivesAndScholarships();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to compose scholarship');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishDrive = async (id, title) => {
    try {
      await opportunitiesApi.publish(id);
      setSuccess(`Published drive: "${title}" — Matching students notified.`);
      fetchDrivesAndScholarships();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to publish drive');
    }
  };

  const handlePublishScholarship = async (id, title) => {
    try {
      await scholarshipsApi.publish(id);
      setSuccess(`Published scholarship: "${title}" — Matching candidates notified.`);
      fetchDrivesAndScholarships();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to publish scholarship');
    }
  };

  const handleCloseDrive = async (id, title) => {
    try {
      await opportunitiesApi.close(id);
      setSuccess(`Closed drive: "${title}"`);
      fetchDrivesAndScholarships();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to close drive');
    }
  };

  const handleCloseScholarship = async (id, title) => {
    try {
      await scholarshipsApi.close(id);
      setSuccess(`Closed scholarship: "${title}"`);
      fetchDrivesAndScholarships();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to close scholarship');
    }
  };

  const loadApplicants = async (op) => {
    setSelectedOp(op);
    setLoadingApplicants(true);
    setActiveTab('applicant-reviews');
    try {
      const res = await applicationsApi.getOpportunityApplicants(op._id);
      setApplicants(res.applications || []);
    } catch (err) {
      setError(err.message || 'Failed to load applicants');
    } finally {
      setLoadingApplicants(false);
    }
  };

  const loadScholarshipApps = async (sch) => {
    setSelectedScholarship(sch);
    setLoadingScholarshipApps(true);
    setActiveTab('scholarship-reviews');
    try {
      const res = await scholarshipsApi.getApplications(sch._id);
      setScholarshipApps(res.applications || []);
    } catch (err) {
      setError(err.message || 'Failed to load scholarship applications');
    } finally {
      setLoadingScholarshipApps(false);
    }
  };

  const handleReviewApplicant = async (appId, status) => {
    if (status === 'Selected' && !window.confirm('Confirm candidate placement selection?')) return;
    try {
      await applicationsApi.reviewStatus(appId, { status, remarks: reviewRemarks.trim() });
      setReviewRemarks('');
      setSuccess(`Applicant status changed to: ${status}`);
      // Refresh list
      loadApplicants(selectedOp);
      fetchStats();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update candidate status');
    }
  };

  const handleReviewScholarshipApp = async (appId, status) => {
    try {
      await scholarshipsApi.reviewApplication(appId, { status, remarks: reviewRemarks.trim() });
      setReviewRemarks('');
      setSuccess(`Scholarship status changed to: ${status}`);
      // Refresh list
      loadScholarshipApps(selectedScholarship);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleScheduleInterview = async (e) => {
    e.preventDefault();
    if (!schedulingAppId) return;

    try {
      await applicationsApi.scheduleInterview(schedulingAppId, {
        dateTime: interviewData.dateTime,
        venue: interviewData.venue.trim(),
        instructions: interviewData.instructions.trim()
      });
      setInterviewData({ dateTime: '', venue: '', instructions: '' });
      setSchedulingAppId(null);
      setSuccess('Interview details updated and candidate notified.');
      loadApplicants(selectedOp);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to schedule interview');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div ref={headerRef} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 gpu-accelerated">
        <div>
          <h1 className="headline">Placement drive &amp; Scholarships Portal</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Conduct student placement drives, compose scholarship rules, and inspect Naac placement statistics audits.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg border p-1" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
          {[
            { id: 'overview', label: '📊 Statistics Overview' },
            { id: 'compose-drive', label: '📢 Compose Drive' },
            { id: 'compose-scholarship', label: '🏆 Compose Scholarship' },
            { id: 'all-lists', label: '📋 Open Lists' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === tab.id ? 'bg-blue-500 text-white shadow-sm' : 'subtle hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {success && (
        <div data-testid="placement-success-alert" className="flex items-center gap-2 p-3 rounded-lg text-sm bg-green-500/10 text-green-400 border border-green-500/20">
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Tab Panels */}
      <div ref={contentRef} className="gpu-accelerated">
        {activeTab === 'overview' ? (
          /* ================================================================= */
          /* STATISTICS OVERVIEW                                               */
          /* ================================================================= */
          <div className="space-y-6">
            {/* Quick Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="card p-5">
                <div className="text-sm subtle">Total Placed Students</div>
                <div className="text-3xl font-bold text-green-400 mt-2">
                  {loadingStats ? <div className="skeleton h-8 w-16" /> : stats?.totalPlaced}
                </div>
                <div className="text-xs subtle mt-1">Unique selections count</div>
              </div>
              <div className="card p-5">
                <div className="text-sm subtle">Placement Percentage</div>
                <div className="text-3xl font-bold text-blue-400 mt-2">
                  {loadingStats ? <div className="skeleton h-8 w-16" /> : `${stats?.placementPercentage}%`}
                </div>
                <div className="text-xs subtle mt-1">From total registered final-years</div>
              </div>
              <div className="card p-5">
                <div className="text-sm subtle">Highest Package</div>
                <div className="text-3xl font-bold text-yellow-400 mt-2">
                  {loadingStats ? <div className="skeleton h-8 w-16" /> : `₹${((stats?.highestPackage || 0)/100000).toFixed(1)} LPA`}
                </div>
                <div className="text-xs subtle mt-1">Max package verified</div>
              </div>
              <div className="card p-5">
                <div className="text-sm subtle">Average Package</div>
                <div className="text-3xl font-bold text-purple-400 mt-2">
                  {loadingStats ? <div className="skeleton h-8 w-16" /> : `₹${((stats?.averagePackage || 0)/100000).toFixed(1)} LPA`}
                </div>
                <div className="text-xs subtle mt-1">Average salary package</div>
              </div>
            </div>

            {/* Department Breakdown Table */}
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-4">Department-wise Placement Audit Breakdown</h3>
              <div className="overflow-x-auto border rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th className="p-3 font-semibold">Department</th>
                      <th className="p-3 font-semibold">Total Students</th>
                      <th className="p-3 font-semibold">Placed Students</th>
                      <th className="p-3 font-semibold">Conversion Rate</th>
                      <th className="p-3 font-semibold">Highest Package</th>
                      <th className="p-3 font-semibold">Average Package</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ divideColor: 'var(--border-color)' }}>
                    {loadingStats ? (
                      <tr><td colSpan="6" className="p-3 text-center subtle">Loading analytics data...</td></tr>
                    ) : stats?.departmentBreakdown?.length === 0 ? (
                      <tr><td colSpan="6" className="p-6 text-center subtle">No department statistics logged yet.</td></tr>
                    ) : (
                      stats?.departmentBreakdown?.map(dept => (
                        <tr key={dept.department} className="hover:bg-white/5">
                          <td className="p-3 font-bold">{dept.department}</td>
                          <td className="p-3">{dept.totalStudents}</td>
                          <td className="p-3 font-semibold text-green-400">{dept.placed}</td>
                          <td className="p-3">
                            <span className="font-semibold">{dept.percentage}%</span>
                            <div className="w-24 bg-white/10 h-1.5 rounded-full overflow-hidden mt-1">
                              <div className="bg-blue-500 h-full" style={{ width: `${dept.percentage}%` }}></div>
                            </div>
                          </td>
                          <td className="p-3 font-semibold text-yellow-400">₹{(dept.highest).toLocaleString()} LPA</td>
                          <td className="p-3 font-semibold text-purple-400">₹{(dept.average).toLocaleString()} LPA</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'compose-drive' ? (
          /* ================================================================= */
          /* COMPOSE DRIVE FORM                                                */
          /* ================================================================= */
          <form onSubmit={handleCreateDrive} className="card p-6 max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            <h2 className="text-xl font-bold md:col-span-2 border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
              Compose Placement Drive Draft
            </h2>
            <div>
              <label htmlFor="drive-code" className="block text-sm subtle mb-1">Drive Code * (e.g. TCS-NQT-2026)</label>
              <input
                id="drive-code"
                data-testid="drive-code"
                type="text" required
                value={driveForm.driveCode}
                onChange={e => setDriveForm(prev => ({ ...prev, driveCode: e.target.value }))}
                placeholder="Unique alphanumeric code"
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="drive-company" className="block text-sm subtle mb-1">Company Name *</label>
              <input
                id="drive-company"
                data-testid="drive-company"
                type="text" required
                value={driveForm.company}
                onChange={e => setDriveForm(prev => ({ ...prev, company: e.target.value }))}
                placeholder="e.g. Tata Consultancy Services"
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="drive-title" className="block text-sm subtle mb-1">Job Profile Title *</label>
              <input
                id="drive-title"
                data-testid="drive-title"
                type="text" required
                value={driveForm.title}
                onChange={e => setDriveForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Systems Engineer (Ninja)"
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="drive-type" className="block text-sm subtle mb-1">Offer Type *</label>
              <select
                id="drive-type"
                data-testid="drive-type"
                value={driveForm.type}
                onChange={e => setDriveForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full input-dark py-2 px-3 text-sm"
              >
                <option value="Full-time">Full-time</option>
                <option value="Internship">Internship</option>
                <option value="Part-time">Part-time</option>
              </select>
            </div>
            <div>
              <label htmlFor="drive-salary" className="block text-sm subtle mb-1">Salary Package (INR LPA) *</label>
              <input
                id="drive-salary"
                data-testid="drive-salary"
                type="number" required
                value={driveForm.salaryPackage}
                onChange={e => setDriveForm(prev => ({ ...prev, salaryPackage: e.target.value }))}
                placeholder="e.g. 700000 for 7 LPA"
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="drive-deadline" className="block text-sm subtle mb-1">Application Deadline *</label>
              <input
                id="drive-deadline"
                data-testid="drive-deadline"
                type="datetime-local" required
                value={driveForm.deadline}
                onChange={e => setDriveForm(prev => ({ ...prev, deadline: e.target.value }))}
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>

            <div className="md:col-span-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
              <h4 className="text-sm font-semibold uppercase text-slate-400 tracking-wider mb-4">
                Prerequisite Eligibility Snapshots
              </h4>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs subtle mb-1">Minimum CGPA (0.0-10.0)</label>
                  <input
                    type="number" step="0.1"
                    value={driveForm.minCGPA}
                    onChange={e => setDriveForm(prev => ({ ...prev, minCGPA: e.target.value }))}
                    className="w-full input-dark py-1.5 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs subtle mb-1">Max Active Backlogs</label>
                  <input
                    type="number"
                    value={driveForm.maxActiveBacklogs}
                    onChange={e => setDriveForm(prev => ({ ...prev, maxActiveBacklogs: e.target.value }))}
                    className="w-full input-dark py-1.5 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs subtle mb-1">Min Placement Readiness (0-100)</label>
                  <input
                    type="number"
                    name="minPlacementReadinessScore"
                    value={driveForm.minPlacementReadinessScore}
                    onChange={e => setDriveForm(prev => ({ ...prev, minPlacementReadinessScore: e.target.value }))}
                    className="w-full input-dark py-1.5 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs subtle mb-1">Eligible Semesters Prereq</label>
                  <input
                    type="number"
                    value={driveForm.minSemester}
                    onChange={e => setDriveForm(prev => ({ ...prev, minSemester: e.target.value }))}
                    className="w-full input-dark py-1.5 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs subtle mb-1">Eligible Passing Year</label>
                  <input
                    type="number"
                    value={driveForm.passingYear}
                    onChange={e => setDriveForm(prev => ({ ...prev, passingYear: e.target.value }))}
                    className="w-full input-dark py-1.5 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs subtle mb-1">Eligible Depts (Comma-separated)</label>
                  <input
                    type="text"
                    name="eligibleDepartments"
                    value={driveForm.eligibleDepartments}
                    onChange={e => setDriveForm(prev => ({ ...prev, eligibleDepartments: e.target.value }))}
                    placeholder="e.g. CSE, ECE"
                    className="w-full input-dark py-1.5 px-3 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm subtle mb-1">Eligible Requirements Summary</label>
              <input
                type="text"
                value={driveForm.requirements}
                onChange={e => setDriveForm(prev => ({ ...prev, requirements: e.target.value }))}
                placeholder="e.g. React, Node.js, DSA, Good communication (comma-separated)"
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="drive-description" className="block text-sm subtle mb-1">Full Description *</label>
              <textarea
                id="drive-description"
                data-testid="drive-description"
                rows="4" required
                value={driveForm.description}
                onChange={e => setDriveForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Job descriptions, recruiter details, and drive rules..."
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button type="submit" disabled={submitting} className="btn btn-primary px-8 py-2.5">
                {submitting ? 'Submitting...' : 'Compose Drive Draft'}
              </button>
            </div>
          </form>
        ) : activeTab === 'compose-scholarship' ? (
          /* ================================================================= */
          /* COMPOSE SCHOLARSHIP FORM                                          */
          /* ================================================================= */
          <form onSubmit={handleCreateScholarship} className="card p-6 max-w-4xl mx-auto grid md:grid-cols-2 gap-6">
            <h2 className="text-xl font-bold md:col-span-2 border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
              Compose Scholarship Draft
            </h2>
            <div>
              <label htmlFor="scholarship-title" className="block text-sm subtle mb-1">Scholarship Title *</label>
              <input
                id="scholarship-title"
                data-testid="scholarship-title"
                type="text" required
                value={scholarshipForm.title}
                onChange={e => setScholarshipForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Merit-cum-Means Financial Support"
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="scholarship-provider" className="block text-sm subtle mb-1">Provider/Trust Name *</label>
              <input
                id="scholarship-provider"
                data-testid="scholarship-provider"
                type="text" required
                value={scholarshipForm.provider}
                onChange={e => setScholarshipForm(prev => ({ ...prev, provider: e.target.value }))}
                placeholder="e.g. Reliance Foundation"
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="scholarship-amount" className="block text-sm subtle mb-1">Award Amount (INR Annual) *</label>
              <input
                id="scholarship-amount"
                data-testid="scholarship-amount"
                type="number" required
                value={scholarshipForm.amount}
                onChange={e => setScholarshipForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="e.g. 50000"
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="scholarship-deadline" className="block text-sm subtle mb-1">Application Deadline *</label>
              <input
                id="scholarship-deadline"
                data-testid="scholarship-deadline"
                type="datetime-local" required
                value={scholarshipForm.deadline}
                onChange={e => setScholarshipForm(prev => ({ ...prev, deadline: e.target.value }))}
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>

            <div className="md:col-span-2 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
              <h4 className="text-sm font-semibold uppercase text-slate-400 tracking-wider mb-4">
                Prerequisite Eligibility Rules
              </h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs subtle mb-1">Minimum CGPA (0.0-10.0)</label>
                  <input
                    type="number" step="0.1"
                    value={scholarshipForm.minCGPA}
                    onChange={e => setScholarshipForm(prev => ({ ...prev, minCGPA: e.target.value }))}
                    className="w-full input-dark py-1.5 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs subtle mb-1">Min Achievement Points Needed</label>
                  <input
                    type="number"
                    value={scholarshipForm.minAchievementPoints}
                    onChange={e => setScholarshipForm(prev => ({ ...prev, minAchievementPoints: e.target.value }))}
                    className="w-full input-dark py-1.5 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs subtle mb-1">Max Annual Income Limit (INR)</label>
                  <input
                    type="number"
                    value={scholarshipForm.maxAnnualIncome}
                    onChange={e => setScholarshipForm(prev => ({ ...prev, maxAnnualIncome: e.target.value }))}
                    placeholder="e.g. 600000"
                    className="w-full input-dark py-1.5 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs subtle mb-1">Eligible Depts (Comma-separated)</label>
                  <input
                    type="text"
                    value={scholarshipForm.eligibleDepartments}
                    onChange={e => setScholarshipForm(prev => ({ ...prev, eligibleDepartments: e.target.value }))}
                    placeholder="e.g. CSE, ECE"
                    className="w-full input-dark py-1.5 px-3 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="scholarship-description" className="block text-sm subtle mb-1">Full Description *</label>
              <textarea
                id="scholarship-description"
                data-testid="scholarship-description"
                rows="4" required
                value={scholarshipForm.description}
                onChange={e => setScholarshipForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Compose scholarship terms, details, and rules..."
                className="w-full input-dark py-2 px-3 text-sm"
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button type="submit" disabled={submitting} className="btn btn-primary px-8 py-2.5">
                {submitting ? 'Submitting...' : 'Compose Scholarship Draft'}
              </button>
            </div>
          </form>
        ) : activeTab === 'all-lists' ? (
          /* ================================================================= */
          /* OPEN LISTS AND ACTIONS                                            */
          /* ================================================================= */
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Placements drives list */}
            <div className="card p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Briefcase size={20} className="text-blue-400" />
                Placement Drive Campaigns
              </h2>
              {loadingOps ? (
                <div className="skeleton h-14 w-full" />
              ) : ops.length === 0 ? (
                <p className="text-sm subtle py-4 border-t text-center">No drives composed yet.</p>
              ) : (
                <div className="space-y-3 pt-2">
                  {ops.map(op => (
                    <div key={op._id} className="p-3 rounded border border-white/10 space-y-2 group" style={{ background: 'var(--bg-medium)' }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-sm">{op.company} - {op.title}</div>
                          <div className="text-[10px] uppercase font-semibold text-slate-400 mt-0.5">{op.driveCode} · status: {op.status}</div>
                        </div>

                        <span className={`badge ${
                          op.status === 'Published' ? 'badge-green' : op.status === 'Draft' ? 'badge-yellow' : 'badge-red'
                        }`}>{op.status}</span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-white/5">
                        <div className="flex gap-2">
                          {op.status === 'Draft' && (
                            <button 
                              onClick={() => handlePublishDrive(op._id, op.title)}
                              className="text-[10px] px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold"
                            >
                              Publish
                            </button>
                          )}
                          {op.status === 'Published' && (
                            <button 
                              onClick={() => handleCloseDrive(op._id, op.title)}
                              className="text-[10px] px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white font-semibold"
                            >
                              Close
                            </button>
                          )}
                        </div>

                        {op.status !== 'Draft' && (
                          <button 
                            onClick={() => loadApplicants(op)}
                            className="text-[10px] text-blue-400 hover:underline font-semibold"
                          >
                            Review Applicants →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scholarships list */}
            <div className="card p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Award size={20} className="text-yellow-400" />
                Scholarship Schemes
              </h2>
              {loadingScholarships ? (
                <div className="skeleton h-14 w-full" />
              ) : scholarships.length === 0 ? (
                <p className="text-sm subtle py-4 border-t text-center">No scholarships composed yet.</p>
              ) : (
                <div className="space-y-3 pt-2">
                  {scholarships.map(s => (
                    <div key={s._id} className="p-3 rounded border border-white/10 space-y-2 group" style={{ background: 'var(--bg-medium)' }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-sm">{s.title}</div>
                          <div className="text-[10px] uppercase font-semibold text-slate-400 mt-0.5">{s.provider} · status: {s.status}</div>
                        </div>

                        <span className={`badge ${
                          s.status === 'Published' ? 'badge-green' : s.status === 'Draft' ? 'badge-yellow' : 'badge-red'
                        }`}>{s.status}</span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-white/5">
                        <div className="flex gap-2">
                          {s.status === 'Draft' && (
                            <button 
                              onClick={() => handlePublishScholarship(s._id, s.title)}
                              className="text-[10px] px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold"
                            >
                              Publish
                            </button>
                          )}
                          {s.status === 'Published' && (
                            <button 
                              onClick={() => handleCloseScholarship(s._id, s.title)}
                              className="text-[10px] px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-white font-semibold"
                            >
                              Close
                            </button>
                          )}
                        </div>

                        {s.status !== 'Draft' && (
                          <button 
                            onClick={() => loadScholarshipApps(s)}
                            className="text-[10px] text-blue-400 hover:underline font-semibold"
                          >
                            Review Applications →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : activeTab === 'applicant-reviews' ? (
          /* ================================================================= */
          /* APPLICANT REVIEW BOARD (PLACEMENT DRIVE)                          */
          /* ================================================================= */
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <span className="text-xs uppercase font-semibold text-blue-400">Review Board</span>
                <h2 className="text-xl font-bold mt-0.5">{selectedOp?.company} — {selectedOp?.title}</h2>
              </div>
              <button onClick={() => { setSelectedOp(null); setActiveTab('all-lists'); }} className="text-xs subtle hover:text-white">← Back</button>
            </div>

            {loadingApplicants ? (
              <div className="skeleton h-28 w-full" />
            ) : applicants.length === 0 ? (
              <p className="text-sm subtle py-6 text-center">No students registered for this drive yet.</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {applicants.map(app => (
                  <div key={app._id} className="p-4 rounded border border-white/5 space-y-3" style={{ background: 'var(--bg-medium)' }}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Candidate profile snapshot */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{app.studentId?.name}</span>
                          <span className="text-[10px] subtle">({app.studentId?.studentId || 'N/A'})</span>
                        </div>
                        <div className="text-[11px] subtle mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          <span>Dept: {app.studentId?.department} · Sem: {app.studentId?.semester}</span>
                          <span>CGPA: {app.eligibilitySnapshot?.cgpa?.toFixed(2)}</span>
                          <span>Readiness: {app.eligibilitySnapshot?.placementReadinessScore}%</span>
                          <span>Backlogs: {app.eligibilitySnapshot?.activeBacklogs}</span>
                          <span>• Applied: {new Date(app.appliedAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className={`badge ${
                          app.status === 'Selected' ? 'badge-green' :
                          app.status === 'Rejected' ? 'badge-red' :
                          app.status === 'Withdrawn' ? 'badge-red' :
                          app.status === 'Interview Scheduled' ? 'badge-purple' :
                          app.status === 'Interviewed' ? 'badge-orange' : 'badge-yellow'
                        }`}>{app.status}</span>
                        
                        {app.resumeUrl && (
                          <button
                            onClick={() => setPreviewAppId(app._id)}
                            className="text-xs text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer bg-transparent border-0 p-0"
                          >
                            <FileText size={12} /> View Resume
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Interview detail details */}
                    {(app.status === 'Interview Scheduled' || app.status === 'Interviewed') && app.interviewDetails?.dateTime && (
                      <div className="text-xs p-2.5 rounded bg-white/5 border border-purple-500/20 text-purple-400 font-mono">
                        Interview Schedule: {new Date(app.interviewDetails.dateTime).toLocaleString()} @ {app.interviewDetails.venue}
                      </div>
                    )}

                    {/* Action buttons */}
                    {app.status !== 'Withdrawn' && app.status !== 'Selected' && app.status !== 'Rejected' && (
                      <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 max-w-sm">
                          <input
                            type="text"
                            placeholder="Add evaluation comments..."
                            value={reviewRemarks}
                            onChange={e => setReviewRemarks(e.target.value)}
                            className="input-dark py-1 px-2 text-xs flex-1"
                          />
                        </div>

                        <div className="flex gap-2">
                          {app.status === 'Applied' && (
                            <button
                              onClick={() => handleReviewApplicant(app._id, 'Shortlisted')}
                              className="btn text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all"
                            >
                              Shortlist
                            </button>
                          )}

                          {(app.status === 'Applied' || app.status === 'Shortlisted') && (
                            <button
                              onClick={() => { setSchedulingAppId(app._id); setError(null); }}
                              className="btn text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-all"
                            >
                              Schedule Interview
                            </button>
                          )}

                          {app.status === 'Interview Scheduled' && (
                            <button
                              onClick={() => handleReviewApplicant(app._id, 'Interviewed')}
                              className="btn text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-all"
                            >
                              Mark Interviewed
                            </button>
                          )}

                          {app.status === 'Interviewed' && (
                            <button
                              onClick={() => handleReviewApplicant(app._id, 'Selected')}
                              className="btn text-xs px-3 py-1.5 btn-success-custom font-semibold transition-all"
                            >
                              Select Candidate
                            </button>
                          )}

                          <button
                            onClick={() => handleReviewApplicant(app._id, 'Rejected')}
                            className="btn text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ================================================================= */
          /* SCHOLARSHIP APPLICANTS REVIEW BOARD                               */
          /* ================================================================= */
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <div>
                <span className="text-xs uppercase font-semibold text-yellow-400">Review Board</span>
                <h2 className="text-xl font-bold mt-0.5">{selectedScholarship?.title}</h2>
              </div>
              <button onClick={() => { setSelectedScholarship(null); setActiveTab('all-lists'); }} className="text-xs subtle hover:text-white">← Back</button>
            </div>

            {loadingScholarshipApps ? (
              <div className="skeleton h-28 w-full" />
            ) : scholarshipApps.length === 0 ? (
              <p className="text-sm subtle py-6 text-center">No student applications submitted yet.</p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {scholarshipApps.map(app => (
                  <div key={app._id} className="p-4 rounded border border-white/5 space-y-3" style={{ background: 'var(--bg-medium)' }}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{app.studentId?.name}</span>
                          <span className="text-[10px] subtle">({app.studentId?.studentId || 'N/A'})</span>
                        </div>
                        <div className="text-[11px] subtle mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          <span>Dept: {app.studentId?.department}</span>
                          <span>CGPA: {app.eligibilitySnapshot?.cgpa?.toFixed(2)}</span>
                          <span>Points: {app.eligibilitySnapshot?.achievementPoints} pts</span>
                          <span className="text-green-400 font-semibold">Income: ₹{app.eligibilitySnapshot?.annualIncome?.toLocaleString()}</span>
                          <span>• Applied: {new Date(app.appliedAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className={`badge ${
                          app.status === 'Selected' ? 'badge-green' :
                          app.status === 'Rejected' ? 'badge-red' : 'badge-yellow'
                        }`}>{app.status}</span>
                        
                        <div className="flex gap-2">
                          {app.incomeCertificateUrl && (
                            <a href={app.incomeCertificateUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-0.5">
                              <FileText size={12} /> Income Proof
                            </a>
                          )}
                          {app.academicTranscriptUrl && (
                            <a href={app.academicTranscriptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-0.5">
                              <FileText size={12} /> Transcript Proof
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action form */}
                    {app.status === 'Applied' && (
                      <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 max-w-sm">
                          <input
                            type="text"
                            placeholder="Add review remarks..."
                            value={reviewRemarks}
                            onChange={e => setReviewRemarks(e.target.value)}
                            className="input-dark py-1 px-2 text-xs flex-1"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReviewScholarshipApp(app._id, 'Selected')}
                            className="text-[10px] px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-white font-semibold"
                          >
                            Approve &amp; Disburse
                          </button>
                          <button
                            onClick={() => handleReviewScholarshipApp(app._id, 'Rejected')}
                            className="text-[10px] px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-semibold"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* INTERVIEW SCHEDULER DIALOG MODAL */}
      {schedulingAppId && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="card max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">Schedule Candidate Interview</h3>
            <p className="text-xs subtle">Compose details for the recruitment interview rounds.</p>

            <form onSubmit={handleScheduleInterview} className="space-y-4">
              <div>
                <label className="block text-xs subtle mb-1">Date &amp; Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={interviewData.dateTime}
                  onChange={e => setInterviewData(prev => ({ ...prev, dateTime: e.target.value }))}
                  className="w-full input-dark py-2 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs subtle mb-1">Venue Room / Link *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Seminar Hall B or Meet URL Link"
                  value={interviewData.venue}
                  onChange={e => setInterviewData(prev => ({ ...prev, venue: e.target.value }))}
                  className="w-full input-dark py-2 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs subtle mb-1">Instructions for Candidate</label>
                <textarea
                  rows="3"
                  placeholder="What should the candidate bring or prepare?..."
                  value={interviewData.instructions}
                  onChange={e => setInterviewData(prev => ({ ...prev, instructions: e.target.value }))}
                  className="w-full input-dark py-2 px-3 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSchedulingAppId(null)} className="btn btn-outline px-4 py-2 text-xs">Cancel</button>
                <button type="submit" className="btn btn-primary px-4 py-2 text-xs">Schedule Interview</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resume Preview Modal */}
      {previewAppId && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-3xl flex flex-col p-6 space-y-4" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-color)' }}>
            <div className="flex justify-between items-center pb-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="text-lg font-bold">Candidate Resume Preview</h2>
              <button 
                onClick={() => setPreviewAppId(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center min-h-[50vh] max-h-[70vh] bg-black/20 rounded-lg p-2">
              <iframe 
                src={`/api/upload/resume/view/${previewAppId}`} 
                title="PDF Resume Preview"
                className="w-full h-[60vh] rounded border-0" 
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default AdminPlacementDashboard;
