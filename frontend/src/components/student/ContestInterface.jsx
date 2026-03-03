import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import contestService from '../../services/contestService';
import useProctoring from '../../hooks/useProctoring';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import Cookies from 'js-cookie';
import { CiLock } from 'react-icons/ci';
import { IoCloseCircleOutline } from 'react-icons/io5';
import { MdOutlineArrowForward } from 'react-icons/md';
import {
    Play,
    CheckCircle,
    AlertTriangle,
    ChevronDown,
    Maximize2,
    Trophy,
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
    ChevronLeft,
    RotateCw,
    Plus,
    X
} from 'lucide-react';

import CustomDropdown from '../shared/CustomDropdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const MarkdownComponents = {
    h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mt-5 mb-3">{children}</h1>,
    h2: ({ children }) => <h2 className="text-lg font-bold text-gray-900 mt-5 mb-2">{children}</h2>,
    h3: ({ children }) => <h3 className="text-md font-semibold text-gray-800 mt-4 mb-1.5">{children}</h3>,
    p: ({ children }) => <p className="text-gray-700 text-[14px] leading-6 mb-3 whitespace-pre-wrap break-words">{children}</p>,
    ul: ({ children }) => <ul className="text-gray-700 text-[14px] list-disc list-outside ml-4 mb-3 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="text-gray-700 text-[14px] list-decimal list-outside ml-4 mb-3 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="pl-1 leading-6 break-words">{children}</li>,
    blockquote: ({ children }) => <blockquote className="border-l-4 border-primary-400 pl-4 py-1 italic text-gray-500 my-3 bg-primary-50 rounded-r">{children}</blockquote>,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline break-all">{children}</a>,
    img: ({ src, alt }) => <img src={src} alt={alt} className="max-w-full rounded-xl border border-gray-200 my-4 shadow-sm" />,
    code: ({ inline, className, children }) => {
        const content = String(children).replace(/\n$/, '');
        const match = /language-(\w+)/.exec(className || '');
        if (inline || (!match && !content.includes('\n'))) {
            return <code className="bg-primary-50 text-primary-700 px-1 py-0.5 rounded text-sm font-mono break-all">{children}</code>;
        }
        return <pre className="my-3 p-3 overflow-x-auto text-sm font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded-lg">{children}</pre>;
    }
};

/* —"—"—" Helpers —"—"—" */
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

// —"—"—" Verdict color helper —"—"—"
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

// —"—"—" Description Cleaner —"—"—"
const cleanDescription = (desc) => {
    if (!desc) return '';
    // Headers that are now rendered separately in dedicated sections
    // Only strip Examples as they are the most common duplicates
    const redundantHeaders = [
        '**Example:**',
        '**Example**',
        '### Example',
        '### Examples',
        '## Example',
        '## Examples',
        'Example:',
        'Example 1:',
        'Examples:'
    ];

    let minIndex = desc.length;
    redundantHeaders.forEach(header => {
        const idx = desc.indexOf(header);
        // We only want to truncate if it's likely a header (at start of line or preceded by newlines)
        if (idx !== -1 && idx < minIndex) {
            // Check if it's the start of the string or preceded by a newline
            if (idx === 0 || desc[idx - 1] === '\n') {
                minIndex = idx;
            }
        }
    });

    return desc.substring(0, minIndex).trim();
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
    { value: 'c', label: 'C', monacoLang: 'c' },
    { value: 'csharp', label: 'C#', monacoLang: 'csharp' }
];

const DEFAULT_CODE = {
    c: '#include <stdio.h>\n\nint main() {\n    // your code\n    return 0;\n}',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // your code\n    return 0;\n}',
    java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // your code\n    }\n}',
    python: '# Write your Python code here\n',
    javascript: '// Write your JavaScript code here\n',
    csharp: 'using System;\nusing System.Collections.Generic;\nusing System.Linq;\n\nclass Program {\n    static void Main() {\n        // your code\n    }\n}',
};

