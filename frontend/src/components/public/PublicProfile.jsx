import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import Navbar from '../shared/Navbar';

// Reuse the exact same dashboard components
import EducationCard from '../student/dashboard/EducationCard';
import PlatformRatingCard from '../student/dashboard/PlatformRatingCard';
import GlobalRankGraph from '../student/dashboard/GlobalRankGraph';
import ScoreDistributionChart from '../student/dashboard/ScoreDistributionChart';
import HeatmapChart from '../shared/HeatmapChart';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const PLATFORM_COLORS = {
    codechef: '#795548',
    codeforces: '#F44336',
    leetcode: '#FFA116',
    hackerrank: '#2EC866',
    interviewbit: '#008EFF',
    spoj: '#3F51B5'
};

// ─── Private Details Panel (Admins & Instructors only) ────────────────────────
const PrivateDetailsPanel = ({ userData }) => (
    <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 text-left">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Private Details
            </h3>
            <span
                className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold uppercase tracking-wider"
                title="Visible only to Admins and Instructors"
            >
                RESTRICTED
            </span>
        </div>
        <div className="space-y-2.5 text-sm">
            {[
                { label: 'Role', value: userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : null },
                { label: 'Email', value: userData.email },
                { label: 'Phone', value: userData.phone },
                { label: 'WhatsApp', value: userData.whatsapp },
                { label: 'Gender', value: userData.gender },
                { label: 'T-Shirt Size', value: userData.tshirtSize },
                { label: 'Date of Birth', value: userData.dob ? new Date(userData.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null },
                { label: 'Joined On', value: userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : null },
                { label: 'Last Login', value: userData.lastLogin ? new Date(userData.lastLogin).toLocaleDateString() : 'Never' },
            ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-500 font-medium">{label}</span>
                    <span className="text-gray-900 font-medium text-right">{value || <span className="text-gray-300 italic text-xs">Not set</span>}</span>
                </div>
            ))}
            {userData.address && Object.values(userData.address).some(v => v) && (
                <div className="flex justify-between items-start py-1">
                    <span className="text-gray-500 font-medium whitespace-nowrap mr-4">Address</span>
                    <span className="text-gray-900 font-medium text-right text-xs leading-relaxed">
                        {[userData.address.building, userData.address.street, userData.address.city, userData.address.state, userData.address.postalCode]
                            .filter(Boolean).join(', ')}
                    </span>
                </div>
            )}
        </div>
    </div>
);

