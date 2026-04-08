import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useFirebaseAuth } from '../../contexts/FirebaseAuthContext';
import { useNavigate } from 'react-router-dom';
import { SignupForm } from './SignupForm';

export function BaseLoginForm({ role, additionalFields = [], disableSignup = false }) {
  const navigate = useNavigate();
  const { login, user } = useFirebaseAuth();
  const [formType, setFormType] = useState('login');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

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
      console.log('Attempting login...', { email: formData.email, role });
      
      // Login with Firebase
      await login(formData.email, formData.password);

      // At this point, the user data should be synced with the backend
      // and available in the FirebaseAuth context
      
      // Verify user role matches the expected role
      if (user?.role && user.role !== role) {
        setError(`This account is not registered as a ${role}. Please use the correct login page.`);
        return;
      }

      // Navigate to dashboard
      console.log('Login successful, navigating to dashboard...');
      navigate(`/${role}/dashboard`);
    } catch (err) {
      console.error('Login error:', err);
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
            <div className="text-lg font-semibold text-brand-blue">JECRC University</div>
            <div className="text-sm" style={{color:'var(--text-secondary)'}}>CODEVENGERS Platform</div>
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
            <input
              name="password"
              value={formData.password}
              onChange={handleChange}
              type="password"
              className="w-full input-dark"
              placeholder="Your password"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-2">
            <button 
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
            {!disableSignup && (
              <button
                type="button"
                onClick={() => setFormType('signup')}
                className="btn btn-outline w-full"
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