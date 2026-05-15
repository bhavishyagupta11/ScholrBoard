import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, BarChart3, LogOut, Calendar, Briefcase } from 'lucide-react';
import { Topbar } from '../components/Topbar.jsx';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext.jsx';

export function AdminLayout() {
	const navigate = useNavigate();
	const { logout } = useFirebaseAuth();
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
		<div className="app-shell grid md:grid-cols-[280px_1fr]">
			{/* Sidebar */}
			<aside className="sidebar-panel p-6 md:min-h-screen md:border-r">
				<div className="mb-8 flex items-center gap-3">
					<a href="/" className="sidebar-brand-mark">S</a>
					<div>
						<a href="/" className="text-2xl font-bold" style={{color:'var(--primary-blue)'}}>ScholrBoard</a>
						<div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Campus Portal</div>
						<div className="text-xs mt-1 font-medium" style={{color:'var(--text-secondary)'}}>Admin Portal</div>
					</div>
				</div>

				<nav className="flex flex-col space-y-2">
					<NavLink to="/admin" end className={navLinkClass}>
						<BarChart3 size={20} className="flex-shrink-0"/> Dashboard
					</NavLink>
					
					<NavLink to="/admin/approvals" className={navLinkClass}>
						<ClipboardList size={20}/> Activity Approvals
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
