import { Bell, Search, User2, X, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import notificationsApi from '../api/notifications.api.js';

export function Topbar() {
	const navigate = useNavigate();
	const { user, logout } = useAuth();
	const role = user?.role || localStorage.getItem('role');
	const profilePath = role === 'student' ? '/student/profile' : '/login';
	const [open, setOpen] = useState(false);
	const [q, setQ] = useState('');
	const [showSearch, setShowSearch] = useState(false);
	const [showProfileMenu, setShowProfileMenu] = useState(false);
	const [notifications, setNotifications] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [notificationError, setNotificationError] = useState(null);

	useEffect(() => {
		if (!user?._id) {
			setNotifications([]);
			setUnreadCount(0);
			return;
		}

		let cancelled = false;
		notificationsApi.getAll(false, 1)
			.then((res) => {
				if (cancelled) return;
				setNotifications(res.notifications || []);
				setUnreadCount(res.unreadCount || 0);
			})
			.catch((err) => {
				if (cancelled) return;
				setNotifications([]);
				setUnreadCount(0);
				setNotificationError(err.message || 'Failed to load notifications');
			});

		return () => {
			cancelled = true;
		};
	}, [user?._id]);

	const handleLogout = async () => {
		await logout();
		setShowProfileMenu(false);
		navigate('/', { replace: true });
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
		<header className="topbar-shell sticky top-0 z-10 border-b border-[var(--border-color)]">
			<div className="px-4 md:px-6 h-16 flex items-center gap-4">
				<div className="hidden md:block min-w-[170px]">
					<div className="text-[11px] font-semibold uppercase tracking-wide" style={{color:'var(--text-secondary)'}}>
						Workspace
					</div>
					<div className="text-sm font-semibold capitalize" style={{color:'var(--text-primary)'}}>{role || 'Guest'}</div>
				</div>
				<div className="flex-1 max-w-2xl relative">
					<div className="relative flex items-center rounded-lg border shadow-sm" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-color)' }}>
						<div className="flex items-center justify-center w-10 h-10">
							<Search size={18} color="var(--text-secondary)" />
						</div>
						<input
							className="topbar-search-input flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
							style={{ color: 'var(--text-primary)' }}
							value={q}
							onChange={e=>{ setQ(e.target.value); setShowSearch(true); }}
							onFocus={()=>setShowSearch(true)}
							onKeyDown={(e)=>{ if (e.key==='Enter' && filtered[0]) { navigate(filtered[0].path); setShowSearch(false); } }}
							placeholder="Search pages and tools"
						/>
						<div className="hidden pr-3 text-[11px] font-semibold md:block" style={{color:'var(--text-secondary)'}}>/</div>
					</div>
					{showSearch && (
						<div className="absolute mt-2 w-full surface p-2 z-20 shadow-lg">
							{filtered.length === 0 ? (
								<div className="text-sm subtle px-2 py-1">No results</div>
							) : (
								filtered.slice(0,7).map((s) => (
									<button key={s.path} className="w-full text-left px-3 py-2 rounded-md text-sm nav-item-muted" onClick={()=>{ navigate(s.path); setShowSearch(false); }}>
										{s.label}
									</button>
								))
							)}
						</div>
					)}
				</div>
				<div className="relative">
					<button className="btn btn-outline relative h-10 w-10 px-0" title="Notifications" onClick={()=>setOpen(v=>!v)}>
						<Bell size={20} color="var(--text-primary)" />
						{unreadCount > 0 && (
							<span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full text-[10px] bg-red-500 text-white grid place-items-center">{unreadCount}</span>
						)}
					</button>
					{open && (
						<div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] surface p-3 z-20 shadow-lg">
							<div className="flex items-center justify-between mb-2">
								<div className="font-medium">Notifications</div>
								<div className="flex gap-2 items-center">
									{unreadCount > 0 && (
										<button
											onClick={async () => {
												await notificationsApi.markAllRead().catch((err) => setNotificationError(err.message || 'Failed to mark notifications read'));
												setUnreadCount(0);
												setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
											}}
											className="text-[10px] text-blue-400 hover:underline"
										>
											Mark all read
										</button>
									)}
									<button onClick={()=>setOpen(false)} className="text-xs" style={{color:'var(--text-secondary)'}}><X size={14}/></button>
								</div>
							</div>
							<div className="space-y-2 max-h-64 overflow-auto">
								{notificationError && <div className="text-xs text-red-400 px-2 py-1">{notificationError}</div>}
								{notifications.length === 0 ? (
									<div className="text-sm subtle px-2 py-3">No notifications yet</div>
								) : notifications.map(n => (
									<button
										key={n._id}
										className="w-full text-left p-3 rounded-md cursor-pointer transition-colors nav-item-muted"
										style={{background:'var(--bg-medium)', border:'1px solid var(--border-color)'}}
										onClick={async () => {
											if (!n.isRead) {
												await notificationsApi.markRead(n._id).catch((err) => setNotificationError(err.message || 'Failed to mark notification read'));
												setUnreadCount((count) => Math.max(0, count - 1));
											}
											if (n.actionUrl) navigate(n.actionUrl);
											setOpen(false);
										}}
									>
										<div className="text-sm font-medium">{n.title}</div>
										<div className="text-xs mt-1">{n.message}</div>
										<div className="text-[11px] mt-1" style={{color:'var(--text-secondary)'}}>{new Date(n.createdAt).toLocaleString()}</div>
									</button>
								))}
							</div>
						</div>
					)}
				</div>
				<div className="relative">
					<button 
						className="h-10 w-10 rounded-full grid place-items-center" 
						style={{backgroundColor:'var(--accent-soft)', color:'var(--primary-blue)', border: '1px solid rgba(var(--primary-rgb), 0.35)'}} 
						title="Profile" 
						onClick={() => setShowProfileMenu(v => !v)}
					>
						<User2 size={18} />
					</button>
					{showProfileMenu && (
						<div className="absolute right-0 mt-2 w-48 surface p-2 z-20 shadow-lg">
							<div className="p-2 border-b mb-2" style={{borderColor:'var(--border-color)'}}>
								<div className="text-sm" style={{color:'var(--text-primary)'}}>Signed in as</div>
								<div className="text-xs" style={{color:'var(--text-secondary)'}}>{(role || 'USER').toUpperCase()}</div>
							</div>
							{role === 'student' && (
								<button 
									onClick={() => { 
										navigate(profilePath); 
										setShowProfileMenu(false); 
									}}
									className="w-full text-left p-2 rounded-md text-sm flex items-center gap-2 nav-item-muted"
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
								className="w-full text-left p-2 rounded-md text-sm flex items-center gap-2 text-red-400 hover:bg-red-500/10"
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
