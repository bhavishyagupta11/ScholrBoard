import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie, ShieldCheck, Database } from 'lucide-react';

export function CookiePolicyPage() {
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
          <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
            <Cookie size={36} className="text-amber-500" />
            <span>Cookie Policy</span>
          </h1>
          <p className="subtle text-sm">Last updated: June 13, 2026</p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>
            This Cookie Policy explains how ScholrBoard uses cookies and similar storage technologies to recognize you when you visit our portal.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Database size={16} className="text-blue-500" /> 1. Essential Authentication Cookies</h3>
          <p>
            We use localized web storage and secure session cookies to identify your logged-in state, active role, and JSON Web Tokens. These are strictly necessary for the application shell to function and maintain active sessions upon page reloads.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShieldCheck size={16} className="text-blue-500" /> 2. Personalization & Themes</h3>
          <p>
            We save theme preferences (light, dark, orange, yellow, or amber theme profiles) in local storage so that your chosen presentation style is retained across visits and page refreshes.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Cookie size={16} className="text-blue-500" /> 3. Third-party Analytical Tools</h3>
          <p>
            ScholrBoard does not use third-party behavioral tracking or ad network cookies. All analytics, statistics reporting, and profile synchronization are performed internally by our local Node backend.
          </p>

          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Cookie size={16} className="text-blue-500" /> 4. Contact Us</h3>
          <p>
            If you have any questions or concerns regarding our cookie policy, please contact our team at <a href="mailto:pathbullish@gmail.com" className="text-blue-500 hover:underline">pathbullish@gmail.com</a> or call us at <a href="tel:+917339743084" className="text-blue-500 hover:underline">+91-7339743084</a>.
          </p>
        </section>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center pt-8 border-t text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
        <span>&copy; {new Date().getFullYear()} ScholrBoard. All rights reserved.</span>
      </footer>
    </div>
  );
}
