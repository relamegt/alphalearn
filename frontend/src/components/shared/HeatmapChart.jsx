import React, { useMemo } from 'react';
import { Flame, Trophy } from 'lucide-react';

const HeatmapChart = ({ data, streakDays = 0, maxStreakDays = 0 }) => {
    // Determine the date range (last 365 days)
    const { days, weeks } = useMemo(() => {
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setDate(today.getDate() - 365);

        // Adjust start date to the previous Sunday to align grid properly
        const dayOfWeek = oneYearAgo.getDay(); // 0 is Sunday
        const startDate = new Date(oneYearAgo);
        startDate.setDate(startDate.getDate() - dayOfWeek);

        const allDays = [];
        let currentDate = new Date(startDate);
        const endLoopDate = new Date(); // Today

        while (currentDate <= endLoopDate) {
            allDays.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Group into weeks for column-major layout (7 rows)
        const totalWeeks = Math.ceil(allDays.length / 7);
        return { days: allDays, weeks: totalWeeks };
    }, []);

    const getColorClass = (count) => {
        if (!count) return 'bg-gray-100';
        if (count >= 10) return 'bg-green-700';
        if (count >= 5) return 'bg-green-500';
        if (count >= 3) return 'bg-green-400';
        if (count >= 1) return 'bg-green-300';
        return 'bg-gray-100';
    };

    const monthLabels = useMemo(() => {
        const months = [];
        let currentMonth = -1;
        days.forEach((date, i) => {
            // Only add label for the first week of the month
            if (date.getMonth() !== currentMonth && i % 7 === 0) {
                months.push({
                    name: date.toLocaleString('default', { month: 'short' }),
                    index: Math.floor(i / 7)
                });
                currentMonth = date.getMonth();
            }
        });
        return months;
    }, [days]);

    return (
        <div className="w-full">
            {/* Header with Streaks */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    Submission Activity
                </h3>

                <div className="flex gap-4 self-start sm:self-auto">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg border border-orange-100">
                        <Flame size={18} className="text-orange-500 fill-orange-500" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-wide">Current Streak</span>
                            <span className="font-bold text-sm">{streakDays} Days</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-100">
                        <Trophy size={18} className="text-yellow-500 fill-yellow-500" />
                        <div className="flex flex-col leading-none">
                            <span className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wide">Max Streak</span>
                            <span className="font-bold text-sm">{maxStreakDays} Days</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Heatmap Grid */}
            <div className="overflow-x-auto pb-2">
                <div className="min-w-[700px]">
                    {/* Month Labels */}
                    <div className="flex mb-2 text-xs text-gray-400 relative h-4">
                        {monthLabels.map((month, idx) => (
                            <span
                                key={idx}
                                style={{ left: `${(month.index / weeks) * 100}%` }}
                                className="absolute"
                            >
                                {month.name}
                            </span>
                        ))}
                    </div>

                    <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
                        {days.map((date, index) => {
                            const dateStr = date.toDateString();
                            const count = data[dateStr] || 0;
                            return (
                                <div
                                    key={index}
                                    title={`${date.toLocaleDateString()}: ${count} submissions`}
                                    className={`w-3 h-3 rounded-[2px] transition-all hover:ring-1 hover:ring-offset-1 hover:ring-gray-400 ${getColorClass(count)}`}
                                ></div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500">
                <span>Less</span>
                <div className="flex gap-[3px]">
                    <div className="w-3 h-3 bg-gray-100 rounded-[2px]"></div>
                    <div className="w-3 h-3 bg-green-300 rounded-[2px]"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-[2px]"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-[2px]"></div>
                    <div className="w-3 h-3 bg-green-700 rounded-[2px]"></div>
                </div>
                <span>More</span>
            </div>
        </div>
    );
};

export default HeatmapChart;
