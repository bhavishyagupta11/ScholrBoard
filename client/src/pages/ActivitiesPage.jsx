import { useState } from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation.js';

const initial = [
	{ id: 1, title: 'Hackathon Winner', category: 'Competitions', status: 'Approved' },
	{ id: 2, title: 'Robotics Workshop', category: 'Certifications', status: 'Rejected' },
	{ id: 3, title: 'NSS Camp', category: 'Volunteering', status: 'Pending' },
];

export function ActivitiesPage() {
	const [activities, setActivities] = useState(initial);

	// Scroll animation hooks
	const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
	const tableRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });

	const onDelete = (id) => setActivities(activities.filter(a => a.id !== id));
	const onEdit = (id) => alert('Edit ' + id);

	return (
		<div>
			<h1 ref={headerRef} className="headline mb-4 gpu-accelerated">My Activities</h1>
			<div ref={tableRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
				<table className="w-full text-sm">
					<thead>
						<tr className="text-left text-slate-500">
							<th className="py-2">Title</th>
							<th className="py-2">Category</th>
							<th className="py-2">Status</th>
							<th className="py-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						{activities.map(a => (
							<tr key={a.id} className="border-t hover:bg-white/5 transition-colors">
								<td className="py-2">{a.title}</td>
								<td className="py-2">{a.category}</td>
								<td className="py-2"><span className={`badge ${a.status==='Approved'?'badge-green': a.status==='Pending'?'badge-yellow':'badge-red'}`}>{a.status}</span></td>
								<td className="py-2 flex gap-2">
									<button className="btn btn-outline hover:scale-105 transition-transform" onClick={()=>onEdit(a.id)}>Edit</button>
									<button className="btn btn-outline hover:scale-105 transition-transform" onClick={()=>onDelete(a.id)}>Delete</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
