import { useState, useEffect, useCallback } from 'react';
import submissionService from '../../services/submissionService';
import Editor from '@monaco-editor/react';
import { format, formatDistanceToNow } from 'date-fns';
import {
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    Code2,
    X,
    Loader2,
    ChevronRight,
    Calendar,
    Hash,
    Layers
} from 'lucide-react';

// ── Language display map ─────────────────────────────────────────────────────
const LANG_LABELS = {
    c: 'C',
    cpp: 'C++',
    java: 'Java',
    python: 'Python 3',
    javascript: 'JavaScript'
};

const LANG_MONACO = {
    c: 'c',
    cpp: 'cpp',
    java: 'java',
    python: 'python',
    javascript: 'javascript'
};

// ── Verdict helpers ──────────────────────────────────────────────────────────
const VERDICT_CONFIG = {
    'Accepted': {
        color: 'text-green-700',
        bg: 'bg-green-50',
        border: 'border-green-200',
        dot: 'bg-green-500',
        Icon: CheckCircle
    },
    'Wrong Answer': {
        color: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        dot: 'bg-red-500',
        Icon: XCircle
    },
    'Compilation Error': {
        color: 'text-orange-700',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        dot: 'bg-orange-500',
        Icon: AlertTriangle
    },
    'Runtime Error': {
        color: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        dot: 'bg-red-500',
        Icon: AlertTriangle
    },
    'TLE': {
        color: 'text-yellow-700',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        dot: 'bg-yellow-500',
        Icon: Clock
    }
};

const getVc = (verdict) =>
    VERDICT_CONFIG[verdict] || {
        color: 'text-gray-700',
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        dot: 'bg-gray-400',
        Icon: XCircle
    };

// ═══════════════════════════════════════════════════════════════════════════
//  Submission Detail Modal
// ═══════════════════════════════════════════════════════════════════════════
const SubmissionModal = ({ sub, onClose }) => {
    if (!sub) return null;

    const vc = getVc(sub.verdict);
    const VIcon = vc.Icon;
    const submittedDate = sub.submittedAt ? new Date(sub.submittedAt) : null;

    // Close on backdrop click
    const handleBackdrop = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={handleBackdrop}
        >
            <div
                className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-fade-in"
                style={{ maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className={`px-6 py-5 border-b ${vc.border} ${vc.bg} shrink-0`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full bg-white shadow-sm`}>
                                <VIcon size={20} className={vc.color} />
                            </div>
                            <div>
                                <h2 className={`text-lg font-bold ${vc.color}`}>
                                    {sub.verdict}
                                </h2>
                                {sub.testCasesPassed !== undefined && sub.totalTestCases !== undefined && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {sub.testCasesPassed} / {sub.totalTestCases} test cases passed
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Meta pills */}
                    <div className="flex flex-wrap gap-3 mt-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                            <Code2 size={11} className="text-gray-400" />
                            {LANG_LABELS[sub.language] || sub.language}
                        </span>
                        {submittedDate && (
                            <>
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                                    <Calendar size={11} className="text-gray-400" />
                                    {format(submittedDate, 'MMM d, yyyy HH:mm')}
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                                    <Clock size={11} className="text-gray-400" />
                                    {formatDistanceToNow(submittedDate, { addSuffix: true })}
                                </span>
                            </>
                        )}
                        {sub.executionTime && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                                <Layers size={11} className="text-gray-400" />
                                {sub.executionTime} ms
                            </span>
                        )}
                    </div>
                </div>

                {/* ── Code Viewer ── */}
                <div className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                            <Code2 size={12} /> Submitted Code
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">
                            {LANG_LABELS[sub.language] || sub.language}
                        </span>
                    </div>

                    {sub.code ? (
                        <div style={{ height: '380px' }}>
                            <Editor
                                height="100%"
                                language={LANG_MONACO[sub.language] || 'plaintext'}
                                value={sub.code}
                                theme="vs-light"
                                options={{
                                    readOnly: true,
                                    minimap: { enabled: false },
                                    fontSize: 13,
                                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                                    fontLigatures: true,
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    padding: { top: 16, bottom: 16 },
                                    renderLineHighlight: 'none',
                                    contextmenu: false
                                }}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <Code2 size={40} className="opacity-20 mb-3" />
                            <p className="text-sm">Code not available for this submission.</p>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Main SubmissionsTab
// ═══════════════════════════════════════════════════════════════════════════
const SubmissionsTab = ({ problemId }) => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSub, setSelectedSub] = useState(null);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        submissionService.getProblemSubmissions(problemId)
            .then(data => { if (mounted) setSubmissions(data.submissions || []); })
            .catch(err => console.error('Failed to load submissions:', err))
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [problemId]);

    const closeModal = useCallback(() => setSelectedSub(null), []);

    // ── Loading ──
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                <Loader2 size={24} className="animate-spin text-primary-500" />
                <p className="text-sm">Loading submissions…</p>
            </div>
        );
    }

    // ── Empty ──
    if (submissions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <Code2 size={24} className="opacity-30" />
                </div>
                <p className="text-sm font-medium text-gray-500">No submissions yet</p>
                <p className="text-xs text-gray-400">Submit your solution to see history here.</p>
            </div>
        );
    }

    return (
        <>
            {/* ── Submission List ── */}
            <div className="divide-y divide-gray-100">
                {submissions.map((sub) => {
                    const vc = getVc(sub.verdict);
                    const VIcon = vc.Icon;
                    const submittedDate = sub.submittedAt ? new Date(sub.submittedAt) : null;
                    const isAccepted = sub.verdict === 'Accepted';

                    return (
                        <button
                            key={sub._id || sub.id}
                            onClick={() => setSelectedSub(sub)}
                            className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors group"
                        >
                            {/* Left: verdict + meta */}
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Dot indicator */}
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${vc.dot}`} />

                                <div className="min-w-0">
                                    {/* Verdict */}
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold ${vc.color}`}>
                                            {sub.verdict}
                                        </span>
                                        {sub.testCasesPassed !== undefined && sub.totalTestCases !== undefined && (
                                            <span className="text-xs text-gray-400 font-mono">
                                                ({sub.testCasesPassed}/{sub.totalTestCases})
                                            </span>
                                        )}
                                    </div>
                                    {/* Sub-meta */}
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-[11px] text-gray-400 font-medium">
                                            {LANG_LABELS[sub.language] || sub.language}
                                        </span>
                                        {sub.executionTime && (
                                            <>
                                                <span className="text-gray-200">·</span>
                                                <span className="text-[11px] text-gray-400">
                                                    {sub.executionTime} ms
                                                </span>
                                            </>
                                        )}
                                        {submittedDate && (
                                            <>
                                                <span className="text-gray-200">·</span>
                                                <span className="text-[11px] text-gray-400">
                                                    {formatDistanceToNow(submittedDate, { addSuffix: true })}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: date + chevron */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                                {submittedDate && (
                                    <span className="text-[11px] text-gray-400 hidden sm:block">
                                        {format(submittedDate, 'MMM d, HH:mm')}
                                    </span>
                                )}
                                <ChevronRight
                                    size={15}
                                    className="text-gray-300 group-hover:text-gray-500 transition-colors"
                                />
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Modal ── */}
            {selectedSub && (
                <SubmissionModal sub={selectedSub} onClose={closeModal} />
            )}
        </>
    );
};

export default SubmissionsTab;
