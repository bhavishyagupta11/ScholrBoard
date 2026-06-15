import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, Users, BarChart3, LogOut, UserSquare2, Calendar, LifeBuoy, X } from 'lucide-react';
import { Topbar } from '../components/Topbar.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export function FacultyLayout() {
	const navigate = useNavigate();
	const { logout, user } = useAuth();
	const isCoordinator = user?.role === 'department_coordinator';
	const prefix = isCoordinator ? '/coordinator' : '/faculty';
	
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

	const navLinkClass = ({ isActive }) =>
		`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
			isActive 
				? 'nav-item-active' 
				: 'nav-item-muted hover:bg-blue-50'
		} ${isCollapsed ? 'md:justify-center md:px-2' : ''}`;

	return (
		<div className={`app-shell md:grid ${isCollapsed ? 'md:grid-cols-[80px_1fr]' : 'md:grid-cols-[280px_1fr]'} transition-all duration-300`}>
			{/* Mobile Overlay backdrop */}
			{isMobileOpen && (
				<div 
					onClick={() => setIsMobileOpen(false)} 
					className="fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity duration-300"
				/>
			)}

			{/* Sidebar */}
			<aside 
				className={`sidebar-panel flex flex-col p-6 border-r md:h-screen sticky top-0
					fixed inset-y-0 left-0 z-50 w-[260px] md:w-auto md:translate-x-0 md:z-20 transition-all duration-300
					${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
					${isCollapsed ? 'md:w-20 md:p-4' : 'md:w-[280px]'}
				`}
			>
				{/* Sidebar Header */}
				<div className={`mb-8 flex items-center justify-between gap-2.5 ${isCollapsed ? 'md:flex-col md:gap-4 md:items-center' : ''}`}>
					<a href="/" className="flex items-center gap-2.5">
						<img src="/assets/logo.png" alt="ScholrBoard Logo" className="w-8 h-8 object-contain flex-shrink-0" />
						<div className={`flex flex-col ${isCollapsed ? 'md:hidden' : 'flex'}`}>
							<span className="text-lg font-extrabold tracking-tight leading-none" style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.03em' }}>
								<span style={{ color: 'var(--accent)' }}>Scholr</span>
								<span style={{ color: 'var(--text-primary)' }}>Board</span>
							</span>
							<div className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mt-1">
								{isCoordinator ? 'Coordinator Portal' : 'Faculty Portal'}
							</div>
						</div>
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
					<NavLink to={prefix} end className={navLinkClass} title={isCollapsed ? 'Dashboard' : ''}>
						<BarChart3 size={20} className="flex-shrink-0"/>
						<span className={isCollapsed ? 'md:hidden' : 'inline-block'}>Dashboard</span>
					</NavLink>
					
					<NavLink to={`${prefix}/approvals`} className={navLinkClass} title={isCollapsed ? 'Activity Approvals' : ''}>
						<ClipboardList size={20} className="flex-shrink-0"/>
						<span className={isCollapsed ? 'md:hidden' : 'inline-block'}>Activity Approvals</span>
					</NavLink>

					{!isCoordinator && (
						<>
							<NavLink to="/faculty/od-approvals" className={navLinkClass} title={isCollapsed ? 'OD Approvals' : ''}>
								<Calendar size={20} className="flex-shrink-0"/>
								<span className={isCollapsed ? 'md:hidden' : 'inline-block'}>OD Approvals</span>
							</NavLink>
						</>
					)}
					
					<NavLink to={`${prefix}/students`} className={navLinkClass} title={isCollapsed ? 'Student Tracker' : ''}>
						<Users size={20} className="flex-shrink-0"/>
						<span className={isCollapsed ? 'md:hidden' : 'inline-block'}>Student Tracker</span>
					</NavLink>
					
					{!isCoordinator && (
						<>
							<NavLink to="/faculty/mentor" className={navLinkClass} title={isCollapsed ? 'Student 360°' : ''}>
								<UserSquare2 size={20} className="flex-shrink-0"/>
								<span className={isCollapsed ? 'md:hidden' : 'inline-block'}>Student 360°</span>
							</NavLink>
						</>
					)}

					<NavLink to={`${prefix}/support`} className={navLinkClass} title={isCollapsed ? 'Support' : ''}>
						<LifeBuoy size={20} className="flex-shrink-0"/>
						<span className={isCollapsed ? 'md:hidden' : 'inline-block'}>Support</span>
					</NavLink>
				</nav>

				{/* Sidebar Footer */}
				<div className="mt-auto pt-4" style={{borderTop:'1px solid var(--border-color)'}}>
					<button 
						onClick={handleLogout}
						className={`flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 w-full text-left transition-colors ${isCollapsed ? 'md:justify-center md:px-2' : ''}`}
						title="Logout"
					>
						<LogOut size={20} className="flex-shrink-0"/>
						<span className={isCollapsed ? 'md:hidden' : 'inline-block'}>Logout</span>
					</button>
				</div>
			</aside>

			{/* Main Content */}
			<div className="flex flex-col min-h-screen">
				<Topbar onMenuClick={toggleSidebar} />
				<main className="flex-1 p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
