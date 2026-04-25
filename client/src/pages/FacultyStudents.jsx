import { useState } from 'react';

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

export function FacultyStudents() {
	const [searchTerm, setSearchTerm] = useState('');
	const [filterDept, setFilterDept] = useState('All');

	const filteredStudents = students.filter(student => 
		(filterDept === 'All' || student.dept === filterDept) &&
		(student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
		 student.rollNo.toLowerCase().includes(searchTerm.toLowerCase()))
	);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Student Tracker</h1>
				<p className="mt-2" style={{color:'var(--text-secondary)'}}>Monitor student progress and academic performance</p>
			</div>

			{/* Quick Stats */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="card p-4">
					<div className="text-2xl font-bold" style={{color:'var(--primary-blue)'}}>{students.length}</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Students</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-green-400">
						{Math.round(students.reduce((acc, s) => acc + s.gpa, 0) / students.length * 10) / 10}
					</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Average GPA</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-blue-400">
						{Math.round(students.reduce((acc, s) => acc + s.attendance, 0) / students.length)}%
					</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Average Attendance</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-purple-400">
						{Math.round(students.reduce((acc, s) => acc + s.activities, 0) / students.length)}
					</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Avg Activities</div>
				</div>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-4">
				<input
					type="text"
					placeholder="Search students..."
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
			</div>

			{/* Students Table */}
			<div className="card p-6">
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

		</div>
	);
}