// ─── Recent Submissions Table ──────────────────────────────────────────────────
const RecentSubmissions = ({ submissions }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="text-lg font-bold text-gray-800">Recent Submissions</h3>
        </div>
        <div className="overflow-x-auto">
            {(!submissions || submissions.length === 0) ? (
                <div className="text-center py-12">
                    <div className="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">📝</span>
                    </div>
                    <p className="text-gray-500 font-medium">No submissions yet</p>
                    <p className="text-xs text-gray-400 mt-1">This user hasn't solved any problems yet</p>
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
                        {submissions.slice(0, 5).map((submission, idx) => {
                            const isAccepted = submission.verdict === 'Accepted';
                            return (
                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900 line-clamp-1">{submission.problemTitle}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">
                                            {submission.totalTestCases > 0
                                                ? `${submission.testCasesPassed}/${submission.totalTestCases} Test Cases`
                                                : 'Custom Test'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${isAccepted ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
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
                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
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
);

// ─── Main Component ────────────────────────────────────────────────────────────
const PublicProfile = () => {
    const { username } = useParams();
    const [dashboardData, setDashboardData] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPublicProfile = async () => {
            setLoading(true);
            try {
                const token = Cookies.get('accessToken');
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const response = await axios.get(`${API_BASE_URL}/public/profile/${username}`, { headers });
                setDashboardData(response.data.dashboard);
                setUserData(response.data.user);
            } catch (err) {
                const msg = err.response?.data?.message || 'Failed to load profile';
                setError(msg);
                toast.error(msg);
            } finally {
                setLoading(false);
            }
        };

        if (username) fetchPublicProfile();
    }, [username]);

    // ── Loading State ──────────────────────────────────────────────────────────
    if (loading) {
        return (
            <>
                <Navbar />
                <div className="p-6 bg-gray-50 min-h-screen">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white rounded-2xl h-64 border border-gray-100 p-6 flex flex-col items-center justify-center gap-4 shadow-sm">
                                <div className="w-24 h-24 bg-gray-200 rounded-full"></div>
                                <div className="w-3/4 h-5 bg-gray-200 rounded"></div>
                                <div className="w-1/2 h-4 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-2xl h-96 border border-gray-100 p-6 shadow-sm"></div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // ── Error / Private State ──────────────────────────────────────────────────
    if (error || !userData) {
        const isPrivate = error === 'Private profile cannot be viewed';
        return (
            <>
                <Navbar />
                <div className="flex justify-center items-center min-h-[calc(100vh-64px)] bg-gray-50 p-4">
                    <div className="text-center bg-white p-10 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">
                        <div className={`w-16 h-16 ${isPrivate ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-500'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                            {isPrivate ? (
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            ) : (
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {isPrivate ? '🔒 Private Profile' : 'Profile Not Found'}
                        </h2>
                        <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                            {error || "The user you're looking for doesn't exist or hasn't made their profile public."}
                        </p>
                        <Link to="/" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors inline-block">
                            Return Home
                        </Link>
                    </div>
                </div>
            </>
        );
    }

    const {
        progress,
        externalContestStats,
        leaderboardStats,
        userSubmissionsHeatMapData,
        recentSubmissions
    } = dashboardData || {};

    const profilePic = userData.profilePicture
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.firstName)}+${encodeURIComponent(userData.lastName)}&background=random`;

    return (
        <>
            <Navbar />
            <div className="p-6 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* Profile Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
                            <div className="relative mb-4">
                                <img
                                    src={profilePic}
                                    alt={`${userData.firstName} ${userData.lastName}`}
                                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                                />
                                {/* Blue dot = public profile indicator */}
                                <div
                                    className="absolute bottom-0 right-0 bg-blue-500 w-4 h-4 rounded-full border-2 border-white"
                                    title="Public Profile"
                                />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">{userData.firstName} {userData.lastName}</h2>
                            <span className="text-gray-500 text-sm bg-gray-100 px-3 py-1 rounded-full font-medium mb-3">
                                @{userData.username}
                            </span>

                            {userData.aboutMe && (
                                <p className="text-sm text-gray-500 leading-relaxed mb-3 border-t border-gray-100 pt-3 w-full">
                                    {userData.aboutMe}
                                </p>
                            )}

                            <div className="w-full border-t border-gray-100 pt-4 mt-1">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="text-left">
                                        <span className="text-gray-400 block text-xs uppercase tracking-wider">Roll Number</span>
                                        <span className="font-semibold text-gray-700">{userData.education?.rollNumber || 'N/A'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-gray-400 block text-xs uppercase tracking-wider">Branch</span>
                                        <span className="font-semibold text-gray-700">{userData.education?.branch || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Restricted: Admin / Instructor Only Panel */}
                        {userData.canViewPrivateDetails && (
                            <PrivateDetailsPanel userData={userData} />
                        )}

                        {dashboardData && (
                            <>
                                {/* Score Stats */}
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

                                {/* Education Card */}
                                {userData.education && (
                                    <EducationCard education={userData.education} />
                                )}

                                {/* Platform Rating Cards (Codechef, Codeforces, LeetCode, SPOJ) */}
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
                            </>
                        )}
                    </div>

                    {/* ── RIGHT COLUMN ────────────────────────────────────────── */}
                    <div className="lg:col-span-2 space-y-6">
                        {!dashboardData ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center h-full flex flex-col items-center justify-center">
                                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-4xl text-gray-300">📊</span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Dashboard Not Available</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    {userData.role !== 'student'
                                        ? 'Dashboard statistics are only available for student profiles.'
                                        : 'You do not have permission to view the private dashboard statistics for this user.'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Global Rank Graph (same as dashboard) */}
                                <GlobalRankGraph externalContestStats={externalContestStats} />

                                {/* Score Distribution Chart (same as dashboard) */}
                                <ScoreDistributionChart leaderboardDetails={leaderboardStats?.details} />

                                {/* Activity Heatmap */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <HeatmapChart
                                        data={userSubmissionsHeatMapData}
                                        streakDays={progress?.streakDays || 0}
                                        maxStreakDays={progress?.maxStreakDays || 0}
                                    />
                                </div>

                                {/* Recent Submissions */}
                                <RecentSubmissions submissions={recentSubmissions} />
                            </>
                        )}
                    </div>

                </div>
            </div>
        </>
    );
};

export default PublicProfile;
