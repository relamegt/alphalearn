import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import contestService from '../../services/contestService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Trophy, Calendar, Clock, ArrowRight, CheckCircle, BookOpen, BarChart2 } from 'lucide-react';

const ContestList = () => {
    const { user } = useAuth();
    const [contests, setContests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && user.batchId) {
            fetchContests();
        }
    }, [user]);

    const fetchContests = async () => {
        try {
            setLoading(true);
            const data = await contestService.getContestsByBatch(user.batchId, null);
            setContests(data.contests || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch contests');
        } finally {
            setLoading(false);
        }
    };

    const getContestStatus = (contest) => {
        const now = new Date();
        const start = new Date(contest.startTime);
        const end = new Date(contest.endTime);

        if (now < start) return 'upcoming';
        if (now >= start && now <= end) return 'active';
        return 'past';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F7F5FF] dark:bg-[#111117] pb-20 transition-colors">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
                    {/* Header Skeleton */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-6 animate-pulse">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
                                <div className="w-64 h-8 bg-gray-200 dark:bg-gray-800 rounded"></div>
                            </div>
                            <div className="w-96 h-5 bg-gray-200 dark:bg-gray-800 rounded mt-4 ml-1"></div>
                        </div>
                    </div>

                    {/* Contests Section Skeleton */}
                    <section className="animate-pulse">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1.5 h-6 bg-gray-300 rounded-full"></div>
                            <div className="w-48 h-6 bg-gray-200 rounded"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col h-64 shadow-sm">
                                    <div className="w-3/4 h-6 bg-gray-200 rounded mb-4"></div>
                                    <div className="w-full h-4 bg-gray-200 rounded mb-2"></div>
                                    <div className="w-5/6 h-4 bg-gray-200 rounded mb-6"></div>
                                    <div className="mt-auto space-y-3 bg-gray-50 rounded-xl p-4">
                                        <div className="w-1/2 h-4 bg-gray-200 rounded"></div>
                                        <div className="w-1/2 h-4 bg-gray-200 rounded"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    const activeContests = contests.filter(c => getContestStatus(c) === 'active');
    const pastContests = contests.filter(c => getContestStatus(c) === 'past');

    return (
        <div className="min-h-screen bg-[#F7F5FF] dark:bg-[#111117] pb-20 transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                                <Trophy size={28} />
                            </div>
                            Internal Contests
                        </h1>
                        <p className="text-gray-500 mt-2 text-lg ml-1">
                            Compete with your batchmates and climb the leaderboard.
                        </p>
                    </div>
                </div>

                {/* Active Contests Section */}
                {activeContests.length > 0 && (
                    <section className="animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Live Now</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {activeContests.map(contest => (
                                <ContestCard key={contest._id} contest={contest} status="active" />
                            ))}
                        </div>
                    </section>
                )}

                {/* Past Contests Section */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-6 bg-gray-400 rounded-full"></div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Past Contests</h2>
                    </div>
                    {pastContests.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {pastContests.map(contest => (
                                <ContestCard key={contest._id} contest={contest} status="past" />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                            <Trophy size={48} className="mx-auto text-gray-200 dark:text-gray-800 mb-4" />
                            <p className="text-gray-500 dark:text-gray-400">No past contests available.</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

const ContestCard = ({ contest, status }) => {
    const isLive = status === 'active';
    const isPast = status === 'past';
    const isSubmitted = contest.isSubmitted;

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatShortDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className={`group relative bg-white dark:bg-[#181820] rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col h-full hover:-translate-y-1 hover:scale-[1.01] ${isLive
            ? 'border-green-200 dark:border-green-900/30 shadow-xl shadow-green-50 dark:shadow-none ring-1 ring-green-100 dark:ring-green-900/20'
            : 'border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md dark:shadow-none dark:hover:shadow-none hover:border-indigo-100 dark:hover:border-gray-700'
            }`}>
            {/* Status Strip */}
            {isLive && (
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 animate-gradient-x"></div>
            )}
            {isPast && (
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
            )}

            <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4 gap-4">
                    {/* Title */}
                    {isPast ? (
                        <Link
                            to={`/contests/${contest.slug || contest._id}/leaderboard`}
                            className="text-lg font-bold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight hover:text-indigo-600 transition-colors flex-1"
                        >
                            {contest.title}
                        </Link>
                    ) : (
                        <Link
                            to={isLive ? (!isSubmitted ? `/contests/${contest.slug || contest._id}` : `/contests/${contest.slug || contest._id}/leaderboard`) : `/contests/${contest.slug || contest._id}/practice`}
                            className="text-lg font-bold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight hover:text-indigo-600 transition-colors"
                        >
                            {contest.title}
                        </Link>
                    )}
                    {isSubmitted && (
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            <CheckCircle size={12} className="mr-1" /> Submitted
                        </span>
                    )}
                </div>

                {contest.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-6 flex-1">
                        {contest.description}
                    </p>
                )}

                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/20 p-4 rounded-xl border border-gray-50 dark:border-gray-800/50 mt-auto">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            <Calendar size={12} /> Start
                        </div>
                        <div className="font-medium text-gray-800 dark:text-gray-200 ml-5">
                            {formatDate(contest.startTime)}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
                            <Clock size={12} /> End
                        </div>
                        <div className="font-medium text-gray-800 dark:text-gray-200 ml-5">
                            {formatDate(contest.endTime)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom action area */}
            <div className="border-t border-gray-100 dark:border-gray-800">
                {isLive ? (
                    <div className="p-4">
                        {!isSubmitted ? (
                            <Link
                                to={`/contests/${contest.slug || contest._id}`}
                                className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-blue-100 dark:shadow-none hover:shadow-blue-200 dark:hover:shadow-none transition-all py-3 gap-2 text-sm transform hover:-translate-y-0.5"
                            >
                                Enter Contest <ArrowRight size={16} />
                            </Link>
                        ) : (
                            <Link
                                to={`/contests/${contest.slug || contest._id}/leaderboard`}
                                target="_blank"
                                className="flex w-full items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all py-2.5 text-sm font-medium gap-2"
                            >
                                View Live Leaderboard
                            </Link>
                        )}
                    </div>
                ) : (
                    /* Past contest: side by side colored links */
                    <div className="flex divide-x divide-gray-100 bg-gray-50/30">
                        <Link
                            to={`/contests/${contest.slug || contest._id}/practice`}
                            className="flex-1 flex items-center justify-center gap-2 p-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors group"
                        >
                            <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-200 transition-colors">
                                <BookOpen size={18} />
                            </div>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">Practice</span>
                        </Link>
                        <Link
                            to={`/contests/${contest.slug || contest._id}/leaderboard`}
                            className="flex-1 flex items-center justify-center gap-2 p-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors group"
                        >
                            <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-200 transition-colors">
                                <BarChart2 size={18} />
                            </div>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400">Leaderboard</span>
                        </Link>
                    </div>
                )}
            </div>
        </div >
    );
};

export default ContestList;
