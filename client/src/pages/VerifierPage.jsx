import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const initial = [
	{ id: 1, student: 'Ananya Sharma', activity: 'Hackathon Winner', date: '2025-08-01', proof: '#', status:'Pending', dept:'CSE' },
	{ id: 2, student: 'Rohan Gupta', activity: 'Research Paper Published', date: '2025-07-28', proof: '#', status:'Pending', dept:'CSE' },
	{ id: 3, student: 'Priya Patel', activity: 'IEEE Conference Speaker', date: '2025-07-25', proof: '#', status:'Pending', dept:'ECE' },
	{ id: 4, student: 'Arjun Singh', activity: 'Sports Captain', date: '2025-07-20', proof: '#', status:'Approved', dept:'ME' },
	{ id: 5, student: 'Sneha Yadav', activity: 'Volunteer Work - NGO', date: '2025-07-18', proof: '#', status:'Pending', dept:'CSE' },
	{ id: 6, student: 'Karan Mehta', activity: 'Coding Competition Winner', date: '2025-07-15', proof: '#', status:'Rejected', dept:'ECE' },
	{ id: 7, student: 'Riya Sharma', activity: 'Leadership Workshop', date: '2025-07-12', proof: '#', status:'Pending', dept:'ME' },
	{ id: 8, student: 'Vikash Kumar', activity: 'Technical Blog Writing', date: '2025-07-10', proof: '#', status:'Approved', dept:'CSE' },
];

const students = [
	{ id: 1, name: 'Ananya Sharma', rollNo: 'CSE001', dept: 'CSE', activities: 12, gpa: 8.7, attendance: 92 },
	{ id: 2, name: 'Rohan Gupta', rollNo: 'CSE002', dept: 'CSE', activities: 8, gpa: 8.2, attendance: 88 },
	{ id: 3, name: 'Priya Patel', rollNo: 'ECE001', dept: 'ECE', activities: 15, gpa: 9.1, attendance: 95 },
	{ id: 4, name: 'Arjun Singh', rollNo: 'ME001', dept: 'ME', activities: 6, gpa: 7.8, attendance: 85 },
	{ id: 5, name: 'Sneha Yadav', rollNo: 'CSE003', dept: 'CSE', activities: 10, gpa: 8.9, attendance: 93 },
	{ id: 6, name: 'Karan Mehta', rollNo: 'ECE002', dept: 'ECE', activities: 14, gpa: 8.5, attendance: 90 },
	{ id: 7, name: 'Riya Sharma', rollNo: 'ME002', dept: 'ME', activities: 7, gpa: 8.1, attendance: 87 },
	{ id: 8, name: 'Vikash Kumar', rollNo: 'CSE004', dept: 'CSE', activities: 11, gpa: 8.6, attendance: 91 },
];

