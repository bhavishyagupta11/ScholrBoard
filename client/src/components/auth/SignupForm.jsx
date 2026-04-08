import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useFirebaseAuth } from '../../contexts/FirebaseAuthContext';
import { useNavigate } from 'react-router-dom';

export function SignupForm({ role, onToggleForm, additionalFields = [] }) {
  const navigate = useNavigate();
  const { register } = useFirebaseAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    ...additionalFields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {})
  });

  const [errors, setErrors] = useState({});

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasMinLength = password.length >= 8;
    
    return {
      isValid: hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && hasMinLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
      hasMinLength
    };
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Validate name
    if (!formData.name) {
      newErrors.name = 'Name is required';
    }

    // Validate email
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Validate password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        const errorParts = [];
        if (!passwordValidation.hasMinLength) errorParts.push('at least 8 characters');
        if (!passwordValidation.hasUpperCase) errorParts.push('one uppercase letter');
        if (!passwordValidation.hasLowerCase) errorParts.push('one lowercase letter');
        if (!passwordValidation.hasNumbers) errorParts.push('one number');
        if (!passwordValidation.hasSpecialChar) errorParts.push('one special character');
        newErrors.password = `Password must contain ${errorParts.join(', ')}`;
      }
    }

    // Validate confirm password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Validate additional fields
    additionalFields.forEach(field => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      try {
        setIsLoading(true);
        // Register with Firebase and create user in MongoDB
        await register(formData.email, formData.password, {
          name: formData.name,
          role,
          ...Object.fromEntries(
            additionalFields.map(field => [field.name, formData[field.name]])
          )
        });

        // Navigate to appropriate dashboard based on role
        navigate(`/${role}/dashboard`);
      } catch (error) {
        setErrors({ submit: error.message });
      } finally {
        setIsLoading(false);
      }
    }
  };

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
            <label className="block text-sm mb-1 subtle">Full Name</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              type="text"
              className="w-full input-dark"
              placeholder="Your full name"
            />
            {errors.name && <div className="text-red-400 text-sm mt-1">{errors.name}</div>}
          </div>

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
            {errors.email && <div className="text-red-400 text-sm mt-1">{errors.email}</div>}
          </div>

          <div>
            <label className="block text-sm mb-1 subtle">Password</label>
            <input
              name="password"
              value={formData.password}
              onChange={handleChange}
              type="password"
              className="w-full input-dark"
              placeholder="Create a strong password"
            />
            {errors.password && <div className="text-red-400 text-sm mt-1">{errors.password}</div>}
          </div>

          <div>
            <label className="block text-sm mb-1 subtle">Confirm Password</label>
            <input
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              type="password"
              className="w-full input-dark"
              placeholder="Confirm your password"
            />
            {errors.confirmPassword && <div className="text-red-400 text-sm mt-1">{errors.confirmPassword}</div>}
          </div>

          {additionalFields.map(field => (
            <div key={field.name}>
              <label className="block text-sm mb-1 subtle">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleChange}
                  className="w-full input-dark"
                >
                  <option value="">{field.placeholder}</option>
                  {field.options?.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  value={formData[field.name]}
                  onChange={handleChange}
                  type={field.type || 'text'}
                  min={field.min}
                  max={field.max}
                  className="w-full input-dark"
                  placeholder={field.placeholder}
                />
              )}
              {errors[field.name] && (
                <div className="text-red-400 text-sm mt-1">{errors[field.name]}</div>
              )}
            </div>
          ))}

          {errors.submit && (
            <div className="text-red-400 text-sm">{errors.submit}</div>
          )}

          <div className="flex gap-2">
            <button 
              className="btn btn-primary w-full" 
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : `Sign up as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
            </button>
            <button
              className="btn btn-outline w-full"
              type="button"
              onClick={() => onToggleForm('login')}
              disabled={isLoading}
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}