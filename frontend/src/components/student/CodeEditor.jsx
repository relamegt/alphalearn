import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
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
    CheckSquare,
    Terminal,
    Coins,
    Lock,
    XCircle,
    Clock,
    Pause,
    ChevronLeft,
    ChevronRight,
    Settings,
    MoreVertical
} from 'lucide-react';
import problemService from '../../services/problemService';
import useCodeExecution from '../../hooks/useCodeExecution';
import { initPasteDetection } from '../../utils/pasteDetector';
import { initSecurityFeatures } from '../../utils/disableInspect';
import toast from 'react-hot-toast';
import ProblemSidebar from './ProblemSidebar';
import SubmissionsTab from './SubmissionsTab';
import { GoSidebarCollapse, GoSidebarExpand } from 'react-icons/go';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

// ─── Success Pop — Lottie coin + light particles ─────────────────────────────────

// Lottie animation URL — public coin celebration from LottieFiles
const COIN_LOTTIE_URL = 'https://lottie.host/4f6392d0-c8c9-48f8-b7b1-77eef8ae08d4/etg9mQk4N4.lottie';

// Tiny pop particle dot
const PopParticle = ({ style }) => (
    <div style={{
        position: 'fixed', borderRadius: '50%', pointerEvents: 'none',
        animation: 'coin-particle 1.1s ease-out forwards',
        ...style,
    }} />
);

const SuccessPopOverlay = ({ result, points, onClose }) => {
    const [visible, setVisible] = useState(false);
    // Show earned coins, or fallback to problem points (for re-solves/testing visual)
    const coins = (result?.coinsEarned && result.coinsEarned > 0) ? result.coinsEarned : (points || 0);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
        const t = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 400);
        }, 4500);
        return () => clearTimeout(t);
    }, []);

    // Light radial pop particles
    const PART_COLORS = ['#fbbf24', '#f59e0b', '#fcd34d', '#10b981', '#34d399', '#60a5fa', '#c084fc', '#f472b6'];
    const particles = Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * 360;
        const dist = 120 + Math.random() * 140;
        const rad = angle * Math.PI / 180;
        return {
            left: `calc(50% + ${Math.round(Math.cos(rad) * dist)}px)`,
            top: `calc(50% + ${Math.round(Math.sin(rad) * dist)}px)`,
            width: `${5 + Math.random() * 7}px`,
            height: `${5 + Math.random() * 7}px`,
            background: PART_COLORS[i % PART_COLORS.length],
            animationDelay: `${Math.random() * 0.3}s`,
            '--tx': `${Math.round((Math.random() - 0.5) * 50)}px`,
            '--ty': `${-40 - Math.random() * 70}px`,
        };
    });

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(6px)',
                opacity: visible ? 1 : 0, transition: 'opacity 0.4s',
                cursor: 'pointer',
            }}
        >
            {/* Light pop particles behind the lottie */}
            {particles.map((p, i) => <PopParticle key={i} style={p} />)}

            {/* Lottie coin animation */}
            <div style={{
                width: 420, height: 420,
                transform: visible ? 'scale(1) translateY(0)' : 'scale(0.3) translateY(60px)',
                opacity: visible ? 1 : 0,
                transition: 'transform 0.55s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s',
                filter: 'drop-shadow(0 0 40px rgba(251,191,36,0.6))',
                pointerEvents: 'none',
            }}>
                <DotLottieReact
                    src={COIN_LOTTIE_URL}
                    loop
                    autoplay
                />
            </div>

            {/* +N coins + label */}
            {coins > 0 && (
                <div style={{
                    textAlign: 'center', marginTop: -20,
                    transform: visible ? 'scale(1) translateY(0)' : 'scale(0.4) translateY(30px)',
                    opacity: visible ? 1 : 0,
                    transition: 'transform 0.5s 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s 0.3s',
                    lineHeight: 1,
                }}>
                    <div style={{
                        fontSize: 45, fontWeight: 900,
                        color: '#f59e0b',
                        textShadow: '0 4px 24px rgba(245,158,11,0.6)',
                        letterSpacing: '-1px', lineHeight: 1, fontFamily: "'Outfit', sans-serif",
                    }}>
                        + {coins} Coins
                    </div>
                </div>
            )}

        </div>
    );
};

