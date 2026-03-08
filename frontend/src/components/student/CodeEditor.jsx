import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Play, CheckCircle, AlertTriangle, ChevronDown, Maximize2, Minimize2, Loader2, Code2, FileText, List, CheckSquare, Terminal, Coins, Lock, XCircle, Clock, Pause, ChevronLeft, ChevronRight, Settings, MoreVertical, X, PanelLeft, Plus, Trash2, Save, Edit3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import submissionService from '../../services/submissionService';
import problemService from '../../services/problemService';
import useCodeExecution from '../../hooks/useCodeExecution';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import toast from 'react-hot-toast';
import ProblemSidebar from './ProblemSidebar';
import SubmissionsTab from './SubmissionsTab';
import EditorialRenderer from './EditorialRenderer';
import { GoSidebarCollapse, GoSidebarExpand } from 'react-icons/go';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import CustomDropdown from '../../components/shared/CustomDropdown';

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

const MarkdownComponents = {
    h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-5 mb-3">{children}</h1>,
    h2: ({ children }) => <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-5 mb-2">{children}</h2>,
    h3: ({ children }) => <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-1.5">{children}</h3>,
    p: ({ children }) => <p className="text-gray-700 dark:text-gray-300 text-[14px] leading-6 mb-3 whitespace-pre-wrap break-words">{children}</p>,
    ul: ({ children }) => <ul className="text-gray-700 dark:text-gray-300 text-[14px] list-disc list-outside ml-4 mb-3 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="text-gray-700 dark:text-gray-300 text-[14px] list-decimal list-outside ml-4 mb-3 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="pl-1 leading-6 break-words">{children}</li>,
    blockquote: ({ children }) => <blockquote className="border-l-4 border-primary-400 dark:border-gray-500 pl-4 py-1 italic text-gray-500 dark:text-gray-400 my-3 bg-primary-50 dark:bg-[#23232e] rounded-r">{children}</blockquote>,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline break-all">{children}</a>,
    img: ({ src, alt }) => <img src={src} alt={alt} className="max-w-full rounded-xl border border-gray-200 dark:border-gray-700 my-4 shadow-sm" />,
    code: ({ inline, className, children }) => {
        const content = String(children).replace(/\n$/, '');
        const match = /language-(\w+)/.exec(className || '');
        if (inline || (!match && !content.includes('\n'))) {
            return <code className="bg-primary-50 dark:bg-[#23232e] text-primary-700 dark:text-gray-200 px-1 py-0.5 rounded text-sm font-mono break-all">{children}</code>;
        }
        return <pre className="my-3 p-3 overflow-x-auto text-sm font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg">{children}</pre>;
    }
};

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

