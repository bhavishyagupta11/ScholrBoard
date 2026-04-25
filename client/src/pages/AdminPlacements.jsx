import { useState } from 'react';

const placements = [
	{ id: 1, company: 'TCS', role: 'Software Engineer', package: '12 LPA', positions: 15, deadline: '2025-03-20', applicants: 23, status: 'Active' },
	{ id: 2, company: 'Microsoft', role: 'SDE Intern', package: '60k/month', positions: 5, deadline: '2025-04-10', applicants: 47, status: 'Active' },
	{ id: 3, company: 'Infosys', role: 'System Engineer', package: '8 LPA', positions: 25, deadline: '2025-03-15', applicants: 67, status: 'Active' },
	{ id: 4, company: 'Google', role: 'Software Developer', package: '25 LPA', positions: 3, deadline: '2025-04-01', applicants: 89, status: 'Active' },
	{ id: 5, company: 'Amazon', role: 'SDE-1', package: '18 LPA', positions: 8, deadline: '2025-03-25', applicants: 156, status: 'Closed' },
];

export function AdminPlacements() {
	const [searchTerm, setSearchTerm] = useState('');
	const [filterStatus, setFilterStatus] = useState('All');
	const [showAddModal, setShowAddModal] = useState(false);

	const filteredPlacements = placements.filter(placement => 
		(placement.company.toLowerCase().includes(searchTerm.toLowerCase()) || 
		 placement.role.toLowerCase().includes(searchTerm.toLowerCase())) &&
		(filterStatus === 'All' || placement.status === filterStatus)
	);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Placements & Jobs</h1>
					<p className="mt-2" style={{color:'var(--text-secondary)'}}>Manage placement opportunities and job postings</p>
				</div>
				<button 
					onClick={() => setShowAddModal(true)}
					className="btn btn-primary"
				>
					Add New Opportunity
				</button>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="card p-4">
					<div className="text-2xl font-bold" style={{color:'var(--primary-blue)'}}>56</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Positions</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-green-400">382</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Applications</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-blue-400">4</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Active Postings</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-yellow-400">87%</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Placement Rate</div>
				</div>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-4">
				<input
					type="text"
					placeholder="Search companies or roles..."
					className="input-dark px-3 py-2 flex-1 min-w-[200px]"
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
				/>
				<select
					className="input-dark px-3 py-2"
					value={filterStatus}
					onChange={(e) => setFilterStatus(e.target.value)}
				>
					<option value="All">All Status</option>
					<option value="Active">Active</option>
					<option value="Closed">Closed</option>
				</select>
			</div>

			{/* Placements Table */}
			<div className="card p-6">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b" style={{borderColor:'var(--border-color)'}}>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Company</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Role</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Package</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Positions</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Deadline</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Applicants</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Status</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Actions</th>
							</tr>
						</thead>
						<tbody>
							{filteredPlacements.map((placement) => (
								<tr key={placement.id} className="border-b" style={{borderColor:'var(--border-color)'}}>
									<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{placement.company}</td>
									<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{placement.role}</td>
									<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{placement.package}</td>
									<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{placement.positions}</td>
									<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{placement.deadline}</td>
									<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{placement.applicants}</td>
									<td className="py-3 px-4">
										<span className={`badge ${
											placement.status === 'Active' ? 'badge-success' : 'badge-error'
										}`}> 
											{placement.status}
										</span>
									</td>
									<td className="py-3 px-4">
										<div className="flex gap-2">
											<button className="btn btn-outline btn-sm">Edit</button>
											<button className="btn btn-outline btn-sm">Applicants</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Top Companies */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="card p-6">
					<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Top Hiring Companies</h3>
					<div className="space-y-3">
						{[
							{ company: 'TCS', hires: 45, package: '8-12 LPA' },
							{ company: 'Infosys', hires: 38, package: '7-10 LPA' },
							{ company: 'Microsoft', hires: 12, package: '15-25 LPA' },
							{ company: 'Amazon', hires: 18, package: '12-20 LPA' },
						].map((company, index) => (
							<div key={index} className="flex justify-between items-center py-2 border-b" style={{borderColor:'var(--border-color)'}}>
								<div>
									<div style={{color:'var(--text-primary)'}}>{company.company}</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>{company.package}</div>
								</div>
								<div className="text-right">
									<div style={{color:'var(--text-primary)'}}>{company.hires} hires</div>
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="card p-6">
					<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Placement Statistics</h3>
					<div className="space-y-3">
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>CSE Placements</span>
								<span>92%</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-blue-500" style={{width:'92%'}} />
							</div>
						</div>
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>ECE Placements</span>
								<span>88%</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-green-500" style={{width:'88%'}} />
							</div>
						</div>
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>ME Placements</span>
								<span>83%</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-yellow-500" style={{width:'83%'}} />
							</div>
						</div>
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>CE Placements</span>
								<span>79%</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-purple-500" style={{width:'79%'}} />
							</div>
						</div>
					</div>
				</div>
			</div>

		</div>
	);
}
