import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, CheckCircle } from 'lucide-react';
import { CiCircleList } from 'react-icons/ci';
import { FaRegFolder, FaRegFolderOpen } from "react-icons/fa6";
import problemService from '../../services/problemService';
import sectionService from '../../services/sectionService';

const DIFF_COLORS = {
    Easy: { dot: '#10b981', text: '#065f46', bg: '#d1fae5' },
    Medium: { dot: '#f59e0b', text: '#78350f', bg: '#fef3c7' },
    Hard: { dot: '#ef4444', text: '#7f1d1d', bg: '#fee2e2' },
};

const ProblemSidebar = () => {
    const navigate = useNavigate();
    const { problemId } = useParams();
    const [problems, setProblems] = useState([]);
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState({});
    const [expandedSubsections, setExpandedSubsections] = useState({});
    const [difficulty, setDifficulty] = useState('All');

    useEffect(() => { fetchData(); }, []);

    useEffect(() => {
        if (problems.length && sections.length && problemId) {
            for (const section of sections) {
                if (section.subsections) {
                    for (const sub of section.subsections) {
                        if (sub.problemIds?.map(String).includes(problemId)) {
                            setExpandedSections(prev => ({ ...prev, [section._id]: true }));
                            setExpandedSubsections(prev => ({ ...prev, [sub._id]: true }));
                            return;
                        }
                    }
                }
            }
        }
    }, [problems, sections, problemId]);

    const fetchData = async () => {
        try {
            const [problemsData, sectionsData] = await Promise.all([
                problemService.getAllProblems(),
                sectionService.getAllSections()
            ]);
            setProblems(problemsData.problems);
            setSections(sectionsData.sections);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const structuredContent = useMemo(() => {
        if (!problems.length) return null;
        const problemMap = {};
        problems.forEach(p => { problemMap[p.id] = p; });
        const categorizedProblemIds = new Set();

        const mappedSections = sections.map(section => {
            const mappedSubsections = (section.subsections || []).map(subsection => {
                const subsectionProblems = (subsection.problemIds || [])
                    .map(pid => {
                        const pidStr = typeof pid === 'object' ? pid.toString() : pid;
                        categorizedProblemIds.add(pidStr);
                        return problemMap[pidStr];
                    })
                    .filter(p => !!p)
                    .filter(p => difficulty === 'All' || p.difficulty === difficulty);
                return { ...subsection, problems: subsectionProblems };
            }).filter(sub => sub.problems.length > 0);
            return { ...section, subsections: mappedSubsections };
        }).filter(sec => sec.subsections.length > 0);

        const uncategorized = problems.filter(p =>
            !categorizedProblemIds.has(p.id) &&
            (difficulty === 'All' || p.difficulty === difficulty)
        );

        return { sections: mappedSections, uncategorized };
    }, [problems, sections, difficulty]);

    const toggleSection = (id) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleSubsection = (id) => setExpandedSubsections(prev => ({ ...prev, [id]: !prev[id] }));
    const isActive = (id) => id === problemId;

    const solvedCount = problems.filter(p => p.isSolved).length;
    const progressPct = problems.length ? Math.round(solvedCount / problems.length * 100) : 0;
    const circumference = 2 * Math.PI * 13;

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#2563eb', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>Loading problems…</span>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', overflow: 'hidden' }}>

            {/* ── Header ─────────────────────────────────────────────── */}
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>

                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {/* CiCircleList icon — bigger, neutral */}
                        <CiCircleList style={{ fontSize: 22, color: '#6b7280', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
                            Problem List
                        </span>
                        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
                            {solvedCount}/{problems.length}
                        </span>
                    </div>

                    {/* Circular progress (blue only) */}
                    <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
                        <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="18" cy="18" r="13" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                            <circle
                                cx="18" cy="18" r="13" fill="none"
                                stroke="#2563eb" strokeWidth="3"
                                strokeDasharray={circumference}
                                strokeDashoffset={circumference * (1 - (problems.length ? solvedCount / problems.length : 0))}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                            />
                        </svg>
                        <span style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 800, color: '#2563eb',
                        }}>
                            {progressPct}%
                        </span>
                    </div>
                </div>

                {/* Difficulty filter */}
                <div style={{ display: 'flex', gap: 3, background: '#f9fafb', borderRadius: 8, padding: 3, border: '1px solid #f3f4f6' }}>
                    {['All', 'Easy', 'Medium', 'Hard'].map(level => (
                        <button
                            key={level}
                            onClick={() => setDifficulty(level)}
                            style={{
                                flex: 1, padding: '4px 0', borderRadius: 6, border: 'none',
                                fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                                background: difficulty === level ? '#fff' : 'transparent',
                                color: difficulty === level ? '#374151' : '#9ca3af',
                                boxShadow: difficulty === level ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            }}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── List ────────────────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

                {structuredContent?.sections.map(section => (
                    <div key={section._id}>
                        {/* Section header */}
                        <SectionHeader
                            title={section.title}
                            expanded={expandedSections[section._id]}
                            count={section.subsections.reduce((a, s) => a + s.problems.length, 0)}
                            onClick={() => toggleSection(section._id)}
                        />

                        {expandedSections[section._id] && (
                            <div style={{ background: '#fafafa' }}>
                                {section.subsections.map(sub => (
                                    <div key={sub._id}>
                                        {/* Subsection header */}
                                        <button
                                            onClick={() => toggleSubsection(sub._id)}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                                                padding: '7px 14px 7px 32px', border: 'none', cursor: 'pointer',
                                                background: 'transparent', transition: 'background 0.12s',
                                                borderBottom: '1px solid #f3f4f6',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <ChevronRight
                                                size={11} color="#d1d5db"
                                                style={{ transform: expandedSubsections[sub._id] ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                                            />
                                            <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', flex: 1, textAlign: 'left' }}>{sub.title}</span>
                                            <span style={{ fontSize: 9, background: '#f3f4f6', color: '#9ca3af', borderRadius: 12, padding: '1px 6px', fontWeight: 700 }}>
                                                {sub.problems.length}
                                            </span>
                                        </button>

                                        {expandedSubsections[sub._id] && (
                                            <div style={{ paddingBottom: 2 }}>
                                                {sub.problems.map(problem => (
                                                    <ProblemRow
                                                        key={problem.id}
                                                        problem={problem}
                                                        active={isActive(problem.id)}
                                                        indent={44}
                                                        onClick={() => navigate(`/student/problem/${problem.id}`)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                {/* Uncategorized */}
                {structuredContent?.uncategorized.length > 0 && (
                    <div>
                        <SectionHeader
                            title="Other Problems"
                            expanded
                            count={structuredContent.uncategorized.length}
                            onClick={() => { }}
                            noToggle
                        />
                        {structuredContent.uncategorized.map(problem => (
                            <ProblemRow
                                key={problem.id}
                                problem={problem}
                                active={isActive(problem.id)}
                                indent={14}
                                onClick={() => navigate(`/student/problem/${problem.id}`)}
                            />
                        ))}
                    </div>
                )}

                {!structuredContent?.sections.length && !structuredContent?.uncategorized.length && (
                    <div style={{ padding: 32, textAlign: 'center', color: '#d1d5db', fontSize: 12 }}>
                        No problems found.
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Section Header ──────────────────────────────────────────────────────────
const SectionHeader = ({ title, expanded, count, onClick, noToggle }) => {
    const [hover, setHover] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', border: 'none', cursor: noToggle ? 'default' : 'pointer',
                background: hover && !noToggle ? '#f9fafb' : '#fff',
                borderBottom: '1px solid #f3f4f6',
                transition: 'background 0.12s',
            }}
        >
            {/* Folder icon — open/closed state */}
            {expanded
                ? <FaRegFolderOpen size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
                : <FaRegFolder size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
            }
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', flex: 1, textAlign: 'left', letterSpacing: '-0.01em' }}>
                {title}
            </span>
            <span style={{ fontSize: 9, background: '#f3f4f6', color: '#9ca3af', borderRadius: 12, padding: '1px 6px', fontWeight: 700 }}>
                {count}
            </span>
            {!noToggle && (
                <ChevronRight
                    size={12} color="#d1d5db"
                    style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                />
            )}
        </button>
    );
};

// ── Problem Row ──────────────────────────────────────────────────────────────
const ProblemRow = ({ problem, active, indent, onClick }) => {
    const [hover, setHover] = useState(false);
    const d = DIFF_COLORS[problem.difficulty] || DIFF_COLORS.Easy;

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: `7px 12px 7px ${indent}px`,
                cursor: 'pointer', transition: 'all 0.12s',
                background: active ? '#eff6ff' : hover ? '#f9fafb' : 'transparent',
                borderLeft: active ? '2px solid #2563eb' : '2px solid transparent',
                borderBottom: '1px solid #f9fafb',
            }}
        >
            {problem.isSolved
                ? <CheckCircle size={12} color="#10b981" style={{ flexShrink: 0 }} />
                : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid #e5e7eb', flexShrink: 0 }} />
            }
            <span style={{
                flex: 1, fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? '#1d4ed8' : hover ? '#111827' : '#4b5563',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4,
            }}>
                {problem.title}
            </span>
            <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, flexShrink: 0,
                background: d.bg, color: d.text, lineHeight: 1.6,
            }}>
                {problem.difficulty === 'Medium' ? 'Med' : problem.difficulty}
            </span>
        </div>
    );
};

export default ProblemSidebar;
