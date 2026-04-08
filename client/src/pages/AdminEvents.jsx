import { useState } from 'react';

const events = [
	{ id: 1, name: 'Tech Fest 2025', date: '2025-03-15', venue: 'Main Auditorium', type: 'Technical', registrations: 156, capacity: 200, status: 'Upcoming' },
	{ id: 2, name: 'Industry Expert Talk', date: '2025-04-05', venue: 'Conference Hall', type: 'Seminar', registrations: 89, capacity: 100, status: 'Upcoming' },
	{ id: 3, name: 'Career Fair 2025', date: '2025-04-20', venue: 'Sports Complex', type: 'Career', registrations: 234, capacity: 300, status: 'Upcoming' },
	{ id: 4, name: 'Annual Sports Meet', date: '2025-02-28', venue: 'Sports Ground', type: 'Sports', registrations: 145, capacity: 150, status: 'Completed' },
	{ id: 5, name: 'Cultural Fest', date: '2025-03-10', venue: 'Open Air Theatre', type: 'Cultural', registrations: 189, capacity: 250, status: 'Upcoming' },
];

export function AdminEvents() {
	const [searchTerm, setSearchTerm] = useState('');
	const [filterType, setFilterType] = useState('All');
	const [filterStatus, setFilterStatus] = useState('All');

	const filteredEvents = events.filter(event => 
		event.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
		(filterType === 'All' || event.type === filterType) &&
		(filterStatus === 'All' || event.status === filterStatus)
	);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold" style={{color:'var(--text-primary)'}}>Events & Activities</h1>
					<p className="mt-2" style={{color:'var(--text-secondary)'}}>Manage university events and student activities</p>
				</div>
				<button className="btn btn-primary">
					Create New Event
				</button>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div className="card p-4">
					<div className="text-2xl font-bold" style={{color:'var(--primary-blue)'}}>12</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Events</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-green-400">813</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Total Registrations</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-blue-400">4</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Upcoming Events</div>
				</div>
				<div className="card p-4">
					<div className="text-2xl font-bold text-yellow-400">92%</div>
					<div className="text-sm" style={{color:'var(--text-secondary)'}}>Avg Attendance</div>
				</div>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-4">
				<input
					type="text"
					placeholder="Search events..."
					className="input-dark px-3 py-2 flex-1 min-w-[200px]"
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
				/>
				<select
					className="input-dark px-3 py-2"
					value={filterType}
					onChange={(e) => setFilterType(e.target.value)}
				>
					<option value="All">All Types</option>
					<option value="Technical">Technical</option>
					<option value="Cultural">Cultural</option>
					<option value="Sports">Sports</option>
					<option value="Career">Career</option>
					<option value="Seminar">Seminar</option>
				</select>
				<select
					className="input-dark px-3 py-2"
					value={filterStatus}
					onChange={(e) => setFilterStatus(e.target.value)}
				>
					<option value="All">All Status</option>
					<option value="Upcoming">Upcoming</option>
					<option value="Completed">Completed</option>
					<option value="Cancelled">Cancelled</option>
				</select>
			</div>

			{/* Events Table */}
			<div className="card p-6">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b" style={{borderColor:'var(--border-color)'}}>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Event</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Date</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Venue</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Type</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Registrations</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Status</th>
								<th className="text-left py-3 px-4" style={{color:'var(--text-secondary)'}}>Actions</th>
							</tr>
						</thead>
						<tbody>
							{filteredEvents.map((event) => (
								<tr key={event.id} className="border-b" style={{borderColor:'var(--border-color)'}}>
									<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{event.name}</td>
									<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{event.date}</td>
									<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{event.venue}</td>
									<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>{event.type}</td>
									<td className="py-3 px-4" style={{color:'var(--text-primary)'}}>
										{event.registrations}/{event.capacity}
									</td>
									<td className="py-3 px-4">
										<span className={`badge ${
											event.status === 'Upcoming' ? 'badge-warning' : 
											event.status === 'Completed' ? 'badge-success' : 'badge-error'
										}`}> 
											{event.status}
										</span>
									</td>
									<td className="py-3 px-4">
										<div className="flex gap-2">
											<button className="btn btn-outline btn-sm">Edit</button>
											<button className="btn btn-outline btn-sm">Participants</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{/* Event Categories and Schedule */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="card p-6">
					<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Event Categories</h3>
					<div className="space-y-3">
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>Technical Events</span>
								<span>35%</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-blue-500" style={{width:'35%'}} />
							</div>
						</div>
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>Cultural Events</span>
								<span>30%</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-green-500" style={{width:'30%'}} />
							</div>
						</div>
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>Career Events</span>
								<span>20%</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-yellow-500" style={{width:'20%'}} />
							</div>
						</div>
						<div>
							<div className="flex justify-between text-sm mb-1">
								<span>Sports Events</span>
								<span>15%</span>
							</div>
							<div className="w-full bg-slate-700 rounded-full h-2">
								<div className="h-2 rounded-full bg-purple-500" style={{width:'15%'}} />
							</div>
						</div>
					</div>
				</div>

				<div className="card p-6">
					<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Upcoming Events Schedule</h3>
					<div className="space-y-3">
						{events.filter(e => e.status === 'Upcoming').slice(0, 4).map((event) => (
							<div key={event.id} className="flex justify-between items-center py-2 border-b" style={{borderColor:'var(--border-color)'}}>
								<div>
									<div style={{color:'var(--text-primary)'}}>{event.name}</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>{event.venue}</div>
								</div>
								<div className="text-right">
									<div style={{color:'var(--text-primary)'}}>{event.date}</div>
									<div className="text-sm" style={{color:'var(--text-secondary)'}}>{event.registrations} registered</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Event Management Actions */}
			<div className="card p-6">
				<h3 className="text-lg font-semibold mb-4" style={{color:'var(--text-primary)'}}>Quick Actions</h3>
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<button className="btn btn-outline p-4 h-auto">
						<div className="text-left">
							<div className="font-semibold">Send Notifications</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>Notify students about events</div>
						</div>
					</button>
					<button className="btn btn-outline p-4 h-auto">
						<div className="text-left">
							<div className="font-semibold">Generate Reports</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>Event attendance reports</div>
						</div>
					</button>
					<button className="btn btn-outline p-4 h-auto">
						<div className="text-left">
							<div className="font-semibold">Manage Venues</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>Book and schedule venues</div>
						</div>
					</button>
					<button className="btn btn-outline p-4 h-auto">
						<div className="text-left">
							<div className="font-semibold">Event Calendar</div>
							<div className="text-sm" style={{color:'var(--text-secondary)'}}>View full calendar</div>
						</div>
					</button>
				</div>
			</div>

		</div>
	);
}
