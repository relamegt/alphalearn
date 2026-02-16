// frontend/src/pages/student/ContestInterface.jsx (COMPLETE WITH ALL FEATURES)
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import contestService from '../../services/contestService';
import useProctoring from '../../hooks/useProctoring';
import { initSecurityFeatures } from '../../utils/disableInspect';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import Cookies from 'js-cookie';

const LANGUAGE_OPTIONS = [
    { value: 'cpp', label: 'C++', monacoLang: 'cpp' },
    { value: 'java', label: 'Java', monacoLang: 'java' },
    { value: 'python', label: 'Python 3', monacoLang: 'python' },
    { value: 'javascript', label: 'JavaScript', monacoLang: 'javascript' },
];

const ContestInterface = () => {
    const { contestId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Core State
    const [contest, setContest] = useState(null);
    const [selectedProblem, setSelectedProblem] = useState(null);
    const [userCodeMap, setUserCodeMap] = useState({});
    const [userSubmissions, setUserSubmissions] = useState({});
    const [lockedProblems, setLockedProblems] = useState(new Set());
    const [contestSubmitted, setContestSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [running, setRunning] = useState(false);
    const [consoleOutput, setConsoleOutput] = useState(null);
    const [activeTab, setActiveTab] = useState('description');
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [contestActive, setContestActive] = useState(false);

    // Leaderboard State
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [liveParticipants, setLiveParticipants] = useState(0);

    // Editor State
    const [currentCode, setCurrentCode] = useState('// Select a language and start coding');
    const [currentLang, setCurrentLang] = useState('cpp');

    // Sample Test Cases
    const [sampleTestCases, setSampleTestCases] = useState([]);

    // WebSocket
    const wsRef = useRef(null);
    const autoSubmitTriggered = useRef(false);

    // Contest End Handler
    const handleContestEnd = useCallback(() => {
        setContestActive(false);
        toast.success('Contest has ended!');
        setTimeout(() => {
            navigate(`/student/contests`);
        }, 2000);
    }, [navigate]);

    // Auto-submission handler
    const handleMaxViolations = useCallback(async () => {
        if (autoSubmitTriggered.current || !selectedProblem || contestSubmitted) return;

        autoSubmitTriggered.current = true;
        toast.error('⚠️ Maximum violations exceeded! Auto-submitting current code...');

        const violationData = getViolationSummary();

        try {
            await contestService.submitContestCode(contestId, {
                problemId: selectedProblem._id,
                code: currentCode,
                language: currentLang,
                ...violationData,
                isAutoSubmit: true
            });

            toast.success('Code auto-submitted due to violations');

            // Auto-finish contest
            await handleFinishContest(true);

        } catch (error) {
            toast.error('Auto-submission failed');
        }
    }, [contestId, selectedProblem, currentCode, currentLang, contestSubmitted]);

    const {
        violations,
        isFullscreen,
        showViolationModal,
        currentViolationType,
        enterFullscreen,
        getViolationSummary
    } = useProctoring(contestId, contestActive && !contestSubmitted, handleMaxViolations);

    // WebSocket Message Handler
    const handleWebSocketMessage = useCallback((data) => {
        console.log('🔄 Processing WebSocket message:', data.type);

        switch (data.type) {
            case 'joined':
                console.log('✅ Successfully joined contest room');
                toast.success('Connected to live updates', { duration: 2000 });
                break;

            case 'leaderboardUpdate':
                console.log('🏆 Leaderboard updated:', data.leaderboard?.length, 'entries');
                setLeaderboardData(data.leaderboard || []);
                break;

            case 'participantCount':
                console.log('👥 Participant count updated:', data.count);
                setLiveParticipants(data.count);
                break;

            case 'newSubmission':
                console.log('📝 New submission:', data.submission);
                if (data.submission?.verdict === 'Accepted') {
                    toast.success(`Someone solved a problem!`, { duration: 2000 });
                }
                break;

            case 'violation':
                console.log('⚠️ Violation:', data.violation);
                toast.error(`Violation detected: ${data.violation?.type}`);
                break;

            case 'contestEnded':
                console.log('⏰ Contest ended');
                handleContestEnd();
                break;

            case 'error':
                console.error('❌ WebSocket error:', data.message);
                toast.error(data.message);
                break;

            default:
                console.log('❓ Unknown message type:', data.type);
                break;
        }
    }, [handleContestEnd]);

    // WebSocket Connection
    useEffect(() => {
        if (!contestActive || !contest || contestSubmitted) return;

        let token = localStorage.getItem('accessToken') ||
            localStorage.getItem('token') ||
            Cookies.get('accessToken');

        if (!token) {
            console.error('❌ No access token found');
            return;
        }

        token = token.replace('Bearer ', '').trim();

        const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:5000'}/ws`;
        console.log('🔌 Connecting to WebSocket:', wsUrl);

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ WebSocket connected, sending join...');
            ws.send(JSON.stringify({
                type: 'join',
                contestId,
                token
            }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('❌ Failed to parse WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };

        ws.onclose = (event) => {
            console.log('🔌 WebSocket disconnected:', event.code);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify({ type: 'leave', contestId }));
                } catch (error) {
                    console.error('Error sending leave message:', error);
                }
                ws.close(1000, 'Component unmounting');
            }
        };
    }, [contestActive, contest, contestId, contestSubmitted, handleWebSocketMessage]);

    // Leaderboard Fetch with Polling
    useEffect(() => {
        let intervalId;

        const fetchLeaderboard = async () => {
            try {
                const data = await contestService.getContestLeaderboard(contestId);
                setLeaderboardData(data.leaderboard || []);
            } catch (error) {
                console.error('Failed to fetch leaderboard:', error);
            }
        };

        if (showLeaderboard) {
            fetchLeaderboard();
            if (contestActive && !contestSubmitted) {
                intervalId = setInterval(fetchLeaderboard, 10000);
            }
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [showLeaderboard, contestActive, contestSubmitted, contestId]);

    // Initialize
    useEffect(() => {
        const savedMap = localStorage.getItem(`contest_${contestId}_codeMap`);
        if (savedMap) {
            try {
                setUserCodeMap(JSON.parse(savedMap));
            } catch (e) {
                console.error('Failed to parse saved code map', e);
            }
        }

        fetchContest();

        const cleanupSecurity = initSecurityFeatures();
        return () => {
            cleanupSecurity();
        };
    }, [contestId]);

    // Auto-save code
    useEffect(() => {
        if (selectedProblem && !contestSubmitted && !lockedProblems.has(selectedProblem._id)) {
            const timer = setTimeout(() => {
                setUserCodeMap(prev => {
                    const updated = {
                        ...prev,
                        [selectedProblem._id]: { code: currentCode, lang: currentLang }
                    };
                    localStorage.setItem(`contest_${contestId}_codeMap`, JSON.stringify(updated));
                    return updated;
                });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [currentCode, currentLang, selectedProblem, contestId, contestSubmitted, lockedProblems]);

    // Timer
    useEffect(() => {
        if (contest && contestActive && !contestSubmitted) {
            const interval = setInterval(() => {
                const now = new Date();
                const end = new Date(contest.endTime);
                const remaining = Math.max(0, Math.floor((end - now) / 1000));
                setTimeRemaining(remaining);

                if (remaining === 0) {
                    handleContestEnd();
                }
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [contest, contestActive, contestSubmitted, handleContestEnd]);

    const fetchContest = async () => {
        try {
            const [contestData, submissionsData] = await Promise.all([
                contestService.getContestById(contestId),
                contestService.getStudentContestSubmissions(contestId).catch(() => ({ submissions: [] }))
            ]);

            setContest(contestData.contest);
            setContestSubmitted(contestData.contest.isSubmitted || false);

            // Build locked problems set
            const locked = new Set();
            if (contestData.contest.problems) {
                contestData.contest.problems.forEach(problem => {
                    if (problem.isLocked || problem.isSolved) {
                        locked.add(problem._id);
                    }
                });
            }
            setLockedProblems(locked);

            if (submissionsData.submissions) {
                const subMap = {};
                submissionsData.submissions.forEach(sub => {
                    if (sub.verdict === 'Accepted') {
                        subMap[sub.problemId] = 'Accepted';
                    } else if (!subMap[sub.problemId]) {
                        subMap[sub.problemId] = sub.verdict;
                    }
                });
                setUserSubmissions(subMap);
            }

            const now = new Date();
            const start = new Date(contestData.contest.startTime);
            const end = new Date(contestData.contest.endTime);

            if (contestData.contest.isSubmitted) {
                toast('Contest already submitted');
                setTimeout(() => navigate('/student/contests'), 2000);
                return;
            }

            if (now >= start && now <= end) {
                setContestActive(true);
            } else if (now > end) {
                toast.error('Contest has ended');
                navigate('/student/contests');
                return;
            } else {
                toast('Contest has not started yet');
                navigate('/student/contests');
                return;
            }

            if (contestData.contest.problems?.length > 0) {
                const firstUnlockedProblem = contestData.contest.problems.find(p => !locked.has(p._id));
                const firstProblem = firstUnlockedProblem || contestData.contest.problems[0];

                setSelectedProblem(firstProblem);
                setSampleTestCases(firstProblem.testCases?.filter(tc => !tc.isHidden) || []);

                const savedMapStr = localStorage.getItem(`contest_${contestId}_codeMap`);
                if (savedMapStr) {
                    const savedMap = JSON.parse(savedMapStr);
                    setUserCodeMap(savedMap);

                    if (savedMap[firstProblem._id] && !locked.has(firstProblem._id)) {
                        setCurrentCode(savedMap[firstProblem._id].code);
                        setCurrentLang(savedMap[firstProblem._id].lang);
                    }
                }
            }
        } catch (error) {
            toast.error('Failed to load contest');
            console.error(error);
        }
    };

    const handleProblemChange = (problem) => {
        if (contestSubmitted) {
            toast.error('Contest already submitted');
            return;
        }

        if (lockedProblems.has(problem._id)) {
            toast('This problem is locked (already solved)');
            return;
        }

        if (selectedProblem && !lockedProblems.has(selectedProblem._id)) {
            setUserCodeMap((prev) => {
                const updated = {
                    ...prev,
                    [selectedProblem._id]: { code: currentCode, lang: currentLang },
                };
                localStorage.setItem(`contest_${contestId}_codeMap`, JSON.stringify(updated));
                return updated;
            });
        }

        const savedMap = JSON.parse(localStorage.getItem(`contest_${contestId}_codeMap`) || '{}');
        const saved = savedMap[problem._id] || { code: '// Write your code here', lang: 'cpp' };

        setCurrentCode(saved.code);
        setCurrentLang(saved.lang);
        setSelectedProblem(problem);
        setSampleTestCases(problem.testCases?.filter(tc => !tc.isHidden) || []);
        setActiveTab('description');
        setConsoleOutput(null);
    };

    const handleRun = async () => {
        if (contestSubmitted) {
            toast.error('Contest already submitted. Cannot run code.');
            return;
        }

        if (lockedProblems.has(selectedProblem._id)) {
            toast.error('Problem is locked (already solved). Cannot run code.');
            return;
        }

        if (!currentCode.trim()) {
            toast.error('Code cannot be empty');
            return;
        }

        if (!document.fullscreenElement && contest?.proctoringEnabled) {
            enterFullscreen();
        }

        setRunning(true);
        setActiveTab('console');
        setConsoleOutput({ type: 'info', message: 'Running code against sample test cases...' });

        try {
            const result = await contestService.runContestCode(contestId, {
                problemId: selectedProblem._id,
                code: currentCode,
                language: currentLang
            });

            setConsoleOutput({
                type: 'run',
                data: result.results
            });
            toast.success('Run complete');
        } catch (error) {
            setConsoleOutput({
                type: 'error',
                message: error.message || 'Execution failed'
            });
            toast.error(error.message || 'Run failed');
        } finally {
            setRunning(false);
        }
    };

    const handleSubmit = async () => {
        if (contestSubmitted) {
            toast.error('Contest already submitted. Cannot submit code.');
            return;
        }

        if (lockedProblems.has(selectedProblem._id)) {
            toast.error('Problem already solved. Cannot submit again.');
            return;
        }

        if (!currentCode.trim()) {
            toast.error('Code cannot be empty');
            return;
        }

        const violationData = getViolationSummary();

        if (violationData.shouldAutoSubmit) {
            toast.error('Maximum violations exceeded. Triggering auto-submission.');
            handleMaxViolations();
            return;
        }

        setSubmitting(true);
        setActiveTab('console');
        setConsoleOutput({ type: 'info', message: 'Submitting solution...' });

        try {
            const result = await contestService.submitContestCode(contestId, {
                problemId: selectedProblem._id,
                code: currentCode,
                language: currentLang,
                tabSwitchCount: violations.tabSwitchCount,
                tabSwitchDuration: violations.tabSwitchDuration,
                pasteAttempts: violations.pasteAttempts,
                fullscreenExits: violations.fullscreenExits,
                isAutoSubmit: false
            });

            setConsoleOutput({
                type: 'submit',
                submission: result.submission,
                data: result.results
            });

            if (result.submission.verdict === 'Accepted') {
                toast.success('✅ Problem Solved! This problem is now locked.');
                setUserSubmissions(prev => ({ ...prev, [selectedProblem._id]: 'Accepted' }));
                setLockedProblems(prev => new Set([...prev, selectedProblem._id]));

                // Clear saved code for this problem
                const savedMap = JSON.parse(localStorage.getItem(`contest_${contestId}_codeMap`) || '{}');
                delete savedMap[selectedProblem._id];
                localStorage.setItem(`contest_${contestId}_codeMap`, JSON.stringify(savedMap));

                // Switch to next unlocked problem
                const nextProblem = contest.problems.find(p =>
                    p._id !== selectedProblem._id && !lockedProblems.has(p._id)
                );
                if (nextProblem) {
                    setTimeout(() => handleProblemChange(nextProblem), 1500);
                }
            } else {
                toast.error(`❌ ${result.submission.verdict}`);
            }

            // Refresh leaderboard
            setTimeout(async () => {
                try {
                    const leaderboardData = await contestService.getContestLeaderboard(contestId);
                    setLeaderboardData(leaderboardData.leaderboard || []);
                } catch (error) {
                    console.error('Failed to refresh leaderboard:', error);
                }
            }, 1000);

        } catch (error) {
            if (error.shouldAutoSubmit) {
                toast.error(error.message);
                handleMaxViolations();
            } else {
                setConsoleOutput({
                    type: 'error',
                    message: error.message || 'Submission failed'
                });
                toast.error(error.message || 'Submission failed');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleFinishContest = async (autoFinish = false) => {
        if (contestSubmitted) {
            toast('Contest already submitted');
            return;
        }

        if (!autoFinish) {
            const confirm = window.confirm(
                'Are you sure you want to finish the contest? You will not be able to make any more submissions.'
            );
            if (!confirm) return;
        }

        try {
            const result = await contestService.finishContest(contestId);

            toast.success(`Contest submitted! Score: ${result.finalScore}, Problems Solved: ${result.problemsSolved}`);

            setContestSubmitted(true);
            setContestActive(false);

            // Clear saved code
            localStorage.removeItem(`contest_${contestId}_codeMap`);

            setTimeout(() => {
                navigate('/student/contests');
            }, 3000);

        } catch (error) {
            toast.error(error.message || 'Failed to finish contest');
        }
    };

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getViolationColor = () => {
        const total = violations.tabSwitchCount + violations.pasteAttempts + violations.fullscreenExits;
        if (total >= 4) return 'text-red-600';
        if (total >= 2) return 'text-orange-600';
        return 'text-yellow-600';
    };

    if (!contest) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-900">
                <div className="text-center">
                    <div className="spinner border-white mb-4"></div>
                    <p className="text-white text-lg">Loading Contest...</p>
                </div>
            </div>
        );
    }

    const violationSummary = getViolationSummary();
    const totalViolations = violationSummary.totalViolations;
    const isProblemLocked = selectedProblem && lockedProblems.has(selectedProblem._id);

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Violation Modal */}
            {showViolationModal && (
                <div className="fixed top-4 right-4 z-50 bg-red-600 text-white px-6 py-4 rounded-lg shadow-2xl animate-shake">
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                            <h4 className="font-bold">{currentViolationType.type}</h4>
                            <p className="text-sm">{currentViolationType.message}</p>
                        </div>
                    </div>
                    <div className="mt-2 text-xs">
                        Total Violations: {totalViolations} / {contest.maxViolations || 5}
                    </div>
                </div>
            )}

            {/* Contest Submitted Overlay */}
            {contestSubmitted && (
                <div className="fixed inset-0 z-40 bg-black bg-opacity-70 flex items-center justify-center">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-md">
                        <div className="text-6xl mb-4">🎉</div>
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Contest Submitted!</h2>
                        <p className="text-gray-600 mb-6">
                            Your contest has been submitted successfully. Redirecting to contests page...
                        </p>
                        <div className="spinner mx-auto"></div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg px-6 py-4 flex justify-between items-center z-10">
                <div>
                    <h1 className="text-2xl font-bold flex items-center">
                        <span className="mr-3">🏆</span>
                        {contest.title}
                        {contestSubmitted && <span className="ml-3 text-sm bg-green-500 px-3 py-1 rounded-full">✓ Submitted</span>}
                    </h1>
                    <p className="text-sm text-blue-100 mt-1">
                        {selectedProblem ? `Problem: ${selectedProblem.title}` : 'Select a problem'}
                        {isProblemLocked && <span className="ml-2 text-yellow-300">🔒 Locked (Solved)</span>}
                    </p>
                </div>
                <div className="flex items-center space-x-6">
                    {/* Live Participants */}
                    <div className="bg-white bg-opacity-20 px-4 py-2 rounded-lg">
                        <p className="text-xs font-semibold uppercase tracking-wide">Live</p>
                        <p className="text-xl font-bold flex items-center">
                            <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></span>
                            {liveParticipants} online
                        </p>
                    </div>

                    {/* Timer */}
                    {!contestSubmitted && (
                        <div className="text-right">
                            <p className="text-xs font-semibold uppercase tracking-wide">Time Remaining</p>
                            <p className={`text-3xl font-mono font-bold ${timeRemaining < 300 ? 'animate-pulse text-red-300' : ''}`}>
                                {formatTime(timeRemaining)}
                            </p>
                        </div>
                    )}

                    {/* Violations */}
                    {totalViolations > 0 && !contestSubmitted && (
                        <div className={`bg-white bg-opacity-20 px-4 py-2 rounded-lg border-2 ${totalViolations >= 4 ? 'border-red-400 animate-pulse' : 'border-yellow-400'}`}>
                            <p className="text-xs font-semibold uppercase">Violations</p>
                            <p className={`text-2xl font-bold ${getViolationColor()}`}>
                                ⚠️ {totalViolations} / {contest.maxViolations || 5}
                            </p>
                        </div>
                    )}

                    {/* Finish Contest Button */}
                    {!contestSubmitted && contestActive && (
                        <button
                            onClick={() => handleFinishContest(false)}
                            className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-600 transition flex items-center space-x-2 shadow-lg"
                        >
                            <span>🏁</span>
                            <span>Finish Contest</span>
                        </button>
                    )}

                    {/* Leaderboard Button */}
                    <button
                        onClick={() => setShowLeaderboard(true)}
                        className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition flex items-center space-x-2 shadow-lg"
                    >
                        <span>📊</span>
                        <span>Leaderboard</span>
                    </button>

                    {/* Fullscreen Button */}
                    {!isFullscreen && contestActive && !contestSubmitted && (
                        <button
                            onClick={enterFullscreen}
                            className="bg-yellow-500 text-yellow-900 px-4 py-2 rounded-lg font-semibold hover:bg-yellow-400 transition flex items-center space-x-2 shadow-lg"
                        >
                            <span>⛶</span>
                            <span>Fullscreen</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Problem Navigation */}
            <div className="bg-white border-b px-6 py-3 flex space-x-2 overflow-x-auto shadow-sm">
                {contest.problems.map((problem, idx) => {
                    const status = userSubmissions[problem._id];
                    const isLocked = lockedProblems.has(problem._id);
                    return (
                        <button
                            key={problem._id}
                            onClick={() => handleProblemChange(problem)}
                            disabled={isLocked || contestSubmitted}
                            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${selectedProblem?._id === problem._id
                                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg scale-105'
                                : isLocked || contestSubmitted
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                } ${status === 'Accepted' ? 'ring-2 ring-green-500' : ''}`}
                        >
                            <span>{String.fromCharCode(65 + idx)}</span>
                            <span>{problem.title}</span>
                            {status === 'Accepted' && <span className="text-green-400 font-bold text-lg">✓</span>}
                            {isLocked && <span className="text-yellow-600">🔒</span>}
                        </button>
                    );
                })}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel */}
                <div className="w-5/12 border-r bg-white flex flex-col overflow-hidden shadow-lg">
                    {/* Tabs */}
                    <div className="flex border-b bg-gray-50">
                        <button
                            onClick={() => setActiveTab('description')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-all ${activeTab === 'description'
                                ? 'border-b-2 border-blue-500 text-blue-700 bg-white'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            📖 Description
                        </button>
                        <button
                            onClick={() => setActiveTab('console')}
                            className={`flex-1 py-3 text-sm font-semibold text-center transition-all ${activeTab === 'console'
                                ? 'border-b-2 border-blue-500 text-blue-700 bg-white'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            💻 Console {consoleOutput && <span className="ml-1 text-green-500">●</span>}
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                        {activeTab === 'description' ? (
                            selectedProblem ? (
                                <div className="prose max-w-none">
                                    <h2 className="text-3xl font-bold text-gray-900 mb-4">{selectedProblem.title}</h2>
                                    <div className="flex space-x-2 mb-6">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedProblem.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                                            selectedProblem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {selectedProblem.difficulty}
                                        </span>
                                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                                            {selectedProblem.points} Points
                                        </span>
                                        {isProblemLocked && (
                                            <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">
                                                🔒 Locked (Solved)
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-gray-800">
                                        <h3 className="text-xl font-semibold mb-3">Description</h3>
                                        <p className="mb-6 whitespace-pre-wrap leading-relaxed">{selectedProblem.description}</p>

                                        {selectedProblem.constraints && selectedProblem.constraints.length > 0 && (
                                            <>
                                                <h3 className="text-xl font-semibold mb-3">Constraints</h3>
                                                <ul className="list-disc pl-5 mb-6 space-y-2">
                                                    {selectedProblem.constraints.map((c, i) => (
                                                        <li key={i} className="text-gray-700">{c}</li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}

                                        {selectedProblem.examples && selectedProblem.examples.length > 0 && (
                                            <>
                                                <h3 className="text-xl font-semibold mb-3">Examples</h3>
                                                {selectedProblem.examples.map((ex, i) => (
                                                    <div key={i} className="bg-gray-50 p-4 rounded-lg mb-4 border-l-4 border-blue-500">
                                                        <p className="font-mono text-sm mb-2">
                                                            <span className="font-bold text-gray-700">Input:</span>
                                                            <span className="text-blue-600 ml-2">{ex.input}</span>
                                                        </p>
                                                        <p className="font-mono text-sm mb-2">
                                                            <span className="font-bold text-gray-700">Output:</span>
                                                            <span className="text-green-600 ml-2">{ex.output}</span>
                                                        </p>
                                                        {ex.explanation && (
                                                            <p className="text-sm text-gray-600 mt-2">
                                                                <span className="font-bold">Explanation:</span> {ex.explanation}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </>
                                        )}

                                        {/* Show Sample Test Cases */}
                                        {sampleTestCases.length > 0 && (
                                            <>
                                                <h3 className="text-xl font-semibold mb-3 mt-6">Sample Test Cases</h3>
                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                                    <p className="text-sm text-blue-800 mb-3">
                                                        These are the sample test cases that will be used when you click "Run Code":
                                                    </p>
                                                    {sampleTestCases.map((tc, i) => (
                                                        <div key={i} className="bg-white p-3 rounded mb-2 border">
                                                            <p className="font-mono text-xs mb-1">
                                                                <span className="font-bold text-gray-600">Input:</span>
                                                                <span className="text-blue-600 ml-2">{tc.input}</span>
                                                            </p>
                                                            <p className="font-mono text-xs">
                                                                <span className="font-bold text-gray-600">Expected Output:</span>
                                                                <span className="text-green-600 ml-2">{tc.output}</span>
                                                            </p>
                                                        </div>
                                                    ))}
                                                    <p className="text-xs text-blue-600 mt-2">
                                                        ℹ️ Additional hidden test cases will be used when you submit.
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex h-full items-center justify-center text-gray-400">
                                    <div className="text-center">
                                        <span className="text-6xl mb-4 block">📝</span>
                                        <p className="text-lg">Select a problem to start coding</p>
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="space-y-4">
                                {!consoleOutput ? (
                                    <div className="text-center text-gray-400 py-10">
                                        <span className="text-5xl block mb-4">💻</span>
                                        <p>Run or Submit your code to see results here</p>
                                    </div>
                                ) : consoleOutput.type === 'info' ? (
                                    <div className="flex items-center justify-center py-10 text-blue-600">
                                        <div className="spinner mr-3 border-blue-600"></div>
                                        <p className="text-lg font-medium">{consoleOutput.message}</p>
                                    </div>
                                ) : consoleOutput.type === 'error' ? (
                                    <div className="bg-red-50 p-6 rounded-lg border-l-4 border-red-500 shadow-sm">
                                        <h4 className="font-bold text-red-800 text-lg mb-3 flex items-center">
                                            <span className="mr-2">❌</span> Execution Error
                                        </h4>
                                        <pre className="whitespace-pre-wrap text-sm font-mono text-red-700 bg-red-100 p-4 rounded">
                                            {consoleOutput.message}
                                        </pre>
                                    </div>
                                ) : (
                                    <div>
                                        {consoleOutput.submission && (
                                            <div className={`mb-6 p-6 rounded-lg border-l-4 shadow-md ${consoleOutput.submission.verdict === 'Accepted'
                                                ? 'bg-green-50 border-green-500'
                                                : 'bg-red-50 border-red-500'
                                                }`}>
                                                <h3 className={`text-2xl font-bold flex items-center ${consoleOutput.submission.verdict === 'Accepted'
                                                    ? 'text-green-800'
                                                    : 'text-red-800'
                                                    }`}>
                                                    <span className="mr-2">
                                                        {consoleOutput.submission.verdict === 'Accepted' ? '✅' : '❌'}
                                                    </span>
                                                    {consoleOutput.submission.verdict}
                                                </h3>
                                                <p className="text-sm text-gray-700 mt-2">
                                                    Passed {consoleOutput.submission.testCasesPassed} of {consoleOutput.submission.totalTestCases} test cases
                                                </p>
                                                {consoleOutput.submission.isAutoSubmit && (
                                                    <p className="text-sm text-orange-700 mt-2 font-semibold">
                                                        ⚠️ Auto-submitted due to violations
                                                    </p>
                                                )}
                                                {consoleOutput.submission.problemLocked && (
                                                    <p className="text-sm text-green-700 mt-2 font-semibold">
                                                        🔒 Problem locked (already solved)
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        <h4 className="font-semibold text-gray-800 mb-4 text-lg">Test Case Results</h4>
                                        <div className="space-y-4">
                                            {consoleOutput.data?.map((result, idx) => (
                                                <div key={idx} className={`border rounded-lg overflow-hidden shadow-sm ${result.passed ? 'border-green-300' : 'border-red-300'
                                                    }`}>
                                                    <div className={`px-4 py-3 flex justify-between items-center ${result.passed ? 'bg-green-50' : 'bg-red-50'
                                                        }`}>
                                                        <span className={`font-semibold ${result.passed ? 'text-green-800' : 'text-red-800'
                                                            }`}>
                                                            Test Case {idx + 1}
                                                        </span>
                                                        <span className={`text-xs px-3 py-1 rounded-full font-bold ${result.passed
                                                            ? 'bg-green-200 text-green-800'
                                                            : 'bg-red-200 text-red-800'
                                                            }`}>
                                                            {result.passed ? '✓ Passed' : result.verdict || '✗ Failed'}
                                                        </span>
                                                    </div>

                                                    {!result.passed && !result.isHidden && (
                                                        <div className="p-4 bg-gray-50 text-sm font-mono space-y-3">
                                                            <div>
                                                                <span className="text-gray-500 text-xs uppercase tracking-wide font-bold">Input:</span>
                                                                <div className="bg-white p-3 rounded border mt-1 overflow-x-auto">
                                                                    {result.input}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 text-xs uppercase tracking-wide font-bold">Expected Output:</span>
                                                                <div className="bg-white p-3 rounded border mt-1 overflow-x-auto">
                                                                    {result.expectedOutput}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <span className="text-gray-500 text-xs uppercase tracking-wide font-bold">Your Output:</span>
                                                                <div className="bg-white p-3 rounded border border-red-300 mt-1 overflow-x-auto">
                                                                    {result.actualOutput}
                                                                </div>
                                                            </div>
                                                            {result.error && (
                                                                <div className="text-red-600 bg-red-50 p-3 rounded">
                                                                    <span className="font-bold">Error:</span> {result.error}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {result.isHidden && (
                                                        <div className="p-4 bg-gray-50 text-sm text-gray-500 italic text-center">
                                                            🔒 Hidden Test Case
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Code Editor */}
                <div className="w-7/12 flex flex-col bg-gray-900">
                    <div className="bg-gray-800 px-4 py-3 flex justify-between items-center shadow-lg">
                        <select
                            value={currentLang}
                            onChange={(e) => setCurrentLang(e.target.value)}
                            disabled={isProblemLocked || contestSubmitted}
                            className="bg-gray-700 text-white border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {LANGUAGE_OPTIONS.map((lang) => (
                                <option key={lang.value} value={lang.value}>
                                    {lang.label}
                                </option>
                            ))}
                        </select>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={handleRun}
                                disabled={running || !contestActive || isProblemLocked || contestSubmitted}
                                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${running || !contestActive || isProblemLocked || contestSubmitted
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                                    }`}
                            >
                                {running ? (
                                    <span className="flex items-center">
                                        <div className="spinner border-white mr-2"></div> Running...
                                    </span>
                                ) : (
                                    <span>▶ Run Code</span>
                                )}
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={
                                    submitting ||
                                    !contestActive ||
                                    isProblemLocked ||
                                    contestSubmitted ||
                                    violationSummary.shouldAutoSubmit
                                }
                                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${submitting || !contestActive || isProblemLocked || contestSubmitted || violationSummary.shouldAutoSubmit
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700 shadow-lg hover:shadow-xl'
                                    }`}
                            >
                                {isProblemLocked ? (
                                    <span>🔒 Locked</span>
                                ) : contestSubmitted ? (
                                    <span>Contest Submitted</span>
                                ) : submitting ? (
                                    <span className="flex items-center">
                                        <div className="spinner border-white mr-2"></div> Submitting...
                                    </span>
                                ) : (
                                    <span>✓ Submit Solution</span>
                                )}
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <Editor
                            height="100%"
                            language={LANGUAGE_OPTIONS.find(l => l.value === currentLang)?.monacoLang || 'cpp'}
                            value={currentCode}
                            onChange={(value) => !isProblemLocked && !contestSubmitted && setCurrentCode(value || '')}
                            theme="vs-dark"
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                tabSize: 4,
                                wordWrap: 'on',
                                readOnly: isProblemLocked || contestSubmitted
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Leaderboard Modal */}
            {showLeaderboard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden border-4 border-blue-500">
                        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 flex justify-between items-center">
                            <div>
                                <h2 className="text-3xl font-bold flex items-center">
                                    <span className="mr-3">🏆</span>
                                    Live Leaderboard
                                </h2>
                                <p className="text-sm text-blue-100 mt-1">{contest.title}</p>
                            </div>
                            <button
                                onClick={() => setShowLeaderboard(false)}
                                className="bg-white bg-opacity-20 hover:bg-opacity-30 p-3 rounded-full transition"
                            >
                                <span className="text-2xl">✕</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto scrollbar-thin">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 font-semibold text-gray-700">Rank</th>
                                        <th className="p-4 font-semibold text-gray-700">Roll Number</th>
                                        <th className="p-4 font-semibold text-gray-700">Username</th>
                                        <th className="p-4 font-semibold text-gray-700">Score</th>
                                        <th className="p-4 font-semibold text-gray-700">Time (min)</th>
                                        <th className="p-4 font-semibold text-gray-700">Solved</th>
                                        {contest.problems?.map((_, idx) => (
                                            <th key={idx} className="p-4 font-semibold text-gray-700 text-center">
                                                {String.fromCharCode(65 + idx)}
                                            </th>
                                        ))}
                                        <th className="p-4 font-semibold text-gray-700">Violations</th>
                                        <th className="p-4 font-semibold text-gray-700">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-gray-100">
                                    {leaderboardData.length === 0 ? (
                                        <tr>
                                            <td colSpan={7 + (contest?.problems?.length || 0)} className="text-center p-12 text-gray-400">
                                                <span className="text-5xl block mb-4">📊</span>
                                                <p className="text-lg">No submissions yet. Be the first!</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        leaderboardData.map((entry, index) => (
                                            <tr
                                                key={entry.studentId}
                                                className={`hover:bg-blue-50 transition ${entry.studentId.toString() === user?.id ? 'bg-yellow-50 font-semibold' : ''
                                                    } ${index < 3 ? 'bg-gradient-to-r from-yellow-50 to-transparent' : ''}`}
                                            >
                                                <td className="p-4">
                                                    {index === 0 && <span className="text-2xl">🥇</span>}
                                                    {index === 1 && <span className="text-2xl">🥈</span>}
                                                    {index === 2 && <span className="text-2xl">🥉</span>}
                                                    {index > 2 && <span className="text-gray-600">#{entry.rank}</span>}
                                                </td>
                                                <td className="p-4 font-mono">{entry.rollNumber}</td>
                                                <td className="p-4">
                                                    {entry.username}
                                                    {entry.studentId.toString() === user?.id && (
                                                        <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded-full">You</span>
                                                    )}
                                                </td>
                                                <td className="p-4 font-bold text-blue-600">{entry.score}</td>
                                                <td className="p-4 text-gray-600">{entry.time}</td>
                                                <td className="p-4">
                                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
                                                        {entry.problemsSolved}
                                                    </span>
                                                </td>
                                                {contest.problems?.map((problem) => {
                                                    const detail = entry.problemDetails[problem._id];
                                                    return (
                                                        <td key={problem._id} className="p-4 text-center">
                                                            {detail?.solved ? (
                                                                <div className="text-green-600 font-bold">
                                                                    ✓
                                                                    <div className="text-xs text-gray-500">{detail.time}m</div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-300">−</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="p-4">
                                                    <span className={`text-xs px-2 py-1 rounded-full ${entry.tabSwitchCount + entry.pasteAttempts + entry.fullscreenExits >= 4
                                                        ? 'bg-red-100 text-red-700'
                                                        : entry.tabSwitchCount + entry.pasteAttempts + entry.fullscreenExits >= 2
                                                            ? 'bg-orange-100 text-orange-700'
                                                            : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        {entry.tabSwitchCount + entry.pasteAttempts + entry.fullscreenExits}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    {entry.isCompleted ? (
                                                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                                                            ✓ Submitted
                                                        </span>
                                                    ) : (
                                                        <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold">
                                                            ⏳ In Progress
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                            <div className="text-sm text-gray-600">
                                <span className="font-semibold">{leaderboardData.length}</span> participants •
                                <span className="ml-2 text-green-600">● Live Updates</span>
                            </div>
                            <div className="text-xs text-gray-500">
                                Refreshes every 10 seconds
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContestInterface;
