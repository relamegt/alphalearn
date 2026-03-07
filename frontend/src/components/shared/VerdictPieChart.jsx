import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const VERDICT_COLORS = {
    Accepted: '#10b981',
    'Partially Accepted': '#f59e0b',
    'Wrong Answer': '#ef4444',
    'Time Limit Exceeded': '#f97316',
    'Runtime Error': '#8b5cf6',
    'Compilation Error': '#6b7280',
};

const VerdictPieChart = ({ data }) => {
    const chartData = Object.entries(data || {})
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({
            name,
            value,
        }));

    if (chartData.length === 0) {
        return (
            <div className="flex justify-center items-center h-64 text-gray-500 dark:text-gray-400">
                No submission data available
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={VERDICT_COLORS[entry.name] || '#6b7280'} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'var(--color-bg-card)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                />
                <Legend
                    formatter={(value) => <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">{value}</span>}
                />
            </PieChart>
        </ResponsiveContainer>
    );
};

export default VerdictPieChart;
