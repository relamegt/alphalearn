import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import { TrendingUp, Trophy, Plus, Users, BookOpen, ArrowRight, Code, Activity, Layers, GraduationCap } from 'lucide-react';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const data = await adminService.getSystemAnalytics();
                setAnalytics(data.analytics);
            } catch (error) {
                console.error("Failed to fetch analytics", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="spinner w-8 h-8 text-primary-600"></div>
            </div>
        );
    }

    // Chart Data Preparation
    const problemData = analytics?.problems?.byDifficulty ? [
        { name: 'Easy', value: analytics.problems.byDifficulty.Easy || 0, color: '#10B981' },
        { name: 'Medium', value: analytics.problems.byDifficulty.Medium || 0, color: '#F59E0B' },
        { name: 'Hard', value: analytics.problems.byDifficulty.Hard || 0, color: '#EF4444' },
    ] : [];

    // Filter out zero values for better pie chart
    const activeProblemData = problemData.filter(d => d.value > 0);

    const userStats = [
        { name: 'Students', value: analytics?.users?.students || 0, fill: '#3B82F6' },
        { name: 'Instructors', value: analytics?.users?.instructors || 0, fill: '#8B5CF6' },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                        Dashboard
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Welcome back, Admin. Here's what's happening today.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/admin/reports')}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <Activity size={18} />
                        <span>View Reports</span>
                    </button>
                    <button
                        onClick={() => navigate('/admin/batches')}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Users size={18} />
                        <span>Manage Batches</span>
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Users */}
                <div className="card border-none shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users className="w-24 h-24 text-blue-600" />
                    </div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-200 text-white">
                            <Users />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Total Users</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">{analytics?.users?.total || 0}</h3>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-full">
                        <TrendingUp size={12} className="w-3 h-3" />
                        <span>{analytics?.users?.students || 0} Students</span>
                    </div>
                </div>

                {/* Active Batches */}
                <div className="card border-none shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Layers className="w-24 h-24 text-green-600" />
                    </div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-200 text-white">
                            <GraduationCap />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Active Batches</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">{analytics?.batches?.active || 0}</h3>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 w-fit px-2 py-1 rounded-full">
                        <span>Total: {analytics?.batches?.total || 0}</span>
                    </div>
                </div>

                {/* Problems */}
                <div className="card border-none shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Code className="w-24 h-24 text-purple-600" />
                    </div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-purple-200 text-white">
                            <Code />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Problems</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">{analytics?.problems?.total || 0}</h3>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-purple-600 bg-purple-50 w-fit px-2 py-1 rounded-full">
                        <span>{analytics?.problems?.byDifficulty?.Hard || 0} Hard Problems</span>
                    </div>
                </div>

                {/* Submissions */}
                <div className="card border-none shadow-lg relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Activity className="w-24 h-24 text-orange-600" />
                    </div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-orange-200 text-white">
                            <Activity />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Submissions</p>
                            <h3 className="text-2xl font-bold text-gray-900 mt-0.5">{analytics?.submissions?.total || 0}</h3>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-xs font-medium text-orange-600 bg-orange-50 w-fit px-2 py-1 rounded-full">
                        <span>Lifetime Count</span>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Problem Distribution */}
                <div className="glass-panel p-6 rounded-2xl relative">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Problem Distribution</h3>
                    <div className="h-64 flex justify-center items-center">
                        {activeProblemData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={activeProblemData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {activeProblemData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-gray-400">No problem data available</p>
                        )}
                    </div>
                </div>

                {/* User Distribution */}
                <div className="glass-panel p-6 rounded-2xl relative">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">User Demographics</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={userStats}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                barSize={40}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280' }} />
                                <Tooltip
                                    cursor={{ fill: '#F3F4F6' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={1000}>
                                    {userStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <TrendingUp size={24} className="text-primary-500" />
                    Quick Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <button
                        onClick={() => navigate('/admin/contests')}
                        className="group p-5 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-md hover:shadow-blue-50 transition-all text-left flex flex-col h-full relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-4 z-10">
                            <Trophy size={20} />
                        </div>
                        <h4 className="font-bold text-gray-800 mb-1 z-10 group-hover:text-blue-700 transition-colors">Create Contest</h4>
                        <p className="text-xs text-gray-500 z-10">Host a new coding challenge</p>
                        <div className="mt-auto pt-4 flex justify-end">
                            <ArrowRight size={16} className="text-blue-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/admin/problems')}
                        className="group p-5 rounded-xl border border-gray-100 bg-white hover:border-purple-200 hover:shadow-md hover:shadow-purple-50 transition-all text-left flex flex-col h-full relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                        <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-4 z-10">
                            <Code size={20} />
                        </div>
                        <h4 className="font-bold text-gray-800 mb-1 z-10 group-hover:text-purple-700 transition-colors">Add Problem</h4>
                        <p className="text-xs text-gray-500 z-10">Expand the question bank</p>
                        <div className="mt-auto pt-4 flex justify-end">
                            <ArrowRight size={16} className="text-purple-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/admin/users')}
                        className="group p-5 rounded-xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50 transition-all text-left flex flex-col h-full relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                        <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 z-10">
                            <Users size={20} />
                        </div>
                        <h4 className="font-bold text-gray-800 mb-1 z-10 group-hover:text-indigo-700 transition-colors">Manage Users</h4>
                        <p className="text-xs text-gray-500 z-10">View and edit user accounts</p>
                        <div className="mt-auto pt-4 flex justify-end">
                            <ArrowRight size={16} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/admin/sections')}
                        className="group p-5 rounded-xl border border-gray-100 bg-white hover:border-teal-200 hover:shadow-md hover:shadow-teal-50 transition-all text-left flex flex-col h-full relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
                        <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center mb-4 z-10">
                            <BookOpen size={20} />
                        </div>
                        <h4 className="font-bold text-gray-800 mb-1 z-10 group-hover:text-teal-700 transition-colors">Sections</h4>
                        <p className="text-xs text-gray-500 z-10">Organize curriculum content</p>
                        <div className="mt-auto pt-4 flex justify-end">
                            <ArrowRight size={16} className="text-teal-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
