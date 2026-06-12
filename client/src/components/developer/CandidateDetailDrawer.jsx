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
        className="w-full max-w-xl bg-neutral-900 border-l border-neutral-850 h-full flex flex-col shadow-2xl overflow-hidden animate-slide-in"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <User size={18} className="text-blue-400" />
            <h2 id="drawer-title" className="text-sm font-bold text-white uppercase tracking-wider">
              Candidate Details
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer"
            type="button"
            aria-label="Close candidate drawer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
          
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-20 bg-neutral-800 rounded-lg w-full" />
              <div className="h-24 bg-neutral-800 rounded-lg w-full" />
              <div className="h-32 bg-neutral-800 rounded-lg w-full" />
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
                  <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-lg text-white">
                    {name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base leading-tight">{name}</h3>
                    <p className="text-xs subtle flex items-center gap-1 mt-0.5">
                      <Mail size={12} />
                      <span>{email}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div className="px-3 py-2.5 rounded-lg bg-neutral-950 border border-neutral-850">
                    <span className="subtle block text-[10px] uppercase font-semibold">Department</span>
                    <span className="font-medium text-white truncate block mt-0.5">{department}</span>
                  </div>
                  <div className="px-3 py-2.5 rounded-lg bg-neutral-950 border border-neutral-850">
                    <span className="subtle block text-[10px] uppercase font-semibold">Semester</span>
                    <span className="font-medium text-white block mt-0.5">Semester {semester}</span>
                  </div>
                </div>

                {bio && (
                  <p className="text-xs leading-relaxed text-neutral-400 bg-neutral-950/40 p-3 rounded-lg border border-neutral-850">
                    {bio}
                  </p>
                )}
              </div>

              {/* Section 2: Academic Metrics */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                  <GraduationCap size={14} className="text-blue-400" />
                  Academic Profile
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-850">
                    <span className="subtle block text-[9px] uppercase font-bold">GPA</span>
                    <span className="text-sm font-extrabold text-white block mt-0.5">{gpa}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-850">
                    <span className="subtle block text-[9px] uppercase font-bold">Attendance</span>
                    <span className="text-sm font-extrabold text-white block mt-0.5">{attendanceOverall}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-850">
                    <span className="subtle block text-[9px] uppercase font-bold">Backlogs</span>
                    <span className={`text-sm font-extrabold block mt-0.5 ${backlogs > 0 ? 'text-red-400' : 'text-neutral-300'}`}>
                      {backlogs}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-850">
                    <span className="subtle block text-[9px] uppercase font-bold">Achievement Points</span>
                    <span className="text-sm font-extrabold text-white block mt-0.5">{achievementPoints} pts</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-850">
                    <span className="subtle block text-[9px] uppercase font-bold">Placement Readiness</span>
                    <span className="text-sm font-extrabold text-blue-400 block mt-0.5">{placementReadinessScore} / 100</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Developer Intelligence */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                  <Award size={14} className="text-cyan-400" />
                  Developer Scoring
                </h4>
                
                {!hasDeveloperMetrics ? (
                  <div className="p-3 text-xs border border-dashed rounded-lg border-neutral-800 text-center subtle">
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
                        <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-850">
                          <span className="subtle block text-[9px] uppercase">GitHub Score</span>
                          <span className="font-extrabold block text-cyan-400 mt-0.5">{githubScore}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-850">
                          <span className="subtle block text-[9px] uppercase">DSA Score</span>
                          <span className="font-extrabold block text-blue-400 mt-0.5">{dsaScore}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-850">
                          <span className="subtle block text-[9px] uppercase">CP Score</span>
                          <span className="font-extrabold block text-orange-400 mt-0.5">{cpScore}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-850">
                          <span className="subtle block text-[9px] uppercase">Peak rating</span>
                          <span className="font-extrabold block text-neutral-300 mt-0.5">
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-purple-400" />
                  Portfolio & History
                </h4>

                {/* Skills tags */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold subtle">Technologies & Skills</div>
                  {skills.length === 0 ? (
                    <p className="text-xs subtle">No custom skills linked.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {skills.map((s, idx) => (
                        <span 
                          key={`skill-${s}-${idx}`} 
                          className="text-[10px] font-semibold px-2 py-0.5 rounded"
                          style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary-blue)' }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Projects list */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold subtle">Key Projects</div>
                  {projects.length === 0 ? (
                    <p className="text-xs subtle">No listed projects found.</p>
                  ) : (
                    <div className="space-y-2">
                      {projects.map((p, idx) => (
                        <div 
                          key={p._id || `proj-${idx}`} 
                          className="p-3 rounded-lg border border-neutral-850 bg-neutral-950 text-xs space-y-1"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-bold text-white">{p.name}</span>
                            {p.startDate && (
                              <span className="text-[10px] subtle">
                                {new Date(p.startDate).getFullYear()}
                              </span>
                            )}
                          </div>
                          {p.description && <p className="text-[11px] text-neutral-400 leading-normal">{p.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Education list */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold subtle">Education Details</div>
                  {education.length === 0 ? (
                    <p className="text-xs subtle">No education entries configured.</p>
                  ) : (
                    <div className="space-y-2">
                      {education.map((edu, idx) => (
                        <div 
                          key={edu._id || `edu-${idx}`}
                          className="p-3 rounded-lg border border-neutral-850 bg-neutral-950 text-xs"
                        >
                          <p className="font-bold text-white">{edu.degree} · {edu.field}</p>
                          <p className="text-neutral-400 text-[11px] mt-0.5">{edu.institution}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Certifications list */}
                {certifications.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold subtle">Certifications</div>
                    <div className="space-y-2">
                      {certifications.map((c, idx) => (
                        <div 
                          key={c._id || `cert-${idx}`}
                          className="p-3 rounded-lg border border-neutral-850 bg-neutral-950 text-xs"
                        >
                          <p className="font-bold text-white">{c.title}</p>
                          <p className="text-neutral-400 text-[11px] mt-0.5">Issued by: {c.issuedBy || '—'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 5: Resume Intelligence */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                  <FileText size={14} className="text-emerald-400" />
                  Resume Analytics
                </h4>

                {!hasAtsData ? (
                  <div className="p-3.5 text-xs border border-dashed rounded-lg border-neutral-850 text-center subtle">
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
                        <span className="text-[10px] uppercase font-bold text-neutral-400">ATS score rating</span>
                        <span className="text-xs block font-semibold text-white mt-0.5">
                          Grade Tiers: {getAtsGrade(atsScore)} Grade
                        </span>
                      </div>
                    </div>

                    {/* strengths */}
                    {strengths.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-neutral-400">Top Strengths</span>
                        <ul className="list-disc pl-4 text-xs space-y-0.5">
                          {strengths.slice(0, 3).map((s, idx) => (
                            <li key={`draw-str-${idx}`}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* improvements */}
                    {improvements.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-neutral-400">Key Suggested Improvements</span>
                        <ul className="list-disc pl-4 text-xs space-y-0.5">
                          {improvements.slice(0, 3).map((item, idx) => (
                            <li key={`draw-imp-${idx}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* recommendedRoles */}
                    {recommendedRoles.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[11px] font-semibold text-neutral-400 block">Recommended Career Paths</span>
                        <div className="flex flex-wrap gap-1">
                          {recommendedRoles.map((role, idx) => (
                            <span 
                              key={`draw-role-${role}-${idx}`} 
                              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-950 border border-neutral-850 text-neutral-300"
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
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="btn px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
            type="button"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

export default CandidateDetailDrawer;
