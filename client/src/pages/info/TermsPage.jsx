import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, AlertOctagon, Scale } from 'lucide-react';

export function TermsPage() {
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
          <h1 className="text-4xl font-extrabold tracking-tight">Terms & Conditions</h1>
          <p className="subtle text-sm">Last updated: June 13, 2026</p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>
            Welcome to ScholrBoard. By using our platform, dashboards, and APIs, you agree to comply with and be bound by the following terms of service.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Scale size={16} className="text-blue-500" /> 1. Acceptable Use Policy</h3>
          <p>
            Users are required to upload authentic, verified certificates and achievements. Uploading false evidence, forging faculty reviews, or attempting to spoof coding statistics represents a violation of honor codes and will result in account suspension.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><BookOpen size={16} className="text-blue-500" /> 2. Account Security</h3>
          <p>
            Students, faculty members, and administrators are responsible for maintaining the confidentiality of their credentials and session tokens. You must immediately notify campus support in the event of unauthorized access to your account.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><AlertOctagon size={16} className="text-blue-500" /> 3. Service Limitations</h3>
          <p>
            ScholrBoard provides AI resume parsing services via Gemini APIs as-is. We do not guarantee employment, offer placement guarantees, or accept liability for temporary backend latency, database reboots, or network interruptions.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Scale size={16} className="text-blue-500" /> 4. Contact Us</h3>
          <p>
            If you have any questions or concerns regarding these terms, please contact our team at <a href="mailto:pathbullish@gmail.com" className="text-blue-500 hover:underline">pathbullish@gmail.com</a> or call us at <a href="tel:+917339743084" className="text-blue-500 hover:underline">+91-7339743084</a>.
          </p>
        </section>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center pt-8 border-t text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
        <span>&copy; {new Date().getFullYear()} ScholrBoard. All rights reserved.</span>
      </footer>
    </div>
  );
}
