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
    Menu
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

const ExecutionProgress = ({ isRunning, isSubmitting, total }) => {
    const [count, setCount] = useState(0);
    const intervalRef = useRef(null);

    useEffect(() => {
        if (isRunning || isSubmitting) {
            setCount(0);
            const step = Math.max(1, Math.floor(total / 20));
            intervalRef.current = setInterval(() => {
                setCount(prev => {
                    const next = prev + step;
                    return next >= total - 1 ? total - 1 : next;
                });
            }, 300);
        } else {
            clearInterval(intervalRef.current);
            setCount(0);
        }
        return () => clearInterval(intervalRef.current);
    }, [isRunning, isSubmitting, total]);

    if (!isRunning && !isSubmitting) return null;

    const progress = total > 0 ? Math.round((count / total) * 100) : 0;
    const label = isSubmitting ? 'Submitting Solution' : 'Running Test Cases';

    return (
        <div className="flex flex-col h-full items-center justify-center gap-6 px-8 animate-in fade-in zoom-in duration-300">
            <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full text-gray-100" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" />
                </svg>
                <svg className="absolute inset-0 w-full h-full text-blue-500 rotate-[-90deg]" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="283" strokeDashoffset={283 - (283 * progress) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-600 font-mono">
                    {Math.round(progress)}%
                </div>
            </div>

            <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-gray-900">{label}</h3>
                <p className="text-sm text-gray-500 font-medium">
                    Executed {count} / {total} cases
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mt-4">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Processing execution environment...</span>
                </div>
            </div>
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
    const [isCustomInput, setIsCustomInput] = useState(false);
    const [customInputVal, setCustomInputVal] = useState('');
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [isResizing, setIsResizing] = useState(false);
    const [resultsAnimKey, setResultsAnimKey] = useState(0);
    const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false);

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
        useProctoring(contestId, (contestActive && !contestSubmitted && !isPractice), handleMaxViolations);

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
            setContestSubmitted(contestData.contest.isSubmitted || false);

            const locked = new Set();
            contestData.contest.problems?.forEach(p => { if (p.isLocked || p.isSolved) locked.add(p._id); });
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
            lbInterval = setInterval(fetchLb, 10000);
        }
        return () => clearInterval(lbInterval);
    }, [contestId, showLeaderboard]);

    useEffect(() => {
        if (contest && contestActive && !contestSubmitted) {
            const interval = setInterval(() => {
                const now = new Date();
                const end = new Date(contest.endTime);
                const remaining = Math.max(0, Math.floor((end - now) / 1000));
                setTimeRemaining(remaining);
                if (remaining === 0) handleContestEnd();
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [contest, contestActive, contestSubmitted]);

    /* ─── Handlers ─── */
    const handleProblemChange = (problem, isInit = false) => {
        if (!isInit && contestSubmitted) return toast.error('Contest submitted');

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

        localStorage.setItem(`contest_${contestId}_lastProblem`, problem._id);
    };

    const handleLangChange = (e) => {
        if (isProblemLocked || contestSubmitted) return;
        const l = e.target.value;
        const oldLang = currentLang;
        setCurrentLang(l);
        // Only reset code if it's empty or the default template of previous language
        if (!currentCode.trim() || currentCode === DEFAULT_CODE[oldLang] || currentCode === '// Write your code here') {
            setCurrentCode(DEFAULT_CODE[l]);
        }
    };

    const handleRun = async () => {
        if (contestSubmitted || isProblemLocked) return;
        if (!currentCode.trim()) return toast.error('Code cannot be empty');
        if (!document.fullscreenElement && contest?.proctoringEnabled) enterFullscreen();

        setRunning(true);
        setBottomTab('results');
        setEditorTopH(40); // Auto expand results slightly
        setResultsAnimKey(k => k + 1);
        setActiveResultCase(0);

        try {
            const result = await contestService.runContestCode(contestId, {
                problemId: selectedProblem._id,
                code: currentCode,
                language: currentLang
            });
            setConsoleOutput({ type: 'run', data: result.results });
        } catch (error) {
            setConsoleOutput({ type: 'error', message: error.message || 'Execution failed' });
        } finally { setRunning(false); }
    };

    const handleSubmit = async () => {
        if (contestSubmitted || isProblemLocked) return;
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

            setConsoleOutput({ type: 'submit', submission: result.submission, data: result.results });

            if (result.submission.verdict === 'Accepted') {
                toast.success('Problem Solved!');
                setUserSubmissions(prev => ({ ...prev, [selectedProblem._id]: 'Accepted' }));
                setLockedProblems(prev => new Set([...prev, selectedProblem._id]));
                // Clear saved draft for this problem
                const savedMap = JSON.parse(localStorage.getItem(`contest_${contestId}_codeMap`) || '{}');
                delete savedMap[selectedProblem._id];
                localStorage.setItem(`contest_${contestId}_codeMap`, JSON.stringify(savedMap));
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
        ? { verdict: 'Executed', results: consoleOutput.data, isRun: true }
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
                    <button onClick={() => navigate('/student/contests')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                        <LogOut size={18} />
                    </button>
                    <div className="flex flex-col min-w-0">
                        <h1 className="text-sm font-bold text-gray-900 truncate flex items-center gap-2">
                            {contest.title}
                            {contestSubmitted && <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full border border-green-200 uppercase tracking-wide">Submitted</span>}
                        </h1>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {liveParticipants} Live</span>
                            {violationSummary.totalViolations > 0 && (
                                <span className="flex items-center gap-1 text-amber-600 font-medium">
                                    <AlertTriangle size={10} /> {violationSummary.totalViolations} Violations
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Center Timer - Hide in Practice */}
                {(!contestSubmitted && !isPractice) && (
                    <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-1.5 rounded-full border ${timeRemaining < 300 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                        <Clock size={14} />
                        <span className="font-mono font-bold text-sm tracking-widest">{formatTime(timeRemaining)}</span>
                    </div>
                )}

                <div className="flex items-center gap-2">
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
                        <span className="bg-indigo-100 text-indigo-700 text-xs px-3 py-1.5 rounded-lg font-bold border border-indigo-200 uppercase tracking-wide">
                            Practice Configuration
                        </span>
                    )}
                </div>
            </header>

            {/* ─── Problem Tabs ─── */}
            <div className="bg-gray-50 border-b border-gray-200 px-1 py-1 flex gap-1 overflow-x-auto shrink-0 no-scrollbar">
                {contest.problems.map((p, i) => {
                    const status = userSubmissions[p._id];
                    const isActive = selectedProblem?._id === p._id;
                    const locked = lockedProblems.has(p._id);
                    return (
                        <button key={p._id} onClick={() => handleProblemChange(p)} disabled={contestSubmitted && !isActive}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all min-w-[140px] max-w-[200px] group border relative
                                ${isActive ? 'bg-white border-gray-200 text-blue-600 shadow-sm z-10' : 'bg-transparent border-transparent text-gray-500 hover:bg-white/50 hover:text-gray-700'}
                                ${status === 'Accepted' ? 'pr-8' : ''}
                            `}
                        >
                            <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-500 group-hover:bg-gray-300'}`}>
                                {String.fromCharCode(65 + i)}
                            </span>
                            <span className="truncate">{p.title}</span>

                            {status === 'Accepted' && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500">
                                    <CheckCircle size={14} className="fill-emerald-100" />
                                </div>
                            )}
                            {locked && !status && <Lock size={12} className="text-gray-400 absolute right-2" />}
                        </button>
                    );
                })}
            </div>

            {/* ─── Main Content ─── */}
            <div className="flex-1 flex overflow-hidden">
                {/* Description Panel */}
                <div style={{ width: `${descW}%` }} className="flex flex-col bg-white border-r border-gray-200 shrink-0">
                    <div className="flex items-center h-10 px-4 border-b border-gray-200 bg-white shrink-0">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            <FileText size={14} /> Description
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                        {selectedProblem ? (
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
                                    <span className="flex items-center gap-1.5 text-red-600"><AlertTriangle size={14} /> Compilation Error</span>
                                ) : displayResult && !running && !submitting ? (
                                    <span className={`flex items-center gap-1.5 ${showGreenVerdict ? 'text-green-600' : 'text-red-600'}`}>
                                        {showGreenVerdict ? <CheckCircle size={14} /> : <XCircle size={14} />}
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
                                                    <button key={i} onClick={() => { setActiveInputCase(i); setIsCustomInput(false); }}
                                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeInputCase === i && !isCustomInput ? 'bg-gray-100 text-gray-900 ring-1 ring-gray-200' : 'text-gray-500 hover:bg-gray-50'}`}>
                                                        Case {i + 1}
                                                    </button>
                                                ))}
                                                <button onClick={() => setIsCustomInput(true)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isCustomInput ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'text-gray-500 hover:bg-gray-50'}`}>
                                                    Custom Case
                                                </button>
                                            </div>
                                            <div className="flex-1 p-6 overflow-y-auto">
                                                {isCustomInput ? (
                                                    <div className="space-y-2 h-full flex flex-col">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Custom Input</label>
                                                        <textarea value={customInputVal} onChange={(e) => setCustomInputVal(e.target.value)}
                                                            className="flex-1 w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-mono resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                                            placeholder="Enter your custom test case input here..."
                                                        />
                                                    </div>
                                                ) : sampleTestCases[activeInputCase] && (
                                                    <div className="space-y-6">
                                                        <div>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Input</label>
                                                            </div>
                                                            <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-mono text-gray-800 pointer-events-none select-text">{sampleTestCases[activeInputCase].input}</pre>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Expected Output</label>
                                                            <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-mono text-gray-600 pointer-events-none select-text">{sampleTestCases[activeInputCase].output}</pre>
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
                                                        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                                                            <div className="flex items-center gap-3 mb-3 text-red-700 font-bold text-sm">
                                                                <AlertTriangle size={18} /> Compilation Error
                                                            </div>
                                                            <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap leading-relaxed">{consoleOutput.message}</pre>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col h-full">
                                                        {/* Verdict Banner */}
                                                        <div className={`px-6 py-4 border-b shrink-0 ${displayResult?.verdict === 'Accepted' ? 'bg-emerald-50/50 border-emerald-100' : (showGreenVerdict ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100')}`}>
                                                            <div className="flex items-center gap-4">
                                                                <div className={`p-2 rounded-full ${showGreenVerdict ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                                    {showGreenVerdict ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                                                </div>
                                                                <div>
                                                                    <h3 className={`text-lg font-bold ${showGreenVerdict ? 'text-emerald-900' : 'text-red-900'}`}>
                                                                        {displayResult?.verdict === 'Accepted' ? 'Accepted' : (displayResult?.verdict || (showGreenVerdict ? 'Passed' : 'Failed'))}
                                                                    </h3>
                                                                    {displayResult?.isSubmitMode && (
                                                                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                                                                            {consoleOutput.submission?.testCasesPassed} / {consoleOutput.submission?.totalTestCases} cases passed
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Cases Nav */}
                                                        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 overflow-x-auto shrink-0 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] z-10">
                                                            {displayResult?.results?.map((r, i) => (
                                                                <button key={i} onClick={() => setActiveResultCase(i)}
                                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${activeResultCase === i
                                                                        ? (r.passed ? 'bg-emerald-50 border-emerald-200 text-emerald-700 ring-1 ring-emerald-200' : 'bg-red-50 border-red-200 text-red-700 ring-1 ring-red-200')
                                                                        : 'border-transparent text-gray-500 hover:bg-gray-50'
                                                                        }`}>
                                                                    <span className={`w-1.5 h-1.5 rounded-full ${r.passed ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                                    Case {i + 1}
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {/* Details */}
                                                        <div className="flex-1 p-6 overflow-y-auto bg-white">
                                                            {displayResult?.results?.[activeResultCase] && (
                                                                <div className="space-y-6 max-w-4xl mx-auto">
                                                                    {displayResult.results[activeResultCase].isHidden ? (
                                                                        <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                                                                            <Lock className="mx-auto text-gray-400 mb-3 opacity-50" size={32} />
                                                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hidden Test Case</p>
                                                                            <p className={`text-base font-bold mt-2 ${displayResult.results[activeResultCase].passed ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                                {displayResult.results[activeResultCase].passed ? 'Passed Correctly' : 'Failed Execution'}
                                                                            </p>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <div className="grid grid-cols-2 gap-6">
                                                                                <div>
                                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Input</label>
                                                                                    <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-mono text-gray-800 overflow-x-auto">{displayResult.results[activeResultCase].input}</pre>
                                                                                </div>
                                                                                <div>
                                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Expected Output</label>
                                                                                    <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs font-mono text-gray-600 overflow-x-auto">{displayResult.results[activeResultCase].expectedOutput}</pre>
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Your Output</label>
                                                                                <pre className={`p-4 rounded-xl text-xs font-mono border overflow-x-auto ${displayResult.results[activeResultCase].passed
                                                                                    ? 'bg-emerald-50/30 border-emerald-200 text-emerald-900'
                                                                                    : 'bg-red-50/30 border-red-200 text-red-900'}`}>
                                                                                    {displayResult.results[activeResultCase].actualOutput || <span className="text-gray-400 italic">Empty output</span>}
                                                                                </pre>
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

            {/* ─── Modals ─── */}
            {showLeaderboard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden border border-gray-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-white border-b border-gray-100 p-6 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">🏆 Live Leaderboard</h2>
                                <p className="text-xs text-gray-500 mt-1">Real-time ranking updates</p>
                            </div>
                            <button onClick={() => setShowLeaderboard(false)} className="bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors text-gray-500">
                                <LogOut size={16} className="rotate-180" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto scrollbar-thin bg-gray-50/50">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white sticky top-0 z-10 shadow-sm text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="p-4 font-bold w-20 text-center">Rank</th>
                                        <th className="p-4 font-bold">Student</th>
                                        <th className="p-4 font-bold text-center">Score</th>
                                        <th className="p-4 font-bold text-center">Solved</th>
                                        <th className="p-4 font-bold text-center">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm bg-white">
                                    {leaderboardData.map((entry, index) => (
                                        <tr key={index} className={`hover:bg-gray-50 transition ${entry.studentId === user?.userId ? 'bg-blue-50/30' : ''}`}>
                                            <td className="p-4 text-center">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold text-xs ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                                    index === 1 ? 'bg-gray-100 text-gray-700' :
                                                        index === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-500'
                                                    }`}>
                                                    {index === 0 ? '1' : index === 1 ? '2' : index === 2 ? '3' : index + 1}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-900">{entry.username}</span>
                                                    <span className="text-xs text-gray-400 font-mono">{entry.rollNumber}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-bold text-blue-600">{entry.score}</td>
                                            <td className="p-4 text-center">
                                                <span className="inline-block bg-green-50 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-green-100">{entry.problemsSolved}</span>
                                            </td>
                                            <td className="p-4 text-center text-gray-600 font-mono">{entry.time}m</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContestInterface;
