import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

const data = [
	{ name: 'Academic', value: 70 },
	{ name: 'Activities', value: 30 },
];

const COLORS = ['var(--primary-blue)', 'var(--primary-orange)'];

export function AcademicActivityChart() {
	return (
		<ResponsiveContainer width="100%" height="100%">
			<PieChart>
				<Pie
					data={data}
					dataKey="value"
					nameKey="name"
					innerRadius={55}
					outerRadius={90}
					label={(props) => {
						const { name, percent } = props;
						return `${name} ${((percent || 0) * 100).toFixed(0)}%`;
					}}
				>
					{data.map((_, index) => (
						<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
					))}
				</Pie>
				<Tooltip />
				<Legend />
			</PieChart>
		</ResponsiveContainer>
	);
}

export function ContributionsChart({ contributions }) {
	return (
		<ResponsiveContainer width="100%" height="100%">
			<BarChart data={contributions}>
				<CartesianGrid strokeDasharray="3 3" stroke="rgba(122, 102, 80, 0.35)" />
				<XAxis dataKey="d" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
				<Tooltip />
				<Bar dataKey="c" fill="var(--primary-blue)" />
			</BarChart>
		</ResponsiveContainer>
	);
}
