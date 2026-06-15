import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Code2, FileText, LayoutDashboard, Upload, Table2, UserSquare2, LogOut, MessageSquare, Award, Calendar, Briefcase, X } from 'lucide-react';
import { Topbar } from '../components/Topbar.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export function StudentLayout() {
	const navigate = useNavigate();
	const { logout } = useAuth();
	
	const [isCollapsed, setIsCollapsed] = useState(() => {
		return localStorage.getItem('sidebar-collapsed') === 'true';
	});
	const [isMobileOpen, setIsMobileOpen] = useState(false);

	useEffect(() => {
		localStorage.setItem('sidebar-collapsed', isCollapsed);
	}, [isCollapsed]);

	const toggleSidebar = () => {
		if (window.innerWidth >= 768) {
			setIsCollapsed(prev => !prev);
		} else {
			setIsMobileOpen(prev => !prev);
		}
	};

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
		} ${isCollapsed ? 'md:justify-center md:px-2' : ''}`;

	return (
		<div className={`app-shell md:grid ${isCollapsed ? 'md:grid-cols-[80px_1fr]' : 'md:grid-cols-[248px_1fr]'} transition-all duration-300`}>
			{/* Mobile Overlay backdrop */}
			{isMobileOpen && (
				<div 
					onClick={() => setIsMobileOpen(false)} 
					className="fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity duration-300"
				/>
			)}

			{/* Sidebar */}
			<aside 
				className={`sidebar-panel flex flex-col p-4 border-r md:h-screen sticky top-0
					fixed inset-y-0 left-0 z-50 w-[260px] md:w-auto md:translate-x-0 md:z-20 transition-all duration-300
					${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
					${isCollapsed ? 'md:w-20 md:p-3' : 'md:w-[248px]'}
				`}
			>
				{/* Sidebar Header */}
				<div className={`mb-6 flex items-center justify-between gap-3 ${isCollapsed ? 'md:flex-col md:gap-4 md:items-center' : ''}`}>
					<a href="/" className="flex items-center gap-2.5">
						<img src="/assets/logo.png" alt="ScholrBoard Logo" className="w-8 h-8 object-contain flex-shrink-0" />
						<span className={`text-xl font-extrabold tracking-tight ${isCollapsed ? 'md:hidden' : 'inline-block'}`} style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em' }}>
							<span style={{ color: 'var(--accent)' }}>Scholr</span>
							<span style={{ color: 'var(--text-primary)' }}>Board</span>
						</span>
					</a>

					<div className="flex items-center gap-2">
						{/* Mobile Close Button */}
						<button 
							onClick={() => setIsMobileOpen(false)} 
							className="md:hidden text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10"
						>
							<X size={20} />
						</button>
					</div>
				</div>

				{/* Nav Links */}
				<nav className="flex flex-col space-y-1.5 overflow-y-auto flex-grow custom-scrollbar">
					{navItems.map(({ to, label, icon: Icon }) => (
						<NavLink 
							key={to} 
							to={to} 
							className={navLinkClass}
							title={isCollapsed ? label : ''}
						>
							<Icon size={18} className="flex-shrink-0"/>
							<span className={isCollapsed ? 'md:hidden' : 'inline-block'}>{label}</span>
						</NavLink>
					))}
				</nav>

				{/* Sidebar Footer */}
				<div className="mt-auto pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
					<button 
						className={`btn btn-outline w-full flex items-center gap-3 hover:border-red-500/30 hover:text-red-500 hover:bg-red-500/5 transition-all duration-200 ${isCollapsed ? 'md:justify-center md:px-2' : ''}`} 
						onClick={handleLogout}
						title="Logout"
					>
						<LogOut size={16} className="flex-shrink-0"/>
						<span className={isCollapsed ? 'md:hidden' : 'inline-block'}>Logout</span>
					</button>
				</div>
			</aside>

			{/* Main Container */}
			<div className="flex flex-col min-h-screen">
				<Topbar onMenuClick={toggleSidebar} />
				<main className="flex-1 space-y-6 p-4 md:p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
