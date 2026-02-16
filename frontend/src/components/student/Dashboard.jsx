import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import profileService from '../../services/profileService';
import HeatmapChart from '../shared/HeatmapChart';
import VerdictPieChart from '../shared/VerdictPieChart';
import toast from 'react-hot-toast';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

const Dashboard = () => {
    const { user } = useAuth();
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedPlatforms, setExpandedPlatforms] = useState({});

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const data = await profileService.getDashboardData();
            setDashboardData(data.dashboard);
        } catch (error) {
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const togglePlatformExpand = (platform) => {
        setExpandedPlatforms(prev => ({
            ...prev,
            [platform]: !prev[platform]
        }));
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    const {
        userSubmissionsHeatMapData,
        userVerdictData,
        recentSubmissions,
        languageAcceptedSubmissions,
        progress,
        externalContestStats
    } = dashboardData;

    // Transform language data for chart
    const languageChartData = Object.entries(languageAcceptedSubmissions || {}).map(([lang, count]) => ({
        name: lang,
        count: count
    })).sort((a, b) => b.count - a.count);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">
                    Welcome, {user.firstName}! 👋
                </h1>
                <p className="text-gray-600 mt-1">Here's your coding progress overview</p>
            </div>

            {/* Progress Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
                    <h3 className="text-sm font-medium text-gray-600">Problems Solved</h3>
                    <p className="text-3xl font-bold text-blue-600 mt-2">
                        {progress?.totalSolved || 0}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        Easy: {progress?.easy || 0} | Medium: {progress?.medium || 0} | Hard: {progress?.hard || 0}
                    </p>
                </div>

                <div className="card bg-gradient-to-br from-green-50 to-green-100">
                    <h3 className="text-sm font-medium text-gray-600">Current Streak</h3>
                    <p className="text-3xl font-bold text-green-600 mt-2">
                        {progress?.streakDays || 0} 🔥
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Keep it going!</p>
                </div>

                <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
                    <h3 className="text-sm font-medium text-gray-600">Acceptance Rate</h3>
                    <p className="text-3xl font-bold text-purple-600 mt-2">
                        {progress?.acceptanceRate || 0}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {progress?.totalSubmissions || 0} submissions
                    </p>
                </div>

                <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
                    <h3 className="text-sm font-medium text-gray-600">Time Spent</h3>
                    <p className="text-3xl font-bold text-orange-600 mt-2">
                        {Math.floor((progress?.totalTimeSpent || 0) / 60)}h
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Coding time</p>
                </div>
            </div>

            {/* Submission Heatmap */}
            <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Submission Activity (Last 365 Days)
                </h2>
                <HeatmapChart data={userSubmissionsHeatMapData} />
            </div>

            {/* Verdict Breakdown & Language Usage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Verdict Pie Chart */}
                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Verdict Breakdown
                    </h2>
                    <VerdictPieChart data={userVerdictData} />
                </div>

                {/* Language Usage */}
                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Language Usage (Accepted)
                    </h2>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={languageChartData}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={80}
                                    tick={{ fontSize: 12, textTransform: 'capitalize' }}
                                />
                                <Tooltip
                                    formatter={(value) => [value, 'Solved']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="count" fill="#4F46E5" radius={[0, 4, 4, 0]}>
                                    {languageChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recent Submissions */}
            <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Submissions</h2>
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Problem</th>
                                <th>Verdict</th>
                                <th>Language</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentSubmissions?.map((submission, idx) => (
                                <tr key={idx}>
                                    <td className="text-sm text-gray-600">
                                        {new Date(submission.submittedAt).toLocaleString()}
                                    </td>
                                    <td className="font-medium">{submission.problemTitle}</td>
                                    <td>
                                        <span className={`verdict-${submission.verdict.toLowerCase().replace(' ', '-')}`}>
                                            {submission.verdict}
                                        </span>
                                    </td>
                                    <td className="text-sm text-gray-700 capitalize">{submission.language}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* External Contest History */}
            {externalContestStats && Object.keys(externalContestStats).length > 0 && (
                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        External Contest History
                    </h2>
                    {Object.entries(externalContestStats).map(([platform, stats]) => {
                        const isExpanded = expandedPlatforms[platform];
                        const contestsToShow = isExpanded
                            ? stats.allContests
                            : stats.allContests?.slice(0, 5);

                        return (
                            <div key={platform} className="mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-lg font-semibold text-gray-800 capitalize">
                                        {platform} Contests ({stats.allContests?.length || 0})
                                    </h3>
                                </div>

                                <div className="space-y-2">
                                    {contestsToShow?.map((contest, idx) => (
                                        <div
                                            key={idx}
                                            className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            <div>
                                                <p className="font-medium text-gray-900">{contest.contestName}</p>
                                                <p className="text-sm text-gray-600">
                                                    {new Date(contest.startTime).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold text-gray-900">
                                                    Rank: {contest.globalRank}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Solved: {contest.problemsSolved} | Rating: {contest.rating}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {stats.allContests?.length > 5 && (
                                    <button
                                        onClick={() => togglePlatformExpand(platform)}
                                        className="text-sm text-primary-600 hover:text-primary-700 mt-2 font-medium"
                                    >
                                        {isExpanded
                                            ? 'Show Less'
                                            : `View all ${stats.allContests.length} contests →`}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
