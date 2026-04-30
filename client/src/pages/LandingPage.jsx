import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ChevronDown, LayoutGrid, BarChart2, ArrowRight, Sparkles, Zap, Target, Sun, Moon } from 'lucide-react';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';
import ScrollRevealDemo from '../components/ScrollRevealDemo.jsx';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext.jsx';

export function LandingPage() {
	const [mobileOpen, setMobileOpen] = useState(false);
	const [customersOpen, setCustomersOpen] = useState(false);
	const [scrollProgress, setScrollProgress] = useState(0);
	const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');
	const { user, logout } = useFirebaseAuth();
	
	const role = user?.role || localStorage.getItem('role');
	
	const getDashboardPath = () => {
		if (role) {
			if (role === 'student') return '/student';
			if (role === 'faculty') return '/faculty';
			if (role === 'admin') return '/admin';
		}
		return '/login';
	};

	const handleLogout = async () => {
		await logout();
		window.location.href = '/';
	};

	useEffect(() => {
		const savedTheme = localStorage.getItem('theme');
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		const nextTheme = savedTheme || (prefersDark ? 'dark' : 'light');
		setTheme(nextTheme);
		document.documentElement.setAttribute('data-theme', nextTheme);
	}, []);

	const toggleTheme = () => {
		const nextTheme = theme === 'dark' ? 'light' : 'dark';
		setTheme(nextTheme);
		document.documentElement.setAttribute('data-theme', nextTheme);
		localStorage.setItem('theme', nextTheme);
	};

	// Enhanced scroll animation hooks with directions
	const heroRef = useScrollAnimation({ direction: 'up', delay: 0.1 });
	const featuresRef = useScrollAnimation({ direction: 'up', delay: 0.1 });
	const prototypeRef = useScrollAnimation({ direction: 'up', delay: 0.2 });
	const contactRef = useScrollAnimation({ direction: 'up', delay: 0.1 });
	
	// Staggered animations for feature cards
	const { containerRef: featuresContainerRef, setItemRef: setFeatureRef } = useStaggeredAnimation(3, 0.1);
	const { containerRef: valueStepsContainerRef, setItemRef: setValueStepRef } = useStaggeredAnimation(3, 0.2);

	// Scroll progress tracking
	useEffect(() => {
		const handleScroll = () => {
			const scrollTop = window.scrollY;
			const docHeight = document.documentElement.scrollHeight - window.innerHeight;
			const progress = (scrollTop / docHeight) * 100;
			setScrollProgress(progress);
		};

		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	return (
		<div>
			{/* Scroll Progress Indicator */}
			<div 
				className="scroll-indicator" 
				style={{ transform: `scaleX(${scrollProgress / 100})` }}
			/>
			
			<header className="glass-nav fixed top-4 left-0 right-0 z-50 flex justify-center">
				<div className="max-w-6xl w-full mx-auto px-6 flex justify-between items-center">
					<a href="/" className="text-2xl font-bold flex-shrink-0" style={{color:'var(--primary-blue)'}}>ScholrBoard</a>
					<div className="hidden md:flex items-center header-pill-container rounded-full px-4 py-2 relative gap-4">
						<nav className="flex items-center text-sm space-x-2">
							<a href="#features" className="text-slate-600 hover:text-blue-700 transition-colors px-3 py-1 rounded-full hover:bg-blue-50">Use Cases</a>
							<a href="#prototype" className="text-slate-600 hover:text-blue-700 transition-colors px-3 py-1 rounded-full hover:bg-blue-50">Platform</a>
							<button onClick={()=>setCustomersOpen(v=>!v)} className="text-slate-600 hover:text-blue-700 transition-colors px-3 py-1 flex items-center rounded-full hover:bg-blue-50">Customers <ChevronDown className="w-4 h-4 ml-1" /></button>
							{customersOpen && (
								<div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 surface p-2 text-sm z-20">
									{['Universities','Colleges','Institutes'].map((x)=> (
										<div key={x} className="px-3 py-2 rounded hover:bg-white/10 cursor-pointer" onClick={()=>setCustomersOpen(false)}>{x}</div>
									))}
								</div>
							)}
							<a href="#contact" className="text-slate-600 hover:text-blue-700 transition-colors px-3 py-1 rounded-full hover:bg-blue-50">Contact</a>
						</nav>
						<div className="w-px h-6 mx-1" style={{background:'var(--border-color)'}} />
						{role ? (
							<div className="flex items-center gap-5 pl-1">
								<span className="text-slate-600 text-sm font-medium whitespace-nowrap">
									Logged in as <span className="capitalize text-slate-800">{role}</span>
								</span>
								<button 
									onClick={handleLogout}
									className="text-red-500 hover:text-red-600 transition-colors text-sm font-medium px-3 py-1 rounded hover:bg-red-50"
									title="Logout"
								>
									Logout
								</button>
							</div>
						) : (
							<Link to="/login" className="text-slate-600 hover:text-blue-700 transition-colors text-sm font-medium px-3 py-1">Login</Link>
						)}
					</div>
					<div className="hidden md:flex items-center space-x-3 flex-shrink-0">
						<button
							onClick={toggleTheme}
							className="inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-medium transition-colors hover:bg-orange-50"
							style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
							aria-label="Toggle dark and light theme"
						>
							{theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
							<span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
						</button>
					</div>
					<button className="md:hidden text-slate-800" onClick={()=>setMobileOpen(!mobileOpen)}>☰</button>
				</div>
			</header>

			{mobileOpen && (
				<div className="md:hidden fixed top-0 left-0 right-0 bottom-0 z-40" style={{background:'var(--bg-dark)'}}>
					<div className="pt-20 px-6">
						<a href="#features" className="block py-3 text-lg text-slate-700 hover:text-blue-700" onClick={()=>setMobileOpen(false)}>Use Cases</a>
						<a href="#prototype" className="block py-3 text-lg text-slate-700 hover:text-blue-700" onClick={()=>setMobileOpen(false)}>Platform</a>
						<a href="#" className="block py-3 text-lg text-slate-700 hover:text-blue-700" onClick={()=>setMobileOpen(false)}>Customers</a>
						<a href="#contact" className="block py-3 text-lg text-slate-700 hover:text-blue-700" onClick={()=>setMobileOpen(false)}>Contact</a>
						<div className="my-4" style={{borderTop:'1px solid var(--border-color)'}} />
						<button
							onClick={toggleTheme}
							className="inline-flex items-center gap-2 py-3 text-lg"
							style={{ color: 'var(--text-secondary)' }}
						>
							{theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
							<span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
						</button>
						{role ? (
							<div className="space-y-2">
								<Link 
									to={getDashboardPath()} 
									className="flex items-center gap-2 py-3 text-lg text-blue-700 hover:text-blue-700 transition-colors" 
									onClick={()=>setMobileOpen(false)}
								>
									<LayoutGrid className="w-5 h-5" />
									<span>Dashboard</span>
								</Link>
								<div className="py-3 text-lg text-slate-600">Logged in as {role}</div>
								<button 
									onClick={async () => {
										setMobileOpen(false);
										await handleLogout();
									}}
									className="block py-3 text-lg text-red-400 hover:text-red-300"
								>
									Logout
								</button>
							</div>
						) : (
							<Link to="/login" className="block py-3 text-lg text-slate-700 hover:text-blue-700" onClick={()=>setMobileOpen(false)}>Login</Link>
						)}
					</div>
				</div>
			)}

			<main>
				<section className="relative pt-36 pb-20 overflow-hidden" style={{background:"linear-gradient(180deg, color-mix(in srgb, var(--bg-medium) 94%, transparent), color-mix(in srgb, var(--bg-dark) 82%, transparent))"}}>
					<div className="max-w-6xl mx-auto px-6">
						<div ref={heroRef} className="gpu-accelerated relative" style={{opacity: 1}}>
							<div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium">
								<Sparkles className="w-4 h-4" />
								<span>Academic progress workspace</span>
							</div>
							<h1 className="max-w-4xl text-4xl md:text-5xl lg:text-6xl font-black leading-tight text-slate-900 mb-6">
								Student achievements, coursework, and portfolios in one clear record.
							</h1>
							<p className="text-lg md:text-xl leading-relaxed mb-8 max-w-3xl" style={{color:'var(--text-secondary)'}}>
								ScholrBoard helps students record progress, get faculty verification, and keep a portfolio ready for internships, placements, and higher studies.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-14">
								<Link 
									to={role ? getDashboardPath() : '/login'} 
									className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-lg font-bold text-white transition-all duration-300 hover:-translate-y-0.5 text-base" 
									style={{background:'var(--primary-blue)', boxShadow:'0 12px 24px rgba(var(--primary-rgb), 0.26)'}}
								>
									<LayoutGrid className="w-5 h-5" />
									<span>{role ? 'Open Dashboard' : 'Get Started'}</span>
									<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
								</Link>
								{!role && (
									<a href="#features" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-slate-700 border border-slate-300 hover:border-blue-200 hover:bg-blue-50 transition-all duration-300">
										<span>Learn More</span>
									</a>
								)}
							</div>
							<div ref={valueStepsContainerRef} className="grid md:grid-cols-3 gap-5">
								{[
									{ t:'Capture', d:'Students easily log every achievement, from coursework to club leadership.', icon: <Zap className="w-5 h-5" /> },
									{ t:'Verify', d:'Faculty approve entries with a single click, ensuring institutional credibility.', icon: <Target className="w-5 h-5" /> },
									{ t:'Showcase', d:'Instantly generate a verified digital portfolio for jobs and higher education.', icon: <Sparkles className="w-5 h-5" /> },
								].map((v, index)=> (
									<div key={v.t} ref={setValueStepRef(index)} className="value-step p-5 rounded-lg border border-slate-200 bg-white/80 transition-all duration-300 group">
										<div className="flex items-start gap-4">
											<div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700 flex-shrink-0">
												{v.icon}
											</div>
											<div>
												<h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-700 transition-colors mb-1">{v.t}</h3>
												<p className="text-sm" style={{color:'var(--text-secondary)'}}>{v.d}</p>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</section>

				<section id="features" className="py-24 relative">
					<div className="absolute inset-0" style={{background:'linear-gradient(180deg, transparent, rgba(var(--primary-rgb),0.11), transparent)'}}></div>
					<div className="max-w-6xl mx-auto px-6 text-center relative">
						<div ref={featuresRef} className="gpu-accelerated">
							<div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium">
								<Zap className="w-4 h-4" />
								<span>Powerful Features</span>
							</div>
							<h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
								A Unified Platform for 
								<span className="text-blue-700"> Growth</span>
							</h2>
							<p className="text-lg mx-auto leading-relaxed" style={{color:'var(--text-secondary)', maxWidth:'48rem'}}>
								From institutional reporting to student career readiness, ScholrBoard covers every use case with precision and efficiency.
							</p>
						</div>
						<div ref={featuresContainerRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
							{[
								{ 
									title:'Accreditation & Audits', 
									desc:'Generate comprehensive reports for NAAC, AICTE, and NIRF in minutes, not weeks.', 
									icon:'📊',
									iconBg: 'var(--primary-blue)'
								},
								{ 
									title:'Career-Ready Portfolios', 
									desc:'Empower students with verified, dynamic portfolios that stand out to employers.', 
									icon:'🎯',
									iconBg: 'var(--primary-blue)'
								},
								{ 
									title:'Data-Driven Mentoring', 
									desc:'Provide faculty with a 360° view of student progress for more effective guidance.', 
									icon:'📈',
									iconBg: 'var(--primary-blue)'
								},
							].map((f, index)=> (
								<div 
									key={f.title} 
									ref={setFeatureRef(index)}
									className="feature-card surface rounded-xl p-8 cursor-pointer transform transition-all duration-300 hover:-translate-y-1 group gpu-accelerated"
									style={{
										border: '1px solid var(--border-color)',
										background: 'var(--surface-card)',
										transition: 'all 0.25s ease'
									}}
								>
									<div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl mb-6 group-hover:scale-105 transition-transform duration-300" style={{background:f.iconBg}}>
										{f.icon}
									</div>
									<div className="text-slate-900 font-semibold text-xl mb-3 group-hover:text-blue-700 transition-colors">{f.title}</div>
									<div className="text-sm leading-relaxed mb-4" style={{color:'var(--text-secondary)'}}>{f.desc}</div>
									<div className="mt-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
										<div className="flex items-center gap-2 text-xs font-medium" style={{color:'var(--primary-blue)'}}>
											<span>Click to explore</span>
											<ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

				<section className="py-16">
					<div className="max-w-6xl mx-auto px-6 text-center reveal">
						<h3 className="text-sm font-semibold uppercase tracking-widest" style={{color:'var(--text-secondary)'}}>TRUSTED BY LEADING EDUCATIONAL INSTITUTIONS</h3>
						<div className="flex justify-center items-center gap-12 mt-8 opacity-40 grayscale">
							{['University A','College B','Institute C','Edu Group D'].map((n)=> (
								<div key={n} className="text-sm surface px-4 py-2">{n}</div>
							))}
						</div>
					</div>
				</section>

				<section id="prototype" className="py-16 relative">
					<div className="absolute inset-0" style={{background:'linear-gradient(180deg, transparent, rgba(var(--primary-rgb),0.12), transparent)'}}></div>
					<div className="max-w-6xl mx-auto px-6 text-center relative">
						<div ref={prototypeRef} className="gpu-accelerated">
							<div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-sm font-medium">
								<Target className="w-4 h-4" />
								<span>Student workspace</span>
							</div>
							<h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-5">
								A calmer way to track academic work
							</h3>
							<p className="text-lg mx-auto leading-relaxed mb-10" style={{color:'var(--text-secondary)', maxWidth:'48rem'}}>
								The dashboard keeps daily progress, pending approvals, and portfolio readiness visible without making students dig through scattered records.
							</p>
						</div>
						
						<div className="mockup-container max-w-5xl mx-auto text-left">
							<div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
								<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
									<div className="flex items-center justify-between mb-5">
										<div>
											<div className="text-sm font-semibold text-blue-700">Today</div>
											<div className="text-2xl font-bold text-slate-900">Student Plan</div>
										</div>
										<div className="text-sm px-3 py-1 rounded-full bg-blue-50 text-blue-700">78% ready</div>
									</div>
									<div className="space-y-4">
										{[
											{ time:'09:30', title:'Upload seminar certificate', note:'Add proof for faculty review' },
											{ time:'12:00', title:'Complete coding profile sync', note:'LeetCode and GitHub records' },
											{ time:'04:00', title:'Review portfolio summary', note:'Check skills and project highlights' },
										].map((item)=> (
											<div key={item.title} className="flex gap-4 rounded-lg border border-slate-200 p-4">
												<div className="text-sm font-semibold text-blue-700 w-14">{item.time}</div>
												<div>
													<div className="font-semibold text-slate-900">{item.title}</div>
													<div className="text-sm" style={{color:'var(--text-secondary)'}}>{item.note}</div>
												</div>
											</div>
										))}
									</div>
								</div>
								<div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
									<div className="flex items-center justify-between mb-5">
										<div>
											<div className="text-sm font-semibold text-blue-700">Portfolio</div>
											<div className="text-2xl font-bold text-slate-900">Verification Queue</div>
										</div>
										<BarChart2 className="w-6 h-6 text-blue-700" />
									</div>
									<div className="grid sm:grid-cols-3 gap-3 mb-6">
										{[
											{ n:'12', label:'Verified' },
											{ n:'4', label:'Pending' },
											{ n:'3', label:'To improve' },
										].map((stat)=> (
											<div key={stat.label} className="rounded-lg bg-blue-50 p-4">
												<div className="text-2xl font-bold text-blue-700">{stat.n}</div>
												<div className="text-xs font-medium" style={{color:'var(--text-secondary)'}}>{stat.label}</div>
											</div>
										))}
									</div>
									<div className="space-y-3">
										<div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
											<div>
												<div className="font-semibold text-slate-900">AI in Healthcare Seminar</div>
												<div className="text-sm" style={{color:'var(--text-secondary)'}}>Approved by faculty</div>
											</div>
											<span className="text-sm font-semibold text-blue-700">Verified</span>
										</div>
										<div className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
											<div>
												<div className="font-semibold text-slate-900">Coding Club Leadership</div>
												<div className="text-sm" style={{color:'var(--text-secondary)'}}>Waiting for mentor review</div>
											</div>
											<span className="text-sm font-semibold text-blue-700">Pending</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section id="contact" className="py-20 relative">
					<div className="absolute inset-0" style={{background:'linear-gradient(180deg, transparent, rgba(var(--primary-rgb),0.12), transparent)'}}></div>
					<div className="max-w-6xl mx-auto px-6 text-center relative">
						<div ref={contactRef} className="p-12 rounded-xl gpu-accelerated" style={{background:'linear-gradient(145deg, color-mix(in srgb, var(--bg-medium) 98%, transparent), rgba(var(--primary-rgb), 0.14))', border:'1px solid var(--border-color)', boxShadow:'0 18px 42px rgba(var(--primary-rgb), 0.2)'}}>
							<div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium">
								<Sparkles className="w-4 h-4" />
								<span>Ready to Transform?</span>
							</div>
							<h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
								Get Started with 
								<span className="text-blue-700"> ScholrBoard</span>
							</h2>
							<p className="text-lg mx-auto leading-relaxed mb-10" style={{color:'var(--text-secondary)', maxWidth:'48rem'}}>
								Modernize your institution and empower your students. Schedule a personalized demo today and see the future of education.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center">
								<a href="mailto:demo@scholrboard.com" className="group inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-white transition-all duration-300 hover:-translate-y-0.5" style={{background:'var(--primary-blue)', boxShadow:'0 12px 24px rgba(var(--primary-rgb), 0.26)'}}>
									<span>Request a Demo</span>
									<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
								</a>
								<a href="#features" className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-slate-700 border border-slate-300 hover:border-blue-200 hover:bg-blue-50 transition-all duration-300">
									<span>Learn More</span>
								</a>
							</div>
						</div>
					</div>
				</section>

				{/* Scroll Reveal Demo Section */}
				<section className="py-20">
					<ScrollRevealDemo />
				</section>
			</main>
			<footer className="py-10 mt-12 border-t" style={{borderColor:'var(--border-color)'}}>
				<div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-6 text-sm">
					<div>
						<div className="font-semibold text-slate-900 mb-2">About Us</div>
						<p style={{color:'var(--text-secondary)'}}>
							ScholrBoard builds modern academic platforms to empower students and institutions.
						</p>
					</div>
					<div>
						<div className="font-semibold text-slate-900 mb-2">Platform</div>
						<ul className="space-y-1" style={{color:'var(--text-secondary)'}}>
							<li>Student Profiles</li>
							<li>Faculty Verification</li>
							<li>Institution Analytics</li>
						</ul>
					</div>
					<div>
						<div className="font-semibold text-slate-900 mb-2">Made For</div>
						<div>ScholrBoard Institutions</div>
					</div>
				</div>
				<div className="max-w-6xl mx-auto px-6 text-center mt-8" style={{color:'var(--text-secondary)'}}>
					<span>© {new Date().getFullYear()} All rights reserved.</span>
				</div>
			</footer>
		</div>
	);
}
