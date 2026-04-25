import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, CartesianGrid } from 'recharts';
import { useEffect, useState } from 'react';
import { useProfile } from '../contexts/ProfileContext.jsx';
import { useNavigate } from 'react-router-dom';
import { useScrollAnimation, useStaggeredAnimation, useLegacyScrollAnimation } from '../hooks/useScrollAnimation.js';

const data = [
	{ name: 'Academic', value: 70 },
	{ name: 'Activities', value: 30 },
];
const COLORS = ['#1e40af', '#047857'];

export function DashboardPage() {
	const { profile } = useProfile();
	const navigate = useNavigate();
	const [countGpa, setCountGpa] = useState(0);
	const [countApproved, setCountApproved] = useState(0);
	const [countPending, setCountPending] = useState(0);
	const [countCoding, setCountCoding] = useState(0);

	// Enhanced scroll animation hooks with directions
	const headerRef = useScrollAnimation({ direction: 'up', delay: 0.1 });
	const chartsRef = useScrollAnimation({ direction: 'up', delay: 0.3 });
	const suggestionsRef = useScrollAnimation({ direction: 'up', delay: 0.4 });
	const eventsRef = useScrollAnimation({ direction: 'up', delay: 0.5 });
	
	// Staggered animations for stats cards
	const { containerRef: statsContainerRef, setItemRef: setStatRef } = useStaggeredAnimation(4, 0.1);
	const attendancePct = 92;
	const contributions = Array.from({ length: 14 }, (_, i) => {
		const day = new Date(Date.now() - (13 - i) * 86400000);
		return { d: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), c: Math.floor(Math.random() * 10) };
	});

	useEffect(() => {
		const animate = (setter, target, duration = 800) => {
			const start = performance.now();
			const step = (t) => {
				const p = Math.min(1, (t - start) / duration);
				setter(Number((target * p).toFixed(1)));
				if (p < 1) requestAnimationFrame(step);
			};
			requestAnimationFrame(step);
		};
		animate(setCountGpa, parseFloat(profile.gpa));
		animate(setCountApproved, (profile.activities?.filter(a => a.status === 'Approved').length) || 24, 700);
		animate(setCountPending, (profile.activities?.filter(a => a.status === 'Pending').length) || 3, 700);
		animate(setCountCoding, profile.codingStats?.problemsSolved || 250, 900);
	}, [profile]);
	const switchRole = (newRole) => {
		localStorage.setItem('role', newRole);
		localStorage.setItem('isAuthenticated', 'true');
		console.log(`Switching to ${newRole} role`);
		
		// Force page reload to ensure proper route change
		if (newRole === 'student') {
			window.location.href = '/student';
		} else if (newRole === 'faculty') {
			window.location.href = '/faculty';
		} else {
			window.location.href = '/admin';
		}
	};

	return (
		<div className="space-y-6">
			<div ref={headerRef} className="flex justify-between items-center gpu-accelerated">
				<h1 className="headline">Dashboard</h1>
				<div className="flex gap-2">
					<button 
						onClick={() => switchRole('faculty')} 
						className="btn btn-outline text-xs px-3 py-1 hover:scale-105 transition-transform"
						title="Switch to Faculty Dashboard"
					>
						👨‍🏫 Faculty
					</button>
					<button 
						onClick={() => switchRole('admin')} 
						className="btn btn-outline text-xs px-3 py-1 hover:scale-105 transition-transform"
						title="Switch to Admin Dashboard"
					>
						👨‍💼 Admin
					</button>
				</div>
			</div>

			<div ref={statsContainerRef} className="grid md:grid-cols-4 gap-4">
				<div ref={setStatRef(0)} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
					<div className="text-sm subtle">GPA</div>
					<div className="text-3xl font-bold" style={{color:'#58A6FF'}}>{countGpa}</div>
					<div className="text-xs subtle">Last semester: 8.5</div>
				</div>
				<div ref={setStatRef(1)} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
					<div className="text-sm subtle">Approved Activities</div>
					<div className="text-3xl font-bold text-green-400">{Math.round(countApproved)}</div>
					<div className="text-xs subtle">+4 in last 30 days</div>
				</div>
				<div ref={setStatRef(2)} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
					<div className="text-sm subtle">Pending</div>
					<div className="text-3xl font-bold text-yellow-300">{Math.round(countPending)}</div>
					<div className="text-xs subtle">Average review time: 2.3 days</div>
				</div>
				<div ref={setStatRef(3)} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
					<div className="text-sm subtle">Coding Problems</div>
					<div className="text-3xl font-bold" style={{color:'#39C5E4'}}>{Math.round(countCoding)}</div>
					<div className="text-xs subtle">+17 this week</div>
				</div>
			</div>

			<div ref={chartsRef} className="grid md:grid-cols-2 gap-4 gpu-accelerated">
				<div className="card p-4 hover:scale-105 transition-transform">
					<div className="font-medium mb-3">Academic vs Activities</div>
					<div className="h-64">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={data}
									dataKey="value"
									nameKey="name"
									innerRadius={55}
									outerRadius={90}
									label={(props) => {
										const { name, percent } = props;
										return `${name} ${((percent || 0) * 100).toFixed(0)}%`;
									}}
								>
									{data.map((_, index) => (
										<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
									))}
								</Pie>
								<Tooltip />
								<Legend />
							</PieChart>
						</ResponsiveContainer>
					</div>
				</div>

				<div className="card p-4 hover:scale-105 transition-transform">
					<div className="font-medium mb-3">Recent Activity</div>
					<table className="w-full text-sm">
						<thead>
							<tr className="text-left text-slate-500">
								<th className="py-2">Title</th>
								<th className="py-2">Category</th>
								<th className="py-2">Status</th>
							</tr>
						</thead>
						<tbody>
							{(profile.activities || [
								{ title: 'Hackathon Winner', category: 'Competitions', status: 'Approved', date: '2025-01-10' },
								{ title: 'NSS Camp', category: 'Volunteering', status: 'Pending', date: '2025-01-08' },
								{ title: 'Robotics Workshop', category: 'Certifications', status: 'Rejected', date: '2025-01-05' },
							]).slice(0, 3).map((r, i) => (
								<tr key={i} className="border-t hover:bg-white/5 transition-colors">
									<td className="py-2">{r.title}</td>
									<td className="py-2">{r.category}</td>
									<td className="py-2">
										<span className={`badge ${r.status==='Approved'?'badge-green': r.status==='Pending'?'badge-yellow':'badge-red'}`}>{r.status}</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div className="grid md:grid-cols-3 gap-4">
				{[
					{ title:'Portfolio', desc:'View and share your verified portfolio', to:'/student/portfolio' },
					{ title:'Coding Profiles', desc:'See your coding stats across platforms', to:'/student/coding' },
					{ title:'Resume Import', desc:'Auto-fill details from your resume', to:'/student/resume' },
				].map(c => (
					<a key={c.title} href={c.to} className="card p-4 block hover:opacity-90">
						<div className="font-semibold">{c.title}</div>
						<div className="text-sm subtle">{c.desc}</div>
					</a>
				))}
			</div>

			<div className="card p-4 fade-in-up" style={{animationDelay:'480ms'}}>
				<div className="font-medium mb-3">📊 Smart Suggestions</div>
				<div className="space-y-3">
					{[
						{ type: 'skill', text: 'Based on your CS profile, consider learning React.js to boost your web development portfolio', priority: 'high' },
						{ type: 'activity', text: 'You have strong coding skills but low community involvement. Try joining technical clubs', priority: 'medium' },
						{ type: 'career', text: 'Your profile matches 85% with Software Engineer roles. Update your resume for better matches', priority: 'high' },
						{ type: 'academic', text: 'Attendance in Software Engineering is 86%. Aim for 90+ to maintain good standing', priority: 'low' }
					].map((suggestion, i) => (
						<div key={i} className="p-3 rounded-md border-l-4" style={{
							background: 'var(--bg-medium)',
							borderLeftColor: suggestion.priority === 'high' ? '#ef4444' : suggestion.priority === 'medium' ? '#f59e0b' : '#10b981'
						}}>
							<div className="text-sm">{suggestion.text}</div>
							<div className="text-xs mt-1" style={{color: suggestion.priority === 'high' ? '#ef4444' : suggestion.priority === 'medium' ? '#f59e0b' : '#10b981'}}>
								{suggestion.priority.toUpperCase()} PRIORITY
							</div>
						</div>
					))}
				</div>
			</div>

			<div className="grid md:grid-cols-2 gap-4">
				<div className="card p-4 fade-in-up" style={{animationDelay:'360ms'}}>
					<div className="font-medium mb-3">Attendance Tracker</div>
					<div className="space-y-3">
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>Overall</span>
								<span>{attendancePct}%</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-green-500" style={{width:`${attendancePct}%`}} />
							</div>
						</div>
						{[
							{ subject: 'Data Structures', attendance: 95 },
							{ subject: 'Computer Networks', attendance: 88 },
							{ subject: 'Database Systems', attendance: 91 },
							{ subject: 'Software Engineering', attendance: 86 },
							{ subject: 'Machine Learning', attendance: 94 }
						].map((subj) => (
							<div key={subj.subject}>
								<div className="flex justify-between text-xs mb-1">
									<span style={{color:'var(--text-secondary)'}}>{subj.subject}</span>
									<span style={{color: subj.attendance >= 90 ? '#10b981' : subj.attendance >= 75 ? '#f59e0b' : '#ef4444'}}>{subj.attendance}%</span>
								</div>
								<div className="w-full bg-slate-700 rounded-full h-1.5">
									<div 
										className="h-1.5 rounded-full" 
										style={{
											width:`${subj.attendance}%`,
											backgroundColor: subj.attendance >= 90 ? '#10b981' : subj.attendance >= 75 ? '#f59e0b' : '#ef4444'
										}} 
									/>
								</div>
							</div>
						))}
					</div>
				</div>
				<div className="card p-4 fade-in-up" style={{animationDelay:'420ms'}}>
					<div className="font-medium mb-3">Daily Contributions (last 14 days)</div>
					<div className="h-56">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={contributions}>
								<CartesianGrid strokeDasharray="3 3" stroke="#283141" />
								<XAxis dataKey="d" stroke="#8B949E" tick={{fontSize:12}}/>
								<Tooltip />
								<Bar dataKey="c" fill="#58A6FF" />
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>

			<div className="grid md:grid-cols-2 gap-4">
				<div className="card p-4 fade-in-up" style={{animationDelay:'540ms'}}>
					<div className="font-medium mb-3">💼 Placements & Internships</div>
					<div className="space-y-3">
						{[
							{ company: 'TCS', role: 'Software Engineer', type: 'Full-time', deadline: '2025-02-15', package: '7.5 LPA' },
							{ company: 'Microsoft', role: 'SDE Intern', type: 'Internship', deadline: '2025-01-30', package: '50k/month' },
							{ company: 'Infosys', role: 'System Engineer', type: 'Full-time', deadline: '2025-02-20', package: '6.5 LPA' },
						].map((job, i) => (
							<div key={i} className="p-3 rounded-md border hover:border-blue-500/30 transition-colors cursor-pointer" style={{background:'var(--bg-medium)', border:'1px solid var(--border-color)'}}>
								<div className="flex justify-between items-start">
									<div>
										<div className="font-medium text-white">{job.company}</div>
										<div className="text-sm text-blue-400">{job.role}</div>
										<div className="text-xs" style={{color:'var(--text-secondary)'}}>Deadline: {job.deadline}</div>
									</div>
									<div className="text-right">
										<div className="text-sm font-medium text-green-400">{job.package}</div>
										<span className={`text-xs px-2 py-1 rounded ${job.type === 'Internship' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
											{job.type}
										</span>
									</div>
								</div>
								<div className="mt-2 flex gap-2">
									<button className="btn btn-primary text-xs px-3 py-1">Apply</button>
									<button className="btn btn-outline text-xs px-3 py-1">Contact T&P</button>
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="card p-4 fade-in-up" style={{animationDelay:'600ms'}}>
					<div className="font-medium mb-3">🎉 Upcoming Events</div>
					<div className="space-y-3">
						{[
							{ event: 'Tech Fest 2025', date: '2025-02-10', time: '9:00 AM', venue: 'Main Auditorium', faculty: 'Dr. Sharma' },
							{ event: 'Coding Competition', date: '2025-01-25', time: '2:00 PM', venue: 'Lab Complex', faculty: 'Prof. Gupta' },
							{ event: 'Industry Workshop', date: '2025-02-05', time: '11:00 AM', venue: 'Seminar Hall', faculty: 'Dr. Patel' },
						].map((event, i) => (
							<div key={i} className="p-3 rounded-md border hover:border-green-500/30 transition-colors cursor-pointer" style={{background:'var(--bg-medium)', border:'1px solid var(--border-color)'}}>
								<div className="font-medium text-white">{event.event}</div>
								<div className="text-sm text-cyan-400 mt-1">{event.date} at {event.time}</div>
								<div className="text-xs" style={{color:'var(--text-secondary)'}}>Venue: {event.venue}</div>
								<div className="text-xs" style={{color:'var(--text-secondary)'}}>Contact: {event.faculty}</div>
								<div className="mt-2 flex gap-2">
									<button className="btn btn-primary text-xs px-3 py-1">Register</button>
									<button className="btn btn-outline text-xs px-3 py-1">Contact Faculty</button>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
