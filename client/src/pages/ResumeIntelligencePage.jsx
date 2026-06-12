import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import uploadApi from '../api/upload.api.js';
import { 
  FileText, 
  Award, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp, 
  Zap, 
  Target, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  Star, 
  Briefcase, 
  X, 
  UploadCloud, 
  ArrowRight,
  ArrowLeftRight,
  User,
  Mail,
  GraduationCap
} from 'lucide-react';

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

/** SVG radial progress ring reused and extended from ResumeImportPage */
function ScoreRing({ score, size = 120, strokeWidth = 10, label }) {
  const radius = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(score ?? 0, 0), 100);
  const dashOffset = circ - (pct / 100) * circ;
  const color = scoreColor(score != null ? pct : null);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg 
        width={size} 
        height={size} 
        style={{ transform: 'rotate(-90deg)' }}
        role="img"
        aria-label={`${label || 'Score'}: ${score != null ? `${pct} out of 100` : 'Not available'}`}
      >
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth={strokeWidth}
        />
        {/* progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={score != null ? color : 'var(--border-color)'}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={score != null ? dashOffset : circ}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)' }}
        />
        {/* label in centre */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          style={{
            transform: 'rotate(90deg)',
            transformOrigin: '50% 50%',
            fontSize: size * 0.22,
            fontWeight: 800,
            fill: score != null ? color : 'var(--text-secondary)',
          }}
        >
          {score != null ? pct : '—'}
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
        className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
        style={{ background: 'transparent' }}
        type="button"
        aria-expanded={open}
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
    high: { bg: '#ef444420', color: '#ef4444', label: 'High Priority' },
    medium: { bg: '#f59e0b20', color: '#f59e0b', label: 'Medium Priority' },
    low: { bg: '#22c55e20', color: '#22c55e', label: 'Low Priority' },
  };
  const cfg = map[(level || '').toLowerCase()] || map.medium;
  return (
    <span
      className="text-[10px] font-bold rounded-full px-2 py-0.5"
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
      className="card p-8 flex flex-col items-center gap-4 text-center border-dashed"
      style={{ borderColor: 'var(--primary-blue)' }}
      aria-live="polite"
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
          className="absolute inset-0 m-auto animate-pulse"
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

// ─── Compare Modal (A11y focus trapping + Escape close) ──────────────────────
function ResumeCompareModal({ show, onClose, older, newer }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(modalRef.current.querySelectorAll(focusableSelectors));
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
    
    // Focus first focusable element
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelector('button, [href], input, select');
        if (focusable) focusable.focus();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [show, onClose]);

  if (!show || !older || !newer) return null;

  const olderGrade = getAtsGrade(older.atsScore);
  const newerGrade = getAtsGrade(newer.atsScore);

  const scoreDiff = (newer.atsScore || 0) - (older.atsScore || 0);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
    >
      <div 
        ref={modalRef}
        className="relative bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={20} className="text-blue-400" />
            <h2 id="compare-modal-title" className="text-lg font-bold text-white">
              Compare Resume Versions
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer"
            type="button"
            aria-label="Close comparison modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-neutral-300">
          
          {/* Version overview and score delta */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
              <div className="text-xs uppercase font-semibold text-neutral-400">Older Version</div>
              <p className="font-bold text-sm truncate text-white mt-1">{older.fileName || 'Resume A'}</p>
              <span className="text-[10px] text-neutral-500 block">{new Date(older.createdAt).toLocaleDateString()}</span>
              
              <div className="mt-4 flex justify-center gap-6">
                <div>
                  <span className="text-[10px] text-neutral-400 block">ATS Score</span>
                  <span className="text-xl font-extrabold" style={{ color: scoreColor(older.atsScore) }}>
                    {older.atsScore ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block">ATS Grade</span>
                  <span className="text-xl font-extrabold text-neutral-300">{olderGrade}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-850">
              <div className="text-xs uppercase font-semibold text-neutral-400">Newer Version</div>
              <p className="font-bold text-sm truncate text-white mt-1">{newer.fileName || 'Resume B'}</p>
              <span className="text-[10px] text-neutral-500 block">{new Date(newer.createdAt).toLocaleDateString()}</span>

              <div className="mt-4 flex justify-center gap-6">
                <div>
                  <span className="text-[10px] text-neutral-400 block">ATS Score</span>
                  <span className="text-xl font-extrabold" style={{ color: scoreColor(newer.atsScore) }}>
                    {newer.atsScore ?? '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 block">ATS Grade</span>
                  <span className="text-xl font-extrabold text-neutral-300">{newerGrade}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delta callout */}
          <div className="p-3.5 rounded-lg border text-center font-semibold bg-neutral-950/50 border-neutral-800">
            {scoreDiff > 0 ? (
              <span className="text-emerald-400">📈 Score improved by +{scoreDiff} points!</span>
            ) : scoreDiff < 0 ? (
              <span className="text-rose-400">📉 Score decreased by {scoreDiff} points.</span>
            ) : (
              <span className="text-neutral-400">⚖️ Score remained unchanged.</span>
            )}
          </div>

          {/* Metric Comparison Table */}
          <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-900 text-neutral-400 border-b border-neutral-800 font-semibold">
                  <th className="p-3">Analysis Metric</th>
                  <th className="p-3 w-1/3">Older Version</th>
                  <th className="p-3 w-1/3">Newer Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                <tr>
                  <td className="p-3 font-semibold text-white">Overall Score</td>
                  <td className="p-3">{older.overallScore ?? '—'} / 100</td>
                  <td className="p-3 font-bold text-white">{newer.overallScore ?? '—'} / 100</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Detected Skills</td>
                  <td className="p-3">{(older.skillsDetected || []).length} skills</td>
                  <td className="p-3">{(newer.skillsDetected || []).length} skills</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Skill Gaps Identifed</td>
                  <td className="p-3">{(older.skillGaps || []).length} missing</td>
                  <td className="p-3">{(newer.skillGaps || []).length} missing</td>
                </tr>
                <tr>
                  <td className="p-3 font-semibold text-white">Improvements Suggested</td>
                  <td className="p-3">{(older.improvements || []).length} items</td>
                  <td className="p-3">{(newer.improvements || []).length} items</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Side-by-side lists */}
          <div className="grid md:grid-cols-2 gap-6 pt-2">
            
            {/* Strengths compare */}
            <div className="space-y-3">
              <h3 className="font-bold text-white border-b border-neutral-800 pb-1 flex items-center gap-1.5">
                <CheckCircle size={14} className="text-emerald-400" />
                Strengths Comparison
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-bold text-[10px] text-neutral-400 uppercase mb-1">Older</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {(older.strengths || []).map((s, idx) => (
                      <li key={`older-str-${idx}`}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-bold text-[10px] text-neutral-400 uppercase mb-1">Newer</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {(newer.strengths || []).map((s, idx) => (
                      <li key={`newer-str-${idx}`} className="text-white">{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Improvements compare */}
            <div className="space-y-3">
              <h3 className="font-bold text-white border-b border-neutral-800 pb-1 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-amber-400" />
                Suggested Improvements
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-bold text-[10px] text-neutral-400 uppercase mb-1">Older</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {(older.improvements || []).map((item, idx) => (
                      <li key={`older-imp-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="font-bold text-[10px] text-neutral-400 uppercase mb-1">Newer</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {(newer.improvements || []).map((item, idx) => (
                      <li key={`newer-imp-${idx}`} className="text-white">{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="btn px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
            type="button"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────────
export function ResumeIntelligencePage() {
  const [analyses, setAnalyses] = useState([]);
  const [activeAnalysis, setActiveAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // File uploading states
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Polling tracker
  const [pollingId, setPollingId] = useState(null);

  // Resume comparison states
  const [selectedCompareIds, setSelectedCompareIds] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Load the analyses list on mount
  const loadAnalysesList = useCallback(async (selectId = null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await uploadApi.getResumeAnalyses();
      const list = res.analyses || [];
      setAnalyses(list);
      
      if (list.length > 0) {
        // Decide which analysis to load details for
        const targetId = selectId || list[0]._id;
        
        // Check if the target analysis is currently in progress
        const targetAnalysis = list.find(a => a._id === targetId);
        
        if (targetAnalysis && (targetAnalysis.analysisStatus === 'pending' || targetAnalysis.analysisStatus === 'processing')) {
          setPollingId(targetId);
          setActiveAnalysis(targetAnalysis);
        } else {
          // Fetch full single details including extracted text
          const detailRes = await uploadApi.getResumeAnalysis(targetId);
          setActiveAnalysis(detailRes.analysis);
        }
      } else {
        setActiveAnalysis(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve resume analyses list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalysesList();
  }, [loadAnalysesList]);

  // Polling Effect
  useEffect(() => {
    if (!pollingId) return;

    let timerId;
    let pollCount = 0;

    const poll = async () => {
      try {
        const res = await uploadApi.getResumeAnalysis(pollingId);
        const status = res.analysis?.analysisStatus;

        if (status === 'completed' || status === 'failed') {
          setPollingId(null);
          // Reload analyses list and force select the completed analysis
          await loadAnalysesList(pollingId);
        } else {
          pollCount++;
          if (pollCount >= 40) { // Timeout after ~120s
            setPollingId(null);
            setUploadError('AI analysis is taking longer than expected. Please check back later.');
            await loadAnalysesList();
          } else {
            timerId = setTimeout(poll, 3000);
          }
        }
      } catch (err) {
        setPollingId(null);
        setUploadError('Error polling resume analysis status.');
        await loadAnalysesList();
      }
    };

    timerId = setTimeout(poll, 3000);

    return () => {
      clearTimeout(timerId);
    };
  }, [pollingId, loadAnalysesList]);

  // Load specific details when timeline item is selected
  const loadAnalysisDetails = async (id) => {
    if (pollingId) return; // Prevent navigation during active polling
    setLoading(true);
    setUploadError(null);
    try {
      const res = await uploadApi.getResumeAnalysis(id);
      setActiveAnalysis(res.analysis);
    } catch (err) {
      setUploadError('Failed to fetch detailed analysis: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const res = await uploadApi.uploadResume(file);
      if (res.success && res.analysisId) {
        // Set state to polling and fetch list
        setPollingId(res.analysisId);
        await loadAnalysesList(res.analysisId);
      } else {
        await loadAnalysesList();
      }
    } catch (err) {
      setUploadError(err.message || 'Resume upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // Selection toggle for comparisons
  const handleToggleCompare = (id) => {
    setSelectedCompareIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 2) return prev; // Limit to 2
      return [...prev, id];
    });
  };

  // Find selected compare analyses
  const compareOlder = useMemo(() => {
    if (selectedCompareIds.length < 2) return null;
    const items = analyses.filter(a => selectedCompareIds.includes(a._id));
    return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
  }, [selectedCompareIds, analyses]);

  const compareNewer = useMemo(() => {
    if (selectedCompareIds.length < 2) return null;
    const items = analyses.filter(a => selectedCompareIds.includes(a._id));
    return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[1];
  }, [selectedCompareIds, analyses]);

  if (loading && !pollingId) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading resume intelligence scorecard...">
        <div className="skeleton h-12 w-1/4 rounded-lg" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="skeleton h-96 md:col-span-2 rounded-xl" />
          <div className="skeleton h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in-up">
      {/* ─── Page Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="headline">Resume Intelligence</h1>
          <p className="text-sm subtle mt-1">
            AI-driven ATS optimization, feedback, and skills analysis.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="btn btn-primary px-4 py-2.5 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer shadow-sm">
            <UploadCloud size={16} />
            <span>Upload New Resume</span>
            <input 
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading || pollingId}
            />
          </label>
        </div>
      </div>

      {/* Upload/Polling Errors */}
      {uploadError && (
        <div className="p-3 text-xs rounded-lg flex items-center gap-2 border border-red-500/20 bg-red-500/5 text-red-500">
          <AlertCircle size={14} className="shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* General Page Error State */}
      {error && (
        <div className="card p-8 flex flex-col items-center gap-4 text-center max-w-lg mx-auto border border-red-500/20 bg-red-500/5">
          <AlertCircle size={40} className="text-red-500" />
          <div>
            <h2 className="font-bold text-sm text-white">Error loading analyses</h2>
            <p className="text-xs subtle mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State Guard: No analyses exist */}
      {analyses.length === 0 && !uploading && !pollingId ? (
        <div className="card p-12 text-center border-dashed flex flex-col items-center justify-center gap-4 max-w-md mx-auto mt-12" style={{ borderColor: 'var(--border-color)' }}>
          <div className="p-4 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400">
            <FileText size={40} />
          </div>
          <div>
            <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>No Resume Uploaded</h2>
            <p className="text-xs subtle mt-2 leading-relaxed">
              Upload your resume in PDF or DOCX formats to trigger an automated ATS optimization and skills gaps audit.
            </p>
          </div>
          <label className="btn btn-primary px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer mt-2">
            <UploadCloud size={16} />
            <span>Select Resume File</span>
            <input 
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        /* ─── Timeline grid layout ──────────────────────────────────────────────── */
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Main Details Panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Polling/Processing State Banner */}
            {pollingId && <ProcessingBanner />}

            {/* Analysis Failed Banner */}
            {activeAnalysis?.analysisStatus === 'failed' && (
              <div className="card p-6 border-dashed border-red-500/30 bg-red-500/5 flex items-start gap-3 text-red-500">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-bold text-sm text-red-500">AI Analysis Failed</h2>
                  <p className="text-xs subtle mt-1 leading-relaxed text-red-400">
                    {activeAnalysis.analysisError || 'An unexpected parsing error occurred. Please try uploading another file.'}
                  </p>
                </div>
              </div>
            )}

            {/* Completed Analysis scorecard */}
            {activeAnalysis && activeAnalysis.analysisStatus === 'completed' && (
              <div className="space-y-6">
                
                {/* Score meters card */}
                <div className="card p-6 space-y-6">
                  <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="flex items-center gap-2">
                      <Award size={18} style={{ color: 'var(--primary-blue)' }} />
                      <h2 className="text-sm font-bold truncate max-w-[250px] md:max-w-md" style={{ color: 'var(--text-primary)' }}>
                        {activeAnalysis.fileName || 'Resume Analysis'}
                      </h2>
                    </div>
                    {activeAnalysis.atsScore != null && (
                      <span className="text-xs font-extrabold px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-300">
                        ATS Grade: {getAtsGrade(activeAnalysis.atsScore)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-8 justify-center md:justify-start">
                    <ScoreRing score={activeAnalysis.atsScore} size={120} label="ATS Score" />
                    <ScoreRing score={activeAnalysis.overallScore} size={120} label="Overall Score" />
                    
                    {/* Legend */}
                    <div className="flex flex-col justify-center gap-1.5 text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />{'Score < 50 – Needs Work'}</div>
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />{'Score 50-74 – Fair'}</div>
                      <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />{'Score ≥ 75 – Great'}</div>
                    </div>
                  </div>

                  {activeAnalysis.summary && (
                    <div className="p-4 rounded-xl text-xs leading-relaxed" style={{ background: 'var(--bg-medium)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <p className="font-semibold text-neutral-300 mb-1">Executive Summary</p>
                      {activeAnalysis.summary}
                    </div>
                  )}
                </div>

                {/* Strengths & Improvements */}
                <div className="grid md:grid-cols-2 gap-4">
                  
                  {/* Strengths */}
                  <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle size={16} className="text-green-500" />
                      <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>Strengths</h3>
                    </div>
                    {(!activeAnalysis.strengths || activeAnalysis.strengths.length === 0) ? (
                      <p className="text-xs subtle">No strengths identified.</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {activeAnalysis.strengths.map((str, idx) => (
                          <li key={`str-${idx}`} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <CheckCircle size={13} className="text-green-500 shrink-0 mt-0.5" />
                            <span>{str}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Improvements (Mongoose improvements field) */}
                  <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp size={16} className="text-amber-500" />
                      <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>Areas to Improve</h3>
                    </div>
                    {(!activeAnalysis.improvements || activeAnalysis.improvements.length === 0) ? (
                      <p className="text-xs subtle">No improvement suggestions found.</p>
                    ) : (
                      <ul className="space-y-2.5">
                        {activeAnalysis.improvements.map((imp, idx) => (
                          <li key={`imp-${idx}`} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <AlertCircle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                            <span>{imp}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Skills Detected */}
                {activeAnalysis.skillsDetected && activeAnalysis.skillsDetected.length > 0 && (
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap size={16} style={{ color: 'var(--primary-blue)' }} />
                      <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>Skills Detected</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeAnalysis.skillsDetected.map((skill, idx) => (
                        <Pill key={`detected-${skill}-${idx}`} label={skill} color="var(--primary-blue)" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Skill Gaps (Mongoose skillGaps field containing Objects) */}
                {activeAnalysis.skillGaps && activeAnalysis.skillGaps.length > 0 && (
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Target size={16} className="text-red-500" />
                      <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>Priority Skill Gaps</h3>
                    </div>
                    <div className="space-y-3">
                      {activeAnalysis.skillGaps.map((gap, idx) => {
                        const skillName = gap.skill || 'Unknown Skill';
                        const importance = gap.importance || 'medium';
                        const suggestion = gap.suggestion;
                        
                        // Stable key using skill and importance to satisfy React safety rules
                        const stableKey = `${skillName}-${importance}-${idx}`;

                        return (
                          <div 
                            key={stableKey}
                            className="p-3 rounded-lg border flex flex-col gap-1.5"
                            style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs" style={{ color: 'var(--text-primary)' }}>{skillName}</span>
                              <ImportanceBadge level={importance} />
                            </div>
                            {suggestion && (
                              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {suggestion}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section Feedback Accordions (using Mongoose sectionFeedback field) */}
                {activeAnalysis.sectionFeedback && activeAnalysis.sectionFeedback.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-xs uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--text-secondary)' }}>
                      Section breakdown feedback
                    </h3>
                    {activeAnalysis.sectionFeedback.map((sec, idx) => {
                      const sectionTitle = sec.section || 'General Section';
                      const sectionScore = sec.score;
                      const feedbackText = sec.feedback;
                      const issues = sec.issues || [];
                      const tips = sec.tips || [];

                      // Stable key to prevent array index keys
                      const stableKey = `${sectionTitle}-${idx}`;

                      return (
                        <AccordionCard key={stableKey} title={sectionTitle} score={sectionScore}>
                          <div className="pt-3 space-y-3 text-xs">
                            {feedbackText && (
                              <p style={{ color: 'var(--text-secondary)' }}>{feedbackText}</p>
                            )}
                            
                            {issues.length > 0 && (
                              <div>
                                <div className="font-bold text-red-500/90 text-[10px] uppercase mb-1">Identified Issues:</div>
                                <ul className="list-disc pl-4 space-y-1">
                                  {issues.map((issue, iIdx) => (
                                    <li key={`issue-${iIdx}`} style={{ color: 'var(--text-secondary)' }}>{issue}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {tips.length > 0 && (
                              <div>
                                <div className="font-bold text-blue-400/90 text-[10px] uppercase mb-1">Optimization Tips:</div>
                                <ul className="list-disc pl-4 space-y-1">
                                  {tips.map((tip, tIdx) => (
                                    <li key={`tip-${tIdx}`} style={{ color: 'var(--text-secondary)' }}>{tip}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </AccordionCard>
                      );
                    })}
                  </div>
                )}

                {/* Recommended Roles */}
                {activeAnalysis.recommendedRoles && activeAnalysis.recommendedRoles.length > 0 && (
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Briefcase size={16} style={{ color: 'var(--primary-blue)' }} />
                      <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>Recommended Roles</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeAnalysis.recommendedRoles.map((role, idx) => (
                        <Pill key={`role-${role}-${idx}`} label={role} color="var(--primary-blue)" />
                      ))}
                    </div>
                  </div>
                )}

                {/* Keywords to Add */}
                {activeAnalysis.keywordsToAdd && activeAnalysis.keywordsToAdd.length > 0 && (
                  <div className="card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Zap size={16} style={{ color: '#f59e0b' }} />
                      <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>Keywords to Add</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeAnalysis.keywordsToAdd.map((kw, idx) => (
                        <Pill key={`kw-${kw}-${idx}`} label={kw} color="#f59e0b" />
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Right Sidebar Panel: History and Comparison Actions */}
          <div className="space-y-6">
            
            {/* Timeline selector card */}
            <div className="card p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--border-color)' }}>
                <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Analysis History</h2>
                <span className="text-[10px] subtle uppercase font-bold tracking-wider">{analyses.length} Versions</span>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1" role="list">
                {analyses.map((an) => {
                  const isSelected = selectedCompareIds.includes(an._id);
                  const isActive = activeAnalysis?._id === an._id;

                  return (
                    <div
                      key={an._id}
                      onClick={() => loadAnalysisDetails(an._id)}
                      className={`p-3 rounded-lg border transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer ${
                        isActive
                          ? 'border-blue-500/50 bg-blue-500/5'
                          : 'border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-900'
                      }`}
                      role="listitem"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-white">
                          {an.fileName || 'Resume Version'}
                        </p>
                        <p className="text-[10px] subtle mt-0.5">
                          {new Date(an.createdAt).toLocaleDateString()} · Score: {an.atsScore ?? '—'}
                        </p>
                      </div>

                      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          id={`compare-${an._id}`}
                          checked={isSelected}
                          onChange={() => handleToggleCompare(an._id)}
                          disabled={!isSelected && selectedCompareIds.length >= 2}
                          className="w-3.5 h-3.5 rounded border border-neutral-700 bg-neutral-900 checked:bg-blue-500 text-blue-500 cursor-pointer"
                          aria-label={`Compare ${an.fileName || 'version'}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedCompareIds.length === 2 && (
                <button
                  onClick={() => setShowCompareModal(true)}
                  className="btn btn-primary w-full text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  type="button"
                >
                  <ArrowLeftRight size={14} />
                  <span>Compare Selected (2)</span>
                </button>
              )}
            </div>

            {/* Resume Upload Help panel */}
            <div className="card p-4 space-y-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <h2 className="font-bold text-white mb-1.5 flex items-center gap-1.5">
                <Target size={14} className="text-blue-400" />
                ATS Optimization Guide
              </h2>
              <p>
                1. Upload your resume and let the AI extract scores.
              </p>
              <p>
                2. Address missing skill gaps and keywords suggested inside the scorecard.
              </p>
              <p>
                3. Upload a new revised version and use the comparison tool to verify score gains.
              </p>
            </div>

          </div>

        </div>
      )}

      {/* Comparison Modal Overlay */}
      <ResumeCompareModal 
        show={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        older={compareOlder}
        newer={compareNewer}
      />

    </div>
  );
}

export default ResumeIntelligencePage;
