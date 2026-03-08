import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = {
    'hackerrank': '#10B981',      // Green
    'leetcode': '#F59E0B',        // Orange
    'interviewbit': '#3B82F6',    // Blue
    'codechef': '#0EA5E9',        // Light Blue
    'codeforces': '#8B5CF6',      // Purple
    'spoj': '#78350F',            // Brown
    'smartinterviews': '#FCD34D', // Yellow
    'internal': '#FCD34D',        // Yellow (Internal/SmartInterviews)
    'geeksforgeeks': '#22C55E'    // Green
};

const ScoreDistributionChart = ({ leaderboardDetails }) => {
    const data = useMemo(() => {
        const result = [];

        if (!leaderboardDetails) return [];

        // Add internal score
        const internalScore = leaderboardDetails.alphaCoins || 0;
        if (internalScore > 0) {
            result.push({ name: 'Alpha Coins', value: internalScore, fill: COLORS['smartinterviews'] });
        }

        // Add external scores
        if (leaderboardDetails.externalScores) {
            Object.entries(leaderboardDetails.externalScores).forEach(([platform, score]) => {
                if (score > 0) {
                    result.push({
                        name: platform.charAt(0).toUpperCase() + platform.slice(1),
                        value: score,
                        fill: COLORS[platform.toLowerCase()] || '#9CA3AF'
                    });
                }
            });
        }

        return result;
    }, [leaderboardDetails]);

    if (data.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6 h-64 flex flex-col items-center justify-center text-center">
                <div className="bg-gray-50 dark:bg-[#111117]/50 rounded-full w-12 h-12 flex items-center justify-center mb-3">
                    <span className="text-xl">🥧</span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No score data available</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6 Transition-all">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Score Distribution</h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                            ))}
                        </Pie>
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0];
                                    return (
                                        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-100 dark:border-gray-700 shadow-xl rounded-xl text-xs">
                                            <p className="text-gray-400 dark:text-gray-500 text-[10px] uppercase font-bold mb-1 tracking-wider">{data.name}</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.payload.fill }}></div>
                                                <span className="font-bold text-gray-900 dark:text-gray-100">
                                                    {data.value} Points
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend
                            layout="vertical"
                            verticalAlign="middle"
                            align="right"
                            wrapperStyle={{ fontSize: '12px', fontWeight: 500 }}
                            iconType="rect"
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ScoreDistributionChart;
