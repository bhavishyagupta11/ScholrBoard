import { Bell, Search, User2, RefreshCw, X, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';

export function Topbar() {
	const navigate = useNavigate();
	const role = localStorage.getItem('role');
	const profilePath = role === 'student' ? '/student/profile' : '/login';
	const [open, setOpen] = useState(false);
	const [q, setQ] = useState('');
	const [showSearch, setShowSearch] = useState(false);
	const [showProfileMenu, setShowProfileMenu] = useState(false);
	const getNotifications = () => {
		switch(role) {
			case 'student':
				return [
					{ id: 1, t: 'Activity approved: Hackathon Winner', time: '2h ago' },
					{ id: 2, t: 'New assignment posted: Data Structures', time: '4h ago' },
					{ id: 3, t: 'Contest rating updated on LeetCode', time: '1d ago' },
					{ id: 4, t: 'Project deadline reminder: AI Chatbot', time: '2d ago' },
					{ id: 5, t: 'Portfolio view: 12 new views today', time: '3d ago' },
				];
			case 'faculty':
				return [
					{ id: 1, t: 'New activity submission: Ananya Sharma', time: '30m ago' },
					{ id: 2, t: 'Assignment graded: Data Structures Lab', time: '1h ago' },
					{ id: 3, t: 'Student query: Rohan Gupta - Project guidance', time: '2h ago' },
					{ id: 4, t: 'Class attendance alert: 3 students below 75%', time: '4h ago' },
					{ id: 5, t: 'Faculty meeting reminder: Tomorrow 10 AM', time: '1d ago' },
				];
			case 'admin':
				return [
					{ id: 1, t: 'System backup completed successfully', time: '1h ago' },
					{ id: 2, t: 'New placement opportunity: TCS Software Engineer', time: '2h ago' },
					{ id: 3, t: 'Event registration: Tech Fest 2025 - 156 students', time: '3h ago' },
					{ id: 4, t: 'NAAC report generated and ready for download', time: '4h ago' },
					{ id: 5, t: 'Faculty performance review due next week', time: '2d ago' },
				];
			default:
				return [
					{ id: 1, t: 'Welcome to CODEVENGERS', time: 'Just now' },
				];
		}
	};

	const notifications = getNotifications();

	const handleLogout = () => {
		localStorage.removeItem('role');
		localStorage.removeItem('isAuthenticated');
		setShowProfileMenu(false);
		navigate('/');
	};

	const cycleRole = () => {
		const next = role === 'student' ? 'faculty' : role === 'faculty' ? 'admin' : 'student';
		localStorage.setItem('role', next);
		navigate(next === 'student' ? '/student' : '/verify');
	};

	useEffect(() => {
		const onKey = (e) => {
			if (e.key === '/' && !showSearch) {
				e.preventDefault();
				setShowSearch(true);
			} else if (e.key === 'Escape') {
				setShowSearch(false);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [showSearch]);

	const suggestions = useMemo(() => {
		const common = [
			{ label: 'Homepage', path: '/landing' },
		];
		if (role === 'student') {
			return [
				...common,
				{ label: 'Dashboard', path: '/student/dashboard' },
				{ label: 'My Activities', path: '/student/activities' },
				{ label: 'Upload Activity', path: '/student/upload' },
				{ label: 'Portfolio', path: '/student/portfolio' },
				{ label: 'Coding Profiles', path: '/student/coding' },
				{ label: 'Resume Import', path: '/student/resume' },
				{ label: 'Profile', path: '/student/profile' },
			];
		}
		if (role === 'faculty') {
			return [
				...common,
				{ label: 'Dashboard', path: '/faculty' },
				{ label: 'Activity Approvals', path: '/faculty/approvals' },
				{ label: 'Student Tracker', path: '/faculty/students' },
				{ label: 'Student 360°', path: '/faculty/mentor' },
			];
		}
		if (role === 'admin') {
			return [
				...common,
				{ label: 'Dashboard', path: '/admin' },
				{ label: 'Activity Approvals', path: '/admin/approvals' },
				{ label: 'Analytics & Reports', path: '/admin/analytics' },
				{ label: 'Placements & Jobs', path: '/admin/placements' },
				{ label: 'Events & Activities', path: '/admin/events' },
			];
		}
		return [...common, { label: 'Login', path: '/login' }];
	}, [role]);

	const filtered = useMemo(() => {
		if (!q) return suggestions;
		return suggestions.filter(s => s.label.toLowerCase().includes(q.toLowerCase()));
	}, [q, suggestions]);
	return (
		<header className="sticky top-0 z-10 border-b border-[var(--border-color)] bg-[rgba(22,27,34,0.6)] backdrop-blur">
			<div className="px-4 py-3 flex items-center gap-4">
				<div className="hidden md:block text-sm flex items-center h-10" style={{color:'var(--text-secondary)'}}>Logged in as <span className="font-medium capitalize ml-1" style={{color:'var(--color-brand-light)'}}>{role}</span></div>
				<div className="flex-1 max-w-xl relative">
					<div className="relative flex items-center bg-gray-800 rounded-lg border border-gray-600">
						<div className="flex items-center justify-center w-10 h-10">
							<Search size={18} color="#8B949E" />
						</div>
						<input
							className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none"
							value={q}
							onChange={e=>{ setQ(e.target.value); setShowSearch(true); }}
							onFocus={()=>setShowSearch(true)}
							onKeyDown={(e)=>{ if (e.key==='Enter' && filtered[0]) { navigate(filtered[0].path); setShowSearch(false); } }}
							placeholder="Search (press / to focus)..."
						/>
					</div>
					{showSearch && (
						<div className="absolute mt-2 w-full surface p-2 z-20">
							{filtered.length === 0 ? (
								<div className="text-sm subtle px-2 py-1">No results</div>
							) : (
								filtered.slice(0,7).map((s) => (
									<button key={s.path} className="w-full text-left px-2 py-2 rounded hover:bg-white/10 text-sm" onClick={()=>{ navigate(s.path); setShowSearch(false); }}>
										{s.label}
									</button>
								))
							)}
						</div>
					)}
				</div>
				<div className="relative">
					<button className="btn btn-outline relative h-12 w-12 flex items-center justify-center" title="Notifications" onClick={()=>setOpen(v=>!v)}>
						<Bell size={22} color="#E6EDF3" />
						<span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full text-[10px] bg-red-500 text-white grid place-items-center">{notifications.length}</span>
					</button>
					{open && (
						<div className="absolute right-0 mt-2 w-80 surface p-3 z-20">
							<div className="flex items-center justify-between mb-2">
								<div className="font-medium">Notifications</div>
								<button onClick={()=>setOpen(false)} className="text-xs" style={{color:'var(--text-secondary)'}}><X size={14}/></button>
							</div>
							<div className="space-y-2 max-h-64 overflow-auto">
								{notifications.map(n => (
									<div key={n.id} className="p-2 rounded-md cursor-pointer hover:bg-white/5 transition-colors" style={{background:'var(--bg-medium)', border:'1px solid var(--border-color)'}}>
										<div className="text-sm">{n.t}</div>
										<div className="text-[11px]" style={{color:'var(--text-secondary)'}}>{n.time}</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
				<button className="btn btn-outline h-12 w-12 flex items-center justify-center" title="Switch role (demo)" onClick={cycleRole}><RefreshCw size={22} color="#E6EDF3" /></button>
				
				<div className="relative">
					<button 
						className="h-10 w-10 rounded-full grid place-items-center" 
						style={{backgroundColor:'rgba(88,166,255,0.12)', color:'#58A6FF'}} 
						title="Profile" 
						onClick={() => setShowProfileMenu(v => !v)}
					>
						<User2 size={18} />
					</button>
					{showProfileMenu && (
						<div className="absolute right-0 mt-2 w-48 surface p-2 z-20">
							<div className="p-2 border-b border-gray-600 mb-2">
								<div className="text-sm" style={{color:'var(--text-primary)'}}>Signed in as</div>
								<div className="text-xs" style={{color:'var(--text-secondary)'}}>{(role || 'USER').toUpperCase()}</div>
							</div>
							{role === 'student' && (
								<button 
									onClick={() => { 
										navigate(profilePath); 
										setShowProfileMenu(false); 
									}}
									className="w-full text-left p-2 rounded-md hover:bg-white/10 text-sm flex items-center gap-2"
								>
									<User2 size={14} />
									View Profile
								</button>
							)}
							{(role === 'faculty' || role === 'admin') && (
								<div className="p-2 text-xs" style={{color:'var(--text-secondary)'}}>
									{role === 'faculty' ? 'Faculty Dashboard Active' : 'Admin Dashboard Active'}
								</div>
							)}
							<button 
								onClick={handleLogout}
								className="w-full text-left p-2 rounded-md hover:bg-white/10 text-sm flex items-center gap-2 text-red-400"
							>
								<LogOut size={14} />
								Logout
							</button>
						</div>
					)}
				</div>
			</div>
		</header>
	);
}
