// frontend/src/pages/student/ContestList.jsx (FIXED)
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import contestService from '../../services/contestService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const ContestList = () => {
    const { user } = useAuth();
    const [contests, setContests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, active, upcoming, past

    useEffect(() => {
        if (user && user.batchId) {
            fetchContests();
        }
    }, [user, filter]);

    const fetchContests = async () => {
        try {
            setLoading(true);
            const status = filter === 'all' ? null : filter;
            const data = await contestService.getContestsByBatch(user.batchId, status);
            setContests(data.contests);
        } catch (error) {
            toast.error('Failed to fetch contests');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (contest) => {
        const now = new Date();
        const start = new Date(contest.startTime);
        const end = new Date(contest.endTime);

        if (now < start) {
            return <span className="badge-warning">Upcoming</span>;
        } else if (now >= start && now <= end) {
            return <span className="badge-success">Active</span>;
        } else {
            return <span className="badge-secondary">Ended</span>;
        }
    };

    const formatDuration = (start, end) => {
        const durationMs = new Date(end) - new Date(start);
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Contests</h1>
                <div className="flex space-x-2">
                    {['all', 'active', 'upcoming', 'past'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${filter === f
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {contests.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow">
                    <p className="text-gray-500 text-lg">No contests found.</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {contests.map((contest) => {
                        const now = new Date();
                        const start = new Date(contest.startTime);
                        const end = new Date(contest.endTime);
                        const isActive = now >= start && now <= end;
                        const isUpcoming = now < start;
                        const isEnded = now > end;

                        // Check if contest is submitted (from backend response)
                        const isSubmitted = contest.isSubmitted || false;

                        return (
                            <div key={contest._id} className="card hover:shadow-lg transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-semibold text-gray-900 line-clamp-2">
                                        {contest.title}
                                    </h3>
                                    <div className="flex flex-col items-end space-y-1">
                                        {getStatusBadge(contest)}
                                        {isSubmitted && (
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                                Submitted ✓
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                                    {contest.description || 'No description available'}
                                </p>

                                <div className="space-y-2 text-sm text-gray-500 mb-6">
                                    <div className="flex items-center">
                                        <span className="font-medium mr-2">Start:</span>
                                        {new Date(contest.startTime).toLocaleString()}
                                    </div>
                                    <div className="flex items-center">
                                        <span className="font-medium mr-2">Duration:</span>
                                        {formatDuration(contest.startTime, contest.endTime)}
                                    </div>
                                    <div className="flex items-center">
                                        <span className="font-medium mr-2">Problems:</span>
                                        {contest.problems?.length || 0}
                                    </div>
                                    {contest.proctoringEnabled && (
                                        <div className="flex items-center text-orange-600">
                                            <span className="font-medium mr-2">🔒 Proctored</span>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                {isActive && !isSubmitted ? (
                                    <Link
                                        to={`/student/contest/${contest._id}`}
                                        className="btn-primary w-full block text-center"
                                    >
                                        Enter Contest
                                    </Link>
                                ) : isActive && isSubmitted ? (
                                    <div className="space-y-2">
                                        <button
                                            disabled
                                            className="btn-secondary w-full cursor-not-allowed opacity-50"
                                        >
                                            Already Submitted ✓
                                        </button>
                                        <Link
                                            to={`/student/contest/${contest._id}/leaderboard`}
                                            className="btn-outline w-full block text-center text-sm"
                                        >
                                            View Leaderboard
                                        </Link>
                                    </div>
                                ) : isUpcoming ? (
                                    <button
                                        disabled
                                        className="btn-secondary w-full cursor-not-allowed opacity-50"
                                    >
                                        Starts Soon
                                    </button>
                                ) : isEnded && isSubmitted ? (
                                    <Link
                                        to={`/student/contest/${contest._id}/leaderboard`}
                                        className="btn-primary w-full block text-center"
                                    >
                                        📊 View Leaderboard
                                    </Link>
                                ) : isEnded && !isSubmitted ? (
                                    <div className="space-y-2">
                                        <button
                                            disabled
                                            className="btn-secondary w-full cursor-not-allowed opacity-50"
                                        >
                                            Contest Ended
                                        </button>
                                        <Link
                                            to={`/student/contest/${contest._id}/leaderboard`}
                                            className="btn-outline w-full block text-center text-sm"
                                        >
                                            View Leaderboard
                                        </Link>
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ContestList;
