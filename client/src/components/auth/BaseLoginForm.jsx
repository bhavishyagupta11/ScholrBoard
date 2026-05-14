import { useEffect, useState } from 'react';
import { Eye, EyeOff, GraduationCap } from 'lucide-react';
import { useFirebaseAuth } from '../../contexts/FirebaseAuthContext';
import { useNavigate } from 'react-router-dom';
import { SignupForm } from './SignupForm';

export function BaseLoginForm({ role, additionalFields = [], disableSignup = false }) {
  const navigate = useNavigate();
  const { login, user } = useFirebaseAuth();
  const [formType, setFormType] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role) {
      navigate(user.role === 'student' ? '/student/dashboard' : `/${user.role}`, { replace: true });
    }
  }, [navigate, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      setIsLoading(true);
      // Login with Firebase
      const loggedInUser = await login(formData.email, formData.password);

      // At this point, the user data should be synced with the backend
      // and available in the FirebaseAuth context
      
      // Verify user role matches the expected role
      if (loggedInUser?.role && loggedInUser.role !== role) {
        setError(`This account is not registered as a ${role}. Please use the correct login page.`);
        return;
      }

      // Navigate to dashboard
      navigate(role === 'student' ? '/student/dashboard' : `/${role}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  if (formType === 'signup') {
    return (
      <SignupForm 
        role={role} 
        additionalFields={additionalFields}
        onToggleForm={setFormType}
      />
    );
  }

  return (
    <div className="min-h-screen grid place-items-center p-6" style={{background:'var(--bg-dark)'}}>
      <div className="w-full max-w-md card p-6 gpu-accelerated hover:scale-105 transition-transform">
        <div className="flex items-center gap-3 mb-4">
          <GraduationCap className="text-brand-blue" />
          <div>
            <div className="text-lg font-semibold text-brand-blue">ScholrBoard</div>
            <div className="text-sm" style={{color:'var(--text-secondary)'}}>ScholrBoard Platform</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 subtle">Email</label>
            <input
              name="email"
              value={formData.email}
              onChange={handleChange}
              type="email"
              className="w-full input-dark"
              placeholder="you@college.edu"
            />
          </div>

          <div>
            <label className="block text-sm mb-1 subtle">Password</label>
            <div className="relative">
              <input
                name="password"
                value={formData.password}
                onChange={handleChange}
                type={showPassword ? 'text' : 'password'}
                className="w-full input-dark pr-12"
                placeholder="Your password"
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

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-2">
            <button 
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full auth-action-button"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
            {!disableSignup && (
              <button
                type="button"
                onClick={() => setFormType('signup')}
                className="btn btn-outline w-full auth-action-button"
                disabled={isLoading}
              >
                Create Account
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
