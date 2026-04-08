import { useNavigate } from 'react-router-dom';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';

export function FacultyDashboard() {
	const navigate = useNavigate();

	// Scroll animation hooks
	const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
	
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
					<h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Faculty Dashboard</h1>
					<p className="mt-2" style={{color:'var(--text-secondary)'}}>Welcome to your faculty portal</p>
				</div>
				<div className="flex gap-2">
					<button 
						onClick={() => switchRole('student')}
						className="btn btn-outline text-sm hover:scale-105 transition-transform"
					>
						Switch to Student
					</button>
					<button 
						onClick={() => switchRole('admin')}
						className="btn btn-outline text-sm hover:scale-105 transition-transform"
					>
						Switch to Admin
					</button>
				</div>
			</div>

			{/* Quick Stats */}
			<div ref={statsContainerRef} className="grid grid-cols-1 md:grid-cols-4 gap-6">
				<div className="card p-6">
					<div className="text-3xl font-bold mb-2" style={{color:'var(--primary-blue)'}}>85</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Students</div>
				</div>
				<div className="card p-6">
					<div className="text-3xl font-bold mb-2" style={{color:'var(--primary-cyan)'}}>23</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Pending Approvals</div>
				</div>
				<div className="card p-6">
					<div className="text-3xl font-bold mb-2 text-green-400">91%</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Avg Attendance</div>
				</div>
				<div className="card p-6">
					<div className="text-3xl font-bold mb-2 text-yellow-400">8.4</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Avg GPA</div>
				</div>
			</div>

			{/* Quick Actions */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div 
					className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
					onClick={() => navigate('/faculty/approvals')}
				>
					<h3 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>📋 Review Approvals</h3>
					<p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>23 activities waiting for your approval</p>
					<button className="btn btn-outline w-full">View Pending</button>
				</div>
				
				<div 
					className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
					onClick={() => navigate('/faculty/students')}
				>
					<h3 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>👥 Student Tracker</h3>
					<p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>Monitor student progress and activities</p>
					<button className="btn btn-outline w-full">View Students</button>
				</div>
				
				<div 
					className="card p-6 cursor-pointer hover:bg-white/5 transition-colors"
					onClick={() => navigate('/faculty/mentor')}
				>
					<h3 className="text-lg font-semibold mb-3" style={{color:'var(--text-primary)'}}>🎯 Student 360°</h3>
					<p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>Comprehensive student progress view</p>
					<button className="btn btn-outline w-full">View 360°</button>
				</div>
			</div>

			{/* Recent Activity */}
			<div className="card p-6">
				<h2 className="text-xl font-semibold mb-4" style={{color:'var(--text-primary)'}}>Recent Faculty Activity</h2>
				<div className="space-y-3">
					<div className="flex justify-between items-center py-3 border-b" style={{borderColor:'var(--border-color)'}}>
						<div>
							<div style={{color:'var(--text-primary)'}}>Approved hackathon participation for Ananya Sharma</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>CSE Department</div>
						</div>
						<div className="text-sm" style={{color:'var(--text-secondary)'}}>2 hours ago</div>
					</div>
					<div className="flex justify-between items-center py-3 border-b" style={{borderColor:'var(--border-color)'}}>
						<div>
							<div style={{color:'var(--text-primary)'}}>Reviewed portfolio for Rohan Gupta</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>CSE Department</div>
						</div>
						<div className="text-sm" style={{color:'var(--text-secondary)'}}>4 hours ago</div>
					</div>
					<div className="flex justify-between items-center py-3 border-b" style={{borderColor:'var(--border-color)'}}>
						<div>
							<div style={{color:'var(--text-primary)'}}>Updated student mentorship assignments</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>Faculty Administration</div>
						</div>
						<div className="text-sm" style={{color:'var(--text-secondary)'}}>1 day ago</div>
					</div>
				</div>
			</div>

		</div>
	);
}
