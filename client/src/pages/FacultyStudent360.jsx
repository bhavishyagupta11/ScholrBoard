import { useState } from 'react';

const students = [
	{
		id: 1,
		name: 'Ananya Sharma',
		rollNo: 'CSE001',
		dept: 'CSE',
		year: '3rd Year',
		gpa: 8.7,
		attendance: 92,
		email: 'ananya.sharma@jecrc.edu',
		phone: '+91 98765 43210',
		codingProfile: {
			leetcode: { solved: 156, rating: 1850, contests: 23 },
			codechef: { solved: 89, rating: 4, contests: 15 },
			codeforces: { solved: 67, rating: 1400, contests: 12 },
			hackerrank: { solved: 234, badges: 8 }
		},
		assignments: [
			{ subject: 'Data Structures', completed: 12, total: 15, grade: 'A' },
			{ subject: 'Computer Networks', completed: 8, total: 10, grade: 'A-' },
			{ subject: 'Database Systems', completed: 14, total: 16, grade: 'A' },
			{ subject: 'Software Engineering', completed: 9, total: 12, grade: 'B+' },
			{ subject: 'Machine Learning', completed: 11, total: 13, grade: 'A-' }
		],
		projects: [
			{ name: 'E-Commerce Website', tech: 'React, Node.js, MongoDB', status: 'Completed', grade: 'A' },
			{ name: 'Student Management System', tech: 'Java, MySQL', status: 'Completed', grade: 'A-' },
			{ name: 'AI Chatbot', tech: 'Python, TensorFlow', status: 'In Progress', grade: 'Pending' },
			{ name: 'Mobile App Development', tech: 'Flutter, Firebase', status: 'Completed', grade: 'B+' }
		],
		activities: [
			{ name: 'Hackathon Winner', type: 'Technical', date: '2025-01-15', status: 'Approved' },
			{ name: 'Research Paper Publication', type: 'Academic', date: '2025-01-10', status: 'Approved' },
			{ name: 'Tech Symposium Speaker', type: 'Leadership', date: '2025-01-05', status: 'Pending' }
		]
	},
	{
		id: 2,
		name: 'Rohan Gupta',
		rollNo: 'CSE002',
		dept: 'CSE',
		year: '3rd Year',
		gpa: 8.2,
		attendance: 88,
		email: 'rohan.gupta@jecrc.edu',
		phone: '+91 98765 43211',
		codingProfile: {
			leetcode: { solved: 98, rating: 1650, contests: 18 },
			codechef: { solved: 67, rating: 3, contests: 12 },
			codeforces: { solved: 45, rating: 1200, contests: 8 },
			hackerrank: { solved: 156, badges: 5 }
		},
		assignments: [
			{ subject: 'Data Structures', completed: 10, total: 15, grade: 'B+' },
			{ subject: 'Computer Networks', completed: 7, total: 10, grade: 'B' },
			{ subject: 'Database Systems', completed: 12, total: 16, grade: 'A-' },
			{ subject: 'Software Engineering', completed: 8, total: 12, grade: 'B+' },
			{ subject: 'Machine Learning', completed: 9, total: 13, grade: 'B' }
		],
		projects: [
			{ name: 'Library Management System', tech: 'Java, MySQL', status: 'Completed', grade: 'B+' },
			{ name: 'Weather App', tech: 'React Native', status: 'Completed', grade: 'B' },
			{ name: 'Data Analysis Tool', tech: 'Python, Pandas', status: 'In Progress', grade: 'Pending' }
		],
		activities: [
			{ name: 'Coding Competition Winner', type: 'Technical', date: '2025-01-12', status: 'Approved' },
			{ name: 'Tech Blog Writing', type: 'Academic', date: '2025-01-08', status: 'Approved' }
		]
	}
];

