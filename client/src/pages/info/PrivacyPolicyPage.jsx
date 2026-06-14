import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, FileKey } from 'lucide-react';

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen p-6 md:p-12 flex flex-col justify-between" style={{ background: 'var(--bg-dark)', color: 'var(--text-primary)' }}>
      <header className="max-w-4xl mx-auto w-full flex justify-between items-center pb-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <Link to="/" className="flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity" style={{ color: 'var(--primary-blue)' }}>
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <img src="/assets/logo.png" alt="ScholrBoard Logo" className="w-8 h-8 object-contain" />
          <span className="text-xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em' }}>
            <span style={{ color: 'var(--accent)' }}>Scholr</span>
            <span style={{ color: 'var(--text-primary)' }}>Board</span>
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full py-12 flex-1 space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="subtle text-sm">Last updated: June 13, 2026</p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>
            At ScholrBoard, we take the privacy of our academic institutions, faculty members, and student users very seriously. This policy describes how we collect, store, process, and protect your information.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Lock size={16} className="text-blue-500" /> 1. Data Collection</h3>
          <p>
            We collect academic records, attendance logs, certification approvals, coding profile handles, and resume files uploaded to our servers. All resumes uploaded for analysis are processed via secure API endpoints utilizing Cloudinary storage and Google Gemini AI services.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Shield size={16} className="text-blue-500" /> 2. Data Protection & Security</h3>
          <p>
            All network communication with our backend utilizes Transport Layer Security (TLS/HTTPS). User passwords are encrypted using strong bcrypt hashing. Role-Based Access Control (RBAC) ensures student portfolios can only be viewed by authenticated advisors and administrative review boards.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><FileKey size={16} className="text-blue-500" /> 3. Third-Party Services</h3>
          <p>
            We integrate with Cloudinary for file uploads, MongoDB Atlas for data persistence, and Google Gemini AI Studio for resume analysis. No student personal information or parsed documents are sold to marketing networks or external entities.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Shield size={16} className="text-blue-500" /> 4. Contact Us</h3>
          <p>
            If you have any questions or concerns regarding our privacy policy, please contact our team at <a href="mailto:pathbullish@gmail.com" className="text-blue-500 hover:underline">pathbullish@gmail.com</a> or call us at <a href="tel:+917339743084" className="text-blue-500 hover:underline">+91-7339743084</a>.
          </p>
        </section>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center pt-8 border-t text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
        <span>&copy; {new Date().getFullYear()} ScholrBoard. All rights reserved.</span>
      </footer>
    </div>
  );
}
