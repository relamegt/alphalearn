import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import contestService from '../../services/contestService';
import useProctoring from '../../hooks/useProctoring';
import { initSecurityFeatures } from '../../utils/disableInspect';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import Cookies from 'js-cookie';
import {
    Play,
    CheckCircle,
    AlertTriangle,
    ChevronDown,
    Maximize2,
    Minimize2,
    Loader2,
    Code2,
    FileText,
    List,
    Terminal,
    Coins,
    Lock,
    XCircle,
    Clock,
    Layout,
    LogOut,
    Menu,
    PanelLeftClose,
    PanelLeft,
    BookOpen,
    ChevronRight,
    ChevronLeft
} from 'lucide-react';

/* ─── Helpers ─── */
const DragHandleH = ({ onMouseDown }) => (
    <div onMouseDown={onMouseDown} className="w-1.5 bg-gray-50 hover:bg-blue-100 border-l border-r border-gray-100 cursor-col-resize shrink-0 transition-colors z-10 relative group flex flex-col justify-center items-center">
        <div className="h-4 w-0.5 bg-gray-300 rounded-full group-hover:bg-blue-400" />
    </div>
);

const DragHandleV = ({ onMouseDown }) => (
    <div onMouseDown={onMouseDown} className="h-1.5 bg-gray-50 hover:bg-blue-100 border-t border-b border-gray-100 cursor-row-resize shrink-0 transition-colors z-10 relative flex justify-center items-center group">
        <div className="w-4 h-0.5 bg-gray-300 rounded-full group-hover:bg-blue-400" />
    </div>
);

const DiffBadge = ({ d }) => {
    const styles = {
        Easy: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
        Medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
        Hard: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
    };
    const s = styles[d] || styles.Medium;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${s.bg} ${s.text} ${s.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {d}
        </span>
    );
};

