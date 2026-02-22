import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const calcRatingScore = (platform, rating) => {
    switch (platform.toLowerCase()) {
        case 'leetcode':
            return rating > 1300 ? Math.pow(rating - 1300, 2) / 10 : 0;
        case 'codechef':
            return rating > 1200 ? Math.pow(rating - 1200, 2) / 10 : 0;
        case 'codeforces':
            return rating > 800 ? Math.pow(rating - 800, 2) / 10 : 0;
        default:
            return 0;
    }
};

const GlobalRankGraph = ({ externalContestStats, leaderboardStats }) => {
    const data = useMemo(() => {
        if (!externalContestStats) return [];

        const events = [];
        const validPlatforms = ['leetcode', 'codeforces', 'codechef'];
        const platforms = Object.keys(externalContestStats).filter(p =>
            validPlatforms.includes(p.toLowerCase())
        );

        // Calculate current rating components to find the static non-time-series base (AlpsCoins, HackerRank, InterviewBit, etc.)
        let currentTotalRatingScore = 0;
        platforms.forEach(platform => {
            const currentRating = externalContestStats[platform]?.rating || 0;
            currentTotalRatingScore += calcRatingScore(platform, currentRating);
        });

        const currentOverallScore = leaderboardStats?.score || leaderboardStats?.details?.overallScore || 0;
        const baseConstantScore = currentOverallScore - currentTotalRatingScore;

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

        if (events.length === 0) {
            if (currentOverallScore > 0) {
                // Plot an artificial flatline if they only have Alpha Coins or static external platform points
                const now = Date.now();
                return [
                    { date: new Date(now - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(), totalScore: Math.round(currentOverallScore), timestamp: now - 7 * 24 * 60 * 60 * 1000 },
                    { date: new Date(now).toLocaleDateString(), totalScore: Math.round(currentOverallScore), timestamp: now }
                ];
            }
            return [];
        }

        // Sort by time
        events.sort((a, b) => a.timestamp - b.timestamp);

        // Calculate cumulative score over time
        const currentRatings = {};
        const timeSeries = [];
        let lastDate = '';

        events.forEach(event => {
            currentRatings[event.platform] = event.rating;

            let pointRatingScore = 0;
            Object.entries(currentRatings).forEach(([p, r]) => {
                pointRatingScore += calcRatingScore(p, r);
            });

            const totalScore = Math.max(0, Math.round(baseConstantScore + pointRatingScore));
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

        // Add final current day marker
        const todayStr = new Date().toLocaleDateString();
        if (timeSeries.length > 0 && timeSeries[timeSeries.length - 1].date !== todayStr) {
            timeSeries.push({
                date: todayStr,
                totalScore: Math.round(currentOverallScore),
                timestamp: Date.now()
            });
        }

        return timeSeries;
    }, [externalContestStats, leaderboardStats]);

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
