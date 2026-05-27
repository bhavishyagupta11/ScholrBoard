/**
 * UploadPage.jsx — Submit new student activities
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, AlertCircle, FileText, Check } from 'lucide-react';
import activitiesApi from '../api/activities.api.js';
import uploadApi from '../api/upload.api.js';
import aiApi from '../api/ai.api.js';

const CATEGORIES = {
  'Technical': ['Hackathon', 'Coding Competition', 'Open Source', 'Project Exhibition'],
  'Certifications': ['Online Course', 'Professional Certificate', 'Workshop Certificate'],
  'Workshops': ['Workshop', 'Seminar', 'Bootcamp', 'Guest Lecture'],
  'Research': ['Research Paper', 'Conference', 'Publication', 'Patent'],
  'Internship': ['Industry Internship', 'Research Internship', 'Virtual Internship'],
  'Competitions': ['Hackathon', 'Coding Competition', 'Case Study', 'Quiz'],
  'Leadership': ['Club Officer', 'Event Organizer', 'Student Council'],
  'Sports': ['Inter-College', 'Intra-College', 'State Level', 'National Level'],
  'Cultural': ['Music/Dance', 'Art/Design', 'Debate/Literary', 'Theatre'],
  'Volunteering': ['NSS', 'Community Service', 'Social Work'],
  'Other': ['Volunteering', 'Social Work', 'Other']
};

export function UploadPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    category: 'Technical',
    subCategory: 'Hackathon',
    activityDate: '',
    description: '',
    duration: '',
    externalLink: ''
  });
  
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedCertificate, setUploadedCertificate] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Reset subCategory if category changes
      ...(name === 'category' ? { subCategory: CATEGORIES[value][0] } : {})
    }));
  };

  const handleFile = (f) => {
    setFile(f);
    setUploadedCertificate(null);
    if (f && f.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleCertificateExtract = async () => {
    if (!file) return;

    setExtracting(true);
    setError(null);

    try {
      const uploadRes = await uploadApi.uploadCertificate(file);
      const extractRes = await aiApi.extractCertificate(uploadRes.fileUrl || uploadRes.url, uploadRes.mimetype || file.type);
      const cert = extractRes.certificate;
      const skills = [...(cert.skills || []), ...(cert.technologies || [])].filter(Boolean);

      setUploadedCertificate({
        proofUrl: uploadRes.fileUrl || uploadRes.url,
        title: cert.title,
      });
      setFormData((prev) => ({
        ...prev,
        title: cert.title || prev.title,
        category: 'Certifications',
        subCategory: 'Professional Certificate',
        activityDate: cert.issuedDate ? cert.issuedDate.slice(0, 10) : prev.activityDate,
        description: [
          cert.issuedBy ? `Issued by ${cert.issuedBy}.` : '',
          skills.length ? `Skills: ${skills.join(', ')}.` : '',
        ].filter(Boolean).join(' '),
        externalLink: cert.credentialUrl || prev.externalLink,
      }));
    } catch (err) {
      setError(err.message || 'Certificate extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let proofUrl = null;

      // 1. Upload proof file if provided
      if (uploadedCertificate?.proofUrl) {
        proofUrl = uploadedCertificate.proofUrl;
      } else if (file) {
        const uploadRes = await uploadApi.uploadProof(file);
        if (!uploadRes.proofUrl && !uploadRes.url) throw new Error('Failed to upload proof file');
        proofUrl = uploadRes.proofUrl || uploadRes.url;
      }

      // 2. Submit activity
      await activitiesApi.create({
        ...formData,
        proofUrl
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/student/activities');
      }, 2000);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to submit activity');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="card p-10 text-center space-y-4 flex flex-col items-center">
        <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4">
          <Check size={32} />
        </div>
        <h2 className="text-2xl font-bold">Activity Submitted!</h2>
        <p className="subtle">Your activity has been sent for faculty review.</p>
        <p className="text-sm text-blue-400">Redirecting to your activities...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Submit Activity</h1>
        <p className="mt-2" style={{color:'var(--text-secondary)'}}>Add a new achievement, certification, or extracurricular activity to your profile.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 grid md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="space-y-4 md:col-span-2">
          <h3 className="font-semibold border-b pb-2" style={{borderColor:'var(--border-color)'}}>Basic Details</h3>
        </div>

        <div>
          <label className="block text-sm mb-1 subtle">Activity Title *</label>
          <input 
            name="title" value={formData.title} onChange={handleInputChange} 
            required placeholder="e.g., SIH Hackathon 2024 Winner"
            className="w-full input-dark py-2 px-3" 
          />
        </div>

        <div>
          <label className="block text-sm mb-1 subtle">Date of Activity *</label>
          <input 
            type="date" name="activityDate" value={formData.activityDate} onChange={handleInputChange} 
            required className="w-full input-dark py-2 px-3" 
          />
        </div>

        <div>
          <label className="block text-sm mb-1 subtle">Category *</label>
          <select 
            name="category" value={formData.category} onChange={handleInputChange} 
            className="w-full input-dark py-2 px-3"
          >
            {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1 subtle">Sub-Category</label>
          <select 
            name="subCategory" value={formData.subCategory} onChange={handleInputChange} 
            className="w-full input-dark py-2 px-3"
          >
            {CATEGORIES[formData.category].map(sc => <option key={sc} value={sc}>{sc}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm mb-1 subtle">Description (Optional)</label>
          <textarea 
            name="description" value={formData.description} onChange={handleInputChange} 
            placeholder="Briefly describe your role, learning, or achievement..."
            className="w-full input-dark py-2 px-3 min-h-[100px] resize-y" 
          />
        </div>

        <div>
          <label className="block text-sm mb-1 subtle">Duration (Optional)</label>
          <input 
            name="duration" value={formData.duration} onChange={handleInputChange} 
            placeholder="e.g., 2 days, 3 months"
            className="w-full input-dark py-2 px-3" 
          />
        </div>

        <div>
          <label className="block text-sm mb-1 subtle">External Link (Optional)</label>
          <input 
            type="url" name="externalLink" value={formData.externalLink} onChange={handleInputChange} 
            placeholder="https://..."
            className="w-full input-dark py-2 px-3" 
          />
        </div>

        {/* Proof Upload */}
        <div className="space-y-4 md:col-span-2 mt-4">
          <h3 className="font-semibold border-b pb-2" style={{borderColor:'var(--border-color)'}}>Proof of Activity</h3>
        </div>

        <div className="md:col-span-2 flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <label className="block text-sm mb-2 subtle">Upload Certificate/Image (Optional)</label>
            <div className="border-2 border-dashed rounded-xl p-8 text-center hover:bg-white/5 transition-colors cursor-pointer relative" style={{borderColor:'var(--border-color)'}}>
              <input 
                type="file" 
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={e => handleFile(e.target.files?.[0] ?? null)} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
              <Upload size={24} className="mx-auto mb-2 text-slate-400" />
              <div className="text-sm font-medium" style={{color:'var(--text-primary)'}}>Click or drag file to upload</div>
              <div className="text-xs mt-1 subtle">JPEG, PNG, WEBP, or PDF (max 5MB)</div>
            </div>
            {file && (
              <button
                type="button"
                className="btn btn-secondary w-full mt-3"
                disabled={extracting || loading}
                onClick={handleCertificateExtract}
              >
                {extracting ? 'Extracting certificate...' : 'Extract Certificate With AI'}
              </button>
            )}
          </div>

          {(file || previewUrl) && (
            <div className="w-full md:w-64 border rounded-xl p-4 flex flex-col items-center justify-center text-center" style={{borderColor:'var(--border-color)', background:'var(--bg-medium)'}}>
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="max-h-32 object-contain rounded mb-3" />
              ) : (
                <FileText size={48} className="text-blue-400 mb-3" />
              )}
              <div className="text-sm font-medium truncate w-full" title={file?.name}>{file?.name}</div>
              <div className="text-xs subtle mt-1">{(file?.size / 1024 / 1024).toFixed(2)} MB</div>
              {uploadedCertificate && (
                <div className="text-xs text-green-400 mt-2">Extracted: {uploadedCertificate.title}</div>
              )}
            </div>
          )}
        </div>

        <div className="md:col-span-2 pt-4 border-t" style={{borderColor:'var(--border-color)'}}>
          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary w-full md:w-auto px-8"
          >
            {loading ? 'Submitting...' : 'Submit Activity'}
          </button>
        </div>
      </form>
    </div>
  );
}
