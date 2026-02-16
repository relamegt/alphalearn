import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import problemService from '../../services/problemService';
import toast from 'react-hot-toast';

const SECTIONS = [
    'Introduction',
    'Arrays',
    'Strings',
    'Math',
    'Sorting',
    'Searching',
    'Recursion',
    'Backtracking',
    'Dynamic Programming',
    'Graphs',
    'Trees',
    'Heaps',
    'Advanced Topics',
];

const ProblemList = () => {
    const navigate = useNavigate();
    const [selectedSection, setSelectedSection] = useState('Arrays');
    const [problems, setProblems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sectionCounts, setSectionCounts] = useState({});

    useEffect(() => {
        fetchSectionCounts();
    }, []);

    useEffect(() => {
        if (selectedSection) {
            fetchProblems();
        }
    }, [selectedSection]);

    const fetchSectionCounts = async () => {
        try {
            const data = await problemService.getSectionWiseCount();
            setSectionCounts(data.sectionCounts);
        } catch (error) {
            console.error('Failed to fetch section counts');
        }
    };

    const fetchProblems = async () => {
        setLoading(true);
        try {
            const data = await problemService.getAllProblems({ section: selectedSection });
            setProblems(data.problems);
        } catch (error) {
            toast.error('Failed to fetch problems');
        } finally {
            setLoading(false);
        }
    };

    const handleProblemClick = (problemId) => {
        navigate(`/student/problem/${problemId}`);
    };

    return (
        <div className="flex h-screen">
            {/* Sidebar - Sections */}
            <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">DSA Sections</h2>
                </div>
                <div className="p-2">
                    {SECTIONS.map((section) => (
                        <button
                            key={section}
                            onClick={() => setSelectedSection(section)}
                            className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-colors ${selectedSection === section
                                ? 'bg-primary-100 text-primary-700 font-semibold'
                                : 'hover:bg-gray-100 text-gray-700'
                                }`}
                        >
                            <div className="flex justify-between items-center">
                                <span>{section}</span>
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                                    {sectionCounts[section] || 0}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content - Problems */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">{selectedSection}</h1>
                    <p className="text-gray-600 mt-1">{problems.length} problems available</p>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="spinner"></div>
                    </div>
                ) : problems.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No problems available in this section</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {problems.map((problem, index) => (
                            <div
                                key={problem.id}
                                onClick={() => handleProblemClick(problem.id)}
                                className="card hover:shadow-lg transition-shadow cursor-pointer"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4 flex-1">
                                        <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold ${problem.isSolved
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {problem.isSolved ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                index + 1
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-gray-900 hover:text-primary-600">
                                                {problem.title}
                                            </h3>
                                            <div className="flex items-center space-x-3 mt-1">
                                                <span className={`badge-${problem.difficulty.toLowerCase()}`}>
                                                    {problem.difficulty}
                                                </span>
                                                <span className="text-sm text-gray-500">
                                                    {problem.points} points
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <button className="btn-primary">
                                            Solve →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProblemList;
