import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Code2, FileText, Home, LayoutDashboard, Upload, Table2, UserSquare2, LogOut } from 'lucide-react';
import { Topbar } from '../components/Topbar.jsx';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext.jsx';

export function StudentLayout() {
	const navigate = useNavigate();
	const { logout } = useFirebaseAuth();
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
		{ to: '/student/resume', label: 'Resume', icon: FileText },
	];

	const navLinkClass = ({ isActive }) =>
		`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
			isActive
				? 'nav-item-active'
				: 'nav-item-muted hover:bg-blue-50'
		}`;

	return (
		<div className="app-shell md:grid md:grid-cols-[248px_1fr]">
			<aside className="sidebar-panel sticky top-0 z-20 border-b p-3 md:h-screen md:border-b-0 md:border-r md:p-4">
				<div className="mb-3 flex items-center justify-between gap-3 md:mb-7">
					<a href="/" className="flex items-center gap-3">
						<span className="sidebar-brand-mark">S</span>
						<span>
							<span className="block text-lg font-bold text-brand-blue md:text-xl">ScholrBoard</span>
							<span className="block text-xs font-medium" style={{color:'var(--text-secondary)'}}>JECRC University</span>
						</span>
					</a>
				</div>
				<nav className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
					<a href="/landing" className={`${navLinkClass({ isActive: false })} flex-shrink-0 md:flex-shrink`}><Home size={18}/> <span>Home</span></a>
					{navItems.map(({ to, label, icon: Icon }) => (
						<NavLink key={to} to={to} className={(state) => `${navLinkClass(state)} flex-shrink-0 md:flex-shrink`}>
							<Icon size={18} className="flex-shrink-0"/>
							<span>{label}</span>
						</NavLink>
					))}
				</nav>
				<button className="btn btn-outline mt-6 hidden w-full md:flex" onClick={handleLogout}><LogOut size={16}/> Logout</button>
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