const SuccessPopOverlay = ({ result, onClose }) => {
    const [visible, setVisible] = useState(false);
    // Only show coins that were actually earned — no fallback to problem points
    const coins = result?.coinsEarned ?? 0;

    useEffect(() => {
        // Pre-set visibility to trigger entry transitions immediately
        setVisible(true);
        const t = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 400);
        }, 3000); // slightly longer to ensure full coin cycle
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
                    speed={1.5}
                    renderConfig={{
                        devicePixelRatio: window.devicePixelRatio || 2, // Forces high-res rendering
                    }}
                />
            </div>

            {/* +N coins + label */}
            {coins > 0 && (
                <div style={{
                    textAlign: 'center', marginTop: -20,
                    transform: visible ? 'scale(1) translateY(0)' : 'scale(0.4) translateY(30px)',
                    opacity: visible ? 1 : 0,
                    transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s',
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
    <div onMouseDown={onMouseDown} className="w-1.5 bg-gray-50 dark:bg-[#111117] hover:bg-purple-100 dark:hover:bg-purple-900/30 border-l border-r border-gray-100 dark:border-gray-700 cursor-col-resize shrink-0 transition-colors z-10 relative group flex flex-col justify-center items-center">
        <div className="h-4 w-0.5 bg-gray-300 dark:bg-gray-600 rounded-full group-hover:bg-purple-400" />
    </div>
);

const DragHandleV = ({ onMouseDown }) => (
    <div onMouseDown={onMouseDown} className="h-1.5 bg-gray-50 dark:bg-[#111117] hover:bg-purple-100 dark:hover:bg-purple-900/30 border-t border-b border-gray-100 dark:border-gray-700 cursor-row-resize shrink-0 transition-colors z-10 relative flex justify-center items-center group">
        <div className="w-4 h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full group-hover:bg-purple-400" />
    </div>
);

// ─── Module-level Cache for Problems & Submissions ───────────────────────────
const PROBLEM_CACHE = {};
const PENDING_PROBLEM_CALLS = {};
// { [problemId]: Submission[] } — avoids re-fetching on language switch
const SUBMISSIONS_CACHE = {};
const PENDING_SUBMISSIONS_CALLS = {};

// ─── Language & template data ────────────────────────────────────────────────
const LANGUAGE_OPTIONS = [
    { value: 'c', label: 'C', monacoLang: 'c' },
    { value: 'cpp', label: 'C++', monacoLang: 'cpp' },
    { value: 'java', label: 'Java', monacoLang: 'java' },
    { value: 'python', label: 'Python 3', monacoLang: 'python' },
    { value: 'javascript', label: 'JavaScript', monacoLang: 'javascript' },
    { value: 'csharp', label: 'C#', monacoLang: 'csharp' },
];

const DEFAULT_CODE = {
    c: '#include <stdio.h>\n\nint main() {\n    // your code\n    return 0;\n}',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // your code\n    return 0;\n}',
    java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // your code\n    }\n}',
    python: '# Write your Python code here\n',
    javascript: '// Write your JavaScript code here\n',
    csharp: 'using System;\nusing System.Collections.Generic;\nusing System.Linq;\n\nclass Program {\n    static void Main() {\n        // your code\n    }\n}',
};

// ─── Difficulty badge ───────────────────────────────────────────────────────
const DiffBadge = ({ d }) => {
    const { isDark } = useTheme();
    const styles = {
        Easy: {
            background: isDark ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
            color: isDark ? '#4ade80' : '#166534',
            border: isDark ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid #bbf7d0'
        },
        Medium: {
            background: isDark ? 'rgba(234, 179, 8, 0.15)' : '#fef9c3',
            color: isDark ? '#facc15' : '#854d0e',
            border: isDark ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid #fde047'
        },
        Hard: {
            background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
            color: isDark ? '#f87171' : '#991b1b',
            border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fca5a5'
        },
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
    return {
        text: verdict === 'Accepted' ? 'text-green-600 dark:text-green-400' :
            verdict === 'Compilation Error' ? 'text-orange-600 dark:text-orange-400' :
                verdict === 'TLE' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
        bg: verdict === 'Accepted' ? 'bg-green-50 dark:bg-green-900/10' :
            verdict === 'Compilation Error' ? 'bg-orange-50 dark:bg-orange-900/10' :
                verdict === 'TLE' ? 'bg-yellow-50 dark:bg-yellow-900/10' : 'bg-red-50 dark:bg-red-900/10',
        border: verdict === 'Accepted' ? 'border-green-100 dark:border-green-900/30' :
            verdict === 'Compilation Error' ? 'border-orange-100 dark:border-orange-900/30' :
                verdict === 'TLE' ? 'border-yellow-100 dark:border-yellow-900/30' : 'border-red-100 dark:border-red-900/30'
    };
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
        <div className="flex flex-col h-full items-center justify-center gap-4 px-8 bg-white dark:bg-[#111117] transition-colors">
            <div className="text-center">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {label} test cases...
                </p>
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {count} <span className="text-gray-400 dark:text-gray-500 text-lg font-normal">/ {total}</span>
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
    const [isRunning, setIsRunning] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

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
        <div className="flex items-center gap-2 bg-gray-100/80 dark:bg-[#111117]/80 hover:bg-gray-100 dark:hover:bg-gray-700/80 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 transition-colors">
            <Clock size={14} className="text-gray-500 dark:text-gray-400" />
            <span className="font-mono text-sm font-medium text-gray-700 dark:text-gray-200 min-w-[48px] text-center">
                {formatTime(seconds)}
            </span>
            <button
                onClick={() => setIsRunning(!isRunning)}
                className="ml-1 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
                title={isRunning ? "Pause Timer" : "Resume Timer"}
            >
                {isRunning ? <Pause size={12} className="fill-current" /> : <Play size={12} className="fill-current" />}
            </button>
        </div>
    );
};

// ─── Settings Modal ────────────────────────────────────────────────────────
const SettingsModal = ({ settings, onClose, onSave }) => {
    const { isDark } = useTheme();
    const [fontSize, setFontSize] = useState(settings.fontSize || 14);
    const [theme, setTheme] = useState(settings.theme || 'vs-light');
    const [fontFamily, setFontFamily] = useState(settings.fontFamily || 'Menlo, Monaco, Consolas, "Courier New", monospace');

    const FONTS = [
        { value: 'Menlo, Monaco, Consolas, "Courier New", monospace', label: 'Default (Menlo/Monaco)' },
        { value: "'JetBrains Mono', 'Fira Code', Consolas, monospace", label: 'JetBrains Mono' },
        { value: "'Fira Code', monospace", label: 'Fira Code' },
        { value: "'Roboto Mono', monospace", label: 'Roboto Mono' },
        { value: "'Source Code Pro', monospace", label: 'Source Code Pro' },
        { value: "Consolas, monospace", label: 'Consolas' },
    ];

    const handleSave = () => {
        onSave({ fontSize: parseInt(fontSize), fontFamily });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[1001] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 transition-colors" onClick={onClose}>
            <div className={`bg-white dark:bg-[#111117] rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md flex flex-col animate-in zoom-in-95 duration-200 transition-colors ${!isDark ? 'shadow-2xl' : ''}`} onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-[#111117] shrink-0 rounded-t-2xl transition-colors">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">Editor Settings</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><XCircle size={18} /></button>
                </div>

                <div className="p-6 overflow-visible flex-1 space-y-7 transition-colors">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Font Size</label>
                        <div className={`flex items-center gap-4 bg-gray-50 dark:bg-[#111117] p-4 rounded-xl border border-gray-100 dark:border-gray-700 transition-colors ${!isDark ? 'shadow-sm' : ''}`}>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Min</span>
                            <input
                                type="range" min="10" max="24"
                                value={fontSize} onChange={(e) => setFontSize(e.target.value)}
                                className="flex-1 accent-primary-600 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className={`text-sm font-mono font-bold text-primary-600 dark:text-primary-400 w-10 text-center bg-white dark:bg-[#111117] py-1 rounded border border-gray-100 dark:border-gray-700 transition-colors ${!isDark ? 'shadow-sm' : ''}`}>{fontSize}px</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Font Style</label>
                        <CustomDropdown
                            options={FONTS}
                            value={fontFamily}
                            onChange={(val) => setFontFamily(val)}
                        />
                    </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-[#111117] border-t border-gray-100 dark:border-gray-700 flex justify-end rounded-b-2xl transition-colors">
                    <button
                        onClick={handleSave}
                        className={`px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95 ${!isDark ? 'shadow-lg shadow-primary-500/20' : ''}`}
                    >
                        Apply Changes
                    </button>
                </div>
            </div>
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
    const lastResultIdRef = useRef(null);
    // ── prefetch success animation ──
    useEffect(() => {
        // Reset process tracker when problem changes
        lastResultIdRef.current = null;
        // Preload lottie to avoid slow first load — browser will cache it
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = COIN_LOTTIE_URL;
        document.head.appendChild(link);
    }, [problemId]);
    const [hasViewedEditorial, setHasViewedEditorial] = useState(false);
    const [pageLoading, setPageLoading] = useState(!!problemId);
    const [loading, setLoading] = useState(!!problemId);
    const { user } = useAuth();
    const { isDark } = useTheme();

    // ── settings & persistence ──
    const [showSettings, setShowSettings] = useState(false);
    const [editorSettings, setEditorSettings] = useState(() => {
        const saved = localStorage.getItem('editor_settings');
        return saved ? JSON.parse(saved) : { fontSize: 14, theme: 'antigravity-dark', fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace' };
    });

    // ── quiz / material ──
    const [quizAnswers, setQuizAnswers] = useState({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [isSubmittingNonCoding, setIsSubmittingNonCoding] = useState(false);

    // ── custom test cases ──
    // Standard cases are 'case-0', 'case-1'...
    // Custom users are 'custom-1'...
    // We mix them in UI.
    const [customTestCases, setCustomTestCases] = useState([]);
    const [activeTestCaseId, setActiveTestCaseId] = useState('case-0');

    // Reset cases on problem change
    useEffect(() => {
        setCustomTestCases([]);
        setActiveTestCaseId('case-0');
        setQuizAnswers({});
        setQuizSubmitted(false);
        setIsSubmittingNonCoding(false);
    }, [problemId]);

    const handleAddCustomCase = () => {
        const newId = Date.now();
        setCustomTestCases(prev => [...prev, { id: newId, input: '' }]);
        setActiveTestCaseId(`custom-${newId}`);
    };

    const handleRemoveCustomCase = (id, e) => {
        e.stopPropagation();
        setCustomTestCases(prev => prev.filter(c => c.id !== id));
        if (activeTestCaseId === `custom-${id}`) {
            setActiveTestCaseId('case-0');
        }
    };

    const updateCustomCase = (val) => {
        setCustomTestCases(prev => prev.map(c =>
            `custom-${c.id}` === activeTestCaseId ? { ...c, input: val } : c
        ));
    };


    // ── editor ──
    const [language, setLanguage] = useState('cpp');
    const [code, setCode] = useState(''); // Init empty, will load from draft/submission

    // ── tabs ──
    const [leftTab, setLeftTab] = useState('description');

    const [isEditingDesc, setIsEditingDesc] = useState(false);
    const [tempDesc, setTempDesc] = useState('');
    const [isSavingDesc, setIsSavingDesc] = useState(false);
    const [bottomTab, setBottomTab] = useState('testcases');

    // ── ui misc ──
    const [isFullScreen, setIsFullScreen] = useState(false);

    const [testCases, setTestCases] = useState([]);
    const [activeResultCase, setActiveResultCase] = useState(0); // result tab index

    const [showSuccessPop, setShowSuccessPop] = useState(false);
    const [successResult, setSuccessResult] = useState(null);
    const [resultsAnimKey, setResultsAnimKey] = useState(0);
    const [isResizing, setIsResizing] = useState(false);

    const { running, submitting, runResult, submitResult, runCode, submitCode, resetResults, error: execError, isOffline } = useCodeExecution();

    // ───── fetch problem ──────────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;

        if (!problemId) {
            setPageLoading(false);
            setLoading(false);
            setShowSidebar(true);
            return;
        }

        // Check cache first
        if (PROBLEM_CACHE[problemId]) {
            const cachedData = PROBLEM_CACHE[problemId];
            setProblem(cachedData.problem);
            setHasViewedEditorial(cachedData.hasViewedEditorial || false);
            setTestCases(cachedData.testCases);
            setPageLoading(false);
            setLoading(false);
            return;
        }

        setPageLoading(true);
        setLoading(true);

        if (!PENDING_PROBLEM_CALLS[problemId]) {
            PENDING_PROBLEM_CALLS[problemId] = problemService.getProblemById(problemId);
        }

        PENDING_PROBLEM_CALLS[problemId]
            .then(data => {
                if (!mounted) return;
                setProblem(data.problem);
                setHasViewedEditorial(data.hasViewedEditorial || false);

                if (data.problem.type === 'quiz' && data.problem.isSolved) {
                    setQuizSubmitted(true);
                    if (data.problem.savedAnswers) {
                        setQuizAnswers(data.problem.savedAnswers);
                    }
                }

                // Show all non-hidden test cases
                const allCases = data.problem.testCases || [];
                const publicCases = allCases.filter(tc => !tc.isHidden);

                let loadedTestCases = [];

                if (publicCases.length > 0) {
                    loadedTestCases = publicCases.map(tc => ({ input: tc.input, output: tc.output }));
                } else {
                    const examples = data.problem.examples || [];
                    loadedTestCases = examples.length
                        ? examples.map(e => ({ input: e.input, output: e.output, explanation: e.explanation }))
                        : [{ input: '', output: '' }];
                }
                setTestCases(loadedTestCases);

                // Save to cache
                PROBLEM_CACHE[problemId] = {
                    problem: data.problem,
                    hasViewedEditorial: data.hasViewedEditorial || false,
                    testCases: loadedTestCases
                };

                setPageLoading(false);
            })
            .catch(() => {
                if (!mounted) return;
                toast.error('Failed to load problem');
                navigate('/problems');
            })
            .finally(() => {
                if (mounted) setLoading(false);
                delete PENDING_PROBLEM_CALLS[problemId];
            });
        return () => { mounted = false; };
    }, [problemId, user, navigate]);

    // ───── reset run/submit results when problem changes ─────────────────────
    useEffect(() => {
        resetResults();
        setActiveResultCase(0);
        setBottomTab('testcases');
    }, [problemId, resetResults]);

    // ───── load code draft/submission ─────────────────────────────────────────
    useEffect(() => {
        if (!problemId || !user) return;

        const loadCode = async () => {
            // 1. Check Draft
            const draftKey = `draft_${user.id}_${problemId}_${language}`;
            const draft = localStorage.getItem(draftKey);
            if (draft) {
                setCode(draft);
                return;
            }

            // 2. We no longer auto-fetch previous submissions to save backend load,
            // unless we want to rely entirely on localStorage.
            const previousSubKey = `submission_${user.id}_${problemId}_${language}`;
            const previousCode = localStorage.getItem(previousSubKey);
            if (previousCode) {
                setCode(previousCode);
                return;
            }

            // 3. Default Template
            const tplKey = `tpl_${user.id}_${language}`;
            const customTpl = localStorage.getItem(tplKey);
            setCode(customTpl || DEFAULT_CODE[language]);
        };

        loadCode();

        // 4. Fetch latest submission to show persistent result state
        const fetchLatestResult = async () => {
            try {
                const data = await submissionService.getProblemSubmissions(problemId);
                const latest = data.submissions?.[0];
                if (latest && (latest.verdict === 'Accepted' || latest.verdict === 'Wrong Answer' || latest.verdict === 'TLE' || latest.verdict === 'Runtime Error')) {
                    // Normalize to match submitResult format
                    const normalized = {
                        problemId,
                        verdict: latest.verdict,
                        testCasesPassed: latest.testCasesPassed || 0,
                        totalTestCases: latest.totalTestCases || 0,
                        results: latest.results || [], // Might be empty if backend doesn't return full results for old subs
                        error: latest.error || null,
                        coinsEarned: 0,
                        totalCoins: 0,
                        isFirstSolve: false,
                        isSubmitMode: true,
                        isCustomInput: false,
                        persisted: true
                    };
                    // Only set if we don't already have a more recent result from this session
                    setSubmitResult(prev => (prev?.persisted || !prev) ? normalized : prev);
                }
            } catch (err) {
                console.warn('Failed to fetch latest submission for persistence:', err);
            }
        };
        fetchLatestResult();

        // 5. Check sessionStorage for Run results from this session
        const cachedRunResult = sessionStorage.getItem(`run_result_${user.id}_${problemId}`);
        if (cachedRunResult) {
            try {
                setRunResult(JSON.parse(cachedRunResult));
            } catch (e) {
                sessionStorage.removeItem(`run_result_${user.id}_${problemId}`);
            }
        }
    }, [problemId, user, language]);

    // ───── save draft ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!problemId || !user || !code) return;
        const timer = setTimeout(() => {
            const draftKey = `draft_${user.id}_${problemId}_${language}`;
            localStorage.setItem(draftKey, code);
        }, 1000);
        return () => clearTimeout(timer);
    }, [code, problemId, language, user]);

    // ───── handle paste ───────────────────────────────────────────────────────
    const handleEditorPaste = (e) => {
        // Simple heuristic: if we want to block external paste, we can just block all paste
        // or try to detect if it's internal.
        // For now, block all paste as requested "no copy paste from outside"
        // This is strictly enforced.
        e.preventDefault();
        toast.error('Paste is disabled in code editor', { icon: '🚫' });
    };

    const handleSaveTemplate = (tplLang, tplCode) => {
        if (!user) return;
        localStorage.setItem(`tpl_${user.id}_${tplLang}`, tplCode);
        toast.success(`Template saved for ${tplLang}`);
        // If current lang matches, ask to apply? Or just save.
        // If current code is empty, maybe apply.
        if (tplLang === language && !code.trim()) {
            setCode(tplCode);
        }
    };


    // ───── auto-switch to results tab + trigger success pop ────────────────────
    useEffect(() => {
        if (runResult || submitResult || execError) {
            setBottomTab('results');
            if (activeResultCase === undefined || activeResultCase === null) setActiveResultCase(0);
        }

        if (submitResult?.verdict === 'Accepted' && submitResult?.problemId === problemId) {
            // Signal global state that this problem was solved
            window.dispatchEvent(new CustomEvent('problemSolved', { detail: { problemId } }));

            // Update local problem state immediately
            let wasSolvedBefore = false;
            if (problem) {
                wasSolvedBefore = problem.isSolved;
                if (!wasSolvedBefore) {
                    setProblem(p => ({ ...p, isSolved: true }));
                }
            }

            // Create a unique key for this submission to avoid double-processing
            // Back-end uses .id for the temp ID in the response
            const resKey = submitResult.submission?.id || submitResult.submission?._id || `${submitResult.testCasesPassed}_${submitResult.totalTestCases}`;
            if (lastResultIdRef.current === resKey) return;
            lastResultIdRef.current = resKey;

            // Show success overlay ONLY if it's the first time this problem is solved (isFirstSolve)
            // This prevents the animation from showing on subsequent correct submissions
            // AND ensure it's not a persisted result from a previous session
            if (!submitResult.persisted && submitResult?.isFirstSolve === true) {
                setSuccessResult(submitResult);
                setShowSuccessPop(true);
            }
        }

        // Persist run results to sessionStorage for refresh survival
        if (runResult && !runResult.persisted) {
            sessionStorage.setItem(`run_result_${user.id}_${problemId}`, JSON.stringify(runResult));
        }
    }, [submitResult, problemId, problem, user?.id, runResult]);

    // ───── debug: log runResult on change ────────────────────────────────────
    useEffect(() => {
        if (runResult) {
            console.log('[CodeEditor] runResult updated:',
                'total=', runResult.results?.length,
                'custom=', runResult.results?.filter(r => r.isCustom).length,
                'std=', runResult.results?.filter(r => !r.isCustom).length
            );
        }
    }, [runResult]);


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
            const newW = d.startVal + (e.clientX - d.startX) / rect.width * 100;
            setSidebarW(Math.min(45, Math.max(10, newW)));
        } else if (d.type === 'desc') {
            const newW = d.startVal + (e.clientX - d.startX) / rect.width * 100;
            setDescW(Math.min(70, Math.max(15, newW)));
        } else if (d.type === 'editorH') {
            const newH = d.startVal + (e.clientY - d.startY) / rect.height * 100;
            setEditorTopH(Math.min(90, Math.max(10, newH)));
        }
    }, []);

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
        // cursor is handled by the overlay
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

        if (!navigator.onLine) {
            toast.error('No internet connection', { icon: '📡' });
            return;
        }

        if (!code.trim()) return toast.error('Code cannot be empty');
        // Standard cases (with known expectedOutput) + User-added custom cases (input only)
        const allCasesToRun = [
            // Standard (non-hidden) cases — include expectedOutput for comparison
            ...testCases.map(tc => ({
                input: tc.input,
                expectedOutput: tc.output ?? null,
                isCustom: false
            })),
            // User-added custom cases — no expected output (backend derives via solution)
            ...customTestCases.map(cc => ({
                input: cc.input,
                expectedOutput: null,
                isCustom: true
            }))
        ];

        console.log('[handleRun] testCases count:', testCases.length);
        console.log('[handleRun] customTestCases count:', customTestCases.length);
        console.log('[handleRun] allCasesToRun:', JSON.stringify(allCasesToRun));

        await runCode(problemId, code, language, undefined, allCasesToRun);
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
        if (!problemId) return toast.error('Problem ID is missing');
        // if (!window.confirm('Submit solution? This will be tracked.')) return;
        await submitCode(problemId, code, language);
    };

    const handleLangChange = (e) => {
        const newLang = e.target.value;
        const oldLang = language;

        // Save current code to draft immediately to ensure it's not lost
        if (problemId && user && code) {
            localStorage.setItem(`draft_${user.id}_${problemId}_${oldLang}`, code);
        }

        setLanguage(newLang);

        // Explicitly load code for the new language from draft or fallback.
        // This ensures the editor updates immediately and correctly.
        const draftKey = `draft_${user.id}_${problemId}_${newLang}`;
        const draft = localStorage.getItem(draftKey);

        const previousSubKey = `submission_${user.id}_${problemId}_${newLang}`;
        const previousCode = localStorage.getItem(previousSubKey);

        const tplKey = `tpl_${user.id}_${newLang}`;
        const customTpl = localStorage.getItem(tplKey);

        if (draft) {
            setCode(draft);
        } else if (previousCode) {
            setCode(previousCode);
        } else {
            setCode(customTpl || DEFAULT_CODE[newLang]);
        }
    };

    // ───── derived ───────────────────────────────────────────────────────────
    if (!problem || pageLoading) {
        return (
            <div
                ref={containerRef}
                className="flex flex-col bg-[#F7F5FF] dark:bg-[#111117] text-gray-800 dark:text-gray-200 select-none overflow-hidden fixed inset-0 z-[100] transition-colors no-scrollbars-all"
            >
                {/* Header Skeleton/Empty */}
                {/* <div className="h-14 border-b border-gray-200 bg-white flex items-center px-4 justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                                <Code2 className="w-4 h-4 text-gray-400" />
                            </div>
                            <span className="text-sm font-semibold text-gray-600">Practice Workspace</span>
                        </div>
                    </div>
                </div> */}

                <div className="flex-1 flex overflow-hidden relative">
                    {/* ─ Col 1: Sidebar ─ */}
                    <div
                        style={{
                            width: showSidebar ? `${sidebarW}%` : `${COLLAPSED_SIDEBAR_WIDTH}px`,
                            transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                        }}
                        className="relative flex flex-col shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111117] z-20 transition-colors"
                    >
                        <div className="flex-1 overflow-hidden flex flex-col relative h-full">
                            <div className={`flex-1 flex flex-col overflow-hidden h-full transition-opacity duration-300 ${showSidebar ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none hidden'}`}>
                                <ProblemSidebar />
                            </div>

                            {!showSidebar && (
                                <div
                                    className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => setShowSidebar(true)}
                                >
                                    <div style={{ writingMode: 'vertical-rl' }} className="text-[10px] font-bold text-gray-400 tracking-widest uppercase select-none">
                                        <span className="rotate-180">Problem List</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowSidebar(!showSidebar); }}
                            className="absolute -right-[14px] top-1/2 -translate-y-1/2 z-50 w-[14px] h-14 bg-white dark:bg-[#111117] border border-l-0 border-gray-200 dark:border-gray-700 rounded-r-lg shadow-md flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            {showSidebar ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                        </button>
                    </div>

                    {showSidebar && <DragHandleH onMouseDown={(e) => startDrag('sidebar', e)} />}

                    {pageLoading ? (
                        <div className="flex-1 flex overflow-hidden animate-pulse">
                            {/* Left Panel (Description) */}
                            <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111117] flex flex-col transition-colors">
                                <div className="h-10 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111117] flex items-center px-4 gap-4 shrink-0 transition-colors">
                                    <div className="w-20 h-4 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                    <div className="w-20 h-4 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                </div>
                                <div className="p-6 flex flex-col gap-4 flex-1">
                                    <div className="w-3/4 h-8 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                    <div className="flex gap-2">
                                        <div className="w-16 h-6 bg-gray-200 dark:bg-[#111117] rounded-full"></div>
                                        <div className="w-20 h-6 bg-gray-200 dark:bg-[#111117] rounded-full"></div>
                                    </div>
                                    <div className="w-full h-4 bg-gray-200 dark:bg-[#111117] rounded mt-4"></div>
                                    <div className="w-5/6 h-4 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                    <div className="w-full h-4 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                    <div className="w-4/5 h-4 bg-gray-200 dark:bg-[#111117] rounded"></div>

                                    <div className="w-1/3 h-6 bg-gray-200 dark:bg-[#111117] mt-8 mb-2 rounded"></div>
                                    <div className="w-full h-32 bg-gray-100 dark:bg-[#111117] rounded-lg"></div>
                                </div>
                            </div>

                            {/* Right Panel (Editor) */}
                            <div className="w-1/2 flex flex-col bg-white dark:bg-[#111117] transition-colors">
                                <div className="h-12 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111117] flex items-center justify-between px-3 shrink-0 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-32 h-8 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                        <div className="w-24 h-6 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                        <div className="w-32 h-8 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                    </div>
                                </div>
                                <div className="flex-1 bg-white dark:bg-[#111117] p-6 flex flex-col gap-4 transition-colors">
                                    <div className="w-1/3 h-4 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                    <div className="w-1/4 h-4 bg-gray-200 dark:bg-[#111117] rounded ml-4"></div>
                                    <div className="w-1/2 h-4 bg-gray-200 dark:bg-[#111117] rounded ml-4"></div>
                                </div>
                                {/* Terminal area */}
                                <div className="h-48 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111117] flex flex-col shrink-0 transition-colors">
                                    <div className="h-9 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111117] flex items-center px-4 gap-4 w-full shrink-0">
                                        <div className="w-20 h-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                                        <div className="w-20 h-4 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                    </div>
                                    <div className="p-4 flex flex-col gap-2">
                                        <div className="w-1/2 h-4 bg-gray-200 dark:bg-[#111117] rounded mt-2"></div>
                                        <div className="w-1/3 h-4 bg-gray-200 dark:bg-[#111117] rounded"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 bg-gray-50 dark:bg-[#111117] flex items-center justify-center relative transition-colors">
                            {/* Actual Empty State message */}
                            <div className="flex flex-col items-center justify-center text-center p-8 max-w-sm animate-fade-in relative -top-10">
                                <div className="w-16 h-16 bg-white dark:bg-[#111117] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-center mb-5 relative before:absolute before:inset-0 before:bg-primary-50 dark:before:bg-primary-900/10 before:rounded-2xl before:-z-10 before:scale-110 before:opacity-50 transition-colors">
                                    <Code2 className="w-8 h-8 text-primary-500 dark:text-primary-400" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Practice Workspace</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                                    Select a problem from the sidebar to view its description and start writing your solution.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

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

    // For submit mode: never show per-case tabs/details — only the verdict card.
    // For run mode: show all result cases as before.
    const visibleResults = displayResult?.isSubmitMode ? [] : displayResults;

    // Determine executing state
    const isExecuting = running || submitting;
    // For submit: use all problem test cases (from backend). For run: standard + user-added custom cases.
    const runTotalCases = testCases.length + customTestCases.length || 1;
    const totalTestCasesForProgress = problem?.testCases?.length || testCases.length || 3;

    // ── Handlers for Quiz and Material ──
    const handleCompleteNonCoding = async (answers = null) => {
        setIsSubmittingNonCoding(true);
        try {
            const data = await submissionService.markProblemComplete(problemId, answers);
            toast.success("Marked as complete!", { icon: '✅' });
            setProblem(p => ({ ...p, isSolved: true, savedAnswers: answers || null }));
            window.dispatchEvent(new CustomEvent('problemSolved', { detail: { problemId } }));

            // Update the problem cache so navigating away and back preserves solved state
            if (PROBLEM_CACHE[problemId]) {
                PROBLEM_CACHE[problemId].problem = {
                    ...PROBLEM_CACHE[problemId].problem,
                    isSolved: true,
                    savedAnswers: answers || null
                };
            }

            // Only show coin celebration for non-material types (material = editorial, no coins)
            if (data.isFirstSolve && data.coinsEarned > 0) {
                setSuccessResult({
                    coinsEarned: data.coinsEarned,
                    isFirstSolve: true
                });
                setShowSuccessPop(true);
            }
        } catch (error) {
            toast.error(error.message || 'Failed to mark as complete');
        } finally {
            setIsSubmittingNonCoding(false);
        }
    };

    const handleQuizSubmit = () => {
        if (!problem.quizQuestions || problem.quizQuestions.length === 0) return;

        const total = problem.quizQuestions.length;
        if (Object.keys(quizAnswers).length < total) {
            toast.error('Please answer all questions before submitting.');
            return;
        }

        let correctCount = 0;
        problem.quizQuestions.forEach((q, idx) => {
            // Support both field names: correctOptionIndex (from admin form) and correctAnswer (from JSON import)
            const correctIdx = q.correctOptionIndex !== undefined ? q.correctOptionIndex : q.correctAnswer;
            if (quizAnswers[idx] === correctIdx) {
                correctCount++;
            }
        });

        setQuizSubmitted(true);
        toast.success(`You scored ${correctCount}/${total}! Quiz Completed.`);

        if (!problem.isSolved) {
            handleCompleteNonCoding(quizAnswers);
        }
    };

    return (
        <div
            ref={containerRef}
            className="flex flex-col bg-[#F7F5FF] dark:bg-[#111117] text-gray-800 dark:text-gray-200 select-none overflow-hidden fixed inset-0 z-[100] transition-colors no-scrollbars-all"
        >
            {/* Resizing Overlay - Captures events over iframes/editor */}
            {isResizing && (
                <div
                    className="fixed inset-0 z-[9999]"
                    style={{
                        cursor: dragging.current?.type === 'editorH' ? 'row-resize' : 'col-resize'
                    }}
                />
            )}


            {/* ── Main 3‑column area ─────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* ─ Col 1: Sidebar ─ */}
                <div
                    style={{
                        width: showSidebar ? `${sidebarW}%` : `${COLLAPSED_SIDEBAR_WIDTH}px`,
                        transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    }}
                    className="relative flex flex-col shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111117] z-20 transition-colors"
                >
                    <div className="flex-1 overflow-hidden flex flex-col relative h-full">
                        <div className={`flex-1 flex flex-col overflow-hidden h-full transition-opacity duration-300 ${showSidebar ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none hidden'}`}>
                            <ProblemSidebar />
                        </div>

                        {!showSidebar && (
                            <div
                                className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-[#111117]/10 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#23232e] transition-colors"
                                onClick={() => setShowSidebar(true)}
                            >
                                <div style={{ writingMode: 'vertical-rl' }} className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase select-none">
                                    <span className="rotate-180">Problem List</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Toggle Tab — vertically centered on right edge, matching contest style */}
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowSidebar(!showSidebar); }}
                        className="absolute -right-[14px] top-1/2 -translate-y-1/2 z-50 w-[14px] h-14 bg-white dark:bg-[#111117] border border-l-0 border-gray-200 dark:border-gray-700 rounded-r-lg shadow-md flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        title={showSidebar ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                        {showSidebar ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                    </button>
                </div>

                {showSidebar && <DragHandleH onMouseDown={(e) => startDrag('sidebar', e)} />}

                {(!problem?.type || problem.type === 'problem') && (
                    <>
                        {/* ─ Col 2: Description / Editorial / Submissions ─ */}
                        <div style={{ width: `${descW}%` }} className="flex flex-col overflow-hidden shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111117] transition-colors">
                            {/* Problem Header (Title & Meta) */}
                            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111117] shrink-0 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight truncate mr-2" title={problem.title}>
                                        {problem.title}
                                    </h1>
                                </div>
                                <div className="flex items-center gap-3">
                                    <DiffBadge d={problem.difficulty} />
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: isDark ? '#fbbf24' : '#92400e',
                                        background: isDark ? 'linear-gradient(135deg, #2d1a01, #452a02)' : 'linear-gradient(135deg,#fffbeb,#fef3c7)',
                                        border: isDark ? '1px solid #78350f' : '1px solid #fcd34d',
                                        padding: '2px 9px',
                                        borderRadius: 20,
                                        boxShadow: isDark ? '0 0 12px rgba(245,158,11,0.1)' : 'none'
                                    }} className="transition-all duration-300">
                                        <Coins size={11} color={isDark ? '#fbbf24' : '#f59e0b'} className={isDark ? "drop-shadow-[0_0_3px_#fbbf24]" : ""} /> {problem.points} Coins
                                    </span>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex items-center h-10 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111117] shrink-0 transition-colors">
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
                                                ? 'border-purple-600 text-purple-700 dark:text-purple-400 bg-white dark:bg-[#111117]'
                                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#23232e]'
                                            }`}
                                    >
                                        <Icon size={12} />{label}
                                    </button>
                                ))}
                            </div>

                            {/* Tab content */}
                            <div className="flex-1 overflow-y-auto relative scrollbar-hide bg-white dark:bg-[#111117] transition-colors">
                                {loading && (
                                    <div className="absolute inset-0 bg-white/80 dark:bg-[#111117]/80 backdrop-blur-sm z-10 flex justify-center items-center transition-colors">
                                        <Loader2 className="animate-spin text-primary-500" size={24} />
                                    </div>
                                )}

                                {/* ── Description ── */}
                                {leftTab === 'description' && (
                                    <div className="p-6 space-y-6 relative">
                                        {user?.role === 'admin' && !isEditingDesc && (
                                            <button
                                                onClick={() => {
                                                    setTempDesc(problem.description);
                                                    setIsEditingDesc(true);
                                                }}
                                                className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/40 rounded-md transition-colors"
                                            >
                                                <Edit3 size={14} /> Edit Description
                                            </button>
                                        )}

                                        {isEditingDesc ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Edit Problem Description</h3>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">Supports Markdown & Images `![alt](url)`</div>
                                                </div>
                                                <textarea
                                                    value={tempDesc}
                                                    onChange={(e) => setTempDesc(e.target.value)}
                                                    className="w-full h-80 p-4 font-mono text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-[#111117] border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none resize-y transition-colors"
                                                    placeholder="Update problem description here using Markdown..."
                                                />
                                                <div className="flex items-center gap-2 justify-end">
                                                    <button
                                                        onClick={() => setIsEditingDesc(false)}
                                                        className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-[#111117] hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            setIsSavingDesc(true);
                                                            try {
                                                                await problemService.updateProblem(problemId, { description: tempDesc });
                                                                setProblem(prev => ({ ...prev, description: tempDesc }));
                                                                toast.success('Description updated successfully');
                                                                setIsEditingDesc(false);
                                                            } catch (error) {
                                                                toast.error(error.message || 'Failed to update description');
                                                            } finally {
                                                                setIsSavingDesc(false);
                                                            }
                                                        }}
                                                        disabled={isSavingDesc}
                                                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        {isSavingDesc ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                                        Save Description
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 font-problem prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-p:leading-relaxed prose-code:text-primary-700 dark:prose-code:text-gray-200 prose-code:bg-primary-50 dark:prose-code:bg-[#23232e] prose-code:px-1 prose-code:rounded">
                                                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MarkdownComponents}>
                                                    {cleanDescription(problem.description)}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                        {problem.constraints?.length > 0 && (
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wide mb-2">Constraints</h3>
                                                <ul className="bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-1 transition-colors">
                                                    {problem.constraints.map((c, i) => (
                                                        <li key={i} className="text-xs font-mono text-gray-700 dark:text-gray-300 list-disc list-inside">{c}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {problem.inputFormat && (
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wide mb-2">Input Format</h3>
                                                <div className="bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 prose dark:prose-invert prose-sm max-w-none transition-colors">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MarkdownComponents}>
                                                        {problem.inputFormat}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        )}

                                        {problem.outputFormat && (
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wide mb-2">Output Format</h3>
                                                <div className="bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 prose dark:prose-invert prose-sm max-w-none transition-colors">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={MarkdownComponents}>
                                                        {problem.outputFormat}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        )}

                                        {problem.examples?.map((ex, i) => (
                                            <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
                                                <div className="bg-gray-50 dark:bg-[#111117] border-b border-gray-200 dark:border-gray-700 px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                                    Example {i + 1}
                                                </div>
                                                <div className="p-4 space-y-3 bg-white dark:bg-[#111117]">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Input</p>
                                                        <pre className="bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap transition-colors">{ex.input}</pre>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Expected Output</p>
                                                        <pre className="bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded p-2 text-xs font-mono text-gray-600 dark:text-white whitespace-pre-wrap opacity-80 select-text transition-colors">{ex.output}</pre>
                                                    </div>
                                                    {ex.explanation && (
                                                        <div>
                                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Explanation</p>
                                                            <p className="text-xs text-gray-600 dark:text-gray-300 bg-primary-50 dark:bg-primary-900/20 rounded p-2 border border-primary-100 dark:border-primary-900/50 transition-colors">{ex.explanation}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {problem.edgeCases?.length > 0 && (
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wide mb-2">Edge Cases</h3>
                                                <ul className="bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-1 transition-colors">
                                                    {problem.edgeCases.map((c, i) => (
                                                        <li key={i} className="text-xs font-mono text-gray-700 dark:text-gray-300 list-disc list-inside">{c}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {(problem.timeComplexity || problem.spaceComplexity) && (
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-400 uppercase tracking-wide mb-2">Complexity</h3>
                                                <div className="bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2 transition-colors">
                                                    {problem.timeComplexity && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Time:</span>
                                                            <span className="text-sm font-mono text-gray-800 dark:text-gray-200 bg-white dark:bg-[#111117] border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded shadow-sm">{problem.timeComplexity}</span>
                                                        </div>
                                                    )}
                                                    {problem.spaceComplexity && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Space:</span>
                                                            <span className="text-sm font-mono text-gray-800 dark:text-gray-200 bg-white dark:bg-[#111117] border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded shadow-sm">{problem.spaceComplexity}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── Editorial ── */}
                                {leftTab === 'editorial' && (
                                    <EditorialRenderer
                                        problem={problem}
                                        isAdmin={user?.role === 'admin'}
                                        hasViewedEditorial={hasViewedEditorial}
                                        onUnlockEditorial={() => setHasViewedEditorial(true)}
                                        onUpdateLinks={async (editorialLink, videoUrl) => {
                                            await problemService.updateProblem(problemId, { editorialLink, videoUrl });
                                            // Refresh problem data
                                            const data = await problemService.getProblemById(problemId);
                                            if (data?.problem) setProblem(data.problem);
                                        }}
                                    />
                                )}

                                {/* ── Submissions ── */}
                                {leftTab === 'submissions' && <SubmissionsTab problemId={problemId} />}
                            </div>
                        </div>

                        {/* drag handle between desc and editor */}
                        <DragHandleH onMouseDown={(e) => startDrag('desc', e)} />

                        {/* ─ Col 3: Editor + Test Cases (vertical split) ─ */}
                        <div style={{
                            width: showSidebar ? `calc(${100 - sidebarW - descW}%)` : `calc(100% - ${COLLAPSED_SIDEBAR_WIDTH}px - ${descW}%)`,
                            transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
                        }} className="flex flex-col overflow-hidden bg-white dark:bg-[#111117] transition-colors">

                            {/* ── Code Editor ── */}
                            <div

                                style={{
                                    height: `${editorTopH}%`,
                                    transition: isResizing ? 'none' : 'height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'
                                }}
                                className="flex flex-col overflow-hidden"
                            >
                                {showSettings && (
                                    <SettingsModal
                                        settings={editorSettings}
                                        onClose={() => setShowSettings(false)}
                                        onSave={(newSettings) => {
                                            setEditorSettings(newSettings);
                                            localStorage.setItem('editor_settings', JSON.stringify(newSettings));
                                        }}
                                    />
                                )}
                                {/* editor toolbar (Language + Timer + Actions) */}
                                <div className="h-12 bg-white dark:bg-[#111117] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-3 shrink-0 transition-colors">
                                    {/* Left: Language & Timer */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-44">
                                            <CustomDropdown
                                                options={LANGUAGE_OPTIONS}
                                                value={language}
                                                onChange={(val) => handleLangChange({ target: { value: val } })}
                                                size="small"
                                            />
                                        </div>
                                        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 transition-colors" />
                                        <ProblemTimer />
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex items-center gap-2">


                                        <button
                                            onClick={() => setShowSettings(true)}
                                            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#23232e] rounded-md transition-colors"
                                            title="Editor Settings"
                                        >
                                            <Settings size={16} />
                                        </button>


                                        <div className="flex items-center bg-gray-100 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-0.5 transition-colors">
                                            <button
                                                onClick={handleRun}
                                                disabled={isExecuting}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 rounded-md hover:bg-white dark:hover:bg-[#23232e] hover:shadow-sm transition-all disabled:opacity-50"
                                                title="Run Sample Cases"
                                            >
                                                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
                                                <span className="hidden sm:inline">Run</span>
                                            </button>
                                            <button
                                                onClick={handleSubmit}
                                                disabled={isExecuting}
                                                className="flex items-center gap-1.5 px-3 py-1.5 ml-0.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md shadow-sm transition-all disabled:opacity-50"
                                                title="Submit Code"
                                            >
                                                {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                                                <span className="hidden sm:inline">Submit</span>
                                            </button>
                                        </div>

                                        {/* Fullscreen button removed as requested */}
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

                                            // ── Internal-only clipboard ───────────────────────────────
                                            // Only text copied within THIS editor can be pasted back.
                                            // External clipboard content is blocked entirely.
                                            const internalClip = { text: '' };

                                            // Ctrl+C: save selected text internally, also copy to system clipboard
                                            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, () => {
                                                const sel = editor.getSelection();
                                                if (sel && !sel.isEmpty()) {
                                                    internalClip.text = editor.getModel().getValueInRange(sel);
                                                }
                                                editor.trigger('keyboard', 'editor.action.clipboardCopyAction', null);
                                            });
                                            // Ctrl+X: cut, save internally
                                            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, () => {
                                                const sel = editor.getSelection();
                                                if (sel && !sel.isEmpty()) {
                                                    internalClip.text = editor.getModel().getValueInRange(sel);
                                                }
                                                editor.trigger('keyboard', 'editor.action.clipboardCutAction', null);
                                            });
                                            // Ctrl+V: paste ONLY from internal clipboard
                                            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
                                                if (!internalClip.text) {
                                                    toast.error('Paste from external sources is disabled', { icon: '🚫', id: 'paste-blocked' });
                                                    return;
                                                }
                                                const sel = editor.getSelection();
                                                editor.executeEdits('internal-paste', [{
                                                    range: sel,
                                                    text: internalClip.text,
                                                    forceMoveMarkers: true
                                                }]);
                                            });
                                            // Shift+Insert (alternate paste shortcut)
                                            editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Insert, () => {
                                                if (!internalClip.text) return;
                                                const sel = editor.getSelection();
                                                editor.executeEdits('internal-paste', [{
                                                    range: sel,
                                                    text: internalClip.text,
                                                    forceMoveMarkers: true
                                                }]);
                                            });
                                            // Block DOM-level paste (right-click context menu / drag from outside)
                                            const editorDomNode = editor.getDomNode();
                                            if (editorDomNode) {
                                                editorDomNode.addEventListener('paste', (e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                }, true);
                                            }
                                        }}
                                        theme={isDark ? 'antigravity-dark' : 'vs-light'}
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: editorSettings.fontSize,
                                            fontFamily: editorSettings.fontFamily || 'Menlo, Monaco, Consolas, "Courier New", monospace',
                                            fontLigatures: true,
                                            lineNumbers: 'on',
                                            renderLineHighlight: 'all',
                                            scrollBeyondLastLine: false,
                                            scrollbar: {
                                                vertical: 'hidden',
                                                horizontal: 'hidden',
                                                handleMouseWheel: true,
                                            },
                                            automaticLayout: true,
                                            padding: { top: 16, bottom: 16 },
                                        }}
                                    />
                                </div>
                            </div>

                            <DragHandleV onMouseDown={(e) => startDrag('editorH', e)} />

                            {/* ── Bottom: Test Cases / Results ── */}
                            <div
                                key={resultsAnimKey}
                                style={{ height: `${100 - editorTopH}%`, transition: isResizing ? 'none' : 'height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
                                className="flex flex-col overflow-hidden border-t border-gray-100 dark:border-gray-700 transition-colors"
                                data-results-panel
                            >
                                {/* bottom tabs */}
                                <div className="flex items-center h-9 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111117] shrink-0 px-1 transition-colors">
                                    <button
                                        onClick={() => setBottomTab('testcases')}
                                        className={`flex items-center gap-1.5 px-4 h-full text-xs font-medium transition-colors border-b-2
                                    ${bottomTab === 'testcases' ? 'border-purple-600 text-purple-700 dark:text-purple-400 bg-white dark:bg-[#111117]' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:bg-[#111117]'}`}
                                    >
                                        <List size={12} /> Test Cases
                                    </button>

                                    <button
                                        onClick={() => setBottomTab('results')}
                                        className={`flex items-center gap-1.5 px-4 h-full text-xs font-medium transition-colors border-b-2
                                    ${bottomTab === 'results' ? 'border-purple-600 text-purple-700 dark:text-purple-400 bg-white dark:bg-[#111117]' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#23232e]'}`}
                                    >
                                        {isCompileErr ? (
                                            <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                                                <AlertTriangle size={12} /> Compilation Error
                                            </span>
                                        ) : displayResult && !isExecuting ? (
                                            <span className={`flex items-center gap-1.5 ${displayResult.verdict === 'Accepted' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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
                                <div className="flex-1 overflow-hidden bg-white dark:bg-[#111117] transition-colors">

                                    {/* ── Test Cases tab ── */}
                                    {bottomTab === 'testcases' && (
                                        <div className="flex flex-col h-full font-problem bg-white dark:bg-[#111117] transition-colors">
                                            {/* Tabs */}
                                            <div className="flex items-center gap-0.5 px-2 py-2 border-b border-gray-100 dark:border-gray-700 overflow-x-auto scrollbar-hide shrink-0 bg-white dark:bg-[#111117]">
                                                {/* Standard Cases */}
                                                {testCases.map((_, i) => (
                                                    <button
                                                        key={`case-${i}`}
                                                        onClick={() => setActiveTestCaseId(`case-${i}`)}
                                                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border
                                                    ${activeTestCaseId === `case-${i}`
                                                                ? 'bg-gray-100 dark:bg-[#111117] border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 font-semibold shadow-sm'
                                                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#23232e]'
                                                            }`}
                                                    >
                                                        Case {i + 1}
                                                    </button>
                                                ))}

                                                {/* Custom Cases */}
                                                {customTestCases.map((c) => (
                                                    <div key={c.id} className="relative group">
                                                        <button
                                                            onClick={() => setActiveTestCaseId(`custom-${c.id}`)}
                                                            className={`pl-3 pr-7 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border flex items-center gap-1
                                                        ${activeTestCaseId === `custom-${c.id}`
                                                                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400 font-semibold shadow-sm'
                                                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#23232e]'
                                                                }`}
                                                        >
                                                            Case {testCases.length + customTestCases.indexOf(c) + 1}
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRemoveCustomCase(c.id, e)}
                                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X size={10} strokeWidth={3} />
                                                        </button>
                                                    </div>
                                                ))}

                                                {/* Add Button */}
                                                <button
                                                    onClick={handleAddCustomCase}
                                                    className="ml-1 p-1.5 text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                                    title="Add Custom Test Case"
                                                >
                                                    <Plus size={14} strokeWidth={3} />
                                                </button>
                                            </div>

                                            {/* Inputs Area */}
                                            <div className="flex-1 p-4 overflow-y-auto scrollbar-hide bg-white dark:bg-[#111117]">
                                                {activeTestCaseId.startsWith('case-') ? (
                                                    // Standard Case View
                                                    (() => {
                                                        const idx = parseInt(activeTestCaseId.split('-')[1]);
                                                        const tc = testCases[idx];
                                                        if (!tc) return null;
                                                        return (
                                                            <div className="space-y-4 max-w-2xl">
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1.5">Input</p>
                                                                    <div className="w-full bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap select-text transition-colors">
                                                                        {tc.input}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1.5">Expected Output</p>
                                                                    <div className="w-full bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-600 dark:text-gray-200 whitespace-pre-wrap opacity-80 select-text transition-colors">
                                                                        {tc.output}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()
                                                ) : (
                                                    // Custom Case View
                                                    (() => {
                                                        const cCase = customTestCases.find(c => `custom-${c.id}` === activeTestCaseId);
                                                        if (!cCase) return <div className="text-gray-400 text-sm">Case not found.</div>;
                                                        return (
                                                            <div className="space-y-2 h-full flex flex-col">
                                                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">Input</p>
                                                                <textarea
                                                                    className="flex-1 w-full bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-primary-400 focus:border-primary-400 outline-none resize-none transition-colors"
                                                                    value={cCase.input}
                                                                    onChange={(e) => updateCustomCase(e.target.value)}
                                                                    placeholder="Enter input here..."
                                                                />
                                                            </div>
                                                        );
                                                    })()
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Results tab ── */}
                                    {bottomTab === 'results' && (
                                        <div className="h-full overflow-y-auto scrollbar-hide flex flex-col bg-white dark:bg-[#111117] transition-colors" style={{ animation: 'slide-up-results 0.28s cubic-bezier(0.16,1,0.3,1) both' }}>

                                            {/* ── Network Error (Priority check) ── */}
                                            {!isExecuting && isOffline && (
                                                <div className="flex flex-col bg-red-50/30 dark:bg-red-900/10 transition-colors">
                                                    <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 px-4 py-3 flex items-center gap-2 shrink-0 transition-colors">
                                                        <div className="bg-red-100 dark:bg-red-900/40 p-1.5 rounded-full">
                                                            <XCircle size={16} className="text-red-600 dark:text-red-400" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h3 className="text-red-800 dark:text-red-200 font-bold text-sm">Network Error</h3>
                                                            <p className="text-xs text-red-600 dark:text-red-400">No internet connection. Please check your network and try again.</p>
                                                        </div>
                                                        <button
                                                            onClick={() => bottomTab === 'testcases' ? handleRun() : handleSubmit()}
                                                            className="px-3 py-1 bg-white dark:bg-[#111117] border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-md text-[10px] font-bold hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                                                        >
                                                            Retry
                                                        </button>
                                                    </div>
                                                    <div className="p-8 text-center animate-in fade-in duration-500">
                                                        <div className="w-16 h-16 rounded-full bg-red-100/50 dark:bg-red-900/30 flex items-center justify-center mb-4 mx-auto transition-colors">
                                                            <XCircle size={32} className="text-red-500 dark:text-red-400" />
                                                        </div>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-4">
                                                            We couldn't reach the execution server. Please check your internet connection and try again.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* ── Executing (live progress) ── */}
                                            {isExecuting && (
                                                <ExecutionProgress
                                                    isRunning={running}
                                                    isSubmitting={submitting}
                                                    total={submitting ? totalTestCasesForProgress : runTotalCases}
                                                />
                                            )}

                                            {/* ── Compilation Error ── */}
                                            {!isExecuting && !isOffline && isCompileErr && (
                                                <div className="flex flex-col bg-orange-50/30 dark:bg-orange-900/10 transition-colors">
                                                    <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-900/30 px-4 py-3 flex items-center gap-2 shrink-0 transition-colors">
                                                        <div className="bg-orange-100 dark:bg-orange-900/40 p-1.5 rounded-full">
                                                            <AlertTriangle className="text-orange-600 dark:text-orange-400" size={16} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-orange-800 dark:text-orange-200 font-bold text-sm">Compilation Error</h3>
                                                            <p className="text-xs text-orange-600 dark:text-orange-400">Check your code for syntax errors</p>
                                                        </div>
                                                    </div>
                                                    <div className="p-4">
                                                        <pre className="font-mono text-xs text-orange-700 dark:text-orange-300 bg-orange-50/50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-lg p-3 whitespace-pre-wrap leading-relaxed shadow-sm transition-colors">
                                                            {compileErrMsg || 'Unknown error'}
                                                        </pre>
                                                    </div>
                                                </div>
                                            )}

                                            {/* ── Has results ── */}
                                            {!isExecuting && !isCompileErr && displayResult && (
                                                <div className="flex flex-col h-full font-problem">
                                                    {/* ── Verdict Header ── */}
                                                    {(() => {
                                                        const vc = getVerdictColor(displayResult.verdict);
                                                        const isAccepted = displayResult.verdict === 'Accepted';
                                                        const isTLE = displayResult.verdict === 'TLE';
                                                        const isSubmit = displayResult.isSubmitMode;
                                                        return (
                                                            <div className={`px-5 py-4 border-b shrink-0 ${vc.bg} ${vc.border} transition-colors`}>
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`p-2 rounded-full ${isAccepted ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : isTLE ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'} transition-colors`}>
                                                                            {isAccepted ? <CheckCircle size={20} /> : isTLE ? <Clock size={20} /> : <XCircle size={20} />}
                                                                        </div>
                                                                        <div>
                                                                            <h2 className={`text-lg font-bold ${vc.text}`}>
                                                                                {displayResult.verdict}
                                                                            </h2>
                                                                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                                                <span className={`text-sm font-medium ${vc.text}`}>
                                                                                    {displayResult.testCasesPassed} / {displayResult.totalTestCases} testcases passed
                                                                                </span>
                                                                                {isSubmit && (
                                                                                    <span className="text-xs text-gray-500 dark:text-gray-400">All Test Cases</span>
                                                                                )}
                                                                                {/* Show custom case count badge if custom cases were run */}
                                                                                {!isSubmit && displayResult.results?.some(r => r.isCustom) && (
                                                                                    <span className="text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium transition-colors">
                                                                                        {displayResult.results.filter(r => r.isCustom).length} custom
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Coins earned badge (submit only) */}
                                                                    {isSubmit && displayResult.coinsEarned > 0 && (
                                                                        <div className="flex flex-col items-end gap-1">
                                                                            <span className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-500 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                                                                                <Coins size={14} />
                                                                                +{displayResult.coinsEarned} Alpha Coins
                                                                            </span>
                                                                            {displayResult.totalCoins > 0 && (
                                                                                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                                                                                    Total: {displayResult.totalCoins} coins
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* ── SUBMIT MODE: Clean summary only, no per-case details ── */}
                                                    {displayResult.isSubmitMode && (
                                                        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-8">
                                                            {/* Big status circle */}
                                                            {(() => {
                                                                const v = displayResult.verdict;
                                                                const isAC = v === 'Accepted';
                                                                const isTLE = v === 'TLE';
                                                                const isWA = v === 'Wrong Answer';
                                                                const isRE = v === 'Runtime Error';
                                                                const pct = displayResult.totalTestCases > 0
                                                                    ? Math.round((displayResult.testCasesPassed / displayResult.totalTestCases) * 100)
                                                                    : 0;
                                                                const circleColor = isAC ? '#22c55e' : isTLE ? '#eab308' : '#ef4444';
                                                                const bgColor = isAC ? '#f0fdf4' : isTLE ? '#fefce8' : '#fef2f2';
                                                                const radius = 52;
                                                                const circ = 2 * Math.PI * radius;
                                                                const dash = (pct / 100) * circ;
                                                                return (
                                                                    <div className="flex flex-col items-center gap-4">
                                                                        {/* Circular progress */}
                                                                        <div style={{ position: 'relative', width: 140, height: 140 }}>
                                                                            <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
                                                                                <circle cx="70" cy="70" r={radius} fill="none" stroke={useTheme().isDark ? '#23232e' : '#e5e7eb'} strokeWidth="10" />
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
                                                                                <span style={{ fontSize: 22, fontWeight: 800, color: circleColor, lineHeight: 1 }}>
                                                                                    {displayResult.testCasesPassed}
                                                                                </span>
                                                                                <span style={{ fontSize: 11, color: useTheme().isDark ? '#9ca3af' : '#9ca3af', fontWeight: 600 }}>
                                                                                    / {displayResult.totalTestCases}
                                                                                </span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Verdict chips */}
                                                                        <div className="flex flex-col items-center gap-2">
                                                                            <span style={{
                                                                                background: useTheme().isDark ? `${circleColor}20` : bgColor, color: circleColor,
                                                                                border: `1.5px solid ${circleColor}30`,
                                                                                borderRadius: 99, padding: '4px 18px',
                                                                                fontWeight: 700, fontSize: 13, letterSpacing: '0.02em'
                                                                            }}>
                                                                                {v}
                                                                            </span>
                                                                            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium text-center">
                                                                                {isAC && 'Great job! All test cases passed.'}
                                                                                {isTLE && `${displayResult.testCasesPassed} cases passed before time limit was exceeded.`}
                                                                                {isWA && `${displayResult.testCasesPassed} / ${displayResult.totalTestCases} cases correct.`}
                                                                                {isRE && 'Your code crashed on a test case.'}
                                                                                {v === 'Compilation Error' && 'Fix your compile errors and resubmit.'}
                                                                            </p>
                                                                        </div>

                                                                        {/* Runtime error message */}
                                                                        {displayResult.error && !isAC && (
                                                                            <div className="w-full max-w-sm">
                                                                                <p className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase mb-1">Error</p>
                                                                                <pre className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm font-mono whitespace-pre-wrap transition-colors text-center">
                                                                                    {displayResult.error}
                                                                                </pre>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}


                                                    {/* ── Test Case Tabs (LeetCode style) ── */}
                                                    {visibleResults.length > 0 && (
                                                        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-gray-100 dark:border-gray-700 overflow-x-auto scrollbar-hide shrink-0 bg-white dark:bg-[#111117] transition-colors">
                                                            {visibleResults.map((r, i) => {
                                                                const label = `Case ${i + 1}`;
                                                                return (
                                                                    <button
                                                                        key={i}
                                                                        onClick={() => setActiveResultCase(i)}
                                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap border
                                                                        ${activeResultCase === i
                                                                                ? `${r.passed
                                                                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-900/50 text-green-700 dark:text-green-400'
                                                                                    : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-900/50 text-red-700 dark:text-red-400'
                                                                                } font-semibold`
                                                                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#23232e]'
                                                                            }`}
                                                                    >
                                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.passed ? 'bg-green-500' : 'bg-red-500'}`} />
                                                                        {label}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* ── Result Details ── */}
                                                    <div className="flex-1 p-4 overflow-y-auto bg-white dark:bg-[#111117]">
                                                        {visibleResults[activeResultCase] ? (
                                                            <div className="space-y-4 max-w-3xl">
                                                                {/* Hidden test case placeholder */}
                                                                {visibleResults[activeResultCase].isHidden ? (
                                                                    <div className={`p-10 text-center border-2 border-dashed rounded-xl transition-colors ${visibleResults[activeResultCase].passed ? 'border-green-200 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10' : 'border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10'}`}>
                                                                        <Lock size={24} className={`mx-auto mb-3 ${visibleResults[activeResultCase].passed ? 'text-green-400' : 'text-red-400'}`} />
                                                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Hidden Test Case</p>
                                                                        <p className={`text-sm font-semibold mt-2 ${visibleResults[activeResultCase].passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                            {visibleResults[activeResultCase].passed ? '✓ Passed' : '✗ Failed'}
                                                                        </p>
                                                                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Input and expected output are hidden</p>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        {/* Pass / Fail badge */}
                                                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors ${visibleResults[activeResultCase].passed ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                                                                            {visibleResults[activeResultCase].passed
                                                                                ? <><CheckCircle size={12} /> Passed</>
                                                                                : <><XCircle size={12} /> {visibleResults[activeResultCase].verdict || 'Failed'}</>
                                                                            }
                                                                        </div>

                                                                        {/* Input */}
                                                                        <div>
                                                                            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1.5">Input</p>
                                                                            <div className="bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap min-h-[48px] transition-colors">
                                                                                {visibleResults[activeResultCase].input ?? <span className="text-gray-400 dark:text-gray-500 italic">N/A</span>}
                                                                            </div>
                                                                        </div>

                                                                        {/* Your Output + Expected side by side */}
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                            {/* Your Output */}
                                                                            <div>
                                                                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1.5">Your Output</p>
                                                                                <div className={`rounded-lg p-3 text-sm font-mono whitespace-pre-wrap border min-h-[48px] transition-colors
                                                                            ${visibleResults[activeResultCase].passed
                                                                                        ? 'bg-green-50/40 dark:bg-green-900/10 border-green-200 dark:border-green-900/30 text-gray-900 dark:text-gray-200'
                                                                                        : 'bg-red-50/40 dark:bg-red-900/10 border-red-200 dark:border-red-900/30 text-gray-900 dark:text-gray-200'
                                                                                    }`}
                                                                                >
                                                                                    {visibleResults[activeResultCase].actualOutput || <span className="text-gray-400 dark:text-gray-500 italic">No output</span>}
                                                                                </div>
                                                                            </div>
                                                                            {/* Expected Output */}
                                                                            {/* Show expected output whenever it's available (standard cases always have it, custom cases have it if solution ran) */}
                                                                            {visibleResults[activeResultCase].expectedOutput &&
                                                                                visibleResults[activeResultCase].expectedOutput !== '(No reference solution available)' ? (
                                                                                <div>
                                                                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1.5">Expected Output</p>
                                                                                    <div className="bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-600 dark:text-white whitespace-pre-wrap min-h-[48px] transition-colors">
                                                                                        {visibleResults[activeResultCase].expectedOutput}
                                                                                    </div>
                                                                                </div>
                                                                            ) : visibleResults[activeResultCase].isCustom ? (
                                                                                <div>
                                                                                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1.5">Expected Output</p>
                                                                                    <div className="bg-gray-50 dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm font-mono text-gray-400 dark:text-gray-500 whitespace-pre-wrap min-h-[48px] italic transition-colors">
                                                                                        No reference solution available for custom input
                                                                                    </div>
                                                                                </div>
                                                                            ) : null}
                                                                        </div>

                                                                        {/* Runtime error / stderr */}
                                                                        {visibleResults[activeResultCase].error && (
                                                                            <div>
                                                                                <p className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase mb-1.5">Error / Traceback</p>
                                                                                <pre className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap transition-colors">
                                                                                    {visibleResults[activeResultCase].error}
                                                                                </pre>
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-xs">
                                                                {/* No result data for this case. */}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* ── No results yet ── */}
                                            {!isExecuting && !displayResult && !execError && (
                                                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 gap-3 transition-colors">
                                                    <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-[#111117] flex items-center justify-center transition-colors">
                                                        <Play size={20} className="ml-1 text-gray-300 dark:text-gray-600" />
                                                    </div>
                                                    <p className="text-sm font-medium">Run code to view results</p>
                                                </div>
                                            )}

                                            {/* ── Generic error (no results) ── */}
                                            {!isExecuting && !isOffline && execError && !displayResult && !isCompileErr && (
                                                <div className="p-4 transition-colors">
                                                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-4">
                                                        <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-2">Error</p>
                                                        <p className="text-xs text-red-700 dark:text-red-300">{execError}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {problem?.type && problem.type !== 'problem' && (
                    <div className="flex-1 bg-white dark:bg-[#111117] overflow-y-auto custom-scrollbar">
                        <div className={`${problem.type === 'material' ? 'w-full max-w-none xl:px-12' : 'max-w-4xl'} mx-auto p-4 md:p-8`}>
                            <div className={`flex items-center justify-between mb-8 pb-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111117] p-6 rounded-2xl transition-colors object-contain ${!isDark ? 'shadow-sm' : ''}`}>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{problem.title}</h1>
                                <div className="flex items-center gap-3">
                                    {problem.type === 'problem' && (
                                        <span className="inline-flex items-center gap-1 font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400 px-3 py-1.5 rounded-full text-xs border border-purple-200 dark:border-purple-800">
                                            <Coins size={14} className="text-purple-500" /> {problem.points} Coins
                                        </span>
                                    )}
                                </div>
                            </div>

                            {problem.type === 'material' && (
                                <div className={`bg-white dark:bg-[#111827] rounded-3xl border border-gray-200 dark:border-gray-700 p-8 sm:p-10 transition-colors ${!isDark ? 'shadow-sm' : ''}`}>
                                    <EditorialRenderer
                                        problem={problem}
                                        isAdmin={user?.role === 'admin'}
                                        hasViewedEditorial={true}
                                        onUnlockEditorial={() => setHasViewedEditorial(true)}
                                        onUpdateLinks={async (editorialLink, videoUrl) => {
                                            await problemService.updateProblem(problemId, { editorialLink, videoUrl });
                                            const data = await problemService.getProblemById(problemId);
                                            if (data?.problem) setProblem(data.problem);
                                        }}
                                    />
                                    <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 flex justify-center">
                                        <button
                                            disabled={isSubmittingNonCoding || problem.isSolved}
                                            onClick={() => handleCompleteNonCoding(null)}
                                            className={`flex items-center justify-center gap-2.5 min-w-[200px] px-10 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none text-lg ${!isDark ? 'shadow-[0_8px_20px_-6px_rgba(147,51,234,0.4)]' : ''}`}
                                        >
                                            {isSubmittingNonCoding ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                                            {problem.isSolved ? 'Completed' : 'Mark as Read'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {problem.type === 'quiz' && (
                                <div className="space-y-6">
                                    {problem.quizQuestions?.map((q, idx) => (
                                        <div key={idx} className={`bg-white dark:bg-[#111827] rounded-2xl p-6 border border-gray-200 dark:border-gray-700 transition-colors ${!isDark ? 'shadow-sm' : ''}`}>
                                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-6 flex items-start gap-3">
                                                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm font-bold border border-purple-200 dark:border-purple-800">{idx + 1}</span>
                                                <span className="pt-1.5 leading-relaxed">{q.question || q.questionText}</span>
                                            </h3>
                                            <div className="space-y-3 pl-0 md:pl-11">
                                                {q.options?.map((opt, oIdx) => {
                                                    const isSelected = quizAnswers[idx] === oIdx;
                                                    const correctIdx = q.correctOptionIndex !== undefined ? q.correctOptionIndex : q.correctAnswer;
                                                    const isCorrectOpt = correctIdx === oIdx;

                                                    let borderClass = isSelected ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10' : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#111117] hover:border-purple-300 dark:hover:border-purple-700';
                                                    let radioClass = isSelected ? 'border-purple-600' : 'border-gray-300 dark:border-gray-600 group-hover:border-purple-400';
                                                    let radioDotClass = 'bg-purple-600';
                                                    let textClass = isSelected ? 'text-purple-900 dark:text-purple-200' : 'text-gray-700 dark:text-gray-300';

                                                    if (quizSubmitted) {
                                                        if (isCorrectOpt) {
                                                            borderClass = 'border-green-500 bg-green-50/50 dark:bg-green-900/20';
                                                            radioClass = 'border-green-600';
                                                            radioDotClass = 'bg-green-600';
                                                            textClass = 'text-green-800 dark:text-green-300';
                                                        } else if (isSelected && !isCorrectOpt) {
                                                            borderClass = 'border-red-400 bg-red-50/50 dark:bg-red-900/20';
                                                            radioClass = 'border-red-500';
                                                            radioDotClass = 'bg-red-500';
                                                            textClass = 'text-red-800 dark:text-red-300';
                                                        } else {
                                                            borderClass = 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#111117] opacity-60';
                                                            radioClass = 'border-gray-300 dark:border-gray-700';
                                                            textClass = 'text-gray-500 dark:text-gray-500';
                                                        }
                                                    }

                                                    return (
                                                        <label key={oIdx} className={`flex items-start gap-4 p-4 rounded-xl border-2 ${borderClass} ${!quizSubmitted ? 'cursor-pointer' : 'cursor-default'} transition-colors group`}>
                                                            <div className={`mt-0.5 flex shrink-0 items-center justify-center w-5 h-5 rounded-full border-2 ${radioClass}`}>
                                                                {isSelected && <div className={`w-2.5 h-2.5 rounded-full ${radioDotClass}`} />}
                                                            </div>
                                                            <input
                                                                type="radio"
                                                                name={`question-${idx}`}
                                                                checked={isSelected}
                                                                onChange={() => { if (!quizSubmitted) setQuizAnswers(prev => ({ ...prev, [idx]: oIdx })); }}
                                                                disabled={quizSubmitted}
                                                                className="hidden"
                                                            />
                                                            <span className={`font-medium ${textClass}`}>{opt}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                            {quizSubmitted && (() => {
                                                const correctIdx = q.correctOptionIndex !== undefined ? q.correctOptionIndex : q.correctAnswer;
                                                const isCorrect = quizAnswers[idx] === correctIdx;
                                                return (
                                                    <div className={`mt-6 md:ml-11 p-4 rounded-xl text-sm font-bold flex items-center gap-2 border ${isCorrect ? 'bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30' : 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/30'}`}>
                                                        {isCorrect ? <CheckCircle size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
                                                        {isCorrect ? 'Correct!' : `Incorrect selected option.`}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    ))}
                                    <div className="pt-8 flex justify-center">
                                        <button
                                            disabled={isSubmittingNonCoding || problem.isSolved}
                                            onClick={handleQuizSubmit}
                                            className={`flex items-center justify-center gap-2.5 min-w-[200px] px-10 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none text-lg ${!isDark ? 'shadow-[0_8px_20px_-6px_rgba(147,51,234,0.4)]' : ''}`}
                                        >
                                            {isSubmittingNonCoding ? <Loader2 size={24} className="animate-spin" /> : <CheckCircle size={24} />}
                                            {problem.isSolved ? 'Passed' : 'Submit Quiz'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Success Pop Overlay (first solve only) ── */}
            {showSuccessPop && (
                <SuccessPopOverlay
                    result={successResult}
                    onClose={() => { setShowSuccessPop(false); setSuccessResult(null); }}
                />
            )}
        </div>
    );
};

export default CodeEditor;
