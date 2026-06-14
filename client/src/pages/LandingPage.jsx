import { Link } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { 
  ChevronDown, LayoutGrid, BarChart2, ArrowRight, Sparkles, Zap, Target, 
  Sun, Moon, CheckCircle2, FileText,
  Users, Calendar, Briefcase, Award, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';

// ─── Carousel slides using real platform screenshots ──────────────────────────
const CAROUSEL_SLIDES = [
  { src: '/assets/student-dashboard.png', label: 'Student Dashboard', caption: 'Unified student workspace' },
  { src: '/assets/admin-dashboard.png',   label: 'Admin Dashboard',   caption: 'Placement & analytics hub' },
  { src: '/assets/faculty-dashboard.png', label: 'Faculty Portal',    caption: 'Activity review & approvals' },
  { src: '/assets/student360.png',        label: 'Student 360°',      caption: 'Advisor mentoring view' },
  { src: '/assets/talent-discovery.png',  label: 'Talent Discovery',  caption: 'Candidate search & filters' },
];

// ─── Stats with numeric targets for count-up ─────────────────────────────────
const STATS = [
  { target: 45000, suffix: '+', label: 'Activities Verified' },
  { target: 120,   suffix: '+', label: 'Placement Drives' },
  { target: 300,   suffix: '+', label: 'Events Organized' },
  { target: 12000, suffix: '+', label: 'Resumes Analyzed' },
  { target: 8500,  suffix: '+', label: 'Faculty Reviews' },
];

// ─── Count-up hook ────────────────────────────────────────────────────────────
function useCountUp(target, duration = 2000, started = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!started) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, started]);
  return value;
}

