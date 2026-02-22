import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import problemService from '../../services/problemService';
import { useAuth } from '../../contexts/AuthContext';

const ProblemList = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const redirectToProblem = async () => {
            try {
                const data = await problemService.getAllProblems();
                const problems = data.problems || [];

                if (problems.length > 0) {
                    // Find first unsolved problem, or default to the first one
                    const nextProblem = problems.find(p => !p.isSolved) || problems[0];
                    const basePath = user?.role === 'admin' ? '/admin' : user?.role === 'instructor' ? '/instructor' : '/student';
                    navigate(`/problem/${nextProblem.id}`, { replace: true });
                } else {
                    setLoading(false); // Only stop loading if no problems found
                }
            } catch (error) {
                console.error("Failed to fetch problems for redirect:", error);
                setLoading(false);
            }
        };

        if (user) {
            redirectToProblem();
        }
    }, [navigate, user]);

    if (loading) {
        return (
            <div className="h-screen flex flex-col bg-gray-50">
                {/* Header Skeleton */}
                <div className="h-14 border-b border-gray-200 bg-white flex items-center px-4 justify-between animate-pulse">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-gray-200 rounded"></div>
                        <div className="w-48 h-5 bg-gray-200 rounded"></div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-24 h-8 bg-gray-200 rounded"></div>
                        <div className="w-24 h-8 bg-gray-200 rounded"></div>
                    </div>
                </div>

                {/* Main Content Skeleton */}
                <div className="flex-1 flex overflow-hidden animate-pulse">
                    {/* Left Panel (Description) */}
                    <div className="w-1/2 border-r border-gray-200 bg-white p-6 flex flex-col gap-4">
                        <div className="w-3/4 h-8 bg-gray-200 rounded"></div>
                        <div className="flex gap-2">
                            <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
                            <div className="w-20 h-6 bg-gray-200 rounded-full"></div>
                        </div>
                        <div className="w-full h-4 bg-gray-200 rounded mt-4"></div>
                        <div className="w-5/6 h-4 bg-gray-200 rounded"></div>
                        <div className="w-full h-4 bg-gray-200 rounded"></div>
                        <div className="w-4/5 h-4 bg-gray-200 rounded"></div>

                        <div className="w-1/3 h-6 bg-gray-200 rounded mt-8 mb-2"></div>
                        <div className="w-full h-32 bg-gray-100 rounded-lg"></div>
                    </div>

                    {/* Right Panel (Editor) */}
                    <div className="w-1/2 flex flex-col">
                        <div className="h-10 border-b border-gray-200 bg-white flex items-center px-4 gap-2">
                            <div className="w-20 h-6 bg-gray-200 rounded"></div>
                            <div className="w-20 h-6 bg-gray-200 rounded"></div>
                        </div>
                        <div className="flex-1 bg-white p-6 flex flex-col gap-4">
                            <div className="w-1/3 h-4 bg-gray-200 rounded"></div>
                            <div className="w-1/4 h-4 bg-gray-200 rounded ml-4"></div>
                            <div className="w-1/2 h-4 bg-gray-200 rounded ml-4"></div>
                        </div>
                        {/* Terminal area */}
                        <div className="h-48 border-t border-gray-200 bg-white p-4 flex flex-col gap-2">
                            <div className="flex gap-4 border-b border-gray-100 pb-2">
                                <div className="w-20 h-4 bg-gray-200 rounded"></div>
                                <div className="w-20 h-4 bg-gray-200 rounded"></div>
                            </div>
                            <div className="w-1/2 h-4 bg-gray-200 rounded mt-2"></div>
                            <div className="w-1/3 h-4 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-center items-center h-screen bg-gray-50 text-gray-500">
            <div className="text-center">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-semibold text-gray-700">No Problems Found</h2>
                <p className="mt-2">Check back later for new challenges!</p>
            </div>
        </div>
    );
};

export default ProblemList;
