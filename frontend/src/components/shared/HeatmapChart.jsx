import { useMemo } from 'react';

const HeatmapChart = ({ data }) => {
    const heatmapData = useMemo(() => {
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setDate(oneYearAgo.getDate() - 365);

        const days = [];
        const currentDate = new Date(oneYearAgo);

        while (currentDate <= today) {
            const dateKey = currentDate.toDateString();
            days.push({
                date: new Date(currentDate),
                count: data[dateKey] || 0,
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return days;
    }, [data]);

    const getColorIntensity = (count) => {
        if (count === 0) return 'bg-gray-100';
        if (count <= 2) return 'bg-green-200';
        if (count <= 5) return 'bg-green-400';
        if (count <= 10) return 'bg-green-600';
        return 'bg-green-800';
    };

    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    return (
        <div className="overflow-x-auto">
            <div className="inline-grid grid-flow-col gap-1" style={{ gridTemplateRows: 'repeat(7, 1fr)' }}>
                {heatmapData.map((day, index) => (
                    <div
                        key={index}
                        className={`heatmap-cell w-3 h-3 ${getColorIntensity(day.count)}`}
                        title={`${day.date.toDateString()}: ${day.count} submissions`}
                    />
                ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-600">
                {months.map((month) => (
                    <span key={month}>{month}</span>
                ))}
            </div>
            <div className="flex items-center space-x-2 mt-3 text-xs text-gray-600">
                <span>Less</span>
                <div className="flex space-x-1">
                    <div className="w-3 h-3 bg-gray-100 rounded-sm"></div>
                    <div className="w-3 h-3 bg-green-200 rounded-sm"></div>
                    <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
                    <div className="w-3 h-3 bg-green-600 rounded-sm"></div>
                    <div className="w-3 h-3 bg-green-800 rounded-sm"></div>
                </div>
                <span>More</span>
            </div>
        </div>
    );
};

export default HeatmapChart;