// ─── Verdict color helper ───
const getVerdictColor = (verdict) => {
    switch (verdict) {
        case 'Accepted': return { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' };
        case 'Wrong Answer': return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' };
        case 'Compilation Error': return { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' };
        case 'Runtime Error': return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' };
        case 'TLE': return { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-100' };
        default: return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' };
    }
};

const ExecutionProgress = ({ isRunning, isSubmitting, total }) => {
    const [count, setCount] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (isRunning || isSubmitting) {
            setCount(0);
            const step = Math.max(1, Math.floor(total / 15));
            intervalRef.current = setInterval(() => {
                setCount(prev => {
                    const next = prev + step;
                    return next >= total - 1 ? total - 1 : next;
                });
            }, 400);
        } else {
            clearInterval(intervalRef.current);
            setCount(0);
        }
        return () => clearInterval(intervalRef.current);
    }, [isRunning, isSubmitting, total]);

    if (!isRunning && !isSubmitting) return null;

    const progress = total > 0 ? Math.round((count / total) * 100) : 0;
    const label = isSubmitting ? 'Submitting' : 'Running';

    return (
        <div className="flex flex-col h-full items-center justify-center gap-4 px-8">
            <div className="text-center">
                <p className="text-sm font-semibold text-gray-700 mb-1">
                    {label} test cases...
                </p>
                <p className="text-2xl font-bold text-blue-600">
                    {count} <span className="text-gray-400 text-lg font-normal">/ {total}</span>
                </p>
            </div>
            <div className="w-full max-w-xs bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                    className="h-2 bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <p className="text-xs text-gray-400 mt-2">
                <Loader2 size={12} className="inline animate-spin mr-1" />
                {label} code against test cases
            </p>
        </div>
    );
};

const LANGUAGE_OPTIONS = [
    { value: 'cpp', label: 'C++', monacoLang: 'cpp' },
    { value: 'java', label: 'Java', monacoLang: 'java' },
    { value: 'python', label: 'Python 3', monacoLang: 'python' },
    { value: 'javascript', label: 'JavaScript', monacoLang: 'javascript' },
    { value: 'c', label: 'C', monacoLang: 'c' }
];

const DEFAULT_CODE = {
    c: '#include <stdio.h>\n\nint main() {\n    // your code\n    return 0;\n}',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // your code\n    return 0;\n}',
    java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // your code\n    }\n}',
    python: 'def main():\n    # your code\n    pass\n\nif __name__ == "__main__":\n    main()',
    javascript: 'function main() {\n    // your code\n}\n\nmain();',
};

/* ─── Main Component ─── */
const ContestInterface = ({ isPractice = false }) => {
    const { contestId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Data State
    const [contest, setContest] = useState(null);
    const [selectedProblem, setSelectedProblem] = useState(null);
    const [userCodeMap, setUserCodeMap] = useState({});
    const [userSubmissions, setUserSubmissions] = useState({});
    const [lockedProblems, setLockedProblems] = useState(new Set());

    // Contest Status
    const [contestSubmitted, setContestSubmitted] = useState(false);
    const [contestActive, setContestActive] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [liveParticipants, setLiveParticipants] = useState(0);

    // Execution State
    const [submitting, setSubmitting] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [running, setRunning] = useState(false);
    const [consoleOutput, setConsoleOutput] = useState(null);
    const [currentCode, setCurrentCode] = useState('');
    const [currentLang, setCurrentLang] = useState('cpp');
    const [sampleTestCases, setSampleTestCases] = useState([]);

    // UI State
    const [descW, setDescW] = useState(35);
    const [editorTopH, setEditorTopH] = useState(60);
    const [bottomTab, setBottomTab] = useState('testcases');
    const [activeResultCase, setActiveResultCase] = useState(0);
    const [activeInputCase, setActiveInputCase] = useState(0);
    // Custom input removed for contest mode
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resultsAnimKey, setResultsAnimKey] = useState(0);
    const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false);
    const [showEditorial, setShowEditorial] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });

    const wsRef = useRef(null);
    const autoSubmitTriggered = useRef(false);
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const containerRef = useRef(null);
    const dragging = useRef(null);

    // Proctoring Hook - Disable in Practice Mode
    const handleMaxViolations = useCallback(async () => {
        if (isPractice || autoSubmitTriggered.current || !selectedProblem || contestSubmitted) return;
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
            await handleFinishContest(true);
        } catch (error) {
            toast.error('Auto-submission failed');
        }
    }, [contestId, selectedProblem, currentCode, currentLang, contestSubmitted, isPractice]);

    const { violations, isFullscreen, enterFullscreen, getViolationSummary } =
        useProctoring(contestId, user?.userId, (contestActive && !contestSubmitted && !isPractice), handleMaxViolations);

    // Auto Fullscreen on mount if contest is active and NOT practice
    useEffect(() => {
        if (!isPractice && contestActive && !contestSubmitted && !hasEnteredFullscreen && contest?.proctoringEnabled) {
            enterFullscreen();
            setHasEnteredFullscreen(true);
        }
    }, [contestActive, contestSubmitted, hasEnteredFullscreen, enterFullscreen, contest, isPractice]);

    /* ─── WebSocket ─── */
    const handleContestEnd = useCallback(() => {
        setContestActive(false);
        toast.success('Contest has ended!');
        setTimeout(() => navigate(`/student/contests`), 2000);
    }, [navigate]);

    const handleWebSocketMessage = useCallback((data) => {
        switch (data.type) {
            case 'leaderboardUpdate': setLeaderboardData(data.leaderboard || []); break;
            case 'participantCount': setLiveParticipants(data.count); break;
            case 'newSubmission': break; // Optional: toast notification
            case 'violation': toast.error(`Violation detected: ${data.violation?.type}`); break;
            case 'contestEnded': handleContestEnd(); break;
        }
    }, [handleContestEnd]);

    useEffect(() => {
        if (isPractice || !contestActive || !contest || contestSubmitted) return;
        let token = Cookies.get('accessToken') || localStorage.getItem('accessToken');
        if (!token) return;
        token = token.replace('Bearer ', '').trim();
        const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:5000'}/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => ws.send(JSON.stringify({ type: 'join', contestId, token }));
        ws.onmessage = (event) => {
            try { handleWebSocketMessage(JSON.parse(event.data)); } catch (e) { console.error(e); }
        };
        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                try { ws.send(JSON.stringify({ type: 'leave', contestId })); } catch (e) { }
                ws.close();
            }
        };
    }, [contestActive, contest, contestId, contestSubmitted, handleWebSocketMessage, isPractice]);

    /* ─── Data Fetching ─── */
    const fetchContest = async () => {
        try {
            const [contestData, submissionsData] = await Promise.all([
                contestService.getContestById(contestId),
                contestService.getStudentContestSubmissions(contestId).catch(() => ({ submissions: [] }))
            ]);
            setContest(contestData.contest);
            setContestSubmitted(isPractice ? false : (contestData.contest.isSubmitted || false));

            const locked = new Set();
            if (!isPractice) {
                contestData.contest.problems?.forEach(p => { if (p.isLocked || p.isSolved) locked.add(p._id); });
            }
            setLockedProblems(locked);

            const subMap = {};
            submissionsData.submissions?.forEach(sub => {
                const pid = sub.problemId._id || sub.problemId; // Handle populate
                if (sub.verdict === 'Accepted') subMap[pid] = 'Accepted';
                else if (!subMap[pid]) subMap[pid] = sub.verdict;
            });
            setUserSubmissions(subMap);

            const now = new Date();
            const start = new Date(contestData.contest.startTime);
            const end = new Date(contestData.contest.endTime);

            if (isPractice) {
                // In practice mode, we ignore submission status and end time checks
                setContestActive(true);
            } else {
                if (contestData.contest.isSubmitted) return setTimeout(() => navigate('/student/contests'), 2000);
                if (now >= start && now <= end) setContestActive(true);
                else if (now > end) { toast.error('Contest has ended'); navigate('/student/contests'); }
            }

            // Initial Problem Selection
            if (contestData.contest.problems?.length > 0) {
                // Try to restore last visited problem or first unlocked
                const savedPid = localStorage.getItem(`contest_${contestId}_lastProblem`);
                const initialProblem = contestData.contest.problems.find(p => p._id === savedPid)
                    || contestData.contest.problems.find(p => !locked.has(p._id))
                    || contestData.contest.problems[0];
                handleProblemChange(initialProblem, true);
            }
        } catch (error) { console.error(error); toast.error('Failed to load contest'); }
    };

    useEffect(() => {
        const savedMap = localStorage.getItem(`contest_${contestId}_codeMap`);
        if (savedMap) setUserCodeMap(JSON.parse(savedMap));
        fetchContest();
        initSecurityFeatures();

        // Leaderboard poller (if open)
        let lbInterval;
        if (showLeaderboard) {
            const fetchLb = async () => {
                const d = await contestService.getContestLeaderboard(contestId);
                setLeaderboardData(d.leaderboard || []);
            };
            fetchLb();
            // Stop refreshing if contest is ended
            const isEnded = contest && new Date() > new Date(contest.endTime);
            if (!isEnded) {
                lbInterval = setInterval(fetchLb, 10000);
            }
        }
        return () => clearInterval(lbInterval);
    }, [contestId, showLeaderboard]);

    useEffect(() => {
        if (contest && contestActive && !contestSubmitted && !isPractice) {
            const interval = setInterval(() => {
                const now = new Date();
                const end = new Date(contest.endTime);
                const remaining = Math.max(0, Math.floor((end - now) / 1000));
                setTimeRemaining(remaining);
                if (remaining === 0) handleContestEnd();
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [contest, contestActive, contestSubmitted, isPractice]);

    /* ─── Handlers ─── */
    const handleProblemChange = (problem, isInit = false) => {
        if (!isInit && !isPractice && contestSubmitted) return toast.error('Contest submitted');

        // Save current problem state if exists
        if (selectedProblem && !lockedProblems.has(selectedProblem._id)) {
            const updated = { ...userCodeMap, [selectedProblem._id]: { code: currentCode, lang: currentLang } };
            setUserCodeMap(updated);
            localStorage.setItem(`contest_${contestId}_codeMap`, JSON.stringify(updated));
        }

        // Load new problem state
        const savedMap = JSON.parse(localStorage.getItem(`contest_${contestId}_codeMap`) || '{}');
        const saved = savedMap[problem._id] || { code: DEFAULT_CODE['cpp'], lang: 'cpp' };

        setCurrentCode(saved.code);
        setCurrentLang(saved.lang);
        setSelectedProblem(problem);
        setSampleTestCases(problem.testCases?.filter(tc => !tc.isHidden) || []);
        setConsoleOutput(null);
        setBottomTab('testcases');
        setActiveInputCase(0);
        setActiveResultCase(0);
        setShowEditorial(false);

        localStorage.setItem(`contest_${contestId}_lastProblem`, problem._id);
    };

    const handleLangChange = (e) => {
        if ((isProblemLocked || contestSubmitted) && !isPractice) return;
        const l = e.target.value;
        const oldLang = currentLang;
        setCurrentLang(l);
        // Only reset code if it's empty or the default template of previous language
        if (!currentCode.trim() || currentCode === DEFAULT_CODE[oldLang] || currentCode === '// Write your code here') {
            setCurrentCode(DEFAULT_CODE[l]);
        }
    };

    const handleRun = async () => {
        if ((contestSubmitted || isProblemLocked) && !isPractice) return;
        if (!currentCode.trim()) return toast.error('Code cannot be empty');
        if (!isPractice && !document.fullscreenElement && contest?.proctoringEnabled) enterFullscreen();

        setRunning(true);
        setBottomTab('results');
        setEditorTopH(40); // Auto expand results slightly
        setResultsAnimKey(k => k + 1);
        setActiveResultCase(0);

        try {
            const result = await contestService.runContestCode(contestId, {
                problemId: selectedProblem._id,
                code: currentCode,
                language: currentLang,
                isPractice
            });
            if (result.type === 'error') {
                setConsoleOutput({ type: 'error', message: result.message });
            } else {
                setConsoleOutput({ type: 'run', data: result.results });
            }
        } catch (error) {
            setConsoleOutput({ type: 'error', message: error.message || 'Execution failed' });
        } finally { setRunning(false); }
    };

    const handleSubmit = async () => {
        if ((contestSubmitted || isProblemLocked) && !isPractice) return;
        if (!currentCode.trim()) return toast.error('Code cannot be empty');

        const violationData = getViolationSummary();
        if (violationData.shouldAutoSubmit) return handleMaxViolations();

        setSubmitting(true);
        setBottomTab('results');
        setEditorTopH(40);
        setResultsAnimKey(k => k + 1);
        setActiveResultCase(0);

        try {
            const result = await contestService.submitContestCode(contestId, {
                problemId: selectedProblem._id,
                code: currentCode,
                language: currentLang,
                ...violationData,
                isAutoSubmit: false,
                isPractice // Pass practice flag
            });

            if (isPractice) {
                // For practice verify, we treat it like a run result but for all cases
                setConsoleOutput({ type: 'run', data: result.results });
                if (result.submission.verdict === 'Accepted') {
                    toast.success('Practice: All Test Cases Passed!', { duration: 3000 });
                } else {
                    toast.error(`Practice: ${result.submission.verdict}`, { duration: 3000 });
                }
            } else {
                setConsoleOutput({ type: 'submit', submission: result.submission, data: result.results });
            }

            if (result.submission.verdict === 'Accepted') {
                if (!isPractice) {
                    toast.success('Problem Solved!');
                    setUserSubmissions(prev => ({ ...prev, [selectedProblem._id]: 'Accepted' }));
                    setLockedProblems(prev => new Set([...prev, selectedProblem._id]));
                }
                // Clear saved draft for this problem
                const savedMap = JSON.parse(localStorage.getItem(`contest_${contestId}_codeMap`) || '{}');
                delete savedMap[selectedProblem._id];
                localStorage.setItem(`contest_${contestId}_codeMap`, JSON.stringify(savedMap));

                // Auto-advance to next problem if not practice
                if (!isPractice) {
                    const currentIndex = contest.problems.findIndex(p => p._id === selectedProblem._id);
                    if (currentIndex !== -1 && currentIndex < contest.problems.length - 1) {
                        const nextProblem = contest.problems[currentIndex + 1];
                        setTimeout(() => {
                            toast('Moving to next problem...', { icon: '➡️' });
                            handleProblemChange(nextProblem);
                        }, 1500);
                    }
                }
            } else {
                toast.error(result.submission.verdict);
            }
            // Update leaderboard data immediately
            // Update leaderboard data immediately ONLY if NOT practice
            if (!isPractice) {
                const lb = await contestService.getContestLeaderboard(contestId);
                setLeaderboardData(lb.leaderboard || []);
            }
        } catch (error) {
            if (error.shouldAutoSubmit) handleMaxViolations();
            else {
                setConsoleOutput({ type: 'error', message: error.message || 'Submission failed' });
                toast.error(error.message);
            }
        } finally { setSubmitting(false); }
    };

    const handleFinishContest = async (autoFinish = false) => {
        if (contestSubmitted) return;
        if (!autoFinish && !window.confirm('Are you sure you want to finish the contest?')) return;

        setFinishing(true);
        try {
            const result = await contestService.finishContest(contestId);
            toast.success(`Contest submitted! Final Score: ${result.finalScore}`);
            setContestSubmitted(true);
            setContestActive(false);
            localStorage.removeItem(`contest_${contestId}_codeMap`);
            setTimeout(() => navigate('/student/contests'), 2000);
        } catch (error) {
            toast.error(error.message);
            setFinishing(false);
        }
    };



    /* ─── Sorting & CSV ─── */
    const handleSort = (key) => {
        let direction = 'desc'; // Default desc for score/solved
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        } else if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedLeaderboardData = (() => {
        if (!leaderboardData) return [];
        let data = [...leaderboardData];
        if (sortConfig.key) {
            data.sort((a, b) => {
                let aValue = sortConfig.key === 'status' ? (a.isCompleted ? 1 : 0) : a[sortConfig.key];
                let bValue = sortConfig.key === 'status' ? (b.isCompleted ? 1 : 0) : b[sortConfig.key];

                if (sortConfig.key === 'score' || sortConfig.key === 'problemsSolved') {
                    aValue = parseFloat(aValue);
                    bValue = parseFloat(bValue);
                }

                // String sorting for username/time if needed (time is string "XXm")
                if (sortConfig.key === 'time') {
                    aValue = parseInt(aValue.replace('m', ''));
                    bValue = parseInt(bValue.replace('m', ''));
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    })();

    const downloadCSV = () => {
        if (!sortedLeaderboardData.length) return;

        // Dynamic headers for problems
        const problemHeaders = contest?.problems?.map((p, i) => `P${i + 1} (${p.title})`) || [];
        const headers = ['Rank', 'Student', ...problemHeaders, 'Solved', 'Time', 'Status', 'Score'];

        const rows = sortedLeaderboardData.map((entry, index) => {
            // Problem statuses
            const problemStatuses = contest?.problems?.map(p => {
                const pStatus = entry.problems?.[p._id]?.status;
                return pStatus || 'Not Attempted';
            }) || [];

            // Fix for "1/2" turning into date: wrap in ="..." formula for Excel or prepend '
            const solvedCount = `${entry.problemsSolved}/${contest?.problems?.length || 0}`;
            const solvedCell = `="${solvedCount}"`;

            return [
                index + 1,
                entry.username,
                ...problemStatuses,
                solvedCell,
                entry.time,
                entry.isCompleted ? 'Finished' : 'In Progress',
                entry.score
            ];
        });

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${contest.title}_leaderboard.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    /* ─── Drag Logic ─── */
    const startDrag = (type, e) => {
        e.preventDefault();
        setIsResizing(true);
        dragging.current = { type, startX: e.clientX, startY: e.clientY, startVal: type === 'desc' ? descW : editorTopH };
        document.body.style.cursor = type === 'editorH' ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = useCallback((e) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (dragging.current.type === 'desc') {
            setDescW(Math.min(60, Math.max(20, dragging.current.startVal + (e.clientX - dragging.current.startX) / rect.width * 100)));
        } else {
            setEditorTopH(Math.min(85, Math.max(15, dragging.current.startVal + (e.clientY - dragging.current.startY) / rect.height * 100)));
        }
    }, []);

    const onMouseUp = useCallback(() => {
        dragging.current = null;
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    }, [onMouseMove]);

    const formatTime = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    // Render Helpers
    if (!contest) return (
        <div className="flex flex-col h-screen items-center justify-center bg-gray-50 text-gray-600 gap-3">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <p className="font-medium animate-pulse">Loading Contest Environment...</p>
        </div>
    );

    const isProblemLocked = selectedProblem && lockedProblems.has(selectedProblem._id);
    const violationSummary = getViolationSummary();

    // Result Logic
    const isCompileErr = consoleOutput?.type === 'error';
    const displayResult = consoleOutput?.type === 'run'
        ? { verdict: consoleOutput.data?.every(r => r.passed) ? 'Accepted' : 'Wrong Answer', results: consoleOutput.data, isRun: true }
        : consoleOutput?.type === 'submit'
            ? { verdict: consoleOutput.submission.verdict, results: consoleOutput.data, isSubmitMode: true }
            : null;

    const runAllPassed = displayResult?.isRun && displayResult?.results?.every(r => r.passed);
    const showGreenVerdict = displayResult?.verdict === 'Accepted' || runAllPassed;

    return (
        <div className="flex flex-col h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden" ref={containerRef}>
            {/* ─── Minimal Header ─── */}
            <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-20 shrink-0 shadow-sm relative">
                <div className="flex items-center gap-4 min-w-0">

                    <div className="flex flex-col min-w-0">
                        <h1 className="text-sm font-bold text-gray-900 truncate flex items-center gap-2">
                            {contest.title}
                            {contestSubmitted && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full border border-green-200 uppercase tracking-wide">Submitted</span>}
                        </h1>
                    </div>
                </div>

                {/* Center Timer - Hide in Practice */}
                {(!contestSubmitted && !isPractice) && (
                    <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-1.5 rounded-full border ${timeRemaining < 300 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                        <Clock size={14} />
                        <span className="font-mono font-bold text-sm tracking-widest">{formatTime(timeRemaining)}</span>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    {!isPractice && (
                        <div className="flex items-center gap-3 text-xs text-gray-500 border-r border-gray-200 pr-4 mr-1">
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {liveParticipants} Live</span>
                            {violationSummary.totalViolations > 0 && (
                                <span className="flex items-center gap-1 text-amber-600 font-medium">
                                    <AlertTriangle size={10} /> {violationSummary.totalViolations} Violations
                                </span>
                            )}
                        </div>
                    )}

                    {!isPractice && (
                        <button onClick={() => setShowLeaderboard(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                            <Layout size={14} /> Leaderboard
                        </button>
                    )}
                    {(!contestSubmitted && !isPractice) && (
                        <button
                            onClick={() => handleFinishContest(false)}
                            disabled={finishing}
                            className="flex items-center gap-2 px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all text-xs font-bold shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {finishing ? <Loader2 size={13} className="animate-spin" /> : 'Finish Contest'}
                        </button>
                    )}
                    {isPractice && (
                        <div className="flex items-center gap-3">
                            <span className="bg-indigo-50 text-indigo-600 text-[10px] px-2.5 py-1 rounded-full font-bold border border-indigo-100 uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                Practice Mode
                            </span>
                            <button
                                onClick={() => navigate('/student/contests')}
                                className="group flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg transition-all duration-200 text-xs font-bold shadow-sm"
                            >
                                <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                                Exit Practice
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* ─── Sidebar & Workspace ─── */}
            <div className="flex-1 flex overflow-hidden">
                {/* Collapsible Sidebar */}
                {showSidebar && (
                    <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 animate-in slide-in-from-left-5 duration-300">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Problems</h2>
                            <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                                {contest.problems.length}
                            </span>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {contest.problems.map((p, i) => {
                                const status = userSubmissions[p._id];
                                const isActive = selectedProblem?._id === p._id;
                                const isLocked = lockedProblems.has(p._id);

                                return (
                                    <button
                                        key={p._id}
                                        onClick={() => handleProblemChange(p)}
                                        disabled={(contestSubmitted && !isActive && !isPractice) || (status === 'Accepted' && !isActive && !isPractice)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2
                                            ${isActive ? 'bg-blue-50 border-blue-500' : 'border-transparent hover:bg-gray-50'}
                                        `}
                                    >
                                        <div className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-xs font-bold ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {String.fromCharCode(65 + i)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                                                {p.title}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className={`text-[10px] font-bold ${p.difficulty === 'Easy' ? 'text-emerald-600' :
                                                    p.difficulty === 'Medium' ? 'text-amber-600' : 'text-rose-600'
                                                    }`}>
                                                    {p.difficulty}
                                                </span>
                                                <span className="text-[10px] text-gray-400">•</span>
                                                <span className="text-[10px] text-gray-400">{p.points} pts</span>
                                            </div>
                                        </div>

                                        {/* Status icons removed as requested */}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
                {/* Workspace Wrapper */}
                <div className="flex-1 flex overflow-hidden relative min-w-0">
                    {/* Description Panel */}
                    <div style={{ width: `${descW}%` }} className="flex flex-col bg-white border-r border-gray-200 shrink-0 transition-all duration-200 ease-linear relative">
                        {/* Toggle Sidebar Button */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">
                            <button
                                onClick={() => setShowSidebar(!showSidebar)}
                                className="w-5 h-10 bg-white border border-l-0 border-gray-200 rounded-r-md shadow-sm flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                                title={showSidebar ? "Close Sidebar" : "Open Sidebar"}
                            >
                                {showSidebar ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                            </button>
                        </div>

                        <div className="flex items-center h-12 border-b border-gray-200 bg-white shrink-0 pl-0 pr-4 overflow-x-auto no-scrollbar">
                            <div className="flex items-center gap-1 h-full">
                                <button
                                    onClick={() => setShowEditorial(false)}
                                    className={`h-full flex items-center gap-2 px-4 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${!showEditorial ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                                >
                                    <FileText size={14} /> Description
                                </button>
                                {isPractice && selectedProblem?.editorial && (
                                    <button
                                        onClick={() => setShowEditorial(true)}
                                        className={`h-full flex items-center gap-2 px-4 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${showEditorial ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        <BookOpen size={14} /> Editorial
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                            {selectedProblem ? (
                                showEditorial ? (
                                    <div className="prose prose-sm max-w-none">
                                        <h2 className="text-xl font-bold text-gray-900 mb-6">{selectedProblem.title} - Editorial</h2>

                                        {selectedProblem.editorial.approach && (
                                            <div className="mb-8">
                                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                    <span className="w-1.5 h-6 bg-blue-500 rounded-full" />
                                                    Approach
                                                </h3>
                                                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: selectedProblem.editorial.approach }} />
                                            </div>
                                        )}

                                        {selectedProblem.editorial.complexity && (
                                            <div className="mb-8">
                                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                    <span className="w-1.5 h-6 bg-purple-500 rounded-full" />
                                                    Complexity
                                                </h3>
                                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
                                                    <div dangerouslySetInnerHTML={{ __html: selectedProblem.editorial.complexity }} />
                                                </div>
                                            </div>
                                        )}

                                        {selectedProblem.editorial.solution && (
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                    <span className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                                                    Solution
                                                </h3>
                                                <div className="relative group">
                                                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(selectedProblem.editorial.solution);
                                                                toast.success('Solution copied!');
                                                            }}
                                                            className="p-1.5 bg-white shadow-sm border border-gray-200 rounded-md text-gray-500 hover:text-blue-600"
                                                            title="Copy Code"
                                                        >
                                                            <Code2 size={14} />
                                                        </button>
                                                    </div>
                                                    <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 overflow-x-auto text-xs font-mono border border-gray-800">
                                                        <code>{selectedProblem.editorial.solution}</code>
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="prose prose-sm max-w-none">
                                        <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedProblem.title}</h2>
                                        <div className="flex flex-wrap gap-2 mb-6">
                                            <DiffBadge d={selectedProblem.difficulty} />
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold">
                                                <Coins size={10} /> {selectedProblem.points} pts
                                            </span>
                                        </div>
                                        <div dangerouslySetInnerHTML={{ __html: selectedProblem.description }} />

                                        {selectedProblem.examples?.map((ex, i) => (
                                            <div key={i} className="mt-6">
                                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">Example {i + 1}</h3>
                                                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                                    <div className="p-3 border-b border-gray-200/50 flex flex-col gap-1">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Input</span>
                                                        <code className="text-xs font-mono text-gray-800 bg-white px-2 py-1 rounded border border-gray-100">{ex.input}</code>
                                                    </div>
                                                    <div className="p-3 flex flex-col gap-1">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Output</span>
                                                        <code className="text-xs font-mono text-gray-800 bg-white px-2 py-1 rounded border border-gray-100">{ex.output}</code>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {selectedProblem.constraints?.length > 0 && (
                                            <div className="mt-8">
                                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Constraints</h3>
                                                <ul className="space-y-2">
                                                    {selectedProblem.constraints.map((c, i) => (
                                                        <li key={i} className="text-xs font-mono text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-100 flex items-start gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                                                            {c}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )
                            ) : <div className="p-8 text-center text-gray-400">Select a problem to view</div>}
                        </div>
                    </div>

                    <DragHandleH onMouseDown={(e) => startDrag('desc', e)} />

                    {/* Editor & Results */}
                    <div style={{ width: `calc(100% - ${descW}%)` }} className="flex flex-col bg-white">
                        {/* Editor Split */}
                        <div style={{ height: `${editorTopH}%` }} className="flex flex-col relative transition-height duration-200">
                            {/* Toolbar */}
                            <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-3 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <select value={currentLang} onChange={handleLangChange} disabled={isProblemLocked || contestSubmitted}
                                            className="bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 rounded-md py-1.5 pl-2.5 pr-8 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer hover:bg-gray-100 transition-colors appearance-none">
                                            {LANGUAGE_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleRun} disabled={running || isProblemLocked || (contestSubmitted && !isPractice)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 rounded-md hover:bg-gray-100 transition-all disabled:opacity-50">
                                        {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
                                        Run
                                    </button>
                                    <button onClick={handleSubmit} disabled={submitting || isProblemLocked || (contestSubmitted && !isPractice)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-md shadow-sm transition-all disabled:opacity-50">
                                        {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                        {isPractice ? 'Verify' : 'Submit'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-hidden relative">
                                <Editor
                                    height="100%"
                                    language={LANGUAGE_OPTIONS.find(l => l.value === currentLang)?.monacoLang}
                                    value={currentCode}
                                    onChange={(v) => !isProblemLocked && (!contestSubmitted || isPractice) && setCurrentCode(v || '')}
                                    theme="vs-light"
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 14,
                                        padding: { top: 16 },
                                        automaticLayout: true,
                                        fontFamily: "'JetBrains Mono', monospace",
                                        readOnly: isProblemLocked || (contestSubmitted && !isPractice)
                                    }}
                                    onMount={(e, m) => { editorRef.current = e; monacoRef.current = m; }}
                                />
                                {(isProblemLocked || contestSubmitted) && (
                                    <div className="absolute inset-0 bg-gray-50/50 backdrop-blur-[1px] flex items-center justify-center z-10 pointer-events-none">
                                        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 text-center transform scale-100">
                                            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <CheckCircle className="text-green-500" size={24} />
                                            </div>
                                            <h3 className="text-gray-900 font-bold mb-1">Problem Submitted</h3>
                                            <p className="text-xs text-gray-500">This problem is locked for further editing.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <DragHandleV onMouseDown={(e) => startDrag('editorH', e)} />

                        {/* Results Split */}
                        <div style={{ height: `${100 - editorTopH}%` }} className="flex flex-col bg-white relative" key={resultsAnimKey}>
                            <div className="flex items-center h-10 border-b border-gray-200 bg-gray-50 px-2 gap-1 shrink-0">
                                <button onClick={() => setBottomTab('testcases')}
                                    className={`px-4 h-full text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${bottomTab === 'testcases' ? 'border-blue-500 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
                                    <List size={14} /> Test Cases
                                </button>
                                <button onClick={() => setBottomTab('results')}
                                    className={`px-4 h-full text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${bottomTab === 'results' ? 'border-blue-500 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}>
                                    {isCompileErr ? (
                                        <span className="flex items-center gap-1.5 text-orange-600"><AlertTriangle size={14} /> Compilation Error</span>
                                    ) : displayResult && !running && !submitting ? (
                                        <span className={`flex items-center gap-1.5 ${displayResult.verdict === 'Accepted' ? 'text-green-600' : 'text-red-600'}`}>
                                            {displayResult.verdict === 'Accepted' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                            {displayResult.isRun ? 'Run Result' : 'Submission Result'}
                                        </span>
                                    ) : (
                                        <><Terminal size={14} /> Results</>
                                    )}
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden bg-white relative">
                                {/* Running State */}
                                {(running || submitting) ? (
                                    <ExecutionProgress isRunning={running} isSubmitting={submitting} total={submitting ? (contest?.problems?.length || 5) : sampleTestCases.length} />
                                ) : (
                                    <>
                                        {/* Test Cases Tab */}
                                        {bottomTab === 'testcases' && (
                                            <div className="flex flex-col h-full">
                                                <div className="flex items-center p-2 gap-2 border-b border-gray-100 overflow-x-auto shrink-0 bg-white">
                                                    {sampleTestCases.map((_, i) => (
                                                        <button key={i} onClick={() => setActiveInputCase(i)}
                                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeInputCase === i ? 'bg-gray-100 text-gray-900 ring-1 ring-gray-200' : 'text-gray-500 hover:bg-gray-50'}`}>
                                                            Case {i + 1}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex-1 p-6 overflow-y-auto">
                                                    {sampleTestCases[activeInputCase] && (
                                                        <div className="space-y-6">
                                                            <div>
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Input</label>
                                                                </div>
                                                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-mono text-gray-800 whitespace-pre-wrap">{sampleTestCases[activeInputCase].input}</div>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Expected Output</label>
                                                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-mono text-gray-600 whitespace-pre-wrap">{sampleTestCases[activeInputCase].output}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Results Tab */}
                                        {bottomTab === 'results' && (
                                            <div className="h-full overflow-y-auto flex flex-col">
                                                {consoleOutput ? (
                                                    isCompileErr ? (
                                                        <div className="p-8">
                                                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                                                                <div className="flex items-center gap-3 mb-3 text-orange-700 font-bold text-sm">
                                                                    <AlertTriangle size={18} /> Compilation Error
                                                                </div>
                                                                <pre className="text-xs text-orange-600 font-mono whitespace-pre-wrap leading-relaxed">{consoleOutput.message}</pre>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col h-full">
                                                            {/* Verdict Banner */}
                                                            {(() => {
                                                                const vc = getVerdictColor(displayResult?.verdict);
                                                                const isAccepted = displayResult?.verdict === 'Accepted';
                                                                return (
                                                                    <div className={`px-6 py-4 border-b shrink-0 ${vc.bg} ${vc.border}`}>
                                                                        <div className="flex items-center gap-4">
                                                                            <div className={`p-2 rounded-full ${isAccepted ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                                                {isAccepted ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                                                            </div>
                                                                            <div>
                                                                                <h3 className={`text-lg font-bold ${vc.text}`}>
                                                                                    {displayResult?.verdict}
                                                                                </h3>
                                                                                {displayResult?.isSubmitMode && (
                                                                                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                                                                                        {consoleOutput.submission?.testCasesPassed} / {consoleOutput.submission?.totalTestCases} cases passed
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Cases Nav */}
                                                            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 overflow-x-auto shrink-0 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] z-10">
                                                                {displayResult?.results?.map((r, i) => (
                                                                    <button key={i} onClick={() => setActiveResultCase(i)}
                                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${activeResultCase === i
                                                                            ? (r.passed ? 'bg-green-50 border-green-200 text-green-700 ring-1 ring-green-200' : 'bg-red-50 border-red-200 text-red-700 ring-1 ring-red-200')
                                                                            : 'border-transparent text-gray-500 hover:bg-gray-50'
                                                                            }`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${r.passed ? 'bg-green-500' : 'bg-red-500'}`} />
                                                                        Case {i + 1}
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            {/* Details */}
                                                            <div className="flex-1 p-6 overflow-y-auto bg-white" key={activeResultCase}>
                                                                {displayResult?.results?.[activeResultCase] && (
                                                                    <div className="space-y-6 max-w-4xl mx-auto">
                                                                        {displayResult.results[activeResultCase].isHidden ? (
                                                                            <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                                                                                <Lock className="mx-auto text-gray-400 mb-3 opacity-50" size={32} />
                                                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hidden Test Case</p>
                                                                                <p className={`text-base font-bold mt-2 ${displayResult.results[activeResultCase].passed ? 'text-green-600' : 'text-red-500'}`}>
                                                                                    {displayResult.results[activeResultCase].passed ? 'Passed Correctly' : 'Failed Execution'}
                                                                                </p>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <div className="grid grid-cols-2 gap-6">
                                                                                    <div>
                                                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Input</label>
                                                                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-mono text-gray-800 overflow-x-auto whitespace-pre-wrap">{displayResult.results[activeResultCase].input}</div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Expected Output</label>
                                                                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-mono text-gray-600 overflow-x-auto whitespace-pre-wrap">{displayResult.results[activeResultCase].expectedOutput}</div>
                                                                                    </div>
                                                                                </div>
                                                                                <div>
                                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Your Output</label>
                                                                                    <div className={`p-4 rounded-xl text-xs font-mono border overflow-x-auto whitespace-pre-wrap ${displayResult.results[activeResultCase].passed
                                                                                        ? 'bg-green-50/30 border-green-200 text-gray-900'
                                                                                        : 'bg-red-50/30 border-red-200 text-gray-900'}`}>
                                                                                        {displayResult.results[activeResultCase].actualOutput || <span className="text-gray-400 italic">Empty output</span>}
                                                                                    </div>
                                                                                </div>
                                                                                {displayResult.results[activeResultCase].error && (
                                                                                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
                                                                                        <div className="text-red-700 text-xs font-bold mb-2 uppercase tracking-wide">Error Message</div>
                                                                                        <pre className="text-red-600 text-xs font-mono whitespace-pre-wrap">{displayResult.results[activeResultCase].error}</pre>
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="flex h-full items-center justify-center text-gray-400 flex-col gap-3">
                                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100">
                                                            <Terminal className="opacity-20" size={32} />
                                                        </div>
                                                        <p className="text-sm font-medium">Run code to see execution results</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Modals ─── */}
            {showLeaderboard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden border border-gray-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-white border-b border-gray-100 p-6 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">🏆 Live Leaderboard</h2>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-xs text-gray-500">Real-time ranking updates</p>
                                    <button onClick={downloadCSV} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 font-bold hover:bg-blue-100 transition-colors">
                                        Download CSV
                                    </button>
                                </div>
                            </div>
                            <button onClick={() => setShowLeaderboard(false)} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors text-gray-500">
                                <LogOut size={16} className="rotate-180" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto scrollbar-thin bg-gray-50/50 relative">
                            {loadingLeaderboard ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-2"></div>
                                    <p className="text-sm text-gray-500 font-medium">Updating Leaderboard...</p>
                                </div>
                            ) : leaderboardData.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                    <Trophy size={48} className="mb-4 opacity-20" />
                                    <p>No participants yet</p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left border-collapse min-w-max">
                                        <thead className="bg-white sticky top-0 z-10 shadow-sm text-xs uppercase tracking-wider text-gray-500">
                                            <tr>
                                                <th className="p-4 font-bold w-20 text-center cursor-pointer hover:bg-gray-50 sticky left-0 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" onClick={() => handleSort('rank')}>
                                                    Rank {sortConfig.key === 'rank' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                </th>
                                                <th className="p-4 font-bold cursor-pointer hover:bg-gray-50 sticky left-20 bg-white z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-48" onClick={() => handleSort('username')}>
                                                    Student {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                </th>
                                                
                                                {/* Problem Columns */}
                                                {contest?.problems?.map((prob, i) => (
                                                    <th key={prob._id} className="p-4 font-bold text-center whitespace-nowrap min-w-[120px]">
                                                        P{i + 1}
                                                    </th>
                                                ))}

                                                <th className="p-4 font-bold text-center cursor-pointer hover:bg-gray-50 whitespace-nowrap" onClick={() => handleSort('problemsSolved')}>
                                                    Solved {sortConfig.key === 'problemsSolved' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                </th>
                                                <th className="p-4 font-bold text-center cursor-pointer hover:bg-gray-50 whitespace-nowrap" onClick={() => handleSort('time')}>
                                                    Time {sortConfig.key === 'time' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                </th>
                                                <th className="p-4 font-bold text-center cursor-pointer hover:bg-gray-50 whitespace-nowrap" onClick={() => handleSort('status')}>
                                                    Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                </th>
                                                <th className="p-4 font-bold text-center cursor-pointer hover:bg-gray-50 whitespace-nowrap sticky right-0 bg-white z-20 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]" onClick={() => handleSort('score')}>
                                                    Score {sortConfig.key === 'score' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-sm bg-white">
                                            {sortedLeaderboardData.map((entry, index) => (
                                                <tr key={index} className={`hover:bg-gray-50 transition ${entry.studentId === user?.userId ? 'bg-blue-50/30' : ''}`}>
                                                    <td className="p-4 text-center sticky left-0 bg-inherit z-10 border-r border-gray-100">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold text-xs ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                            index === 1 ? 'bg-gray-100 text-gray-700' :
                                                                index === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-500'
                                                            }`}>
                                                            {index + 1}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 sticky left-20 bg-inherit z-10 border-r border-gray-100 max-w-[200px] truncate" title={entry.username}>
                                                        <span className="font-semibold text-gray-900">{entry.username}</span>
                                                    </td>

                                                    {/* Problem Cells */}
                                                    {contest?.problems?.map(prob => {
                                                        const pData = entry.problems?.[prob._id];
                                                        const status = pData?.status || 'Not Attempted';
                                                        let cellClass = "bg-gray-50 text-gray-400";
                                                        
                                                        if (status === 'Accepted') {
                                                            cellClass = "bg-green-50 text-green-700 font-medium";
                                                        } else if (status === 'Wrong Answer') {
                                                            cellClass = "bg-red-50 text-red-700";
                                                        }

                                                        return (
                                                            <td key={prob._id} className="p-2 text-center border-r border-gray-50">
                                                                <div className={`px-2 py-1 rounded text-xs inline-block min-w-[60px] ${cellClass}`}>
                                                                    {status === 'Not Attempted' ? 'Not Tried' : status}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}

                                                    <td className="p-4 text-center">
                                                        <span className="inline-block bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-green-100">
                                                            {entry.problemsSolved}/{contest?.problems?.length || 0}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center text-gray-600 font-mono">{entry.time}m</td>
                                                    <td className="p-4 text-center">
                                                        {entry.isCompleted ? (
                                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium border border-green-200">
                                                                Finished
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium border border-yellow-200">
                                                                In Progress
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center font-bold text-blue-600 sticky right-0 bg-inherit z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] border-l border-gray-100">{entry.score}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContestInterface;
