import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ChevronDown, LayoutGrid, User, BarChart2, ArrowRight, Sparkles, Zap, Target } from 'lucide-react';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';
import ScrollRevealDemo from '../components/ScrollRevealDemo.jsx';

export function LandingPage() {
	const [mobileOpen, setMobileOpen] = useState(false);
	const [customersOpen, setCustomersOpen] = useState(false);
	const [scrollProgress, setScrollProgress] = useState(0);
	
	const role = localStorage.getItem('role');
	const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
	
	const getDashboardPath = () => {
		if (role) {
			if (role === 'student') return '/student';
			if (role === 'faculty') return '/faculty';
			if (role === 'admin') return '/admin';
		}
		return '/login';
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
					<a href="/" className="text-2xl font-bold text-white flex-shrink-0"><span style={{color:'#58A6FF'}}>CODE</span><span style={{color:'#39C5E4'}}>VENGERS</span></a>
					<div className="hidden md:flex items-center header-pill-container rounded-full px-4 py-2 relative">
						<nav className="flex items-center text-sm space-x-2">
							<a href="#features" className="text-gray-300 hover:text-white transition-colors px-3 py-1 rounded-full hover:bg:white/10">Use Cases</a>
							<a href="#prototype" className="text-gray-300 hover:text:white transition-colors px-3 py-1 rounded-full hover:bg-white/10">Platform</a>
							<button onClick={()=>setCustomersOpen(v=>!v)} className="text-gray-300 hover:text-white transition-colors px-3 py-1 flex items-center rounded-full hover:bg-white/10">Customers <ChevronDown className="w-4 h-4 ml-1" /></button>
							{customersOpen && (
								<div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 surface p-2 text-sm z-20">
									{['Universities','Colleges','Institutes'].map((x)=> (
										<div key={x} className="px-3 py-2 rounded hover:bg-white/10 cursor-pointer" onClick={()=>setCustomersOpen(false)}>{x}</div>
									))}
								</div>
							)}
							<a href="#contact" className="text-gray-300 hover:text-white transition-colors px-3 py-1 rounded-full hover:bg-white/10">Contact</a>
						</nav>
						<div className="w-px h-5" style={{background:'var(--border-color)'}} />
						{role ? (
							<div className="flex items:center gap-3">
								<span className="text-gray-300 text-sm font-medium">Logged in as {role}</span>
								<button 
									onClick={() => {
										localStorage.removeItem('role');
										localStorage.removeItem('isAuthenticated');
										localStorage.removeItem('studentProfile');
										window.location.reload();
									}}
									className="text-red-400 hover:text-red-300 transition-colors text-sm font-medium px-3 py-1 rounded hover:bg-red-500/10"
									title="Logout"
								>
									Logout
								</button>
							</div>
						) : (
							<Link to="/login" className="text-gray-300 hover:text-white transition-colors text-sm font-medium px-3 py-1">Login</Link>
						)}
					</div>
					<div className="hidden md:flex items-center space-x-4 flex-shrink-0" />
					<button className="md:hidden text-white" onClick={()=>setMobileOpen(!mobileOpen)}>☰</button>
				</div>
			</header>

			{mobileOpen && (
				<div className="md:hidden fixed top-0 left-0 right-0 bottom-0 z-40" style={{background:'var(--bg-dark)'}}>
					<div className="pt-20 px-6">
						<a href="#features" className="block py-3 text-lg text-gray-300 hover:text-white" onClick={()=>setMobileOpen(false)}>Use Cases</a>
						<a href="#prototype" className="block py-3 text-lg text-gray-300 hover:text-white" onClick={()=>setMobileOpen(false)}>Platform</a>
						<a href="#" className="block py-3 text-lg text-gray-300 hover:text-white" onClick={()=>setMobileOpen(false)}>Customers</a>
						<a href="#contact" className="block py-3 text-lg text-gray-300 hover:text-white" onClick={()=>setMobileOpen(false)}>Contact</a>
						<div className="my-4" style={{borderTop:'1px solid var(--border-color)'}} />
						{role ? (
							<div className="space-y-2">
								<Link 
									to={getDashboardPath()} 
									className="flex items-center gap-2 py-3 text-lg text-white hover:text-blue-300 transition-colors" 
									onClick={()=>setMobileOpen(false)}
								>
									<LayoutGrid className="w-5 h-5" />
									<span>Dashboard</span>
								</Link>
								<div className="py-3 text-lg text-gray-300">Logged in as {role}</div>
								<button 
									onClick={() => {
										localStorage.removeItem('role');
										localStorage.removeItem('isAuthenticated');
										localStorage.removeItem('studentProfile');
										setMobileOpen(false);
										window.location.reload();
									}}
									className="block py-3 text-lg text-red-400 hover:text-red-300"
								>
									Logout
								</button>
							</div>
						) : (
							<Link to="/login" className="block py-3 text-lg text-gray-300 hover:text-white" onClick={()=>setMobileOpen(false)}>Login</Link>
						)}
					</div>
				</div>
			)}

			<main>
				<section className="relative pt-40 pb-24 overflow-hidden" style={{background:"radial-gradient(circle at 5% 15%, rgba(88, 166, 255, 0.1), transparent 35%), radial-gradient(circle at 95% 85%, rgba(57, 197, 228, 0.1), transparent 35%)"}}>
					<div className="max-w-6xl mx-auto px-6">
						<div ref={heroRef} className="text-center gpu-accelerated relative" style={{opacity: 1}}>
							<div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium">
								<Sparkles className="w-4 h-4" />
								<span>Revolutionary Student Platform</span>
							</div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight text-white mb-6">
                360 Degree Platform for Student 
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"> Achievement</span>.
            </h1>
							<p className="text-lg md:text-xl leading-relaxed mb-8 mx-auto max-w-4xl" style={{color:'var(--text-secondary)'}}>
								Transform scattered data into verified portfolios of success. From Day 1 to graduation, CODEVENGERS is the command center for every student's journey.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
								<Link 
									to={role ? getDashboardPath() : '/login'} 
									className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white transition-all duration-300 hover:scale-105 text-lg" 
									style={{background:'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow:'0 8px 25px rgba(37, 99, 235, 0.3)'}}
								>
									<LayoutGrid className="w-6 h-6" />
									<span>{role ? 'Open Dashboard' : 'Get Started'}</span>
									<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
								</Link>
								{!role && (
									<a href="#features" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white border border-gray-500 hover:border-gray-400 hover:bg-gray-700/20 transition-all duration-300">
										<span>Learn More</span>
									</a>
								)}
							</div>
							<div ref={valueStepsContainerRef} className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
								{[
									{ t:'Capture', d:'Students easily log every achievement, from coursework to club leadership.', icon: <Zap className="w-5 h-5" /> },
									{ t:'Verify', d:'Faculty approve entries with a single click, ensuring institutional credibility.', icon: <Target className="w-5 h-5" /> },
									{ t:'Showcase', d:'Instantly generate a verified digital portfolio for jobs and higher education.', icon: <Sparkles className="w-5 h-5" /> },
								].map((v, index)=> (
									<div key={v.t} ref={setValueStepRef(index)} className="value-step p-6 rounded-lg hover:bg-white/5 transition-all duration-300 group text-center">
										<div className="flex flex-col items-center gap-4">
											<div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
												{v.icon}
											</div>
											<div>
												<h3 className="font-bold text-white text-xl group-hover:text-blue-300 transition-colors mb-2">{v.t}</h3>
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
					<div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent"></div>
					<div className="max-w-6xl mx-auto px-6 text-center relative">
						<div ref={featuresRef} className="gpu-accelerated">
							<div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm font-medium">
								<Zap className="w-4 h-4" />
								<span>Powerful Features</span>
							</div>
							<h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
								A Unified Platform for 
								<span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent"> Growth</span>
							</h2>
							<p className="text-lg mx-auto leading-relaxed" style={{color:'var(--text-secondary)', maxWidth:'48rem'}}>
								From institutional reporting to student career readiness, CODEVENGERS covers every use case with precision and efficiency.
							</p>
						</div>
						<div ref={featuresContainerRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
							{[
								{ 
									title:'Accreditation & Audits', 
									desc:'Generate comprehensive reports for NAAC, AICTE, and NIRF in minutes, not weeks.', 
									icon:'📊',
									gradient: 'from-blue-500 to-cyan-500',
									hoverGradient: 'from-blue-400 to-cyan-400'
								},
								{ 
									title:'Career-Ready Portfolios', 
									desc:'Empower students with verified, dynamic portfolios that stand out to employers.', 
									icon:'🎯',
									gradient: 'from-cyan-500 to-green-500',
									hoverGradient: 'from-cyan-400 to-green-400'
								},
								{ 
									title:'Data-Driven Mentoring', 
									desc:'Provide faculty with a 360° view of student progress for more effective guidance.', 
									icon:'📈',
									gradient: 'from-green-500 to-blue-500',
									hoverGradient: 'from-green-400 to-blue-400'
								},
							].map((f, index)=> (
								<div 
									key={f.title} 
									ref={setFeatureRef(index)}
									className="feature-card surface rounded-xl p-8 cursor-pointer transform transition-all duration-500 hover:scale-105 hover:shadow-2xl group gpu-accelerated"
									onClick={() => {
										console.log(`Clicked on ${f.title}`);
									}}
									style={{
										border: '1px solid var(--border-color)',
										background: 'linear-gradient(145deg, var(--bg-medium), #12161c)',
										transition: 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.borderColor = 'rgba(88, 166, 255, 0.5)';
										e.currentTarget.style.background = 'linear-gradient(145deg, rgba(88, 166, 255, 0.05), rgba(57, 197, 228, 0.05))';
										e.currentTarget.style.boxShadow = '0 20px 40px rgba(88, 166, 255, 0.1)';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.borderColor = 'var(--border-color)';
										e.currentTarget.style.background = 'linear-gradient(145deg, var(--bg-medium), #12161c)';
										e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
									}}
								>
									<div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
										{f.icon}
									</div>
									<div className="text-white font-semibold text-xl mb-3 group-hover:text-blue-300 transition-colors">{f.title}</div>
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
					<div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent"></div>
					<div className="max-w-6xl mx-auto px-6 text-center relative">
						<div ref={prototypeRef} className="gpu-accelerated">
							<div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 text-sm font-medium">
								<Target className="w-4 h-4" />
								<span>Interactive Demo</span>
							</div>
							<h3 className="text-3xl md:text-4xl font-bold text-white mb-6">
								Explore the 
								<span className="bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent"> Platform</span>
							</h3>
							<p className="text-lg mx-auto leading-relaxed" style={{color:'var(--text-secondary)', maxWidth:'48rem'}}>
								An intuitive interface designed for efficiency and engagement. Experience the future of student achievement tracking.
							</p>
						</div>
						
						<div className="mockup-container rounded-xl p-8 max-w-4xl mx-auto" style={{background:'var(--bg-medium)', border:'1px solid var(--border-color)'}}>
							<div className="flex items-center justify-between mb-6">
								<div className="text-2xl font-bold text-white">Welcome Back, Alex!</div>
								<div className="flex items-center space-x-2">
									<div className="w-3 h-3 rounded-full bg-red-500" />
									<div className="w-3 h-3 rounded-full bg-yellow-500" />
									<div className="w-3 h-3 rounded-full bg-green-500" />
								</div>
							</div>
							
							<div className="grid md:grid-cols-3 gap-6">
								<div className="md:col-span-1">
									<div className="text-left space-y-3">
										<div className="surface p-4 rounded-lg">
											<LayoutGrid className="inline w-5 h-5 mr-2" style={{color:'var(--primary-blue)'}}/>
											<span className="text-white font-medium">Dashboard</span>
										</div>
										<div className="surface p-4 rounded-lg">
											<User className="inline w-5 h-5 mr-2" style={{color:'var(--primary-cyan)'}}/>
											<span className="text-white font-medium">Portfolio</span>
										</div>
										<div className="surface p-4 rounded-lg">
											<BarChart2 className="inline w-5 h-5 mr-2" style={{color:'var(--text-secondary)'}}/>
											<span className="text-white font-medium">Analytics</span>
										</div>
									</div>
								</div>
								
								<div className="md:col-span-2">
									<div className="text-left space-y-4">
										<div className="flex justify-between items-center">
											<div className="text-white font-semibold">Profile Completion</div>
											<div className="text-sm" style={{color:'var(--text-secondary)'}}>78%</div>
										</div>
										<div className="w-full rounded-full h-2" style={{background:'var(--bg-dark)'}}>
											<div className="h-2 rounded-full" style={{background:'var(--primary-blue)', width:'78%'}} />
										</div>
										<div className="text-sm" style={{color:'var(--text-secondary)'}}>You're almost there! Add your latest information.</div>
										
										<div className="mt-6">
											<div className="text-white font-semibold mb-3">Recent Activity</div>
											<div className="space-y-2">
												<div className="p-3 rounded-md" style={{background:'var(--bg-dark)'}}>
													<span className="text-green-400 font-semibold">Approved:</span> "AI in Healthcare" Seminar Certificate.
												</div>
												<div className="p-3 rounded-md" style={{background:'var(--bg-dark)'}}>
													<span className="text-yellow-400 font-semibold">Pending:</span> Leadership role, Coding Club.
												</div>
											</div>
										</div>
										
										<div className="mt-6">
											<div className="text-white font-semibold mb-3">Achievements Overview</div>
											<div className="grid grid-cols-4 gap-4 text-center">
												<div>
													<div className="text-2xl font-bold" style={{color:'var(--primary-blue)'}}>12</div>
													<div className="text-xs" style={{color:'var(--text-secondary)'}}>Academics</div>
												</div>
												<div>
													<div className="text-2xl font-bold" style={{color:'var(--primary-cyan)'}}>8</div>
													<div className="text-xs" style={{color:'var(--text-secondary)'}}>Tech Skills</div>
												</div>
												<div>
													<div className="text-2xl font-bold" style={{color:'var(--primary-green)'}}>5</div>
													<div className="text-xs" style={{color:'var(--text-secondary)'}}>Leadership</div>
												</div>
												<div>
													<div className="text-2xl font-bold" style={{color:'var(--color-brand-light)'}}>3</div>
													<div className="text-xs" style={{color:'var(--text-secondary)'}}>Community</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section id="contact" className="py-20 relative">
					<div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/5 to-transparent"></div>
					<div className="max-w-6xl mx-auto px-6 text-center relative">
						<div ref={contactRef} className="p-12 rounded-xl gpu-accelerated" style={{background:'linear-gradient(145deg, var(--bg-medium), #12161c)', border:'1px solid var(--border-color)', boxShadow:'0 20px 40px rgba(0,0,0,0.3)'}}>
							<div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium">
								<Sparkles className="w-4 h-4" />
								<span>Ready to Transform?</span>
							</div>
							<h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
								Get Started with 
								<span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"> CODEVENGERS</span>
							</h2>
							<p className="text-lg mx-auto leading-relaxed mb-10" style={{color:'var(--text-secondary)', maxWidth:'48rem'}}>
								Modernize your institution and empower your students. Schedule a personalized demo today and see the future of education.
							</p>
							<div className="flex flex-col sm:flex-row gap-4 justify-center">
								<a href="mailto:demo@codevengers.com" className="group inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-white transition-all duration-300 hover:scale-105" style={{background:'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow:'0 8px 25px rgba(37, 99, 235, 0.3)'}}>
									<span>Request a Demo</span>
									<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
								</a>
								<a href="#features" className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-white border border-gray-600 hover:border-blue-400 hover:bg-blue-500/10 transition-all duration-300">
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
						<div className="font-semibold text-white mb-2">About Us</div>
						<p style={{color:'var(--text-secondary)'}}>
							CODEVENGERS builds modern academic platforms to empower students and institutions.
						</p>
					</div>
					<div>
						<div className="font-semibold text-white mb-2">Team Members</div>
						<ul className="space-y-1" style={{color:'var(--text-secondary)'}}>
							<li>Bhavishya Gupta</li>
							<li>Vipul Agarwal</li>
							<li>Kushal Agarwal</li>
							<li>Snehil Khokhar</li>
							<li>Puru Gupta</li>
							<li>Shagun</li>
						</ul>
					</div>
					<div>
						<div className="font-semibold text-white mb-2">Made By</div>
						<div>CODEVENGERS</div>
					</div>
				</div>
				<div className="max-w-6xl mx-auto px-6 text-center mt-8" style={{color:'var(--text-secondary)'}}>
					<span>© {new Date().getFullYear()} All rights reserved.</span>
				</div>
			</footer>
		</div>
	);
}
