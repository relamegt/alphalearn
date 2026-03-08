import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import contestService from '../../services/contestService';
import adminService from '../../services/adminService';
import ContestCreator from './ContestCreator';
import { Trophy, Calendar, Plus, List, ArrowLeft, Clock, Grid, Layers, Search, Filter, Trash2, Edit, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import CustomDropdown from '../shared/CustomDropdown';

const ContestManager = () => {
    const { user } = useAuth();
    const [view, setView] = useState('list'); // 'list', 'create'
    const [contests, setContests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, upcoming, active, past
    const [batches, setBatches] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState('all');
    const [editingContest, setEditingContest] = useState(null);

    // Fetch batches and contests on mount
    useEffect(() => {
        const init = async () => {
            try {
                setLoading(true);
                // 1. Fetch Batches
                let fetchedBatches = [];
                if (user.role === 'admin' || user.role === 'instructor') {
                    const response = await adminService.getAllBatches();
                    // Handle response structure { success: true, batches: [...] } or just [...]
                    fetchedBatches = response.batches || (Array.isArray(response) ? response : []);
                }
                setBatches(fetchedBatches);

            } catch (error) {
                console.error("Initialization error", error);
            }
        };

        if (user) {
            init();
        }
    }, [user]);

    // Fetch contests whenever selectedBatchId changes
    useEffect(() => {
        fetchContests();
    }, [selectedBatchId, user]);

    const fetchContests = async () => {
        try {
            setLoading(true);
            let data;

            // Pass 'all' explicitly if selectedBatchId is 'all'
            const batchIdParam = selectedBatchId === 'all' ? 'all' : selectedBatchId;
            data = await contestService.getContestsByBatch(batchIdParam);

            if (data && data.contests) {
                setContests(data.contests);
            } else {
                setContests([]);
            }
        } catch (error) {
            console.error("Failed to fetch contests", error);
            setContests([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSuccess = () => {
        setView('list');
        setEditingContest(null);
        fetchContests();
        toast.success(editingContest ? "Contest updated!" : "Contest created!");
    };

    const handleEditContest = (contest) => {
        setEditingContest(contest);
        setView('create');
    };

    const handleDeleteContest = async (contestId) => {
        if (window.confirm("Are you sure you want to delete this contest? ALL associated data including student submissions and leaderboard rankings will be permanently deleted. This action cannot be undone.")) {
            try {
                await contestService.deleteContest(contestId);
                toast.success("Contest deleted successfully");
                fetchContests();
            } catch (error) {
                console.error("Delete contest error", error);
                toast.error("Failed to delete contest");
            }
        }
    };

    const handleCopyLink = (e, contest) => {
        e.preventDefault();
        e.stopPropagation();
        const url = `${window.location.origin}/join/${contest.slug || contest._id}`;
        navigator.clipboard.writeText(url);
        toast.success("Global Contest link copied!");
    };

    const filteredContests = contests.filter(c => {
        let statusMatch = true;
        const now = new Date();
        const start = new Date(c.startTime);
        const end = new Date(c.endTime);

        if (filter === 'upcoming') statusMatch = now < start;
        else if (filter === 'active') statusMatch = now >= start && now <= end;
        else if (filter === 'past') statusMatch = now > end;

        return statusMatch;
    });

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-[#111117] p-6 pb-20 transition-colors">
            <div className="max-w-7xl mx-auto space-y-6">

                <div className="animate-fade-in-up">
                    {view === 'create' ? (
                        <ContestCreator
                            onSuccess={handleCreateSuccess}
                            batches={batches}
                            onBack={() => { setView('list'); setEditingContest(null); }}
                            initialData={editingContest}
                        />
                    ) : (
                        <div className="space-y-6">

                            {/* Header & Filters Combined Bar */}
                            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-[#181820] p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-none transition-colors">

                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
                                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 hidden md:block mr-2">Contests</h1>

                                    {/* Status Filter */}
                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
                                        {['all', 'active', 'upcoming', 'past'].map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setFilter(f)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all whitespace-nowrap ${filter === f
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#23232e]'
                                                    }`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                                    {/* Batch Filter */}
                                    <div className="flex items-center gap-2">
                                        <Filter size={16} className="text-gray-400" />
                                        <div className="w-48">
                                            <CustomDropdown
                                                options={[
                                                    { value: 'all', label: 'All Batches' },
                                                    ...batches.map(batch => ({ value: batch._id, label: batch.name }))
                                                ]}
                                                value={selectedBatchId}
                                                onChange={(val) => setSelectedBatchId(val)}
                                            />
                                        </div>
                                    </div>

                                    <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>

                                    {/* Create Button */}
                                    <button
                                        onClick={() => { setEditingContest(null); setView('create'); }}
                                        className="btn-primary flex items-center justify-center gap-2 shadow-md dark:shadow-none shadow-indigo-100 py-1.5"
                                    >
                                        <Plus size={16} /> <span className="whitespace-nowrap">New Contest</span>
                                    </button>
                                </div>
                            </div>

                            {/* Contest Grid */}
                            {loading ? (
                                <div className="flex justify-center py-12">
                                    <div className="spinner w-8 h-8 border-indigo-600 border-t-transparent"></div>
                                </div>
                            ) : filteredContests.length === 0 ? (
                                <div className="text-center py-16 bg-white dark:bg-[#181820] rounded-2xl border border-gray-100 dark:border-gray-800 border-dashed transition-colors">
                                    <Trophy size={48} className="mx-auto text-gray-200 dark:text-gray-800 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No contests found</h3>
                                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                                        {filter !== 'all' ? `No ${filter} contests found.` : 'Get started by creating a new contest.'}
                                    </p>
                                    {filter === 'all' && (
                                        <button
                                            onClick={() => { setEditingContest(null); setView('create'); }}
                                            className="mt-4 btn-primary inline-flex items-center gap-2"
                                        >
                                            <Plus size={16} /> Create Contest
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredContests.map(contest => {
                                        const now = new Date();
                                        const start = new Date(contest.startTime);
                                        const end = new Date(contest.endTime);
                                        const isActive = now >= start && now <= end;
                                        const isUpcoming = now < start;

                                        // Calculate Duration
                                        const durationMs = end - start;
                                        const hours = Math.floor(durationMs / (1000 * 60 * 60));
                                        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                                        const durationStr = `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;

                                        return (
                                            <div key={contest._id} className={`group relative bg-white dark:bg-[#181820] rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col h-full hover:-translate-y-1 hover:scale-[1.01] ${isActive
                                                ? 'border-green-200 dark:border-green-900/30 shadow-xl shadow-green-50 dark:shadow-none ring-1 ring-green-100 dark:ring-green-900/20'
                                                : 'border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md dark:shadow-none dark:hover:shadow-none hover:border-indigo-100 dark:hover:border-gray-700'
                                                }`}>
                                                {isActive && (
                                                    <div className="absolute top-3 right-3 z-10">
                                                        <span className="relative flex h-3 w-3">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="p-6 flex-1 flex flex-col">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-900/50' :
                                                            isUpcoming ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-900/50' :
                                                                'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                                            }`}>
                                                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></div>}
                                                            {isActive ? 'Live Now' : isUpcoming ? 'Upcoming' : 'Ended'}
                                                        </span>
                                                    </div>

                                                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2 line-clamp-1 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={contest.title}>
                                                        <Link to={`/contests/${contest.slug || contest._id}/leaderboard`} className="hover:underline focus:outline-none">
                                                            {contest.title}
                                                        </Link>
                                                    </h3>

                                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-5 h-10">
                                                        {contest.description || 'No description provided.'}
                                                    </p>

                                                    <div className="flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 mt-auto bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800/50 transition-colors">
                                                        <div className="flex items-center gap-1.5" title="Duration">
                                                            <Clock size={14} className="text-gray-400 dark:text-gray-500" />
                                                            <span>{durationStr}</span>
                                                        </div>
                                                        <div className="w-px h-3 bg-gray-300 dark:bg-gray-700"></div>
                                                        <div className="flex items-center gap-1.5" title="Problem Count">
                                                            <Layers size={14} className="text-gray-400 dark:text-gray-500" />
                                                            <span>{contest.problems?.length || 0} Problems</span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar size={12} />
                                                            {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </span>
                                                        <span>
                                                            {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-gray-50 dark:bg-[#1c1c26] border-t border-gray-100 dark:border-gray-800 flex gap-3 transition-colors">
                                                    <button
                                                        onClick={() => handleEditContest(contest)}
                                                        className="flex-1 py-2 px-3 bg-white dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#23232e] hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all flex items-center justify-center gap-2 shadow-sm dark:shadow-none"
                                                    >
                                                        <Edit size={14} />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteContest(contest._id)}
                                                        className="p-2 bg-white dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 transition-all flex items-center justify-center gap-2 shadow-sm dark:shadow-none"
                                                        title="Delete Contest"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <Link
                                                        to={`/contests/${contest.slug || contest._id}/leaderboard`}
                                                        className="flex-1 py-2 px-3 bg-white dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#23232e] hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all flex items-center justify-center gap-2 shadow-sm dark:shadow-none"
                                                    >
                                                        <Trophy size={14} className={isActive ? "text-yellow-500" : "text-gray-400 dark:text-gray-600"} />
                                                        Leaderboard
                                                    </Link>
                                                    {!contest.batchId && (
                                                        <button
                                                            onClick={(e) => handleCopyLink(e, contest)}
                                                            className="p-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex items-center justify-center gap-2 shadow-sm dark:shadow-none"
                                                            title="Copy Global Contest Link"
                                                        >
                                                            <Copy size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContestManager;
