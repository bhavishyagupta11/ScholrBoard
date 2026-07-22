import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { EmptyStateCard } from './dashboard/DashboardPrimitives.jsx';
import { Award, BookOpen } from 'lucide-react';

const COLORS = [
  'var(--primary-blue)',
  'var(--primary-orange)',
  '#10b981',
  '#a855f7',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
];

export function AcademicActivityChart({ activities }) {
  const chartData = useMemo(() => {
    if (!activities) return [];
    
    // Prefer byCategory breakdown if populated
    if (activities.byCategory && Object.keys(activities.byCategory).length > 0) {
      return Object.entries(activities.byCategory)
        .filter(([_, count]) => count > 0)
        .map(([name, value]) => ({ name, value }));
    }

    // Fallback to approval status breakdown if real status counts exist
    const statusItems = [];
    if (activities.Approved > 0) statusItems.push({ name: 'Approved Activities', value: activities.Approved });
    if (activities.Pending > 0)  statusItems.push({ name: 'Pending Review',     value: activities.Pending });
    if (activities.Rejected > 0) statusItems.push({ name: 'Needs Revision',     value: activities.Rejected });

    return statusItems;
  }, [activities]);

  const totalCount = chartData.reduce((acc, curr) => acc + curr.value, 0);

  if (!activities || totalCount === 0) {
    return (
      <EmptyStateCard
        icon={Award}
        title="No activity data recorded yet"
        explanation="You haven't submitted any activities or certificates yet."
        recommendation="Upload certificates or event proofs to unlock performance analytics."
        ctaLabel="Upload Activity"
        ctaTo="/student/upload"
        minHeight="h-full min-h-[220px]"
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={90}
          label={(props) => {
            const { name, percent } = props;
            return `${name} ${((percent || 0) * 100).toFixed(0)}%`;
          }}
        >
          {chartData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'var(--bg-medium)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '8px',
            color: 'var(--text-primary)'
          }} 
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ContributionsChart({ contributions }) {
  const hasStudyData = useMemo(() => {
    if (!contributions || !Array.isArray(contributions) || contributions.length === 0) return false;
    return contributions.some((item) => (item.c || 0) > 0);
  }, [contributions]);

  if (!hasStudyData) {
    return (
      <EmptyStateCard
        icon={BookOpen}
        title="No study history recorded yet"
        explanation="No learning or study sessions logged over the past 14 days."
        recommendation="Log your daily study sessions to track streak trends and subject growth."
        ctaLabel="Start Learning"
        ctaTo="/student/coding"
        minHeight="h-full min-h-[220px]"
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={contributions}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(122, 102, 80, 0.35)" />
        <XAxis dataKey="d" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
        <Tooltip 
          contentStyle={{ 
            backgroundColor: 'var(--bg-medium)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '8px',
            color: 'var(--text-primary)'
          }} 
        />
        <Bar dataKey="c" fill="var(--primary-blue)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
