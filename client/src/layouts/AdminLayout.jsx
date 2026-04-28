import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, Users, BarChart3, User, LogOut, Home, UserSquare2, Settings, Calendar, Briefcase, FileText } from 'lucide-react';
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
				? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500' 
				: 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
		}`;

	return (
		<div className="min-h-screen grid md:grid-cols-[280px_1fr]">
			{/* Sidebar */}
			<aside className="p-6" style={{background:'var(--surface-glass)', borderRight:'1px solid var(--border-color)'}}>
				<div className="mb-8">
					<a href="/" className="text-2xl font-bold" style={{color:'var(--primary-blue)'}}>ScholrBoard</a>
					<div className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>JECRC University</div>
					<div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>Admin Portal</div>
				</div>

				<nav className="flex flex-col space-y-2">
					<a href="/" className={navLinkClass({ isActive: false })}>
						<Home size={20}/> Homepage
					</a>
					
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
