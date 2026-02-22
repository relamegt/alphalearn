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
        <div className="min-h-screen bg-gray-50/50 p-6 pb-20">
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
                            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">

                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
                                    <h1 className="text-xl font-bold text-gray-900 hidden md:block mr-2">Contests</h1>

                                    {/* Status Filter */}
                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full">
                                        {['all', 'active', 'upcoming', 'past'].map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setFilter(f)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all whitespace-nowrap ${filter === f
                                                    ? 'bg-indigo-50 text-indigo-700'
                                                    : 'text-gray-600 hover:bg-gray-50'
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
                                        className="btn-primary flex items-center justify-center gap-2 shadow-md shadow-indigo-100 py-1.5"
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
                                <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 border-dashed">
                                    <Trophy size={48} className="mx-auto text-gray-200 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900">No contests found</h3>
                                    <p className="text-gray-500 mt-1">
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
                                            <div key={contest._id} className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 overflow-hidden flex flex-col h-full relative">
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
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isActive ? 'bg-green-100 text-green-700 ring-1 ring-green-200' :
                                                            isUpcoming ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100' :
                                                                'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></div>}
                                                            {isActive ? 'Live Now' : isUpcoming ? 'Upcoming' : 'Ended'}
                                                        </span>
                                                    </div>

                                                    <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1 leading-tight group-hover:text-indigo-600 transition-colors" title={contest.title}>
                                                        <Link to={`/contests/${contest.slug || contest._id}/leaderboard`} className="hover:underline focus:outline-none">
                                                            {contest.title}
                                                        </Link>
                                                    </h3>

                                                    <p className="text-sm text-gray-500 line-clamp-2 mb-5 h-10">
                                                        {contest.description || 'No description provided.'}
                                                    </p>

                                                    <div className="flex items-center gap-4 text-xs font-medium text-gray-500 mt-auto bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                        <div className="flex items-center gap-1.5" title="Duration">
                                                            <Clock size={14} className="text-gray-400" />
                                                            <span>{durationStr}</span>
                                                        </div>
                                                        <div className="w-px h-3 bg-gray-300"></div>
                                                        <div className="flex items-center gap-1.5" title="Problem Count">
                                                            <Layers size={14} className="text-gray-400" />
                                                            <span>{contest.problems?.length || 0} Problems</span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar size={12} />
                                                            {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </span>
                                                        <span>
                                                            {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                                                    <button
                                                        onClick={() => handleEditContest(contest)}
                                                        className="flex-1 py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 shadow-sm"
                                                    >
                                                        <Edit size={14} />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteContest(contest._id)}
                                                        className="p-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all flex items-center justify-center gap-2 shadow-sm"
                                                        title="Delete Contest"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <Link
                                                        to={`/contests/${contest.slug || contest._id}/leaderboard`}
                                                        className="flex-1 py-2 px-3 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center gap-2 shadow-sm"
                                                    >
                                                        <Trophy size={14} className={isActive ? "text-yellow-500" : "text-gray-400"} />
                                                        Leaderboard
                                                    </Link>
                                                    {!contest.batchId && (
                                                        <button
                                                            onClick={(e) => handleCopyLink(e, contest)}
                                                            className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 transition-all flex items-center justify-center gap-2 shadow-sm"
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
