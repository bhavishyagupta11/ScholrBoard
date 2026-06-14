/**
 * ResumeImportPage.jsx — Production-grade Resume Analyzer
 *
 * Sections:
 *  1. Upload — drag/drop zone with progress, triggers AI analysis on success
 *  2. Results — full scorecard rendered when analysis.analysisStatus === 'completed'
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, FileText, CheckCircle, AlertCircle, Award,
  Target, TrendingUp, Zap, BookOpen, ChevronDown, ChevronUp,
  RefreshCw, X, User, Mail, GraduationCap, Briefcase, Star,
  ExternalLink,
} from 'lucide-react';
import uploadApi from '../api/upload.api.js';
import aiApi from '../api/ai.api.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract a plain string ID from either a string or an object with ._id */
function resolveId(raw) {
  if (!raw) return '';
  if (typeof raw === 'object' && raw._id) return String(raw._id);
  return String(raw);
}

/** Map a 0-100 score to a colour: red / amber / green */
function scoreColor(score) {
  if (score == null) return 'var(--text-secondary)';
  if (score < 50)  return '#ef4444';
  if (score < 75)  return '#f59e0b';
  return '#22c55e';
}

/** SVG arc-ring for score meters */
function ScoreRing({ score, size = 120, strokeWidth = 10, label }) {
  const radius    = (size - strokeWidth) / 2;
  const circ      = 2 * Math.PI * radius;
  const pct       = Math.min(Math.max(score ?? 0, 0), 100);
  const dashOffset = circ - (pct / 100) * circ;
  const color      = scoreColor(pct);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border-color)" strokeWidth={strokeWidth}
        />
        {/* progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)' }}
        />
        {/* label in centre */}
        <text
          x="50%" y="50%"
          dominantBaseline="middle" textAnchor="middle"
          style={{
            transform: 'rotate(90deg)',
            transformOrigin: '50% 50%',
            fontSize: size * 0.22,
            fontWeight: 800,
            fill: color,
          }}
        >
          {pct}
        </text>
      </svg>
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ─── Accordion section card ───────────────────────────────────────────────────
function AccordionCard({ title, score, children }) {
  const [open, setOpen] = useState(false);
  const clr = scoreColor(score != null ? score * 10 : null);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border-color)', background: 'var(--bg-medium)' }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ background: 'transparent' }}
      >
        <div className="flex items-center gap-3">
          <BookOpen size={16} style={{ color: 'var(--primary-blue)' }} />
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {score != null && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${clr}22`, color: clr, border: `1px solid ${clr}44` }}
            >
              {score}/10
            </span>
          )}
          {open ? <ChevronUp size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />}
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3" style={{ borderTop: '1px solid var(--border-color)' }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Pill badge ───────────────────────────────────────────────────────────────
function Pill({ label, color = 'var(--primary-blue)' }) {
  return (
    <span
      className="inline-flex items-center text-xs font-semibold rounded-full px-3 py-1"
      style={{ background: `${color}18`, color: color, border: `1px solid ${color}33` }}
    >
      {label}
    </span>
  );
}

// ─── Importance badge ─────────────────────────────────────────────────────────
function ImportanceBadge({ level }) {
  const map = {
    high:   { bg: '#ef444420', color: '#ef4444', label: 'High' },
    medium: { bg: '#f59e0b20', color: '#f59e0b', label: 'Medium' },
    low:    { bg: '#22c55e20', color: '#22c55e', label: 'Low' },
  };
  const cfg = map[(level || '').toLowerCase()] || map.medium;
  return (
    <span
      className="text-xs font-bold rounded-full px-2 py-0.5"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44` }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Processing spinner ───────────────────────────────────────────────────────
function ProcessingBanner() {
  return (
    <div
      className="card p-8 flex flex-col items-center gap-4 text-center"
      style={{ borderColor: 'var(--primary-blue)', borderStyle: 'dashed' }}
    >
      <div className="relative">
        <div
          className="w-16 h-16 rounded-full border-4 border-transparent"
          style={{
            borderTopColor: 'var(--primary-blue)',
            borderRightColor: 'var(--primary-blue)',
            animation: 'spin 1s linear infinite',
          }}
        />
        <Award
          size={22}
          className="absolute inset-0 m-auto"
          style={{ color: 'var(--primary-blue)' }}
        />
      </div>
      <div>
        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          AI is analyzing your resume…
        </p>
        <p className="text-sm subtle mt-1">This usually takes 15–30 seconds. Hang tight!</p>
      </div>
    </div>
  );
}

