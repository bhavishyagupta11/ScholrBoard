import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Shield, Target } from 'lucide-react';

export function AboutUsPage() {
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
          <h1 className="text-4xl font-extrabold tracking-tight">About ScholrBoard</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            ScholrBoard is a comprehensive, role-based student performance, credentialing, and placement readiness platform designed to streamline campus operational workflows. By connecting students, faculty, and placement coordinators in a single source of truth, we prepare institutes for NAAC, NIRF, and AICTE accreditation audits with zero friction.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="card p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Users size={20} />
            </div>
            <h3 className="font-bold text-lg">Our Mission</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              To empower academic institutions by bridging the gap between student achievement, faculty verification, and career readiness.
            </p>
          </div>

          <div className="card p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Shield size={20} />
            </div>
            <h3 className="font-bold text-lg">Verified Trust</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Ensuring all milestones, certifications, and project accomplishments undergo strict, evidence-backed faculty evaluation.
            </p>
          </div>

          <div className="card p-6 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Target size={20} />
            </div>
            <h3 className="font-bold text-lg">Career Acceleration</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Providing students with ATS-grade resume scorecards, real-time placement tracking, and data-driven career mentoring.
            </p>
          </div>
        </div>

        <div className="space-y-4 border-t pt-8" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-2xl font-bold">Key Milestones</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Launched in 2026, ScholrBoard has quickly scaled to manage thousands of students, hundreds of verified activities, and dozens of placement drives. We maintain strict compliance with WCAG AA accessibility standards and support both light/dark dynamic themes natively.
          </p>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center pt-8 border-t text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
        <span>&copy; {new Date().getFullYear()} ScholrBoard. All rights reserved.</span>
      </footer>
    </div>
  );
}
