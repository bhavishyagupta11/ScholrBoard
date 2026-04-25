
export function AdminAnalytics() {
	const generateReport = (type) => {
		alert(`${type} Report generated successfully!\n\nData included:\n- Total Students: 370\n- Total Activities: 127\n- Approval Rate: 94%\n- Generated: ${new Date().toLocaleDateString()}`);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Analytics & Reports</h1>
				<p className="mt-2" style={{color:'var(--text-secondary)'}}>Generate institutional reports and view detailed analytics</p>
			</div>

			{/* Key Metrics */}
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

			{/* Department Analytics */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="card p-6">
					<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Department-wise Statistics</h3>
					<div className="space-y-3">
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>Computer Science (CSE)</span>
								<span>120 students</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-blue-500" style={{width:'40%'}} />
							</div>
						</div>
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>Electronics (ECE)</span>
								<span>90 students</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-green-500" style={{width:'30%'}} />
							</div>
						</div>
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>Mechanical (ME)</span>
								<span>85 students</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-yellow-500" style={{width:'28%'}} />
							</div>
						</div>
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>Civil (CE)</span>
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
								<span>Leadership Roles</span>
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
				<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Institutional Reports</h3>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<button 
						onClick={() => generateReport('NAAC')}
						className="btn btn-outline p-4 h-auto"
					>
						<div className="text-left">
							<div className="font-semibold">NAAC Report</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>National Assessment and Accreditation Council</div>
						</div>
					</button>
					<button 
						onClick={() => generateReport('NIRF')}
						className="btn btn-outline p-4 h-auto"
					>
						<div className="text-left">
							<div className="font-semibold">NIRF Report</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>National Institutional Ranking Framework</div>
						</div>
					</button>
					<button 
						onClick={() => alert('Student performance data exported to Excel successfully!')}
						className="btn btn-outline p-4 h-auto"
					>
						<div className="text-left">
							<div className="font-semibold">Export Data</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>Download Excel reports</div>
						</div>
					</button>
				</div>
			</div>

			{/* Performance Metrics */}
			<div className="card p-6">
				<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Institutional Performance</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div className="space-y-3">
						<div className="flex justify-between">
							<span>Average GPA</span>
							<span style={{color:'var(--text-primary)'}}>8.4/10</span>
						</div>
						<div className="flex justify-between">
							<span>Activities per Student</span>
							<span style={{color:'var(--text-primary)'}}>3.2</span>
						</div>
						<div className="flex justify-between">
							<span>Employment Rate</span>
							<span style={{color:'var(--text-primary)'}}>87%</span>
						</div>
						<div className="flex justify-between">
							<span>Alumni Satisfaction</span>
							<span style={{color:'var(--text-primary)'}}>4.6/5</span>
						</div>
					</div>
					<div className="space-y-3">
						<div className="flex justify-between">
							<span>Faculty-Student Ratio</span>
							<span style={{color:'var(--text-primary)'}}>1:15</span>
						</div>
						<div className="flex justify-between">
							<span>Research Publications</span>
							<span style={{color:'var(--text-primary)'}}>156</span>
						</div>
						<div className="flex justify-between">
							<span>Industry Partnerships</span>
							<span style={{color:'var(--text-primary)'}}>23</span>
						</div>
						<div className="flex justify-between">
							<span>Campus Infrastructure</span>
							<span style={{color:'var(--text-primary)'}}>Excellent</span>
						</div>
					</div>
				</div>
			</div>

		</div>
	);
}
