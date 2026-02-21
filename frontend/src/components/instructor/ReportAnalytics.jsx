import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import reportService from '../../services/reportService';
import adminService from '../../services/adminService';
import contestService from '../../services/contestService';
import toast from 'react-hot-toast';
import CustomDropdown from '../shared/CustomDropdown';

const ReportAnalytics = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('batch');

    // Data States
    const [batches, setBatches] = useState([]);
    const [contests, setContests] = useState([]);

    // Selection States
    const [selectedBatch, setSelectedBatch] = useState('');
    const [selectedContest, setSelectedContest] = useState('');

    // Batch Report States - Store FULL data
    const [fullBatchReportData, setFullBatchReportData] = useState([]);
    const [fullBatchReportCount, setFullBatchReportCount] = useState(0);
    const [batchReportFetched, setBatchReportFetched] = useState(false);

    // Contest Report States
    const [contestReportData, setContestReportData] = useState(null);
    const [contestReportFetched, setContestReportFetched] = useState(false);

    // Analytics
    const [analyticsData, setAnalyticsData] = useState(null);

    const [loading, setLoading] = useState(false);

    // Client-side filters (no section)
    const [filters, setFilters] = useState({
        branch: '',
        timeline: 'all',
    });

    useEffect(() => {
        fetchBatches();
    }, []);

    // Auto-fetch batch report when batch is selected
    useEffect(() => {
        if (selectedBatch) {
            fetchFullBatchReport();
            fetchContestsForBatch();
            // Reset contest state
            setSelectedContest('');
            setContestReportData(null);
            setContestReportFetched(false);
            // Reset filters
            setFilters({ branch: '', timeline: 'all' });
        } else {
            // Clear data when no batch selected
            setFullBatchReportData([]);
            setFullBatchReportCount(0);
            setBatchReportFetched(false);
            setFilters({ branch: '', timeline: 'all' });
        }
    }, [selectedBatch]);

    const fetchBatches = async () => {
        try {
            const data = await adminService.getAllBatches();
            setBatches(data.batches || []);
        } catch (error) {
            toast.error('Failed to fetch batches');
        }
    };

    const fetchContestsForBatch = async () => {
        try {
            const data = await contestService.getContestsByBatch(selectedBatch);
            setContests(data.contests || []);
        } catch (error) {
            console.error('Failed to fetch contests');
        }
    };

    // Fetch FULL batch data automatically (no filters)
    const fetchFullBatchReport = async () => {
        if (!selectedBatch) return;
        setLoading(true);
        setBatchReportFetched(false);
        try {
            // Fetch with empty filters to get ALL students
            const res = await reportService.getReport(selectedBatch, {});
            const rows = res?.data || [];
            const count = res?.count ?? rows.length ?? 0;

            setFullBatchReportData(rows);
            setFullBatchReportCount(count);
            setBatchReportFetched(true);

            if (count === 0) {
                toast('No students found in this batch');
            } else {
                toast.success(`Loaded ${count} student${count === 1 ? '' : 's'}`);
            }
        } catch (error) {
            toast.error(error.message || 'Failed to fetch batch data');
            setFullBatchReportData([]);
            setFullBatchReportCount(0);
            setBatchReportFetched(true);
        } finally {
            setLoading(false);
        }
    };

    // CLIENT-SIDE FILTERING with useMemo
    const filteredBatchData = useMemo(() => {
        if (!batchReportFetched || fullBatchReportData.length === 0) return [];

        return fullBatchReportData.filter((student) => {
            // Branch filter
            const branchMatch = !filters.branch || student.branch === filters.branch;

            // Timeline filter - adjust based on your data structure
            // Note: This assumes you have a date field. Adjust as needed.
            let timelineMatch = true;
            if (filters.timeline !== 'all') {
                const now = new Date();
                let cutoffDate;

                switch (filters.timeline) {
                    case 'week':
                        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'month':
                        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    default:
                        cutoffDate = new Date(0);
                }

                // Adjust field name based on your data (lastActive, updatedAt, etc.)
                // For now, if no date field exists, timeline filter will show all
                if (student.lastActive || student.updatedAt || student.createdAt) {
                    const studentDate = new Date(
                        student.lastActive || student.updatedAt || student.createdAt
                    );
                    timelineMatch = studentDate >= cutoffDate;
                }
            }

            return branchMatch && timelineMatch;
        });
    }, [fullBatchReportData, filters.branch, filters.timeline, batchReportFetched]);

    const filteredCount = filteredBatchData.length;

    // Export handlers
    const handleExportBatchCSV = async () => {
        if (!selectedBatch) return toast.error('Please select a batch');
        try {
            // Send current filters for export
            const exportFilters = {
                branch: filters.branch,
                timeline: filters.timeline !== 'all' ? filters.timeline : '',
            };
            await reportService.exportCSVReport(selectedBatch, exportFilters);
            toast.success('CSV downloaded');
        } catch (error) {
            toast.error('Failed to export CSV');
        }
    };

    const handleExportBatchPDF = async () => {
        if (!selectedBatch) return toast.error('Please select a batch');
        try {
            const exportFilters = {
                branch: filters.branch,
                timeline: filters.timeline !== 'all' ? filters.timeline : '',
            };
            await reportService.exportPDFReport(selectedBatch, exportFilters);
            toast.success('PDF downloaded');
        } catch (error) {
            toast.error('Failed to export PDF');
        }
    };

    // Contest Report Handlers
    const handleGenerateContestReport = async () => {
        if (!selectedContest) {
            toast.error('Please select a contest');
            return;
        }
        setLoading(true);
        try {
            const res = await reportService.getContestReport(selectedContest);
            const report = res?.report || null;

            setContestReportData(report);
            setContestReportFetched(true);

            if (!report?.leaderboard?.length) {
                toast('No participants for this contest');
            } else {
                toast.success('Contest report generated');
            }
        } catch (error) {
            toast.error(error.message || 'Failed to generate report');
            setContestReportData(null);
            setContestReportFetched(true);
        } finally {
            setLoading(false);
        }
    };

    const handleExportContestCSV = async () => {
        if (!selectedContest) return toast.error('Please select a contest');
        try {
            await reportService.exportContestCSV(selectedContest);
            toast.success('CSV downloaded');
        } catch (error) {
            toast.error('Failed to export CSV');
        }
    };

    // Analytics Handlers
    const handleFetchAnalytics = async () => {
        if (!selectedBatch) {
            toast.error('Please select a batch');
            return;
        }
        setLoading(true);
        try {
            const data = await reportService.getBatchAnalytics(selectedBatch);
            setAnalyticsData(data.analytics || null);
            toast.success('Analytics fetched');
        } catch (error) {
            toast.error('Failed to fetch analytics');
            setAnalyticsData(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Reports & Analytics</h1>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('batch')}
                    className={`px-6 py-3 font-medium transition-colors ${activeTab === 'batch'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Batch Reports
                </button>
                <button
                    onClick={() => setActiveTab('contest')}
                    className={`px-6 py-3 font-medium transition-colors ${activeTab === 'contest'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Contest Reports
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`px-6 py-3 font-medium transition-colors ${activeTab === 'analytics'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Batch Analytics
                </button>
            </div>

            {/* TAB: Batch Reports */}
            {activeTab === 'batch' && (
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Batch Report
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Batch *
                                </label>
                                <CustomDropdown
                                    options={[
                                        ...batches.map((batch) => ({ value: batch._id, label: batch.name }))
                                    ]}
                                    value={selectedBatch}
                                    onChange={(val) => setSelectedBatch(val)}
                                    placeholder="Select Batch"
                                    disabled={loading}
                                />
                            </div>

                            {/* Client-side filters */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Filter by Branch
                                </label>
                                <CustomDropdown
                                    options={[
                                        { value: '', label: 'All Branches' },
                                        { value: 'CSE', label: 'CSE' },
                                        { value: 'ECE', label: 'ECE' },
                                        { value: 'EEE', label: 'EEE' },
                                        { value: 'MECH', label: 'MECH' },
                                        { value: 'CIVIL', label: 'CIVIL' }
                                    ]}
                                    value={filters.branch}
                                    onChange={(val) => setFilters((prev) => ({ ...prev, branch: val }))}
                                    placeholder="All Branches"
                                    disabled={!batchReportFetched || loading}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Filter by Timeline
                                </label>
                                <CustomDropdown
                                    options={[
                                        { value: 'all', label: 'All Time' },
                                        { value: 'week', label: 'This Week' },
                                        { value: 'month', label: 'This Month' }
                                    ]}
                                    value={filters.timeline}
                                    onChange={(val) => setFilters((prev) => ({ ...prev, timeline: val }))}
                                    placeholder="All Time"
                                    disabled={!batchReportFetched || loading}
                                />
                            </div>
                        </div>

                        {/* Loading indicator */}
                        {loading && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <p className="text-blue-700 text-sm">
                                    ⏳ Loading batch data...
                                </p>
                            </div>
                        )}

                        {/* Summary Stats */}
                        {batchReportFetched && !loading && (
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-600 uppercase tracking-wide">
                                            Total Students
                                        </p>
                                        <p className="text-2xl font-bold text-gray-900 mt-1">
                                            {fullBatchReportCount}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600 uppercase tracking-wide">
                                            Showing
                                        </p>
                                        <p className="text-2xl font-bold text-primary-600 mt-1">
                                            {filteredCount}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600 uppercase tracking-wide">
                                            Branch
                                        </p>
                                        <p className="text-lg font-semibold text-gray-900 mt-1">
                                            {filters.branch || 'All'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-600 uppercase tracking-wide">
                                            Timeline
                                        </p>
                                        <p className="text-lg font-semibold text-gray-900 mt-1">
                                            {filters.timeline === 'all'
                                                ? 'All Time'
                                                : filters.timeline === 'week'
                                                    ? 'This Week'
                                                    : 'This Month'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Export buttons */}
                        <div className="flex space-x-3">
                            <button
                                onClick={handleExportBatchCSV}
                                disabled={!selectedBatch || loading || !batchReportFetched}
                                className="btn-secondary"
                            >
                                📥 Export CSV
                            </button>
                            <button
                                onClick={handleExportBatchPDF}
                                disabled={!selectedBatch || loading || !batchReportFetched}
                                className="btn-secondary"
                            >
                                📄 Export PDF
                            </button>
                        </div>
                    </div>

                    {/* Filtered Table */}
                    {batchReportFetched && filteredCount > 0 && (
                        <div className="card">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Report Data ({filteredCount} of {fullBatchReportCount} students)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr className="divide-x divide-gray-200 border-b border-gray-200">
                                            <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider w-16">
                                                Rank
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                Roll No
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                Branch
                                            </th>
                                            <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                Username
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-wider bg-gray-50">
                                                HackerRank (Total)
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                Alpha Coins
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                Primary
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                LeetCode
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                InterviewBit
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                CodeChef
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                                                Codeforces
                                            </th>
                                            <th className="px-3 py-2 text-center text-xs font-bold text-gray-900 uppercase tracking-wider border-l-2 border-gray-200">
                                                Overall Score
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredBatchData.map((student, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-gray-700">
                                                    #{student.rank ?? idx + 1}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 font-mono">
                                                    {student.rollNumber}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {student.name}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm">
                                                    <span className="px-2 py-0.5 inline-flex text-xs leading-4 font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                                                        {student.branch}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-xs">
                                                    {student.username}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center font-medium bg-gray-50/50">
                                                    {student.hackerrank || 0}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center font-medium">
                                                    {student.alphaKnowledgeBasic || 0}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-400 text-center">
                                                    {student.alphaKnowledgePrimary || 0}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center font-medium">
                                                    {student.leetcode || 0}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center font-medium">
                                                    {student.interviewbit || 0}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center font-medium">
                                                    {student.codechef || 0}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-center font-medium">
                                                    {student.codeforces || 0}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-primary-600 text-center border-l-2 border-gray-100 bg-gray-50/30">
                                                    {student.overallScore || 0}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Empty state - filtered out */}
                    {batchReportFetched &&
                        filteredCount === 0 &&
                        fullBatchReportCount > 0 &&
                        !loading && (
                            <div className="card">
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-4">🔍</div>
                                    <p className="text-gray-700 text-lg font-medium mb-2">
                                        No students match your filters
                                    </p>
                                    <p className="text-gray-500 text-sm">
                                        Try adjusting the branch or timeline filters above.
                                    </p>
                                    <button
                                        onClick={() =>
                                            setFilters({ branch: '', timeline: 'all' })
                                        }
                                        className="mt-4 btn-secondary"
                                    >
                                        Reset Filters
                                    </button>
                                </div>
                            </div>
                        )}

                    {/* Empty state - no students in batch */}
                    {batchReportFetched && fullBatchReportCount === 0 && !loading && (
                        <div className="card">
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">📭</div>
                                <p className="text-gray-700 text-lg font-medium">
                                    No students in this batch
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Contest Reports */}
            {activeTab === 'contest' && (
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Generate Contest Report
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Batch *
                                </label>
                                <CustomDropdown
                                    options={[
                                        ...batches.map((batch) => ({ value: batch._id, label: batch.name }))
                                    ]}
                                    value={selectedBatch}
                                    onChange={(val) => {
                                        setSelectedBatch(val);
                                        setSelectedContest('');
                                        setContestReportData(null);
                                        setContestReportFetched(false);
                                    }}
                                    placeholder="Select Batch"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Contest *
                                </label>
                                <CustomDropdown
                                    options={[
                                        ...contests.map((contest) => ({
                                            value: contest._id,
                                            label: `${contest.title} - ${new Date(contest.startTime).toLocaleDateString()}`
                                        }))
                                    ]}
                                    value={selectedContest}
                                    onChange={(val) => {
                                        setSelectedContest(val);
                                        setContestReportData(null);
                                        setContestReportFetched(false);
                                    }}
                                    placeholder="Select Contest"
                                    disabled={!selectedBatch}
                                />
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <button
                                onClick={handleGenerateContestReport}
                                disabled={loading || !selectedContest}
                                className="btn-primary"
                            >
                                {loading ? 'Generating...' : 'Generate Report'}
                            </button>
                            <button
                                onClick={handleExportContestCSV}
                                disabled={!selectedContest || !contestReportFetched}
                                className="btn-secondary"
                            >
                                📥 Export CSV
                            </button>
                        </div>
                    </div>

                    {contestReportFetched && contestReportData && (
                        <>
                            {/* Contest Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="card bg-blue-50 border-blue-100">
                                    <h3 className="text-sm font-medium text-gray-600">
                                        Total Participants
                                    </h3>
                                    <p className="text-3xl font-bold text-blue-600 mt-2">
                                        {contestReportData.contest?.participants ??
                                            contestReportData.leaderboard?.length ??
                                            0}
                                    </p>
                                </div>
                                <div className="card bg-green-50 border-green-100">
                                    <h3 className="text-sm font-medium text-gray-600">
                                        Contest Title
                                    </h3>
                                    <p className="text-lg font-semibold text-green-700 mt-2">
                                        {contestReportData.contest?.title || 'N/A'}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                        {contestReportData.contest?.startTime
                                            ? new Date(
                                                contestReportData.contest.startTime
                                            ).toLocaleString()
                                            : ''}
                                        {' - '}
                                        {contestReportData.contest?.endTime
                                            ? new Date(
                                                contestReportData.contest.endTime
                                            ).toLocaleString()
                                            : ''}
                                    </p>
                                </div>
                                <div className="card bg-purple-50 border-purple-100">
                                    <h3 className="text-sm font-medium text-gray-600">
                                        Leaderboard Entries
                                    </h3>
                                    <p className="text-3xl font-bold text-purple-600 mt-2">
                                        {contestReportData.leaderboard?.length || 0}
                                    </p>
                                </div>
                            </div>

                            {/* Leaderboard Table */}
                            <div className="card">
                                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                    Contest Leaderboard & Proctoring Data
                                </h2>
                                {contestReportData.leaderboard &&
                                    contestReportData.leaderboard.length > 0 ? (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Rank
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Roll Number
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Username
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Score
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Time (min)
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Solved
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Tab Switches
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Duration (s)
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                            Paste
                                                        </th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                                            FS Exits
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {contestReportData.leaderboard.map((entry) => (
                                                        <tr
                                                            key={entry.studentId}
                                                            className="hover:bg-gray-50"
                                                        >
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                                                                {entry.rank}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                                                {entry.rollNumber}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                {entry.username}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-primary-600">
                                                                {entry.score}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                                                {entry.time}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                                                {entry.problemsSolved}
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                                <span
                                                                    className={
                                                                        entry.tabSwitchCount > 3
                                                                            ? 'text-red-600 font-bold'
                                                                            : entry.tabSwitchCount > 0
                                                                                ? 'text-orange-600'
                                                                                : 'text-gray-900'
                                                                    }
                                                                >
                                                                    {entry.tabSwitchCount}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                                <span
                                                                    className={
                                                                        entry.tabSwitchDuration > 60
                                                                            ? 'text-red-600 font-bold'
                                                                            : 'text-gray-900'
                                                                    }
                                                                >
                                                                    {entry.tabSwitchDuration}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                                <span
                                                                    className={
                                                                        entry.pasteAttempts > 0
                                                                            ? 'text-red-600 font-bold'
                                                                            : 'text-gray-900'
                                                                    }
                                                                >
                                                                    {entry.pasteAttempts}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                                <span
                                                                    className={
                                                                        entry.fullscreenExits > 0
                                                                            ? 'text-red-600 font-bold'
                                                                            : 'text-gray-900'
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

                                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                                            <p className="font-bold mb-1">⚠️ Proctoring Legend:</p>
                                            <ul className="list-disc list-inside space-y-1">
                                                <li>
                                                    <span className="text-red-600 font-bold">Red</span>:{' '}
                                                    Suspicious activity (high violations)
                                                </li>
                                                <li>
                                                    <span className="text-orange-600">Orange</span>:{' '}
                                                    Minor violations
                                                </li>
                                            </ul>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-12">
                                        <p className="text-gray-500">
                                            No leaderboard data available for this contest.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {contestReportFetched && !contestReportData && !loading && selectedContest && (
                        <div className="card">
                            <div className="text-center py-12">
                                <p className="text-gray-500">No report data found for this contest.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Batch Analytics */}
            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    <div className="card">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Batch Analytics
                            </h3>
                            <div className="flex space-x-3">
                                <div className="w-64">
                                    <CustomDropdown
                                        options={[
                                            ...batches.map((batch) => ({ value: batch._id, label: batch.name }))
                                        ]}
                                        value={selectedBatch}
                                        onChange={(val) => setSelectedBatch(val)}
                                        placeholder="Select Batch"
                                    />
                                </div>
                                <button
                                    onClick={handleFetchAnalytics}
                                    disabled={loading || !selectedBatch}
                                    className="btn-primary"
                                >
                                    {loading ? 'Loading...' : 'Fetch Analytics'}
                                </button>
                            </div>
                        </div>

                        {analyticsData && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="card bg-blue-50 border-blue-100">
                                    <h4 className="text-sm font-medium text-gray-600">
                                        Batch Information
                                    </h4>
                                    <p className="text-2xl font-bold text-blue-600 mt-2">
                                        {analyticsData.batch?.studentCount || 0} Students
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Status:{' '}
                                        <span className="font-semibold capitalize">
                                            {analyticsData.batch?.status}
                                        </span>
                                    </p>
                                </div>

                                <div className="card bg-green-50 border-green-100">
                                    <h4 className="text-sm font-medium text-gray-600">Submissions</h4>
                                    <p className="text-2xl font-bold text-green-600 mt-2">
                                        {analyticsData.submissions?.total || 0}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Accepted: {analyticsData.submissions?.accepted || 0} (
                                        {analyticsData.submissions?.acceptanceRate || 0}%)
                                    </p>
                                </div>

                                <div className="card bg-purple-50 border-purple-100">
                                    <h4 className="text-sm font-medium text-gray-600">Contests</h4>
                                    <p className="text-2xl font-bold text-purple-600 mt-2">
                                        {analyticsData.contests?.total || 0}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Active: {analyticsData.contests?.active || 0} | Completed:{' '}
                                        {analyticsData.contests?.completed || 0}
                                    </p>
                                </div>
                            </div>
                        )}

                        {!analyticsData && !loading && (
                            <div className="text-center py-12 text-gray-500">
                                <div className="text-6xl mb-4">📊</div>
                                <p className="text-lg">
                                    Select a batch and click &quot;Fetch Analytics&quot; to view data.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportAnalytics;