// ─── BookOpen icon ──────────────────────────────────────────────────────────
const BookOpenIcon = ({ size = 14, className = '' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeLinejoin="round" className={className}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
);

// ─── Drag‑Handle helpers ─────────────────────────────────────────────────────
const DragHandleH = ({ onMouseDown }) => (
    <div
        onMouseDown={onMouseDown}
        className="w-1 bg-gray-200 hover:bg-primary-400 cursor-col-resize shrink-0 transition-colors z-10 group relative"
        title="Drag to resize"
    >
        <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
);

const DragHandleV = ({ onMouseDown }) => (
    <div
        onMouseDown={onMouseDown}
        className="h-1 bg-gray-200 hover:bg-primary-400 cursor-row-resize shrink-0 transition-colors z-10 relative"
        title="Drag to resize"
    >
        <div className="absolute inset-x-0 -top-1 -bottom-1" />
    </div>
);

// ─── Language & template data ────────────────────────────────────────────────
const LANGUAGE_OPTIONS = [
    { value: 'c', label: 'C', monacoLang: 'c' },
    { value: 'cpp', label: 'C++', monacoLang: 'cpp' },
    { value: 'java', label: 'Java', monacoLang: 'java' },
    { value: 'python', label: 'Python 3', monacoLang: 'python' },
    { value: 'javascript', label: 'JavaScript (Node)', monacoLang: 'javascript' },
];

const DEFAULT_CODE = {
    c: '#include <stdio.h>\n\nint main() {\n    // your code\n    return 0;\n}',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // your code\n    return 0;\n}',
    java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // your code\n    }\n}',
    python: 'def main():\n    # your code\n    pass\n\nif __name__ == "__main__":\n    main()',
    javascript: 'function main() {\n    // your code\n}\n\nmain();',
};

// ─── Difficulty badge ───────────────────────────────────────────────────────
const DiffBadge = ({ d }) => {
    const styles = {
        Easy: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
        Medium: { background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' },
        Hard: { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
    };
    const dot = { Easy: '#22c55e', Medium: '#eab308', Hard: '#ef4444' };
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', ...styles[d] }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot[d], flexShrink: 0 }} />
            {d}
        </span>
    );
};

// ─── Verdict color helper ───────────────────────────────────────────────────
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

// ─── LeetCode-style Progress Bar ────────────────────────────────────────────
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
                <p className="text-2xl font-bold text-primary-600">
                    {count} <span className="text-gray-400 text-lg font-normal">/ {total}</span>
                </p>
            </div>
            <div className="w-full max-w-xs bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                    className="h-2 bg-primary-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <p className="text-xs text-gray-400">
                <Loader2 size={12} className="inline animate-spin mr-1" />
                {label} code against test cases
            </p>
        </div>
    );
};