export function FacultyStudent360() {
	const [selectedStudent, setSelectedStudent] = useState(students[0]);
	const [activeTab, setActiveTab] = useState('overview');

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Student 360° View</h1>
				<p className="mt-2" style={{color:'var(--text-secondary)'}}>Comprehensive student progress and academic tracking</p>
			</div>

			{/* Student Selector */}
			<div className="card p-6">
				<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Select Student</h3>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{students.map((student) => (
						<div
							key={student.id}
							onClick={() => setSelectedStudent(student)}
							className={`p-4 rounded-lg cursor-pointer transition-colors ${
								selectedStudent.id === student.id 
									? 'bg-blue-500/20 border-2 border-blue-500' 
									: 'bg:white/5 border border-gray-600 hover:bg-white/10'
							}`}
						>
							<div className="flex justify-between items-start">
								<div>
									<div className="font-semibold" style={{color:'var(--text-primary)'}}>{student.name}</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>{student.rollNo} • {student.dept}</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>GPA: {student.gpa} • Attendance: {student.attendance}%</div>
								</div>
								<div className="text-right">
									<div className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{student.year}</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Student Details */}
			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				{/* Student Info */}
				<div className="lg:col-span-1">
					<div className="card p-6">
						<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Student Information</h3>
						<div className="space-y-3">
							<div>
								<div className="text-sm" style={{color:'var(--text-secondary)'}}>Name</div>
								<div style={{color:'var(--text-primary)'}}>{selectedStudent.name}</div>
							</div>
							<div>
								<div className="text-sm" style={{color:'var(--text-secondary)'}}>Roll Number</div>
								<div style={{color:'var(--text-primary)'}}>{selectedStudent.rollNo}</div>
							</div>
							<div>
								<div className="text-sm" style={{color:'var(--text-secondary)'}}>Department</div>
								<div style={{color:'var(--text-primary)'}}>{selectedStudent.dept}</div>
							</div>
							<div>
								<div className="text-sm" style={{color:'var(--text-secondary)'}}>Year</div>
								<div style={{color:'var(--text-primary)'}}>{selectedStudent.year}</div>
							</div>
							<div>
								<div className="text-sm" style={{color:'var(--text-secondary)'}}>Email</div>
								<div style={{color:'var(--text-primary)'}}>{selectedStudent.email}</div>
							</div>
							<div>
								<div className="text-sm" style={{color:'var(--text-secondary)'}}>Phone</div>
								<div style={{color:'var(--text-primary)'}}>{selectedStudent.phone}</div>
							</div>
						</div>
					</div>
				</div>

				{/* Main Content */}
				<div className="lg:col-span-3">
					{/* Tab Navigation */}
					<div className="border-b" style={{borderColor:'var(--border-color)'}}>
						<div className="flex space-x-8">
							<button
								onClick={() => setActiveTab('overview')}
								className={`py-2 px-1 border-b-2 font-medium text-sm ${
									activeTab === 'overview' 
										? 'border-blue-500 text-blue-500' 
										: 'border-transparent text-gray-400 hover:text-white'
								}`}
							>
								Overview
							</button>
							<button
								onClick={() => setActiveTab('coding')}
								className={`py-2 px-1 border-b-2 font-medium text-sm ${
									activeTab === 'coding' 
										? 'border-blue-500 text-blue-500' 
										: 'border-transparent text-gray-400 hover:text-white'
								}`}
							>
								Coding Profile
							</button>
							<button
								onClick={() => setActiveTab('assignments')}
								className={`py-2 px-1 border-b-2 font-medium text-sm ${
									activeTab === 'assignments' 
										? 'border-blue-500 text-blue-500' 
										: 'border-transparent text-gray-400 hover:text-white'
								}`}
							>
								Assignments
							</button>
							<button
								onClick={() => setActiveTab('projects')}
								className={`py-2 px-1 border-b-2 font-medium text-sm ${
									activeTab === 'projects' 
										? 'border-blue-500 text-blue-500' 
										: 'border-transparent text-gray-400 hover:text-white'
								}`}
							>
								Projects
							</button>
							<button
								onClick={() => setActiveTab('activities')}
								className={`py-2 px-1 border-b-2 font-medium text-sm ${
									activeTab === 'activities' 
										? 'border-blue-500 text-blue-500' 
										: 'border-transparent text-gray-400 hover:text-white'
								}`}
							>
								Activities
							</button>
						</div>
					</div>

					{/* Tab Content */}
					{activeTab === 'overview' && (
						<div className="card p-6 mt-6">
							<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Academic Overview</h3>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								<div className="text-center p-4 rounded-lg" style={{background:'var(--bg-medium)'}}>
									<div className="text-3xl font-bold text-green-400">{selectedStudent.gpa}</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>Current GPA</div>
								</div>
								<div className="text-center p-4 rounded-lg" style={{background:'var(--bg-medium)'}}>
									<div className="text-3xl font-bold text-blue-400">{selectedStudent.attendance}%</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>Attendance</div>
								</div>
								<div className="text-center p-4 rounded-lg" style={{background:'var(--bg-medium)'}}>
									<div className="text-3xl font-bold text-purple-400">{selectedStudent.assignments.reduce((acc, a) => acc + a.completed, 0)}</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>Assignments Done</div>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'coding' && (
						<div className="card p-6 mt-6">
							<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Coding Profile</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div className="space-y-4">
									<div className="p-4 rounded-lg" style={{background:'var(--bg-medium)'}}>
										<div className="flex justify-between items-center mb-2">
											<span className="font-medium" style={{color:'var(--text-primary)'}}>LeetCode</span>
											<span className="text-sm" style={{color:'var(--text-secondary)'}}>{selectedStudent.codingProfile.leetcode.solved} solved</span>
										</div>
										<div className="flex justify-between text-sm mb-1">
											<span>Rating</span>
											<span>{selectedStudent.codingProfile.leetcode.rating}</span>
										</div>
										<div className="flex justify-between text-sm">
											<span>Contests</span>
											<span>{selectedStudent.codingProfile.leetcode.contests}</span>
										</div>
									</div>
									<div className="p-4 rounded-lg" style={{background:'var(--bg-medium)'}}>
										<div className="flex justify-between items-center mb-2">
											<span className="font-medium" style={{color:'var(--text-primary)'}}>CodeChef</span>
											<span className="text-sm" style={{color:'var(--text-secondary)'}}>{selectedStudent.codingProfile.codechef.solved} solved</span>
										</div>
										<div className="flex justify-between text-sm mb-1">
											<span>Rating</span>
											<span>{selectedStudent.codingProfile.codechef.rating}⭐</span>
										</div>
										<div className="flex justify-between text-sm">
											<span>Contests</span>
											<span>{selectedStudent.codingProfile.codechef.contests}</span>
										</div>
									</div>
								</div>
								<div className="space-y-4">
									<div className="p-4 rounded-lg" style={{background:'var(--bg-medium)'}}>
										<div className="flex justify-between items-center mb-2">
											<span className="font-medium" style={{color:'var(--text-primary)'}}>Codeforces</span>
											<span className="text-sm" style={{color:'var(--text-secondary)'}}>{selectedStudent.codingProfile.codeforces.solved} solved</span>
										</div>
										<div className="flex justify-between text-sm mb-1">
											<span>Rating</span>
											<span>{selectedStudent.codingProfile.codeforces.rating}</span>
										</div>
										<div className="flex justify-between text-sm">
											<span>Contests</span>
											<span>{selectedStudent.codingProfile.codeforces.contests}</span>
										</div>
									</div>
									<div className="p-4 rounded-lg" style={{background:'var(--bg-medium)'}}>
										<div className="flex justify-between items-center mb-2">
											<span className="font-medium" style={{color:'var(--text-primary)'}}>HackerRank</span>
											<span className="text-sm" style={{color:'var(--text-secondary)'}}>{selectedStudent.codingProfile.hackerrank.solved} solved</span>
										</div>
										<div className="flex justify-between text-sm">
											<span>Badges</span>
											<span>{selectedStudent.codingProfile.hackerrank.badges}</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}

					{activeTab === 'assignments' && (
						<div className="card p-6 mt-6">
							<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Assignment Progress</h3>
							<div className="space-y-4">
								{selectedStudent.assignments.map((assignment, index) => (
									<div key={index} className="p-4 rounded-lg" style={{background:'var(--bg-medium)'}}>
										<div className="flex justify-between items-center mb-2">
											<span className="font-medium" style={{color:'var(--text-primary)'}}>{assignment.subject}</span>
											<span className={`badge ${assignment.grade === 'A' ? 'badge-success' : assignment.grade === 'A-' ? 'badge-success' : 'badge-warning'}`}>
												{assignment.grade}
											</span>
										</div>
										<div className="flex justify-between text-sm mb-2">
											<span>Progress</span>
											<span>{assignment.completed}/{assignment.total}</span>
										</div>
										<div className="w-full bg-slate-700 rounded-full h-2">
											<div 
												className="h-2 rounded-full bg-blue-500" 
												style={{width:`${(assignment.completed/assignment.total)*100}%`}}
											/>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{activeTab === 'projects' && (
						<div className="card p-6 mt-6">
							<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Project Portfolio</h3>
							<div className="space-y-4">
								{selectedStudent.projects.map((project, index) => (
									<div key={index} className="p-4 rounded-lg" style={{background:'var(--bg-medium)'}}>
										<div className="flex justify-between items-start mb-2">
											<span className="font-medium" style={{color:'var(--text-primary)'}}>{project.name}</span>
											<span className={`badge ${project.status === 'Completed' ? 'badge-success' : 'badge-warning'}`}>
												{project.status}
											</span>
										</div>
										<div className="text-sm mb-2" style={{color:'var(--text-secondary)'}}>Tech Stack: {project.tech}</div>
										{project.grade !== 'Pending' && (
											<div className="text-sm" style={{color:'var(--text-primary)'}}>Grade: {project.grade}</div>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{activeTab === 'activities' && (
						<div className="card p-6 mt-6">
							<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Student Activities</h3>
							<div className="space-y-4">
								{selectedStudent.activities.map((activity, index) => (
									<div key={index} className="p-4 rounded-lg" style={{background:'var(--bg-medium)'}}>
										<div className="flex justify-between items-start mb-2">
											<span className="font-medium" style={{color:'var(--text-primary)'}}>{activity.name}</span>
											<span className={`badge ${activity.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>
												{activity.status}
											</span>
										</div>
										<div className="flex justify-between text-sm">
											<span style={{color:'var(--text-secondary)'}}>Type: {activity.type}</span>
											<span style={{color:'var(--text-secondary)'}}>Date: {activity.date}</span>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

		</div>
	);
}
