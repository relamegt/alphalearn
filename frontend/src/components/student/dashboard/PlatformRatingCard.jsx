import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

const PlatformRatingCard = ({ platform, stats, color = '#6257E3', icon }) => {
    // Process stats
    const { rating = 0, maxRating: apiMaxRating = 0, totalContests = 0, allContests = [] } = stats || {};
    const maxRating = allContests.length > 0 ? Math.max(...allContests.map(c => c.rating)) : (apiMaxRating || rating);

    // Calculate chart data with diffs
    const chartData = useMemo(() => {
        if (!allContests || allContests.length === 0) return [];

        const sorted = allContests
            .map(c => ({
                date: new Date(c.startTime).toLocaleDateString(),
                rating: c.rating,
                timestamp: new Date(c.startTime).getTime(),
                contestName: c.title || c.contestName || 'Contest',
                problemsSolved: c.problemsSolved
            }))
            .sort((a, b) => a.timestamp - b.timestamp);

        // Add diff property
        return sorted.map((item, index, arr) => {
            const prev = index > 0 ? arr[index - 1] : null;
            const diff = prev ? item.rating - prev.rating : 0;
            return { ...item, diff };
        });
    }, [allContests]);

    // Calculate rating change (last contest vs second last)
    const ratingChange = useMemo(() => {
        if (allContests.length < 2) return 0;
        const last = allContests[allContests.length - 1];
        const secondLast = allContests[allContests.length - 2];
        return last.rating - secondLast.rating;
    }, [allContests]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const isPositive = data.diff >= 0;
            const diffText = data.diff !== 0 ? `${isPositive ? '+' : ''}${data.diff}` : '-';
            const diffColor = data.diff > 0 ? 'text-green-500' : (data.diff < 0 ? 'text-red-500' : 'text-gray-500');

            return (
                <div className="bg-white dark:bg-gray-800 p-3 border border-gray-100 dark:border-gray-700 shadow-xl rounded-lg text-xs z-50 min-w-[150px]">
                    <p className="font-bold text-gray-800 dark:text-gray-100 mb-1">{data.contestName}</p>
                    <p className="text-gray-400 dark:text-gray-500 text-[10px] mb-2">{data.date}</p>

                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400">Rating:</span>
                            <span className="font-bold text-gray-900 dark:text-gray-100">{data.rating}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 dark:text-gray-400">Change:</span>
                            <span className={`font-bold ${diffColor}`}>{diffText}</span>
                        </div>
                        {data.problemsSolved !== undefined && (
                            <div className="flex justify-between items-center pt-1 mt-1 border-t border-gray-50 dark:border-gray-700">
                                <span className="text-gray-500 dark:text-gray-400">Solved:</span>
                                <span className="font-bold text-blue-600 dark:text-blue-400">{data.problemsSolved}</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    const isPositiveChange = ratingChange >= 0;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 mt-4 transition-all">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    {icon && <img src={icon} alt={platform} className="w-8 h-8 rounded-lg shadow-sm" />}
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 capitalize">{platform} Ratings</h3>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50/50 dark:bg-[#0a0f1a]/40 p-3 rounded-xl border border-gray-100/50 dark:border-gray-800/50">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-1">Current</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{rating}</p>
                </div>
                <div className="bg-gray-50/50 dark:bg-[#0a0f1a]/40 p-3 rounded-xl border border-gray-100/50 dark:border-gray-800/50">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-1">Highest</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{maxRating || rating}</p>
                </div>
                <div className="bg-gray-50/50 dark:bg-[#0a0f1a]/40 p-3 rounded-xl border border-gray-100/50 dark:border-gray-800/50">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-1">Contests</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{totalContests}</p>
                </div>
                <div className="bg-gray-50/50 dark:bg-[#0a0f1a]/40 p-3 rounded-xl border border-gray-100/50 dark:border-gray-800/50">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold mb-1">Change</p>
                    <p className={`text-xl font-bold ${isPositiveChange ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositiveChange ? '▲' : '▼'} {Math.abs(ratingChange)}
                    </p>
                </div>
            </div>

            {/* Sparkline Chart */}
            <div className="h-24 w-full">
                {chartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id={`color${platform}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" hide />
                            <YAxis domain={['auto', 'auto']} hide />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="rating"
                                stroke={color}
                                fillOpacity={1}
                                fill={`url(#color${platform})`}
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm italic">
                        No activity recorded
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlatformRatingCard;
