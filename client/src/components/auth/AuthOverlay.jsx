import { lazy, Suspense, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

const roles = ['student', 'faculty', 'admin'];
const LandingPage = lazy(() => import('../../pages/LandingPage.jsx').then((module) => ({ default: module.LandingPage })));

export function AuthOverlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeRole = roles.find((role) => location.pathname.endsWith(`/${role}`)) || 'student';

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') navigate('/');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate]);

  return (
    <div className="auth-overlay-page">
      <div className="auth-overlay-background" aria-hidden="true" inert="">
        <Suspense fallback={<div className="min-h-screen" />}>
          <LandingPage />
        </Suspense>
      </div>

      <div className="auth-overlay-backdrop" onMouseDown={() => navigate('/')}>
        <section
          className="auth-overlay-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={`${activeRole} authentication`}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="auth-overlay-toolbar">
            <div>
              <p className="auth-overlay-eyebrow">Choose your portal</p>
              <h1 className="auth-overlay-title">
                {activeRole.charAt(0).toUpperCase() + activeRole.slice(1)} access
              </h1>
            </div>
            <button
              type="button"
              className="auth-overlay-close"
              onClick={() => navigate('/')}
              aria-label="Close authentication"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="auth-role-tabs" aria-label="Choose login role">
            {roles.map((role) => (
              <Link
                key={role}
                to={`/login/${role}`}
                className={`auth-role-tab ${activeRole === role ? 'auth-role-tab-active' : ''}`}
              >
                {role}
              </Link>
            ))}
          </nav>

          <div className="auth-overlay-content">
            <Outlet />
          </div>
        </section>
      </div>
    </div>
  );
}
