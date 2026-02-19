import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import contestService from '../../services/contestService';
import adminService from '../../services/adminService';
import ContestCreator from './ContestCreator';
import { Trophy, Calendar, Plus, List, ArrowLeft, Clock, Grid, Layers, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const ContestManager = () => {
    const { user } = useAuth();
    const [view, setView] = useState('list'); // 'list', 'create', 'details'
    const [contests, setContests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, upcoming, active, past
    const [batches, setBatches] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState('all');

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
        fetchContests();
        toast.success("Contest created!");
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

                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                {view === 'create' ? <Plus size={24} /> : <Trophy size={24} />}
                            </div>
                            {view === 'create' ? 'Create Contest' : 'Internal Contests'}
                        </h1>
                        <p className="text-gray-500 mt-1 ml-1">
                            {view === 'create'
                                ? 'Design a new challenge for your students.'
                                : 'Manage and view all internal coding contests.'}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        {view === 'create' ? (
                            <button
                                onClick={() => setView('list')}
                                className="btn-secondary flex items-center gap-2"
                            >
                                <ArrowLeft size={18} /> Back to List
                            </button>
                        ) : (
                            <button
                                onClick={() => setView('create')}
                                className="btn-primary flex items-center gap-2 shadow-lg shadow-indigo-200"
                            >
                                <Plus size={18} /> Create New Contest
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="animate-fade-in-up">
                    {view === 'create' ? (
                        <ContestCreator onSuccess={handleCreateSuccess} batches={batches} />
                    ) : (
                        <div className="space-y-6">

                            {/* Filters Bar */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">

                                {/* Status Filter */}
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                    {['all', 'active', 'upcoming', 'past'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setFilter(f)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all whitespace-nowrap ${filter === f
                                                ? 'bg-indigo-50 text-indigo-700'
                                                : 'text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>

                                {/* Batch Filter */}
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <Filter size={18} className="text-gray-400" />
                                    <select
                                        value={selectedBatchId}
                                        onChange={(e) => setSelectedBatchId(e.target.value)}
                                        className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                    >
                                        <option value="all">All Batches</option>
                                        {batches.map(batch => (
                                            <option key={batch._id} value={batch._id}>
                                                {batch.name}
                                            </option>
                                        ))}
                                    </select>
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
                                            onClick={() => setView('create')}
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

                                        return (
                                            <div key={contest._id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col h-full">
                                                <div className="p-5 flex-1">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isActive ? 'bg-green-100 text-green-700' :
                                                            isUpcoming ? 'bg-amber-100 text-amber-700' :
                                                                'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {isActive ? 'Active' : isUpcoming ? 'Upcoming' : 'Ended'}
                                                        </span>
                                                    </div>

                                                    <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors">
                                                        {contest.title}
                                                    </h3>

                                                    <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                                                        {contest.description || 'No description provided.'}
                                                    </p>

                                                    <div className="space-y-2.5">
                                                        <div className="flex items-center text-sm text-gray-600">
                                                            <Calendar size={16} className="text-gray-400 mr-2.5" />
                                                            {new Date(contest.startTime).toLocaleDateString()}
                                                        </div>
                                                        <div className="flex items-center text-sm text-gray-600">
                                                            <Clock size={16} className="text-gray-400 mr-2.5" />
                                                            {new Date(contest.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        <div className="flex items-center text-sm text-gray-600">
                                                            <Layers size={16} className="text-gray-400 mr-2.5" />
                                                            {contest.problems?.length || 0} Problems
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-gray-50/50 border-t border-gray-100 flex gap-3">
                                                    <Link
                                                        to={`/student/contest/${contest._id}/leaderboard`}
                                                        className="flex-1 btn-white text-center text-sm py-2"
                                                        target="_blank"
                                                    >
                                                        Leaderboard
                                                    </Link>

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
