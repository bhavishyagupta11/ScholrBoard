import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Code2, FileText, LayoutDashboard, Upload, Table2, UserSquare2, LogOut, MessageSquare, Award, Calendar, Briefcase } from 'lucide-react';
import { Topbar } from '../components/Topbar.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export function StudentLayout() {
	const navigate = useNavigate();
	const { logout } = useAuth();
	const handleLogout = async () => {
		await logout();
		navigate('/', { replace: true });
	};

	const navItems = [
		{ to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ to: '/student/activities', label: 'Activities', icon: Table2 },
		{ to: '/student/upload', label: 'Upload', icon: Upload },
		{ to: '/student/portfolio', label: 'Portfolio', icon: UserSquare2 },
		{ to: '/student/coding', label: 'Coding', icon: Code2 },
		{ to: '/student/developer', label: 'Developer Score', icon: Code2 },
		{ to: '/student/resume-analyzer', label: 'Resume Analyzer', icon: FileText },
		{ to: '/student/certificates', label: 'Certificates', icon: Award },
		{ to: '/student/od', label: 'OD Requests', icon: Calendar },
		{ to: '/student/placements', label: 'Placements', icon: Briefcase },
		{ to: '/student/ai-chat', label: 'AI Coach', icon: MessageSquare },
	];

	const navLinkClass = ({ isActive }) =>
		`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
			isActive
				? 'nav-item-active'
				: 'nav-item-muted'
		}`;

	return (
		<div className="app-shell md:grid md:grid-cols-[248px_1fr]">
			<aside className="sidebar-panel sticky top-0 z-20 border-b p-3 md:h-screen md:border-b-0 md:border-r md:p-4">
				<div className="mb-3 flex items-center justify-between gap-3 md:mb-7">
					<a href="/" className="flex items-center gap-2.5">
						<img src="/assets/logo.png" alt="ScholrBoard Logo" className="w-8 h-8 object-contain" />
						<span className="text-xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em' }}>
							<span style={{ color: 'var(--accent)' }}>Scholr</span>
							<span style={{ color: 'var(--text-primary)' }}>Board</span>
						</span>
					</a>
				</div>
				<nav className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
					{navItems.map(({ to, label, icon: Icon }) => (
						<NavLink key={to} to={to} className={(state) => `${navLinkClass(state)} flex-shrink-0 md:flex-shrink`}>
							<Icon size={18} className="flex-shrink-0"/>
							<span>{label}</span>
						</NavLink>
					))}
				</nav>
				<button className="btn btn-outline mt-auto hidden w-full md:flex hover:border-red-500/30 hover:text-red-500 hover:bg-red-500/5 transition-all duration-200" onClick={handleLogout}><LogOut size={16}/> Logout</button>
			</aside>
			<div className="flex flex-col min-h-screen">
				<Topbar />
				<main className="flex-1 space-y-6 p-4 md:p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
