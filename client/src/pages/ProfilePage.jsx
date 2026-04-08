import { useState } from 'react';
import { useProfile } from '../contexts/ProfileContext.jsx';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';

export function ProfilePage() {
	const [editing, setEditing] = useState(false);
	const { profile, updateProfile, isLoading } = useProfile();

	// Scroll animation hooks
	const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
	const streaksRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });
	const detailsRef = useScrollAnimation({ animationClass: 'fade-in-left', delay: 0.3 });
	const linksRef = useScrollAnimation({ animationClass: 'fade-in-right', delay: 0.4 });

	const save = () => {
		setEditing(false);
	};

	if (isLoading) {
		return <div className="flex items-center justify-center h-64">Loading...</div>;
	}

	return (
		<div className="space-y-6">
			<h1 ref={headerRef} className="headline gpu-accelerated">My Profile</h1>
			<div ref={streaksRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
				<div className="font-medium mb-2">Daily Activity Streaks</div>
				<div className="grid md:grid-cols-3 gap-4 text-sm">
					<div>
						<div className="subtle">LeetCode Streak</div>
						<div className="w-full bg-slate-700 rounded-full h-2 mt-2">
							<div className="bg-cyan-400 h-2 rounded-full" style={{width:'60%'}} />
						</div>
						<div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>12 days</div>
					</div>
					<div>
						<div className="subtle">GitHub Contributions</div>
						<div className="w-full bg-slate-700 rounded-full h-2 mt-2">
							<div className="bg-green-500 h-2 rounded-full" style={{width:'45%'}} />
						</div>
						<div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>7 days</div>
					</div>
					<div>
						<div className="subtle">Daily Learning Goal</div>
						<div className="w-full bg-slate-700 rounded-full h-2 mt-2">
							<div className="bg-indigo-400 h-2 rounded-full" style={{width:'70%'}} />
						</div>
						<div className="text-xs mt-1" style={{color:'var(--text-secondary)'}}>Goal: 45 mins/day</div>
					</div>
				</div>
			</div>
			<div className="grid md:grid-cols-2 gap-4">
				<div ref={detailsRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
					<div className="font-medium mb-2">Personal Details</div>
					{!editing ? (
						<div>
							<div className="grid grid-cols-2 gap-2 text-sm">
								<div className="subtle">Name</div><div>{profile.name}</div>
								<div className="subtle">Roll No</div><div>{profile.roll}</div>
								<div className="subtle">Department</div><div>{profile.dept}</div>
								<div className="subtle">Year</div><div>{profile.year}</div>
								<div className="subtle">GPA</div><div>{profile.gpa}</div>
								<div className="subtle">Email</div><div>{profile.email}</div>
							</div>
							<div className="mt-4"><button className="btn btn-primary" onClick={()=>setEditing(true)}>Edit</button></div>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-3 text-sm">
							<label className="subtle">Name<input className="input-dark mt-1 w-full" value={profile.name} onChange={e=>updateProfile({name:e.target.value})}/></label>
							<label className="subtle">Roll<input className="input-dark mt-1 w-full" value={profile.roll} onChange={e=>updateProfile({roll:e.target.value})}/></label>
							<label className="subtle">Department<input className="input-dark mt-1 w-full" value={profile.dept} onChange={e=>updateProfile({dept:e.target.value})}/></label>
							<label className="subtle">Year<input className="input-dark mt-1 w-full" value={profile.year} onChange={e=>updateProfile({year:e.target.value})}/></label>
							<label className="subtle">GPA<input className="input-dark mt-1 w-full" value={profile.gpa} onChange={e=>updateProfile({gpa:e.target.value})}/></label>
							<label className="subtle">Email<input className="input-dark mt-1 w-full" value={profile.email} onChange={e=>updateProfile({email:e.target.value})}/></label>
							<div className="col-span-2 flex gap-2 mt-2">
								<button className="btn btn-primary" onClick={save}>Save</button>
								<button className="btn btn-outline" onClick={()=>setEditing(false)}>Cancel</button>
							</div>
						</div>
					)}
				</div>
				<div ref={linksRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
					<div className="font-medium mb-2">Quick Links</div>
					<div className="text-sm space-y-2">
						<div><a className="text-brand-blue underline hover:text-blue-300 transition-colors" onClick={()=>setEditing(true)}>Edit Profile</a></div>
						<div><a className="text-brand-blue underline hover:text-blue-300 transition-colors" href="/student/portfolio">View Portfolio</a></div>
						<div><a className="text-brand-blue underline hover:text-blue-300 transition-colors" href="/student/coding">Coding Profiles</a></div>
					</div>
				</div>
			</div>
		</div>
	);
}
