import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

export function FaqPage() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      q: 'How does the Resume Analyzer calculate my ATS score?',
      a: 'The Resume Analyzer uses Google Gemini generative AI to scan your resume text against software industry standards. It reviews document parsing layout, keyword density, section headers, education alignment, and project descriptions to compute a scorecard out of 100.'
    },
    {
      q: 'What should I do if my activity verification is rejected?',
      a: 'If an advisor or faculty reviewer requests revision on your activity submission, check the review feedback comments. Go to your Activities page, click Edit, upload a clearer copy of the proof certificate, update the details, and hit resubmit.'
    },
    {
      q: 'How are my Developer Score points calculated?',
      a: 'The Developer Score is updated automatically by querying LeetCode, GitHub, and Codeforces handles linked to your portfolio. It evaluates overall problem-solving counts, code commit activity, and contest ratings using our verified scoring formulas.'
    },
    {
      q: 'Can I apply for placement drives if my CGPA is below the eligibility threshold?',
      a: 'No. The placement portal runs automated checks against your profile records (CGPA, active backlogs, semester, and department). You will only see the "Apply Now" button for drives where you meet 100% of the eligibility requirements.'
    },
    {
      q: 'Who should I contact if I am logged out due to network issues?',
      a: 'ScholrBoard Auth Resilience features will place the portal into "Resilient Mode" if you lose connection, maintaining cached views. If you are persistently logged out, check that cookies are enabled or contact pathbullish@gmail.com.'
    }
  ];

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
            <HelpCircle size={36} className="text-blue-500" />
            <span>Frequently Asked Questions</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Get quick answers to the most common questions about ScholrBoard features and operations.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--border-color)', background: 'var(--bg-medium)' }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left font-bold"
                  style={{ background: 'transparent', color: isOpen ? 'var(--primary-blue)' : 'var(--text-primary)' }}
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <footer className="max-w-4xl mx-auto w-full text-center pt-8 border-t text-xs" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
        <span>&copy; {new Date().getFullYear()} ScholrBoard. All rights reserved.</span>
      </footer>
    </div>
  );
}
