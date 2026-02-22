import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import contestService from '../../services/contestService';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Calendar, Clock, Trophy, Users, AlertCircle, Terminal, Play } from 'lucide-react';

const ContestJoin = () => {
    const { contestId } = useParams();
    const navigate = useNavigate();
    const { user, loginAsSpotUser } = useAuth();

    const [contest, setContest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [status, setStatus] = useState(''); // 'upcoming', 'active', 'ended'

    // Spot Registration Form
    const [formData, setFormData] = useState({ name: '', rollNumber: '', branch: '' });
    const [registering, setRegistering] = useState(false);

    // Refs for direct DOM countdown updates — zero re-renders per tick = zero blink
    const daysRef = useRef(null);
    const hoursRef = useRef(null);
    const minutesRef = useRef(null);
    const secondsRef = useRef(null);

    // Mirrors of internal state for use inside intervals without stale closures
    const contestRef = useRef(null);
    const statusRef = useRef('');

    // ── fetch ────────────────────────────────────────────────────────────────
    const fetchContestInfo = async () => {
        try {
            const response = await contestService.getPublicContestInfo(contestId);
            if (response.success) {
                setContest(response.contest);
                contestRef.current = response.contest;
                const s = computeStatus(response.contest);
                setStatus(s);
                statusRef.current = s;
            }
        } catch (err) {
            if (err.status === 'ended') {
                setStatus('ended');
                statusRef.current = 'ended';
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

    const computeStatus = (c) => {
        if (!c) return '';
        const now = new Date();
        const start = new Date(c.startTime);
        const end = new Date(c.endTime);
        if (now < start) return 'upcoming';
        if (now <= end) return 'active';
        return 'ended';
    };

    useEffect(() => {
        fetchContestInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contestId]);

    // ── per-second tick — direct DOM update, no setState ─────────────────────
    useEffect(() => {
        if (!contest) return;

        const interval = setInterval(() => {
            const now = new Date();
            const c = contestRef.current;
            if (!c) return;

            const start = new Date(c.startTime);
            const end = new Date(c.endTime);
            const cur = statusRef.current;

            // Status transitions are the only thing that need a re-render
            if (cur === 'upcoming' && now >= start) {
                statusRef.current = 'active';
                setStatus('active');
                fetchContestInfo();
                return;
            }
            if (cur === 'active' && now > end) {
                statusRef.current = 'ended';
                setStatus('ended');
                fetchContestInfo();
                return;
            }

            // Update countdown digits directly in the DOM — no React re-render
            if (cur === 'upcoming' && daysRef.current) {
                const diff = start - now;
                if (diff > 0) {
                    daysRef.current.textContent = String(Math.floor(diff / 86400000)).padStart(2, '0');
                    hoursRef.current.textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
                    minutesRef.current.textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
                    secondsRef.current.textContent = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
                }
            }
        }, 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contest]);

    // Compute initial digit values for first render (before first tick fires)
    const getInitCountdown = () => {
        if (!contest) return { d: '00', h: '00', m: '00', s: '00' };
        const diff = new Date(contest.startTime) - new Date();
        if (diff <= 0) return { d: '00', h: '00', m: '00', s: '00' };
        return {
            d: String(Math.floor(diff / 86400000)).padStart(2, '0'),
            h: String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0'),
            m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
            s: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
        };
    };

    // ── handlers ─────────────────────────────────────────────────────────────
    const handleRegister = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) return toast.error('Name is required');
        if (!formData.rollNumber.trim()) return toast.error('Roll Number is required');
        if (!formData.branch.trim()) return toast.error('Branch is required');

        setRegistering(true);
        try {
            const response = await contestService.registerSpotUser({ contestId, ...formData });
            if (response.success) {
                const isUpcoming = statusRef.current === 'upcoming';
                loginAsSpotUser(response.user, response.token, !isUpcoming);
                if (isUpcoming) {
                    toast.success('Registered! Please wait for the contest to start.');
                } else {
                    navigate(`/contests/${contest.slug || contestId}`);
                }
            }
        } catch (err) {
            toast.error(err.message || 'Registration failed');
        } finally {
            setRegistering(false);
        }
    };

    const handleEnterContest = () => {
        navigate(`/contests/${contest.slug || contestId}`);
    };

    // ── loading / error screens ───────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    if (error && !contest) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {error === 'Contest not found.' ? 'Contest Not Found' : 'Unavailable'}
                    </h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    {/* <button
                        onClick={() => navigate('/login')}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        Return Home
                    </button> */}
                </div>
            </div>
        );
    }

    const init = getInitCountdown();

    // ── main render ───────────────────────────────────────────────────────────
    return (
        <div className="h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-4">
                <img
                    src="/alphalogo.png"
                    alt="AlphaKnowledge"
                    className="h-10 w-auto object-contain"
                />
                <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    AlphaKnowledge
                </span>
            </div>

            <div
                className="bg-white max-w-lg w-full rounded-2xl shadow-xl border border-gray-100 flex flex-col overflow-hidden"
                style={{ maxHeight: '85vh' }}
            >
                {/* Banner */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shrink-0">
                    <h1 className="text-3xl font-bold mb-2">{contest?.title || 'Contest'}</h1>
                    <p className="text-indigo-100 opacity-90">{contest?.description}</p>
                </div>

                <div className="p-6 overflow-y-auto">
                    {/* Info row */}
                    <div className="flex flex-col sm:flex-row gap-6 mb-8 p-6 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="flex-1 flex items-start gap-3">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-500">Starts At</p>
                                <p className="font-semibold text-gray-900">
                                    {new Date(contest?.startTime).toLocaleString('en-US', {
                                        month: 'short', day: 'numeric', year: 'numeric',
                                        hour: 'numeric', minute: '2-digit', hour12: true,
                                    })}
                                </p>
                            </div>
                        </div>
                        <div className="hidden sm:block w-px bg-gray-200" />
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

                    {/* ── Countdown (digits wired to DOM refs) ── */}
                    {status === 'upcoming' && (
                        <div className="text-center p-6 bg-amber-50 text-amber-800 rounded-xl border border-amber-200 mb-8">
                            <Trophy className="w-10 h-10 mx-auto mb-2 text-amber-500" />
                            <h3 className="text-lg font-semibold mb-1">Contest hasn't started yet!</h3>
                            <p className="text-sm opacity-80 mt-1 mb-4">
                                Please wait for the timer to begin. Registrations are open.
                            </p>
                            <div className="flex items-start justify-center w-full gap-3">
                                {/* Days */}
                                <div className="timer w-14">
                                    <div className="bg-white border border-amber-200 rounded-lg px-2 py-2 shadow-sm">
                                        <h3 ref={daysRef} className="font-semibold text-2xl text-indigo-600 text-center tabular-nums leading-none">
                                            {init.d}
                                        </h3>
                                    </div>
                                    <p className="text-xs font-normal text-amber-700 mt-1 text-center">days</p>
                                </div>
                                <h3 className="font-semibold text-2xl text-amber-700 mt-2">:</h3>
                                {/* Hours */}
                                <div className="timer w-14">
                                    <div className="bg-white border border-amber-200 rounded-lg px-2 py-2 shadow-sm">
                                        <h3 ref={hoursRef} className="font-semibold text-2xl text-indigo-600 text-center tabular-nums leading-none">
                                            {init.h}
                                        </h3>
                                    </div>
                                    <p className="text-xs font-normal text-amber-700 mt-1 text-center">hours</p>
                                </div>
                                <h3 className="font-semibold text-2xl text-amber-700 mt-2">:</h3>
                                {/* Minutes */}
                                <div className="timer w-14">
                                    <div className="bg-white border border-amber-200 rounded-lg px-2 py-2 shadow-sm">
                                        <h3 ref={minutesRef} className="font-semibold text-2xl text-indigo-600 text-center tabular-nums leading-none">
                                            {init.m}
                                        </h3>
                                    </div>
                                    <p className="text-xs font-normal text-amber-700 mt-1 text-center">minutes</p>
                                </div>
                                <h3 className="font-semibold text-2xl text-amber-700 mt-2">:</h3>
                                {/* Seconds */}
                                <div className="timer w-14">
                                    <div className="bg-white border border-amber-200 rounded-lg px-2 py-2 shadow-sm">
                                        <h3 ref={secondsRef} className="font-semibold text-2xl text-indigo-600 text-center tabular-nums leading-none">
                                            {init.s}
                                        </h3>
                                    </div>
                                    <p className="text-xs font-normal text-amber-700 mt-1 text-center">seconds</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Ended banner */}
                    {status === 'ended' && (
                        <div className="text-center p-6 bg-red-50 text-red-800 rounded-xl border border-red-200 mb-8">
                            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-500" />
                            <h3 className="text-lg font-semibold">Contest is Over</h3>
                            <p className="text-sm opacity-80 mt-1">You can no longer participate in this contest.</p>
                        </div>
                    )}

                    {/* Registration / Entry */}
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
                                                type="text" required
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
                                                    type="text" required
                                                    value={formData.rollNumber}
                                                    onChange={e => setFormData({ ...formData, rollNumber: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    placeholder="e.g. 21XJ1A0100"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
                                                <input
                                                    type="text" required
                                                    value={formData.branch}
                                                    onChange={e => setFormData({ ...formData, branch: e.target.value })}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                                    placeholder="e.g. CSE"
                                                />
                                            </div>
                                        </div>
                                        <div className="pt-4">
                                            <button
                                                type="submit" disabled={registering}
                                                className={`w-full flex items-center justify-center py-3 px-4 rounded-xl text-white font-medium transition ${registering ? 'bg-indigo-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
                                                    }`}
                                            >
                                                {registering ? (
                                                    <span className="flex items-center">
                                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                        </svg>
                                                        Registering...
                                                    </span>
                                                ) : status === 'upcoming' ? 'Register & Wait' : 'Register & Enter Contest'}
                                            </button>
                                        </div>
                                    </form>
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
