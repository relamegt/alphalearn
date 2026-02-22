import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import reportService from '../../services/reportService';
import contestService from '../../services/contestService';
import toast from 'react-hot-toast';
import CustomDropdown from '../shared/CustomDropdown';

const ContestReports = () => {
    const { user } = useAuth();
    const [contests, setContests] = useState([]);
    const [selectedContest, setSelectedContest] = useState('');
    const [contestReport, setContestReport] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.batchId) {
            fetchContests();
        }
    }, [user]);

    const fetchContests = async () => {
        try {
            const data = await contestService.getContestsByBatch(user.batchId);
            setContests(data.contests);
        } catch (error) {
            toast.error('Failed to fetch contests');
        }
    };

    const handleGenerateReport = async () => {
        if (!selectedContest) {
            toast.error('Please select a contest');
            return;
        }

        setLoading(true);
        try {
            const data = await reportService.getContestReport(selectedContest);
            setContestReport(data.report);
            toast.success('Contest report generated successfully');
        } catch (error) {
            toast.error(error.message || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = async () => {
        if (!selectedContest) {
            toast.error('Please select a contest');
            return;
        }

        try {
            await reportService.exportContestCSV(selectedContest);
            toast.success('Contest report downloaded successfully');
        } catch (error) {
            toast.error('Failed to export contest report');
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Contest Reports</h1>

            {/* Contest Selection */}
            <div className="card mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Contest</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Contest *
                        </label>
                        <CustomDropdown
                            options={contests.map((contest) => ({
                                value: contest._id,
                                label: `${contest.title} - ${new Date(contest.startTime).toLocaleDateString()}`
                            }))}
                            value={selectedContest}
                            onChange={(val) => setSelectedContest(val)}
                            placeholder="Select Contest"
                        />
                    </div>

                    <div className="flex items-end space-x-3">
                        <button
                            onClick={handleGenerateReport}
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? (<>
    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Generating...
</>) : '📊 Generate Report'}
                        </button>
                        <button
                            onClick={handleExportCSV}
                            disabled={!contestReport}
                            className="btn-secondary"
                        >
                            📥 Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Contest Statistics */}
            {contestReport && (
                <>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
                            <h3 className="text-sm font-medium text-gray-600">Total Participants</h3>
                            <p className="text-3xl font-bold text-blue-600 mt-2">
                                {contestReport.totalParticipants}
                            </p>
                        </div>

                        <div className="card bg-gradient-to-br from-green-50 to-green-100">
                            <h3 className="text-sm font-medium text-gray-600">Total Submissions</h3>
                            <p className="text-3xl font-bold text-green-600 mt-2">
                                {contestReport.totalSubmissions}
                            </p>
                        </div>

                        <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
                            <h3 className="text-sm font-medium text-gray-600">Problems</h3>
                            <p className="text-3xl font-bold text-purple-600 mt-2">
                                {contestReport.problemCount}
                            </p>
                        </div>
                    </div>

                    {/* Leaderboard with Proctoring Data */}
                    <div className="card">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            Contest Leaderboard with Proctoring Data
                        </h2>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Roll Number</th>
                                        <th>Username</th>
                                        <th>Score</th>
                                        <th>Time (min)</th>
                                        <th>Solved</th>
                                        <th>Tab Switches</th>
                                        <th>Tab Duration (s)</th>
                                        <th>Paste Attempts</th>
                                        <th>Fullscreen Exits</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contestReport.leaderboard?.map((entry) => (
                                        <tr key={entry.rollNumber}>
                                            <td className="font-bold">{entry.rank}</td>
                                            <td>{entry.rollNumber}</td>
                                            <td className="font-medium">{entry.username}</td>
                                            <td className="font-bold text-primary-600">{entry.score}</td>
                                            <td>{entry.time}</td>
                                            <td>{entry.problemsSolved}</td>
                                            <td>
                                                <span
                                                    className={
                                                        entry.tabSwitchCount > 3
                                                            ? 'text-red-600 font-semibold'
                                                            : entry.tabSwitchCount > 0
                                                                ? 'text-orange-600'
                                                                : ''
                                                    }
                                                >
                                                    {entry.tabSwitchCount}
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    className={
                                                        entry.tabSwitchDuration > 60 ? 'text-red-600 font-semibold' : ''
                                                    }
                                                >
                                                    {entry.tabSwitchDuration}
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    className={
                                                        entry.pasteAttempts > 0 ? 'text-red-600 font-semibold' : ''
                                                    }
                                                >
                                                    {entry.pasteAttempts}
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    className={
                                                        entry.fullscreenExits > 0 ? 'text-red-600 font-semibold' : ''
                                                    }
                                                >
                                                    {entry.fullscreenExits}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Proctoring Violations Summary */}
                        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
                            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                                ⚠️ Proctoring Violations Detected
                            </h3>
                            <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                                <li>
                                    Students with <span className="font-semibold">Tab Switches {'>'} 3</span>: highlighted in red
                                </li>
                                <li>
                                    Students with <span className="font-semibold">Tab Duration {'>'} 60s</span>: highlighted in red
                                </li>
                                <li>
                                    Students with <span className="font-semibold">Paste Attempts</span>: highlighted in red
                                </li>
                                <li>
                                    Students with <span className="font-semibold">Fullscreen Exits</span>: highlighted in red
                                </li>
                            </ul>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ContestReports;
