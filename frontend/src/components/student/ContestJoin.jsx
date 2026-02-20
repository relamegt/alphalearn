import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import contestService from '../../services/contestService';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Calendar, Clock, Trophy, Users, AlertCircle, Terminal, Play } from 'lucide-react';
import { TfiTimer } from "react-icons/tfi";

const ContestJoin = () => {
    const { contestId } = useParams();
    const navigate = useNavigate();
    const { user, loginAsSpotUser } = useAuth();

    const [contest, setContest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [status, setStatus] = useState(''); // 'upcoming', 'active', 'ended'
    const [currentTime, setCurrentTime] = useState(new Date());

    // Spot Registration Form
    const [formData, setFormData] = useState({
        name: '',
        rollNumber: '',
        branch: ''
    });
    const [registering, setRegistering] = useState(false);

    const fetchContestInfo = async () => {
        try {
            const response = await contestService.getPublicContestInfo(contestId);
            if (response.success) {
                setContest(response.contest);
                updateStatus(response.contest);
            }
        } catch (err) {
            if (err.status === 'ended') {
                setStatus('ended');
                setError('This contest has already ended.');
            } else if (err.status === 404 || err.message?.includes('not found')) {
                setError('Contest not found.');
            } else {
                setError('Failed to load contest info.');
            }
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = (c) => {
        if (!c) return;
        const now = new Date();
        const start = new Date(c.startTime);
        const end = new Date(c.endTime);

        if (now < start) setStatus('upcoming');
        else if (now >= start && now <= end) setStatus('active');
        else setStatus('ended');
    };

    useEffect(() => {
        fetchContestInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contestId]);

    // Pure frontend timer that updates UI and only triggers a backend fetch when a threshold is crossed
    useEffect(() => {
        if (!contest) return;

        const interval = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);

            const start = new Date(contest.startTime);
            const end = new Date(contest.endTime);

            if (status === 'upcoming' && now >= start) {
                // Timer hit 0! Update status and fetch from backend to lock in active status
                setStatus('active');
                fetchContestInfo();
            } else if (status === 'active' && now > end) {
                // Timer ended naturally
                setStatus('ended');
                fetchContestInfo();
            }
        }, 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contest, status]);

    const handleRegister = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            return toast.error('Name is required');
        }
        if (!formData.rollNumber.trim()) {
            return toast.error('Roll Number is required');
        }
        if (!formData.branch.trim()) {
            return toast.error('Branch is required');
        }

        setRegistering(true);
        try {
            const response = await contestService.registerSpotUser({
                contestId,
                ...formData
            });

            if (response.success) {
                // Update auth context
                loginAsSpotUser(response.user, response.token);
                if (status === 'upcoming') {
                    toast.success('Registered successfully! Please wait for the contest to start.');
                } else {
                    navigate(`/student/contest/${contestId}`);
                }
            }
        } catch (err) {
            toast.error(err.message || 'Registration failed');
        } finally {
            setRegistering(false);
        }
    };

    const handleEnterContest = () => {
        navigate(`/student/contest/${contestId}`);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (error && !contest) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Unavailable</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center transform rotate-3">
                    <Terminal className="text-white w-5 h-5 transform -rotate-3" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    AlphaLearn Info
                </span>
            </div>

            <div className="bg-white max-w-2xl w-full rounded-2xl shadow-xl border border-gray-100 flex flex-col overflow-hidden" style={{ maxHeight: '85vh' }}>
                {/* Contest Banner */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shrink-0">
                    <h1 className="text-3xl font-bold mb-2">{contest?.title || 'Contest'}</h1>
                    <p className="text-indigo-100 opacity-90">{contest?.description || 'Global Programming Contest'}</p>
                </div>

                <div className="p-6 overflow-y-auto">
                    {/* Status Tracker */}
                    <div className="flex flex-col sm:flex-row gap-6 mb-8 p-6 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="flex-1 flex items-start gap-3">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Starts At</p>
                                <p className="font-semibold text-gray-900">
                                    {new Date(contest?.startTime).toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                    })}
                                </p>
                            </div>
                        </div>
                        <div className="hidden sm:block w-px bg-gray-200"></div>
                        <div className="flex-1 flex items-start gap-3">
                            <div className="p-2 bg-green-100 rounded-lg text-green-600">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Status</p>
                                {status === 'upcoming' && <p className="font-semibold text-amber-600">Upcoming</p>}
                                {status === 'active' && <p className="font-semibold text-green-600 animate-pulse">Active Now</p>}
                                {status === 'ended' && <p className="font-semibold text-red-600">Ended</p>}
                            </div>
                        </div>
                    </div>

                    {status === 'upcoming' && (() => {
                        const start = new Date(contest?.startTime);
                        const diff = start - currentTime;

                        let countdownDisplay = 'Starting soon...';
                        if (diff > 0) {
                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                            const secs = Math.floor((diff % (1000 * 60)) / 1000);

                            const parts = [];
                            if (days > 0) parts.push(`${days}d`);
                            if (hours > 0 || days > 0) parts.push(`${hours}h`);
                            parts.push(`${mins}m`);
                            parts.push(`${secs}s`);

                            countdownDisplay = parts.join(' ');
                        }

                        return (
                            <div className="text-center p-6 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 mb-8">
                                <Trophy className="w-10 h-10 mx-auto mb-2 text-amber-500" />
                                <h3 className="text-lg font-semibold">Contest hasn't started yet!</h3>
                                <p className="text-sm opacity-80 mt-1 mb-3">Please wait for the timer to begin. Registrations are open.</p>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-amber-200 shadow-sm font-mono text-xl font-bold text-amber-600">
                                    <TfiTimer className="w-5 h-5 text-amber-500" />
                                    {countdownDisplay}
                                </div>
                            </div>
                        );
                    })()}

                    {status === 'ended' && (
                        <div className="text-center p-6 bg-red-50 text-red-800 rounded-xl border border-red-200 mb-8">
                            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-500" />
                            <h3 className="text-lg font-semibold">Contest is Over</h3>
                            <p className="text-sm opacity-80 mt-1">You can no longer participate in this contest.</p>
                        </div>
                    )}

                    {/* Registration / Entry Section */}
                    {status !== 'ended' && (
                        <div className="mt-8">
                            {user ? (
                                <div className="text-center">
                                    <div className="bg-indigo-50 text-indigo-800 p-4 rounded-lg mb-6 flex items-center justify-center gap-2">
                                        <Users className="w-5 h-5" />
                                        <span>Logged in as <b>{user.firstName || user.name || user.email}</b></span>
                                    </div>
                                    <button
                                        onClick={handleEnterContest}
                                        disabled={status === 'upcoming'}
                                        className={`w-full flex items-center justify-center py-3 px-4 rounded-xl text-white font-medium transition ${status === 'upcoming'
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
                                            }`}
                                    >
                                        <Play className="w-5 h-5 mr-2" />
                                        {status === 'upcoming' ? 'Waiting to Start' : 'Enter Contest Now'}
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Trophy className="w-5 h-5 text-indigo-600" />
                                        Spot Registration
                                    </h3>
                                    <form onSubmit={handleRegister} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                placeholder="e.g. John Doe"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={formData.rollNumber}
                                                    onChange={e => setFormData({ ...formData, rollNumber: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    placeholder="e.g. 21XJ1A0100"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={formData.branch}
                                                    onChange={e => setFormData({ ...formData, branch: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    placeholder="e.g. CSE"
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-4">
                                            <button
                                                type="submit"
                                                disabled={registering}
                                                className={`w-full flex items-center justify-center py-3 px-4 rounded-xl text-white font-medium transition ${registering ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
                                                    }`}
                                            >
                                                {registering ? (
                                                    <span className="flex items-center">
                                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        Registering...
                                                    </span>
                                                ) : status === 'upcoming' ? (
                                                    'Register & Wait'
                                                ) : (
                                                    'Register & Enter Contest'
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                    <div className="mt-6 text-center text-sm text-gray-500">
                                        Already have an account? <span className="text-indigo-600 font-medium cursor-pointer hover:underline" onClick={() => navigate('/login')}>Login here</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContestJoin;
