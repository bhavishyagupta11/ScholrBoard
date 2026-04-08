import { useState } from 'react';

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

export function FacultyApprovals() {
	const [pendingList, setPendingList] = useState(initial);
	const [searchTerm, setSearchTerm] = useState('');
	const [filterDept, setFilterDept] = useState('All');
	const [filterStatus, setFilterStatus] = useState('All');

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

	const approvedCount = pendingList.filter(item => item.status === 'Approved').length;
	const rejectedCount = pendingList.filter(item => item.status === 'Rejected').length;
	const pendingCount = pendingList.filter(item => item.status === 'Pending').length;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Activity Approvals</h1>
				<p className="mt-2" style={{color:'var(--text-secondary)'}}>Review and approve student activity submissions</p>
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
			</div>

			{/* Approvals Table */}
			<div className="card p-6">
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

		</div>
	);
}
