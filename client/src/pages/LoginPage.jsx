import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useScrollAnimation } from '../hooks/useScrollAnimation.js';

export function LoginPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [role, setRole] = useState('student');
	const [emailError, setEmailError] = useState('');
	const [passwordError, setPasswordError] = useState('');
	const navigate = useNavigate();

	// Scroll animation hooks
	const containerRef = useScrollAnimation({ animationClass: 'fade-in-scale', delay: 0.2 });

	// Validation functions
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

	const handleEmailChange = (e) => {
		const value = e.target.value;
		setEmail(value);
		if (value && !validateEmail(value)) {
			setEmailError('Please enter a valid email address');
		} else {
			setEmailError('');
		}
	};

	const handlePasswordChange = (e) => {
		const value = e.target.value;
		setPassword(value);
		if (value) {
			const validation = validatePassword(value);
			if (!validation.isValid) {
				const errors = [];
				if (!validation.hasMinLength) errors.push('at least 8 characters');
				if (!validation.hasUpperCase) errors.push('one uppercase letter');
				if (!validation.hasLowerCase) errors.push('one lowercase letter');
				if (!validation.hasNumbers) errors.push('one number');
				if (!validation.hasSpecialChar) errors.push('one special character');
				setPasswordError(`Password must contain ${errors.join(', ')}`);
			} else {
				setPasswordError('');
			}
		} else {
			setPasswordError('');
		}
	};

	const submit = (e) => {
		e.preventDefault();
		
		// Clear previous errors
		setEmailError('');
		setPasswordError('');
		
		// Validate email
		if (!email.trim()) {
			setEmailError('Email is required');
			return;
		}
		if (!validateEmail(email)) {
			setEmailError('Please enter a valid email address');
			return;
		}
		
		// Validate password
		if (!password.trim()) {
			setPasswordError('Password is required');
			return;
		}
		const passwordValidation = validatePassword(password);
		if (!passwordValidation.isValid) {
			const errors = [];
			if (!passwordValidation.hasMinLength) errors.push('at least 8 characters');
			if (!passwordValidation.hasUpperCase) errors.push('one uppercase letter');
			if (!passwordValidation.hasLowerCase) errors.push('one lowercase letter');
			if (!passwordValidation.hasNumbers) errors.push('one number');
			if (!passwordValidation.hasSpecialChar) errors.push('one special character');
			setPasswordError(`Password must contain ${errors.join(', ')}`);
			return;
		}
		
		// If validation passes, proceed with login
		console.log('Form submitted:', { email, password, role });
		localStorage.setItem('role', role);
		localStorage.setItem('isAuthenticated', 'true');
		console.log('Login successful, redirecting to:', role === 'student' ? '/student' : '/verify');
		
		// Use window.location for more reliable navigation
		if (role === 'student') {
			window.location.href = '/student';
		} else if (role === 'faculty') {
			window.location.href = '/faculty';
		} else if (role === 'admin') {
			window.location.href = '/admin';
		}
	};

	return (
		<div className="min-h-screen grid place-items-center p-6" style={{background:'var(--bg-dark)'}}>
			<div ref={containerRef} className="w-full max-w-md card p-6 gpu-accelerated hover:scale-105 transition-transform">
				<div className="flex items-center gap-3 mb-4">
					<GraduationCap className="text-brand-blue" />
					<div>
						<div className="text-lg font-semibold text-brand-blue">JECRC University</div>
						<div className="text-sm" style={{color:'var(--text-secondary)'}}>CODEVENGERS Platform</div>
					</div>
				</div>
				<form onSubmit={submit} className="space-y-4">
					<div className="grid grid-cols-3 gap-2">
						{['student','faculty','admin'].map(r => (
							<button
								key={r}
								type="button"
								onClick={() => setRole(r)}
								className={`btn ${role===r? 'btn-primary' : 'btn-outline'}`}
							>{r[0].toUpperCase()+r.slice(1)}</button>
						))}
					</div>
					<div>
						<label className="block text-sm mb-1 subtle">Email</label>
						<input value={email} onChange={handleEmailChange} required type="email" className="w-full input-dark" placeholder="you@college.edu" />
						{emailError && <div className="text-red-400 text-sm mt-1">{emailError}</div>}
					</div>
					<div>
						<label className="block text-sm mb-1 subtle">Password</label>
						<input value={password} onChange={handlePasswordChange} required type="password" className="w-full input-dark" />
						{passwordError && <div className="text-red-400 text-sm mt-1">{passwordError}</div>}
					</div>
					<div className="flex gap-2">
						<button className="btn btn-primary w-full" type="submit">Login</button>
						<button className="btn btn-outline w-full" type="button">Sign up</button>
					</div>
					<button type="button" className="text-sm text-brand-blue">Forgot Password?</button>
					<div className="text-sm subtle">Faculty/Admin? <a className="text-brand-blue underline" onClick={()=>navigate('/auth')}>Login or Signup here</a></div>
				</form>
			</div>
		</div>
	);
}
