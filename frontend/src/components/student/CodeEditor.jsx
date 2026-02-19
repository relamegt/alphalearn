import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
    Play,
    CheckCircle,
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    Maximize2,
    Minimize2,
    Loader2,
    Code2,
    FileText,
    List,
    CheckSquare,
    Terminal,
    Coins,
    Menu,
    X,
    Lock
} from 'lucide-react';
import problemService from '../../services/problemService';
import useCodeExecution from '../../hooks/useCodeExecution';
import { initPasteDetection } from '../../utils/pasteDetector';
import { initSecurityFeatures } from '../../utils/disableInspect';
import toast from 'react-hot-toast';
import ProblemSidebar from './ProblemSidebar';
import SubmissionsTab from './SubmissionsTab';

// ─── BookOpen icon (not in older lucide-react) ─────────────────────────────
const BookOpenIcon = ({ size = 14, className = '' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        strokeLinejoin="round" className={className}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
);

// ─── Drag‑Handle helper ──────────────────────────────────────────────────────
const DragHandleH = ({ onMouseDown }) => (
    <div
        onMouseDown={onMouseDown}
        className="w-1 bg-gray-200 hover:bg-primary-400 cursor-col-resize shrink-0 transition-colors z-10 group relative"
        title="Drag to resize"
    >
        <div className="absolute inset-y-0 -left-1 -right-1" /> {/* wider hit area */}
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

// ─── Language & template data ───────────────────────────────────────────────
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
    const cls = d === 'Easy' ? 'bg-green-50  text-green-700  border-green-200'
        : d === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
            : 'bg-red-50    text-red-700    border-red-200';
    return (
        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${cls}`}>
            {d}
        </span>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════════════════
const CodeEditor = () => {
    const { problemId } = useParams();
    const navigate = useNavigate();
    const editorRef = useRef(null);
    const monacoRef = useRef(null); // Capture monaco instance
    const containerRef = useRef(null);   // outer wrapper

    // ── layout widths (% of total width) ──
    const [sidebarW, setSidebarW] = useState(20);   // left col %
    const [descW, setDescW] = useState(38);   // middle col %
    const [editorTopH, setEditorTopH] = useState(65);   // editor row % of right col

    const [showSidebar, setShowSidebar] = useState(true);

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
    const [activeCase, setActiveCase] = useState(0);
    const [isCustomInput, setIsCustomInput] = useState(false);
    const [customInputVal, setCustomInputVal] = useState('');

    const { running, submitting, runResult, submitResult, runCode, submitCode, error: execError } = useCodeExecution();

    // ───── fetch problem ──────────────────────────────────────────────────────
    useEffect(() => {
        let mounted = true;
        setLoading(true);
        problemService.getProblemById(problemId)
            .then(data => {
                if (!mounted) return;
                setProblem(data.problem);
                const examples = data.problem.examples || [];
                setTestCases(examples.length
                    ? examples.map(e => ({ input: e.input, output: e.output, explanation: e.explanation }))
                    : [{ input: '', output: '' }]
                );
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

    // ───── auto‑switch to results tab ────────────────────────────────────────
    useEffect(() => {
        if (runResult || submitResult || execError) setBottomTab('results');
    }, [runResult, submitResult, execError]);

    // ───── Error Marker Logic (LeetCode Style) ───────────────────────────────
    // Derived error state
    const isCompileErr = runResult?.verdict === 'Compilation Error'
        || submitResult?.submission?.verdict === 'Compilation Error';
    const compileErrMsg = runResult?.error || submitResult?.error || execError;

    useEffect(() => {
        const editor = editorRef.current;
        const monaco = monacoRef.current;

        if (!editor || !monaco) return;

        const model = editor.getModel();
        if (!model) return;

        // Clear markers first
        monaco.editor.setModelMarkers(model, 'owner', []);

        if (isCompileErr && compileErrMsg) {
            const markers = [];
            const lines = compileErrMsg.split('\n');

            // Regex patterns for different languages

            const patterns = [
                /:(\d+):(\d+): error:/, // GCC-style (C/C++) with col
                /:(\d+): error:/,       // GCC-style (C/C++) no col
                /line (\d+)/i,           // Python style
                /:(\d+)/                // Generic fallback
            ];

            // Try to find the line number in the error message
            for (const line of lines) {
                let match = null;
                for (const pattern of patterns) {
                    match = line.match(pattern);
                    if (match) break;
                }

                if (match) {
                    const lineNum = parseInt(match[1], 10);
                    if (!isNaN(lineNum) && lineNum > 0 && lineNum <= model.getLineCount()) {
                        // Add marker
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

            if (markers.length > 0) {
                monaco.editor.setModelMarkers(model, 'owner', markers);
            }
        }

    }, [isCompileErr, compileErrMsg]);

    // ═══ Drag Resize Logic ════════════════════════════════════════════════════
    const dragging = useRef(null); // { type, startX, startY, startVal, startVal2? }

    const onMouseMoveResize = useCallback((e) => {
        const d = dragging.current;
        if (!d || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        if (d.type === 'sidebar') {
            const totalW = rect.width;
            const dx = e.clientX - d.startX;
            const newSidebar = Math.min(30, Math.max(12, d.startVal + dx / totalW * 100));
            setSidebarW(newSidebar);
        } else if (d.type === 'desc') {
            const totalW = rect.width;
            const dx = e.clientX - d.startX;
            const newDesc = Math.min(50, Math.max(20, d.startVal + dx / totalW * 100));
            setDescW(newDesc);
        } else if (d.type === 'editorH') {
            const totalH = rect.height - 1; // minus header
            const dy = e.clientY - d.startY;
            const newH = Math.min(85, Math.max(15, d.startVal + dy / totalH * 100));
            setEditorTopH(newH);
        }
    }, []);

    const onMouseUpResize = useCallback(() => {
        dragging.current = null;
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
        const monaco = monacoRef.current;
        const editor = editorRef.current;
        if (monaco && editor) {
            monaco.editor.setModelMarkers(editor.getModel(), 'owner', []);
        }

        if (!code.trim()) return toast.error('Code cannot be empty');
        await runCode(problemId, code, language, isCustomInput ? customInputVal : undefined);
    };

    const handleSubmit = async () => {
        const monaco = monacoRef.current;
        const editor = editorRef.current;
        if (monaco && editor) {
            monaco.editor.setModelMarkers(editor.getModel(), 'owner', []);
        }

        if (!code.trim()) return toast.error('Code cannot be empty');
        if (!window.confirm('Submit solution? This will be tracked.')) return;
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

    // Determine what to show in results
    const isRun = bottomTab === 'results' && !!runResult;
    const isSubmit = bottomTab === 'results' && !!submitResult;

    // Unified result object
    const activeResult = isSubmit ? submitResult : (isRun ? runResult : null);

    // For Run: show filtered cases. For Submit: show everything (masked handled by backend)
    const displayResults = activeResult?.results || [];

    // column widths
    const rightW = 100 - (showSidebar ? sidebarW : 0) - descW;

    return (
        <div
            ref={containerRef}
            className={`flex flex-col bg-white text-gray-800 select-none overflow-hidden
                ${isFullScreen ? 'fixed inset-0 z-50 h-screen' : 'h-[calc(100vh-64px)]'}`}
        >
            {/* ── Top Header ─────────────────────────────────────────────── */}
            <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-20 shadow-sm">
                {/* left */}
                <div className="flex items-center gap-4 overflow-hidden">
                    <button
                        onClick={() => setShowSidebar(s => !s)}
                        className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                        title={showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
                    >
                        <Menu size={20} />
                    </button>

                    <div className="flex flex-col">
                        <h1 className="font-bold text-gray-900 truncate text-sm md:text-base leading-tight">
                            {problem.title}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <DiffBadge d={problem.difficulty} />
                            <span className="hidden md:flex items-center text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">
                                <Coins size={10} className="mr-1" />{problem.points} pts
                            </span>
                        </div>
                    </div>
                </div>

                {/* right */}
                <div className="flex items-center gap-2">
                    {pasteAttempts > 0 && (
                        <span className="text-xs text-red-500 font-medium hidden sm:flex items-center gap-1">
                            <AlertTriangle size={12} /> {pasteAttempts} paste{pasteAttempts > 1 ? 's' : ''} blocked
                        </span>
                    )}
                    <div className="flex items-center bg-gray-100 border border-gray-200 rounded-lg p-0.5">
                        <button
                            onClick={handleRun}
                            disabled={running || submitting}
                            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-700 rounded-md hover:bg-white hover:shadow-sm transition-all disabled:opacity-50"
                        >
                            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} className="fill-current" />}
                            Run
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={running || submitting}
                            className="flex items-center gap-1.5 px-3 py-1 ml-1 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm transition-all disabled:opacity-50"
                        >
                            {submitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            Submit
                        </button>
                    </div>
                    <button
                        onClick={() => setIsFullScreen(f => !f)}
                        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                </div>
            </header>

            {/* ── Main 3‑column area ─────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* ─ Col 1: Sidebar ─ */}
                {showSidebar && (
                    <>
                        <div style={{ width: `${sidebarW}%` }} className="flex flex-col overflow-hidden shrink-0 border-r border-gray-200 bg-white">
                            <ProblemSidebar />
                        </div>
                        <DragHandleH onMouseDown={(e) => startDrag('sidebar', e)} />
                    </>
                )}

                {/* ─ Col 2: Description / Editorial / Submissions ─ */}
                <div style={{ width: `${descW}%` }} className="flex flex-col overflow-hidden shrink-0 border-r border-gray-200 bg-white">

                    {/* Tabs */}
                    <div className="flex items-center h-9 border-b border-gray-200 bg-white shrink-0">
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
                <div style={{ width: `${rightW}%` }} className="flex flex-col overflow-hidden bg-white">

                    {/* ── Code Editor ── */}
                    <div style={{ height: `${editorTopH}%` }} className="flex flex-col overflow-hidden">
                        {/* editor toolbar */}
                        <div className="h-9 bg-gray-50 border-b border-gray-200 flex items-center justify-between px-3 shrink-0">
                            <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
                                <Code2 size={13} className="text-gray-400" /> Code Editor
                            </div>
                            <div className="relative">
                                <select
                                    value={language}
                                    onChange={handleLangChange}
                                    className="bg-white border border-gray-200 text-xs text-gray-700 rounded py-1 pl-2 pr-6 outline-none focus:ring-1 focus:ring-primary-400 cursor-pointer appearance-none"
                                >
                                    {LANGUAGE_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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
                    <div style={{ height: `${100 - editorTopH}%` }} className="flex flex-col overflow-hidden border-t border-gray-100">
                        {/* bottom tabs */}
                        <div className="flex items-center h-9 border-b border-gray-200 bg-gray-50 shrink-0">
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
                                    <span className="flex items-center gap-1.5 text-red-600">
                                        <AlertTriangle size={12} /> Compilation Error
                                    </span>
                                ) : (
                                    <>
                                        <Terminal size={12} /> Run Results
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
                                            {/* Standard Cases */}
                                            {!isCustomInput && testCases.filter(tc => !tc.isHidden).map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setActiveCase(i)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                                                        ${activeCase === i
                                                            ? 'bg-gray-100 text-gray-900 font-semibold'
                                                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    Case {i + 1}
                                                </button>
                                            ))}
                                            {/* Custom Input Badge */}
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
                                            testCases.filter(tc => !tc.isHidden)[activeCase] && (
                                                <div className="space-y-4 max-w-2xl">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Input</p>
                                                        <textarea
                                                            className="w-full h-auto min-h-[50px] bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-800 focus:ring-1 focus:ring-primary-400 focus:border-primary-400 outline-none resize-none"
                                                            rows={3}
                                                            value={testCases.filter(tc => !tc.isHidden)[activeCase].input}
                                                            readOnly
                                                        />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Expected Output</p>
                                                        <textarea
                                                            className="w-full h-auto min-h-[50px] bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-600 outline-none resize-none opacity-80 cursor-not-allowed"
                                                            rows={3}
                                                            value={testCases.filter(tc => !tc.isHidden)[activeCase].output}
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
                                <div className="h-full overflow-y-auto">
                                    {isCompileErr ? (
                                        <div className="flex flex-col h-full bg-red-50/30">
                                            {/* Header */}
                                            <div className="bg-red-50 border-b border-red-100 px-4 py-3 flex items-center gap-2 shrink-0">
                                                <div className="bg-red-100 p-1.5 rounded-full">
                                                    <AlertTriangle className="text-red-600" size={16} />
                                                </div>
                                                <h3 className="text-red-800 font-bold text-sm">Compilation Failed</h3>
                                                <span className="text-xs text-red-500 ml-auto font-medium">Check code for syntax errors</span>
                                            </div>

                                            <div className="p-4">
                                                <pre className="font-mono text-xs text-red-700 bg-red-50/50 border border-red-100 rounded-lg p-3 whitespace-pre-wrap leading-relaxed shadow-sm">
                                                    {compileErrMsg || 'Unknown error'}
                                                </pre>
                                            </div>
                                        </div>
                                    ) : activeResult ? (
                                        <div className="flex flex-col h-full">
                                            {/* Main Result Verdict */}
                                            <div className={`px-5 py-4 border-b shrink-0 flex items-center gap-3
                                                ${activeResult.verdict === 'Accepted'
                                                    ? 'bg-green-50 border-green-100'
                                                    : 'bg-red-50 border-red-100'
                                                }`}>
                                                <div className={`p-2 rounded-full ${activeResult.verdict === 'Accepted' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                    {activeResult.verdict === 'Accepted' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                                </div>
                                                <div>
                                                    <h2 className={`text-lg font-bold ${activeResult.verdict === 'Accepted' ? 'text-green-700' : 'text-red-700'}`}>
                                                        {activeResult.verdict}
                                                    </h2>
                                                    <div className="flex items-center gap-3 text-xs opacity-80 mt-1">
                                                        <span className={activeResult.verdict === 'Accepted' ? 'text-green-800' : 'text-red-800'}>
                                                            {activeResult.testCasesPassed} / {activeResult.totalTestCases} Test cases passed
                                                        </span>
                                                        {activeResult.submission?.points > 0 && (
                                                            <span className="flex items-center gap-1 font-bold text-amber-600 bg-white/50 px-2 py-0.5 rounded-full border border-amber-200">
                                                                <Coins size={10} /> +{activeResult.submission.points} Coins
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Results Horizontal Tabs */}
                                            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 overflow-x-auto scrollbar-hide shrink-0 bg-white">
                                                {displayResults.map((r, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => setActiveCase(i)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2
                                                            ${activeResult.results[i] && activeCase === i
                                                                ? 'bg-gray-100 text-gray-900 font-semibold'
                                                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${r.passed ? 'bg-green-500' : 'bg-red-500'}`} />
                                                        {isCustomInput ? 'Custom' : `Case ${i + 1}`}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Result Details */}
                                            <div className="flex-1 p-4 overflow-y-auto">
                                                {displayResults[activeCase] && (
                                                    <div className="space-y-4 max-w-3xl animate-in fade-in duration-200">
                                                        {displayResults[activeCase].isHidden ? (
                                                            <div className="p-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-400">
                                                                <Lock size={24} className="mx-auto mb-2 opacity-50" />
                                                                <p className="text-xs font-medium uppercase tracking-wider">Hidden Test Case</p>
                                                                <p className="text-[10px] mt-1 text-gray-400">
                                                                    {displayResults[activeCase].passed ? "Passed" : "Failed (Wrong Answer)"}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                    <div>
                                                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Input</p>
                                                                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-800 whitespace-pre-wrap">
                                                                            {displayResults[activeCase].input}
                                                                        </div>
                                                                    </div>
                                                                    {/* Expected Output - Hide if Custom Input */}
                                                                    {!isCustomInput && (
                                                                        <div>
                                                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Expected Output</p>
                                                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-gray-600 whitespace-pre-wrap">
                                                                                {displayResults[activeCase].expectedOutput}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Your Output</p>
                                                                    <div className={`rounded-lg p-3 text-xs font-mono whitespace-pre-wrap border
                                                                        ${displayResults[activeCase].passed
                                                                            ? 'bg-green-50/40 border-green-200 text-gray-900'
                                                                            : 'bg-red-50/40 border-red-200 text-gray-900'
                                                                        }`}
                                                                    >
                                                                        {displayResults[activeCase].actualOutput || <span className="text-gray-400 italic">No output</span>}
                                                                    </div>
                                                                </div>

                                                                {/* Display Runtime Error / Traceback if present */}
                                                                {displayResults[activeCase].error && (
                                                                    <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                                                                        <p className="text-[10px] font-bold text-red-500 uppercase mb-1.5">Error Message</p>
                                                                        <pre className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap">
                                                                            {displayResults[activeCase].error}
                                                                        </pre>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                                            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                                                <Play size={20} className="ml-1 text-gray-300" />
                                            </div>
                                            <p className="text-sm font-medium">Run code to view results</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;
