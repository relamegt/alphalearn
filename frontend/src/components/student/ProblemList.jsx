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
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    <p className="text-gray-500 font-medium">Loading your workspace...</p>
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
