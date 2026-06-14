import React, { useState, useEffect, useRef } from 'react';
import profileApi from '../../api/profile.api.js';
import DeveloperScoreRing from './DeveloperScoreRing.jsx';
import ScoreBreakdownBar from './ScoreBreakdownBar.jsx';
import { 
  X, 
  User, 
  Mail, 
  Award, 
  TrendingUp, 
  CheckCircle, 
  AlertTriangle, 
  GraduationCap, 
  Briefcase,
  BookOpen,
  FileText,
  Target,
  Zap,
  ShieldAlert
} from 'lucide-react';

export function CandidateDetailDrawer({ userId, isOpen, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const drawerRef = useRef(null);

  // Fetch candidate profile details when open and userId changes
  useEffect(() => {
    if (!isOpen || !userId) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await profileApi.getUserProfile(userId);
        setProfile(res.profile || null);
      } catch (err) {
        setError(err.message || 'Failed to load candidate profile details.');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [userId, isOpen]);

  // Escape Key closes drawer & Focus Trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!drawerRef.current) return;
        const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(drawerRef.current.querySelectorAll(focusableSelectors));
        if (focusableElements.length === 0) return;

        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            lastEl.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastEl) {
            firstEl.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Auto-focus close button
    const timer = setTimeout(() => {
      if (drawerRef.current) {
        const closeBtn = drawerRef.current.querySelector('button[aria-label="Close candidate drawer"]');
        if (closeBtn) closeBtn.focus();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Resolve subscore objects and values with defensive defaults
  const userDetails = profile?.userId || {};
  const name = userDetails.name || 'Unnamed Candidate';
  const email = userDetails.email || '—';
  const department = userDetails.department || '—';
  const semester = userDetails.semester || '—';
  const bio = profile?.bio || '';

  const gpa = profile?.gpa != null ? profile.gpa : '—';
  const attendanceOverall = profile?.attendanceOverall != null ? `${profile.attendanceOverall}%` : '—';
  const placementReadinessScore = profile?.placementReadinessScore ?? 0;
  const achievementPoints = profile?.achievementPoints ?? 0;
  const backlogs = profile?.backlogs ?? 0;

  // Developer metrics existence check (Faculty Redaction Guard)
  const developerScore = profile?.developerScore;
  const hasDeveloperMetrics = developerScore !== undefined;

  const githubScore = profile?.githubScore ?? 0;
  const dsaScore = profile?.dsaScore ?? 0;
  const cpScore = profile?.cpScore ?? 0;
  const scoreBreakdown = profile?.scoreBreakdown;

  const skills = profile?.skills || [];
  const projects = profile?.projects || [];
  const certifications = profile?.certifications || [];
  const education = profile?.education || [];

  // Resume Intelligence data matching profile.resumeAnalysis structure
  const resumeAnalysis = profile?.resumeAnalysis;
  const atsScore = resumeAnalysis?.atsScore;
  const hasAtsData = atsScore !== undefined && atsScore !== null;
  const strengths = resumeAnalysis?.strengths || [];
  const improvements = resumeAnalysis?.improvements || [];
  const recommendedRoles = resumeAnalysis?.recommendedRoles || [];

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/60 transition-opacity duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* Drawer Body Panel */}
      <div 
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl border-l h-full flex flex-col shadow-2xl overflow-hidden animate-slide-in animate-duration-200"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <User size={18} style={{ color: 'var(--accent)' }} />
            <h2 id="drawer-title" className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              Candidate Details
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg transition-all cursor-pointer hover:bg-[var(--card-hover)]"
            style={{ color: 'var(--text-secondary)' }}
            type="button"
            aria-label="Close candidate drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
          
          {loading ? (
            <div className="space-y-4">
              <div className="h-20 skeleton rounded-lg w-full" />
              <div className="h-24 skeleton rounded-lg w-full" />
              <div className="h-32 skeleton rounded-lg w-full" />
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg flex items-start gap-2 border border-red-500/20 bg-red-500/5 text-red-500">
              <ShieldAlert size={18} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-xs">Error loading profile</span>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Section 1: Personal Overview */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border flex items-center justify-center font-bold text-lg" style={{ backgroundColor: 'var(--bg-soft)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    {name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base leading-tight" style={{ color: 'var(--text-primary)' }}>{name}</h3>
                    <p className="text-xs subtle flex items-center gap-1 mt-0.5">
                      <Mail size={12} />
                      <span style={{ color: 'var(--text-secondary)' }}>{email}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div className="px-3 py-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}>
                    <span className="subtle block text-[10px] uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>Department</span>
                    <span className="font-medium truncate block mt-0.5" style={{ color: 'var(--text-primary)' }}>{department}</span>
                  </div>
                  <div className="px-3 py-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}>
                    <span className="subtle block text-[10px] uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>Semester</span>
                    <span className="font-medium block mt-0.5" style={{ color: 'var(--text-primary)' }}>Semester {semester}</span>
                  </div>
                </div>

                {bio && (
                  <p className="text-xs leading-relaxed p-3 rounded-lg border" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-soft)', borderColor: 'var(--border)' }}>
                    {bio}
                  </p>
                )}
              </div>

              {/* Section 2: Academic Metrics */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider pb-1.5 flex items-center gap-1.5 border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  <GraduationCap size={14} className="text-blue-500" />
                  Academic Profile
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}>
                    <span className="subtle block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>GPA</span>
                    <span className="text-sm font-extrabold block mt-0.5" style={{ color: 'var(--text-primary)' }}>{gpa}</span>
                  </div>
                  <div className="p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}>
                    <span className="subtle block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Attendance</span>
                    <span className="text-sm font-extrabold block mt-0.5" style={{ color: 'var(--text-primary)' }}>{attendanceOverall}</span>
                  </div>
                  <div className="p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}>
                    <span className="subtle block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Backlogs</span>
                    <span className={`text-sm font-extrabold block mt-0.5 ${backlogs > 0 ? 'text-red-500' : ''}`} style={backlogs === 0 ? { color: 'var(--text-primary)' } : {}}>
                      {backlogs}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}>
                    <span className="subtle block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Achievement Points</span>
                    <span className="text-sm font-extrabold block mt-0.5" style={{ color: 'var(--text-primary)' }}>{achievementPoints} pts</span>
                  </div>
                  <div className="p-2.5 rounded-lg border" style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}>
                    <span className="subtle block text-[9px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Placement Readiness</span>
                    <span className="text-sm font-extrabold block mt-0.5" style={{ color: 'var(--accent)' }}>{placementReadinessScore} / 100</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Developer Intelligence */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider pb-1.5 flex items-center gap-1.5 border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  <Award size={14} className="text-amber-500" />
                  Developer Scoring
                </h4>
                
                {!hasDeveloperMetrics ? (
                  <div className="p-3 text-xs border border-dashed rounded-lg text-center subtle" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    Developer scoring metrics redacted or uncalculated.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Ring and subscore metrics grid */}
                    <div className="grid grid-cols-3 gap-4 items-center">
                      <div className="flex justify-center">
                        <DeveloperScoreRing score={developerScore} size={90} strokeWidth={8} label="Dev Score" />
                      </div>
                      <div className="col-span-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg border" style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}>
                          <span className="subtle block text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>GitHub Score</span>
                          <span className="font-extrabold block mt-0.5" style={{ color: 'var(--accent)' }}>{githubScore}</span>
                        </div>
                        <div className="p-2 rounded-lg border" style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}>
                          <span className="subtle block text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>DSA Score</span>
                          <span className="font-extrabold block mt-0.5 text-blue-500">{dsaScore}</span>
                        </div>
                        <div className="p-2 rounded-lg border" style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}>
                          <span className="subtle block text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>CP Score</span>
                          <span className="font-extrabold block mt-0.5 text-orange-500">{cpScore}</span>
                        </div>
                        <div className="p-2 rounded-lg border" style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}>
                          <span className="subtle block text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>Peak rating</span>
                          <span className="font-extrabold block mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            {profile.codingStats?.codeforcesMaxRating || '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <ScoreBreakdownBar scoreBreakdown={scoreBreakdown} />
                  </div>
                )}
              </div>

              {/* Section 4: Skills & Projects */}
              <div className="space-y-5">
                <h4 className="text-xs font-bold uppercase tracking-wider pb-1.5 flex items-center gap-1.5 border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  <Briefcase size={14} className="text-purple-500" />
                  Portfolio & History
                </h4>

                {/* Skills tags */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold subtle" style={{ color: 'var(--text-secondary)' }}>Technologies & Skills</div>
                  {skills.length === 0 ? (
                    <p className="text-xs subtle" style={{ color: 'var(--text-muted)' }}>No custom skills linked.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {skills.map((s, idx) => (
                        <span 
                          key={`skill-${s}-${idx}`} 
                          className="text-[10px] font-semibold px-2 py-0.5 rounded"
                          style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent)' }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Projects list */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold subtle" style={{ color: 'var(--text-secondary)' }}>Key Projects</div>
                  {projects.length === 0 ? (
                    <p className="text-xs subtle" style={{ color: 'var(--text-muted)' }}>No listed projects found.</p>
                  ) : (
                    <div className="space-y-2">
                      {projects.map((p, idx) => (
                        <div 
                          key={p._id || `proj-${idx}`} 
                          className="p-3 rounded-lg border text-xs space-y-1"
                          style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold animate-pulse-slow" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
                            {p.startDate && (
                              <span className="text-[10px] subtle" style={{ color: 'var(--text-muted)' }}>
                                {new Date(p.startDate).getFullYear()}
                              </span>
                            )}
                          </div>
                          {p.description && <p className="text-[11px] leading-normal" style={{ color: 'var(--text-secondary)' }}>{p.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Education list */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold subtle" style={{ color: 'var(--text-secondary)' }}>Education Details</div>
                  {education.length === 0 ? (
                    <p className="text-xs subtle" style={{ color: 'var(--text-muted)' }}>No education entries configured.</p>
                  ) : (
                    <div className="space-y-2">
                      {education.map((edu, idx) => (
                        <div 
                          key={edu._id || `edu-${idx}`}
                          className="p-3 rounded-lg border text-xs"
                          style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}
                        >
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{edu.degree} · {edu.field}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{edu.institution}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Certifications list */}
                {certifications.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold subtle" style={{ color: 'var(--text-secondary)' }}>Certifications</div>
                    <div className="space-y-2">
                      {certifications.map((c, idx) => (
                        <div 
                          key={c._id || `cert-${idx}`}
                          className="p-3 rounded-lg border text-xs"
                          style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)' }}
                        >
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{c.title}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>Issued by: {c.issuedBy || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 5: Resume Intelligence */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider pb-1.5 flex items-center gap-1.5 border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                  <FileText size={14} className="text-emerald-500" />
                  Resume Analytics
                </h4>

                {!hasAtsData ? (
                  <div className="p-3.5 text-xs border border-dashed rounded-lg text-center subtle" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    No active resume analysis matches available (N/A).
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Score indicators */}
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-base border" style={{ borderColor: scoreColor(atsScore), color: scoreColor(atsScore) }}>
                        {atsScore}
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>ATS score rating</span>
                        <span className="text-xs block font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                          Grade Tiers: {getAtsGrade(atsScore)} Grade
                        </span>
                      </div>
                    </div>

                    {/* strengths */}
                    {strengths.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Top Strengths</span>
                        <ul className="list-disc pl-4 text-xs space-y-0.5" style={{ color: 'var(--text-primary)' }}>
                          {strengths.slice(0, 3).map((s, idx) => (
                            <li key={`draw-str-${idx}`}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* improvements */}
                    {improvements.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>Key Suggested Improvements</span>
                        <ul className="list-disc pl-4 text-xs space-y-0.5" style={{ color: 'var(--text-primary)' }}>
                          {improvements.slice(0, 3).map((item, idx) => (
                            <li key={`draw-imp-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* recommendedRoles */}
                    {recommendedRoles.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold block" style={{ color: 'var(--text-secondary)' }}>Recommended Career Paths</span>
                        <div className="flex flex-wrap gap-1">
                          {recommendedRoles.map((role, idx) => (
                            <span 
                              key={`draw-role-${role}-${idx}`} 
                              className="text-[10px] font-semibold px-2 py-0.5 rounded border"
                              style={{ backgroundColor: 'var(--bg-medium)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t flex justify-end shrink-0" style={{ borderTopColor: 'var(--border)', backgroundColor: 'var(--bg-medium)' }}>
          <button
            onClick={onClose}
            className="btn btn-outline px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer"
            type="button"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map a 0-100 score to a colour: red / amber / green */
function scoreColor(score) {
  if (score == null) return 'var(--text-secondary)';
  if (score < 50) return '#ef4444';
  if (score < 75) return '#f59e0b';
  return '#22c55e';
}

/** Calculate descriptive ATS Letter Grade client-side */
function getAtsGrade(atsScore) {
  if (atsScore === null || atsScore === undefined) return 'N/A';
  if (atsScore >= 90) return 'A';
  if (atsScore >= 75) return 'B';
  if (atsScore >= 60) return 'C';
  return 'D';
}

export default CandidateDetailDrawer;
