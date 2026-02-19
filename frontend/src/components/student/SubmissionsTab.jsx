import { useState, useEffect } from 'react';
import submissionService from '../../services/submissionService';
import { format } from 'date-fns';

const SubmissionsTab = ({ problemId }) => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSubmissions();
    }, [problemId]);

    const fetchSubmissions = async () => {
        setLoading(true);
        try {
            const data = await submissionService.getProblemSubmissions(problemId);
            setSubmissions(data.submissions || []);
        } catch (error) {
            console.error('Failed to load submissions:', error);
        } finally {
            setLoading(false);
        }
    };

    const getVerdictColor = (verdict) => {
        switch (verdict) {
            case 'Accepted': return 'text-green-600 bg-green-50';
            case 'Wrong Answer': return 'text-red-600 bg-red-50';
            case 'TLE': return 'text-orange-600 bg-orange-50';
            case 'Runtime Error': return 'text-purple-600 bg-purple-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (submissions.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <p>No submissions yet.</p>
                <p className="text-xs mt-2">Submit your code to see history here.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {submissions.map((sub) => (
                        <tr key={sub._id || sub.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getVerdictColor(sub.verdict)}`}>
                                    {sub.verdict === 'Accepted' ? 'Accepted' : sub.verdict}
                                </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                {sub.language}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {sub.executionTime ? `${sub.executionTime} ms` : '-'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                {sub.submittedAt ? format(new Date(sub.submittedAt), 'MMM d, yyyy HH:mm') : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default SubmissionsTab;
