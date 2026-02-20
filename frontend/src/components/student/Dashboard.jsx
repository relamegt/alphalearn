import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import profileService from '../../services/profileService';
import toast from 'react-hot-toast';

// New Components
import ProfileCard from './dashboard/ProfileCard';
import EducationCard from './dashboard/EducationCard';
import PlatformRatingCard from './dashboard/PlatformRatingCard';
import GlobalRankGraph from './dashboard/GlobalRankGraph';
import ScoreDistributionChart from './dashboard/ScoreDistributionChart';

// Legacy Components (Optional: keep for detailed view if needed)
import HeatmapChart from '../shared/HeatmapChart';

const Dashboard = () => {
    const { user } = useAuth();
    const [dashboardData, setDashboardData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const data = await profileService.getDashboardData();
            setDashboardData(data.dashboard);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!dashboardData) return null;

    const {
        progress,
        externalContestStats,
        leaderboardStats,
        userSubmissionsHeatMapData,
        recentSubmissions
    } = dashboardData;

    // Platform Colors Mapping
    const PLATFORM_COLORS = {
        'codechef': '#795548', // Brown
        'codeforces': '#F44336', // Red
        'leetcode': '#FFA116', // Orange
        'hackerrank': '#2EC866', // Green
        'interviewbit': '#008EFF', // Blue
        'spoj': '#3F51B5' // Indigo
    };

    // Platform Icons (You might want to add actual icons later)
    // For now using null or emojis in cards if updated

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN - Profile, Education, Platform Stats */}
                <div className="lg:col-span-1 space-y-6">
                    <ProfileCard
                        user={user}
                    />

                    {/* New Professional Stats Card */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center mb-2">
                                <span className="text-2xl">🏆</span>
                            </div>
                            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Overall Score</p>
                            <p className="text-2xl font-bold text-gray-900">{leaderboardStats?.score || 0}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                                <span className="text-2xl">🌍</span>
                            </div>
                            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Global Rank</p>
                            <p className="text-2xl font-bold text-gray-900">#{leaderboardStats?.globalRank || '-'}</p>
                        </div>
                    </div>

                    <EducationCard
                        education={user.education}
                    />

                    {/* Platform Stats Cards */}
                    {externalContestStats && Object.entries(externalContestStats)
                        .filter(([platform]) => !['hackerrank', 'interviewbit'].includes(platform.toLowerCase()))
                        .map(([platform, stats]) => (
                            <PlatformRatingCard
                                key={platform}
                                platform={platform}
                                stats={stats}
                                color={PLATFORM_COLORS[platform] || '#607D8B'}
                            />
                        ))}
                </div>

                {/* RIGHT COLUMN - Global Graph, Score Distribution */}
                <div className="lg:col-span-2 space-y-6">
                    <GlobalRankGraph
                        externalContestStats={externalContestStats}
                    />

                    <ScoreDistributionChart
                        leaderboardDetails={leaderboardStats?.details}
                    />

                    {/* Optional: Submission Heatmap + Recent Activity */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <HeatmapChart
                            data={userSubmissionsHeatMapData}
                            streakDays={progress?.streakDays || 0}
                            maxStreakDays={progress?.maxStreakDays || 0}
                        />
                    </div>

                    {/* Recent Submissions */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-800">Recent Submissions</h3>
                        </div>

                        <div className="overflow-x-auto">
                            {(!recentSubmissions || recentSubmissions.length === 0) ? (
                                <div className="text-center py-12">
                                    <div className="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                                        <span className="text-2xl">📝</span>
                                    </div>
                                    <p className="text-gray-500 font-medium">No submissions yet</p>
                                    <p className="text-xs text-gray-400 mt-1">Start solving problems to see your history</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-3 font-semibold">Problem</th>
                                            <th className="px-6 py-3 font-semibold">Status</th>
                                            <th className="px-6 py-3 font-semibold">Language</th>
                                            <th className="px-6 py-3 font-semibold text-right">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {recentSubmissions.slice(0, 5).map((submission, idx) => {
                                            const isAccepted = submission.verdict === 'Accepted';
                                            return (
                                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <a
                                                            href={`/student/problem/${submission.problemId || '#'}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-medium text-gray-900 line-clamp-1 hover:text-primary-600 transition-colors"
                                                            title={submission.problemTitle}
                                                        >
                                                            {submission.problemTitle}
                                                        </a>
                                                        <div className="text-xs text-gray-400 mt-0.5">
                                                            {submission.totalTestCases > 0 ?
                                                                `${submission.testCasesPassed}/${submission.totalTestCases} Test Cases` :
                                                                'Custom Test'}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
                                                            ${isAccepted
                                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                                : 'bg-red-50 text-red-700 border-red-200'}
                                                        `}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isAccepted ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                            {submission.verdict}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-medium capitalize">
                                                            {submission.language}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-gray-500 font-mono text-xs">
                                                        {new Date(submission.submittedAt).toLocaleDateString(undefined, {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
