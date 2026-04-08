import { Save, Copy, Link as LinkIcon, Github, Award, Briefcase } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useProfile } from '../contexts/ProfileContext.jsx';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';

const codingData = [
	{ lang: 'C++', solved: 120 },
	{ lang: 'Python', solved: 90 },
	{ lang: 'Java', solved: 40 },
];

export function PortfolioPage() {
	const { profile } = useProfile();

	// Scroll animation hooks
	const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
	const profileRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.2 });
	const certsRef = useScrollAnimation({ animationClass: 'fade-in-left', delay: 0.3 });
	const projectsRef = useScrollAnimation({ animationClass: 'fade-in-right', delay: 0.4 });
	const skillsRef = useScrollAnimation({ animationClass: 'fade-in-left', delay: 0.5 });
	const linksRef = useScrollAnimation({ animationClass: 'fade-in-right', delay: 0.6 });
	const codingRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.7 });
	const trackerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.8 });
	
	return (
		<div className="space-y-6">
			<h1 ref={headerRef} className="text-2xl font-semibold gpu-accelerated">Portfolio</h1>

			<div ref={profileRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
				<div className="grid md:grid-cols-4 gap-4">
					<div>
						<div className="text-sm text-slate-500">Name</div>
						<div className="font-semibold">{profile.name}</div>
					</div>
					<div>
						<div className="text-sm text-slate-500">Roll No</div>
						<div className="font-semibold">{profile.roll}</div>
					</div>
					<div>
						<div className="text-sm text-slate-500">GPA</div>
						<div className="font-semibold">{profile.gpa}</div>
					</div>
					<div className="flex items-end gap-2">
						<button className="btn btn-outline hover:scale-105 transition-transform"><Save size={16}/> Download PDF</button>
						<button className="btn btn-outline hover:scale-105 transition-transform"><Copy size={16}/> Copy Link</button>
					</div>
				</div>
			</div>

			<div className="grid md:grid-cols-2 gap-4">
				<div ref={certsRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
					<div className="font-medium mb-2 flex items-center gap-2"><Award size={16}/> Certifications</div>
					<ul className="list-disc pl-5 text-sm space-y-1">
						{(profile.certifications || []).map((cert, i) => (
							<li key={i}>{cert}</li>
						))}
					</ul>
				</div>
				<div ref={projectsRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
					<div className="font-medium mb-2 flex items-center gap-2"><Briefcase size={16}/> Projects</div>
					<ul className="list-disc pl-5 text-sm space-y-1">
						{(profile.projects || []).map((project, i) => (
							<li key={i}>{project.name} – {project.tech}</li>
						))}
					</ul>
					<div className="mt-3 flex items-center gap-2 text-sm">
						<Github size={16}/>
						<a href="https://github.com/username" target="_blank" className="text-brand-blue underline hover:text-blue-300 transition-colors">github.com/username</a>
					</div>
				</div>
			</div>

			<div className="grid md:grid-cols-2 gap-4">
				<div ref={skillsRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
					<div className="font-medium mb-2">Skills</div>
					<div className="flex flex-wrap gap-2 text-xs">
						{(profile.skills || []).map(s=> (
							<span key={s} className="px-2 py-1 rounded-full hover:scale-110 transition-transform" style={{background:'rgba(88,166,255,0.12)', color:'#58A6FF', border:'1px solid rgba(88,166,255,0.3)'}}>{s}</span>
						))}
					</div>
				</div>
				<div ref={linksRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
					<div className="font-medium mb-2 flex items-center gap-2"><LinkIcon size={16}/> Links</div>
					<div className="grid grid-cols-2 gap-3 text-sm">
						<a className="text-brand-blue underline hover:text-blue-300 transition-colors" target="_blank" href="#">Portfolio URL</a>
						<a className="text-brand-blue underline hover:text-blue-300 transition-colors" target="_blank" href="https://linkedin.com/in/username">LinkedIn</a>
						<a className="text-brand-blue underline hover:text-blue-300 transition-colors" target="_blank" href="https://leetcode.com/username">LeetCode</a>
						<a className="text-brand-blue underline hover:text-blue-300 transition-colors" target="_blank" href="https://codeforces.com/profile/username">Codeforces</a>
					</div>
				</div>
			</div>

			<div ref={codingRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
				<div className="font-medium mb-3">Coding Profile</div>
				<div className="grid md:grid-cols-3 gap-4">
					<div className="space-y-2">
						<div className="text-sm subtle">Problems Solved</div>
						<div className="text-2xl font-bold text-brand-blue">{profile.codingStats?.problemsSolved || 250}</div>
						<div className="text-sm subtle">Contest Rating</div>
						<div className="text-2xl font-bold text-brand-green">{profile.codingStats?.contestRating || 1620}</div>
					</div>
					<div className="md:col-span-2 h-48">
						<ResponsiveContainer width="100%" height="100%">
							<BarChart data={codingData}>
								<XAxis dataKey="lang" />
								<YAxis />
								<Tooltip />
								<Bar dataKey="solved" fill="#1e40af" />
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>

			<div ref={trackerRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
				<div className="font-medium mb-2">Activity Tracker</div>
				<div className="grid md:grid-cols-3 gap-4 text-sm">
					<div>
						<div className="subtle">Portfolio Completion</div>
						<div className="w-full bg-slate-700 rounded-full h-2 mt-2">
							<div className="bg-gradient-to-r from-brand-blue to-brand-green h-2 rounded-full" style={{width:'85%'}} />
						</div>
					</div>
					<div>
						<div className="subtle">Activities Approved</div>
						<div className="w-full bg-slate-700 rounded-full h-2 mt-2">
							<div className="bg-green-500 h-2 rounded-full" style={{width:'78%'}} />
						</div>
					</div>
					<div>
						<div className="subtle">Coding Goal (weekly)</div>
						<div className="w-full bg-slate-700 rounded-full h-2 mt-2">
							<div className="bg-cyan-400 h-2 rounded-full" style={{width:'65%'}} />
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
