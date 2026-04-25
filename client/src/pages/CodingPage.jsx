import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useScrollAnimation, useStaggeredAnimation } from '../hooks/useScrollAnimation.js';

const platforms = [
	{ name: 'LeetCode', solved: 180, rating: 1650, color: '#58A6FF' },
	{ name: 'CodeChef', solved: 120, rating: 1700, color: '#39C5E4' },
	{ name: 'Codeforces', solved: 95, rating: 1500, color: '#7c3aed' },
	{ name: 'HackerRank', solved: 200, rating: 0, color: '#22c55e' },
];

export function CodingPage() {
	// Scroll animation hooks
	const headerRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.1 });
	const chartRef = useScrollAnimation({ animationClass: 'fade-in-up', delay: 0.3 });
	
	// Staggered animations for platform cards
	const { containerRef: platformsContainerRef, setItemRef: setPlatformRef } = useStaggeredAnimation(4, 0.1);

	return (
		<div className="space-y-6">
			<h1 ref={headerRef} className="headline gpu-accelerated">Coding Profiles</h1>

			<div ref={platformsContainerRef} className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
				{platforms.map((p, index) => (
					<div key={p.name} ref={setPlatformRef(index)} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
						<div className="font-semibold">{p.name}</div>
						<div className="text-sm subtle">Problems Solved</div>
						<div className="text-2xl font-bold text-brand-blue">{p.solved}</div>
						<div className="text-sm subtle mt-2">Contest Rating</div>
						<div className="text-xl font-bold" style={{color:p.color}}>{p.rating || '—'}</div>
					</div>
				))}
			</div>

			<div ref={chartRef} className="card p-4 gpu-accelerated hover:scale-105 transition-transform">
				<div className="font-medium mb-2">Problems Solved by Platform</div>
				<div className="h-72">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={platforms}>
							<XAxis dataKey="name" />
							<YAxis />
							<Tooltip />
							<Legend />
							<Bar dataKey="solved" fill="#58A6FF" />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>
		</div>
	);
}