// ─── Full results scorecard ───────────────────────────────────────────────────
function ResultsSection({ analysis }) {
  const ai  = analysis                 || {};
  const parsed = analysis?.parsedData  || {};

  const strengths    = ai.strengths    || [];
  const improvements = ai.improvements || [];
  const skillsDetected = ai.skillsDetected || [];
  const skillGaps    = ai.skillGaps    || [];
  const sectionFeedback = ai.sectionFeedback || [];
  const recommendedRoles = ai.recommendedRoles || [];
  const keywordsToAdd  = ai.keywordsToAdd  || [];
  const summary      = ai.summary      || '';
  const atsScore     = ai.atsScore     ?? null;
  const overallScore = ai.overallScore ?? null;

  // parsed data
  const name     = parsed.name     || analysis?.fileName?.replace(/\.[^.]+$/, '') || '—';
  const email    = parsed.email    || '—';
  const education     = parsed.education     || [];
  const experience    = parsed.experience    || [];
  const projects      = parsed.projects      || [];
  const certifications = parsed.certifications || [];

  return (
    <div className="space-y-6 fade-in-up">

      {/* ── Score meters ────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Award size={20} style={{ color: 'var(--primary-blue)' }} />
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Resume Scorecard
          </h2>
        </div>
        <div className="flex flex-wrap gap-10 justify-center md:justify-start">
          <ScoreRing score={atsScore}     size={130} label="ATS Score"     />
          <ScoreRing score={overallScore} size={130} label="Overall Score" />
          {/* Legend */}
          <div className="flex flex-col justify-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />{'< 50 – Needs Work'}</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />{'50–74 – Fair'}</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />{'≥ 75 – Great'}</div>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <p className="mt-6 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {summary}
          </p>
        )}
      </div>

      {/* PDF Document Preview */}
      {analysis.fileUrl && (
        <div className="card p-6 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4 border-b pb-4" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <FileText size={20} style={{ color: 'var(--primary-blue)' }} />
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                Resume Document Preview
              </h3>
            </div>
            <div className="flex gap-2">
              <a
                href={analysis.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <ExternalLink size={14} /> Open in New Tab
              </a>
              <a
                href={analysis.fileUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline text-xs px-3 py-1.5"
              >
                Download PDF
              </a>
            </div>
          </div>
          <div className="w-full overflow-hidden bg-black/20 rounded-lg p-2" style={{ border: '1px solid var(--border-color)' }}>
            <iframe
              src={analysis.fileUrl}
              title="Resume PDF Preview"
              className="w-full h-[60vh] rounded border-0"
            />
          </div>
        </div>
      )}

      {/* ── Strengths & Improvements ────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Strengths */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={18} className="text-green-400" />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Strengths</h3>
          </div>
          {strengths.length === 0 ? (
            <p className="text-sm subtle">No strengths data available.</p>
          ) : (
            <ul className="space-y-2">
              {strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <CheckCircle size={14} className="mt-0.5 shrink-0 text-green-400" />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Improvements */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} style={{ color: '#f59e0b' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Areas to Improve</h3>
          </div>
          {improvements.length === 0 ? (
            <p className="text-sm subtle">No improvement data available.</p>
          ) : (
            <ul className="space-y-2">
              {improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                  <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: '#f59e0b' }} />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Skills Detected ─────────────────────────────────────── */}
      {skillsDetected.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} style={{ color: 'var(--primary-blue)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Skills Detected</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {skillsDetected.map((sk, i) => (
              <Pill key={i} label={sk} color="var(--primary-blue)" />
            ))}
          </div>
        </div>
      )}

      {/* ── Skill Gaps ──────────────────────────────────────────── */}
      {skillGaps.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target size={18} style={{ color: '#ef4444' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Skill Gaps</h3>
          </div>
          <div className="space-y-3">
            {skillGaps.map((gap, i) => {
              const skillName  = typeof gap === 'string' ? gap : (gap.skill || gap.name || JSON.stringify(gap));
              const importance = typeof gap === 'object' ? gap.importance : null;
              const suggestion = typeof gap === 'object' ? (gap.suggestion || gap.description) : null;
              return (
                <div
                  key={i}
                  className="flex flex-col gap-1 px-4 py-3 rounded-lg"
                  style={{ background: 'var(--bg-medium)', border: '1px solid var(--border-color)' }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{skillName}</span>
                    {importance && <ImportanceBadge level={importance} />}
                  </div>
                  {suggestion && (
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{suggestion}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section Feedback ────────────────────────────────────── */}
      {sectionFeedback.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={18} style={{ color: 'var(--primary-blue)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Section Feedback</h3>
          </div>
          {sectionFeedback.map((sec, i) => {
            const sectionName = sec.section || sec.name || `Section ${i + 1}`;
            const secScore    = sec.score ?? null;
            const feedback    = sec.feedback || '';
            const tips        = sec.tips || sec.suggestions || [];
            return (
              <AccordionCard key={i} title={sectionName} score={secScore}>
                <div className="pt-3 space-y-3">
                  {feedback && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{feedback}</p>
                  )}
                  {tips.length > 0 && (
                    <ul className="space-y-1">
                      {(Array.isArray(tips) ? tips : [tips]).map((tip, ti) => (
                        <li key={ti} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <Star size={11} className="mt-0.5 shrink-0" style={{ color: 'var(--primary-blue)' }} />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </AccordionCard>
            );
          })}
        </div>
      )}

      {/* ── Recommended Roles ───────────────────────────────────── */}
      {recommendedRoles.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={18} style={{ color: 'var(--primary-blue)' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Recommended Roles</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {recommendedRoles.map((role, i) => (
              <Pill key={i} label={role} color="var(--primary-blue)" />
            ))}
          </div>
        </div>
      )}

      {/* ── Keywords to Add ─────────────────────────────────────── */}
      {keywordsToAdd.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} style={{ color: '#f59e0b' }} />
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Keywords to Add</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {keywordsToAdd.map((kw, i) => (
              <Pill key={i} label={kw} color="#f59e0b" />
            ))}
          </div>
        </div>
      )}

      {/* ── Parsed Data block ───────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <User size={18} style={{ color: 'var(--primary-blue)' }} />
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Parsed Resume Data</h3>
        </div>
        <div className="space-y-4 text-sm">
          {/* Name & Email */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg-medium)', border: '1px solid var(--border-color)' }}
            >
              <User size={14} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Name:</span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
            </div>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--bg-medium)', border: '1px solid var(--border-color)' }}
            >
              <Mail size={14} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Email:</span>
              <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{email}</span>
            </div>
          </div>

          {/* Education */}
          {education.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap size={14} style={{ color: 'var(--primary-blue)' }} />
                <span className="font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Education</span>
              </div>
              <div className="space-y-2">
                {education.map((edu, i) => {
                  if (!edu) return null;
                  const deg = typeof edu === 'string' ? edu : (edu.degree || 'Degree');
                  const spec = typeof edu === 'object' ? edu.specialization : null;
                  const inst = typeof edu === 'object' ? edu.institution : null;
                  const dates = typeof edu === 'object' ? [edu.start_date, edu.end_date].filter(Boolean).join(' - ') : null;
                  const score = typeof edu === 'object' ? (edu.cgpa ? `CGPA: ${edu.cgpa}` : edu.percentage ? `Percentage: ${edu.percentage}%` : null) : null;

                  return (
                    <div
                      key={i}
                      className="px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-medium)', border: '1px solid var(--border-color)' }}
                    >
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {deg}{spec ? ` in ${spec}` : ''}
                      </p>
                      {inst && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {inst}
                        </p>
                      )}
                      {(dates || score) && (
                        <p className="text-xs mt-0.5 subtle">
                          {[dates, score].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Work Experience */}
          {experience.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase size={14} style={{ color: 'var(--primary-blue)' }} />
                <span className="font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Work Experience</span>
              </div>
              <div className="space-y-3">
                {experience.map((exp, i) => {
                  if (!exp) return null;
                  const company = exp.company || 'Company';
                  const title = exp.job_title || exp.role || 'Role';
                  const dates = [exp.start_date, exp.end_date].filter(Boolean).join(' - ') || exp.duration;
                  const location = exp.location;
                  const resp = Array.isArray(exp.responsibilities) ? exp.responsibilities : [];

                  return (
                    <div
                      key={i}
                      className="p-3 rounded-lg"
                      style={{ background: 'var(--bg-medium)', border: '1px solid var(--border-color)' }}
                    >
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</span>
                        {dates && <span className="text-xs subtle">{dates}</span>}
                      </div>
                      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {company}{location ? ` · ${location}` : ''}
                      </p>
                      {resp.length > 0 && (
                        <ul className="list-disc pl-4 mt-2 space-y-1">
                          {resp.slice(0, 3).map((r, ri) => (
                            <li key={ri} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                              {r}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Projects */}
          {projects.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase size={14} style={{ color: 'var(--primary-blue)' }} />
                <span className="font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Projects Detected</span>
              </div>
              <div className="space-y-3">
                {projects.map((p, i) => {
                  if (!p) return null;
                  const pname = typeof p === 'string' ? p : (p.project_name || p.name || p.title || 'Untitled Project');
                  const desc = typeof p === 'object' ? p.description : null;
                  const techs = typeof p === 'object' && Array.isArray(p.technologies) ? p.technologies : [];
                  const link = typeof p === 'object' ? (p.github_link || p.live_link || p.link) : null;
                  const duration = typeof p === 'object' ? p.duration : null;

                  return (
                    <div
                      key={i}
                      className="p-3 rounded-lg"
                      style={{ background: 'var(--bg-medium)', border: '1px solid var(--border-color)' }}
                    >
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{pname}</span>
                        {duration && <span className="text-xs subtle">{duration}</span>}
                      </div>
                      {desc && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{desc}</p>}
                      {techs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {techs.map((t, ti) => (
                            <span
                              key={ti}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded"
                              style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary-blue)' }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      {link && (
                        <div className="mt-2">
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs inline-flex items-center gap-1 font-medium hover:underline"
                            style={{ color: 'var(--primary-blue)' }}
                          >
                            View Project Link
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Certifications */}
          {certifications.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Award size={14} style={{ color: 'var(--primary-blue)' }} />
                <span className="font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Certifications</span>
              </div>
              <div className="space-y-2">
                {certifications.map((c, i) => {
                  if (!c) return null;
                  const cname = typeof c === 'string' ? c : (c.name || c.title || 'Untitled Certificate');
                  const issuer = typeof c === 'object' ? (c.issuing_organization || c.issuer) : null;
                  const date = typeof c === 'object' ? (c.issue_date || c.date) : null;
                  const credUrl = typeof c === 'object' ? (c.credential_url || c.url) : null;

                  return (
                    <div
                      key={i}
                      className="p-3 rounded-lg"
                      style={{ background: 'var(--bg-medium)', border: '1px solid var(--border-color)' }}
                    >
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{cname}</span>
                        {date && <span className="text-xs subtle">{date}</span>}
                      </div>
                      {issuer && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Issued by: {issuer}</p>}
                      {credUrl && (
                        <div className="mt-1">
                          <a
                            href={credUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs inline-flex items-center gap-1 font-medium hover:underline"
                            style={{ color: '#22c55e' }}
                          >
                            View Credential
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── History list item ────────────────────────────────────────────────────────
function HistoryItem({ analysis, isActive, onClick }) {
  const status = analysis.analysisStatus || 'pending';
  const badgeClass =
    status === 'completed' ? 'badge-green' :
    status === 'failed'    ? 'badge-red'   : 'badge-yellow';
  const badgeLabel =
    status === 'completed' ? 'Analyzed'    :
    status === 'failed'    ? 'Failed'      : 'Processing…';

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-left transition-all duration-150"
      style={{
        background: isActive ? 'color-mix(in srgb, var(--primary-blue) 10%, var(--surface-card))' : 'var(--bg-medium)',
        border: `1px solid ${isActive ? 'var(--primary-blue)' : 'var(--border-color)'}`,
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileText
          size={20}
          style={{ color: 'var(--primary-blue)', flexShrink: 0 }}
        />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {analysis.fileName}
          </p>
          <p className="text-xs subtle">{new Date(analysis.createdAt).toLocaleString()}</p>
        </div>
      </div>
      <span className={`badge ${badgeClass} shrink-0`}>{badgeLabel}</span>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function ResumeAnalyzerPage() {

  // ── Upload state ────────────────────────────────────────────────────────────
  const [file,          setFile]          = useState(null);
  const [dragging,      setDragging]      = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Analysis / polling state ─────────────────────────────────────────────────
  const [analyses,       setAnalyses]       = useState([]);
  const [activeId,       setActiveId]       = useState(null);
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [processing,     setProcessing]     = useState(false);
  const [analysisError,  setAnalysisError]  = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const pollTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Fetch history list ───────────────────────────────────────────────────────
  const fetchAnalyses = useCallback(async () => {
    try {
      const res = await uploadApi.getResumeAnalyses();
      setAnalyses(res.analyses || []);
    } catch (err) {
      console.error('Failed to load analyses:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { fetchAnalyses(); }, [fetchAnalyses]);

  // ── Poll a single analysis until completed/failed ────────────────────────────
  const pollAnalysis = useCallback(async (id) => {
    clearInterval(pollTimerRef.current);

    const check = async () => {
      try {
        const res = await uploadApi.getResumeAnalysis(id);
        const a   = res.analysis || res;
        setActiveAnalysis(a);
        // Refresh history list so badges update
        setAnalyses(prev => prev.map(x => resolveId(x._id) === id ? { ...x, analysisStatus: a.analysisStatus } : x));

        if (a.analysisStatus === 'completed' || a.analysisStatus === 'failed') {
          clearInterval(pollTimerRef.current);
          setProcessing(false);
          if (a.analysisStatus === 'failed') {
            setAnalysisError('AI analysis failed. Please try uploading again.');
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
        clearInterval(pollTimerRef.current);
        setProcessing(false);
        setAnalysisError('Lost connection while checking analysis status.');
      }
    };

    // Immediate first check
    await check();
    // Then every 4 seconds
    pollTimerRef.current = setInterval(check, 4000);
  }, []);

  useEffect(() => () => clearInterval(pollTimerRef.current), []);

  // ── Load a historical analysis on click ──────────────────────────────────────
  const loadAnalysis = useCallback(async (id) => {
    if (activeId === id) return;
    setActiveId(id);
    setActiveAnalysis(null);
    setAnalysisError(null);
    setProcessing(false);

    try {
      const res = await uploadApi.getResumeAnalysis(id);
      const a   = res.analysis || res;
      setActiveAnalysis(a);

      if (a.analysisStatus === 'processing' || a.analysisStatus === 'pending') {
        setProcessing(true);
        pollAnalysis(id);
      }
    } catch (err) {
      setAnalysisError(err.message || 'Failed to load analysis.');
    }
  }, [activeId, pollAnalysis]);

  // ── File handling ────────────────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(f.type)) {
      setUploadError('Only PDF or DOCX files are accepted.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setUploadError('File must be under 5 MB.');
      return;
    }
    setFile(f);
    setUploadError(null);
    setUploadSuccess(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  // ── Upload & trigger analysis ─────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadError(null);
    setAnalysisError(null);
    setUploadProgress(0);

    // Simulate visual progress ticks while the real upload runs
    const progressInterval = setInterval(() => {
      setUploadProgress(p => Math.min(p + 8, 85));
    }, 200);

    try {
      const res   = await uploadApi.uploadResume(file);
      const rawId = res.analysisId || res.analysis?._id || res._id;
      const aid   = resolveId(rawId);

      setUploadProgress(100);
      clearInterval(progressInterval);
      setUploadSuccess(true);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refresh history
      await fetchAnalyses();

      if (aid) {
        setActiveId(aid);
        setActiveAnalysis(null);
        setProcessing(true);

        // Trigger AI analysis
        try {
          await aiApi.analyzeResume(aid);
        } catch (e) {
          console.warn('analyzeResume call failed, will still poll:', e);
        }

        // Start polling
        pollAnalysis(aid);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      setUploadError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const showResults = activeAnalysis?.analysisStatus === 'completed';

  // ── Render ───────────────────────────────────────────────────────────────────
  const completedAnalysis = analyses.find(a => a.analysisStatus === 'completed');
  const latestAtsScore = completedAnalysis?.atsScore ?? '—';
  const latestDate = completedAnalysis?.createdAt 
    ? new Date(completedAnalysis.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) 
    : 'No completed analysis yet';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Resume Analyzer
        </h1>
        <p className="mt-2 subtle">
          Upload your resume (PDF or DOCX) to receive an AI-powered ATS score, skill analysis, section feedback, and career recommendations.
        </p>
      </div>



      {/* ── SECTION 1: Upload ────────────────────────────────────────────── */}
      <div className="card p-6 md:p-8">
        <div className="flex items-center gap-2 mb-5">
          <Upload size={20} style={{ color: 'var(--primary-blue)' }} />
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Upload Resume</h2>
        </div>

        {/* Error banner */}
        {uploadError && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg text-sm mb-4"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }}
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{uploadError}</span>
            <button className="ml-auto" onClick={() => setUploadError(null)}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Success banner */}
        {uploadSuccess && (
          <div
            className="flex items-center gap-3 p-4 rounded-lg mb-4"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)' }}
          >
            <CheckCircle size={20} style={{ color: '#22c55e', flexShrink: 0 }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#22c55e' }}>Resume uploaded successfully</p>
              <p className="text-xs subtle mt-0.5">AI analysis has started — results will appear below.</p>
            </div>
            <button className="ml-auto" onClick={() => setUploadSuccess(false)}>
              <X size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200"
          style={{
            borderColor: dragging ? 'var(--primary-blue)' : file ? 'var(--primary-blue)' : 'var(--border-color)',
            background:  dragging ? 'color-mix(in srgb, var(--primary-blue) 6%, transparent)' : 'transparent',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />

          {file ? (
            <FileText size={48} className="mx-auto mb-3" style={{ color: 'var(--primary-blue)' }} />
          ) : (
            <Upload size={48} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
          )}

          <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            {file ? file.name : 'Drag & drop or click to select'}
          </p>
          <p className="text-sm subtle">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · PDF / DOCX` : 'PDF or DOCX · max 5 MB'}
          </p>

          {file && (
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); setUploadError(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="absolute top-3 right-3 p-1 rounded-full"
              style={{ background: 'var(--bg-medium)', border: '1px solid var(--border-color)' }}
            >
              <X size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="mt-4">
            <div className="flex justify-between text-xs subtle mb-1">
              <span>Uploading…</span><span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%`, background: 'var(--primary-blue)' }}
              />
            </div>
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="btn btn-primary w-full mt-4 py-3 text-base"
          style={{ opacity: (!file || uploading) ? 0.55 : 1 }}
        >
          {uploading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload size={16} />
              Analyze Resume with AI
            </>
          )}
        </button>
      </div>

      {/* ── History list ─────────────────────────────────────────────────── */}
      {(loadingHistory || analyses.length > 0) && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Analyses</h3>
            <button
              onClick={fetchAnalyses}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
          </div>

          {loadingHistory ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="skeleton h-14 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {analyses.map(a => (
                <HistoryItem
                  key={resolveId(a._id)}
                  analysis={a}
                  isActive={activeId === resolveId(a._id)}
                  onClick={() => loadAnalysis(resolveId(a._id))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 2: Results ───────────────────────────────────────────── */}
      {activeId && (
        <div>
          {/* Processing spinner */}
          {processing && <ProcessingBanner />}

          {/* Analysis error */}
          {!processing && analysisError && (
            <div
              className="flex items-center gap-2 p-4 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <AlertCircle size={18} className="shrink-0" />
              {analysisError}
            </div>
          )}

          {/* Completed results */}
          {!processing && !analysisError && showResults && (
            <ResultsSection analysis={activeAnalysis} />
          )}

          {/* Loaded but not yet completed */}
          {!processing && !analysisError && activeAnalysis && !showResults && (
            <div
              className="card p-6 text-center"
              style={{ borderColor: 'var(--border-color)', borderStyle: 'dashed' }}
            >
              <FileText size={36} className="mx-auto mb-3 subtle" />
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Analysis Status: <span className="capitalize">{activeAnalysis.analysisStatus}</span>
              </p>
              <p className="text-sm subtle mt-1">Results will appear here once the analysis is complete.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Keyframe for spinner ─────────────────────────────────────────── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

export default ResumeAnalyzerPage;
