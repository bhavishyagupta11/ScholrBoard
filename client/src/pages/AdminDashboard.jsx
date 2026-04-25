import { useNavigate } from 'react-router-dom';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';

export function AdminDashboard() {
	const navigate = useNavigate();

	// Scroll animation hooks
	const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
	const statsRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });
	
	// Staggered animations for stats cards
	const { containerRef: statsContainerRef, setItemRef: setStatRef } = useStaggeredAnimation(4, 0.1);

	const switchRole = (newRole) => {
		localStorage.setItem('role', newRole);
		localStorage.setItem('isAuthenticated', 'true');
		console.log(`Switching to ${newRole} role`);
		
		if (newRole === 'student') {
			window.location.href = '/student';
		} else if (newRole === 'faculty') {
			window.location.href = '/faculty';
		} else if (newRole === 'admin') {
			window.location.href = '/admin';
		}
	};

	return (
		<div className="space-y-6">
			{/* Header with Role Switcher */}
			<div ref={headerRef} className="flex justify-between items-center gpu-accelerated">
				<div>
					<h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Admin Dashboard</h1>
					<p className="mt-2" style={{color:'var(--text-secondary)'}}>Complete system administration and oversight</p>
				</div>
				<div className="flex gap-2">
					<button 
						onClick={() => switchRole('student')}
						className="btn btn-outline text-sm hover:scale-105 transition-transform"
					>
						Switch to Student
					</button>
					<button 
						onClick={() => switchRole('faculty')}
						className="btn btn-outline text-sm hover:scale-105 transition-transform"
					>
						Switch to Faculty
					</button>
				</div>
			</div>

			{/* Quick Stats */}
			<div ref={statsContainerRef} className="grid grid-cols-1 md:grid-cols-4 gap-6">
				<div className="card p-6">
					<div className="text-3xl font-bold mb-2" style={{color:'var(--primary-blue)'}}>370</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Students</div>
				</div>
				<div className="card p-6">
					<div className="text-3xl font-bold mb-2" style={{color:'var(--primary-cyan)'}}>127</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Activities</div>
				</div>
				<div className="card p-6">
					<div className="text-3xl font-bold mb-2 text-green-400">94%</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Approval Rate</div>
				</div>
				<div className="card p-6">
					<div className="text-3xl font-bold mb-2 text-yellow-400">8.4</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>System Health</div>
				</div>
			</div>

			{/* Quick Actions */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div 
					className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
					onClick={() => navigate('/admin/analytics')}
				>
					<h3 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>📊 Analytics & Reports</h3>
					<p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>Generate NAAC/NIRF reports and view analytics</p>
					<button className="btn btn-outline w-full">View Analytics</button>
				</div>
				
				<div 
					className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
					onClick={() => navigate('/admin/placements')}
				>
					<h3 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>💼 Placements & Internships</h3>
					<p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>Manage job postings and internship opportunities</p>
					<button className="btn btn-outline w-full">Manage Placements</button>
				</div>
				
				<div 
					className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
					onClick={() => navigate('/admin/events')}
				>
					<h3 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>📅 Events Management</h3>
					<p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>Organize and manage university events</p>
					<button className="btn btn-outline w-full">Manage Events</button>
				</div>
			</div>

			{/* Secondary Actions */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div 
					className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
					onClick={() => navigate('/admin/approvals')}
				>
					<h3 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>📋 Activity Approvals</h3>
					<p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>Review and approve student activities</p>
					<button className="btn btn-outline w-full">Review Approvals</button>
				</div>
				
				<div 
					className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
					onClick={() => navigate('/admin/settings')}
				>
					<h3 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>⚙️ System Settings</h3>
					<p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>Configure system parameters and permissions</p>
					<button className="btn btn-outline w-full">System Settings</button>
				</div>
			</div>

			{/* Recent Admin Activity */}
			<div className="card p-6">
				<h2 className="text-xl font-semibold mb-4" style={{color:'var(--text-primary)'}}>Recent Admin Activity</h2>
				<div className="space-y-3">
					<div className="flex justify-between items-center py-3 border-b" style={{borderColor:'var(--border-color)'}}>
						<div>
							<div style={{color:'var(--text-primary)'}}>Generated NAAC compliance report</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>System Administration</div>
						</div>
						<div className="text-sm" style={{color:'var(--text-secondary)'}}>2 hours ago</div>
					</div>
					<div className="flex justify-between items-center py-3 border-b" style={{borderColor:'var(--border-color)'}}>
						<div>
							<div style={{color:'var(--text-primary)'}}>Added new placement opportunity - TCS Software Engineer</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>Placement Management</div>
						</div>
						<div className="text-sm" style={{color:'var(--text-secondary)'}}>4 hours ago</div>
					</div>
					<div className="flex justify-between items-center py-3 border-b" style={{borderColor:'var(--border-color)'}}>
						<div>
							<div style={{color:'var(--text-primary)'}}>Updated system permissions for faculty</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>User Management</div>
						</div>
						<div className="text-sm" style={{color:'var(--text-secondary)'}}>1 day ago</div>
					</div>
				</div>
			</div>

		</div>
	);
}
