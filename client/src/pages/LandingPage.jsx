import { Link } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  LayoutGrid, BarChart2, ArrowRight, Zap, Target, 
  Sun, Moon, CheckCircle2, FileText, Menu,
  Users, Calendar, Briefcase, Award, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

// ─── Carousel slides using real platform screenshots ──────────────────────────
const CAROUSEL_SLIDES = [
  { src: '/assets/student-dashboard.png', label: 'Student Dashboard', caption: 'Student workspace' },
  { src: '/assets/admin-dashboard.png',   label: 'Admin Dashboard',   caption: 'Placement & analytics hub' },
  { src: '/assets/faculty-dashboard.png', label: 'Faculty Portal',    caption: 'Activity review & approvals' },
  { src: '/assets/student360.png',        label: 'Student 360°',      caption: 'Advisor mentoring view' },
  { src: '/assets/talent-discovery.png',  label: 'Talent Discovery',  caption: 'Candidate search & filters' },
];

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [spotlightPos, setSpotlightPos] = useState({ x: -999, y: -999 });
  const heroSectionRef = useRef(null);
  const statsRef = useRef(null);
  const intervalRef = useRef(null);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  
  const role = user?.role || localStorage.getItem('role');
  
  const getDashboardPath = () => {
    if (role === 'student') return '/student';
    if (role === 'faculty') return '/faculty';
    if (role === 'admin') return '/admin';
    return '/login';
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  // Scroll animation hooks
  const heroRef = useScrollAnimation({ direction: 'up', delay: 0.1 });
  const featuresRef = useScrollAnimation({ direction: 'up', delay: 0.1 });
  const prototypeRef = useScrollAnimation({ direction: 'up', delay: 0.2 });
  const contactRef = useScrollAnimation({ direction: 'up', delay: 0.1 });
  
  // Staggered animations
  const { containerRef: featuresContainerRef, setItemRef: setFeatureRef } = useStaggeredAnimation(9, 0.05);
  const { containerRef: valueStepsContainerRef, setItemRef: setValueStepRef } = useStaggeredAnimation(3, 0.15);

  // ─── Scroll progress bar ────────────────────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress((scrollTop / docHeight) * 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── Carousel auto-cycle ────────────────────────────────────────────────────
  const advanceCarousel = useCallback(() => {
    setCarouselIdx(i => (i + 1) % CAROUSEL_SLIDES.length);
  }, []);

  useEffect(() => {
    if (carouselPaused) return;
    intervalRef.current = setInterval(advanceCarousel, 5500);
    return () => clearInterval(intervalRef.current);
  }, [carouselPaused, advanceCarousel]);

  const goToSlide = (idx) => { setCarouselIdx(idx); setCarouselPaused(true); };
  const prevSlide = () => { setCarouselIdx(i => (i - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length); setCarouselPaused(true); };
  const nextSlide = () => { setCarouselIdx(i => (i + 1) % CAROUSEL_SLIDES.length); setCarouselPaused(true); };

  // ─── Mouse spotlight (hero section only) ───────────────────────────────────
  useEffect(() => {
    const section = heroSectionRef.current;
    if (!section) return;
    const handleMove = (e) => {
      const rect = section.getBoundingClientRect();
      setSpotlightPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    const handleLeave = () => setSpotlightPos({ x: -999, y: -999 });
    section.addEventListener('mousemove', handleMove, { passive: true });
    section.addEventListener('mouseleave', handleLeave);
    return () => {
      section.removeEventListener('mousemove', handleMove);
      section.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  

  // ─── Product Showcase Cards Data ───────────────────────────────────────────
  const showcases = [
    {
      title: 'Resume Analyzer',
      icon: <FileText className="w-5 h-5" />,
      desc: 'ATS compatibility evaluation, skills extraction, and section recommendations powered by Google Gemini API.',
      bullets: ['ATS scorecard evaluation out of 100', 'Skills and keyword gap identification', 'Client-side PDF and DOCX parsing'],
      img: '/assets/student-dashboard.png'
    },
    {
      title: 'Placement Portal',
      icon: <Briefcase className="w-5 h-5" />,
      desc: 'Placement drive management supporting candidate eligibility criteria, application tracking, and shortlists.',
      bullets: ['Configurable drive eligibility filters', 'Direct student application pipelines', 'Shortlist to selection statuses'],
      img: '/assets/admin-dashboard.png'
    },
    {
      title: 'Student Achievement Tracker',
      icon: <Award className="w-5 h-5" />,
      desc: 'Centralized database cataloging student extracurricular activities, certifications, and verification proofs.',
      bullets: ['Categorized submission forms', 'Cloudinary certificate attachments', 'Rule-based point distribution'],
      img: '/assets/student-dashboard.png'
    },
    {
      title: 'Faculty Approvals Queue',
      icon: <CheckCircle2 className="w-5 h-5" />,
      desc: 'Faculty verification interface supporting approval decisions, rejection rationale, and revision requests.',
      bullets: ['FIFO review queue', 'Integrated document previews', 'Transactional points calculation'],
      img: '/assets/faculty-dashboard.png'
    },
    {
      title: 'Events System',
      icon: <Calendar className="w-5 h-5" />,
      desc: 'Campus event management to organize technical symposiums, hackathons, and department seminars.',
      bullets: ['Department and batch filters', 'Registration capacity tracking', 'In-app notification dispatch'],
      img: '/assets/student-dashboard.png'
    },
    {
      title: 'Notifications Hub',
      icon: <Zap className="w-5 h-5" />,
      desc: 'Notification bell menu in the navigation bar with unread status indicators and persistent counts.',
      bullets: ['Top navigation dropdown', 'One-click read acknowledgment', 'Persistent badge count sync'],
      img: '/assets/student-dashboard.png'
    },
    {
      title: 'Student 360 View',
      icon: <Users className="w-5 h-5" />,
      desc: 'Advisor mentoring workspace with academic records, GPA trends, activity histories, and verified credentials.',
      bullets: ['Verified credential checklist', 'GPA and backlog tracking', 'Cross-platform coding ratings'],
      img: '/assets/student360.png'
    },
    {
      title: 'Talent Discovery',
      icon: <Target className="w-5 h-5" />,
      desc: 'Candidate discovery search engine with multi-parameter filtering on developer scores, GPA, and skills.',
      bullets: ['Filter by developer score and GPA', 'Detailed candidate drawer views', 'Direct Excel (.xlsx) data export'],
      img: '/assets/talent-discovery.png'
    },
    {
      title: 'Analytics & Reporting',
      icon: <BarChart2 className="w-5 h-5" />,
      desc: 'Institutional reporting dashboard showing placement metrics and department activity distributions.',
      bullets: ['Institutional summary reports', 'Student distribution charts', 'Department performance tables'],
      img: '/assets/admin-dashboard.png'
    }
  ];

  const currentSlide = CAROUSEL_SLIDES[carouselIdx];

  return (
    <div className="overflow-x-hidden min-h-screen flex flex-col justify-between" style={{ background: 'var(--bg-dark)', color: 'var(--text-primary)' }}>
      {/* ─── Scroll Progress Bar ────────────────────────────────────────────── */}
      <div 
        className="scroll-indicator" 
        style={{ transform: `scaleX(${scrollProgress / 100})`, background: 'linear-gradient(90deg, var(--primary-blue), color-mix(in srgb, var(--primary-blue) 70%, #fff))', height: '3px', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, transformOrigin: '0% 50%' }}
        aria-hidden="true"
      />
      
      {/* ─── Glass Header ───────────────────────────────────────────────────── */}
      <header className="glass-nav fixed top-4 left-4 right-4 z-50 flex justify-center rounded-2xl border shadow-lg" style={{ background: 'var(--surface-glass)', borderColor: 'var(--border-color)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-6xl w-full mx-auto px-4 md:px-6 py-3 flex justify-between items-center">
          <a href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <img src="/assets/logo.png" alt="ScholrBoard Logo" className="w-8 h-8 object-contain transition-transform group-hover:scale-110 duration-200" />
            <span className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em' }}>
              <span style={{ color: 'var(--accent)' }}>Scholr</span>
              <span style={{ color: 'var(--text-primary)' }}>Board</span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center text-sm space-x-1">
              <a href="#core-workflow" className="text-sm font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }}>Workflow</a>
              <a href="#features" className="text-sm font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }}>Modules</a>
              <a href="#prototype" className="text-sm font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }}>Metrics</a>
              <Link to="/contact" className="text-sm font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }}>Contact</Link>
            </nav>
            <div className="w-px h-5" style={{ background: 'var(--border-color)' }} />
            {role ? (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Logged in as <span className="capitalize font-bold text-amber-500">{role}</span>
                </span>
                <button 
                  onClick={handleLogout}
                  className="text-red-500 hover:text-red-600 transition-colors text-sm font-bold px-3 py-1.5 rounded-lg hover:bg-red-500/10"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Link to="/login/student" className="text-sm font-bold px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }}>Student</Link>
                <Link to="/login/faculty" className="text-sm font-bold px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }}>Faculty</Link>
                <Link to="/login/admin" className="text-sm font-bold px-3 py-1.5 rounded-lg transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }}>Admin</Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 hover:border-amber-500/50 hover:text-amber-500"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', background: 'var(--bg-medium)' }}
              aria-label="Toggle dark and light theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            <button className="md:hidden text-lg p-2 rounded-lg transition-colors hover:bg-amber-500/10" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle Mobile Menu" aria-expanded={mobileOpen}>
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 p-6 pt-24 space-y-4" style={{ background: 'var(--bg-dark)' }}>
          <a href="#core-workflow" className="block py-2.5 text-lg font-bold border-b" style={{ borderColor: 'var(--border-color)' }} onClick={() => setMobileOpen(false)}>Workflow</a>
          <a href="#features" className="block py-2.5 text-lg font-bold border-b" style={{ borderColor: 'var(--border-color)' }} onClick={() => setMobileOpen(false)}>Modules</a>
          <a href="#prototype" className="block py-2.5 text-lg font-bold border-b" style={{ borderColor: 'var(--border-color)' }} onClick={() => setMobileOpen(false)}>Performance Metrics</a>
          <Link to="/about" className="block py-2.5 text-lg font-bold border-b" style={{ borderColor: 'var(--border-color)' }} onClick={() => setMobileOpen(false)}>About Us</Link>
          <Link to="/faq" className="block py-2.5 text-lg font-bold border-b" style={{ borderColor: 'var(--border-color)' }} onClick={() => setMobileOpen(false)}>FAQ</Link>
          <Link to="/contact" className="block py-2.5 text-lg font-bold" onClick={() => setMobileOpen(false)}>Contact Us</Link>
          <div className="pt-4">
            {role ? (
              <div className="space-y-3">
                <Link to={getDashboardPath()} className="flex items-center justify-center gap-2 btn btn-primary w-full py-3" onClick={() => setMobileOpen(false)}>
                  <LayoutGrid size={16} /><span>Go to Dashboard</span>
                </Link>
                <button onClick={handleLogout} className="btn btn-outline text-red-500 w-full py-3">Logout</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Link to="/login/student" className="btn btn-outline py-2 text-center text-sm font-bold" onClick={() => setMobileOpen(false)}>Student</Link>
                <Link to="/login/faculty" className="btn btn-outline py-2 text-center text-sm font-bold" onClick={() => setMobileOpen(false)}>Faculty</Link>
                <Link to="/login/admin" className="btn btn-outline py-2 text-center text-sm font-bold" onClick={() => setMobileOpen(false)}>Admin</Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Hero Section ──────────────────────────────────────────────────── */}
      <section
        ref={heroSectionRef}
        className="relative pt-36 pb-24 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, var(--bg-medium) 0%, var(--bg-dark) 100%)' }}
      >
        {/* Ambient glow orbs */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div style={{ position: 'absolute', top: '-10%', left: '60%', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(var(--primary-rgb), 0.07) 0%, transparent 70%)', borderRadius: '50%', transform: 'translate(-50%, 0)' }} />
          <div style={{ position: 'absolute', top: '30%', left: '15%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(var(--primary-rgb), 0.05) 0%, transparent 70%)', borderRadius: '50%' }} />
        </div>

        {/* Mouse spotlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            left: spotlightPos.x - 200,
            top: spotlightPos.y - 200,
            width: 400,
            height: 400,
            background: 'radial-gradient(circle, rgba(var(--primary-rgb), 0.06) 0%, transparent 70%)',
            borderRadius: '50%',
            transition: 'left 0.1s ease, top 0.1s ease',
            willChange: 'transform',
          }}
        />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div ref={heroRef} className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left: copy */}
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.1] tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Academic Operations and Credential Verification{' '}
                <span style={{ color: 'var(--accent)' }}>Unified</span>.
              </h1>
              <p className="text-lg leading-relaxed max-w-xl" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                ScholrBoard provides role-based workspaces for students, faculty mentors, and administrators to track achievements, verify credentials, and manage placement readiness.
              </p>
              
              <div className="flex flex-wrap gap-3 pt-1">
                <Link 
                  to={role ? getDashboardPath() : '/login/student'} 
                  className="btn btn-primary px-7 py-3.5 text-base font-bold flex items-center gap-2"
                >
                  <LayoutGrid size={17} />
                  <span>{role ? 'Go to Dashboard' : 'Open Workspace'}</span>
                  <ArrowRight size={16} />
                </Link>
                <a 
                  href="#features" 
                  className="btn btn-outline px-7 py-3.5 text-base font-bold flex items-center gap-1.5"
                >
                  <span>Explore Modules</span>
                </a>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Role-based access control</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Structured academic records</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Verified credential pipelines</span>
              </div>
            </div>

            {/* Right: dashboard carousel */}
            <div
              className="relative"
              onMouseEnter={() => setCarouselPaused(true)}
              onMouseLeave={() => setCarouselPaused(false)}
            >
              {/* Glow behind card */}
              <div aria-hidden="true" style={{ position: 'absolute', inset: '-20px', background: 'radial-gradient(ellipse at center, rgba(var(--primary-rgb), 0.12) 0%, transparent 70%)', borderRadius: '1.5rem', zIndex: 0 }} />
              
              {/* Screenshot frame */}
              <div
                className="relative rounded-2xl overflow-hidden border shadow-2xl"
                style={{ background: 'var(--surface-card)', borderColor: 'var(--border-color)', zIndex: 1, boxShadow: '0 24px 64px rgba(0,0,0,0.2), 0 0 0 1px rgba(var(--primary-rgb),0.1)' }}
              >
                {/* Browser chrome bar */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                  <div className="flex-1 mx-3 h-5 rounded-md px-2 flex items-center text-[10px] font-medium" style={{ background: 'var(--bg-dark)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                    scholrboard.app/{currentSlide.label.toLowerCase().replace(/\s/g, '-')}
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--primary-rgb), 0.12)', color: 'var(--accent)' }}>
                    {currentSlide.caption}
                  </span>
                </div>

                {/* Slide image */}
                <div className="relative overflow-hidden" style={{ height: '300px' }}>
                  {CAROUSEL_SLIDES.map((slide, i) => (
                    <img
                      key={slide.src}
                      src={slide.src}
                      alt={slide.label}
                      className="absolute inset-0 w-full h-full object-cover object-top"
                      style={{
                        opacity: i === carouselIdx ? 1 : 0,
                        transform: i === carouselIdx ? 'scale(1)' : 'scale(1.02)',
                        transition: 'opacity 0.6s ease, transform 0.6s ease',
                        willChange: 'opacity, transform',
                      }}
                    />
                  ))}
                </div>

                {/* Carousel controls */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
                  <button onClick={prevSlide} className="p-1 rounded-md transition-colors hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }} aria-label="Previous screenshot">
                    <ChevronLeft size={14} />
                  </button>
                  <div className="flex items-center gap-1.5">
                    {CAROUSEL_SLIDES.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => goToSlide(i)}
                        aria-label={`Go to slide ${i + 1}`}
                        style={{
                          width: i === carouselIdx ? '20px' : '6px',
                          height: '6px',
                          borderRadius: '9999px',
                          background: i === carouselIdx ? 'var(--accent)' : 'var(--border-color)',
                          transition: 'all 0.3s ease',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      />
                    ))}
                  </div>
                  <button onClick={nextSlide} className="p-1 rounded-md transition-colors hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }} aria-label="Next screenshot">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Live badge */}
              <div className="absolute -bottom-4 left-6 right-6 rounded-xl border px-4 py-2.5 flex justify-between items-center" style={{ background: 'var(--surface-glass)', borderColor: 'var(--border-color)', backdropFilter: 'blur(12px)', zIndex: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Live Platform</div>
                  <div className="text-xs font-bold mt-0.5">{currentSlide.label}</div>
                </div>
                <span className="badge badge-green text-[10px] flex items-center gap-1 font-bold">
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', display: 'inline-block', animation: 'pulse-glow 2s ease-in-out infinite' }} />
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* ─── Operational Workflow Trace ──────────────────────────────── */}
          <div id="core-workflow" ref={valueStepsContainerRef} className="mt-28 space-y-10 scroll-mt-24">
            {/* Section Header */}
            <div className="space-y-2 pb-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
                Core Workflow
              </div>
              <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2">
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  From submission to verified academic records
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Three-stage verification pipeline and institutional audit trail
                </p>
              </div>
            </div>

            {/* Workflow Steps Trace */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 relative">
              {[
                {
                  index: '01',
                  actor: 'Student',
                  title: 'Student Submission',
                  desc: 'Students submit certifications, research papers, projects, and achievements with supporting documentation.',
                  artifacts: ['ACTIVITY LOG', 'DOCUMENT PROOF', 'SUBMISSION TIME'],
                },
                {
                  index: '02',
                  actor: 'Faculty Advisor',
                  title: 'Faculty Verification',
                  desc: 'Advisors review submissions, inspect attached documentation, and approve credentials or request revisions in a FIFO queue.',
                  artifacts: ['REVIEW QUEUE', 'DECISION LOG', 'POINTS VALIDATION'],
                },
                {
                  index: '03',
                  actor: 'Administrator',
                  title: 'Institutional Access',
                  desc: 'Administrators search and filter verified student records using academic metrics, developer scores, and placement criteria.',
                  artifacts: ['GPA FILTER', 'DEV SCORE', 'DRIVE SHORTLIST'],
                },
              ].map((step, idx) => (
                <div
                  key={step.index}
                  ref={setValueStepRef(idx)}
                  className="space-y-4 relative group"
                >
                  {/* Step Index & Connector Line */}
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold tracking-widest" style={{ color: 'var(--accent)' }}>
                      {step.index}
                    </span>
                    <div className="h-px flex-1" style={{ background: 'var(--border-color)' }} />
                    <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      {step.actor}
                    </span>
                  </div>

                  {/* Step Title & Description */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-base tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {step.desc}
                    </p>
                  </div>

                  {/* System Metadata Trace */}
                  <div className="pt-2 flex flex-wrap gap-2 text-[10px] font-mono tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    {step.artifacts.map((art, aIdx) => (
                      <span key={aIdx} className="inline-flex items-center gap-1.5 opacity-80">
                        {aIdx > 0 && <span style={{ color: 'var(--border-color)' }}>/</span>}
                        <span>{art}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Product Showcase Grid ──────────────────────────────────────────── */}
      <section id="features" className="py-24" style={{ background: 'var(--bg-dark)' }}>
        <div className="max-w-6xl mx-auto px-6 space-y-14">
          <div ref={featuresRef} className="text-center space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
              Core Modules
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Centralized Campus Operations
            </h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              From resume evaluation and coding platform synchronization to faculty review queues and institutional compliance reporting.
            </p>
          </div>

          <div ref={featuresContainerRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {showcases.map((s, index) => (
              <div 
                key={s.title} 
                ref={setFeatureRef(index)} 
                className="card flex flex-col justify-between feature-card group relative overflow-hidden border" 
                style={{ borderColor: 'var(--border-color)', borderRadius: '1rem' }}
              >
                {/* Screenshot thumbnail */}
                <div className="h-40 overflow-hidden relative" style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <img 
                    src={s.img} 
                    alt={`${s.title} preview`} 
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.05]" 
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent flex items-end p-3.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ background: 'var(--accent)' }}>
                      {s.icon}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-3 flex-1 flex flex-col">
                  <h3 className="font-bold text-base leading-tight transition-colors duration-200 group-hover:text-amber-500" style={{ fontFamily: 'var(--font-display)' }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>{s.desc}</p>

                  <ul className="space-y-1.5 pt-1">
                    {s.bullets.map((b, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  {s.title === 'Resume Analyzer' && (
                    <Link to="/login/student" className="mt-2 text-xs font-bold flex items-center gap-1 hover:underline" style={{ color: 'var(--accent)' }}>
                      <span>Open Resume Analyzer</span>
                      <ArrowRight size={11} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Platform at a Glance / Engineering Scope ──────────────── */}
      <section id="prototype" className="py-20 border-t border-b" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
        <div ref={statsRef} className="max-w-6xl mx-auto px-6 space-y-10">
          <div ref={prototypeRef} className="text-center space-y-2">
            <div className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
              Platform at a Glance
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Built around measurable engineering work
            </h2>
          </div>

          <div className="border-t border-b" style={{ borderColor: 'var(--border-color)' }}>
            {/* Row 1: Core System Architecture Surface */}
            <div 
              className="grid grid-cols-2 md:grid-cols-4 border-b divide-y md:divide-y-0 md:divide-x"
              style={{ borderColor: 'var(--border-color)' }}
            >
              {[
                { value: '35+',  label: 'React Screens' },
                { value: '115+', label: 'REST APIs' },
                { value: '20+',  label: 'MongoDB Models' },
                { value: '4',    label: 'Role-Based Dashboards' },
              ].map((item) => (
                <div key={item.label} className="p-6 md:p-8 text-center space-y-2 first:pl-0 last:pr-0">
                  <div className="text-3xl md:text-4xl font-extrabold font-mono tabular-nums tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {item.value}
                  </div>
                  <div className="text-xs font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Row 2: Performance Benchmarks & Scale */}
            <div 
              className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x"
              style={{ borderColor: 'var(--border-color)' }}
            >
              {[
                { value: '10,000+', label: 'Benchmarked Profiles' },
                { value: '98.2%',   label: 'Query Latency Reduction' },
              ].map((item) => (
                <div key={item.label} className="p-6 md:p-8 text-center space-y-2">
                  <div className="text-3xl md:text-4xl font-extrabold font-mono tabular-nums tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {item.value}
                  </div>
                  <div className="text-xs font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Understated Developer Integrations Footer */}
          <div className="pt-2 text-center space-y-1.5">
            <div className="text-[11px] font-mono font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
              Developer Integrations
            </div>
            <div className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
              GitHub <span className="mx-2 font-normal" style={{ color: 'var(--border-color)' }}>·</span> LeetCode <span className="mx-2 font-normal" style={{ color: 'var(--border-color)' }}>·</span> Codeforces
            </div>
            <div className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
              Developer synchronization and scoring
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA Section ────────────────────────────────────────────────────── */}
      <section id="contact" className="py-24" style={{ background: 'var(--bg-dark)' }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div ref={contactRef} className="card p-10 md:p-14 space-y-8 border shadow-2xl relative overflow-hidden" style={{ borderColor: 'var(--border-color)', background: 'linear-gradient(135deg, var(--bg-medium) 0%, rgba(var(--primary-rgb), 0.07) 100%)', borderRadius: '1.25rem' }}>
            {/* CTA glow */}
            <div aria-hidden="true" style={{ position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: '200px', background: 'radial-gradient(ellipse, rgba(var(--primary-rgb),0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div className="relative space-y-4 z-10">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Implement ScholrBoard for Your Campus</h2>
              <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Connect with our engineering team to configure advisor hierarchies, student batch structures, and institutional compliance reporting.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 relative z-10">
              <Link to="/contact" className="btn btn-primary px-8 py-4 font-bold text-base shadow-lg">
                Contact Campus Team
              </Link>
              <Link to="/support" className="btn btn-outline px-8 py-4 font-bold text-base">
                Helpdesk Support
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="py-14 border-t text-sm" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-medium)' }}>
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1 space-y-4">
            <a href="/" className="flex items-center gap-2.5 group">
              <img src="/assets/logo.png" alt="ScholrBoard Logo" className="w-7 h-7 object-contain transition-transform group-hover:scale-110 duration-200" />
              <span className="text-lg font-extrabold" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.04em' }}>
                <span style={{ color: 'var(--accent)' }}>Scholr</span>
                <span style={{ color: 'var(--text-primary)' }}>Board</span>
              </span>
            </a>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)', maxWidth: '200px' }}>
              Academic operations, credential verification, and placement readiness platform.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-xs" style={{ color: 'var(--text-primary)' }}>Resources</h4>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <li><Link to="/about" className="hover:text-amber-500 transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-amber-500 transition-colors">Contact Form</Link></li>
              <li><Link to="/faq" className="hover:text-amber-500 transition-colors">FAQ & Help</Link></li>
              <li><Link to="/support" className="hover:text-amber-500 transition-colors">Support Desk</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-xs" style={{ color: 'var(--text-primary)' }}>Portals</h4>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <li><Link to="/login/student" className="hover:text-amber-500 transition-colors">Student Portal</Link></li>
              <li><Link to="/login/faculty" className="hover:text-amber-500 transition-colors">Faculty Portal</Link></li>
              <li><Link to="/login/admin" className="hover:text-amber-500 transition-colors">Admin Dashboard</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-xs" style={{ color: 'var(--text-primary)' }}>Legal</h4>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <li><Link to="/privacy" className="hover:text-amber-500 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-amber-500 transition-colors">Terms of Service</Link></li>
              <li><Link to="/cookies" className="hover:text-amber-500 transition-colors">Cookie Settings</Link></li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 text-center mt-10 pt-6 border-t flex flex-wrap justify-between items-center gap-4" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
          <span>&copy; {new Date().getFullYear()} ScholrBoard. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="mailto:pathbullish@gmail.com" className="hover:text-amber-500 transition-colors">pathbullish@gmail.com</a>
            <a href="tel:+917339743084" className="hover:text-amber-500 transition-colors">+91-7339743084</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