/* —"—"—" Main Component —"—"—" */
const ContestInterface = ({ isPractice = false }) => {
    const { contestId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const basePath = user?.role === 'admin' ? '/admin' : user?.role === 'instructor' ? '/instructor' : '/student';

    // Data State
    const [contest, setContest] = useState(null);
    const [contestError, setContestError] = useState(null); // null | 'not_found' | 'error'
    const [selectedProblem, setSelectedProblem] = useState(null);
    const [userCodeMap, setUserCodeMap] = useState({});
    const [userSubmissions, setUserSubmissions] = useState({});
    const [lockedProblems, setLockedProblems] = useState(new Set());

    // Contest Status
    const [contestSubmitted, setContestSubmitted] = useState(false);
    const [contestActive, setContestActive] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [liveParticipants, setLiveParticipants] = useState(0);

    // Execution State
    const [submitting, setSubmitting] = useState(false);
    const [finishing, setFinishing] = useState(false);
    const [running, setRunning] = useState(false);
    // Per-problem running/submitting tracking so switching problems won't bleed state
    const [runningMap, setRunningMap] = useState({}); // { problemId: true|false }
    const [submittingMap, setSubmittingMap] = useState({}); // { problemId: true|false }
    const [consoleOutput, setConsoleOutput] = useState(null);
    const [consoleOutputMap, setConsoleOutputMap] = useState({}); // per-problem persistent results
    const [currentCode, setCurrentCode] = useState('');
    const [currentLang, setCurrentLang] = useState('cpp');
    const [sampleTestCases, setSampleTestCases] = useState([]);
    // Custom test case state — mirrors problem workspace
    const [customTestCases, setCustomTestCases] = useState([]);
    const [activeTestCaseId, setActiveTestCaseId] = useState('case-0');

    const handleAddCustomCase = () => {
        const newId = Date.now();
        setCustomTestCases(prev => [...prev, { id: newId, input: '' }]);
        setActiveTestCaseId(`custom-${newId}`);
    };
    const handleRemoveCustomCase = (id, e) => {
        e.stopPropagation();
        setCustomTestCases(prev => prev.filter(c => c.id !== id));
        if (activeTestCaseId === `custom-${id}`) setActiveTestCaseId('case-0');
    };
    const updateCustomCase = (val) => {
        setCustomTestCases(prev => prev.map(c =>
            `custom-${c.id}` === activeTestCaseId ? { ...c, input: val } : c
        ));
    };

    // UI State
    const [sidebarW, setSidebarW] = useState(20);
    const [descW, setDescW] = useState(38);
    const [editorTopH, setEditorTopH] = useState(65);
    const COLLAPSED_SIDEBAR_WIDTH = 48; // px
    const [bottomTab, setBottomTab] = useState('testcases');
    const [activeResultCase, setActiveResultCase] = useState(0);
    const [activeInputCase, setActiveInputCase] = useState(0);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const showLeaderboardRef = useRef(showLeaderboard);
    useEffect(() => { showLeaderboardRef.current = showLeaderboard; }, [showLeaderboard]);
    const [contestPast, setContestPast] = useState(false); // true when contest has ended and user visits URL
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [totalParticipants, setTotalParticipants] = useState(0);
    const [isResizing, setIsResizing] = useState(false);
    const [resultsAnimKey, setResultsAnimKey] = useState(0);
    const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false);
    const [showEditorial, setShowEditorial] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isExecutionOffline, setIsExecutionOffline] = useState(false);

    useEffect(() => {
        const handleOnline = () => { setIsOnline(true); setIsExecutionOffline(false); };
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const wsRef = useRef(null);
    const executionTimeoutRef = useRef(null);
    useEffect(() => { return () => clearTimeout(executionTimeoutRef.current); }, []);
    const autoSubmitTriggered = useRef(false);
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const containerRef = useRef(null);
    const dragging = useRef(null);
    // Keep a ref to violations so handleMaxViolations can read them without stale closures
    const violationsRef = useRef({ tabSwitchCount: 0, tabSwitchDuration: 0, fullscreenExits: 0, pasteAttempts: 0 });
    const finishingRef = useRef(false); // mirrors `finishing` state — readable in closures without staleness
    const timeUpFiredRef = useRef(false); // ensures we only fire time-up submission once
    // Refs for values needed inside async setInterval callbacks (avoids stale closures)
    const userRef = useRef(user);
    const navigateRef = useRef(navigate);
    const basePathRef = useRef(basePath);
    const contestRef = useRef(null);        // always holds the latest contest object
    const lockedProblemsRef = useRef(new Set()); // always holds the latest solved problem IDs
    useEffect(() => { userRef.current = user; }, [user]);
    useEffect(() => { navigateRef.current = navigate; }, [navigate]);
    useEffect(() => { basePathRef.current = basePath; }, [basePath]);
    useEffect(() => { contestRef.current = contest; }, [contest]);
    useEffect(() => { lockedProblemsRef.current = lockedProblems; }, [lockedProblems]);

    // Calculate score from client-side state — avoids depending on backend's
    // fire-and-forget score (which always returns 0 in the immediate response).
    const calcClientScore = (contestObj, solvedIds) => {
        if (!contestObj?.problems) return 0;
        return contestObj.problems
            .filter(p => solvedIds.has(p._id?.toString() || p._id))
            .reduce((sum, p) => sum + (p.points || 0), 0);
    };

    // Proctoring Hook - Disable in Practice Mode
    const handleMaxViolations = useCallback(async () => {
        if (isPractice || autoSubmitTriggered.current || contestSubmitted) return;
        autoSubmitTriggered.current = true;
        setFinishing(true);
        toast.error('⚠️ Maximum violations exceeded! Finishing contest...');
        try {
            const result = await contestService.finishContest(contestId, violationsRef.current);
            const clientScore = calcClientScore(contestRef.current, lockedProblemsRef.current);
            toast.success(`Contest ended. Final Score: ${clientScore}`);
            setContestSubmitted(true);
            setContestActive(false);
            localStorage.removeItem(`contest_${contestId}_codeMap`);
            setTimeout(() => {
                navigate(`/contests/${contest?.slug || contestId}/leaderboard`, { replace: true });
            }, 2000);
        } catch (error) {
            toast.error(error.message || 'Auto-submission failed');
            setFinishing(false);
            autoSubmitTriggered.current = false;
        }
    }, [contestId, contestSubmitted, isPractice, navigate, user]);

    const { violations, isFullscreen, showViolationModal, currentViolationType, enterFullscreen, exitFullscreenSilently, markAsFinishing, getViolationSummary } =
        useProctoring(
            contestId,
            user?.userId || user?.id || user?._id,
            (contestActive && !contestSubmitted && !isPractice),
            handleMaxViolations,
            contest?.maxViolations || 5
        );

    // Keep violationsRef in sync with the live hook state
    useEffect(() => { violationsRef.current = violations; }, [violations]);

    // Auto Fullscreen on mount if contest is active and NOT practice
    useEffect(() => {
        if (!isPractice && contestActive && !contestSubmitted && !hasEnteredFullscreen && contest?.proctoringEnabled) {
            enterFullscreen();
            setHasEnteredFullscreen(true);
        }
    }, [contestActive, contestSubmitted, hasEnteredFullscreen, enterFullscreen, contest, isPractice]);

    const handleFinishContest = useCallback(async (autoFinish = false, isTimeUp = false) => {
        if (contestSubmitted || finishing || autoSubmitTriggered.current) return;

        autoSubmitTriggered.current = true;

        if (isTimeUp) {
            toast('⏱ Time up! Submitting the contest...');
        }

        // Mark as finishing FIRST so fullscreen exit is NOT counted as a violation
        markAsFinishing();
        exitFullscreenSilently();

        setFinishing(true);
        finishingRef.current = true;
        try {
            // Pass the current live violation state as the definitive snapshot
            const finalViolations = {
                tabSwitchCount: violationsRef.current.tabSwitchCount,
                tabSwitchDuration: violationsRef.current.tabSwitchDuration,
                fullscreenExits: violationsRef.current.fullscreenExits,
                pasteAttempts: violationsRef.current.pasteAttempts
            };
            const result = await contestService.finishContest(contestId, finalViolations);
            const clientScore = calcClientScore(contestRef.current, lockedProblemsRef.current);
            toast.success(`Contest submitted! Final Score: ${clientScore}`);
            setContestSubmitted(true);
            setContestActive(false);
            localStorage.removeItem(`contest_${contestId}_codeMap`);
            setTimeout(() => {
                navigate(`/contests/${contest?.slug || contestId}/leaderboard`, { replace: true });
            }, 2000);
        } catch (error) {
            toast.error(error.message || 'Failed to finish contest');
            setFinishing(false);
            finishingRef.current = false;
            autoSubmitTriggered.current = false;
        }
    }, [contestId, contestSubmitted, finishing, user, navigate, basePath, markAsFinishing, exitFullscreenSilently]);

    /* —"—"—" WebSocket —"—"—" */
    const handleContestEnd = useCallback(async () => {
        if (!contestSubmitted && !isPractice) {
            await handleFinishContest(true, true);
        } else {
            setContestActive(false);
            toast.success('Contest has ended!');
            setTimeout(() => {
                if (user?.isSpotUser) setShowLeaderboard(true);
                else navigate(`${basePath}/contests`);
            }, 2000);
        }
    }, [navigate, user, contestSubmitted, isPractice, basePath, handleFinishContest]);

    const handleExecutionResultRef = useRef(null);

    const handleWebSocketMessage = useCallback((data) => {
        switch (data.type) {
            case 'leaderboardUpdate': setLeaderboardData(data.leaderboard || []); break;
            case 'leaderboardRefetch':
                if (showLeaderboardRef.current && contestId) {
                    const jitter = Math.floor(Math.random() * 5000);
                    setTimeout(() => {
                        contestService.getContestLeaderboard(contestId)
                            .then(d => {
                                setLeaderboardData(d.leaderboard || []);
                                if (d.totalParticipants) setTotalParticipants(d.totalParticipants);
                            })
                            .catch(console.error);
                    }, jitter);
                }
                break;
            case 'participantCount': setLiveParticipants(data.count); break;
            case 'newSubmission': break; // Optional: toast notification
            case 'violation': toast.error(`Violation detected: ${data.violation?.type}`); break;
            case 'contestEnded': handleContestEnd(); break;
            case 'executionResult':
                console.log('[WS] Received executionResult:', data);
                if (String(data.targetUserId) === String(user?._id || user?.userId || user?.id)) {
                    if (handleExecutionResultRef.current) {
                        handleExecutionResultRef.current(data);
                    }
                } else {
                    console.log('[WS] targetUserId mismatch:', data.targetUserId, user?._id || user?.userId || user?.id);
                }
                break;
        }
    }, [handleContestEnd, contestId, user]);

    // Keep a stable ref to handleWebSocketMessage so the WebSocket effect
    // does NOT need it as a dependency (avoids needless reconnects).
    const handleWebSocketMessageRef = useRef(handleWebSocketMessage);
    useEffect(() => { handleWebSocketMessageRef.current = handleWebSocketMessage; }, [handleWebSocketMessage]);

    useEffect(() => {
        if (isPractice || !contestActive || !contest || contestSubmitted) return;

        const wsRoomId = contest._id || contestId;
        const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:5000'}/ws`;
        let destroyed = false;
        let reconnectTimer = null;
        let retryDelay = 1000; // start at 1s, exponential up to 8s

        const connect = () => {
            if (destroyed) return;

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                retryDelay = 1000; // reset backoff on successful connect
                let token = Cookies.get('accessToken') || localStorage.getItem('accessToken');
                if (!token) { console.warn('WS: no token, cannot join'); return; }
                token = token.replace('Bearer ', '').trim();
                console.log('[WS] Connected to room:', wsRoomId);
                ws.send(JSON.stringify({ type: 'join', contestId: wsRoomId, token }));
                // Restore online state if it was set offline due to WS drop
                if (navigator.onLine) setIsOnline(true);
            };

            ws.onmessage = (event) => {
                try {
                    if (handleWebSocketMessageRef.current) {
                        handleWebSocketMessageRef.current(JSON.parse(event.data));
                    }
                } catch (e) { console.error('[WS] Message parse error:', e); }
            };

            ws.onerror = (e) => {
                console.warn('[WS] Error:', e);
                // Do not set isOnline=false here — that's for browser-level offline events only
            };

            ws.onclose = (e) => {
                console.warn('[WS] Closed with code:', e.code);
                if (destroyed) return;

                if (e.code === 1000 || e.code === 1001) return; // intentional close — don't reconnect

                // Brief network blip — schedule reconnect with exponential backoff
                if (!navigator.onLine) {
                    // Genuinely offline: don't bother reconnecting yet; the 'online' event
                    // plus the isOnline state will handle recovery
                    console.warn('[WS] Offline — will reconnect when internet returns');
                } else {
                    console.warn(`[WS] Unexpected close — reconnecting in ${retryDelay}ms`);
                    reconnectTimer = setTimeout(() => {
                        retryDelay = Math.min(retryDelay * 2, 8000);
                        connect();
                    }, retryDelay);
                }
            };
        };

        // Reconnect when internet comes back (handles the offline→online transition)
        const handleOnlineForWs = () => {
            if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                console.log('[WS] Internet restored — reconnecting WebSocket');
                retryDelay = 1000;
                connect();
            }
        };
        window.addEventListener('online', handleOnlineForWs);

        connect(); // initial connection

        return () => {
            destroyed = true;
            clearTimeout(reconnectTimer);
            window.removeEventListener('online', handleOnlineForWs);
            const ws = wsRef.current;
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                try { ws.send(JSON.stringify({ type: 'leave', contestId: wsRoomId })); } catch (e) { }
                ws.close(1000, 'Component unmounting');
            }
        };
        // NOTE: handleWebSocketMessage intentionally NOT in deps — we use a ref above.
    }, [contestActive, contest, contestId, contestSubmitted, isPractice]);

    /* —"—"—" Data Fetching —"—"—" */
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
                if (contestData.contest.isSubmitted) {
                    // Contest already submitted — show past-contest view
                    if (contestData.contest.type === 'global' || !contestData.contest.batchId) {
                        navigate(`/contests/${contestData.contest.slug || contestId}/leaderboard`, { replace: true });
                        return;
                    }
                    setContestPast(true);
                    return;
                }
                if (now < start) {
                    // Contest hasn't started yet — redirect to contests list
                    toast(`"${contestData.contest.title}" starts on ${new Date(contestData.contest.startTime).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`, { icon: '', duration: 5000 });
                    navigate(`${basePath}/contests`, { replace: true });
                    return;
                }
                if (now >= start && now <= end) setContestActive(true);
                else if (now > end) {
                    if (contestData.contest.type === 'global' || !contestData.contest.batchId) {
                        // Try to auto-finish if not already submitted (non-blocking)
                        contestService.finishContest(contestId, null).catch(e => { });
                        navigate(`/contests/${contestData.contest.slug || contestId}/leaderboard`, { replace: true });
                        return;
                    }
                    // Show "Contest has ended" info page + leaderboard button
                    // Try to auto-finish if not already submitted (non-blocking)
                    contestService.finishContest(contestId, null).catch(e => { });
                    setContestSubmitted(true);
                    setContestPast(true);
                }
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
        } catch (error) {
            console.error(error);
            // Detect 404 / not-found vs generic error
            const msg = error?.message?.toLowerCase() || '';
            const status = error?.response?.status || error?.status;
            if (status === 404 || msg.includes('not found') || msg.includes('contest not found')) {
                setContestError('not_found');
            } else {
                setContestError('error');
                toast.error('Failed to load contest');
            }
        }
    };

    useEffect(() => {
        const savedMap = localStorage.getItem(`contest_${contestId}_codeMap`);
        if (savedMap) setUserCodeMap(JSON.parse(savedMap));
        fetchContest();
    }, [contestId]);

    // Leaderboard: fetch once when opened. Manual refresh available via the RotateCw button.
    // Polling removed to avoid unnecessary backend calls while the panel stays open.
    useEffect(() => {
        if (!showLeaderboard) return;
        let cancelled = false;
        const fetchLb = async () => {
            setLoadingLeaderboard(true);
            try {
                const d = await contestService.getContestLeaderboard(contestId);
                if (!cancelled) {
                    setLeaderboardData(d.leaderboard || []);
                    if (d.totalParticipants) setTotalParticipants(d.totalParticipants);
                }
            } finally {
                if (!cancelled) setLoadingLeaderboard(false);
            }
        };
        fetchLb();
        return () => { cancelled = true; };
    }, [contestId, showLeaderboard]);

    // (old timer that called handleContestEnd removed — replaced by the ref-safe timer below)

    // —"—"—" Dedicated time-up handler — uses refs only, NO stale closure issues —"—"—"
    // This is kept separate from `handleContestEnd` so the setInterval callback
    // never captures a stale version of the async submission logic.
    const timeUpContestId = useRef(contestId);
    useEffect(() => { timeUpContestId.current = contestId; }, [contestId]);

    useEffect(() => {
        if (!contest || !contestActive || contestSubmitted || isPractice) return;

        const calculateRemaining = () => {
            const now = new Date();
            const end = new Date(contest.endTime);
            return Math.max(0, Math.floor((end - now) / 1000));
        };

        setTimeRemaining(calculateRemaining());

        const interval = setInterval(async () => {
            const remaining = calculateRemaining();
            setTimeRemaining(remaining);

            if (remaining === 0 && !timeUpFiredRef.current) {
                timeUpFiredRef.current = true;
                clearInterval(interval);

                // Guard: skip if already finishing or submitted
                if (finishingRef.current || autoSubmitTriggered.current) return;

                // Add random jitter (1-5 seconds) to prevent thundering herd on backend
                const jitter = Math.floor(Math.random() * 4000) + 1000;
                toast(`⏱ Time up! Submitting in ${Math.round(jitter / 1000)}s...`);

                setTimeout(async () => {
                    // Re-check guard inside timeout
                    if (finishingRef.current || autoSubmitTriggered.current) return;

                    autoSubmitTriggered.current = true;
                    setFinishing(true);
                    finishingRef.current = true;

                    try {
                        const result = await contestService.finishContest(timeUpContestId.current, violationsRef.current);
                        const clientScore = calcClientScore(contestRef.current, lockedProblemsRef.current);
                        toast.success(`Contest submitted! Final Score: ${clientScore}`);
                        setContestSubmitted(true);
                        setContestActive(false);
                        localStorage.removeItem(`contest_${timeUpContestId.current}_codeMap`);
                        setFinishing(false);
                        finishingRef.current = false;
                        // Navigate — read fresh user/navigate from refs, never stale
                        setTimeout(() => {
                            navigateRef.current(`/contests/${contest?.slug || timeUpContestId.current}/leaderboard`, { replace: true });
                        }, 2000);
                    } catch (error) {
                        toast.error(error.message || 'Time-up submission failed. Please use Finish button.');
                        setFinishing(false);
                        finishingRef.current = false;
                        autoSubmitTriggered.current = false;
                        timeUpFiredRef.current = false; // allow retry via button
                    }
                }, jitter);
            }
        }, 1000);
        return () => clearInterval(interval);

    }, [contest, contestActive, contestSubmitted, isPractice]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Internet connection restored!', { icon: '✅' });
        };
        const handleOffline = () => {
            // Immediately cancel any in-progress execution
            if (executionTimeoutRef.current) clearTimeout(executionTimeoutRef.current);
            setIsOnline(false);
            setRunning(false);
            setSubmitting(false);
            setRunningMap({});
            setSubmittingMap({});
            setConsoleOutput({ type: 'error', message: 'No internet connection. Please check your network and try again.' });
            setBottomTab('results');
            toast.error('No internet connection!', { duration: 5000, icon: '📶' });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* —"—"—" Handlers —"—"—" */
    const handleProblemChange = (problem, isInit = false) => {
        if (!isInit && !isPractice && contestSubmitted) return toast.error('Contest submitted');

        // Save current problem's results before switching
        if (selectedProblem) {
            setConsoleOutputMap(prev => ({ ...prev, [selectedProblem._id]: consoleOutput }));
        }

        // Save current problem code state if exists
        if (selectedProblem && !lockedProblems.has(selectedProblem._id)) {
            const problemData = userCodeMap[selectedProblem._id] || {};
            const updatedCodes = { ...problemData.codes, [currentLang]: currentCode };
            const updated = {
                ...userCodeMap,
                [selectedProblem._id]: {
                    ...problemData,
                    codes: updatedCodes,
                    lastLang: currentLang
                }
            };
            setUserCodeMap(updated);
            localStorage.setItem(`contest_${contestId}_codeMap`, JSON.stringify(updated));
        }

        // Load new problem state
        const savedMap = JSON.parse(localStorage.getItem(`contest_${contestId}_codeMap`) || '{}');
        const savedProblemData = savedMap[problem._id];
        
        let savedLang = 'cpp';
        let savedCode = DEFAULT_CODE['cpp'];

        if (savedProblemData) {
            if (savedProblemData.codes) {
                // New format: codes: { lang: code }, lastLang: string
                savedLang = savedProblemData.lastLang || 'cpp';
                savedCode = savedProblemData.codes[savedLang] || DEFAULT_CODE[savedLang];
            } else if (savedProblemData.code && savedProblemData.lang) {
                // Backward compatibility: { code: string, lang: string }
                savedLang = savedProblemData.lang;
                savedCode = savedProblemData.code;
            }
        }

        setCurrentCode(savedCode);
        setCurrentLang(savedLang);
        setSelectedProblem(problem);
        setSampleTestCases(problem.testCases?.filter(tc => !tc.isHidden) || []);

        // Restore this problem's saved results (if any), else clear
        setConsoleOutputMap(prev => {
            const savedResult = prev[problem._id] ?? null;
            setConsoleOutput(savedResult);
            return prev;
        });

        // Switch tab based on whether there are saved results
        setConsoleOutputMap(prev => {
            const hasSaved = !!prev[problem._id];
            setBottomTab(hasSaved ? 'results' : 'testcases');
            return prev;
        });

        setActiveInputCase(0);
        setActiveResultCase(0);
        setActiveTestCaseId('case-0');
        setCustomTestCases([]);
        setShowEditorial(false);

        // Restore running/submitting state for this specific problem
        setRunningMap(prev => {
            setRunning(prev[problem._id] || false);
            return prev;
        });
        setSubmittingMap(prev => {
            setSubmitting(prev[problem._id] || false);
            return prev;
        });

        localStorage.setItem(`contest_${contestId}_lastProblem`, problem._id);
    };

    const handleLangChange = (e) => {
        if ((isProblemLocked || contestSubmitted) && !isPractice) return;
        const newLang = e.target.value;
        const oldLang = currentLang;
        const oldCode = currentCode;

        setCurrentLang(newLang);

        if (selectedProblem) {
            let savedMap = {};
            try { savedMap = JSON.parse(localStorage.getItem(`contest_${contestId}_codeMap`) || '{}'); } catch { }
            
            const problemData = savedMap[selectedProblem._id] || {};
            
            // Handle legacy format upgrade if needed
            const codes = problemData.codes || {};
            if (!problemData.codes && problemData.code && problemData.lang) {
                codes[problemData.lang] = problemData.code;
            }
            
            // Save current code for the OLD language
            codes[oldLang] = oldCode;
            
            // Determine the code for the NEW language
            const newCode = codes[newLang] || DEFAULT_CODE[newLang];
            setCurrentCode(newCode);

            const updatedProblemData = {
                ...problemData,
                codes: codes,
                lastLang: newLang
            };
            
            const updatedMap = {
                ...savedMap,
                [selectedProblem._id]: updatedProblemData
            };
            
            setUserCodeMap(updatedMap);
            localStorage.setItem(`contest_${contestId}_codeMap`, JSON.stringify(updatedMap));
        } else {
            setCurrentCode(DEFAULT_CODE[newLang]);
        }
    };

    const activeProblemIdRef = useRef(null);
    useEffect(() => { activeProblemIdRef.current = selectedProblem?._id; }, [selectedProblem?._id]);

    const handleExecutionResult = useCallback((result) => {
        if (executionTimeoutRef.current) clearTimeout(executionTimeoutRef.current);
        // Only accept execution results for the active problem
        const targetId = result.problemId;
        if (targetId && targetId !== activeProblemIdRef.current) {
            // Store result for that problem but don't display it
            if (result.isError) {
                setRunningMap(prev => ({ ...prev, [targetId]: false }));
                setSubmittingMap(prev => ({ ...prev, [targetId]: false }));
            } else if (result.isRun) {
                setRunningMap(prev => ({ ...prev, [targetId]: false }));
            } else {
                setSubmittingMap(prev => ({ ...prev, [targetId]: false }));
            }
            return;
        }

        // Always clear per-problem running flags for the active problem,
        // using either the result's problemId or the current active problem (whichever available).
        const clearId = targetId || activeProblemIdRef.current;
        if (clearId) {
            setRunningMap(prev => ({ ...prev, [clearId]: false }));
            setSubmittingMap(prev => ({ ...prev, [clearId]: false }));
        }

        if (result.isError) {
            setRunning(false);
            setSubmitting(false);
            setConsoleOutput({ type: 'compilation', message: result.message || 'Execution failed' });
            return;
        }

        if (result.isRun) {
            setRunning(false);
            const firstResult = result.results?.[0];
            if (firstResult?.verdict === 'Compilation Error') {
                const errMsg = firstResult.error || result.error || 'Compilation Error in your code';
                setConsoleOutput({ type: 'compilation', message: errMsg });
            } else {
                setConsoleOutput({ type: 'run', data: result.results });
            }
            return;
        }

        // Must be a submit
        setSubmitting(false);

        const verdict = result.submission?.verdict;
        if (verdict === 'Compilation Error') {
            const errMsg = result.results?.find(r => r.verdict === 'Compilation Error')?.error
                || result.results?.[0]?.error
                || result.error
                || 'Compilation Error in your code';
            setConsoleOutput({ type: 'compilation', message: errMsg });
            toast.error('Compilation Error');
            return;
        }

        if (result.isPractice) {
            const practiceFirstResult = result.results?.[0];
            if (practiceFirstResult?.verdict === 'Compilation Error') {
                setConsoleOutput({ type: 'compilation', message: practiceFirstResult.error || 'Compilation Error' });
                toast.error('Compilation Error');
                return;
            }
            setConsoleOutput({ type: 'run', data: result.results });
            if (verdict === 'Accepted' || result.submission?.verdict === 'Accepted') {
                toast.success('Practice: All Test Cases Passed!', { duration: 3000 });
            } else {
                toast.error(`Practice: ${verdict || result.submission?.verdict}`, { duration: 3000 });
            }
        } else {
            setConsoleOutput({ type: 'submit', submission: result.submission, data: result.results });
        }

        if (result.submission?.verdict === 'Accepted' || verdict === 'Accepted') {
            if (!result.isPractice) {
                toast.success('🎉 Problem Solved!');
                const newLocked = new Set([...lockedProblems, selectedProblem._id]);
                setLockedProblems(newLocked);
                setUserSubmissions(prev => ({ ...prev, [selectedProblem._id]: 'Accepted' }));

                const savedMap = JSON.parse(localStorage.getItem(`contest_${contestId}_codeMap`) || '{}');
                delete savedMap[selectedProblem._id];
                localStorage.setItem(`contest_${contestId}_codeMap`, JSON.stringify(savedMap));

                const allSolved = newLocked.size >= contest?.problems?.length;
                if (allSolved) {
                    setTimeout(() => {
                        toast.success('🏆 All problems completed! Finishing contest...', { duration: 4000 });
                        handleFinishContest(true);
                    }, 2500);
                } else {
                    const currentIndex = contest.problems.findIndex(p => p._id === selectedProblem._id);
                    let nextProblem = null;
                    for (let i = currentIndex + 1; i < contest.problems.length; i++) {
                        if (!newLocked.has(contest.problems[i]._id)) {
                            nextProblem = contest.problems[i];
                            break;
                        }
                    }
                    if (!nextProblem) {
                        nextProblem = contest.problems.find(p => !newLocked.has(p._id));
                    }
                    if (nextProblem) {
                        setTimeout(() => {
                            toast(
                                <span className="flex items-center gap-1.5">Moving to next problem.. <MdOutlineArrowForward size={15} /></span>
                            );
                            handleProblemChange(nextProblem);
                        }, 2500);
                    }
                }
            } else {
                const savedMap = JSON.parse(localStorage.getItem(`contest_${contestId}_codeMap`) || '{}');
                delete savedMap[selectedProblem._id];
                localStorage.setItem(`contest_${contestId}_codeMap`, JSON.stringify(savedMap));
            }
        } else if (!result.isPractice) {
            toast.error(result.submission?.verdict || 'Wrong Answer');
        }

        if (!result.isPractice) {
            contestService.getContestLeaderboard(contestId)
                .then(lb => setLeaderboardData(lb.leaderboard || []))
                .catch(() => { });
        }
    }, [contest, contestId, handleFinishContest, lockedProblems, selectedProblem]);

    useEffect(() => {
        handleExecutionResultRef.current = handleExecutionResult;
    }, [handleExecutionResult]);

    const handleRun = async () => {
        if (!isOnline) return toast.error('You are offline. Please check your internet connection.');
        if ((contestSubmitted || isProblemLocked) && !isPractice) return;
        if (!currentCode.trim()) return toast.error('Code cannot be empty');
        if (!isPractice && !document.fullscreenElement && contest?.proctoringEnabled) enterFullscreen();

        const probId = selectedProblem._id;
        setRunning(true);
        setRunningMap(prev => ({ ...prev, [probId]: true }));
        setBottomTab('results');
        setEditorTopH(40);
        setResultsAnimKey(k => k + 1);
        setActiveResultCase(0);
        setConsoleOutput(null);

        if (executionTimeoutRef.current) clearTimeout(executionTimeoutRef.current);
        executionTimeoutRef.current = setTimeout(() => {
            setRunning(false);
            setRunningMap(prev => ({ ...prev, [probId]: false }));
            if (!navigator.onLine) {
                setIsOnline(false);
                setIsExecutionOffline(true);
                setConsoleOutput({ type: 'offline', message: 'No internet connection. Please check your network and try again.' });
                toast.error('No internet connection!', { duration: 5000, icon: '📶' });
            } else {
                setIsExecutionOffline(false);
                setConsoleOutput({ type: 'error', message: 'No response. Please check your connection or try again.' });
            }
        }, 14000); // 14s = just past the 12s axios timeout

        try {
            // Build combined list: sample cases + all custom cases (same pattern as CodeEditor)
            const allCasesToRun = [
                ...sampleTestCases.map(tc => ({
                    input: tc.input,
                    expectedOutput: tc.output ?? null,
                    isCustom: false
                })),
                ...customTestCases.map(cc => ({
                    input: cc.input,
                    expectedOutput: null,
                    isCustom: true
                }))
            ];

            const hasAnyCustom = customTestCases.length > 0;
            const result = await contestService.runContestCode(contestId, {
                problemId: probId,
                code: currentCode,
                language: currentLang,
                isPractice,
                // If there are custom cases, send full combined list; otherwise run sample-only via queue
                customInputs: hasAnyCustom ? allCasesToRun : undefined
            });

            if (result.isProcessing) return; // Wait for WS result
            if (executionTimeoutRef.current) clearTimeout(executionTimeoutRef.current);
            handleExecutionResult({ ...result, isRun: true, problemId: probId });
        } catch (error) {
            if (executionTimeoutRef.current) clearTimeout(executionTimeoutRef.current);
            setRunning(false);
            setRunningMap(prev => ({ ...prev, [probId]: false }));
            // Detect network failure by error code OR by browser online status
            const isNetErr = !navigator.onLine ||
                error?.code === 'ERR_NETWORK' ||
                error?.code === 'ECONNABORTED' ||
                error?.message === 'Network Error' ||
                error?.message?.toLowerCase().includes('timeout');
            if (isNetErr) {
                if (!navigator.onLine) setIsOnline(false);
                setIsExecutionOffline(true);
                setConsoleOutput({ type: 'offline', message: 'No internet connection. Please check your network and try again.' });
                toast.error('No internet connection!', { duration: 5000, icon: '📶' });
            } else {
                setIsExecutionOffline(false);
                setConsoleOutput({ type: 'error', message: error.message || 'Execution failed. Please try again.' });
            }
        }
    };

    const handleSubmit = async () => {
        if (!isOnline) return toast.error('You are offline. Please check your internet connection.');
        if ((contestSubmitted || isProblemLocked) && !isPractice) return;
        if (!currentCode.trim()) return toast.error('Code cannot be empty');

        const violationData = getViolationSummary();
        if (violationData.shouldAutoSubmit) return handleMaxViolations();

        const probId = selectedProblem._id;
        setSubmitting(true);
        setSubmittingMap(prev => ({ ...prev, [probId]: true }));
        setBottomTab('results');
        setEditorTopH(40);
        setResultsAnimKey(k => k + 1);
        setActiveResultCase(0);
        setConsoleOutput(null);

        if (executionTimeoutRef.current) clearTimeout(executionTimeoutRef.current);
        executionTimeoutRef.current = setTimeout(() => {
            setSubmitting(false);
            setSubmittingMap(prev => ({ ...prev, [probId]: false }));
            if (!navigator.onLine) {
                setIsOnline(false);
                setIsExecutionOffline(true);
                setConsoleOutput({ type: 'offline', message: 'No internet connection. Please check your network and try again.' });
                toast.error('No internet connection!', { duration: 5000, icon: '📶' });
            } else {
                setIsExecutionOffline(false);
                setConsoleOutput({ type: 'error', message: 'No response from server. Please check your connection or try again.' });
            }
        }, 14000); // 14s = just past the 12s axios timeout

        try {
            const result = await contestService.submitContestCode(contestId, {
                problemId: probId,
                code: currentCode,
                language: currentLang,
                ...violationData,
                isAutoSubmit: false,
                isPractice
            });

            if (result.isProcessing) return; // Wait for WS result
            if (executionTimeoutRef.current) clearTimeout(executionTimeoutRef.current);
            handleExecutionResult({ ...result, problemId: probId });
        } catch (error) {
            if (executionTimeoutRef.current) clearTimeout(executionTimeoutRef.current);
            setSubmitting(false);
            setSubmittingMap(prev => ({ ...prev, [probId]: false }));
            if (error.shouldAutoSubmit) handleMaxViolations();
            else {
                const isNetErr = !navigator.onLine ||
                    error?.code === 'ERR_NETWORK' ||
                    error?.code === 'ECONNABORTED' ||
                    error?.message === 'Network Error' ||
                    error?.message?.toLowerCase().includes('timeout');

                if (isNetErr) {
                    if (!navigator.onLine) setIsOnline(false);
                    setIsExecutionOffline(true);
                    setConsoleOutput({ type: 'offline', message: 'No internet connection. Please check your network and try again.' });
                    toast.error('No internet connection!', { duration: 5000, icon: '📶' });
                } else {
                    setIsExecutionOffline(false);
                    const msg = error.message || 'Submission failed';
                    setConsoleOutput({ type: 'error', message: msg });
                    toast.error(msg);
                }
            }
        }
    };


    /* —"—"—" Sorting & CSV —"—"—" */
    const handleSort = (key) => {
        let direction = 'desc'; // Default desc for score/solved
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        } else if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    const sortedLeaderboardData = (() => {
        if (!leaderboardData) return [];
        let data = [...leaderboardData];

        const parseTime = (val) => {
            if (!val) return 0;
            const parsed = parseInt(String(val).replace('m', ''));
            return isNaN(parsed) ? 0 : parsed;
        };

        // 1. First, always sort by score (desc), then time (asc) to assign global ranks
        data.sort((a, b) => {
            const scoreA = parseFloat(a.score) || 0;
            const scoreB = parseFloat(b.score) || 0;
            if (scoreA !== scoreB) return scoreB - scoreA;

            const timeA = parseTime(a.time);
            const timeB = parseTime(b.time);
            return timeA - timeB; // lower time is better
        });

        // 2. Stamp the proper rank based on this internal sorting
        let rankedData = data.map((entry, index) => ({
            ...entry,
            rank: index + 1
        }));

        // 3. Apply arbitrary user sorting config
        if (sortConfig.key) {
            rankedData.sort((a, b) => {
                let aValue = sortConfig.key === 'status' ? (a.isCompleted ? 1 : 0) : a[sortConfig.key];
                let bValue = sortConfig.key === 'status' ? (b.isCompleted ? 1 : 0) : b[sortConfig.key];

                if (sortConfig.key === 'score' || sortConfig.key === 'problemsSolved') {
                    aValue = parseFloat(aValue);
                    bValue = parseFloat(bValue);
                }

                // String sorting for username/time if needed (time is string "XXm")
                if (sortConfig.key === 'time') {
                    aValue = parseInt(String(aValue).replace('m', ''));
                    bValue = parseInt(String(bValue).replace('m', ''));
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return rankedData;
    })();

    const totalPages = Math.ceil(sortedLeaderboardData.length / itemsPerPage) || 1;
    const paginatedData = sortedLeaderboardData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const downloadCSV = () => {
        if (!sortedLeaderboardData.length) return;

        // Dynamic headers for problems
        const problemHeaders = contest?.problems?.map((p, i) => `P${i + 1} (${p.title})`) || [];
        const baseHeaders = ['Rank', 'Roll No', 'Full Name', 'Username', 'Branch', ...problemHeaders, 'Solved', 'Time'];
        const proctoringHeaders = contest?.proctoringEnabled ? ['Tab Switches', 'FS Exits', 'Violations'] : [];
        const tailHeaders = ['Status', 'Score'];
        const headers = [...baseHeaders, ...proctoringHeaders, ...tailHeaders];

        const rows = sortedLeaderboardData.map((entry, index) => {
            // Problem statuses
            const problemStatuses = contest?.problems?.map(p => {
                const pData = entry.problems?.[p._id];
                let statusStr = pData?.status || 'Not Attempted';
                if (pData?.submittedAt !== undefined && pData?.submittedAt !== null) {
                    statusStr += ` (${pData.submittedAt}m)`;
                }
                return statusStr;
            }) || [];

            // Fix for "1/2" turning into date: wrap in ="..." formula for Excel or prepend '
            const solvedCount = `${entry.problemsSolved}/${contest?.problems?.length || 0}`;
            const solvedCell = `="${solvedCount}"`;

            const baseRow = [
                index + 1,
                entry.rollNumber || 'N/A',
                entry.fullName !== 'N/A' ? entry.fullName : entry.username,
                (entry.isSpotUser || entry.username?.startsWith('spot_')) ? '-' : entry.username,
                entry.branch || 'N/A',
                ...problemStatuses,
                solvedCell,
                entry.time
            ];

            const proctoringRow = [];
            if (contest?.proctoringEnabled) {
                const ts = entry.tabSwitchCount || 0;
                const fse = entry.fullscreenExits || 0;
                proctoringRow.push(ts, fse, ts + fse);
            }

            const tailRow = [
                entry.isCompleted ? 'Finished' : 'In Progress',
                entry.score
            ];

            return [...baseRow, ...proctoringRow, ...tailRow];
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

    /* —"—"—" Drag Logic (useEffect-based for smooth resize like CodeEditor) —"—"—" */
    const onMouseMoveResize = useCallback((e) => {
        const d = dragging.current;
        if (!d || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (d.type === 'sidebar') {
            const newW = d.startVal + ((e.clientX - d.startX) / rect.width) * 100;
            setSidebarW(Math.min(45, Math.max(10, newW)));
        } else if (d.type === 'desc') {
            const newW = d.startVal + ((e.clientX - d.startX) / rect.width) * 100;
            setDescW(Math.min(70, Math.max(15, newW)));
        } else if (d.type === 'editorH') {
            const newH = d.startVal + ((e.clientY - d.startY) / rect.height) * 100;
            setEditorTopH(Math.min(90, Math.max(10, newH)));
        }
    }, [isResizing]);

    const onMouseUpResize = useCallback(() => {
        dragging.current = null;
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', onMouseMoveResize);
            window.addEventListener('mouseup', onMouseUpResize);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMoveResize);
            window.removeEventListener('mouseup', onMouseUpResize);
        };
    }, [isResizing, onMouseMoveResize, onMouseUpResize]);

    const startDrag = (type, e) => {
        e.preventDefault();
        setIsResizing(true);
        document.body.style.cursor = type === 'editorH' ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';

        let startVal;
        if (type === 'sidebar') startVal = sidebarW;
        else if (type === 'desc') startVal = descW;
        else startVal = editorTopH;

        dragging.current = {
            type,
            startX: e.clientX,
            startY: e.clientY,
            startVal,
        };
    };

    const formatTime = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    // Render Helpers
    // —"—" Past Contest View (contest has ended, show info + leaderboard button) —"—"
    if (contestPast && contest && !contestActive) {
        const durationMs = new Date(contest.endTime) - new Date(contest.startTime);
        const durationHrs = Math.floor(durationMs / 3600000);
        const durationMins = Math.floor((durationMs % 3600000) / 60000);
        const durationStr = durationHrs > 0
            ? `${durationHrs} hr${durationHrs > 1 ? 's' : ''} ${durationMins > 0 ? durationMins + ' min' : ''}`
            : `${durationMins} min`;
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Minimal header */}
                <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4 shadow-sm">
                    <img src="/alphalogo.png" alt="AlphaKnowledge" className="h-8 w-auto object-contain" />
                    <span className="font-bold text-gray-700 text-sm">AlphaKnowledge</span>
                    <div className="ml-auto">
                        <button
                            onClick={() => navigate(`${basePath}/contests`)}
                            className="text-sm text-gray-500 hover:text-gray-700 transition flex items-center gap-1.5"
                        >
                            ← Back to Contests
                        </button>
                    </div>
                </header>

                <div className="flex-1 flex flex-col items-center justify-center p-6">
                    {/* Contest ended card */}
                    <div className="card w-full max-w-3xl">
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="bg-gray-700 text-white text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wider">PAST</span>
                                    <span className="text-sm text-gray-500">{contest.type === 'global' ? 'Global Contest' : 'Internal Assessment'}</span>
                                </div>
                                <h1 className="text-2xl font-bold text-gray-900">{contest.title}</h1>
                                {contestSubmitted && (
                                    <p className="text-sm text-gray-500 mt-1.5">Contest has ended</p>
                                )}
                            </div>
                            <button
                                onClick={() => setShowLeaderboard(true)}
                                className="btn btn-primary shrink-0 flex items-center gap-2"
                            >
                                <Trophy size={16} />
                                View Leaderboard
                            </button>
                        </div>

                        {/* Stats row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-t border-b border-gray-100 mb-4">
                            <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase font-medium mb-1">Total Problems</div>
                                <div className="text-2xl font-bold text-gray-900">{contest.problems?.length || 0}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase font-medium mb-1">Contest Duration</div>
                                <div className="text-lg font-bold text-gray-900">{durationStr}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase font-medium mb-1">Start Time</div>
                                <div className="text-sm font-semibold text-gray-900">{new Date(contest.startTime).toLocaleString()}</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase font-medium mb-1">End Time</div>
                                <div className="text-sm font-semibold text-gray-900">{new Date(contest.endTime).toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Description / instructions */}
                        {contest.description && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Description</h3>
                                <p className="text-gray-600 text-sm leading-relaxed">{contest.description}</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        );
    }

    if (!contest) {
        // Show "not found" or generic error when fetch has completed
        if (contestError) {
            return (
                <div className="flex flex-col h-screen items-center justify-center bg-gray-50">
                    <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-100 max-w-md w-full mx-4 text-center">
                        <AlertTriangle className="w-14 h-14 text-red-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">
                            {contestError === 'not_found' ? 'Contest Not Found' : 'Unable to Load Contest'}
                        </h2>
                        <p className="text-gray-500 mb-6 text-sm">
                            {contestError === 'not_found'
                                ? 'This contest does not exist or may have been removed.'
                                : 'Something went wrong while loading the contest. Please try again.'}
                        </p>
                        <button
                            onClick={() => navigate(`${basePath}/contests`)}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium text-sm"
                        >
                            Back to Contests
                        </button>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-gray-50 text-gray-600 gap-3">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <p className="font-medium">Loading Contest...</p>
            </div>
        );
    }

    const isProblemLocked = selectedProblem && lockedProblems.has(selectedProblem._id);
    const violationSummary = getViolationSummary();

    // Result Logic
    const isCompileErr = consoleOutput?.type === 'compilation' || (consoleOutput?.type === 'error' && !isExecutionOffline);
    const displayResult = consoleOutput?.type === 'run'
        ? {
            verdict: consoleOutput.data?.every(r => r.passed) ? 'Accepted' : 'Wrong Answer', results: consoleOutput.data, isRun: true,
            testCasesPassed: consoleOutput.data?.filter(r => r.passed).length ?? 0,
            totalTestCases: consoleOutput.data?.length ?? 0
        }
        : consoleOutput?.type === 'submit'
            ? {
                verdict: consoleOutput.submission.verdict,
                results: consoleOutput.data,
                isRun: false,
                isSubmitMode: true,
                testCasesPassed: consoleOutput.submission?.testCasesPassed ?? consoleOutput.data?.filter(r => r.passed).length ?? 0,
                totalTestCases: consoleOutput.submission?.totalTestCases ?? consoleOutput.data?.length ?? 0,
                error: consoleOutput.submission?.error || null
            }
            : null;

    const runAllPassed = displayResult?.isRun && displayResult?.results?.every(r => r.passed);
    const showGreenVerdict = displayResult?.verdict === 'Accepted' || runAllPassed;

    const solvedCount = contest?.problems?.filter(p => userSubmissions[p._id] === 'Accepted').length || 0;

    return (
        <div className="flex flex-col h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden relative" ref={containerRef}>
            {/* Resizing Overlay - Captures events over iframes/editor */}
            {isResizing && (
                <div
                    className="fixed inset-0 z-[9999]"
                    style={{
                        cursor: dragging.current?.type === 'editorH' ? 'row-resize' : 'col-resize'
                    }}
                />
            )}

            {/* —"—"—" Minimal Header —"—"—" */}
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
                {(!contestSubmitted && !isPractice && timeRemaining !== null) && (
                    <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-1.5 rounded-full border ${timeRemaining < 300 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                        <Clock size={14} />
                        <span className="font-mono font-bold text-sm tracking-widest">{formatTime(timeRemaining)}</span>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    {/* Live participant count removed — distributed count not reliable across instances
                    {!isPractice && (
                        <div className="flex items-center gap-3 text-xs text-gray-500 border-r border-gray-200 pr-4 mr-1">
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="font-medium text-emerald-700">{liveParticipants}</span>
                                <span className="text-gray-400">online</span>
                                {totalParticipants > 0 && (
                                    <>
                                        <span className="text-gray-300">/</span>
                                        <span>{totalParticipants} enrolled</span>
                                    </>
                                )}
                            </span>
                            {contest?.proctoringEnabled && (
                                <span className={`flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-full border ${violationSummary.totalViolations === 0
                                    ? 'text-green-600 bg-green-50 border-green-100'
                                    : violationSummary.isNearLimit
                                        ? 'text-red-600 bg-red-50 border-red-200 animate-pulse'
                                        : 'text-amber-600 bg-amber-50 border-amber-200'
                                    }`}>
                                    <AlertTriangle size={10} />
                                    {violationSummary.totalViolations}/{contest?.maxViolations || 5}
                                </span>
                            )}
                        </div>
                    )}
                    */}
                    {/* Violations counter (kept) */}
                    {!isPractice && contest?.proctoringEnabled && (
                        <div className="flex items-center gap-3 text-xs text-gray-500 border-r border-gray-200 pr-4 mr-1">
                            <span className={`flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-full border ${violationSummary.totalViolations === 0
                                ? 'text-green-600 bg-green-50 border-green-100'
                                : violationSummary.isNearLimit
                                    ? 'text-red-600 bg-red-50 border-red-200 animate-pulse'
                                    : 'text-amber-600 bg-amber-50 border-amber-200'
                                }`}>
                                <AlertTriangle size={10} />
                                {violationSummary.totalViolations}/{contest?.maxViolations || 5}
                            </span>
                        </div>
                    )}

                    {!isPractice && (
                        <button onClick={() => setShowLeaderboard(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                            <Layout size={14} /> Leaderboard
                        </button>
                    )}
                    {(!contestSubmitted && !isPractice && timeRemaining !== null) && (
                        <button
                            onClick={() => handleFinishContest(false)}
                            disabled={finishing || timeRemaining <= 0}
                            className="flex items-center gap-2 px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition-all text-xs font-bold shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {(finishing || timeRemaining <= 0) ? (
                                <>
                                    <Loader2 size={13} className="animate-spin" />
                                    Submitting...
                                </>
                            ) : 'Finish Contest'}
                        </button>
                    )}
                    {isPractice && (
                        <div className="flex items-center gap-3">
                            <span className="bg-indigo-50 text-indigo-600 text-[10px] px-2.5 py-1 rounded-full font-bold border border-indigo-100 uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                                Practice Mode
                            </span>
                            <button
                                onClick={() => navigate(`${basePath}/contests`)}
                                className="group flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-red-50 text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg transition-all duration-200 text-xs font-bold shadow-sm"
                            >
                                <IoCloseCircleOutline size={16} className="group-hover:scale-110 transition-transform" />
                                Exit Practice
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* —"—" Main 3—column area —"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—"—" */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* —" Col 1: Sidebar —" */}
                <div
                    style={{
                        width: showSidebar ? `${sidebarW}%` : `${COLLAPSED_SIDEBAR_WIDTH}px`,
                        transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    }}
                    className="relative flex flex-col shrink-0 border-r border-gray-200 bg-white z-20"
                >
                    <div className="flex-1 overflow-hidden flex flex-col relative h-full">
                        <div className={`flex-1 flex flex-col overflow-hidden h-full transition-opacity duration-300 ${showSidebar ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none hidden'}`}>
                            {/* Header (Problems/Status) */}
                            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/40 shrink-0 flex items-center justify-between">
                                <h2 className="text-gray-900 font-bold flex items-center gap-2 text-[15px]">
                                    <List size={16} className="text-gray-400" />
                                    Problems ({solvedCount}/{contest?.problems?.length || 0})
                                </h2>
                                {isPractice && (
                                    <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded border border-blue-200 uppercase font-bold tracking-wide flex items-center gap-1">
                                        Practice
                                    </span>
                                )}
                            </div>

                            {/* Problem List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1 bg-gray-50">
                                {contest?.problems?.map((p, i) => {
                                    const status = userSubmissions[p._id];
                                    const isActive = selectedProblem?._id === p._id;
                                    const isLocked = !isPractice && lockedProblems.has(p._id);
                                    const isSolved = status === 'Accepted';

                                    return (
                                        <button
                                            key={p._id}
                                            onClick={() => !isLocked && handleProblemChange(p)}
                                            disabled={isLocked}
                                            className={`w-full text-left p-3 rounded-xl transition-all border flex gap-3 ${isLocked
                                                ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed pointer-events-none'
                                                : isActive
                                                    ? (isSolved ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-500/20')
                                                    : isSolved
                                                        ? 'bg-white border-gray-200 hover:border-emerald-300'
                                                        : 'bg-white border-transparent hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-bold text-sm shadow-sm border ${isActive
                                                ? (isSolved ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-blue-100 text-blue-700 border-blue-200')
                                                : isSolved
                                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                                    : 'bg-gray-100 border-gray-200 text-gray-500'
                                                }`}>
                                                {String.fromCharCode(65 + i)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate flex items-center gap-1.5 ${isActive
                                                    ? (isSolved ? 'text-emerald-800' : 'text-gray-900')
                                                    : isSolved
                                                        ? 'text-emerald-700'
                                                        : 'text-gray-600'
                                                    }`}>
                                                    <span className="truncate">{p.title}</span>
                                                    {isLocked && (
                                                        <span title="Problem Locked — Solved!" className="shrink-0 inline-flex">
                                                            <CiLock
                                                                size={14}
                                                                style={{
                                                                    color: '#c8922a',
                                                                    filter: 'drop-shadow(0 0 2px rgba(212,160,23,0.6))',
                                                                    strokeWidth: 0.5
                                                                }}
                                                            />
                                                        </span>
                                                    )}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[10px] font-bold ${p.difficulty === 'Easy' ? 'text-emerald-600' :
                                                        p.difficulty === 'Medium' ? 'text-amber-600' : 'text-rose-600'}`}>
                                                        {p.difficulty}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">•</span>
                                                    <span className="text-[10px] text-gray-400">{p.points} pts</span>
                                                    {isSolved && (
                                                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                                                            ✓ Solved
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {!showSidebar && (
                            <div
                                className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors"
                                onClick={() => setShowSidebar(true)}
                            >
                                <div style={{ writingMode: 'vertical-rl' }} className="text-[10px] font-bold text-gray-400 tracking-widest uppercase select-none">
                                    <span className="rotate-180">Problems List</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Toggle tab — vertically centered on right edge */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowSidebar(!showSidebar); }}
                        className="absolute -right-[14px] top-1/2 -translate-y-1/2 z-50 w-[14px] h-14 bg-white border border-l-0 border-gray-200 rounded-r-lg shadow-md flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                        title={showSidebar ? 'Close Problem List' : 'Open Problem List'}
                    >
                        {showSidebar ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                    </button>
                </div>

                {showSidebar && <DragHandleH onMouseDown={(e) => startDrag('sidebar', e)} />}

                {/* —" Col 2: Description / Editorial —" */}
                <div style={{ width: `${descW}%` }} className="flex flex-col overflow-hidden shrink-0 border-r border-gray-200 bg-white">

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
                                <div className="prose prose-sm max-w-none font-problem">
                                    <h2 className="text-xl font-bold text-gray-900 mb-6 font-sans">{selectedProblem.title} - Editorial</h2>

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
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 mb-2 font-sans">{selectedProblem.title}</h2>
                                        <div className="flex flex-wrap gap-2 font-sans">
                                            <DiffBadge d={selectedProblem.difficulty} />
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#92400e', background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid #fcd34d', padding: '2px 7px', borderRadius: 20 }}>
                                                <Coins size={10} color="#f59e0b" /> {selectedProblem.points} pts
                                            </span>
                                        </div>
                                    </div>

                                    <div className="prose max-w-none text-gray-700 font-problem prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-p:leading-relaxed prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-1 prose-code:rounded">
                                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MarkdownComponents}>
                                            {cleanDescription(selectedProblem.description)}
                                        </ReactMarkdown>
                                    </div>

                                    {selectedProblem.constraints?.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Constraints</h3>
                                            <ul className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1">
                                                {selectedProblem.constraints.map((c, i) => (
                                                    <li key={i} className="text-xs font-mono text-gray-700 list-disc list-inside">{c}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {selectedProblem.inputFormat && (
                                        <div>
                                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Input Format</h3>
                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 prose prose-sm max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MarkdownComponents}>
                                                    {selectedProblem.inputFormat}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    )}

                                    {selectedProblem.outputFormat && (
                                        <div>
                                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Output Format</h3>
                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 prose prose-sm max-w-none">
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MarkdownComponents}>
                                                    {selectedProblem.outputFormat}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    )}

                                    {selectedProblem.examples?.map((ex, i) => (
                                        <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
                                            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 uppercase tracking-wide">
                                                Example {i + 1}
                                            </div>
                                            <div className="p-4 space-y-3 bg-white">
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Input</p>
                                                    <pre className="bg-gray-50 border border-gray-200 rounded p-2 text-xs font-mono text-gray-800 whitespace-pre-wrap">{ex.input}</pre>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Output</p>
                                                    <pre className="bg-gray-50 border border-gray-200 rounded p-2 text-xs font-mono text-gray-800 whitespace-pre-wrap">{ex.output}</pre>
                                                </div>
                                                {ex.explanation && (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Explanation</p>
                                                        <p className="text-xs text-gray-600 bg-blue-50 rounded p-2 border border-blue-100">{ex.explanation}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {selectedProblem.edgeCases?.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Edge Cases</h3>
                                            <ul className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1">
                                                {selectedProblem.edgeCases.map((c, i) => (
                                                    <li key={i} className="text-xs font-mono text-gray-700 list-disc list-inside">{c}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {(selectedProblem.timeComplexity || selectedProblem.spaceComplexity) && (
                                        <div>
                                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Complexity</h3>
                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                                                {selectedProblem.timeComplexity && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-gray-500 uppercase">Time:</span>
                                                        <span className="text-sm font-mono text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-sm">{selectedProblem.timeComplexity}</span>
                                                    </div>
                                                )}
                                                {selectedProblem.spaceComplexity && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-gray-500 uppercase">Space:</span>
                                                        <span className="text-sm font-mono text-gray-800 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-sm">{selectedProblem.spaceComplexity}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : <div className="p-8 text-center text-gray-400">Select a problem to view</div>}
                    </div>
                </div>

                <DragHandleH onMouseDown={(e) => startDrag('desc', e)} />

                {/* Editor & Results */}
                <div style={{ width: showSidebar ? `calc(${100 - sidebarW - descW}%)` : `calc(100% - ${COLLAPSED_SIDEBAR_WIDTH}px - ${descW}%)` }} className="flex flex-col overflow-hidden bg-white">
                    {/* Editor Split */}
                    <div style={{ height: `${editorTopH}%`, transition: isResizing ? 'none' : 'height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' }} className="flex flex-col relative overflow-hidden">
                        {/* Toolbar */}
                        <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-3 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-44">
                                    <CustomDropdown
                                        options={LANGUAGE_OPTIONS}
                                        value={currentLang}
                                        onChange={(val) => handleLangChange({ target: { value: val } })}
                                        disabled={isProblemLocked || contestSubmitted}
                                        size="small"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-gray-100 border border-gray-200 rounded-lg p-0.5">
                                    <button onClick={handleRun} disabled={running || isProblemLocked || (contestSubmitted && !isPractice)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 rounded-md hover:bg-white hover:shadow-sm transition-all disabled:opacity-50" title="Run Code">
                                        {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
                                        <span className="hidden sm:inline">Run</span>
                                    </button>
                                    <button onClick={handleSubmit} disabled={submitting || isProblemLocked || (contestSubmitted && !isPractice)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 ml-0.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-all disabled:opacity-50" title={isPractice ? 'Verify Code' : 'Submit Code'}>
                                        {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                        <span className="hidden sm:inline">{isPractice ? 'Verify' : 'Submit'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-hidden relative">
                            <Editor
                                height="100%"
                                language={LANGUAGE_OPTIONS.find(l => l.value === currentLang)?.monacoLang}
                                value={currentCode}
                                onChange={(v) => {
                                    if (isProblemLocked || (contestSubmitted && !isPractice)) return;
                                    setCurrentCode(v || '');
                                    if (selectedProblem) {
                                        let savedMap = {};
                                        try { savedMap = JSON.parse(localStorage.getItem(`contest_${contestId}_codeMap`) || '{}'); } catch { }
                                        savedMap[selectedProblem._id] = { code: v || '', lang: currentLang };
                                        localStorage.setItem(`contest_${contestId}_codeMap`, JSON.stringify(savedMap));
                                    }
                                }}
                                theme="vs-light"
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    padding: { top: 16 },
                                    automaticLayout: true,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    readOnly: isProblemLocked || (contestSubmitted && !isPractice)
                                }}
                                onMount={(e, m) => {
                                    editorRef.current = e;
                                    monacoRef.current = m;

                                    // ── Internal-only clipboard ──────────────────────────────
                                    // Only text copied from THIS editor can be pasted back in.
                                    // Any external clipboard content is rejected.
                                    const internalClip = { text: '' };

                                    // Track Ctrl+C / Ctrl+X → save selection to internalClip
                                    e.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyC, () => {
                                        const sel = e.getSelection();
                                        if (sel && !sel.isEmpty()) {
                                            internalClip.text = e.getModel().getValueInRange(sel);
                                        }
                                        // Still write to system clipboard so Ctrl+C works normally
                                        e.trigger('keyboard', 'editor.action.clipboardCopyAction', null);
                                    });
                                    e.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyX, () => {
                                        const sel = e.getSelection();
                                        if (sel && !sel.isEmpty()) {
                                            internalClip.text = e.getModel().getValueInRange(sel);
                                        }
                                        e.trigger('keyboard', 'editor.action.clipboardCutAction', null);
                                    });

                                    // Ctrl+V → only paste from internal clipboard
                                    e.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyV, () => {
                                        if (!internalClip.text) return; // nothing copied from editor — block
                                        const sel = e.getSelection();
                                        e.executeEdits('internal-paste', [{
                                            range: sel,
                                            text: internalClip.text,
                                            forceMoveMarkers: true
                                        }]);
                                    });
                                    // Shift+Insert alternate paste — same block
                                    e.addCommand(m.KeyMod.Shift | m.KeyCode.Insert, () => {
                                        if (!internalClip.text) return;
                                        const sel = e.getSelection();
                                        e.executeEdits('internal-paste', [{
                                            range: sel,
                                            text: internalClip.text,
                                            forceMoveMarkers: true
                                        }]);
                                    });
                                    // Block DOM-level paste (right-click menu, drag-drop from outside)
                                    e.getDomNode()?.addEventListener('paste', (ev) => ev.preventDefault(), true);
                                }}
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
                    <div
                        key={resultsAnimKey}
                        style={{ height: `${100 - editorTopH}%`, transition: isResizing ? 'none' : 'height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
                        className="flex flex-col bg-white overflow-hidden relative"
                        data-results-panel
                    >
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
                            {/* Running State - check per-problem running flag too */}
                            {(running || submitting || runningMap[selectedProblem?._id] || submittingMap[selectedProblem?._id]) ? (
                                <ExecutionProgress isRunning={running || !!runningMap[selectedProblem?._id]} isSubmitting={submitting || !!submittingMap[selectedProblem?._id]} total={submitting || submittingMap[selectedProblem?._id] ? (selectedProblem?.testCases?.length || 5) : sampleTestCases.length} />
                            ) : (
                                <>
                                    {/* Test Cases Tab */}
                                    {bottomTab === 'testcases' && (
                                        <div className="flex flex-col h-full font-problem">
                                            {/* Case tabs row — same as problem workspace */}
                                            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 overflow-x-auto scrollbar-hide shrink-0">
                                                {/* Standard sample cases */}
                                                {sampleTestCases.map((_, i) => (
                                                    <button
                                                        key={`case-${i}`}
                                                        onClick={() => setActiveTestCaseId(`case-${i}`)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border
                                                            ${activeTestCaseId === `case-${i}`
                                                                ? 'bg-gray-100 border-gray-200 text-gray-900 font-semibold shadow-sm'
                                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        Case {i + 1}
                                                    </button>
                                                ))}

                                                {/* Custom cases */}
                                                {customTestCases.map((c) => (
                                                    <div key={c.id} className="relative group">
                                                        <button
                                                            onClick={() => setActiveTestCaseId(`custom-${c.id}`)}
                                                            className={`pl-3 pr-7 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border flex items-center gap-1
                                                                ${activeTestCaseId === `custom-${c.id}`
                                                                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold shadow-sm'
                                                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            Case {sampleTestCases.length + customTestCases.indexOf(c) + 1}
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRemoveCustomCase(c.id, e)}
                                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X size={10} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                ))}

                                                {/* Add button */}
                                                <button
                                                    onClick={handleAddCustomCase}
                                                    className="ml-1 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Add Custom Test Case"
                                                >
                                                    <Plus size={14} strokeWidth={3} />
                                                </button>
                                            </div>

                                            {/* Content area */}
                                            <div className="flex-1 p-4 overflow-y-auto">
                                                {activeTestCaseId.startsWith('case-') ? (
                                                    // Standard case view
                                                    (() => {
                                                        const idx = parseInt(activeTestCaseId.split('-')[1]);
                                                        const tc = sampleTestCases[idx];
                                                        if (!tc) return null;
                                                        return (
                                                            <div className="space-y-4 max-w-2xl">
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Input</p>
                                                                    <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-800 whitespace-pre-wrap select-text">
                                                                        {tc.input}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Expected Output</p>
                                                                    <div className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-600 whitespace-pre-wrap opacity-80 select-text">
                                                                        {tc.output}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()
                                                ) : (
                                                    // Custom case view — editable textarea
                                                    (() => {
                                                        const cCase = customTestCases.find(c => `custom-${c.id}` === activeTestCaseId);
                                                        if (!cCase) return <div className="text-gray-400 text-sm">Case not found.</div>;
                                                        return (
                                                            <div className="space-y-2 h-full flex flex-col">
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Custom Input</p>
                                                                <textarea
                                                                    className="flex-1 w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-800 focus:ring-1 focus:ring-primary-400 focus:border-primary-400 outline-none resize-none min-h-[100px]"
                                                                    value={cCase.input}
                                                                    onChange={(e) => updateCustomCase(e.target.value)}
                                                                    placeholder="Enter input here..."
                                                                />
                                                                <p className="text-[10px] text-gray-400">Click <span className="font-bold">Run</span> to execute with this custom input.</p>
                                                            </div>
                                                        );
                                                    })()
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Results Tab */}
                                    {bottomTab === 'results' && (
                                        <div className="h-full overflow-y-auto flex flex-col" style={{ animation: 'slide-up-results 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>

                                            {/* ── Network Error (Priority) ── */}
                                            {(!running && !submitting) && (isExecutionOffline || consoleOutput?.type === 'offline') && (
                                                <div className="flex flex-col bg-red-50/30">
                                                    <div className="bg-red-50 border-b border-red-100 px-4 py-3 flex items-center gap-2 shrink-0">
                                                        <div className="bg-red-100 p-1.5 rounded-full">
                                                            <XCircle size={16} className="text-red-600" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h3 className="text-red-800 font-bold text-sm">Network Error</h3>
                                                            <p className="text-xs text-red-600">No internet connection. Please check your network and try again.</p>
                                                        </div>
                                                        <button
                                                            onClick={() => bottomTab === 'testcases' ? handleRun() : handleSubmit()}
                                                            className="px-3 py-1 bg-white border border-red-200 text-red-600 rounded-md text-[10px] font-bold hover:bg-red-50 transition-colors"
                                                        >
                                                            Retry
                                                        </button>
                                                    </div>
                                                    <div className="p-8 text-center animate-in fade-in duration-500">
                                                        <div className="w-16 h-16 rounded-full bg-red-100/50 flex items-center justify-center mb-4 mx-auto">
                                                            <XCircle size={32} className="text-red-500" />
                                                        </div>
                                                        <p className="text-sm text-gray-500 max-w-xs mx-auto mb-4">
                                                            We couldn't reach the execution server. Please check your internet connection and try again.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* —"—" Compilation Error —"—" */}
                                            {!running && !submitting && !(isExecutionOffline || consoleOutput?.type === 'offline') && isCompileErr && (
                                                <div className="flex flex-col bg-orange-50/30">
                                                    <div className="bg-orange-50 border-b border-orange-100 px-4 py-3 flex items-center gap-2 shrink-0">
                                                        <div className="bg-orange-100 p-1.5 rounded-full">
                                                            <AlertTriangle className="text-orange-600" size={16} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-orange-800 font-bold text-sm">Compilation Error</h3>
                                                            <p className="text-xs text-orange-600">Check your code for syntax errors</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-4">
                                                        <pre className="font-mono text-xs text-orange-700 bg-orange-50/50 border border-orange-100 rounded-lg p-3 whitespace-pre-wrap leading-relaxed shadow-sm">
                                                            {consoleOutput?.message || consoleOutput?.error || 'Unknown error'}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}

                                            {/* ── Has results ── */}
                                            {!running && !submitting && !isCompileErr && displayResult && (
                                                <div className="flex flex-col h-full font-problem">
                                                    {/* ── Verdict Header ── */}
                                                    {(() => {
                                                        const vc = getVerdictColor(displayResult.verdict);
                                                        const isAccepted = displayResult.verdict === 'Accepted';
                                                        const isTLE = displayResult.verdict === 'TLE';
                                                        const isSubmit = !displayResult.isRun;
                                                        return (
                                                            <div className={`px-5 py-4 border-b shrink-0 ${vc.bg} ${vc.border}`}>
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`p-2 rounded-full ${isAccepted ? 'bg-green-100 text-green-600' : isTLE ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                                                                            {isAccepted ? <CheckCircle size={20} /> : isTLE ? <Clock size={20} /> : <XCircle size={20} />}
                                                                        </div>
                                                                        <div>
                                                                            <h2 className={`text-lg font-bold ${vc.text}`}>
                                                                                {displayResult.verdict}
                                                                            </h2>
                                                                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                                                <span className={`text-sm font-medium ${vc.text}`}>
                                                                                    {displayResult.testCasesPassed ?? (displayResult.results?.filter(r => r.passed).length || 0)} / {displayResult.totalTestCases ?? (displayResult.results?.length || 0)} testcases passed
                                                                                </span>
                                                                                {isSubmit && (
                                                                                    <span className="text-xs text-gray-500">All Test Cases</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* ── SUBMIT MODE: Clean circular summary, no per-case tabs ── */}
                                                    {!displayResult.isRun && (() => {
                                                        const v = displayResult.verdict;
                                                        const isAC = v === 'Accepted';
                                                        const isTLE = v === 'TLE';
                                                        const isWA = v === 'Wrong Answer';
                                                        const isRE = v === 'Runtime Error';
                                                        const passed = displayResult.testCasesPassed ?? 0;
                                                        const total = displayResult.totalTestCases ?? 0;
                                                        const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
                                                        const circleColor = isAC ? '#22c55e' : isTLE ? '#eab308' : '#ef4444';
                                                        const bgColor = isAC ? '#f0fdf4' : isTLE ? '#fefce8' : '#fef2f2';
                                                        const radius = 52;
                                                        const circ = 2 * Math.PI * radius;
                                                        const dash = (pct / 100) * circ;
                                                        return (
                                                            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-8">
                                                                <div style={{ position: 'relative', width: 140, height: 140 }}>
                                                                    <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
                                                                        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
                                                                        <circle
                                                                            cx="70" cy="70" r={radius}
                                                                            fill="none"
                                                                            stroke={circleColor}
                                                                            strokeWidth="10"
                                                                            strokeDasharray={`${dash} ${circ - dash}`}
                                                                            strokeLinecap="round"
                                                                            style={{ transition: 'stroke-dasharray 0.6s ease' }}
                                                                        />
                                                                    </svg>
                                                                    <div style={{
                                                                        position: 'absolute', inset: 0,
                                                                        display: 'flex', flexDirection: 'column',
                                                                        alignItems: 'center', justifyContent: 'center'
                                                                    }}>
                                                                        <span style={{ fontSize: 22, fontWeight: 800, color: circleColor, lineHeight: 1 }}>{passed}</span>
                                                                        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>/ {total}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-center gap-2">
                                                                    <span style={{
                                                                        background: bgColor, color: circleColor,
                                                                        border: `1.5px solid ${circleColor}30`,
                                                                        borderRadius: 99, padding: '4px 18px',
                                                                        fontWeight: 700, fontSize: 13
                                                                    }}>{v}</span>
                                                                    <p className="text-xs text-gray-400 font-medium text-center">
                                                                        {isAC && 'Great job! All test cases passed.'}
                                                                        {isTLE && `${passed} cases passed before time limit was exceeded.`}
                                                                        {isWA && `${passed} / ${total} cases correct.`}
                                                                        {isRE && 'Your code crashed on a test case.'}
                                                                        {v === 'Compilation Error' && 'Fix your compile errors and resubmit.'}
                                                                    </p>
                                                                </div>
                                                                {displayResult.error && !isAC && (
                                                                    <div className="w-full max-w-sm">
                                                                        <p className="text-[10px] font-bold text-red-500 uppercase mb-1">Error</p>
                                                                        <pre className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-mono whitespace-pre-wrap">
                                                                            {displayResult.error}
                                                                        </pre>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* ── RUN MODE: Per-case tabs + details (unchanged) ── */}
                                                    {displayResult.isRun && displayResult.results?.length > 0 && (
                                                        <>
                                                            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 overflow-x-auto scrollbar-hide shrink-0 bg-white">
                                                                {displayResult.results.map((r, i) => (
                                                                    <button
                                                                        key={i}
                                                                        onClick={() => setActiveResultCase(i)}
                                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border
                                                                                    ${activeResultCase === i
                                                                                ? `${r.passed ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-700'} font-semibold`
                                                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                                                            }`}
                                                                    >
                                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.passed ? 'bg-green-500' : 'bg-red-500'}`} />
                                                                        {(() => {
                                                                            if (!r.isCustom) return `Case ${i + 1}`;
                                                                            // Count how many custom cases came before this one
                                                                            const customIdx = displayResult.results.slice(0, i + 1).filter(x => x.isCustom).length;
                                                                            return `Custom ${customIdx}`;
                                                                        })()}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="flex-1 p-4 overflow-y-auto">
                                                                {displayResult.results[activeResultCase] ? (
                                                                    <div className="space-y-4 max-w-3xl">
                                                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${displayResult.results[activeResultCase].passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                            {displayResult.results[activeResultCase].passed
                                                                                ? <><CheckCircle size={12} /> Passed</>
                                                                                : <><XCircle size={12} /> {displayResult.results[activeResultCase].verdict || 'Failed'}</>
                                                                            }
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Input</p>
                                                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-800 whitespace-pre-wrap min-h-[48px]">
                                                                                {displayResult.results[activeResultCase].input ?? <span className="text-gray-400 italic">N/A</span>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                            <div>
                                                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Your Output</p>
                                                                                <div className={`rounded-lg p-3 text-sm font-mono whitespace-pre-wrap border min-h-[48px] ${displayResult.results[activeResultCase].passed ? 'bg-green-50/40 border-green-200' : 'bg-red-50/40 border-red-200'} text-gray-900`}>
                                                                                    {displayResult.results[activeResultCase].actualOutput || <span className="text-gray-400 italic">No output</span>}
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Expected Output</p>
                                                                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-600 whitespace-pre-wrap min-h-[48px]">
                                                                                    {displayResult.results[activeResultCase].expectedOutput ?? <span className="text-gray-400 italic">N/A</span>}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        {displayResult.results[activeResultCase].error && (
                                                                            <div>
                                                                                <p className="text-[10px] font-bold text-red-500 uppercase mb-1.5">Error / Traceback</p>
                                                                                <pre className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-mono whitespace-pre-wrap">
                                                                                    {displayResult.results[activeResultCase].error}
                                                                                </pre>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">No result data for this case.</div>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* —"—" No results yet —"—" */}
                                            {!running && !submitting && !displayResult && !consoleOutput?.error && (
                                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                                                        <Play size={20} className="ml-1 text-gray-300" />
                                                    </div>
                                                    <p className="text-sm font-medium">Run code to view results</p>
                                                </div>
                                            )}

                                            {/* —"—" Generic error (no results) —"—" */}
                                            {!running && !submitting && consoleOutput?.error && !displayResult && (
                                                <div className="p-4">
                                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                        <p className="text-xs font-bold text-red-600 mb-2">Error</p>
                                                        <p className="text-xs text-red-700">{consoleOutput.error}</p>
                                                    </div>
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

            {/* —"—"—" Modals —"—"—" */}
            {/* Offline Enforcer */}
            {!isOnline && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-gray-900/90 backdrop-blur-sm">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📶</span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">No Internet Connection</h2>
                        <p className="text-gray-600 mb-2">You have lost your connection to the internet. Compilation and submissions are paused.</p>
                        <p className="text-sm font-semibold text-red-500 animate-pulse">Waiting for connection to be restored...</p>
                    </div>
                </div>
            )}

            {/* Fullscreen Enforcer Overlay */}
            {(!isPractice && contestActive && !contestSubmitted && contest?.proctoringEnabled && !isFullscreen && !finishing && isOnline) && (
                <div className="fixed inset-0 z-[99998] flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-md">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center border border-gray-100 transform scale-100 transition-transform">
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                            <Maximize2 className="w-8 h-8 text-blue-600" />
                            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping"></div>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">Fullscreen Required</h2>
                        <p className="text-gray-600 mb-8 text-sm leading-relaxed">
                            This contest requires you to stay in fullscreen mode. Please enter fullscreen to continue with the assessment.
                        </p>
                        <button
                            onClick={() => enterFullscreen()}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold transition-all shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.23)] hover:-translate-y-0.5"
                        >
                            Enter Fullscreen Mode
                        </button>
                    </div>
                </div>
            )}

            {showViolationModal && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-red-900/60 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border-4 border-red-500 transform scale-100">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5 relative">
                            <AlertTriangle className="text-red-600 w-10 h-10 animate-pulse" />
                            <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping"></div>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-wide">Warning!</h2>
                        <h3 className="text-lg font-bold text-red-600 mb-3">{currentViolationType?.type} Detected</h3>
                        <p className="text-gray-600 text-sm mb-6 leading-relaxed bg-red-50 p-3 rounded-lg border border-red-100 font-medium">
                            {currentViolationType?.message}
                        </p>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Violation Count</p>
                            <p className="text-3xl font-black text-gray-900">
                                {violationSummary.totalViolations} <span className="text-sm font-semibold text-gray-400">/ {contest?.maxViolations || 5}</span>
                            </p>
                            {violationSummary.isNearLimit && (
                                <p className="text-xs text-red-500 font-bold mt-2 animate-bounce flex items-center justify-center gap-1">
                                    <AlertTriangle size={12} /> One more violation will submit test!
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {showLeaderboard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden border border-gray-200" onClick={e => e.stopPropagation()}>
                        <div className="bg-white border-b border-gray-100 p-5 flex justify-between items-start shrink-0">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">🏆 Leaderboard</h2>
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                    <p className="text-xs text-gray-500">
                                        {sortedLeaderboardData.length} participant{sortedLeaderboardData.length !== 1 ? 's' : ''}
                                        {totalParticipants > sortedLeaderboardData.length && ` · ${totalParticipants} enrolled`}
                                    </p>
                                    {/* Live online count removed — not reliable across multi-instance deployments
                                    {!isPractice && liveParticipants > 0 && (
                                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            {liveParticipants} online now
                                        </span>
                                    )}
                                    */}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {/* Manual refresh button */}
                                <button
                                    onClick={async () => {
                                        setLoadingLeaderboard(true);
                                        try {
                                            const d = await contestService.getContestLeaderboard(contestId);
                                            setLeaderboardData(d.leaderboard || []);
                                            if (d.totalParticipants) setTotalParticipants(d.totalParticipants);
                                        } finally { setLoadingLeaderboard(false); }
                                    }}
                                    disabled={loadingLeaderboard}
                                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                                    title="Refresh leaderboard"
                                >
                                    <RotateCw size={15} className={loadingLeaderboard ? 'animate-spin' : ''} />
                                </button>
                                {/* Close button — always visible */}
                                <button
                                    onClick={() => setShowLeaderboard(false)}
                                    className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                                    title="Close leaderboard"
                                >
                                    <XCircle size={18} />
                                </button>
                            </div>
                        </div>
                        {/* Page size selector for inline leaderboard modal */}
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 bg-gray-50/40 shrink-0">
                            <span className="text-xs text-gray-500 font-medium">Show:</span>
                            {[20, 50, 100, 200, 500].map(size => (
                                <button key={size} onClick={() => { setItemsPerPage(size); setCurrentPage(1); }}
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${itemsPerPage === size ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                                        }`}>{size}</button>
                            ))}
                            <span className="ml-auto text-xs text-gray-400">{sortedLeaderboardData.length} total</span>
                        </div>
                        {/* Single Rankings view — no separate violations tab */}
                        <div className="flex-1 overflow-auto scrollbar-thin bg-gray-50/50 relative">
                            <div className="overflow-auto">
                                <table className="w-full text-left border-collapse min-w-max">
                                    <thead className="bg-white sticky top-0 z-10 shadow-sm text-xs uppercase tracking-wider text-gray-500">
                                        <tr>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 sticky left-0 bg-gray-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[60px]" onClick={() => handleSort('rank')}>
                                                Rank {sortConfig.key === 'rank' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                            </th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 sticky left-[60px] bg-gray-50 z-20 border-r border-gray-200 min-w-[110px]" onClick={() => handleSort('rollNumber')}>
                                                Roll No {sortConfig.key === 'rollNumber' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                            </th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 sticky left-[170px] bg-gray-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-200 min-w-[140px]" onClick={() => handleSort('fullName')}>
                                                Full Name {sortConfig.key === 'fullName' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                            </th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 min-w-[120px]" onClick={() => handleSort('username')}>
                                                Username {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                            </th>
                                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleSort('branch')}>
                                                Branch {sortConfig.key === 'branch' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                            </th>

                                            {/* Problem Columns — in contest order */}
                                            {contest?.problems?.map((prob, i) => (
                                                <th key={prob._id} className="p-4 font-bold text-center whitespace-nowrap min-w-[130px]">
                                                    P{i + 1}: {prob.title?.length > 12 ? prob.title.slice(0, 12) + '—' : prob.title}
                                                </th>
                                            ))}

                                            <th className="p-4 font-bold text-center cursor-pointer hover:bg-gray-50 whitespace-nowrap" onClick={() => handleSort('time')}>
                                                Time (hrs) {sortConfig.key === 'time' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                            </th>
                                            <th className="p-4 font-bold text-center cursor-pointer hover:bg-gray-50 whitespace-nowrap" onClick={() => handleSort('problemsSolved')}>
                                                Solved {sortConfig.key === 'problemsSolved' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                            </th>
                                            {contest?.proctoringEnabled && (
                                                <>
                                                    <th className="p-4 font-bold text-center whitespace-nowrap">Tab Switches</th>
                                                    <th className="p-4 font-bold text-center whitespace-nowrap">FS Exits</th>
                                                    <th className="p-4 font-bold text-center whitespace-nowrap text-amber-600">—  Violations</th>
                                                </>
                                            )}
                                            <th className="p-4 font-bold text-center cursor-pointer hover:bg-gray-50 whitespace-nowrap" onClick={() => handleSort('status')}>
                                                Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                            </th>
                                            <th className="p-4 font-bold text-center cursor-pointer hover:bg-gray-50 whitespace-nowrap sticky right-0 bg-white z-20 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]" onClick={() => handleSort('score')}>
                                                Score {sortConfig.key === 'score' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                            </th>
                                        </tr>
                                    </thead>
                                    {!loadingLeaderboard && (
                                        <tbody className="divide-y divide-gray-100 text-sm bg-white">
                                            {(() => {
                                                const currentUserEntry = sortedLeaderboardData.find(entry => entry.studentId === user?._id || entry.studentId === user?.userId || entry.studentId === user?.id);

                                                return (
                                                    <>
                                                        {/* Pinned Current User Row */}
                                                        {currentUserEntry && (
                                                            <tr className="bg-blue-50 ring-2 ring-blue-400 sticky top-[44px] z-30 shadow-md">
                                                                <td className="px-3 py-3 whitespace-nowrap sticky left-0 bg-blue-50 z-10 border-r border-blue-100">
                                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold text-base bg-blue-600 text-white shadow">
                                                                        #{currentUserEntry.rank}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-mono sticky left-[60px] bg-blue-50 z-10 border-r border-blue-100">{currentUserEntry.rollNumber}</td>
                                                                <td className="px-3 py-3 text-sm text-blue-900 font-bold max-w-[140px] min-w-[140px] truncate sticky left-[170px] bg-blue-50 z-10 border-r border-blue-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" title={currentUserEntry.fullName !== 'N/A' ? currentUserEntry.fullName : currentUserEntry.username}>
                                                                    {currentUserEntry.fullName !== 'N/A' ? currentUserEntry.fullName : currentUserEntry.username} (You)
                                                                </td>
                                                                <td className="px-3 py-3 text-sm text-blue-700 max-w-[120px] truncate" title={(currentUserEntry.isSpotUser || currentUserEntry.username?.startsWith('spot_')) ? '' : currentUserEntry.username}>
                                                                    {(currentUserEntry.isSpotUser || currentUserEntry.username?.startsWith('spot_')) ? <span className="font-medium text-blue-400">-</span> : currentUserEntry.username}
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap text-sm text-blue-700">{currentUserEntry.branch}</td>

                                                                {contest?.problems?.map(prob => {
                                                                    const pData = currentUserEntry.problems?.[prob._id];
                                                                    const status = pData?.status || 'Not Attempted';
                                                                    let cellClass = 'bg-blue-100 text-blue-500';
                                                                    let icon = null;

                                                                    if (status === 'Accepted') {
                                                                        cellClass = 'bg-green-100 text-green-700 font-semibold';
                                                                        icon = '✓';
                                                                    } else if (status === 'Wrong Answer') {
                                                                        cellClass = 'bg-red-100 text-red-600';
                                                                        icon = '—';
                                                                    }

                                                                    return (
                                                                        <td key={`cu-${prob._id}`} className="p-2 text-center border-r border-blue-100">
                                                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                                                <div className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 min-w-[72px] justify-center ${cellClass}`}>
                                                                                    {icon && <span className="font-bold">{icon}</span>}
                                                                                    {status === 'Not Attempted' ? '—' : status === 'Accepted' ? 'Accepted' : 'Wrong'}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                })}

                                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-blue-700 font-mono">{(currentUserEntry.time / 60).toFixed(2)} hrs</td>
                                                                <td className="px-3 py-2 whitespace-nowrap text-center">
                                                                    <span className="inline-block bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold border border-blue-300">
                                                                        {currentUserEntry.problemsSolved}/{contest?.problems?.length || 0}
                                                                    </span>
                                                                </td>
                                                                {contest?.proctoringEnabled && (() => {
                                                                    const cuTs = currentUserEntry.tabSwitchCount || 0;
                                                                    const cuFse = currentUserEntry.fullscreenExits || 0;
                                                                    const cuTotal = cuTs + cuFse;
                                                                    const maxV = contest?.maxViolations || 5;
                                                                    return (
                                                                        <>
                                                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                                                                <span className={cuTs > 0 ? 'text-red-600 font-bold' : 'text-gray-500'}>{cuTs}/{maxV}</span>
                                                                            </td>
                                                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                                                                <span className={cuFse > 0 ? 'text-red-600 font-bold' : 'text-gray-500'}>{cuFse}/{maxV}</span>
                                                                            </td>
                                                                            <td className="px-3 py-2 whitespace-nowrap text-center">
                                                                                <span className={`px-2 py-1 rounded-full text-xs font-bold inline-block ${cuTotal === 0 ? 'bg-green-100 text-green-800'
                                                                                    : cuTotal >= maxV ? 'bg-red-200 text-red-900'
                                                                                        : 'bg-red-100 text-red-700'
                                                                                    }`}>{cuTotal}/{maxV}</span>
                                                                            </td>
                                                                        </>
                                                                    );
                                                                })()}
                                                                <td className="p-4 text-center">
                                                                    {currentUserEntry.isCompleted ? (
                                                                        <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-bold">Finished</span>
                                                                    ) : (
                                                                        <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-bold">In Progress</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-center font-bold text-blue-800 sticky right-0 bg-blue-50 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] border-l border-blue-100">{currentUserEntry.score}</td>
                                                            </tr>
                                                        )}
                                                        {paginatedData.map((entry, pageIndex) => {
                                                            const index = (currentPage - 1) * itemsPerPage + pageIndex;
                                                            const isCurrentUser = entry.studentId === user?._id || entry.studentId === user?.userId || entry.studentId === user?.id;
                                                            // We skip rendering the current user here if it is already pinned at the top
                                                            if (isCurrentUser) return null;

                                                            const rowRank = entry.rank;
                                                            return (
                                                                <tr key={index} className="hover:bg-gray-50 transition bg-white">
                                                                    <td className="px-3 py-3 whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-100">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto font-bold shadow-sm ${rowRank === 1 ? 'bg-yellow-100 border-2 border-yellow-300 text-xl' :
                                                                            rowRank === 2 ? 'bg-gray-100 border-2 border-gray-300 text-xl' :
                                                                                rowRank === 3 ? 'bg-orange-100 border-2 border-orange-300 text-xl' : 'bg-white border border-gray-200 text-gray-500 text-base'
                                                                            }`}>
                                                                            {rowRank === 1 ? '🥇' : rowRank === 2 ? '🥈' : rowRank === 3 ? '🥉' : `#${rowRank}`}
                                                                        </div>
                                                                    </td>
                                                                    {/* Roll No - sticky */}
                                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 font-mono sticky left-[60px] bg-white z-10 border-r border-gray-100">{entry.rollNumber}</td>
                                                                    {/* Full Name - sticky */}
                                                                    <td className="px-3 py-3 text-sm text-gray-900 font-semibold max-w-[140px] min-w-[140px] truncate sticky left-[170px] bg-white z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" title={entry.fullName !== 'N/A' ? entry.fullName : entry.username}>
                                                                        {entry.fullName !== 'N/A' ? entry.fullName : entry.username}
                                                                    </td>
                                                                    {/* Username */}
                                                                    <td className="px-3 py-3 text-sm text-gray-500 max-w-[120px] truncate" title={(entry.isSpotUser || entry.username?.startsWith('spot_')) ? '' : entry.username}>
                                                                        {(entry.isSpotUser || entry.username?.startsWith('spot_')) ? <span className="font-medium text-gray-400">-</span> : entry.username}
                                                                    </td>
                                                                    {/* Branch */}
                                                                    <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{entry.branch}</td>

                                                                    {/* Problem Cells — order matches contest.problems */}
                                                                    {contest?.problems?.map(prob => {
                                                                        const pData = entry.problems?.[prob._id];
                                                                        const status = pData?.status || 'Not Attempted';
                                                                        let cellClass = 'bg-gray-50 text-gray-400';
                                                                        let icon = null;

                                                                        if (status === 'Accepted') {
                                                                            cellClass = 'bg-green-50 text-green-700 font-semibold';
                                                                            icon = '✓';
                                                                        } else if (status === 'Wrong Answer') {
                                                                            cellClass = 'bg-red-50 text-red-600';
                                                                            icon = '—';
                                                                        }

                                                                        return (
                                                                            <td key={prob._id} className="p-2 text-center border-r border-gray-50">
                                                                                <div className="flex flex-col items-center justify-center gap-0.5">
                                                                                    <div className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 min-w-[72px] justify-center ${cellClass}`}>
                                                                                        {icon && <span className="font-bold">{icon}</span>}
                                                                                        {status === 'Not Attempted' ? '—' : status === 'Accepted' ? 'Accepted' : 'Wrong'}
                                                                                    </div>
                                                                                    {pData?.submittedAt !== undefined && pData?.submittedAt !== null && (
                                                                                        <span className="text-[10px] text-gray-500 font-mono tracking-tighter">
                                                                                            {(pData.submittedAt / 60).toFixed(2)} hrs
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                        );
                                                                    })}

                                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-600 font-mono">{(entry.time / 60).toFixed(2)} hrs</td>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-center">
                                                                        <span className="inline-block bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold border border-indigo-100">
                                                                            {entry.problemsSolved}/{contest?.problems?.length || 0}
                                                                        </span>
                                                                    </td>
                                                                    {contest?.proctoringEnabled && (() => {
                                                                        const ts = entry.tabSwitchCount || 0;
                                                                        const fse = entry.fullscreenExits || 0;
                                                                        const totalV = ts + fse;
                                                                        const limit = contest?.maxViolations || 5;
                                                                        const pct = Math.min(100, Math.round((totalV / limit) * 100));
                                                                        return (
                                                                            <>
                                                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                                                                    <span className={ts > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                                                                                        {ts}/{limit}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                                                                    <span className={fse > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                                                                                        {fse}/{limit}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-3 py-2 whitespace-nowrap text-center">
                                                                                    <div className="flex flex-col items-center gap-1">
                                                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold inline-block ${totalV === 0 ? 'bg-green-100 text-green-800'
                                                                                            : pct >= 100 ? 'bg-red-100 text-red-800'
                                                                                                : 'bg-yellow-100 text-yellow-800'
                                                                                            }`}>{totalV}/{limit}</span>
                                                                                    </div>
                                                                                </td>
                                                                            </>
                                                                        );
                                                                    })()}
                                                                    <td className="p-4 text-center">
                                                                        {entry.isCompleted ? (
                                                                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium border border-green-200">Finished</span>
                                                                        ) : (
                                                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium border border-yellow-200">In Progress</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-4 text-center font-bold text-blue-600 sticky right-0 bg-white z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] border-l border-gray-100">{entry.score}</td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </>
                                                )
                                            })()}
                                        </tbody>
                                    )}
                                </table>
                                {loadingLeaderboard && (
                                    <div className="flex flex-col items-center justify-center py-20 w-full min-w-max">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        <p className="text-sm text-gray-500 font-medium mt-3">Refreshing leaderboard data...</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && !loadingLeaderboard && leaderboardData.length > 0 && (
                            <div className="bg-white border-t border-gray-100 p-4 flex items-center justify-between mt-auto shrink-0 w-full z-20 shadow-[0_-4px_6px_-4px_rgba(0,0,0,0.05)]">
                                <span className="text-sm text-gray-600 font-medium">
                                    Showing <span className="text-gray-900 font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-gray-900 font-semibold">{Math.min(currentPage * itemsPerPage, sortedLeaderboardData.length)}</span> of <span className="text-gray-900 font-semibold">{sortedLeaderboardData.length}</span> students
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <span className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-900 bg-gray-50 rounded-lg">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContestInterface;
