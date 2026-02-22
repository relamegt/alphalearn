import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import Navbar from '../shared/Navbar';

// Reuse dashboard components for public view
import ProfileCard from '../student/dashboard/ProfileCard';
import EducationCard from '../student/dashboard/EducationCard';
import PlatformRatingCard from '../student/dashboard/PlatformRatingCard';
import GlobalRankGraph from '../student/dashboard/GlobalRankGraph';
import ScoreDistributionChart from '../student/dashboard/ScoreDistributionChart';
import HeatmapChart from '../shared/HeatmapChart';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
                const response = await axios.get(`${API_BASE_URL}/public/profile/${username}`);
                setDashboardData(response.data.dashboard);
                setUserData(response.data.user);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load profile');
                toast.error(err.response?.data?.message || 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };

        if (username) {
            fetchPublicProfile();
        }
    }, [username]);

    const PLATFORM_COLORS = {
        'codechef': '#795548',
        'codeforces': '#F44336',
        'leetcode': '#FFA116',
        'hackerrank': '#2EC866',
        'interviewbit': '#008EFF'
    };

    if (loading) {
        return (
            <>
                <Navbar />
                <div className="flex justify-center items-center h-[calc(100vh-64px)] bg-gray-50">
                    <div className="spinner"></div>
                </div>
            </>
        );
    }

    if (error || !userData) {
        return (
            <>
                <Navbar />
                <div className="flex justify-center items-center h-[calc(100vh-64px)] bg-gray-50">
                    <div className="text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{error === 'Private profile cannot be viewed' ? 'Private Profile' : 'Profile Not Found'}</h2>
                        <p className="text-gray-500 mb-6">{error || "The user you're looking for doesn't exist or hasn't made their profile public."}</p>
                        <Link to="/student/dashboard" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
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
    } = dashboardData;

    return (
        <>
            <Navbar />
            <div className="p-6 bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* LEFT COLUMN */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
                            <div className="relative mb-4">
                                <img
                                    src={userData.profilePicture || `https://ui-avatars.com/api/?name=${userData.firstName}+${userData.lastName}&background=random`}
                                    alt={`${userData.firstName} ${userData.lastName}`}
                                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                                />
                                <div className="absolute bottom-0 right-0 bg-blue-500 w-4 h-4 rounded-full border-2 border-white" title="Public Profile"></div>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">{userData.firstName} {userData.lastName}</h2>
                            <span className="text-gray-500 text-sm bg-gray-100 px-3 py-1 rounded-full font-medium">@{userData.username}</span>

                            <div className="w-full border-t border-gray-100 pt-4 mt-4">
                                <div className="text-center">
                                    <span className="text-gray-400 block text-xs uppercase tracking-wider">Roll Number</span>
                                    <span className="font-semibold text-gray-700">{userData.education?.rollNumber || 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center mb-2">
                                    <span className="text-2xl">🏆</span>
                                </div>
                                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Overall Score</p>
                                <p className="text-2xl font-bold text-gray-900">{leaderboardStats?.score || 0}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                                    <span className="text-2xl">🌍</span>
                                </div>
                                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Global Rank</p>
                                <p className="text-2xl font-bold text-gray-900">#{leaderboardStats?.globalRank || '-'}</p>
                            </div>
                        </div>

                        {userData.education && (
                            <EducationCard education={userData.education} />
                        )}

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

                    {/* RIGHT COLUMN */}
                    <div className="lg:col-span-2 space-y-6">
                        <GlobalRankGraph externalContestStats={externalContestStats} />
                        <ScoreDistributionChart leaderboardDetails={leaderboardStats?.details} />

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <HeatmapChart
                                data={userSubmissionsHeatMapData}
                                streakDays={progress?.streakDays || 0}
                                maxStreakDays={progress?.maxStreakDays || 0}
                            />
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <h3 className="text-lg font-bold text-gray-800">Recent Submissions</h3>
                            </div>
                            <div className="overflow-x-auto">
                                {(!recentSubmissions || recentSubmissions.length === 0) ? (
                                    <div className="text-center py-12">
                                        <p className="text-gray-500 font-medium">No submissions yet</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 border-b border-gray-100">
                                            <tr>
                                                <th className="px-6 py-3 font-semibold">Problem</th>
                                                <th className="px-6 py-3 font-semibold">Status</th>
                                                <th className="px-6 py-3 font-semibold text-right">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {recentSubmissions.slice(0, 5).map((submission, idx) => {
                                                const isAccepted = submission.verdict === 'Accepted';
                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="font-medium text-gray-900 line-clamp-1">{submission.problemTitle}</div>
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
                                                        <td className="px-6 py-4 text-right text-gray-500 font-mono text-xs">
                                                            {new Date(submission.submittedAt).toLocaleDateString()}
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
        </>
    );
};

export default PublicProfile;
