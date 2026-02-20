import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, CheckCircle, Circle, ChevronDown, Search, X } from 'lucide-react';
import { CiCircleList } from 'react-icons/ci';
import { FaRegFolder, FaRegFolderOpen } from "react-icons/fa6";
import problemService from '../../services/problemService';
import sectionService from '../../services/sectionService';
import { useAuth } from '../../contexts/AuthContext';

const DIFF_COLORS = {
    Easy: { text: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' },
    Medium: { text: 'text-yellow-800', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
    Hard: { text: 'text-red-800', bg: 'bg-red-100', dot: 'bg-red-500' },
};

const ProblemSidebar = () => {
    const navigate = useNavigate();
    const { problemId } = useParams();
    const { user } = useAuth();
    const basePath = user?.role === 'admin' ? '/admin' : user?.role === 'instructor' ? '/instructor' : '/student';
    const [problems, setProblems] = useState([]);
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState({});
    const [expandedSubsections, setExpandedSubsections] = useState({});
    const [difficulty, setDifficulty] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

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
                    .filter(p => difficulty === 'All' || p.difficulty === difficulty)
                    .filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
                return { ...subsection, problems: subsectionProblems };
            }).filter(sub => sub.problems.length > 0);
            return { ...section, subsections: mappedSubsections };
        }).filter(sec => sec.subsections.length > 0);

        const uncategorized = problems.filter(p =>
            !categorizedProblemIds.has(p.id) &&
            (difficulty === 'All' || p.difficulty === difficulty) &&
            p.title.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return { sections: mappedSections, uncategorized };
    }, [problems, sections, difficulty, searchQuery]);

    // Auto-expand on search
    useEffect(() => {
        if (searchQuery.trim() && structuredContent) {
            const newExpSec = {};
            const newExpSub = {};
            structuredContent.sections.forEach(s => {
                newExpSec[s._id] = true;
                s.subsections.forEach(sub => {
                    newExpSub[sub._id] = true;
                });
            });
            setExpandedSections(prev => ({ ...prev, ...newExpSec }));
            setExpandedSubsections(prev => ({ ...prev, ...newExpSub }));
        }
    }, [searchQuery, structuredContent]);

    const toggleSection = (id) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleSubsection = (id) => setExpandedSubsections(prev => ({ ...prev, [id]: !prev[id] }));
    const isActive = (id) => id === problemId;

    const solvedCount = problems.filter(p => p.isSolved).length;
    const progressPct = problems.length ? Math.round(solvedCount / problems.length * 100) : 0;
    const circumference = 2 * Math.PI * 16; // Increased radius

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-primary-600 animate-spin" />
            <span className="text-sm font-medium text-gray-400">Loading problems…</span>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden border-r border-gray-200">

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="shrink-0 p-4 border-b border-gray-100 bg-white z-10">

                {/* Title row */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <CiCircleList className="text-gray-500 text-2xl" />
                        <div>
                            <h2 className="text-base font-bold text-gray-900 leading-tight">Problem List</h2>
                            <p className="text-xs font-medium text-gray-500 mt-0.5">{solvedCount} / {problems.length} Solved</p>
                        </div>
                    </div>

                    {/* Circular progress */}
                    <div className="relative w-10 h-10 shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-100" strokeWidth="3" />
                            <circle
                                cx="18" cy="18" r="16" fill="none"
                                className="stroke-blue-600 transition-all duration-500 ease-out"
                                strokeWidth="3"
                                strokeDasharray={circumference}
                                strokeDashoffset={circumference * (1 - (problems.length ? solvedCount / problems.length : 0))}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-blue-600">{progressPct}%</span>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative mb-3 group">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                        <Search size={13} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search problems..."
                        className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg py-1.5 pl-8 pr-7 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400 font-medium"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Difficulty filter */}
                <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
                    {['All', 'Easy', 'Medium', 'Hard'].map(level => (
                        <button
                            key={level}
                            onClick={() => setDifficulty(level)}
                            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all duration-200
                                ${difficulty === level
                                    ? 'bg-white text-gray-800 shadow-sm ring-1 ring-gray-200'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── List ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {structuredContent?.sections.map(section => (
                    <div key={section._id} className="border-b border-gray-50 last:border-0">
                        {/* Section header */}
                        <SectionHeader
                            title={section.title}
                            expanded={expandedSections[section._id]}
                            count={section.subsections.reduce((a, s) => a + s.problems.length, 0)}
                            onClick={() => toggleSection(section._id)}
                        />

                        {expandedSections[section._id] && (
                            <div className="bg-gray-50/50 pb-2">
                                {section.subsections.map(sub => (
                                    <div key={sub._id}>
                                        {/* Subsection header */}
                                        <button
                                            onClick={() => toggleSubsection(sub._id)}
                                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100/50 transition-colors group"
                                        >
                                            <div className="w-6 flex justify-center shrink-0">
                                                <ChevronRight
                                                    size={16}
                                                    className={`text-gray-400 transition-transform duration-200 ${expandedSubsections[sub._id] ? 'rotate-90 text-gray-600' : 'group-hover:text-gray-500'}`}
                                                />
                                            </div>
                                            <span className="text-sm font-semibold text-gray-700 flex-1 text-left truncate">{sub.title}</span>
                                            <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200 shadow-sm">
                                                {sub.problems.length}
                                            </span>
                                        </button>

                                        {expandedSubsections[sub._id] && (
                                            <div className="mb-2">
                                                {sub.problems.map(problem => (
                                                    <ProblemRow
                                                        key={problem.id}
                                                        problem={problem}
                                                        active={isActive(problem.id)}
                                                        indent="pl-12"
                                                        onClick={() => navigate(`${basePath}/problem/${problem.id}`)}
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
                    <div className="border-t border-gray-100">
                        <SectionHeader
                            title="Other Problems"
                            expanded={true}
                            count={structuredContent.uncategorized.length}
                            onClick={() => { }}
                            noToggle
                        />
                        <div className="pb-2">
                            {structuredContent.uncategorized.map(problem => (
                                <ProblemRow
                                    key={problem.id}
                                    problem={problem}
                                    active={isActive(problem.id)}
                                    indent="pl-4"
                                    onClick={() => navigate(`${basePath}/problem/${problem.id}`)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {!structuredContent?.sections.length && !structuredContent?.uncategorized.length && (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
                        <p className="text-sm">No problems found matching filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Section Header ──────────────────────────────────────────────────────────
const SectionHeader = ({ title, expanded, count, onClick, noToggle }) => {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3.5 transition-all duration-200
                ${expanded ? 'bg-white' : 'bg-white hover:bg-gray-50'}
                ${!noToggle ? 'cursor-pointer' : 'cursor-default'}
            `}
        >
            {/* Folder icon */}
            <div className="shrink-0 text-gray-400">
                {expanded
                    ? <FaRegFolderOpen size={18} className="text-blue-500" />
                    : <FaRegFolder size={18} />
                }
            </div>

            <span className="text-sm font-bold text-gray-800 flex-1 text-left truncate leading-tight">
                {title}
            </span>

            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {count}
            </span>

            {!noToggle && (
                <ChevronRight
                    size={16}
                    className={`text-gray-400 transition-transform duration-200 shrink-0 ${expanded ? 'rotate-90' : ''}`}
                />
            )}
        </button>
    );
};

// ── Problem Row ──────────────────────────────────────────────────────────────
const ProblemRow = ({ problem, active, indent, onClick }) => {
    const d = DIFF_COLORS[problem.difficulty] || DIFF_COLORS.Easy;

    return (
        <div
            onClick={onClick}
            className={`
                flex items-center gap-3 pr-4 py-2.5 my-0.5 cursor-pointer transition-all duration-150 border-l-[3px]
                ${indent}
                ${active
                    ? 'bg-blue-50 border-l-blue-600'
                    : 'border-l-transparent hover:bg-gray-100 hover:border-l-gray-300'
                }
            `}
        >
            <div className="shrink-0">
                {problem.isSolved
                    ? <CheckCircle size={16} className="text-green-500 fill-green-50" />
                    : <Circle size={16} className="text-gray-300" strokeWidth={2} />
                }
            </div>

            <span className={`flex-1 text-sm truncate leading-snug
                ${active ? 'font-semibold text-blue-700' : 'font-medium text-gray-600'}
            `}>
                {problem.title}
            </span>

            <span className={`
                text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 tracking-wide
                ${d.bg} ${d.text}
            `}>
                {problem.difficulty === 'Medium' ? 'Med' : problem.difficulty}
            </span>
        </div>
    );
};

export default ProblemSidebar;
