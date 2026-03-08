import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import submissionService from '../../services/submissionService';
import { useTheme } from '../../contexts/ThemeContext';
import {
    Users,
    BookOpen,
    Activity,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Calendar,
    ArrowRight
} from 'lucide-react';

const InstructorDashboard = () => {
    const navigate = useNavigate();
    const { isDark } = useTheme();
    const [stats, setStats] = useState({
        batches: [],
        totalStudents: 0,
        activeBatchesCount: 0
    });
    const [recentSubmissions, setRecentSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Batches
                const batchData = await adminService.getAllBatches();
                const batches = batchData.batches || [];
                const activeBatches = batches.filter(b => b.status === 'active');

                // Calculate Total Students across all batches
                const totalStudents = batches.reduce((acc, curr) => acc + (curr.studentCount || 0), 0);

                setStats({
                    batches: batches,
                    activeBatchesCount: activeBatches.length,
                    totalStudents: totalStudents
                });

                // Fetch Recent Submissions
                const submissionsData = await submissionService.getRecentSubmissions(10);
                setRecentSubmissions(submissionsData.submissions || []);

            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="spinner w-8 h-8 text-primary-600 dark:text-primary-400"></div>
            </div>
        );
    }

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'accepted': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30';
            case 'wrong answer': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30';
            case 'time limit exceeded': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/30';
            default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700';
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-24 transition-colors">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                        Instructor Dashboard
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Track student progress and manage your batches.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/instructor/contests')}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Activity size={18} />
                        <span>Manage Contests</span>
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Users className="w-24 h-24 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                            <Users size={24} />
                        </div>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.totalStudents}</h3>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Students</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <BookOpen className="w-24 h-24 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400 mb-4">
                            <BookOpen size={24} />
                        </div>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.activeBatchesCount}</h3>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Batches</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Activity className="w-24 h-24 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                            <Activity size={24} />
                        </div>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{recentSubmissions.length}</h3>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Recent Submissions</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Batches List */}
                <div className="lg:col-span-1 space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <BookOpen size={20} className="text-primary-500" />
                        My Batches
                    </h3>
                    <div className="space-y-4">
                        {stats.batches.filter(b => b.status === 'active').slice(0, 5).map(batch => (
                            <div key={batch._id} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{batch.name}</h4>
                                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Active</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                                    <div className="flex items-center gap-1">
                                        <Users size={14} />
                                        <span>{batch.studentCount || 0} Students</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Calendar size={14} />
                                        <span>{new Date(batch.endDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                {/* <button className="w-full py-2 text-sm text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 font-medium transition-colors">
                                    View Details
                                </button> */}
                            </div>
                        ))}
                        {stats.activeBatchesCount === 0 && (
                            <div className="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                <p className="text-gray-500 dark:text-gray-400 text-sm">No active batches found.</p>
                            </div>
                        )}
                        {/* <button className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                             View All Batches <ArrowRight size={14} />
                         </button> */}
                    </div>
                </div>

                {/* Recent Student Activity */}
                <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <Activity size={20} className="text-primary-500" />
                        Recent Student Activity
                    </h3>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50 dark:bg-gray-700/30 text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Student</th>
                                        <th className="px-6 py-4">Problem</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {recentSubmissions.map((sub) => (
                                        <tr key={sub.id || sub._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">{sub.user?.username || 'Unknown Student'}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">{sub.user?.email}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">{sub.problem?.title || 'Unknown Problem'}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">{sub.language}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(sub.status)}`}>
                                                    {sub.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-gray-500 dark:text-gray-400">
                                                {new Date(sub.submittedAt || sub.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                            </td>
                                        </tr>
                                    ))}
                                    {recentSubmissions.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                                                <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                No recent activity found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstructorDashboard;
