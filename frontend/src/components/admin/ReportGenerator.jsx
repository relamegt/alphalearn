import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import reportService from '../../services/reportService';
import adminService from '../../services/adminService';
import toast from 'react-hot-toast';

const ReportGenerator = () => {
    const { user } = useAuth();
    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState('');
    const [filters, setFilters] = useState({
        branch: '',
        timeline: '',
        section: '',
    });
    const [reportData, setReportData] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        try {
            const data = await adminService.getAllBatches();
            setBatches(data.batches);
        } catch (error) {
            toast.error('Failed to fetch batches');
        }
    };

    const handleGenerateReport = async () => {
        if (!selectedBatch) {
            toast.error('Please select a batch');
            return;
        }

        setLoading(true);
        try {
            const [report, analyticsData] = await Promise.all([
                reportService.getReport(selectedBatch, filters),
                reportService.getBatchAnalytics(selectedBatch),
            ]);

            setReportData(report.data);
            setAnalytics(analyticsData.analytics);
            toast.success('Report generated successfully');
        } catch (error) {
            toast.error(error.message || 'Failed to generate report');
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = async () => {
        if (!selectedBatch) {
            toast.error('Please select a batch');
            return;
        }

        try {
            await reportService.exportCSVReport(selectedBatch, filters);
            toast.success('CSV report downloaded successfully');
        } catch (error) {
            toast.error('Failed to export CSV report');
        }
    };

    const handleExportPDF = async () => {
        if (!selectedBatch) {
            toast.error('Please select a batch');
            return;
        }

        try {
            await reportService.exportPDFReport(selectedBatch, filters);
            toast.success('PDF report downloaded successfully');
        } catch (error) {
            toast.error('Failed to export PDF report');
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Report Generator</h1>

            {/* Batch Selection & Filters */}
            <div className="card mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Configure Report</h2>
                <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Batch *
                        </label>
                        <select
                            value={selectedBatch}
                            onChange={(e) => setSelectedBatch(e.target.value)}
                            className="input-field"
                        >
                            <option value="">Select Batch</option>
                            {batches.map((batch) => (
                                <option key={batch._id} value={batch._id}>
                                    {batch.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                        <select
                            value={filters.branch}
                            onChange={(e) => setFilters({ ...filters, branch: e.target.value })}
                            className="input-field"
                        >
                            <option value="">All Branches</option>
                            <option value="CSE">CSE</option>
                            <option value="ECE">ECE</option>
                            <option value="EEE">EEE</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Timeline</label>
                        <select
                            value={filters.timeline}
                            onChange={(e) => setFilters({ ...filters, timeline: e.target.value })}
                            className="input-field"
                        >
                            <option value="">All Time</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="quarter">This Quarter</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                        <select
                            value={filters.section}
                            onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                            className="input-field"
                        >
                            <option value="">All Sections</option>
                            <option value="Arrays">Arrays</option>
                            <option value="Strings">Strings</option>
                            <option value="Dynamic Programming">Dynamic Programming</option>
                        </select>
                    </div>
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={handleGenerateReport}
                        disabled={loading}
                        className="btn-primary"
                    >
                        {loading ? 'Generating...' : '📊 Generate Report'}
                    </button>
                    <button
                        onClick={handleExportCSV}
                        disabled={!reportData}
                        className="btn-secondary"
                    >
                        📥 Export CSV
                    </button>
                    <button
                        onClick={handleExportPDF}
                        disabled={!reportData}
                        className="btn-secondary"
                    >
                        📄 Export PDF
                    </button>
                </div>
            </div>

            {/* Analytics Summary */}
            {analytics && (
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
                        <h3 className="text-sm font-medium text-gray-600">Total Students</h3>
                        <p className="text-3xl font-bold text-blue-600 mt-2">
                            {analytics.batch.studentCount}
                        </p>
                    </div>

                    <div className="card bg-gradient-to-br from-green-50 to-green-100">
                        <h3 className="text-sm font-medium text-gray-600">Total Submissions</h3>
                        <p className="text-3xl font-bold text-green-600 mt-2">
                            {analytics.submissions.total}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Acceptance Rate: {analytics.submissions.acceptanceRate}%
                        </p>
                    </div>

                    <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
                        <h3 className="text-sm font-medium text-gray-600">Total Problems</h3>
                        <p className="text-3xl font-bold text-purple-600 mt-2">
                            {analytics.problems.total}
                        </p>
                    </div>

                    <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
                        <h3 className="text-sm font-medium text-gray-600">Total Contests</h3>
                        <p className="text-3xl font-bold text-orange-600 mt-2">
                            {analytics.contests.total}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Active: {analytics.contests.active} | Completed: {analytics.contests.completed}
                        </p>
                    </div>
                </div>
            )}

            {/* Report Data Table */}
            {reportData && (
                <div className="card">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Report Preview ({reportData.length} students)
                    </h2>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Roll Number</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Problems Solved</th>
                                    <th>Submissions</th>
                                    <th>Acceptance Rate</th>
                                    <th>Contest Participation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((student) => (
                                    <tr key={student.rollNumber}>
                                        <td className="font-medium">{student.rollNumber}</td>
                                        <td>{student.name}</td>
                                        <td className="text-sm text-gray-600">{student.email}</td>
                                        <td>{student.problemsSolved}</td>
                                        <td>{student.totalSubmissions}</td>
                                        <td>{student.acceptanceRate}%</td>
                                        <td>{student.contestsParticipated}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportGenerator;
