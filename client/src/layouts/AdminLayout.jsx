import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, BarChart3, LogOut, Calendar, Briefcase, Megaphone, Search } from 'lucide-react';
import { Topbar } from '../components/Topbar.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export function AdminLayout() {
	const navigate = useNavigate();
	const { logout } = useAuth();
	const handleLogout = async () => { 
		await logout();
		navigate('/', { replace: true }); 
	};

	const navLinkClass = ({ isActive }) =>
		`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
			isActive 
				? 'nav-item-active' 
				: 'nav-item-muted hover:bg-blue-50'
		}`;

	return (
		<div className="app-shell md:grid md:grid-cols-[280px_1fr]">
			{/* Sidebar */}
			<aside className="sidebar-panel p-6 md:min-h-screen md:border-r">
				<div className="mb-8 flex items-center gap-2.5">
					<a href="/" className="flex items-center gap-2.5">
						<img src="/assets/logo.png" alt="ScholrBoard Logo" className="w-8 h-8 object-contain" />
						<div className="flex flex-col">
							<span className="text-lg font-extrabold tracking-tight leading-none" style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em' }}>
								<span style={{ color: 'var(--accent)' }}>Scholr</span>
								<span style={{ color: 'var(--text-primary)' }}>Board</span>
							</span>
							<div className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mt-1">Admin Portal</div>
						</div>
					</a>
				</div>

				<nav className="flex flex-col space-y-2">
					<NavLink to="/admin" end className={navLinkClass}>
						<BarChart3 size={20} className="flex-shrink-0"/> Dashboard
					</NavLink>
					
					<NavLink to="/admin/approvals" className={navLinkClass}>
						<ClipboardList size={20}/> Activity Approvals
					</NavLink>

					<NavLink to="/admin/talent-discovery" className={navLinkClass}>
						<Search size={20} className="flex-shrink-0"/> Talent Discovery
					</NavLink>

					<NavLink to="/admin/announcements" className={navLinkClass}>
						<Megaphone size={20}/> Announcements & ODs
					</NavLink>
					
					<NavLink to="/admin/analytics" className={navLinkClass}>
						<BarChart3 size={20}/> Analytics & Reports
					</NavLink>
					
					<NavLink to="/admin/placements" className={navLinkClass}>
						<Briefcase size={20}/> Placements & Jobs
					</NavLink>
					
					<NavLink to="/admin/events" className={navLinkClass}>
						<Calendar size={20}/> Events & Activities
					</NavLink>
				</nav>

				<div className="mt-8 pt-4" style={{borderTop:'1px solid var(--border-color)'}}>
					<button 
						onClick={handleLogout}
						className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full text-left transition-colors"
					>
						<LogOut size={20}/> Logout
					</button>
				</div>
			</aside>

			{/* Main Content */}
			<div className="flex flex-col min-h-screen">
				<Topbar />
				<main className="flex-1 p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