// ─── Timer Component ────────────────────────────────────────────────────────
const ProblemTimer = () => {
    const [seconds, setSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(true);

    useEffect(() => {
        let interval;
        if (isRunning) {
            interval = setInterval(() => {
                setSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning]);

    const formatTime = (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        return `${hours > 0 ? `${hours}:` : ''}${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center gap-2 bg-gray-100/80 hover:bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
            <Clock size={14} className="text-gray-500" />
            <span className="font-mono text-sm font-medium text-gray-700 min-w-[48px] text-center">
                {formatTime(seconds)}
            </span>
            <button
                onClick={() => setIsRunning(!isRunning)}
                className="ml-1 p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
                title={isRunning ? "Pause Timer" : "Resume Timer"}
            >
                {isRunning ? <Pause size={12} className="fill-current" /> : <Play size={12} className="fill-current" />}
            </button>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════════════════
const CodeEditor = () => {
    const { problemId } = useParams();
    const navigate = useNavigate();
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const containerRef = useRef(null);

    // ── layout widths ──
    const [sidebarW, setSidebarW] = useState(20);
    const [descW, setDescW] = useState(38);
    const [editorTopH, setEditorTopH] = useState(65);
    const [showSidebar, setShowSidebar] = useState(true);
    const COLLAPSED_SIDEBAR_WIDTH = 48; // px

    // ── problem data ──
    const [problem, setProblem] = useState(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [loading, setLoading] = useState(true);

    // ── editor ──
    const [language, setLanguage] = useState('cpp');
    const [code, setCode] = useState(DEFAULT_CODE.cpp);

    // ── tabs ──
    const [leftTab, setLeftTab] = useState('description');
    const [bottomTab, setBottomTab] = useState('testcases');

    // ── ui misc ──
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [pasteAttempts, setPasteAttempts] = useState(0);
    const [testCases, setTestCases] = useState([]);
    const [activeResultCase, setActiveResultCase] = useState(0); // result tab index
    const [activeInputCase, setActiveInputCase] = useState(0);   // test case input tab index
    const [isCustomInput, setIsCustomInput] = useState(false);
    const [customInputVal, setCustomInputVal] = useState('');
    const [showSuccessPop, setShowSuccessPop] = useState(false);
    const [successResult, setSuccessResult] = useState(null);
    const [resultsAnimKey, setResultsAnimKey] = useState(0);
    const [isResizing, setIsResizing] = useState(false);

    const { running, submitting, runResult, submitResult, runCode, submitCode, error: execError } = useCodeExecution();

    // ───── fetch problem ──────────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;
        setLoading(true);
        problemService.getProblemById(problemId)
            .then(data => {
                if (!mounted) return;
                setProblem(data.problem);

                // Show all non-hidden test cases
                const allCases = data.problem.testCases || [];
                const publicCases = allCases.filter(tc => !tc.isHidden);

                if (publicCases.length > 0) {
                    setTestCases(publicCases.map(tc => ({ input: tc.input, output: tc.output })));
                } else {
                    const examples = data.problem.examples || [];
                    setTestCases(examples.length
                        ? examples.map(e => ({ input: e.input, output: e.output, explanation: e.explanation }))
                        : [{ input: '', output: '' }]
                    );
                }
                setPageLoading(false);
            })
            .catch(() => {
                if (!mounted) return;
                toast.error('Failed to load problem');
                navigate('/student/problems');
            })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [problemId]);

    // ───── security ───────────────────────────────────────────────────────────
    useEffect(() => {
        const cleanup = initSecurityFeatures(() =>
            toast.error('⚠️ Developer tools are restricted here.', { duration: 5000 })
        );
        return cleanup;
    }, []);

    useEffect(() => {
        if (!editorRef.current) return;
        return initPasteDetection(editorRef, (n) => {
            setPasteAttempts(n);
            toast.error(`Paste blocked! Attempts: ${n}`);
        });
    }, [editorRef.current]);

    // ───── auto-switch to results tab + trigger success pop ────────────────────
    useEffect(() => {
        if (runResult || submitResult || execError) {
            setBottomTab('results');
            if (activeResultCase === undefined || activeResultCase === null) setActiveResultCase(0);
        }
        // Show success overlay on accepted submission
        if (submitResult?.verdict === 'Accepted') {
            const timer = setTimeout(() => {
                setSuccessResult(submitResult);
                setShowSuccessPop(true);
            }, 400);
            return () => clearTimeout(timer);
        }
    }, [runResult, submitResult, execError]);

    // ───── compilation error markers ─────────────────────────────────────────
    const activeResult = submitResult || runResult;
    const isCompileErr = activeResult?.verdict === 'Compilation Error';
    const compileErrMsg = activeResult?.error || execError;

    useEffect(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;
        if (!editor || !monaco) return;
        const model = editor.getModel();
        if (!model) return;

        monaco.editor.setModelMarkers(model, 'owner', []);

        if (isCompileErr && compileErrMsg) {
            const markers = [];
            const lines = compileErrMsg.split('\n');
            const patterns = [
                /:(\\d+):(\\d+): error:/,
                /:(\\d+): error:/,
                /line (\\d+)/i,
                /:(\\d+)/
            ];
            for (const line of lines) {
                let match = null;
                for (const pattern of patterns) {
                    match = line.match(pattern);
                    if (match) break;
                }
                if (match) {
                    const lineNum = parseInt(match[1], 10);
                    if (!isNaN(lineNum) && lineNum > 0 && lineNum <= model.getLineCount()) {
                        markers.push({
                            startLineNumber: lineNum,
                            startColumn: 1,
                            endLineNumber: lineNum,
                            endColumn: model.getLineMaxColumn(lineNum),
                            message: line.trim(),
                            severity: monaco.MarkerSeverity.Error
                        });
                    }
                }
            }
            if (markers.length > 0) monaco.editor.setModelMarkers(model, 'owner', markers);
        }
    }, [isCompileErr, compileErrMsg]);

    // ═══ Drag Resize Logic ════════════════════════════════════════════════════
    const dragging = useRef(null);

    const onMouseMoveResize = useCallback((e) => {
        const d = dragging.current;
        if (!d || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (d.type === 'sidebar') {
            setSidebarW(Math.min(30, Math.max(12, d.startVal + (e.clientX - d.startX) / rect.width * 100)));
        } else if (d.type === 'desc') {
            setDescW(Math.min(50, Math.max(20, d.startVal + (e.clientX - d.startX) / rect.width * 100)));
        } else if (d.type === 'editorH') {
            setEditorTopH(Math.min(85, Math.max(15, d.startVal + (e.clientY - d.startY) / rect.height * 100)));
        }
    }, []);

    const onMouseUpResize = useCallback(() => {
        dragging.current = null;
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', onMouseMoveResize);
        window.addEventListener('mouseup', onMouseUpResize);
        return () => {
            window.removeEventListener('mousemove', onMouseMoveResize);
            window.removeEventListener('mouseup', onMouseUpResize);
        };
    }, [onMouseMoveResize, onMouseUpResize]);

    const startDrag = (type, e) => {
        e.preventDefault();
        setIsResizing(true);
        document.body.style.cursor = type === 'editorH' ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';
        dragging.current = {
            type,
            startX: e.clientX,
            startY: e.clientY,
            startVal: type === 'sidebar' ? sidebarW : type === 'desc' ? descW : editorTopH,
        };
    };

    // ───── handlers ──────────────────────────────────────────────────────────
    const handleRun = async () => {
        setBottomTab('results');
        setEditorTopH(35);
        setResultsAnimKey(k => k + 1);
        setActiveResultCase(0);

        const monaco = monacoRef.current;
        const editor = editorRef.current;
        if (monaco && editor) monaco.editor.setModelMarkers(editor.getModel(), 'owner', []);
        if (!code.trim()) return toast.error('Code cannot be empty');
        await runCode(problemId, code, language, isCustomInput ? customInputVal : undefined);
    };

    const handleSubmit = async () => {
        setBottomTab('results');
        setEditorTopH(35);
        setResultsAnimKey(k => k + 1);
        setActiveResultCase(0);

        const monaco = monacoRef.current;
        const editor = editorRef.current;
        if (monaco && editor) monaco.editor.setModelMarkers(editor.getModel(), 'owner', []);
        if (!code.trim()) return toast.error('Code cannot be empty');
        // if (!window.confirm('Submit solution? This will be tracked.')) return;
        await submitCode(problemId, code, language);
    };

    const handleLangChange = (e) => {
        const l = e.target.value;
        setLanguage(l);
        if (!code.trim() || code === DEFAULT_CODE[language]) setCode(DEFAULT_CODE[l]);
    };

    // ───── derived ───────────────────────────────────────────────────────────
    if (pageLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-white">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
                    <p className="text-sm text-gray-500 font-medium">Loading workspace…</p>
                </div>
            </div>
        );
    }
    if (!problem) return null;

    if (!problem) return null;

    // Responsive width calculation
    // If sidebar is shown, it takes `sidebarW` %. If hidden, it takes fixed `COLLAPSED_SIDEBAR_WIDTH` px.
    // Desc takes `descW` %.
    // Right panel (Editor) takes REST.
    const containerStyle = {
        gridTemplateColumns: showSidebar
            ? `${sidebarW}% ${descW}% 1fr`
            : `${COLLAPSED_SIDEBAR_WIDTH}px ${descW}% 1fr`,
    };

    // ─── Result data ───────────────────────────────────────────────────────────
    // Unified single result object (prefer submitResult then runResult)
    const displayResult = submitResult || runResult || null;
    const displayResults = displayResult?.results || [];

    // Count visible (non-hidden) results for tabs display
    const visibleResults = displayResult?.isSubmitMode
        ? displayResults // show all (hidden shows locked card)
        : displayResults;

    // Determine executing state
    const isExecuting = running || submitting;
    const totalTestCasesForProgress = problem?.testCases?.length || testCases.length || 3;

    return (
        <div
            ref={containerRef}
            className={`flex flex-col bg-white text-gray-800 select-none overflow-hidden
                ${isFullScreen ? 'fixed inset-0 z-50 h-screen' : 'h-[calc(100vh-64px)]'}`}
        >


            {/* ── Main 3‑column area ─────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* ─ Col 1: Sidebar ─ */}
                <div
                    style={{ width: showSidebar ? `${sidebarW}%` : `${COLLAPSED_SIDEBAR_WIDTH}px` }}
                    className="relative flex flex-col overflow-hidden shrink-0 border-r border-gray-200 bg-white transition-all duration-300 ease-in-out"
                >
                    {showSidebar ? (
                        <ProblemSidebar />
                    ) : (
                        <div className="flex-1 flex flex-col items-center py-6 gap-6 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setShowSidebar(true)}>
                            <div className="p-2 rounded-lg bg-white border border-gray-200 shadow-sm text-gray-400">
                                <List size={20} />
                            </div>
                            <div style={{ writingMode: 'vertical-rl' }} className="text-xs font-bold text-gray-500 tracking-widest uppercase select-none flex items-center gap-2">
                                <span className="rotate-180">Problem List</span>
                            </div>
                        </div>
                    )}

                    {/* Toggle Arrow at Middle */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowSidebar(!showSidebar); }}
                        className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-md text-gray-500 hover:text-primary-600 hover:border-primary-200 transition-all hover:scale-110"
                        title={showSidebar ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                        {showSidebar ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                    </button>
                </div>

                {showSidebar && <DragHandleH onMouseDown={(e) => startDrag('sidebar', e)} />}

                {/* ─ Col 2: Description / Editorial / Submissions ─ */}
                <div style={{ width: `${descW}%` }} className="flex flex-col overflow-hidden shrink-0 border-r border-gray-200 bg-white">
                    {/* Problem Header (Title & Meta) */}
                    <div className="px-5 py-4 border-b border-gray-200 bg-gray-50/40 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <h1 className="text-lg font-bold text-gray-900 leading-tight truncate mr-2" title={problem.title}>
                                {problem.title}
                            </h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <DiffBadge d={problem.difficulty} />
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#92400e', background: 'linear-gradient(135deg,#fffbeb,#fef3c7)', border: '1px solid #fcd34d', padding: '2px 7px', borderRadius: 20 }}>
                                <Coins size={10} color="#f59e0b" />{problem.points} pts
                            </span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center h-10 border-b border-gray-200 bg-white shrink-0">
                        {[
                            { id: 'description', label: 'Description', Icon: FileText },
                            { id: 'editorial', label: 'Editorial', Icon: BookOpenIcon },
                            { id: 'submissions', label: 'Submissions', Icon: CheckSquare },
                        ].map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                onClick={() => setLeftTab(id)}
                                className={`flex items-center gap-1.5 px-4 h-full text-xs font-medium transition-colors border-b-2
                                    ${leftTab === id
                                        ? 'border-primary-600 text-primary-700 bg-white'
                                        : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                                    }`}
                            >
                                <Icon size={12} />{label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-y-auto relative">
                        {loading && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex justify-center items-center">
                                <Loader2 className="animate-spin text-primary-500" size={24} />
                            </div>
                        )}

                        {/* ── Description ── */}
                        {leftTab === 'description' && (
                            <div className="p-6 space-y-6">
                                <div
                                    className="prose prose-sm max-w-none text-gray-700 prose-code:text-primary-700 prose-code:bg-primary-50 prose-code:px-1 prose-code:rounded"
                                    dangerouslySetInnerHTML={{ __html: problem.description }}
                                />

                                {problem.examples?.map((ex, i) => (
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

                                {problem.constraints?.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Constraints</h3>
                                        <ul className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1">
                                            {problem.constraints.map((c, i) => (
                                                <li key={i} className="text-xs font-mono text-gray-700 list-disc list-inside">{c}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Editorial ── */}
                        {leftTab === 'editorial' && (
                            <div className="p-6 space-y-6">
                                {problem.editorial?.approach ? (
                                    <>
                                        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                            <h3 className="font-bold text-gray-900 mb-3">Approach</h3>
                                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                                {problem.editorial.approach}
                                            </p>
                                        </div>
                                        {problem.editorial.solution && (
                                            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
                                                    <Code2 size={12} /> Solution
                                                </div>
                                                <div className="h-56">
                                                    <Editor
                                                        height="100%"
                                                        language={language}
                                                        value={problem.editorial.solution}
                                                        theme="vs-light"
                                                        options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, padding: { top: 12 } }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {problem.editorial.complexity && (
                                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Complexity</h3>
                                                <p className="text-sm text-gray-700">{problem.editorial.complexity}</p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                                        <BookOpenIcon size={48} className="opacity-20 mb-3" />
                                        <p className="text-sm">Editorial not available yet.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Submissions ── */}
                        {leftTab === 'submissions' && <SubmissionsTab problemId={problemId} />}
                    </div>
                </div>

                {/* drag handle between desc and editor */}
                <DragHandleH onMouseDown={(e) => startDrag('desc', e)} />

                {/* ─ Col 3: Editor + Test Cases (vertical split) ─ */}
                <div style={{ width: showSidebar ? `calc(${100 - sidebarW - descW}%)` : `calc(100% - ${COLLAPSED_SIDEBAR_WIDTH}px - ${descW}%)` }} className="flex flex-col overflow-hidden bg-white">

                    {/* ── Code Editor ── */}
                    {/* ── Code Editor ── */}
                    <div
                        style={{ height: `${editorTopH}%`, transition: isResizing ? 'none' : 'height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
                        className="flex flex-col overflow-hidden"
                    >
                        {/* editor toolbar (Language + Timer + Actions) */}
                        <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-3 shrink-0">
                            {/* Left: Language & Timer */}
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <select
                                        value={language}
                                        onChange={handleLangChange}
                                        className="bg-gray-50 border border-gray-200 text-xs font-medium text-gray-700 rounded-md py-1.5 pl-2.5 pr-8 outline-none focus:ring-1 focus:ring-primary-400 cursor-pointer appearance-none hover:bg-gray-100 transition-colors"
                                    >
                                        {LANGUAGE_OPTIONS.map(o => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                                <div className="h-5 w-px bg-gray-200" />
                                <ProblemTimer />
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2">
                                {pasteAttempts > 0 && (
                                    <span className="text-xs text-red-500 font-medium hidden lg:flex items-center gap-1 mr-2" title={`${pasteAttempts} paste attempts blocked`}>
                                        <AlertTriangle size={14} /> <span className="hidden xl:inline">Paste Limit:</span> {pasteAttempts}
                                    </span>
                                )}

                                <div className="flex items-center bg-gray-100 border border-gray-200 rounded-lg p-0.5">
                                    <button
                                        onClick={handleRun}
                                        disabled={isExecuting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 rounded-md hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
                                        title="Run Sample Cases"
                                    >
                                        {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
                                        <span className="hidden sm:inline">Run</span>
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isExecuting}
                                        className="flex items-center gap-1.5 px-3 py-1.5 ml-0.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm transition-all disabled:opacity-50"
                                        title="Submit Code"
                                    >
                                        {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                        <span className="hidden sm:inline">Submit</span>
                                    </button>
                                </div>

                                <button
                                    onClick={() => setIsFullScreen(f => !f)}
                                    className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                    title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
                                >
                                    {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* monaco */}
                        <div className="flex-1 overflow-hidden">
                            <Editor
                                height="100%"
                                language={LANGUAGE_OPTIONS.find(l => l.value === language)?.monacoLang}
                                value={code}
                                onChange={v => setCode(v || '')}
                                onMount={(editor, monaco) => {
                                    editorRef.current = editor;
                                    monacoRef.current = monaco;
                                }}
                                theme="vs-light"
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                                    fontLigatures: true,
                                    lineNumbers: 'on',
                                    renderLineHighlight: 'all',
                                    scrollBeyondLastLine: false,
                                    automaticLayout: true,
                                    padding: { top: 16, bottom: 16 },
                                }}
                            />
                        </div>
                    </div>

                    <DragHandleV onMouseDown={(e) => startDrag('editorH', e)} />

                    {/* ── Bottom: Test Cases / Results ── */}
                    {/* ── Bottom: Test Cases / Results ── */}
                    <div
                        key={resultsAnimKey}
                        style={{ height: `${100 - editorTopH}%`, transition: isResizing ? 'none' : 'height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
                        className="flex flex-col overflow-hidden border-t border-gray-100"
                        data-results-panel
                    >
                        {/* bottom tabs */}
                        <div className="flex items-center h-9 border-b border-gray-200 bg-gray-50 shrink-0 px-1">
                            <button
                                onClick={() => setBottomTab('testcases')}
                                className={`flex items-center gap-1.5 px-4 h-full text-xs font-medium transition-colors border-b-2
                                    ${bottomTab === 'testcases' ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                            >
                                <List size={12} /> Test Cases
                            </button>

                            <button
                                onClick={() => setBottomTab('results')}
                                className={`flex items-center gap-1.5 px-4 h-full text-xs font-medium transition-colors border-b-2
                                    ${bottomTab === 'results' ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100'}`}
                            >
                                {isCompileErr ? (
                                    <span className="flex items-center gap-1.5 text-orange-600">
                                        <AlertTriangle size={12} /> Compilation Error
                                    </span>
                                ) : displayResult && !isExecuting ? (
                                    <span className={`flex items-center gap-1.5 ${displayResult.verdict === 'Accepted' ? 'text-green-600' : 'text-red-600'}`}>
                                        {displayResult.verdict === 'Accepted'
                                            ? <CheckCircle size={12} />
                                            : <XCircle size={12} />
                                        }
                                        {displayResult.isSubmitMode ? 'Submission Result' : 'Run Result'}
                                    </span>
                                ) : (
                                    <>
                                        <Terminal size={12} /> Results
                                    </>
                                )}
                            </button>
                        </div>

                        {/* bottom content */}
                        <div className="flex-1 overflow-hidden bg-white">

                            {/* ── Test Cases tab ── */}
                            {bottomTab === 'testcases' && (
                                <div className="flex flex-col h-full">
                                    {/* Header Actions */}
                                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
                                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
                                            {/* Sample Test Case tabs (visible, non-hidden) */}
                                            {!isCustomInput && testCases.map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setActiveInputCase(i)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                                                        ${activeInputCase === i
                                                            ? 'bg-gray-100 text-gray-900 font-semibold'
                                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    Case {i + 1}
                                                </button>
                                            ))}
                                            {isCustomInput && (
                                                <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100">
                                                    Custom Input
                                                </span>
                                            )}
                                        </div>

                                        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none ml-2">
                                            <input
                                                type="checkbox"
                                                checked={isCustomInput}
                                                onChange={(e) => setIsCustomInput(e.target.checked)}
                                                className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            Custom Input
                                        </label>
                                    </div>

                                    {/* Inputs Area */}
                                    <div className="flex-1 p-4 overflow-y-auto">
                                        {isCustomInput ? (
                                            <div className="space-y-2 h-full flex flex-col">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Your Input</p>
                                                <textarea
                                                    className="flex-1 w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-800 focus:ring-1 focus:ring-primary-400 focus:border-primary-400 outline-none resize-none"
                                                    value={customInputVal}
                                                    onChange={(e) => setCustomInputVal(e.target.value)}
                                                    placeholder="Enter input here..."
                                                />
                                            </div>
                                        ) : (
                                            testCases[activeInputCase] && (
                                                <div className="space-y-4 max-w-2xl">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Input</p>
                                                        <textarea
                                                            className="w-full h-auto min-h-[50px] bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-800 focus:ring-1 focus:ring-primary-400 focus:border-primary-400 outline-none resize-none"
                                                            rows={3}
                                                            value={testCases[activeInputCase].input}
                                                            readOnly
                                                        />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Expected Output</p>
                                                        <textarea
                                                            className="w-full h-auto min-h-[50px] bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-600 outline-none resize-none opacity-80 cursor-not-allowed"
                                                            rows={3}
                                                            value={testCases[activeInputCase].output}
                                                            readOnly
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Results tab ── */}
                            {bottomTab === 'results' && (
                                <div className="h-full overflow-y-auto flex flex-col" style={{ animation: 'slide-up-results 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>

                                    {/* ── Executing (live progress) ── */}
                                    {isExecuting && (
                                        <ExecutionProgress
                                            isRunning={running}
                                            isSubmitting={submitting}
                                            total={submitting ? totalTestCasesForProgress : testCases.length || 3}
                                        />
                                    )}

                                    {/* ── Compilation Error ── */}
                                    {!isExecuting && isCompileErr && (
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
                                                    {compileErrMsg || 'Unknown error'}
                                                </pre>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Has results ── */}
                                    {!isExecuting && !isCompileErr && displayResult && (
                                        <div className="flex flex-col h-full">
                                            {/* ── LeetCode-style Verdict Header ── */}
                                            {(() => {
                                                const vc = getVerdictColor(displayResult.verdict);
                                                const isAccepted = displayResult.verdict === 'Accepted';
                                                return (
                                                    <div className={`px-5 py-4 border-b shrink-0 ${vc.bg} ${vc.border}`}>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2 rounded-full ${isAccepted ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                                    {isAccepted ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                                                </div>
                                                                <div>
                                                                    <h2 className={`text-lg font-bold ${vc.text}`}>
                                                                        {displayResult.verdict}
                                                                    </h2>
                                                                    {/* LeetCode-style: X / Y testcases passed */}
                                                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                                        <span className={`text-sm font-medium ${vc.text}`}>
                                                                            {displayResult.isCustomInput
                                                                                ? 'Custom Input'
                                                                                : `${displayResult.testCasesPassed} / ${displayResult.totalTestCases} testcases passed`
                                                                            }
                                                                        </span>
                                                                        {displayResult.isSubmitMode && !displayResult.isCustomInput && (
                                                                            <span className="text-xs text-gray-500">All Test Cases</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Coins earned badge (submit only) */}
                                                            {displayResult.isSubmitMode && displayResult.coinsEarned > 0 && (
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-bold">
                                                                        <Coins size={14} />
                                                                        +{displayResult.coinsEarned} Alpha Coins
                                                                    </span>
                                                                    {displayResult.totalCoins > 0 && (
                                                                        <span className="text-[10px] text-amber-500 font-medium">
                                                                            Total: {displayResult.totalCoins} coins
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* ── Test Case Tabs (LeetCode style) ── */}
                                            {visibleResults.length > 0 && (
                                                <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 overflow-x-auto scrollbar-hide shrink-0 bg-white">
                                                    {visibleResults.map((r, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => setActiveResultCase(i)}
                                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border
                                                                ${activeResultCase === i
                                                                    ? `${r.passed
                                                                        ? 'bg-green-50 border-green-300 text-green-700'
                                                                        : 'bg-red-50 border-red-300 text-red-700'
                                                                    } font-semibold`
                                                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.passed ? 'bg-green-500' : 'bg-red-500'}`} />
                                                            {displayResult.isSubmitMode && r.isHidden
                                                                ? `Hidden ${i + 1}`
                                                                : `Case ${i + 1}`
                                                            }
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* ── Result Details ── */}
                                            <div className="flex-1 p-4 overflow-y-auto">
                                                {visibleResults[activeResultCase] ? (
                                                    <div className="space-y-4 max-w-3xl">
                                                        {/* Hidden test case placeholder */}
                                                        {visibleResults[activeResultCase].isHidden ? (
                                                            <div className={`p-10 text-center border-2 border-dashed rounded-xl ${visibleResults[activeResultCase].passed ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                                                                <Lock size={24} className={`mx-auto mb-3 ${visibleResults[activeResultCase].passed ? 'text-green-400' : 'text-red-400'}`} />
                                                                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Hidden Test Case</p>
                                                                <p className={`text-sm font-semibold mt-2 ${visibleResults[activeResultCase].passed ? 'text-green-600' : 'text-red-600'}`}>
                                                                    {visibleResults[activeResultCase].passed ? '✓ Passed' : '✗ Failed'}
                                                                </p>
                                                                <p className="text-[10px] text-gray-400 mt-1">Input and expected output are hidden</p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {/* Pass / Fail badge */}
                                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${visibleResults[activeResultCase].passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {visibleResults[activeResultCase].passed
                                                                        ? <><CheckCircle size={12} /> Passed</>
                                                                        : <><XCircle size={12} /> {visibleResults[activeResultCase].verdict || 'Failed'}</>
                                                                    }
                                                                </div>

                                                                {/* Input + Expected side by side */}
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Input</p>
                                                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-800 whitespace-pre-wrap min-h-[48px]">
                                                                            {visibleResults[activeResultCase].input ?? <span className="text-gray-400 italic">N/A</span>}
                                                                        </div>
                                                                    </div>
                                                                    {/* Show expected output for normal test cases in grid */}
                                                                    {(!displayResult.isCustomInput) && (
                                                                        <div>
                                                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Expected Output</p>
                                                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-600 whitespace-pre-wrap min-h-[48px]">
                                                                                {visibleResults[activeResultCase].expectedOutput ?? <span className="text-gray-400 italic">N/A</span>}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Custom input: expected output (no badge, clean display) */}
                                                                {displayResult.isCustomInput && (
                                                                    visibleResults[activeResultCase].expectedOutput &&
                                                                        visibleResults[activeResultCase].expectedOutput !== '(No reference solution available)' ? (
                                                                        <div>
                                                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Expected Output</p>
                                                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-600 whitespace-pre-wrap min-h-[48px]">
                                                                                {visibleResults[activeResultCase].expectedOutput}
                                                                            </div>
                                                                        </div>
                                                                    ) : null
                                                                )}


                                                                {/* Your Output */}
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Your Output</p>
                                                                    <div className={`rounded-lg p-3 text-xs font-mono whitespace-pre-wrap border min-h-[48px]
                                                                        ${visibleResults[activeResultCase].passed
                                                                            ? 'bg-green-50/40 border-green-200 text-gray-900'
                                                                            : 'bg-red-50/40 border-red-200 text-gray-900'
                                                                        }`}
                                                                    >
                                                                        {visibleResults[activeResultCase].actualOutput || <span className="text-gray-400 italic">No output</span>}
                                                                    </div>
                                                                </div>

                                                                {/* Runtime error / stderr */}
                                                                {visibleResults[activeResultCase].error && (
                                                                    <div>
                                                                        <p className="text-[10px] font-bold text-red-500 uppercase mb-1.5">Error / Traceback</p>
                                                                        <pre className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap">
                                                                            {visibleResults[activeResultCase].error}
                                                                        </pre>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                                                        No result data for this case.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── No results yet ── */}
                                    {!isExecuting && !displayResult && !execError && (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                                            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                                                <Play size={20} className="ml-1 text-gray-300" />
                                            </div>
                                            <p className="text-sm font-medium">Run code to view results</p>
                                        </div>
                                    )}

                                    {/* ── Generic error (no results) ── */}
                                    {!isExecuting && execError && !displayResult && (
                                        <div className="p-4">
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                <p className="text-xs font-bold text-red-600 mb-2">Error</p>
                                                <p className="text-xs text-red-700">{execError}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Success Pop Overlay ── */}
            {showSuccessPop && (
                <SuccessPopOverlay
                    result={successResult}
                    points={problem?.points}
                    onClose={() => { setShowSuccessPop(false); setSuccessResult(null); }}
                />
            )}
        </div>
    );
};

export default CodeEditor;
