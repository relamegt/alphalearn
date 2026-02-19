import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import contestService from '../../services/contestService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Trophy, Calendar, Clock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';

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
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const activeContests = contests.filter(c => getContestStatus(c) === 'active');
    const upcomingContests = contests.filter(c => getContestStatus(c) === 'upcoming');
    const pastContests = contests.filter(c => getContestStatus(c) === 'past');

    return (
        <div className="min-h-screen bg-gray-50/50 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Trophy size={28} />
                            </div>
                            Internal Contests
                        </h1>
                        <p className="text-gray-500 mt-2 text-lg ml-1">
                            Compete with your batchmates and climb the leaderboard.
                        </p>
                    </div>
                </div>

                {/* Active Contests Section - Highlighted */}
                {activeContests.length > 0 && (
                    <section className="animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <h2 className="text-xl font-bold text-gray-900">Live Now</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {activeContests.map(contest => (
                                <ContestCard key={contest._id} contest={contest} status="active" />
                            ))}
                        </div>
                    </section>
                )}

                {/* Upcoming Contests Section */}
                {upcomingContests.length > 0 && (
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
                            <h2 className="text-xl font-bold text-gray-900">Upcoming Challenges</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {upcomingContests.map(contest => (
                                <ContestCard key={contest._id} contest={contest} status="upcoming" />
                            ))}
                        </div>
                    </section>
                )}

                {/* Past Contests Section */}
                <section>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-1.5 h-6 bg-gray-400 rounded-full"></div>
                        <h2 className="text-xl font-bold text-gray-900">Past Contests</h2>
                    </div>
                    {pastContests.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {pastContests.map(contest => (
                                <ContestCard key={contest._id} contest={contest} status="past" />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                            <Trophy size={48} className="mx-auto text-gray-200 mb-4" />
                            <p className="text-gray-500">No past contests available.</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

const ContestCard = ({ contest, status }) => {
    const isLive = status === 'active';
    const isUpcoming = status === 'upcoming';
    const isSubmitted = contest.isSubmitted;

    return (
        <div className={`group relative bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col h-full ${isLive
                ? 'border-green-200 shadow-xl shadow-green-50 ring-1 ring-green-100'
                : 'border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100'
            }`}>
            {/* Status Strip */}
            {isLive && (
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-green-400 via-emerald-500 to-green-400 animate-gradient-x"></div>
            )}

            <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4 gap-4">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                        {contest.title}
                    </h3>
                    {isSubmitted && (
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            <CheckCircle size={12} className="mr-1" /> Submitted
                        </span>
                    )}
                </div>

                <p className="text-sm text-gray-500 line-clamp-2 mb-6 flex-1">
                    {contest.description || 'No description provided for this contest.'}
                </p>

                <div className="space-y-3 text-sm text-gray-600 bg-gray-50/50 p-4 rounded-xl border border-gray-50">
                    <div className="flex items-center gap-3">
                        <Calendar size={16} className={isLive ? "text-green-600" : "text-gray-400"} />
                        <span className="font-medium">{new Date(contest.startTime).toLocaleDateString(undefined, {
                            weekday: 'short', month: 'short', day: 'numeric'
                        })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Clock size={16} className={isLive ? "text-green-600" : "text-gray-400"} />
                        <span>
                            {new Date(contest.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {' - '}
                            {new Date(contest.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <ArrowRight size={16} className={isLive ? "text-green-600" : "text-gray-400"} />
                        <span>{contest.problems?.length || 0} Problems</span>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex gap-3">
                {isLive ? (
                    !isSubmitted ? (
                        <Link
                            to={`/student/contest/${contest._id}`}
                            className="flex-1 btn-primary justify-center shadow-lg shadow-green-100 bg-green-600 hover:bg-green-700 border-transparent text-white py-2.5"
                        >
                            Enter Contest <ArrowRight size={16} className="ml-2" />
                        </Link>
                    ) : (
                        <Link
                            to={`/student/contest/${contest._id}/leaderboard`}
                            target="_blank"
                            className="flex-1 btn-white justify-center text-gray-700 hover:text-indigo-600 hover:border-indigo-200 py-2.5"
                        >
                            View Live Leaderboard
                        </Link>
                    )
                ) : isUpcoming ? (
                    <button disabled className="flex-1 btn-secondary justify-center opacity-75 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200 py-2.5">
                        Starts Soon
                    </button>
                ) : (
                    <Link
                        to={`/student/contest/${contest._id}/leaderboard`}
                        className="flex-1 btn-white justify-center text-gray-700 hover:text-indigo-600 hover:border-indigo-200 py-2.5"
                    >
                        View Leaderboard
                    </Link>
                )}
            </div>
        </div>
    );
};

export default ContestList;
