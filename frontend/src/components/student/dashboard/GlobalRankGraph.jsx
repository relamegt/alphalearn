import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const GlobalRankGraph = ({ externalContestStats }) => {
    const data = useMemo(() => {
        if (!externalContestStats) return [];

        const events = [];
        const validPlatforms = ['leetcode', 'codeforces', 'codechef'];
        const platforms = Object.keys(externalContestStats).filter(p =>
            validPlatforms.includes(p.toLowerCase())
        );

        // Collect all rating update events
        platforms.forEach(platform => {
            const history = externalContestStats[platform]?.allContests || [];
            history.forEach(contest => {
                events.push({
                    date: new Date(contest.startTime),
                    platform,
                    rating: contest.rating,
                    timestamp: new Date(contest.startTime).getTime()
                });
            });
        });

        if (events.length === 0) return [];

        // Sort by time
        events.sort((a, b) => a.timestamp - b.timestamp);

        // Calculate cumulative score over time
        const currentRatings = {};
        const timeSeries = [];

        let lastDate = '';

        events.forEach(event => {
            currentRatings[event.platform] = event.rating;

            // Calculate total score at this point in time
            const totalScore = Object.values(currentRatings).reduce((sum, r) => sum + r, 0);
            const dateStr = event.date.toLocaleDateString();

            // Improve data points density: if same day, update last point
            if (dateStr === lastDate) {
                timeSeries[timeSeries.length - 1].totalScore = totalScore;
            } else {
                timeSeries.push({
                    date: dateStr,
                    totalScore,
                    timestamp: event.timestamp
                });
                lastDate = dateStr;
            }
        });

        return timeSeries;
    }, [externalContestStats]);

    if (data.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 h-96 flex items-center justify-center">
                <p className="text-gray-400">Not enough data for global history</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Overall Score Progression</h3>
            <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 12, fill: '#9CA3AF' }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={50}
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: '#9CA3AF' }}
                            axisLine={false}
                            tickLine={false}
                            domain={['auto', 'auto']}
                        />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                            labelStyle={{ color: '#6B7280' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="totalScore"
                            stroke="#F59E0B"
                            fillOpacity={1}
                            fill="url(#colorScore)"
                            strokeWidth={3}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default GlobalRankGraph;
