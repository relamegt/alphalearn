import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import reportService from '../../services/reportService';
import adminService from '../../services/adminService';
import toast from 'react-hot-toast';
import Leaderboard from '../student/Leaderboard';
import CustomDropdown from '../../components/shared/CustomDropdown';
import { Download, FileText, Database, Layers } from 'lucide-react';

const ReportGenerator = () => {
    const { user } = useAuth();
    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState('');
    const [loading, setLoading] = useState(false);
    const [isExportingCSV, setIsExportingCSV] = useState(false);
    const [isExportingPDF, setIsExportingPDF] = useState(false);

    // Filter states for Export ONLY (Leaderboard handles its own display filtering)
    const [exportFilters, setExportFilters] = useState({
        branch: '',
        section: '',
    });

    useEffect(() => {
        if (user?.role === 'admin' || user?.role === 'instructor') {
            fetchBatches();
        }
    }, [user]);

    // Auto-select batch for instructors or if only one available
    useEffect(() => {
        if (batches.length > 0 && !selectedBatch) {
            if (user?.role === 'instructor') {
                // Default to current batchId if in list, else first one
                const currentBatch = batches.find(b => b._id === user.batchId);
                if (currentBatch) {
                    setSelectedBatch(currentBatch._id);
                } else {
                    setSelectedBatch(batches[0]._id);
                }
            } else if (batches.length === 1) {
                setSelectedBatch(batches[0]._id);
            }
        }
    }, [batches, user]);

    const fetchBatches = async () => {
        try {
            const data = await adminService.getAllBatches();
            setBatches(data.batches);
        } catch (error) {
            toast.error('Failed to fetch batches');
        }
    };

    const handleExportCSV = async () => {
        const batchToExport = selectedBatch || (user?.role === 'instructor' ? user.batchId : null);

        if (!batchToExport) {
            toast.error('Please select a batch');
            return;
        }

        setIsExportingCSV(true);
        try {
            await reportService.exportCSVReport(batchToExport, exportFilters);
            toast.success('CSV report downloaded successfully');
        } catch (error) {
            toast.error('Failed to export CSV report');
        } finally {
            setIsExportingCSV(false);
        }
    };

    const handleExportPDF = async () => {
        const batchToExport = selectedBatch || (user?.role === 'instructor' ? user.batchId : null);

        if (!batchToExport) {
            toast.error('Please select a batch');
            return;
        }

        setIsExportingPDF(true);
        try {
            await reportService.exportPDFReport(batchToExport, exportFilters);
            toast.success('PDF report downloaded successfully');
        } catch (error) {
            toast.error('Failed to export PDF report');
        } finally {
            setIsExportingPDF(false);
        }
    };

    // Prepare options for CustomDropdown
    const batchOptions = batches.map(b => ({ value: b._id, label: b.name }));

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        {user?.role === 'instructor' ? 'My Batch Leaderboard' : 'Batch Reports & Leaderboards'}
                    </h1>
                    <p className="text-gray-500 mt-2 ml-1">
                        View student performance and generate detailed reports.
                    </p>
                </div>
            </div>

            {/* Controls Section */}
            <div className="glass-panel p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    {/* Batch Selector */}
                    <div className="w-full md:w-80">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 ml-1">
                            Select Batch
                        </label>
                        <CustomDropdown
                            options={batchOptions}
                            value={selectedBatch}
                            onChange={setSelectedBatch}
                            placeholder="Select a Batch"
                            icon={Layers}
                        />
                    </div>

                    {/* Export Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <button
                            onClick={handleExportCSV}
                            disabled={!selectedBatch && user?.role !== 'instructor' || isExportingCSV}
                            className="bg-white border border-gray-200 hover:border-green-300 text-gray-700 hover:text-green-700 px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isExportingCSV ? (
                                <>
                                    <svg className="animate-spin -ml-1 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Database size={18} className="text-green-600" />
                                    Export CSV
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleExportPDF}
                            disabled={!selectedBatch && user?.role !== 'instructor' || isExportingPDF}
                            className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow-md shadow-primary-200 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            {isExportingPDF ? (
                                <>
                                    <svg className="animate-spin -ml-1 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <FileText size={18} />
                                    Export PDF
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Leaderboard Rendering */}
            {selectedBatch ? (
                <div className="animate-fade-in-up">
                    <Leaderboard batchId={selectedBatch} />
                </div>
            ) : (
                <div className="text-center py-24 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <Layers className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Batch Selected</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                        Please select a batch from the dropdown above to view the leaderboard and generate performance reports.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ReportGenerator;
