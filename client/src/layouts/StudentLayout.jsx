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

	const navLinkClass = ({ isActive }) =>
		`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
			isActive
				? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
				: 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
		}`;

	return (
		<div className="min-h-screen grid md:grid-cols-[240px_1fr]">
			<aside className="p-4" style={{background:'var(--surface-glass)', borderRight:'1px solid var(--border-color)'}}>
				<div className="mb-6">
					<a href="/" className="text-xl font-bold text-brand-blue">ScholrBoard</a>
					<div className="text-xs" style={{color:'var(--text-secondary)'}}>JECRC University</div>
				</div>
				<nav className="flex flex-col gap-1">
					<a href="/landing" className={navLinkClass({ isActive: false })}><Home size={18}/> Homepage</a>
					<NavLink to="/student/dashboard" className={(state) => `${navLinkClass(state)} relative overflow-hidden group`}>
						<div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
						<div className="relative z-10 flex items-center gap-3">
							<LayoutDashboard size={20} className="flex-shrink-0"/>
							<span>Dashboard</span>
						</div>
					</NavLink>
					<NavLink to="/student/activities" className={navLinkClass}><Table2 size={18}/> My Activities</NavLink>
					<NavLink to="/student/upload" className={navLinkClass}><Upload size={18}/> Upload</NavLink>
					<NavLink to="/student/portfolio" className={navLinkClass}><UserSquare2 size={18}/> Portfolio</NavLink>
					<NavLink to="/student/coding" className={navLinkClass}><Code2 size={18}/> Coding</NavLink>
					<NavLink to="/student/resume" className={navLinkClass}><FileText size={18}/> Resume Import</NavLink>
				</nav>
				<button className="btn btn-outline mt-6 w-full" onClick={handleLogout}><LogOut size={16}/> Logout</button>
			</aside>
			<div className="flex flex-col min-h-screen">
				<Topbar />
				<main className="p-6 space-y-6 flex-1">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
