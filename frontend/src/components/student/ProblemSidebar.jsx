import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, ChevronDown, CheckCircle, List, Search } from 'lucide-react';
import problemService from '../../services/problemService';
import sectionService from '../../services/sectionService';
import toast from 'react-hot-toast';

const ProblemSidebar = () => {
    const navigate = useNavigate();
    const { problemId } = useParams();
    const [problems, setProblems] = useState([]);
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState({});
    const [expandedSubsections, setExpandedSubsections] = useState({});
    const [difficulty, setDifficulty] = useState('All');

    useEffect(() => {
        fetchData();
    }, []);

    // Auto-expand the section containing the current problem
    useEffect(() => {
        if (problems.length && sections.length && problemId) {
            // Find section/subsection containing problemId
            for (const section of sections) {
                if (section.subsections) {
                    for (const sub of section.subsections) {
                        if (sub.problemIds && sub.problemIds.map(String).includes(problemId)) {
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
            // Silent error or retry? Toast might be spammy inside a component
        } finally {
            setLoading(false);
        }
    };

    const structuredContent = useMemo(() => {
        if (!problems.length) return null;

        const problemMap = {};
        problems.forEach(p => {
            problemMap[p.id] = p;
        });

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

                return {
                    ...subsection,
                    problems: subsectionProblems
                };
            }).filter(sub => sub.problems.length > 0);

            return {
                ...section,
                subsections: mappedSubsections
            };
        }).filter(sec => sec.subsections.length > 0);

        const uncategorized = problems.filter(p =>
            !categorizedProblemIds.has(p.id) &&
            (difficulty === 'All' || p.difficulty === difficulty)
        );

        return { sections: mappedSections, uncategorized };
    }, [problems, sections, difficulty]);

    const toggleSection = (id) => {
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const toggleSubsection = (id) => {
        setExpandedSubsections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (loading) return <div className="p-4 text-center text-gray-500 text-sm flex items-center justify-center h-full"><span className="loader"></span> Loading...</div>;

    const isActive = (id) => id === problemId;

    return (
        <div className="flex flex-col h-full bg-white w-full">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/30">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <List size={18} className="text-gray-600" />
                        <h2 className="font-bold text-gray-800 text-sm">Problem List</h2>
                    </div>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium">{problems.length}</span>
                </div>

                {/* Filter Toggle */}
                <div className="flex p-1 bg-gray-100/80 rounded-lg">
                    {['All', 'Easy', 'Medium', 'Hard'].map(level => (
                        <button
                            key={level}
                            onClick={() => setDifficulty(level)}
                            className={`flex-1 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all ${difficulty === level
                                ? 'bg-white text-gray-800 shadow-sm transform scale-105'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                <div className="divide-y divide-gray-50">
                    {structuredContent?.sections.map(section => (
                        <div key={section._id}>
                            <button
                                onClick={() => toggleSection(section._id)}
                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors group"
                            >
                                <span className="font-semibold text-sm text-gray-700 group-hover:text-primary-700 transition-colors">{section.title}</span>
                                <span className={`transform transition-transform duration-200 text-gray-400 ${expandedSections[section._id] ? 'rotate-90' : ''}`}>
                                    <ChevronRight size={14} />
                                </span>
                            </button>

                            {/* Subsections */}
                            {expandedSections[section._id] && (
                                <div className="bg-gray-50/50 pb-1">
                                    {section.subsections.map(sub => (
                                        <div key={sub._id}>
                                            <button
                                                onClick={() => toggleSubsection(sub._id)}
                                                className="w-full pl-6 pr-4 py-2 flex items-center space-x-2 hover:bg-gray-100/80 transition-colors"
                                            >
                                                <span className={`transform transition-transform duration-200 text-gray-400 ${expandedSubsections[sub._id] ? 'rotate-90' : ''}`}>
                                                    <ChevronRight size={12} />
                                                </span>
                                                <span className="text-xs font-medium text-gray-600">{sub.title}</span>
                                            </button>

                                            {/* Problems */}
                                            {expandedSubsections[sub._id] && (
                                                <div className="pl-10 pr-2 space-y-0.5 mb-2">
                                                    {sub.problems.map(problem => (
                                                        <div
                                                            key={problem.id}
                                                            onClick={() => navigate(`/student/problem/${problem.id}`)}
                                                            className={`
                                                                group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-xs transition-all border-l-2
                                                                ${isActive(problem.id)
                                                                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                                                                    : 'hover:bg-gray-100 border-transparent text-gray-600'
                                                                }
                                                            `}
                                                        >
                                                            <div className="flex items-center space-x-2 truncate">
                                                                {problem.isSolved && (
                                                                    <CheckCircle size={12} className="text-green-500 shrink-0" />
                                                                )}
                                                                <span className="truncate">{problem.title}</span>
                                                            </div>
                                                            <span className={`
                                                                ml-2 px-1.5 py-0.5 rounded text-[10px]
                                                                ${problem.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                                                                    problem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}
                                                            `}>
                                                                {problem.difficulty}
                                                            </span>
                                                        </div>
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
                        <div className="p-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Search size={12} />
                                Other Problems
                            </h3>
                            <div className="space-y-0.5">
                                {structuredContent.uncategorized.map(problem => (
                                    <div
                                        key={problem.id}
                                        onClick={() => navigate(`/student/problem/${problem.id}`)}
                                        className={`
                                            group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-xs transition-all border-l-2
                                            ${isActive(problem.id)
                                                ? 'bg-primary-50 border-primary-500 text-primary-700'
                                                : 'hover:bg-gray-100 border-transparent text-gray-600'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center space-x-2 truncate">
                                            {problem.isSolved && <CheckCircle size={12} className="text-green-500 shrink-0" />}
                                            <span className="truncate">{problem.title}</span>
                                        </div>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${problem.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                                            problem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {problem.difficulty}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!structuredContent?.sections.length && !structuredContent?.uncategorized.length && (
                        <div className="p-8 text-center text-xs text-gray-400">
                            No problems found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProblemSidebar;
