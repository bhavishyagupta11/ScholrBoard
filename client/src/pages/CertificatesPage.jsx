/**
 * CertificatesPage.jsx — Upload and manage certificates with AI OCR extraction
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Award, Upload, X, CheckCircle, AlertCircle, Plus, ExternalLink,
  Star, Calendar, Hash, Trash2, Loader
} from 'lucide-react';
import uploadApi from '../api/upload.api.js';
import aiApi from '../api/ai.api.js';
import { useProfile } from '../contexts/ProfileContext.jsx';

const CONFIDENCE_COLOR = (n) => {
  if (n >= 80) return '#22c55e';
  if (n >= 50) return '#f97316';
  return '#ef4444';
};

function CertBadge({ label, color = 'var(--primary-blue)' }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-1 mb-1"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

function CertCard({ cert, onDelete }) {
  return (
    <div className="card p-5 group relative gpu-accelerated hover:scale-[1.01] transition-transform">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.15)' }}>
          <Award size={24} className="text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {cert.title}
              </h3>
              {cert.issuedBy && (
                <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  {cert.issuedBy}
                </div>
              )}
            </div>
            <button
              onClick={() => onDelete(cert._id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20 flex-shrink-0"
              title="Remove certificate"
            >
              <Trash2 size={14} className="text-red-400" />
            </button>
          </div>

          <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {cert.issuedDate && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(cert.issuedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
              </span>
            )}
            {cert.credentialId && (
              <span className="flex items-center gap-1 truncate max-w-[200px]">
                <Hash size={12} /> {cert.credentialId}
              </span>
            )}
            {cert.extractionConfidence != null && (
              <span className="flex items-center gap-1" style={{ color: CONFIDENCE_COLOR(cert.extractionConfidence) }}>
                <Star size={12} /> {cert.extractionConfidence}% confidence
              </span>
            )}
          </div>

          {((cert.skills?.length > 0) || (cert.technologies?.length > 0)) && (
            <div className="flex flex-wrap mt-3">
              {[...(cert.skills || []), ...(cert.technologies || [])].slice(0, 8).map(s => (
                <CertBadge key={s} label={s} />
              ))}
            </div>
          )}

          {cert.credentialUrl && (
            <a href={cert.credentialUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs mt-2 hover:underline"
              style={{ color: 'var(--primary-blue)' }}>
              <ExternalLink size={12} /> View Certificate
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function CertificatesPage() {
  const { profile, refreshProfile } = useProfile();
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [lastExtracted, setLastExtracted] = useState(null);

  const certs = profile?.certifications || [];

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setError(null); }
  }, []);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragActive(true); }, []);
  const handleDragLeave = useCallback(() => setDragActive(false), []);

  const handleUploadAndExtract = async () => {
    if (!file) return;
    setError(null);
    setLastExtracted(null);

    try {
      setUploading(true);
      const uploadRes = await uploadApi.uploadCertificate(file);
      setUploading(false);

      setAnalyzing(true);
      const extractRes = await aiApi.extractCertificate(uploadRes.fileUrl, uploadRes.mimetype || file.type);
      setAnalyzing(false);

      setLastExtracted(extractRes.certificate);
      setFile(null);
      await refreshProfile();
    } catch (err) {
      setUploading(false);
      setAnalyzing(false);
      setError(err.message || 'Upload or extraction failed. Please try again.');
    }
  };

  const handleDelete = async (certId) => {
    // Delete from profile certifications array via profileApi
    try {
      const { api } = await import('../api/index.js');
      await api.delete(`/profile/certifications/${certId}`);
      await refreshProfile();
    } catch (err) {
      setError('Could not delete certificate: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="headline">Certificates</h1>
        <p className="mt-1 subtle">Upload certificates — AI automatically extracts issuer, skills, and dates.</p>
      </div>

      {/* Upload zone */}
      <div className="card p-6">
        <div
          className="border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer relative"
          style={{ borderColor: dragActive ? 'var(--primary-blue)' : file ? '#22c55e' : 'var(--border-color)', background: dragActive ? 'rgba(59,130,246,0.05)' : 'transparent' }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setError(null); } }}
          />
          <div className="pointer-events-none">
            {file ? (
              <CheckCircle size={48} className="mx-auto mb-3 text-green-400" />
            ) : (
              <Award size={48} className="mx-auto mb-3" style={{ color: 'var(--text-secondary)' }} />
            )}
            <p className="font-medium text-lg" style={{ color: 'var(--text-primary)' }}>
              {file ? file.name : 'Drop certificate image or PDF here'}
            </p>
            <p className="text-sm mt-1 subtle">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB — ready to analyze` : 'JPG, PNG, WebP or PDF • max 10 MB'}
            </p>
          </div>
        </div>

        {file && (
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleUploadAndExtract}
              disabled={uploading || analyzing}
              className="btn btn-primary flex items-center gap-2 px-6 py-2.5"
            >
              {uploading && <Loader size={16} className="animate-spin" />}
              {analyzing && <Loader size={16} className="animate-spin" />}
              {uploading ? 'Uploading...' : analyzing ? 'AI Extracting...' : 'Upload & Extract with AI'}
            </button>
            <button
              onClick={() => { setFile(null); setError(null); }}
              className="btn btn-outline px-4 py-2.5 flex items-center gap-1"
            >
              <X size={14} /> Clear
            </button>
          </div>
        )}

        {(uploading || analyzing) && (
          <div className="mt-4 p-3 rounded-lg flex items-center gap-3 text-sm"
            style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary-blue)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <Loader size={16} className="animate-spin flex-shrink-0" />
            {uploading ? 'Uploading certificate to cloud storage...' : 'AI is reading and extracting certificate data...'}
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}
      </div>

      {/* Just extracted preview */}
      {lastExtracted && (
        <div className="p-4 rounded-xl border" style={{ background: 'rgba(34,197,94,0.07)', borderColor: 'rgba(34,197,94,0.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-green-400" />
            <span className="font-semibold text-green-400">Certificate extracted successfully!</span>
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{lastExtracted.title}</strong>
            {lastExtracted.issuedBy && <> · {lastExtracted.issuedBy}</>}
            {lastExtracted.skills?.length > 0 && <> · Skills: {lastExtracted.skills.join(', ')}</>}
          </div>
        </div>
      )}

      {/* Certificates list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            My Certificates ({certs.length})
          </h2>
        </div>

        {certs.length === 0 ? (
          <div className="card p-10 text-center">
            <Award size={48} className="mx-auto mb-4" style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No certificates yet</p>
            <p className="text-sm mt-1 subtle">Upload your first certificate above to get started.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {certs.map(cert => (
              <CertCard key={cert._id} cert={cert} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
