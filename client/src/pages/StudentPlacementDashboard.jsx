/**
 * StudentPlacementDashboard.jsx — Placements and Scholarships portal for students
 */
import { useState, useEffect, useCallback } from 'react';
import { 
  Briefcase, Award, CheckCircle2, AlertCircle, Calendar, DollarSign, 
  MapPin, Clock, Info, ShieldCheck, XCircle, FileText, Loader, ArrowUpRight
} from 'lucide-react';
import opportunitiesApi from '../api/opportunities.api.js';
import applicationsApi from '../api/applications.api.js';
import scholarshipsApi from '../api/scholarships.api.js';
import { useProfile } from '../contexts/ProfileContext.jsx';
import { useScrollAnimation } from '../hooks/useScrollAnimation.js';

export function StudentPlacementDashboard() {
  const { profile } = useProfile();
  
  // Placements state
  const [matchingOps, setMatchingOps] = useState([]);
  const [loadingOps, setLoadingOps] = useState(true);
  const [myApps, setMyApps] = useState([]);
  const [loadingApps, setLoadingApps] = useState(true);

  // Scholarships state
  const [annualIncome, setAnnualIncome] = useState(300000);
  const [matchingScholarships, setMatchingScholarships] = useState([]);
  const [loadingScholarships, setLoadingScholarships] = useState(true);
  const [myScholarshipHistory, setMyScholarshipHistory] = useState([]);
  const [loadingScholarshipHistory, setLoadingScholarshipHistory] = useState(true);

  // Modals / forms state
  const [applyingOp, setApplyingOp] = useState(null);
  const [resumeUrl, setResumeUrl] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);

  const [applyingScholarship, setApplyingScholarship] = useState(null);
  const [incomeCertUrl, setIncomeCertUrl] = useState('');
  const [transcriptUrl, setTranscriptUrl] = useState('');
  const [submittingScholarshipApp, setSubmittingScholarshipApp] = useState(false);

  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
  const gridRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });

  const fetchPlacementData = useCallback(async () => {
    setLoadingOps(true);
    setLoadingApps(true);
    try {
      const [opsRes, appsRes] = await Promise.all([
        opportunitiesApi.getMatching(),
        applicationsApi.getMyHistory(),
      ]);
      setMatchingOps(opsRes.opportunities || []);
      setMyApps(appsRes.applications || []);
      
      // Auto populate default resume from profile if available
      if (profile?.resumeUrl) {
        setResumeUrl(profile.resumeUrl);
      }
    } catch (err) {
      setError(err.message || 'Failed to load placement data');
    } finally {
      setLoadingOps(false);
      setLoadingApps(false);
    }
  }, [profile?.resumeUrl]);

  const fetchScholarshipData = useCallback(async () => {
    setLoadingScholarships(true);
    setLoadingScholarshipHistory(true);
    try {
      const [scholarshipsRes, historyRes] = await Promise.all([
        scholarshipsApi.getMatching({ annualIncome }),
        scholarshipsApi.getMyHistory(),
      ]);
      setMatchingScholarships(scholarshipsRes.scholarships || []);
      setMyScholarshipHistory(historyRes.applications || []);
    } catch (err) {
      setError(err.message || 'Failed to load scholarship data');
    } finally {
      setLoadingScholarships(false);
      setLoadingScholarshipHistory(false);
    }
  }, [annualIncome]);

  useEffect(() => {
    fetchPlacementData();
    fetchScholarshipData();
  }, [fetchPlacementData, fetchScholarshipData]);

  const handleApplyPlacement = async (e) => {
    e.preventDefault();
    if (!resumeUrl.trim()) return;

    setSubmittingApp(true);
    setError(null);
    try {
      await applicationsApi.apply(applyingOp._id, { resumeUrl: resumeUrl.trim() });
      setSuccessMsg(`Applied successfully to ${applyingOp.company}!`);
      setApplyingOp(null);
      fetchPlacementData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit application');
    } finally {
      setSubmittingApp(false);
    }
  };

  const handleWithdrawPlacement = async (appId, company) => {
    if (!window.confirm(`Are you sure you want to withdraw your application from ${company}?`)) return;
    try {
      await applicationsApi.withdraw(appId);
      setSuccessMsg(`Withdrawn application from ${company}.`);
      fetchPlacementData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to withdraw application');
    }
  };

  const handleApplyScholarship = async (e) => {
    e.preventDefault();
    setSubmittingScholarshipApp(true);
    setError(null);
    try {
      await scholarshipsApi.apply(applyingScholarship._id, {
        incomeCertificateUrl: incomeCertUrl.trim() || undefined,
        academicTranscriptUrl: transcriptUrl.trim() || undefined,
        annualIncome,
      });
      setSuccessMsg(`Applied successfully for ${applyingScholarship.title}!`);
      setApplyingScholarship(null);
      setIncomeCertUrl('');
      setTranscriptUrl('');
      fetchScholarshipData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit scholarship application');
    } finally {
      setSubmittingScholarshipApp(false);
    }
  };

  // Helper values representing score placeholders or profile fallbacks
  const cgpa = profile?.gpa || 0.0;
  const backlogs = profile?.backlogs || 0;
  const readinessScore = profile?.placementReadinessScore || 0;
  const achievementPoints = profile?.achievementPoints || 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div ref={headerRef} className="flex justify-between items-center gpu-accelerated">
        <div>
          <h1 className="headline">Career &amp; Placements Portal</h1>
          <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
            Track open placement drives, verify your academic eligibility status, and request scholarship assistance.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm bg-green-500/10 text-green-400 border border-green-500/20">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Placement Grid */}
      <div ref={gridRef} className="grid grid-cols-1 lg:grid-cols-3 gap-6 gpu-accelerated">
        
        {/* Left Side: Eligibility Snapshot Checklist & Live stats */}
        <div className="space-y-6 lg:col-span-1">
          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ShieldCheck size={20} className="text-blue-400" />
              Eligibility Checklist
            </h2>
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="subtle">Current CGPA</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  {cgpa >= 6.0 ? <CheckCircle2 size={14} className="text-green-400" /> : <AlertCircle size={14} className="text-red-400" />}
                  {cgpa.toFixed(2)} / 10
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="subtle">Active Backlogs</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  {backlogs === 0 ? <CheckCircle2 size={14} className="text-green-400" /> : <AlertCircle size={14} className="text-yellow-400" />}
                  {backlogs} Active
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="subtle">Placement Readiness</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  {readinessScore >= 75 ? <CheckCircle2 size={14} className="text-green-400" /> : <Info size={14} className="text-orange-400" />}
                  {readinessScore}% Score
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="subtle">Achievement Points</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Award size={14} className="text-yellow-400" />
                  {achievementPoints} Points
                </span>
              </div>
            </div>
            <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10 text-xs subtle leading-relaxed mt-2">
              Prerequisites are updated dynamically by Faculty Advisors. Backlogs and CGPA reflect your current verified academic ledger records.
            </div>
          </div>

          {/* Interview schedules & Active Application Funnel */}
          <div className="card p-5 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar size={20} className="text-purple-400" />
              Interview Schedules
            </h2>
            {loadingApps ? (
              <div className="skeleton h-14 w-full" />
            ) : myApps.filter(a => a.status === 'Interviewed').length === 0 ? (
              <p className="text-sm subtle py-2">No upcoming interviews scheduled.</p>
            ) : (
              <div className="space-y-3">
                {myApps.filter(a => a.status === 'Interviewed').map(app => (
                  <div key={app._id} className="p-3 rounded bg-white/5 border border-purple-500/20 space-y-2">
                    <div className="font-bold text-sm text-white">{app.opportunityId?.company}</div>
                    <div className="text-xs text-purple-400 flex items-center gap-1">
                      <Clock size={12} /> {new Date(app.interviewDetails?.dateTime).toLocaleString()}
                    </div>
                    <div className="text-xs flex items-start gap-1 subtle">
                      <MapPin size={12} className="shrink-0 mt-0.5" />
                      <span>{app.interviewDetails?.venue}</span>
                    </div>
                    {app.interviewDetails?.instructions && (
                      <div className="text-[10px] p-1.5 rounded bg-white/5 font-mono text-slate-400">
                        Instructions: {app.interviewDetails.instructions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Placements Drives & Scholarship Listings */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* Tab Content: Placements list */}
          <div className="card p-6 space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Briefcase size={22} className="text-blue-400" />
              Matching Placements &amp; Internships
            </h2>
            {loadingOps ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="skeleton h-20 w-full" />)}
              </div>
            ) : matchingOps.length === 0 ? (
              <p className="text-sm subtle py-6 text-center border-t">No active matching opportunities matching your department profile.</p>
            ) : (
              <div className="space-y-4 pt-2">
                {matchingOps.map(op => {
                  const applied = myApps.find(a => a.opportunityId?._id === op._id);
                  return (
                    <div 
                      key={op._id} 
                      className="p-4 rounded-lg border flex flex-col md:flex-row md:items-start justify-between gap-4 transition-colors hover:bg-white/5" 
                      style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-base text-white">{op.company}</span>
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {op.driveCode}
                          </span>
                          <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                            op.type === 'Full-time' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                          }`}>
                            {op.type}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-blue-400">{op.title}</h4>
                        <p className="text-xs subtle line-clamp-2 leading-relaxed">{op.description}</p>
                        
                        <div className="text-[11px] flex flex-wrap gap-x-4 gap-y-1 pt-1 subtle">
                          <span>Deadline: {new Date(op.deadline).toLocaleDateString()}</span>
                          {op.salaryPackage > 0 && (
                            <span className="text-green-400 font-semibold">₹{(op.salaryPackage).toLocaleString()} LPA</span>
                          )}
                          {op.eligibility?.minPlacementReadinessScore && (
                            <span>Prereq Score: {op.eligibility.minPlacementReadinessScore}%</span>
                          )}
                        </div>

                        {!op.isEligible && (
                          <div className="text-[10px] text-red-400 bg-red-500/10 p-1.5 rounded mt-2 border border-red-500/20">
                            Ineligible: {op.ineligibilityReason}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0 justify-between self-stretch">
                        {applied ? (
                          <span className={`badge ${
                            applied.status === 'Selected' ? 'badge-green' :
                            applied.status === 'Rejected' ? 'badge-red' :
                            applied.status === 'Withdrawn' ? 'badge-red' : 'badge-yellow'
                          }`}>
                            Applied ({applied.status})
                          </span>
                        ) : (
                          <button
                            disabled={!op.isEligible}
                            onClick={() => { setApplyingOp(op); setError(null); }}
                            className="btn btn-primary text-xs px-4 py-2 disabled:opacity-40"
                          >
                            Apply Now
                          </button>
                        )}

                        {applied && ['Applied', 'Shortlisted', 'Interviewed'].includes(applied.status) && (
                          <button
                            onClick={() => handleWithdrawPlacement(applied._id, op.company)}
                            className="text-xs text-red-400 hover:underline mt-auto"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scholarship composition matching */}
          <div className="card p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Award size={22} className="text-yellow-400" />
                Matching Scholarships
              </h2>

              {/* Income query controller */}
              <div className="flex items-center gap-2">
                <label className="text-xs subtle whitespace-nowrap">Annual Income:</label>
                <input
                  type="number"
                  value={annualIncome}
                  onChange={e => setAnnualIncome(Number(e.target.value))}
                  placeholder="₹ Annual Income"
                  className="input-dark py-1 px-2 text-xs w-28"
                />
                <button onClick={fetchScholarshipData} className="btn btn-outline py-1 px-3 text-xs">Refresh</button>
              </div>
            </div>

            {loadingScholarships ? (
              <div className="skeleton h-20 w-full" />
            ) : matchingScholarships.length === 0 ? (
              <p className="text-sm subtle py-6 text-center border-t">No open matching scholarships matching current profile constraints.</p>
            ) : (
              <div className="space-y-4 pt-2">
                {matchingScholarships.map(s => {
                  const applied = myScholarshipHistory.find(a => a.scholarshipId?._id === s._id);
                  return (
                    <div 
                      key={s._id} 
                      className="p-4 rounded-lg border flex flex-col md:flex-row md:items-start justify-between gap-4 transition-colors hover:bg-white/5" 
                      style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-white">{s.title}</span>
                          <span className="text-green-400 font-semibold text-xs bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                            ₹{s.amount.toLocaleString()} / Yr
                          </span>
                        </div>
                        <h5 className="text-xs text-yellow-400">Offered by {s.provider}</h5>
                        <p className="text-xs subtle leading-relaxed line-clamp-2">{s.description}</p>
                        
                        <div className="text-[10px] subtle flex gap-4 pt-1">
                          <span>Deadline: {new Date(s.deadline).toLocaleDateString()}</span>
                          {s.eligibility?.maxAnnualIncome && (
                            <span>Income Limit: ₹{s.eligibility.maxAnnualIncome.toLocaleString()}</span>
                          )}
                          <span>Min Points: {s.eligibility?.minAchievementPoints || 0} pts</span>
                        </div>

                        {!s.isEligible && (
                          <div className="text-[10px] text-red-400 bg-red-500/10 p-1.5 rounded mt-2 border border-red-500/20">
                            Ineligible: {s.ineligibilityReason}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center self-stretch">
                        {applied ? (
                          <span className={`badge ${
                            applied.status === 'Selected' ? 'badge-green' :
                            applied.status === 'Rejected' ? 'badge-red' : 'badge-yellow'
                          }`}>
                            Applied ({applied.status})
                          </span>
                        ) : (
                          <button
                            disabled={!s.isEligible}
                            onClick={() => { setApplyingScholarship(s); setError(null); }}
                            className="btn btn-primary text-xs px-4 py-2 disabled:opacity-40"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* History details table */}
          <div className="card p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Application Pipeline Log</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b subtle" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
                    <th className="p-3 font-semibold">Details</th>
                    <th className="p-3 font-semibold">Type</th>
                    <th className="p-3 font-semibold">Applied Date</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Audit Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ divideColor: 'var(--border-color)' }}>
                  {loadingApps ? (
                    <tr><td colSpan="5" className="p-3"><Loader className="animate-spin mx-auto" size={16} /></td></tr>
                  ) : myApps.length === 0 && myScholarshipHistory.length === 0 ? (
                    <tr><td colSpan="5" className="p-6 text-center subtle">No active applications history logged.</td></tr>
                  ) : (
                    <>
                      {myApps.map(app => (
                        <tr key={app._id} className="hover:bg-white/5">
                          <td className="p-3">
                            <div className="font-semibold text-white">{app.opportunityId?.company}</div>
                            <div className="subtle">{app.opportunityId?.title}</div>
                          </td>
                          <td className="p-3">Placement</td>
                          <td className="p-3 subtle">{new Date(app.appliedAt).toLocaleDateString()}</td>
                          <td className="p-3">
                            <span className={`badge ${
                              app.status === 'Selected' ? 'badge-green' :
                              app.status === 'Rejected' ? 'badge-red' :
                              app.status === 'Withdrawn' ? 'badge-red' :
                              app.status === 'Interviewed' ? 'badge-orange' : 'badge-yellow'
                            }`}>{app.status}</span>
                          </td>
                          <td className="p-3 max-w-xs truncate" title={app.remarks}>{app.remarks || '—'}</td>
                        </tr>
                      ))}
                      {myScholarshipHistory.map(app => (
                        <tr key={app._id} className="hover:bg-white/5">
                          <td className="p-3">
                            <div className="font-semibold text-white">{app.scholarshipId?.title}</div>
                            <div className="subtle">{app.scholarshipId?.provider}</div>
                          </td>
                          <td className="p-3">Scholarship</td>
                          <td className="p-3 subtle">{new Date(app.appliedAt).toLocaleDateString()}</td>
                          <td className="p-3">
                            <span className={`badge ${
                              app.status === 'Selected' ? 'badge-green' :
                              app.status === 'Rejected' ? 'badge-red' : 'badge-yellow'
                            }`}>{app.status}</span>
                          </td>
                          <td className="p-3 max-w-xs truncate" title={app.remarks}>{app.remarks || '—'}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* PLACEMENT APPLICATION DIALOG MODAL */}
      {applyingOp && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="card max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Apply to {applyingOp.company}</h3>
            <p className="text-xs subtle">Verify your resume URL file link for the recruitment drive application snapshot.</p>
            
            <form onSubmit={handleApplyPlacement} className="space-y-4">
              <div>
                <label htmlFor="apply-resume-url" className="block text-xs subtle mb-1">Resume File Link *</label>
                <input
                  id="apply-resume-url"
                  data-testid="apply-resume-url"
                  type="url"
                  required
                  placeholder="https://res.cloudinary.com/..."
                  value={resumeUrl}
                  onChange={e => setResumeUrl(e.target.value)}
                  className="w-full input-dark py-2 px-3 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setApplyingOp(null)} className="btn btn-outline px-4 py-2 text-xs">Cancel</button>
                <button type="submit" data-testid="placement-apply" disabled={submittingApp} className="btn btn-primary px-4 py-2 text-xs flex items-center gap-1">
                  {submittingApp && <Loader size={12} className="animate-spin" />}
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHOLARSHIP APPLICATION DIALOG MODAL */}
      {applyingScholarship && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="card max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Apply for {applyingScholarship.title}</h3>
            <p className="text-xs subtle">Upload certificate links as academic and socio-economic income proof for evaluation.</p>

            <form onSubmit={handleApplyScholarship} className="space-y-4">
              <div>
                <label htmlFor="apply-annual-income" className="block text-xs subtle mb-1">Annual Income (INR) *</label>
                <input
                  id="apply-annual-income"
                  data-testid="apply-annual-income"
                  type="number"
                  required
                  value={annualIncome}
                  onChange={e => setAnnualIncome(Number(e.target.value))}
                  className="w-full input-dark py-2 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs subtle mb-1">Income Certificate URL Link</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={incomeCertUrl}
                  onChange={e => setIncomeCertUrl(e.target.value)}
                  className="w-full input-dark py-2 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs subtle mb-1">Academic Transcript URL Link</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={transcriptUrl}
                  onChange={e => setTranscriptUrl(e.target.value)}
                  className="w-full input-dark py-2 px-3 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setApplyingScholarship(null)} className="btn btn-outline px-4 py-2 text-xs">Cancel</button>
                <button type="submit" data-testid="scholarship-apply" disabled={submittingScholarshipApp} className="btn btn-primary px-4 py-2 text-xs flex items-center gap-1">
                  {submittingScholarshipApp && <Loader size={12} className="animate-spin" />}
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default StudentPlacementDashboard;
