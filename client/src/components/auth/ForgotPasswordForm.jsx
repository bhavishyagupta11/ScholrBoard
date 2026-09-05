import { useState } from 'react';
import { GraduationCap, ArrowLeft, CheckCircle2 } from 'lucide-react';
import authApi from '../../api/auth.api.js';

export function ForgotPasswordForm({ role, onBackToLogin, presentation = 'page', initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    try {
      setIsLoading(true);
      await authApi.forgotPassword({
        email: email.trim(),
        portalRole: role,
      });
      setSubmitted(true);
    } catch (err) {
      // In case of unexpected network or server error
      setError(err.message || 'Unable to process request. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={presentation === 'modal' ? 'auth-form-frame' : 'min-h-screen grid place-items-center p-6'}
      style={presentation === 'modal' ? undefined : { background: 'var(--bg-dark)' }}
    >
      <div className={`w-full max-w-md card p-6 ${presentation === 'modal' ? 'auth-modal-card' : 'gpu-accelerated hover:scale-105 transition-transform'}`}>
        <div className="flex items-center gap-3 mb-4">
          <GraduationCap className="text-brand-blue" />
          <div>
            <div className="text-lg font-semibold text-brand-blue">ScholrBoard</div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Password Recovery</div>
          </div>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg text-sm border flex items-start gap-3" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-300 mb-1">Check your inbox</p>
                <p className="text-xs leading-relaxed text-emerald-200/90">
                  If an account is associated with that email, a password reset link has been sent. The link will expire in 15 minutes.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onBackToLogin}
              className="btn btn-primary w-full auth-action-button flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} /> Return to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-base font-medium text-white mb-1">Forgot your password?</h2>
              <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                Enter your registered college email and we'll send you a password reset link.
              </p>
            </div>

            <div>
              <label className="block text-sm mb-1 subtle" htmlFor={`${role}-forgot-email`}>Registered Email</label>
              <input
                id={`${role}-forgot-email`}
                name="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                type="email"
                className="w-full input-dark"
                placeholder="you@college.edu"
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full auth-action-button"
              >
                {isLoading ? 'Sending Link...' : 'Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={onBackToLogin}
                className="btn btn-outline w-full auth-action-button flex items-center justify-center gap-2"
                disabled={isLoading}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
