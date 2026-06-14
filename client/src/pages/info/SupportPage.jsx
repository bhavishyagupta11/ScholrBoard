import { Link } from 'react-router-dom';
import { ArrowLeft, LifeBuoy, Mail, MessageSquare, BookOpen } from 'lucide-react';

export function SupportPage() {
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

      <main className="max-w-4xl mx-auto w-full py-12 flex-1 space-y-10">
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
            <LifeBuoy size={36} className="text-blue-500" />
            <span>Campus Support Helpdesk</span>
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            Having trouble with resume imports, activity reviews, or placements? Get help immediately.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6 space-y-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Mail size={24} />
            </div>
            <h3 className="font-bold text-xl">Email Helpdesk</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Open an institutional support ticket by sending a detailed summary of the issue, screenshots, and logs to our helpdesk.
            </p>
            <a href="mailto:pathbullish@gmail.com" className="btn btn-outline text-xs px-4 py-2 inline-block w-fit">
              Email pathbullish@gmail.com
            </a>
          </div>

          <div className="card p-6 space-y-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <MessageSquare size={24} />
            </div>
            <h3 className="font-bold text-xl">Submit Feedback Form</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              For general inquiries, bugs, feature requests, or credentials recovery, use our validated contact form to reach a support agent.
            </p>
            <Link to="/contact" className="btn btn-primary text-xs px-4 py-2 inline-block w-fit">
              Go to Contact Form
            </Link>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-blue-500" />
            <h3 className="font-bold text-lg">System Status Updates</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <span>ScholrBoard Web Application</span>
              <span className="badge badge-green text-xs">Operational</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <span>Google Gemini AI Engine</span>
              <span className="badge badge-green text-xs">Operational</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span>Cloudinary Assets Delivery</span>
              <span className="badge badge-green text-xs">Operational</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center pt-8 border-t text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
        <span>&copy; {new Date().getFullYear()} ScholrBoard. All rights reserved.</span>
      </footer>
    </div>
  );
}
