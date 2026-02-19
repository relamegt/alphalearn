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
                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Submission Activity</h3>
                        <HeatmapChart data={userSubmissionsHeatMapData} />
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Submissions</h3>
                        <div className="overflow-x-auto">
                            {(!recentSubmissions || recentSubmissions.length === 0) ? (
                                <div className="text-center py-8 text-gray-400">
                                    No recent submissions
                                </div>
                            ) : (
                                <table className="min-w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2">Problem</th>
                                            <th className="px-4 py-2">Verdict</th>
                                            <th className="px-4 py-2">Language</th>
                                            <th className="px-4 py-2">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentSubmissions.slice(0, 5).map((submission, idx) => (
                                            <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-4 py-2 font-medium text-gray-900">
                                                    {submission.problemTitle}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold
                                                        ${submission.verdict === 'Accepted' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                                                    `}>
                                                        {submission.verdict}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 capitalize">{submission.language}</td>
                                                <td className="px-4 py-2">
                                                    {new Date(submission.submittedAt).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
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
