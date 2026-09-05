import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import authApi from '../../api/auth.api.js';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('This password reset link is invalid or has expired.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);
      await authApi.resetPassword({ token, password });
      setIsSuccess(true);
    } catch (err) {
      setError(err.message || 'This password reset link is invalid or has expired.');
    } finally {
      setIsLoading(false);
    }
  };

  const isInvalidToken = !token || (error && error.includes('invalid or has expired'));

  return (
    <div className="min-h-screen grid place-items-center p-6" style={{ background: 'var(--bg-dark)' }}>
      <div className="w-full max-w-md card p-6 gpu-accelerated">
        <div className="flex items-center gap-3 mb-6">
          <GraduationCap className="text-brand-blue" />
          <div>
            <div className="text-lg font-semibold text-brand-blue">ScholrBoard</div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Create New Password</div>
          </div>
        </div>

        {isSuccess ? (
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg text-sm border flex items-start gap-3"
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                color: '#34d399',
              }}
            >
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-300 mb-1">Password reset successful</p>
                <p className="text-xs leading-relaxed text-emerald-200/90">
                  Your password has been securely updated. You can now sign in with your new password.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="btn btn-primary w-full auth-action-button flex items-center justify-center gap-2"
            >
              Return to Sign In
            </button>
          </div>
        ) : !token ? (
          <div className="space-y-4">
            <div
              className="p-4 rounded-lg text-sm border flex items-start gap-3"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#f87171',
              }}
            >
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-300 mb-1">Invalid or missing token</p>
                <p className="text-xs leading-relaxed text-red-200/90">
                  This password reset link is invalid or has expired. Please request a new link.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="btn btn-outline w-full auth-action-button flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} /> Request a new reset link
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              Choose a secure password with at least 8 characters.
            </p>

            <div>
              <label className="block text-sm mb-1 subtle" htmlFor="new-password">New Password</label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full input-dark pr-12"
                  placeholder="At least 8 characters"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 grid place-items-center text-slate-400 hover:text-white"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1 subtle" htmlFor="confirm-new-password">Confirm Password</label>
              <div className="relative">
                <input
                  id="confirm-new-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full input-dark pr-12"
                  placeholder="Re-enter your password"
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-3 grid place-items-center text-slate-400 hover:text-white"
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="p-3 rounded-lg text-xs border flex items-start gap-2"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                }}
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {isInvalidToken && (
              <Link
                to="/login"
                className="btn btn-outline w-full auth-action-button flex items-center justify-center gap-2 text-sm mt-2"
              >
                <ArrowLeft size={16} /> Request a new reset link
              </Link>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full auth-action-button"
              >
                {isLoading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
export default ResetPasswordPage;