export function VerifierPage() {
	const navigate = useNavigate();
	const [pendingList, setPendingList] = useState(initial);
	const [searchTerm, setSearchTerm] = useState('');
	const [filterDept, setFilterDept] = useState('All');
	const [filterStatus, setFilterStatus] = useState('All');
	const [filterTime, setFilterTime] = useState('All');
	const [activeTab, setActiveTab] = useState('approvals');
	const [showPlacementModal, setShowPlacementModal] = useState(false);
	const [showEventModal, setShowEventModal] = useState(false);

	const role = localStorage.getItem('role');
	const isAdmin = role === 'admin';

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

	const updateStatus = (id, newStatus) => {
		setPendingList(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
	};

	const filteredPending = pendingList.filter(item => {
		const matchesSearch = item.student.toLowerCase().includes(searchTerm.toLowerCase()) || 
						 item.activity.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesDept = filterDept === 'All' || item.dept === filterDept;
		const matchesStatus = filterStatus === 'All' || item.status === filterStatus;
		return matchesSearch && matchesDept && matchesStatus;
	});

	const filteredStudents = students.filter(student => 
		(filterDept === 'All' || student.dept === filterDept) &&
		(student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
		 student.rollNo.toLowerCase().includes(searchTerm.toLowerCase()))
	);

	const approvedCount = pendingList.filter(item => item.status === 'Approved').length;
	const rejectedCount = pendingList.filter(item => item.status === 'Rejected').length;
	const pendingCount = pendingList.filter(item => item.status === 'Pending').length;

	return (
		<div className="space-y-6">
			{/* Header with Role Switcher */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-2xl font-bold" style={{color:'var(--text-primary)'}}>
						{isAdmin ? 'Admin Dashboard' : 'Faculty Dashboard'}
					</h1>
					<p style={{color:'var(--text-secondary)'}}>JECRC University · {isAdmin ? 'Administrative Portal' : 'Faculty Portal'}</p>
				</div>
				<div className="flex gap-2">
					<button 
						onClick={() => switchRole('student')}
						className="btn btn-outline text-sm"
					>
						Switch to Student
					</button>
					{!isAdmin && (
						<button 
							onClick={() => switchRole('admin')}
							className="btn btn-outline text-sm"
						>
							Switch to Admin
						</button>
					)}
					{isAdmin && (
						<button 
							onClick={() => switchRole('faculty')}
							className="btn btn-outline text-sm"
						>
							Switch to Faculty
						</button>
					)}
				</div>
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="card p-4">
					<div className="text-2xl font-bold" style={{color:'var(--primary-blue)'}}>{pendingList.length}</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Submissions</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-green-400">{approvedCount}</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Approved</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-yellow-400">{pendingCount}</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Pending Review</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-red-400">{rejectedCount}</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Rejected</div>
				</div>
			</div>

			{/* Tab Navigation */}
			<div className="border-b" style={{borderColor:'var(--border-color)'}}>
				<div className="flex space-x-8">
					<button
						onClick={() => setActiveTab('approvals')}
						className={`py-2 px-1 border-b-2 font-medium text-sm ${
							activeTab === 'approvals' 
								? 'border-blue-500 text-blue-500' 
								: 'border-transparent text-gray-400 hover:text-white'
						}`}
					>
						Pending Approvals
					</button>
					<button
						onClick={() => setActiveTab('students')}
						className={`py-2 px-1 border-b-2 font-medium text-sm ${
							activeTab === 'students' 
								? 'border-blue-500 text-blue-500' 
								: 'border-transparent text-gray-400 hover:text-white'
						}`}
					>
						Student Tracker
					</button>
					{isAdmin && (
						<button
							onClick={() => setActiveTab('analytics')}
							className={`py-2 px-1 border-b-2 font-medium text-sm ${
								activeTab === 'analytics' 
									? 'border-blue-500 text-blue-500' 
									: 'border-transparent text-gray-400 hover:text-white'
							}`}
						>
							Analytics
						</button>
					)}
					{isAdmin && (
						<button
							onClick={() => setActiveTab('admin')}
							className={`py-2 px-1 border-b-2 font-medium text-sm ${
								activeTab === 'admin' 
									? 'border-blue-500 text-blue-500' 
									: 'border-transparent text-gray-400 hover:text-white'
							}`}
						>
							Admin Management
						</button>
					)}
				</div>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-4">
				<input
					type="text"
					placeholder="Search students or activities..."
					className="input-dark px-3 py-2 flex-1 min-w-[200px]"
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
				/>
				<select
					className="input-dark px-3 py-2"
					value={filterDept}
					onChange={(e) => setFilterDept(e.target.value)}
				>
					<option value="All">All Departments</option>
					<option value="CSE">CSE</option>
					<option value="ECE">ECE</option>
					<option value="ME">ME</option>
					<option value="CE">CE</option>
				</select>
				{activeTab === 'approvals' && (
					<select
						className="input-dark px-3 py-2"
						value={filterStatus}
						onChange={(e) => setFilterStatus(e.target.value)}
					>
						<option value="All">All Status</option>
						<option value="Pending">Pending</option>
						<option value="Approved">Approved</option>
						<option value="Rejected">Rejected</option>
					</select>
				)}
			</div>

			{/* Content based on active tab */}
			{activeTab === 'approvals' && (
				<div className="card p-6">
					<h2 className="text-xl font-semibold mb-4" style={{color:'var(--text-primary)'}}>Pending Approvals</h2>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b" style={{borderColor:'var(--border-color)'}}>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Student</th>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Activity</th>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Date</th>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Proof</th>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Status</th>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Actions</th>
								</tr>
							</thead>
							<tbody>
								{filteredPending.map((item) => (
									<tr key={item.id} className="border-b" style={{borderColor:'var(--border-color)'}}>
										<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{item.student}</td>
										<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{item.activity}</td>
										<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{item.date}</td>
										<td className="py-3 px-4">
											<a href={item.proof} className="text-blue-400 hover:text-blue-300">View Proof</a>
										</td>
										<td className="py-3 px-4">
											<span className={`badge ${
												item.status === 'Approved' ? 'badge-success' : 
												item.status === 'Rejected' ? 'badge-error' : 'badge-warning'
											}`}> 
												{item.status}
											</span>
										</td>
										<td className="py-3 px-4">
											{item.status === 'Pending' && (
												<div className="flex gap-2">
													<button
														onClick={() => updateStatus(item.id, 'Approved')}
														className="btn btn-sm bg-green-600 text-white hover:bg-green-700"
													>
														Approve
													</button>
													<button
														onClick={() => updateStatus(item.id, 'Rejected')}
														className="btn btn-sm bg-red-600 text-white hover:bg-red-700"
													>
														Reject
													</button>
												</div>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{activeTab === 'students' && (
				<div className="card p-6">
					<h2 className="text-xl font-semibold mb-4" style={{color:'var(--text-primary)'}}>Student Tracker</h2>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b" style={{borderColor:'var(--border-color)'}}>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Student</th>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Department</th>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Activities</th>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>GPA</th>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Attendance</th>
									<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Actions</th>
								</tr>
							</thead>
							<tbody>
								{filteredStudents.map((student) => (
									<tr key={student.id} className="border-b" style={{borderColor:'var(--border-color)'}}>
										<td className="py-3 px-4">
											<div>
												<div style={{color:'var(--text-primary)'}}>{student.name}</div>
												<div className="text-sm" style={{color:'var(--text-secondary)'}}>{student.rollNo}</div>
											</div>
										</td>
										<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{student.dept}</td>
										<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{student.activities}</td>
										<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{student.gpa}</td>
										<td className="py-3 px-4">
											<span className={
												student.attendance >= 90 ? 'text-green-400' : 
												student.attendance >= 75 ? 'text-yellow-400' : 'text-red-400'
											}>
												{student.attendance}%
											</span>
										</td>
										<td className="py-3 px-4">
											<div className="flex gap-2">
												<button className="btn btn-outline btn-sm">View Profile</button>
												<button className="btn btn-outline btn-sm">Contact</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{activeTab === 'analytics' && isAdmin && (
				<div className="space-y-6">
					{/* Analytics Stats */}
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<div className="card p-4">
							<div className="text-2xl font-bold" style={{color:'var(--primary-blue)'}}>370</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Students</div>
						</div>
						<div className="card p-4">
							<div className="text-2xl font-bold" style={{color:'var(--primary-cyan)'}}>127</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Activities</div>
						</div>
						<div className="card p-4">
							<div className="text-2xl font-bold text-green-400">94%</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>Approval Rate</div>
						</div>
						<div className="card p-4">
							<div className="text-2xl font-bold text-yellow-400">8.4</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>Avg GPA</div>
						</div>
					</div>
					
					{/* Analytics Charts */}
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<div className="card p-6">
							<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Department-wise Statistics</h3>
							<div className="space-y-3">
								<div>
									<div className="flex justify-between text-sm mb-1">
										<span>CSE</span>
										<span>120 students</span>
									</div>
									<div className="w-full bg-slate-700 rounded-full h-2">
										<div className="h-2 rounded-full bg-blue-500" style={{width:'40%'}} />
									</div>
								</div>
								<div>
									<div className="flex justify-between text-sm mb-1">
										<span>ECE</span>
										<span>90 students</span>
									</div>
									<div className="w-full bg-slate-700 rounded-full h-2">
										<div className="h-2 rounded-full bg-green-500" style={{width:'30%'}} />
									</div>
								</div>
								<div>
									<div className="flex justify-between text-sm mb-1">
										<span>ME</span>
										<span>85 students</span>
									</div>
									<div className="w-full bg-slate-700 rounded-full h-2">
										<div className="h-2 rounded-full bg-yellow-500" style={{width:'28%'}} />
									</div>
								</div>
								<div>
									<div className="flex justify-between text-sm mb-1">
										<span>CE</span>
										<span>75 students</span>
									</div>
									<div className="w-full bg-slate-700 rounded-full h-2">
										<div className="h-2 rounded-full bg-purple-500" style={{width:'25%'}} />
									</div>
								</div>
							</div>
						</div>

						<div className="card p-6">
							<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Activity Categories</h3>
							<div className="space-y-3">
								<div>
									<div className="flex justify-between text-sm mb-1">
										<span>Technical Projects</span>
										<span>35%</span>
									</div>
									<div className="w-full bg-slate-700 rounded-full h-2">
										<div className="h-2 rounded-full bg-blue-500" style={{width:'35%'}} />
									</div>
								</div>
								<div>
									<div className="flex justify-between text-sm mb-1">
										<span>Research Papers</span>
										<span>25%</span>
									</div>
									<div className="w-full bg-slate-700 rounded-full h-2">
										<div className="h-2 rounded-full bg-green-500" style={{width:'25%'}} />
									</div>
								</div>
								<div>
									<div className="flex justify-between text-sm mb-1">
										<span>Leadership</span>
										<span>20%</span>
									</div>
									<div className="w-full bg-slate-700 rounded-full h-2">
										<div className="h-2 rounded-full bg-yellow-500" style={{width:'20%'}} />
									</div>
								</div>
								<div>
									<div className="flex justify-between text-sm mb-1">
										<span>Sports & Others</span>
										<span>20%</span>
									</div>
									<div className="w-full bg-slate-700 rounded-full h-2">
										<div className="h-2 rounded-full bg-purple-500" style={{width:'20%'}} />
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Report Generation */}
					<div className="card p-6">
						<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Generate Reports</h3>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							<button 
								onClick={() => alert('NAAC Report generated successfully!')}
								className="btn btn-outline"
							>
								Generate NAAC Report
							</button>
							<button 
								onClick={() => alert('NIRF Report generated successfully!')}
								className="btn btn-outline"
							>
								Generate NIRF Report
							</button>
							<button 
								onClick={() => alert('Data exported to Excel successfully!')}
								className="btn btn-outline"
							>
								Export to Excel
							</button>
						</div>
					</div>
				</div>
			)}

			{activeTab === 'admin' && isAdmin && (
				<div className="space-y-6">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						{/* Admin Management */}
						<div className="card p-6">
							<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Placements & Internships</h3>
							<div className="space-y-3">
								<div className="p-3 rounded" style={{background:'var(--bg-medium)', border:'1px solid var(--border-color)'}}>
									<div className="font-medium" style={{color:'var(--text-primary)'}}>TCS - Software Developer</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>12 LPA • 15 positions • Deadline: March 20</div>
									<div className="flex gap-2 mt-2">
										<button className="btn btn-outline text-xs">Edit</button>
										<button className="btn btn-outline text-xs">Applicants (23)</button>
									</div>
								</div>
								<div className="p-3 rounded" style={{background:'var(--bg-medium)', border:'1px solid var(--border-color)'}}>
									<div className="font-medium" style={{color:'var(--text-primary)'}}>Microsoft - Internship</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>60k/month • 5 positions • Deadline: April 10</div>
									<div className="flex gap-2 mt-2">
										<button className="btn btn-outline text-xs">Edit</button>
										<button className="btn btn-outline text-xs">Applicants (47)</button>
									</div>
								</div>
							</div>
							<button 
								onClick={() => setShowPlacementModal(true)}
								className="btn btn-outline w-full mt-4"
							>
								Add New Opportunity
							</button>
						</div>

						{/* Events Management */}
						<div className="card p-6">
							<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Upcoming Events</h3>
							<div className="space-y-3">
								<div className="p-3 rounded" style={{background:'var(--bg-medium)', border:'1px solid var(--border-color)'}}>
									<div className="font-medium" style={{color:'var(--text-primary)'}}>Tech Fest 2025</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>March 15-17 • Main Auditorium</div>
									<div className="flex gap-2 mt-2">
										<button className="btn btn-outline text-xs">Edit</button>
										<button className="btn btn-outline text-xs">Registrations (156)</button>
									</div>
								</div>
								<div className="p-3 rounded" style={{background:'var(--bg-medium)', border:'1px solid var(--border-color)'}}>
									<div className="font-medium" style={{color:'var(--text-primary)'}}>Industry Expert Talk</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>April 5 • Conference Hall</div>
									<div className="flex gap-2 mt-2">
										<button className="btn btn-outline text-xs">Edit</button>
										<button className="btn btn-outline text-xs">Registrations (89)</button>
									</div>
								</div>
							</div>
							<button 
								onClick={() => setShowEventModal(true)}
								className="btn btn-outline w-full mt-4"
							>
								Add New Event
							</button>
						</div>
					</div>

					{/* Recent Admin Actions */}
					<div className="card p-6">
						<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Recent Admin Actions</h3>
						<div className="space-y-2">
							{[
								{ action: 'Added new placement opportunity - Google SDE', time: '2 hours ago' },
								{ action: 'Approved 15 student activity submissions', time: '4 hours ago' },
								{ action: 'Updated event details for Tech Fest 2025', time: '1 day ago' },
								{ action: 'Generated NAAC compliance report', time: '2 days ago' },
								{ action: 'Added new faculty member - Dr. Priya Sharma', time: '3 days ago' },
							].map((log, index) => (
								<div key={index} className="flex justify-between items-center py-2 border-b" style={{borderColor:'var(--border-color)'}}>
									<span className="text-sm" style={{color:'var(--text-primary)'}}>{log.action}</span>
									<span className="text-xs ml-2" style={{color:'var(--text-secondary)'}}>{log.time}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

		</div>
	);
}
