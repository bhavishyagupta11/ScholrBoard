/**
 * ResumeImportPage.jsx — Upload Resume for AI Analysis
 */
import { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import uploadApi from '../api/upload.api.js';
import aiApi from '../api/ai.api.js';

export function ResumeImportPage() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [analysisId, setAnalysisId] = useState(null);

  const [analyses, setAnalyses] = useState([]);

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      const res = await uploadApi.getResumeAnalyses();
      setAnalyses(res.analyses || []);
    } catch (err) {
      console.error('Failed to fetch analyses:', err);
    }
  };

  const handleFile = (f) => {
    setFile(f);
    setError(null);
    setSuccess(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await uploadApi.uploadResume(file);
      setSuccess(true);
      setAnalysisId(res.analysisId);
      setFile(null); // Clear file
      
      // Trigger AI analysis asynchronously
      const aid = typeof res.analysisId === 'object' && res.analysisId?._id != null
        ? String(res.analysisId._id)
        : String(res.analysisId || '');
      if (aid) {
        aiApi.analyzeResume(aid).then(() => {
          fetchAnalyses();
        }).catch(console.error);
      }
      
      fetchAnalyses();
    } catch (err) {
      setError(err.message || 'Failed to upload resume');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Resume Import</h1>
        <p className="mt-2" style={{color:'var(--text-secondary)'}}>Upload your resume to automatically extract your skills, education, and projects using AI.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {success && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-green-500/30" style={{ background: 'rgba(34,197,94,0.1)' }}>
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-400" />
            <div>
              <div className="font-semibold text-green-400">Resume Uploaded Successfully</div>
              <div className="text-sm" style={{color:'var(--text-secondary)'}}>Your resume is now being analyzed by AI. This may take a few minutes.</div>
            </div>
          </div>
        </div>
      )}

      <div className="card p-8 text-center">
        <div className="max-w-md mx-auto">
          <div className="border-2 border-dashed rounded-xl p-8 mb-6 hover:bg-white/5 transition-colors cursor-pointer relative" style={{borderColor: file ? 'var(--primary-blue)' : 'var(--border-color)'}}>
            <input 
              type="file" 
              accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => handleFile(e.target.files?.[0] ?? null)} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
            />
            {file ? (
              <FileText size={48} className="mx-auto mb-3 text-blue-400" />
            ) : (
              <Upload size={48} className="mx-auto mb-3 text-slate-400" />
            )}
            
            <div className="text-lg font-medium mb-1" style={{color:'var(--text-primary)'}}>
              {file ? file.name : 'Click or drag PDF to upload'}
            </div>
            <div className="text-sm subtle">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF or DOCX files (max 5MB)'}
            </div>
          </div>

          <button 
            onClick={handleUpload}
            disabled={!file || loading}
            className="btn btn-primary w-full py-3"
          >
            {loading ? 'Uploading & Analyzing...' : 'Auto-fill Profile & Activities'}
          </button>
        </div>
      </div>

      {analyses.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4 border-b pb-2" style={{color:'var(--text-primary)', borderColor:'var(--border-color)'}}>Recent Analyses</h3>
          <div className="space-y-4">
            {analyses.map(analysis => (
              <div key={analysis._id} className="flex justify-between items-center p-4 rounded-lg" style={{ background: 'var(--bg-medium)' }}>
                <div className="flex items-center gap-3">
                  <FileText className="text-blue-400" size={24} />
                  <div>
                    <div className="font-medium">{analysis.fileName}</div>
                    <div className="text-sm subtle">{new Date(analysis.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <div>
                  <span className={`badge ${
                    analysis.analysisStatus === 'completed' ? 'badge-success' : 
                    analysis.analysisStatus === 'failed' ? 'badge-error' : 'badge-warning'
                  }`}>
                    {analysis.analysisStatus === 'completed' ? 'Analyzed' : 
                     analysis.analysisStatus === 'failed' ? 'Failed' : 'Processing...'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