// ─── Single stat card with count-up ──────────────────────────────────────────
function StatCard({ target, suffix, label, started }) {
  const value = useCountUp(target, 2000, started);
  const display = target >= 1000
    ? (value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : value)
    : value;
  return (
    <div className="card p-5 space-y-2 border text-center stat-card" style={{ borderColor: 'var(--border-color)' }}>
      <div className="text-2xl md:text-3xl font-black text-amber-500 tabular-nums">
        {display}{suffix}
      </div>
      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </div>
    </div>
  );
}

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [customersOpen, setCustomersOpen] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [statsStarted, setStatsStarted] = useState(false);
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

  // ─── Stats count-up IntersectionObserver ───────────────────────────────────
  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ─── Product Showcase Cards Data ───────────────────────────────────────────
  const showcases = [
    {
      title: 'Resume Analyzer',
      icon: <FileText className="w-5 h-5" />,
      desc: 'AI-powered ATS scoring, skills extraction, and personalized improvements via Google Gemini API.',
      bullets: ['Instant ATS scorecard out of 100', 'Automatic skills and gap identification', 'Live PDF preview and download controls'],
      img: '/assets/student-dashboard.png'
    },
    {
      title: 'Placement Portal',
      icon: <Briefcase className="w-5 h-5" />,
      desc: 'Sleek drive coordinator supporting eligibility filters, matching metrics, and application status updates.',
      bullets: ['Automated drive publishing', 'Direct application pipelines', 'Shortlist to selection statuses'],
      img: '/assets/admin-dashboard.png'
    },
    {
      title: 'Student Achievement Tracker',
      icon: <Award className="w-5 h-5" />,
      desc: 'Centralized database cataloging student activities, certificates, and student-submitted proofs.',
      bullets: ['Pre-populated edit forms', 'Cloudinary certificate attachments', 'Role-based point distribution'],
      img: '/assets/student-dashboard.png'
    },
    {
      title: 'Faculty Approvals Queue',
      icon: <CheckCircle2 className="w-5 h-5" />,
      desc: 'Interactive evaluation list supporting quick approvals, rejection notes, or revision flags.',
      bullets: ['One-click revision requests', 'Integrated document previews', 'Instant points validation'],
      img: '/assets/faculty-dashboard.png'
    },
    {
      title: 'Events System',
      icon: <Calendar className="w-5 h-5" />,
      desc: 'Admin dashboard to broadcast campus events, hackathons, and seminars to specific CSE batches.',
      bullets: ['Department filters (e.g. CSE)', 'Registration status persistence', 'Notification alerts on publish'],
      img: '/assets/student-dashboard.png'
    },
    {
      title: 'Notifications Hub',
      icon: <Zap className="w-5 h-5" />,
      desc: 'Interactive bell menu aligned to the topbar with persistent unread badge indicators and counts.',
      bullets: ['Sleek notification dropdown', 'One-click read acknowledgement', 'Badge counts sync on refresh'],
      img: '/assets/student-dashboard.png'
    },
    {
      title: 'Student 360 View',
      icon: <Users className="w-5 h-5" />,
      desc: 'Advisor workspace containing verified point distributions, attendance ratings, and GPA metrics.',
      bullets: ['Verified portfolio checklists', 'CGPA & backlog audit trackers', 'Placement readiness metrics'],
      img: '/assets/student360.png'
    },
    {
      title: 'Talent Discovery',
      icon: <Target className="w-5 h-5" />,
      desc: 'Admin candidate search panels with filters, skill requirements, and student profile drawers.',
      bullets: ['Filter by CGPA or skills', 'Detailed drawer views', 'Direct advisor linkages'],
      img: '/assets/talent-discovery.png'
    },
    {
      title: 'Analytics & Reporting',
      icon: <BarChart2 className="w-5 h-5" />,
      desc: 'Accreditation reporting suite showing placement stats and department performance outcomes.',
      bullets: ['Ready for NIRF & NAAC audits', 'Student distribution graphs', 'Outcomes analysis tables'],
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
      
      {/* ─── Premium Glass Header ───────────────────────────────────────────── */}
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
              <a href="#features" className="text-sm font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }}>Product Showcase</a>
              <a href="#prototype" className="text-sm font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }}>Metrics</a>
              
              {/* Customers Dropdown */}
              <div className="relative">
                <button onClick={() => setCustomersOpen(v => !v)} className="text-sm font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  <span>Customers</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${customersOpen ? 'rotate-180' : ''}`} />
                </button>
                {customersOpen && (
                  <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 min-w-[160px] rounded-xl border p-1.5 shadow-xl z-20 animate-dropdown" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)', boxShadow: '0 16px 40px rgba(0,0,0,0.15)' }}>
                    {['Universities', 'Colleges', 'Institutes'].map((x) => (
                      <div key={x} className="px-3 py-2 rounded-lg hover:bg-amber-500/10 hover:text-amber-500 cursor-pointer text-sm font-medium transition-colors" onClick={() => setCustomersOpen(false)}>
                        {x}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <Link to="/contact" className="text-sm font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-500" style={{ color: 'var(--text-secondary)' }}>Contact Us</Link>
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
            <button className="md:hidden text-lg p-2 rounded-lg transition-colors hover:bg-amber-500/10" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle Mobile Menu" aria-expanded={mobileOpen}>☰</button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 p-6 pt-24 space-y-4" style={{ background: 'var(--bg-dark)' }}>
          <a href="#features" className="block py-2.5 text-lg font-bold border-b" style={{ borderColor: 'var(--border-color)' }} onClick={() => setMobileOpen(false)}>Product Showcase</a>
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
            <div className="space-y-7">
              {/* Eyebrow badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'rgba(var(--primary-rgb), 0.2)' }}>
                <Sparkles size={11} />
                <span>Consolidated Campus Management Platform</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.1] tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                Keep Student Progress{' '}
                <span style={{ color: 'var(--accent)' }}>Organized</span>
                {' '}Without Chasing Forms.
              </h1>
              <p className="text-lg leading-relaxed max-w-xl" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
                ScholrBoard gives students, mentors, and administrators one unified workspace for verified achievements, AI-powered resume scores, and placement-ready credentials.
              </p>
              
              <div className="flex flex-wrap gap-3 pt-1">
                <Link 
                  to={role ? getDashboardPath() : '/login/student'} 
                  className="btn btn-primary px-7 py-3.5 text-base font-bold flex items-center gap-2"
                >
                  <LayoutGrid size={17} />
                  <span>{role ? 'Go to Dashboard' : 'Get Started Free'}</span>
                  <ArrowRight size={16} />
                </Link>
                <a 
                  href="#features" 
                  className="btn btn-outline px-7 py-3.5 text-base font-bold flex items-center gap-1.5"
                >
                  <span>Explore Features</span>
                </a>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center gap-4 pt-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> No credit card required</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Role-based access</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> NAAC & NIRF ready</span>
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

          {/* ─── Value Steps ─────────────────────────────────────────────── */}
          <div ref={valueStepsContainerRef} className="grid gap-5 md:grid-cols-3 mt-24">
            {[
              { t: 'Capture Milestones', d: 'Students add certificates, credentials, and projects in seconds with direct Cloudinary uploads.', icon: <Zap className="w-5 h-5" /> },
              { t: 'Faculty Audit', d: 'Advisors inspect proofs and request revisions or approve credentials with one click.', icon: <Target className="w-5 h-5" /> },
              { t: 'Recruiter Showcase', d: 'Automatically feeds verified portfolios and GPA profiles into live placement drives.', icon: <Sparkles className="w-5 h-5" /> },
            ].map((v, index) => (
              <div key={v.t} ref={setValueStepRef(index)} className="card p-6 flex items-start gap-4 border feature-card group" style={{ borderColor: 'var(--border-color)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110" style={{ background: 'rgba(var(--primary-rgb), 0.12)', color: 'var(--accent)' }}>
                  {v.icon}
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-base" style={{ fontFamily: 'var(--font-display)' }}>{v.t}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{v.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Product Showcase Grid ──────────────────────────────────────────── */}
      <section id="features" className="py-24" style={{ background: 'var(--bg-dark)' }}>
        <div className="max-w-6xl mx-auto px-6 space-y-14">
          <div ref={featuresRef} className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-2" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <Sparkles size={11} />
              <span>9 Integrated Modules</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>One Platform, Complete Visibility</h2>
            <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              From parsing resumes with Gemini AI to exporting evidence for NAAC audits — ScholrBoard replaces disconnected spreadsheets.
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
                      <span>Try Resume Analyzer</span>
                      <ArrowRight size={11} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Stats & Metrics with Count-Up ──────────────────────────────────── */}
      <section id="prototype" className="py-20 border-t border-b" style={{ background: 'var(--bg-medium)', borderColor: 'var(--border-color)' }}>
        <div ref={statsRef} className="max-w-6xl mx-auto px-6">
          <div ref={prototypeRef} className="text-center space-y-3 mb-12">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Platform Performance</div>
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Institutional Metrics, Real-Time</h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              ScholrBoard powers campus operations across student achievement, placements, and accreditation.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
            {STATS.map((stat) => (
              <StatCard key={stat.label} target={stat.target} suffix={stat.suffix} label={stat.label} started={statsStarted} />
            ))}
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
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Get ScholrBoard For Your Campus</h2>
              <p className="text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Schedule a call with our implementation engineers to set up advisor hierarchies, student batch synchronization, and NAAC reporting directories.
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

      {/* ─── Premium Footer ──────────────────────────────────────────────────── */}
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
              Accreditation, credentials auditing, and MERN-based placement readiness management for forward-looking engineering institutes.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-xs" style={{ color: 'var(--text-primary)' }}>Subpages</h4>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <li><Link to="/about" className="hover:text-amber-500 transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="hover:text-amber-500 transition-colors">Contact Form</Link></li>
              <li><Link to="/faq" className="hover:text-amber-500 transition-colors">FAQ & Help</Link></li>
              <li><Link to="/support" className="hover:text-amber-500 transition-colors">Support Desk</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-xs" style={{ color: 'var(--text-primary)' }}>Admissions & Roles</h4>
            <ul className="space-y-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <li><Link to="/login/student" className="hover:text-amber-500 transition-colors">Student Log-in</Link></li>
              <li><Link to="/login/faculty" className="hover:text-amber-500 transition-colors">Faculty Portal</Link></li>
              <li><Link to="/login/admin" className="hover:text-amber-500 transition-colors">Admin Dashboard</Link></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold uppercase tracking-wider text-xs" style={{ color: 'var(--text-primary)' }}>Legal Privacy</h4>
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
