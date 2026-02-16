import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import leaderboardService from '../../services/leaderboardService';
import contestService from '../../services/contestService';
import toast from 'react-hot-toast';

const PLATFORMS = [
    { value: 'leetcode', label: 'LeetCode' },
    { value: 'codechef', label: 'CodeChef' },
    { value: 'codeforces', label: 'Codeforces' },
    { value: 'hackerrank', label: 'HackerRank' },
    { value: 'interviewbit', label: 'InterviewBit' },
    { value: 'spoj', label: 'SPOJ' },
];

const Leaderboard = () => {
    const { contestId } = useParams();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState(contestId ? 'internal' : 'practice');

    // RAW DATA (fetched ONCE from backend or cache)
    const [rawPracticeData, setRawPracticeData] = useState([]);
    const [rawAllExternalData, setRawAllExternalData] = useState(null);
    const [rawInternalData, setRawInternalData] = useState([]);
    const [contestInfo, setContestInfo] = useState(null);

    // Loading states
    const [practiceLoading, setPracticeLoading] = useState(false);
    const [externalLoading, setExternalLoading] = useState(false);
    const [internalLoading, setInternalLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Data loaded flags
    const [practiceDataLoaded, setPracticeDataLoaded] = useState(false);
    const [externalDataLoaded, setExternalDataLoaded] = useState(false);

    // CLIENT-SIDE FILTERS
    const [filters, setFilters] = useState({
        section: '',
        timeline: '',
        branch: '',
    });

    // External contest selection (CLIENT-SIDE)
    const [selectedPlatform, setSelectedPlatform] = useState('leetcode');
    const [selectedContest, setSelectedContest] = useState(null);

    // Internal contests
    const [internalContests, setInternalContests] = useState([]);
    const [selectedInternalContest, setSelectedInternalContest] = useState(contestId || null);

    // ========== FETCH DATA ONCE ==========
    useEffect(() => {
        if (user?.batchId && !practiceDataLoaded) {
            fetchPracticeLeaderboard();
        }
    }, [user, practiceDataLoaded]);

    useEffect(() => {
        if (user?.batchId) {
            fetchInternalContests();
        }
    }, [user]);

    // Fetch external data when tab is opened
    useEffect(() => {
        if (activeTab === 'external' && user?.batchId && !externalDataLoaded) {
            fetchAllExternalData();
        }
    }, [activeTab, user, externalDataLoaded]);

    useEffect(() => {
        if (selectedInternalContest) {
            fetchInternalContestLeaderboard();
        }
    }, [selectedInternalContest]);

    // Auto-refresh internal leaderboard every 10 seconds
    useEffect(() => {
        let intervalId;
        if (activeTab === 'internal' && selectedInternalContest) {
            intervalId = setInterval(() => {
                fetchInternalContestLeaderboard(true);
            }, 10000);
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [activeTab, selectedInternalContest]);

    const fetchPracticeLeaderboard = async (forceRefresh = false) => {
        setPracticeLoading(true);
        try {
            const data = await leaderboardService.getBatchLeaderboard(user.batchId, forceRefresh);
            setRawPracticeData(data.leaderboard || []);
            setPracticeDataLoaded(true);
        } catch (error) {
            toast.error('Failed to fetch leaderboard');
            setRawPracticeData([]);
        } finally {
            setPracticeLoading(false);
            setInitialLoading(false);
        }
    };

    // Fetch ALL platforms data in ONE call with caching
    const fetchAllExternalData = async (forceRefresh = false) => {
        setExternalLoading(true);
        try {
            const data = await leaderboardService.getAllExternalData(user.batchId, forceRefresh);
            setRawAllExternalData(data.platforms || {});
            setExternalDataLoaded(true);

            // Set initial contest selection
            const platformData = data.platforms?.[selectedPlatform];
            if (platformData?.contests && platformData.contests.length > 0) {
                setSelectedContest(platformData.contests[0].contestName);
            } else {
                setSelectedContest(null);
            }
        } catch (error) {
            toast.error('Failed to fetch external contest data');
            setRawAllExternalData({});
        } finally {
            setExternalLoading(false);
            setInitialLoading(false);
        }
    };

    const fetchInternalContestLeaderboard = async (isBackground = false) => {
        if (!isBackground) setInternalLoading(true);
        try {
            const data = await leaderboardService.getInternalContestLeaderboard(
                selectedInternalContest
            );
            setRawInternalData(data.leaderboard || []);
            setContestInfo(data.contest || null);
        } catch (error) {
            if (!isBackground) {
                toast.error('Failed to fetch internal contest leaderboard');
                setRawInternalData([]);
            }
        } finally {
            if (!isBackground) {
                setInternalLoading(false);
                setInitialLoading(false);
            }
        }
    };

    const fetchInternalContests = async () => {
        try {
            const data = await contestService.getContestsByBatch(user.batchId);
            setInternalContests(data.contests || []);
            if (data.contests && data.contests.length > 0) {
                if (!contestId) {
                    setSelectedInternalContest(data.contests[0]._id);
                }
            } else if (!contestId) {
                setSelectedInternalContest(null);
            }
        } catch (error) {
            console.error('Failed to fetch internal contests');
            setInternalContests([]);
            setSelectedInternalContest(null);
        }
    };

    // ========== CLIENT-SIDE FILTERING ==========

    // Filter practice leaderboard
    const filteredPracticeLeaderboard = useMemo(() => {
        if (!Array.isArray(rawPracticeData)) return [];

        let filtered = [...rawPracticeData];

        if (filters.branch) {
            filtered = filtered.filter(entry => entry.branch === filters.branch);
        }

        if (filters.section) {
            filtered = filtered.filter(entry => entry.section === filters.section);
        }

        if (filters.timeline) {
            const now = new Date();
            filtered = filtered.filter(entry => {
                const lastUpdated = new Date(entry.lastUpdated);
                if (filters.timeline === 'week') {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    return lastUpdated >= weekAgo;
                } else if (filters.timeline === 'month') {
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    return lastUpdated >= monthAgo;
                }
                return true;
            });
        }

        // Re-rank after filtering
        return filtered.map((entry, index) => ({
            ...entry,
            rank: index + 1
        }));
    }, [rawPracticeData, filters]);

    // Get external leaderboard for selected platform and contest (CLIENT-SIDE)
    const externalLeaderboard = useMemo(() => {
        if (!rawAllExternalData || !selectedPlatform || !selectedContest) return [];

        const platformData = rawAllExternalData[selectedPlatform];
        if (!platformData || !platformData.contests) return [];

        const contest = platformData.contests.find(c => c.contestName === selectedContest);
        return contest && Array.isArray(contest.leaderboard) ? contest.leaderboard : [];
    }, [rawAllExternalData, selectedPlatform, selectedContest]);

    // Get available contests for selected platform (CLIENT-SIDE)
    const availableContests = useMemo(() => {
        if (!rawAllExternalData || !selectedPlatform) return [];

        const platformData = rawAllExternalData[selectedPlatform];
        if (!platformData || !platformData.contests) return [];

        return platformData.contests.map(c => ({
            contestName: c.contestName,
            participants: c.participants,
            startTime: c.startTime
        }));
    }, [rawAllExternalData, selectedPlatform]);

    // Handle platform change (CLIENT-SIDE filtering)
    const handlePlatformChange = (platform) => {
        setSelectedPlatform(platform);

        // Auto-select first contest for new platform
        const platformData = rawAllExternalData?.[platform];
        if (platformData?.contests && platformData.contests.length > 0) {
            setSelectedContest(platformData.contests[0].contestName);
        } else {
            setSelectedContest(null);
        }
    };

    const handleResetFilters = () => {
        setFilters({ section: '', timeline: '', branch: '' });
    };

    const handleRefreshPractice = () => {
        toast.success('Refreshing practice leaderboard...');
        fetchPracticeLeaderboard(true);
    };

    const handleRefreshExternal = () => {
        toast.success('Refreshing external contest data...');
        fetchAllExternalData(true);
    };

    const LoadingSpinner = () => (
        <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    if (initialLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading leaderboard data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Leaderboards</h1>
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-green-600 font-medium">
                        📦 Cached until logout
                    </span>
                    <span className="text-sm text-gray-400">•</span>
                    <span className="text-sm text-blue-600 font-medium">
                        🔄 Instant filtering
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('practice')}
                    className={`px-6 py-3 font-medium transition ${activeTab === 'practice'
                            ? 'border-b-2 border-primary-600 text-primary-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    AlphaLearn Practice {practiceDataLoaded && '✓'}
                </button>
                <button
                    onClick={() => setActiveTab('external')}
                    className={`px-6 py-3 font-medium transition ${activeTab === 'external'
                            ? 'border-b-2 border-primary-600 text-primary-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    External Contests {externalDataLoaded && '✓'}
                </button>
                <button
                    onClick={() => setActiveTab('internal')}
                    className={`px-6 py-3 font-medium transition ${activeTab === 'internal'
                            ? 'border-b-2 border-primary-600 text-primary-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Internal Contests
                </button>
            </div>

            {/* Practice Leaderboard */}
            {activeTab === 'practice' && (
                <div className="space-y-6">
                    <div className="card">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Filters (Applied Instantly)
                            </h3>
                            <button
                                onClick={handleRefreshPractice}
                                className="btn-secondary flex items-center space-x-2"
                                disabled={practiceLoading}
                            >
                                <svg className={`w-4 h-4 ${practiceLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Refresh</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                                <select
                                    value={filters.section}
                                    onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="">All Sections</option>
                                    <option value="A">Section A</option>
                                    <option value="B">Section B</option>
                                    <option value="C">Section C</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Timeline</label>
                                <select
                                    value={filters.timeline}
                                    onChange={(e) => setFilters({ ...filters, timeline: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="">All Time</option>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                                <select
                                    value={filters.branch}
                                    onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="">All Branches</option>
                                    <option value="CSE">CSE</option>
                                    <option value="ECE">ECE</option>
                                    <option value="EEE">EEE</option>
                                    <option value="MECH">MECH</option>
                                </select>
                            </div>
                            <div className="flex items-end space-x-2">
                                <button onClick={handleResetFilters} className="btn-secondary flex-1">
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            Practice Leaderboard
                            {!practiceLoading && ` (${filteredPracticeLeaderboard.length} students)`}
                        </h2>
                        {practiceLoading ? (
                            <LoadingSpinner />
                        ) : filteredPracticeLeaderboard.length === 0 ? (
                            <div className="text-center py-12">
                                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p className="text-gray-600 text-lg font-medium">No leaderboard data available</p>
                                <p className="text-gray-500 text-sm mt-2">Start solving problems to appear on the leaderboard!</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Global Rank</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AlphaLearn Basic</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LeetCode</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CodeChef</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Codeforces</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Overall Score</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredPracticeLeaderboard.map((entry) => (
                                            <tr
                                                key={entry.rollNumber}
                                                className={entry.rollNumber === user?.education?.rollNumber ? 'bg-blue-50' : ''}
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap font-bold">{entry.rank}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{entry.globalRank}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{entry.rollNumber}</td>
                                                <td className="px-4 py-3 whitespace-nowrap font-medium">{entry.username}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{entry.branch}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{entry.section}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{entry.alphaLearnBasicScore}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{entry.externalScores?.leetcode || 0}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{entry.externalScores?.codechef || 0}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{entry.externalScores?.codeforces || 0}</td>
                                                <td className="px-4 py-3 whitespace-nowrap font-bold text-primary-600">{entry.overallScore}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* External Contest Leaderboard */}
            {activeTab === 'external' && (
                <div className="space-y-6">
                    {externalLoading ? (
                        <div className="card">
                            <LoadingSpinner />
                            <p className="text-center text-gray-600 mt-4">Loading all external contest data...</p>
                        </div>
                    ) : (
                        <>
                            <div className="card">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        Filter External Contests (Client-Side)
                                    </h2>
                                    <button
                                        onClick={handleRefreshExternal}
                                        className="btn-secondary flex items-center space-x-2"
                                        disabled={externalLoading}
                                    >
                                        <svg className={`w-4 h-4 ${externalLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Refresh</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                                        <select
                                            value={selectedPlatform}
                                            onChange={(e) => handlePlatformChange(e.target.value)}
                                            className="input-field"
                                        >
                                            {PLATFORMS.map((platform) => (
                                                <option key={platform.value} value={platform.value}>
                                                    {platform.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Contest</label>
                                        <select
                                            value={selectedContest || ''}
                                            onChange={(e) => setSelectedContest(e.target.value)}
                                            className="input-field"
                                            disabled={availableContests.length === 0}
                                        >
                                            {availableContests.length === 0 ? (
                                                <option value="">No contests available</option>
                                            ) : (
                                                availableContests.map((contest) => (
                                                    <option key={contest.contestName} value={contest.contestName}>
                                                        {contest.contestName} ({contest.participants} participants)
                                                    </option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                    {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} - {selectedContest || 'Select Contest'}
                                </h2>
                                {externalLeaderboard.length === 0 ? (
                                    <div className="text-center py-12">
                                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <p className="text-gray-600 text-lg font-medium">No contest data available</p>
                                        <p className="text-gray-500 text-sm mt-2">No students have participated in contests on this platform yet.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Global Rank</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Problems Solved</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {externalLeaderboard.map((entry, index) => (
                                                    <tr key={`${entry.rollNumber}-${index}`}>
                                                        <td className="px-4 py-3 whitespace-nowrap font-bold">{entry.rank}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{entry.globalRank}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">{entry.rollNumber}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap font-medium">{entry.username}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">{entry.branch}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">{entry.section}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">{entry.rating}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">{entry.problemsSolved}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Internal Contest Leaderboard - Same as before with better empty state */}
            {activeTab === 'internal' && (
                <div className="space-y-6">
                    <div className="card">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Internal Contest</h2>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Contest</label>
                        <select
                            value={selectedInternalContest || ''}
                            onChange={(e) => setSelectedInternalContest(e.target.value)}
                            className="input-field"
                            disabled={internalContests.length === 0}
                        >
                            {internalContests.length === 0 ? (
                                <option value="">No contests available</option>
                            ) : (
                                <>
                                    <option value="">Select a contest</option>
                                    {internalContests.map((contest) => (
                                        <option key={contest._id} value={contest._id}>
                                            {contest.title} - {new Date(contest.startTime).toLocaleDateString()}
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                    </div>

                    {contestInfo && !internalLoading && (
                        <div className="card bg-blue-50 border-l-4 border-blue-600">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">{contestInfo.title}</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-700">
                                <div>
                                    <span className="font-medium">Problems:</span> {contestInfo.totalProblems}
                                </div>
                                <div>
                                    <span className="font-medium">Proctoring:</span>{' '}
                                    {contestInfo.proctoringEnabled ? '🔒 Enabled' : 'Disabled'}
                                </div>
                                <div>
                                    <span className="font-medium">Start:</span>{' '}
                                    {new Date(contestInfo.startTime).toLocaleString()}
                                </div>
                                <div>
                                    <span className="font-medium">End:</span>{' '}
                                    {new Date(contestInfo.endTime).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="card">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-900">
                                Contest Leaderboard {!internalLoading && rawInternalData.length > 0 && `(${rawInternalData.length} participants)`}
                            </h2>
                            {!internalLoading && selectedInternalContest && (
                                <span className="text-sm text-green-600 font-medium">
                                    ⟳ Auto-refreshing every 10s
                                </span>
                            )}
                        </div>
                        {internalLoading ? (
                            <LoadingSpinner />
                        ) : rawInternalData.length === 0 ? (
                            <div className="text-center py-12">
                                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                <p className="text-gray-600 text-lg font-medium">No submissions yet</p>
                                <p className="text-gray-500 text-sm mt-2">Be the first to participate in this contest!</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                {/* Internal contest table - same as before */}
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roll No</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time (min)</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solved</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tab Switches</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fullscreen Exits</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paste Attempts</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Violations</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {rawInternalData.map((entry, index) => (
                                            <tr
                                                key={`${entry.studentId}-${index}`}
                                                className={
                                                    entry.rollNumber === user?.education?.rollNumber
                                                        ? 'bg-blue-50'
                                                        : ''
                                                }
                                            >
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="font-bold text-lg">{entry.rank}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">{entry.rollNumber}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{entry.username}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">{entry.branch}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">{entry.section}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="font-bold text-lg text-blue-600">{entry.score}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">{entry.time}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                    {entry.problemsSolved}/{contestInfo?.totalProblems || 0}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                    <span className={entry.violations?.tabSwitches > 0 ? 'text-red-600 font-medium' : ''}>
                                                        {entry.violations?.tabSwitches || 0}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                    <span className={entry.violations?.fullscreenExits > 0 ? 'text-red-600 font-medium' : ''}>
                                                        {entry.violations?.fullscreenExits || 0}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                    <span className={entry.violations?.pasteAttempts > 0 ? 'text-red-600 font-medium' : ''}>
                                                        {entry.violations?.pasteAttempts || 0}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                    <span
                                                        className={`px-2 py-1 rounded-full text-xs font-bold ${(entry.violations?.total || 0) === 0
                                                                ? 'bg-green-100 text-green-800'
                                                                : (entry.violations?.total || 0) < 3
                                                                    ? 'bg-yellow-100 text-yellow-800'
                                                                    : 'bg-red-100 text-red-800'
                                                            }`}
                                                    >
                                                        {entry.violations?.total || 0}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                    {entry.isCompleted ? (
                                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                            ✓ Submitted
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                                            In Progress
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
