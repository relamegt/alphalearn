import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    FaSpinner, FaCheck, FaCopy, FaChevronLeft, FaChevronRight,
    FaPause, FaPlay, FaYoutube
} from 'react-icons/fa';
import { ChevronDown, ChevronRight, Timer, Code2, Terminal, BookOpen, ExternalLink } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

const getYouTubeId = (url) => {
    if (!url) return null;
    const m = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return m && m[2].length === 11 ? m[2] : null;
};

const toRawGithubUrl = (url) => {
    if (!url) return url;
    const u = url.trim();
    if (u.includes('raw.githubusercontent.com')) return u;
    if (u.includes('github.com') && u.includes('/blob/')) {
        return u.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
    return u;
};

// ──────────────────────────────────────────────────────────────────────────────
// CODE BLOCK VIEWER
// ──────────────────────────────────────────────────────────────────────────────
const CodeBlockViewer = React.memo(({ blocks, id, complexity, activeTabState, onTabChange }) => {
    const [viewMode, setViewMode] = useState('code');
    const [isComplexityOpen, setIsComplexityOpen] = useState(false);
    const [localCopied, setLocalCopied] = useState(false);
    const copyTimeoutRef = React.useRef(null);

    const { normalizedBlocks, languages, outputContent, currentLang } = React.useMemo(() => {
        if (!blocks || blocks.length === 0) return { normalizedBlocks: [], languages: [], outputContent: '', currentLang: '' };
        const norm = blocks.map(b => ({ ...b, language: b.language || 'Code' }));
        const langs = norm.map(b => b.language);
        const lang = activeTabState && langs.includes(activeTabState) ? activeTabState : langs[0];
        return { normalizedBlocks: norm, languages: langs, currentLang: lang, outputContent: norm.find(b => b.output)?.output || '' };
    }, [blocks, activeTabState]);

    if (!blocks || blocks.length === 0) return null;

    const hasOutput = Boolean(outputContent);
    const hasComplexity = complexity?.time || complexity?.space;

    const handleCopy = () => {
        const text = viewMode === 'output'
            ? outputContent
            : normalizedBlocks.find(b => b.language === currentLang)?.code || '';
        navigator.clipboard.writeText(text).then(() => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            setLocalCopied(true);
            copyTimeoutRef.current = setTimeout(() => setLocalCopied(false), 2000);
        });
    };

    return (
        <div className="my-5 w-full rounded-xl border border-zinc-800 bg-[#0c0c0e] overflow-hidden shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between h-10 px-3 bg-[#18181b] border-b border-zinc-800 select-none">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>
                    {hasOutput && (
                        <div className="flex items-center p-0.5 bg-zinc-900 rounded-lg border border-zinc-700/50">
                            {['code', 'output'].map(mode => {
                                const active = viewMode === mode;
                                return (
                                    <button key={mode} onClick={() => setViewMode(mode)}
                                        className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-md flex items-center gap-1 transition-colors ${active ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                        {mode === 'code' ? <Code2 className="w-3 h-3" /> : <Terminal className="w-3 h-3" />}
                                        {mode}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <button onClick={handleCopy} className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] text-zinc-400 hover:text-white transition">
                    {localCopied ? <FaCheck className="text-emerald-500" /> : <FaCopy />}
                    <span>{localCopied ? 'Copied' : 'Copy'}</span>
                </button>
            </div>

            {/* Language Tabs */}
            {viewMode === 'code' && (
                <div className="bg-[#121214] border-b border-zinc-800 px-4">
                    <div className="flex gap-x-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        {languages.map(lang => (
                            <button key={lang} onClick={() => languages.length > 1 && onTabChange(lang)}
                                className={`py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${currentLang === lang ? 'border-indigo-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                                {lang === 'cpp' ? 'C++' : lang === 'py' ? 'Python' : lang}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="relative bg-[#0c0c0e]">
                <div style={{ maxHeight: '340px', overflowX: 'auto', overflowY: 'auto', scrollbarWidth: 'none' }}>
                    {viewMode === 'code' && normalizedBlocks.map(block => (
                        <div key={block.language} style={{ display: block.language === currentLang ? 'block' : 'none', minWidth: 'max-content' }}>
                            <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={block.language.toLowerCase()}
                                showLineNumbers wrapLines={false}
                                customStyle={{ background: 'transparent', margin: 0, padding: '1rem', fontSize: '13px', lineHeight: '1.5', minWidth: '100%' }}
                                lineNumberStyle={{ minWidth: '2.5em', paddingRight: '1em', color: '#52525b', userSelect: 'none' }}
                            >{block.code}</SyntaxHighlighter>
                        </div>
                    ))}
                    {viewMode === 'output' && (
                        <pre style={{ minWidth: 'max-content', padding: '1rem', fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.5', color: '#d4d4d8', whiteSpace: 'pre' }}>
                            {outputContent}
                        </pre>
                    )}
                </div>
            </div>

            {/* Complexity */}
            {viewMode === 'code' && hasComplexity && (
                <div className="border-t border-zinc-800 bg-[#121214]">
                    <button onClick={() => setIsComplexityOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-zinc-400 hover:text-zinc-200 transition">
                        <span className="flex items-center gap-2"><Timer className="w-3.5 h-3.5 text-zinc-500" />Complexity Analysis</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isComplexityOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isComplexityOpen && (
                        <div className="px-5 pb-4 pt-2 border-t border-zinc-800/50 space-y-2.5 text-[13px]">
                            {complexity.time && (
                                <div className="grid grid-cols-[80px_1fr] gap-3 items-start">
                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Time</span>
                                    <span className="text-zinc-300 leading-relaxed">{complexity.time.replace(/`/g, '')}</span>
                                </div>
                            )}
                            {complexity.space && (
                                <div className="grid grid-cols-[80px_1fr] gap-3 items-start">
                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Space</span>
                                    <span className="text-zinc-300 leading-relaxed">{complexity.space.replace(/`/g, '')}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

// ──────────────────────────────────────────────────────────────────────────────
// MARKDOWN COMPONENTS (AlphaKnowledge theme — light gray bg context)
// ──────────────────────────────────────────────────────────────────────────────
const MarkdownComponents = {
    h1: ({ children }) => <h1 className="text-lg font-bold text-gray-900 mt-5 mb-3 pb-2 border-b border-gray-200">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-bold text-gray-900 mt-5 mb-2">{children}</h2>,
    h3: ({ children }) => <h3 className="text-[14px] font-semibold text-gray-800 mt-4 mb-1.5 leading-snug">{children}</h3>,
    p: ({ children }) => <p className="text-gray-700 text-[13.5px] leading-6 mb-3 whitespace-pre-wrap break-words">{children}</p>,
    ul: ({ children }) => <ul className="text-gray-700 text-[13px] list-disc list-outside ml-4 mb-3 space-y-0.5">{children}</ul>,
    ol: ({ children }) => <ol className="text-gray-700 text-[13px] list-decimal list-outside ml-4 mb-3 space-y-0.5">{children}</ol>,
    li: ({ children }) => <li className="pl-1 leading-6 break-words">{children}</li>,
    blockquote: ({ children }) => <blockquote className="border-l-4 border-indigo-400 pl-4 pr-2 py-1 italic text-gray-500 text-[13px] my-3 bg-indigo-50/50 rounded-r">{children}</blockquote>,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{children}</a>,
    hr: () => <hr className="border-0 border-t border-gray-200 my-4" />,
    table: (props) => <div className="my-4 w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm"><table className="w-full text-sm border-collapse text-left" {...props} /></div>,
    thead: (props) => <thead className="bg-indigo-50 text-gray-900" {...props} />,
    tr: (props) => <tr className="border-t border-gray-200 even:bg-gray-50/50" {...props} />,
    tbody: (props) => <tbody className="bg-white" {...props} />,
    th: ({ children }) => <th className="px-3 py-2 font-semibold border-r border-indigo-100 last:border-r-0 text-[12px] whitespace-nowrap">{children}</th>,
    td: ({ children }) => <td className="px-3 py-2 border-r border-gray-100 last:border-r-0 align-top text-gray-700 text-[12px]">{children}</td>,
    code: ({ inline, className, children }) => {
        const content = String(children).replace(/\n$/, '');
        if (inline || !content.includes('\n')) {
            return <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[12px] font-mono border border-indigo-100 inline break-all">{children}</code>;
        }
        return (
            <div className="my-3 rounded-lg overflow-hidden bg-[#0c0c0e] border border-zinc-800">
                <div className="p-3 overflow-x-auto text-[12px] font-mono text-gray-200">{children}</div>
            </div>
        );
    }
};

// ──────────────────────────────────────────────────────────────────────────────
// UNIVERSAL PARSER (same logic as provided code)
// ──────────────────────────────────────────────────────────────────────────────
const universalParse = (markdown) => {
    const lines = markdown.split('\n');
    const result = { title: '', sections: [] };

    const parseBlockLines = (blockLines, prefix = '') => {
        const elements = [];
        let i = 0;
        let currentText = '';

        const flushText = () => {
            if (currentText.trim()) {
                elements.push({ type: 'text', content: currentText.trim(), id: `${prefix}txt-${elements.length}` });
                currentText = '';
            }
        };

        while (i < blockLines.length) {
            const line = blockLines[i];
            const trimmedLine = line.trim();

            // Carousel
            if (trimmedLine === '<carousel>') {
                flushText();
                const images = [];
                i++;
                while (i < blockLines.length && blockLines[i].trim() !== '</carousel>') {
                    const m = blockLines[i].match(/src=["']([^"']+)["']/);
                    if (m) images.push(m[1]);
                    i++;
                }
                if (images.length) elements.push({ type: 'carousel', images, id: `${prefix}car-${elements.length}` });
                i++; continue;
            }

            // Table
            if (trimmedLine.startsWith('|') && i + 1 < blockLines.length && blockLines[i + 1].trim().match(/^\|?[\s-]*:?---+:?[\s-|]*$/)) {
                flushText();
                let tableMd = '';
                while (i < blockLines.length && blockLines[i].trim().startsWith('|')) { tableMd += blockLines[i] + '\n'; i++; }
                elements.push({ type: 'text', content: '\n' + tableMd + '\n', id: `${prefix}table-${elements.length}` });
                continue;
            }

            // Inline image
            const imgM = line.match(/<img\s+src=["']([^"']+)["'][^>]*\/?>/i);
            if (imgM) { flushText(); elements.push({ type: 'image', src: imgM[1], id: `${prefix}img-${elements.length}` }); i++; continue; }

            // Code blocks
            if (trimmedLine.startsWith('```')) {
                flushText();
                const codeGroup = [];
                const blockId = `${prefix}code-${elements.length}`;
                let complexity = { time: '', space: '' };

                while (i < blockLines.length) {
                    if (!blockLines[i].trim().startsWith('```')) break;
                    let lang = blockLines[i].substring(3).trim() || 'Code';
                    i++;
                    let codeContent = '';
                    while (i < blockLines.length && !blockLines[i].trim().startsWith('```')) { codeContent += blockLines[i] + '\n'; i++; }
                    if (i < blockLines.length) i++;
                    codeGroup.push({ language: lang, code: codeContent.trim(), output: null });
                    let peek = i;
                    while (peek < blockLines.length && blockLines[peek].trim() === '') peek++;
                    if (peek < blockLines.length && blockLines[peek].trim().startsWith('```')) { i = peek; continue; }
                    else break;
                }

                // Output capturing
                let k = i;
                while (k < blockLines.length && blockLines[k].trim() === '') k++;
                if (k < blockLines.length && (blockLines[k].match(/^### Output/i) || blockLines[k].match(/^Output:/i))) {
                    let outputLines = [];
                    k++;
                    while (k < blockLines.length) {
                        const tLine = blockLines[k].trim();
                        if (tLine.match(/^#+\s*(Time|Space) Complexity/i) || tLine.match(/^##+\s/) || tLine.startsWith('```') || tLine === '') break;
                        outputLines.push(blockLines[k]);
                        k++;
                    }
                    const finalOutput = outputLines.join('\n').trim();
                    if (finalOutput) { codeGroup.forEach(c => c.output = finalOutput); i = k; }
                }

                // Complexity
                while (i < blockLines.length) {
                    const tCl = blockLines[i].trim();
                    if (tCl.match(/^#+\s*Time Complexity/i)) {
                        i++; let t = '';
                        while (i < blockLines.length && !blockLines[i].trim().startsWith('#') && blockLines[i].trim() !== '') { t += blockLines[i] + '\n'; i++; }
                        complexity.time = t.trim();
                    } else if (tCl.match(/^#+\s*Space Complexity/i)) {
                        i++; let s = '';
                        while (i < blockLines.length && !blockLines[i].trim().startsWith('#') && blockLines[i].trim() !== '') { s += blockLines[i] + '\n'; i++; }
                        complexity.space = s.trim();
                    } else if (tCl === '') { i++; }
                    else break;
                }
                elements.push({ type: 'code', code: codeGroup, complexity, id: blockId });
                continue;
            }

            if (!line.match(/^#+\s*(Time|Space) Complexity/i)) {
                if (line.startsWith('# ') && !result.title) result.title = line.substring(2);
                else currentText += line + '\n';
            }
            i++;
        }
        flushText();
        return elements;
    };

    const approachesStart = lines.findIndex(l => l.trim() === '<approaches>');
    const approachesEnd = lines.findIndex(l => l.trim() === '</approaches>');

    if (approachesStart !== -1 && approachesEnd !== -1) {
        const preLines = lines.slice(0, approachesStart);
        result.sections.push({ type: 'standard', content: parseBlockLines(preLines, 'pre-') });

        const approachLines = lines.slice(approachesStart + 1, approachesEnd);
        const approaches = [];
        let currentApp = null;
        let buffer = [];

        const saveApproach = () => {
            if (currentApp) { currentApp.content = parseBlockLines(buffer, `app-${currentApp.id}-`); approaches.push(currentApp); }
        };

        for (let line of approachLines) {
            if (line.trim().startsWith('## ')) { saveApproach(); buffer = []; currentApp = { name: line.substring(3).trim(), id: `approach-${approaches.length}` }; }
            else buffer.push(line);
        }
        saveApproach();
        result.sections.push({ type: 'approaches', items: approaches });

        const postLines = lines.slice(approachesEnd + 1);
        if (postLines.some(l => l.trim())) result.sections.push({ type: 'standard', content: parseBlockLines(postLines, 'post-') });
    } else {
        result.sections.push({ type: 'standard', content: parseBlockLines(lines) });
    }

    return result;
};

// ──────────────────────────────────────────────────────────────────────────────
// MAIN EDITORIAL RENDERER COMPONENT
// Props:
//   problem        – full problem object with editorialLink, videoUrl, editorial
//   isAdmin        – if true, show edit buttons for editorial/video URL
//   onUpdateLinks  – callback(editorialLink, videoUrl) when admin saves
// ──────────────────────────────────────────────────────────────────────────────
const EditorialRenderer = ({ problem, isAdmin = false, onUpdateLinks }) => {
    const [parsedContent, setParsedContent] = useState(null);
    const [fetchError, setFetchError] = useState(null);
    const [fetchLoading, setFetchLoading] = useState(false);
    const [codeTabStates, setCodeTabStates] = useState({});
    const [expandedSections, setExpandedSections] = useState({});

    // Admin edit state
    const [editMode, setEditMode] = useState(false);
    const [draftEditorialLink, setDraftEditorialLink] = useState('');
    const [draftVideoUrl, setDraftVideoUrl] = useState('');
    const [saving, setSaving] = useState(false);

    const editorialLink = problem?.editorialLink || '';
    const videoUrl = problem?.videoUrl || '';
    const youtubeId = getYouTubeId(videoUrl);

    // Fetch + parse GitHub markdown
    useEffect(() => {
        if (!editorialLink) { setParsedContent(null); return; }
        let cancelled = false;
        const fetchContent = async () => {
            setFetchLoading(true);
            setFetchError(null);
            try {
                const rawUrl = toRawGithubUrl(editorialLink);
                const res = await fetch(rawUrl);
                if (!res.ok) throw new Error(`Failed to fetch (HTTP ${res.status})`);
                const text = await res.text();
                if (!cancelled) setParsedContent(universalParse(text));
            } catch (e) {
                if (!cancelled) setFetchError(e.message);
            } finally {
                if (!cancelled) setFetchLoading(false);
            }
        };
        fetchContent();
        return () => { cancelled = true; };
    }, [editorialLink]);

    const handleAdminSave = async () => {
        setSaving(true);
        try {
            await onUpdateLinks?.(draftEditorialLink.trim(), draftVideoUrl.trim());
            setEditMode(false);
        } finally {
            setSaving(false);
        }
    };

    const toggleSection = (id) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

    const renderBlock = (block) => {
        switch (block.type) {
            case 'text':
                return (
                    <div key={block.id} className="prose prose-gray max-w-none mb-4">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>{block.content}</ReactMarkdown>
                    </div>
                );
            case 'image':
                return <img key={block.id} src={block.src} alt="editorial" className="max-w-full rounded-xl border border-gray-200 my-4 shadow-sm" />;
            case 'code':
                return (
                    <CodeBlockViewer
                        key={block.id}
                        blocks={block.code}
                        id={block.id}
                        complexity={block.complexity}
                        activeTabState={codeTabStates[block.id]}
                        onTabChange={(val) => setCodeTabStates(prev => ({ ...prev, [block.id]: val }))}
                    />
                );
            default:
                return null;
        }
    };

    // ── Admin edit panel ──────────────────────────────────────────────────────
    const AdminPanel = () => (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Admin: Editorial Settings</span>
                {!editMode && (
                    <button onClick={() => { setDraftEditorialLink(editorialLink); setDraftVideoUrl(videoUrl); setEditMode(true); }}
                        className="text-xs px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition">
                        Edit Links
                    </button>
                )}
            </div>
            {editMode ? (
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">GitHub Editorial URL</label>
                        <input value={draftEditorialLink} onChange={e => setDraftEditorialLink(e.target.value)}
                            placeholder="https://github.com/user/repo/blob/main/editorial.md"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none font-mono" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">YouTube Video URL (optional)</label>
                        <input value={draftVideoUrl} onChange={e => setDraftVideoUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-400 focus:outline-none font-mono" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleAdminSave} disabled={saving}
                            className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => setEditMode(false)} className="px-4 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition">
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="text-xs text-gray-600 space-y-1">
                    <div><span className="font-semibold">Editorial:</span> {editorialLink || <span className="text-gray-400 italic">Not set</span>}</div>
                    <div><span className="font-semibold">Video:</span> {videoUrl || <span className="text-gray-400 italic">Not set</span>}</div>
                </div>
            )}
        </div>
    );

    // ── No editorial at all ───────────────────────────────────────────────────
    if (!editorialLink && !videoUrl && !problem?.editorial?.approach) {
        return (
            <div className="p-6">
                {isAdmin && <AdminPanel />}
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <BookOpen size={40} className="opacity-20 mb-3" />
                    <p className="text-sm">Editorial not available yet.</p>
                    {isAdmin && <p className="text-xs mt-1 text-gray-300">Use the panel above to add a GitHub editorial link.</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="p-5 space-y-4">
            {isAdmin && <AdminPanel />}

            {/* ── YouTube video FIRST (if present) ───────────────────────── */}
            {youtubeId && (
                <div className="mb-2">
                    <div className="flex items-center gap-2 mb-3">

                        <FaYoutube className=" w-4.5 h-4.5 text-red-500" />

                        <h3 className="text-sm font-bold text-gray-900">Video Explanation</h3>
                    </div>
                    <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-lg border border-gray-200">
                        <iframe
                            src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                            title="Video Explanation"
                            className="w-full h-full"
                            allowFullScreen
                        />
                    </div>

                    {/* Divider before editorial */}
                    {(editorialLink || problem?.editorial?.approach) && (
                        <div className="flex items-center gap-3 mt-6 mb-2">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Editorial</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>
                    )}
                </div>
            )}

            {/* ── GitHub Editorial (fetched markdown) ────────────────────── */}
            {editorialLink && (
                <>
                    {fetchLoading && (
                        <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
                            <FaSpinner className="animate-spin" />
                            <span className="text-sm">Loading editorial…</span>
                        </div>
                    )}

                    {fetchError && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                            <span className="font-semibold shrink-0">Error:</span>
                            <span>{fetchError}</span>
                            <a href={editorialLink} target="_blank" rel="noopener noreferrer"
                                className="ml-auto shrink-0 text-indigo-600 hover:underline flex items-center gap-1">
                                <ExternalLink size={12} /> Open
                            </a>
                        </div>
                    )}

                    {!fetchLoading && !fetchError && parsedContent && (
                        <div className="space-y-5">
                            {parsedContent.sections.map((section, idx) => {
                                if (section.type === 'standard') {
                                    return <div key={idx}>{section.content.map(renderBlock)}</div>;
                                }
                                if (section.type === 'approaches') {
                                    return (
                                        <div key={idx} className="space-y-3">
                                            {section.items.map((approach, aIdx) => (
                                                <div key={approach.id} className="border border-indigo-200/60 rounded-xl overflow-hidden bg-transparent">
                                                    <div onClick={() => toggleSection(approach.id)}
                                                        className="cursor-pointer px-4 py-3 flex items-center justify-between hover:bg-indigo-50/50 transition-colors select-none">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-7 h-7 rounded-lg bg-transparent border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                                                {aIdx + 1}
                                                            </div>
                                                            <h3 className="text-[13.5px] font-semibold text-gray-900 leading-snug">{approach.name}</h3>
                                                        </div>
                                                        {expandedSections[approach.id]
                                                            ? <ChevronDown className="w-4 h-4 text-indigo-600 rotate-180 transition-transform" />
                                                            : <ChevronRight className="w-4 h-4 text-gray-400" />}
                                                    </div>
                                                    <AnimatePresence>
                                                        {expandedSections[approach.id] && (
                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                                <div className="px-5 pb-4 border-t border-indigo-100 bg-transparent">
                                                                    {approach.content.map(renderBlock)}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ── Fallback: legacy text-only editorial ───────────────────── */}
            {!editorialLink && problem?.editorial?.approach && (
                <div className="space-y-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-2 text-sm">Approach</h3>
                        <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">{problem.editorial.approach}</p>
                    </div>
                    {problem.editorial.complexity && (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">Complexity</h3>
                            <p className="text-[13px] text-gray-700">{problem.editorial.complexity}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EditorialRenderer;
