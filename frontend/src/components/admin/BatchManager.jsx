import { useState, useEffect } from 'react';
import adminService from '../../services/adminService';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, BarChart2, Clock, Users, Calendar, BookOpen, GraduationCap, X } from 'lucide-react';

const BatchManager = () => {
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);


    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showExtendModal, setShowExtendModal] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);

    // Selected Data
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [batchStats, setBatchStats] = useState(null);

    // Forms
    const [formData, setFormData] = useState({
        name: '',
        startDate: '',
        endDate: '',
        description: '',
        education: {
            institution: '',
            degree: '',
            startYear: '',
            endYear: ''
        },
        branches: [] // Available branches for students
    });

    const [editFormData, setEditFormData] = useState({
        name: '',
        startDate: '',
        endDate: '',
        description: '',
        education: {
            institution: '',
            degree: '',
            startYear: '',
            endYear: ''
        },
        branches: [] // Available branches for students
    });

    useEffect(() => {
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        try {
            const data = await adminService.getAllBatches();
            setBatches(data.batches);
        } catch (error) {
            toast.error(error.message || 'Failed to fetch batches');
        } finally {
            setLoading(false);
        }
    };



    const handleCreateBatch = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await adminService.createBatch(formData);
            toast.success('Batch created successfully');
            setShowCreateModal(false);
            setFormData({
                name: '',
                startDate: '',
                endDate: '',
                description: '',
                education: {
                    institution: '',
                    degree: '',
                    startYear: '',
                    endYear: ''
                },
                branches: []
            });
            fetchBatches();
        } catch (error) {
            toast.error(error.message || 'Failed to create batch');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditClick = (batch) => {
        setSelectedBatch(batch);
        setEditFormData({
            name: batch.name,
            startDate: new Date(batch.startDate).toISOString().split('T')[0],
            endDate: new Date(batch.endDate).toISOString().split('T')[0],
            description: batch.description || '',
            education: {
                institution: batch.education?.institution || '',
                degree: batch.education?.degree || '',
                startYear: batch.education?.startYear || new Date(batch.startDate).getFullYear(),
                endYear: batch.education?.endYear || new Date(batch.endDate).getFullYear()
            },
            branches: batch.branches || []
        });
        setShowEditModal(true);
    };

    const handleUpdateBatch = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await adminService.updateBatch(selectedBatch._id, editFormData);
            toast.success('Batch updated successfully');
            setShowEditModal(false);
            setSelectedBatch(null);
            fetchBatches();
        } catch (error) {
            toast.error(error.message || 'Failed to update batch');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExtendExpiry = async (newEndDate) => {
        setIsSubmitting(true);
        try {
            await adminService.extendBatchExpiry(selectedBatch._id, newEndDate);
            toast.success('Batch expiry extended successfully');
            setShowExtendModal(false);
            setSelectedBatch(null);
            fetchBatches();
        } catch (error) {
            toast.error(error.message || 'Failed to extend batch');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewStats = async (batch) => {
        setSelectedBatch(batch);
        setShowStatsModal(true);
        setBatchStats(null); // Reset previous stats
        try {
            const data = await adminService.getBatchStatistics(batch._id);
            setBatchStats(data.statistics);
        } catch (error) {
            toast.error('Failed to fetch batch statistics');
            setShowStatsModal(false);
        }
    };

    const handleDeleteBatch = async (batchId, batchName) => {
        if (!window.confirm(`⚠️ WARNING: Delete batch "${batchName}"?\n\nThis will PERMANENTLY DELETE:\n- All student accounts\n- All submissions\n- All progress data\n- All contest records\n\nThis action CANNOT be undone!`)) {
            return;
        }

        const confirmText = window.prompt(`Type "${batchName}" to confirm deletion:`);
        if (confirmText !== batchName) {
            toast.error('Batch name did not match. Deletion cancelled.');
            return;
        }

        try {
            await adminService.deleteBatch(batchId);
            toast.success('Batch deleted successfully');
            fetchBatches();
        } catch (error) {
            toast.error(error.message || 'Failed to delete batch');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Batch Management</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">Manage student batches, academic calendars, and statistics.</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={18} />
                    Create Batch
                </button>
            </div>

            {/* Batches Table */}
            <div className="glass-panel overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50/50 dark:bg-[#111117]/40 text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Batch Name</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Students</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {batches.map((batch) => (
                                <tr key={batch._id} className="hover:bg-gray-50/50 dark:hover:bg-[#23232e]/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-gray-900 dark:text-gray-100">{batch.name}</span>
                                            {batch.description && <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{batch.description}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <Calendar size={14} className="text-gray-400 dark:text-gray-500" />
                                            <span>{new Date(batch.startDate).toLocaleDateString()}</span>
                                            <span className="text-gray-400 dark:text-gray-600">→</span>
                                            <span>{new Date(batch.endDate).toLocaleDateString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${batch.status === 'active'
                                                ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-800'
                                                : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800'
                                                }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${batch.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                            {batch.status === 'active' ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                                            <Users size={14} className="text-gray-400 dark:text-gray-500" />
                                            {batch.studentCount || 0}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 text-gray-400 dark:text-gray-500">
                                            <button
                                                onClick={() => handleViewStats(batch)}
                                                className="p-2 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors tooltip-trigger"
                                                title="View Statistics"
                                            >
                                                <BarChart2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleEditClick(batch)}
                                                className="p-2 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors tooltip-trigger"
                                                title="Edit Batch"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedBatch(batch);
                                                    setShowExtendModal(true);
                                                }}
                                                className="p-2 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors tooltip-trigger"
                                                title="Extend Expiry"
                                            >
                                                <Clock size={18} />
                                            </button>
                                            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                                            <button
                                                onClick={() => handleDeleteBatch(batch._id, batch.name)}
                                                className="p-2 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors tooltip-trigger"
                                                title="Delete Batch"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {batches.length === 0 && (
                    <div className="p-12 text-center text-gray-400">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No batches found. Create one to get started.</p>
                    </div>
                )}
            </div>

            {/* Create Batch Modal */}
            {showCreateModal && (
                <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content max-w-4xl max-h-[90vh] overflow-y-auto p-0" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#111117]/40 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg">
                                    <GraduationCap size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Create New Batch</h2>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-[#23232e] rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleCreateBatch} className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Batch Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) =>
                                                setFormData({ ...formData, name: e.target.value })
                                            }
                                            className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                            placeholder="e.g., 2022-2026 CS Batch A"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Start Date <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.startDate}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, startDate: e.target.value })
                                                }
                                                className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                End Date <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.endDate}
                                                onChange={(e) =>
                                                    setFormData({ ...formData, endDate: e.target.value })
                                                }
                                                className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Educational Details Section */}
                                <div className="bg-gray-50 dark:bg-[#111117]/40 p-5 rounded-xl border border-gray-100 dark:border-gray-800">
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">Educational Defaults</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Default academic details for students in this batch.</p>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                College/Institution
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.education.institution}
                                                onChange={(e) =>
                                                    setFormData({
                                                        ...formData,
                                                        education: { ...formData.education, institution: e.target.value }
                                                    })
                                                }
                                                className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                                placeholder="e.g., ABC Engineering College"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Degree
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.education.degree}
                                                    onChange={(e) =>
                                                        setFormData({
                                                            ...formData,
                                                            education: { ...formData.education, degree: e.target.value }
                                                        })
                                                    }
                                                    className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                                    placeholder="e.g., B.Tech"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">From Year</label>
                                                <input
                                                    type="number"
                                                    value={formData.education.startYear}
                                                    onChange={(e) => setFormData({ ...formData, education: { ...formData.education, startYear: e.target.value } })}
                                                    className="input-field w-full"
                                                    placeholder="2024"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">To Year</label>
                                                <input
                                                    type="number"
                                                    value={formData.education.endYear}
                                                    onChange={(e) => setFormData({ ...formData, education: { ...formData.education, endYear: e.target.value } })}
                                                    className="input-field w-full"
                                                    placeholder="2028"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Available Branches
                                    </label>
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {formData.branches.map((branch, index) => (
                                                <div key={index} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">
                                                    <span>{branch}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newBranches = formData.branches.filter((_, i) => i !== index);
                                                            setFormData({ ...formData, branches: newBranches });
                                                        }}
                                                        className="text-blue-400 hover:text-blue-600 focus:outline-none"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                                placeholder="Type branch code and press Enter or Comma (e.g. CSE, IT)"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ',') {
                                                        e.preventDefault();
                                                        const val = e.target.value.trim().toUpperCase();
                                                        if (val && !formData.branches.includes(val)) {
                                                            setFormData({ ...formData, branches: [...formData.branches, val] });
                                                            e.target.value = '';
                                                        } else if (val && formData.branches.includes(val)) {
                                                            toast.error('Branch already added');
                                                            e.target.value = '';
                                                        }
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    const val = e.target.value.trim().toUpperCase();
                                                    if (val && !formData.branches.includes(val)) {
                                                        setFormData({ ...formData, branches: [...formData.branches, val] });
                                                        e.target.value = '';
                                                    }
                                                }}
                                            />
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Separate multiple branches with commas or press Enter.</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) =>
                                            setFormData({ ...formData, description: e.target.value })
                                        }
                                        className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                        rows="3"
                                        placeholder="Optional notes about this batch..."
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateModal(false)}
                                        className="btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary px-6" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Creating...
                                            </>
                                        ) : 'Create Batch'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Batch Modal */}
            {showEditModal && selectedBatch && (
                <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content max-w-4xl max-h-[90vh] overflow-y-auto p-0" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#111117]/40 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <Edit2 size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Batch</h2>
                            </div>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-[#23232e] rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleUpdateBatch} className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Batch Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={editFormData.name}
                                            onChange={(e) =>
                                                setEditFormData({ ...editFormData, name: e.target.value })
                                            }
                                            className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Start Date <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={editFormData.startDate}
                                                onChange={(e) =>
                                                    setEditFormData({ ...editFormData, startDate: e.target.value })
                                                }
                                                className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                End Date <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                value={editFormData.endDate}
                                                onChange={(e) =>
                                                    setEditFormData({ ...editFormData, endDate: e.target.value })
                                                }
                                                className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Educational Details Section */}
                                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-1">Educational Defaults</h3>
                                    <p className="text-sm text-gray-500 mb-4">Updates will apply to new students or when synced.</p>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                College/Institution
                                            </label>
                                            <input
                                                type="text"
                                                value={editFormData.education.institution}
                                                onChange={(e) =>
                                                    setEditFormData({
                                                        ...editFormData,
                                                        education: { ...editFormData.education, institution: e.target.value }
                                                    })
                                                }
                                                className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Degree
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editFormData.education.degree}
                                                    onChange={(e) =>
                                                        setEditFormData({
                                                            ...editFormData,
                                                            education: { ...editFormData.education, degree: e.target.value }
                                                        })
                                                    }
                                                    className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">From Year</label>
                                                <input
                                                    type="number"
                                                    value={editFormData.education.startYear}
                                                    onChange={(e) => setEditFormData({ ...editFormData, education: { ...editFormData.education, startYear: e.target.value } })}
                                                    className="input-field w-full"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">To Year</label>
                                                <input
                                                    type="number"
                                                    value={editFormData.education.endYear}
                                                    onChange={(e) => setEditFormData({ ...editFormData, education: { ...editFormData.education, endYear: e.target.value } })}
                                                    className="input-field w-full"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Available Branches
                                    </label>
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {editFormData.branches.map((branch, index) => (
                                                <div key={index} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">
                                                    <span>{branch}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newBranches = editFormData.branches.filter((_, i) => i !== index);
                                                            setEditFormData({ ...editFormData, branches: newBranches });
                                                        }}
                                                        className="text-blue-400 hover:text-blue-600 focus:outline-none"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                className="input-field w-full"
                                                placeholder="Type branch code and press Enter or Comma (e.g. CSE, IT)"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ',') {
                                                        e.preventDefault();
                                                        const val = e.target.value.trim().toUpperCase();
                                                        if (val && !editFormData.branches.includes(val)) {
                                                            setEditFormData({ ...editFormData, branches: [...editFormData.branches, val] });
                                                            e.target.value = '';
                                                        } else if (val && editFormData.branches.includes(val)) {
                                                            toast.error('Branch already added');
                                                            e.target.value = '';
                                                        }
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    const val = e.target.value.trim().toUpperCase();
                                                    if (val && !editFormData.branches.includes(val)) {
                                                        setEditFormData({ ...editFormData, branches: [...editFormData.branches, val] });
                                                        e.target.value = '';
                                                    }
                                                }}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Separate multiple branches with commas or press Enter.</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={editFormData.description}
                                        onChange={(e) =>
                                            setEditFormData({ ...editFormData, description: e.target.value })
                                        }
                                        className="input-field w-full"
                                        rows="3"
                                    />
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditModal(false)}
                                        className="btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary px-6" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Updating...
                                            </>
                                        ) : 'Update Batch'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Extend Expiry Modal */}
            {showExtendModal && selectedBatch && (
                <div className="modal-backdrop" onClick={() => setShowExtendModal(false)}>
                    <div className="modal-content max-w-md p-0" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#111117]/40 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                                    <Clock size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Extend Batch</h2>
                            </div>
                            <button
                                onClick={() => setShowExtendModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-[#23232e] rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="bg-gray-50 dark:bg-[#111117]/50 p-4 rounded-lg mb-4 border border-gray-200 dark:border-gray-700">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Current End Date: <strong className="text-gray-900 dark:text-gray-100">{new Date(selectedBatch.endDate).toLocaleDateString()}</strong>
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Select a new date after the current end date.</p>
                            </div>

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const newDate = e.target.newEndDate.value;
                                    handleExtendExpiry(newDate);
                                }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        New End Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        name="newEndDate"
                                        min={selectedBatch.endDate}
                                        className="input-field w-full dark:bg-[#111117] dark:border-gray-700 dark:text-gray-100"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowExtendModal(false)}
                                        className="btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Extending...
                                            </>
                                        ) : 'Extend'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Statistics Modal */}
            {showStatsModal && selectedBatch && (
                <div className="modal-backdrop" onClick={() => setShowStatsModal(false)}>
                    <div className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto p-0" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#111117]/40 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                                    <BarChart2 size={24} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Batch Analytics</h2>
                            </div>
                            <button
                                onClick={() => setShowStatsModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-[#23232e] rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6">
                            {batchStats ? (
                                <div className="space-y-6">
                                    {/* Batch Information */}
                                    <div className="bg-gray-50 dark:bg-[#111117]/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                        <h3 className="text-sm font-semibold mb-3 text-gray-500 dark:text-gray-400 uppercase tracking-wider">Batch Details</h3>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400 block text-xs">Name</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">{batchStats.batch?.name}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400 block text-xs">Status</span>
                                                <span className={`font-medium ${batchStats.batch?.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {batchStats.batch?.status}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400 block text-xs">Start Date</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    {batchStats.batch?.startDate ? new Date(batchStats.batch.startDate).toLocaleDateString() : 'N/A'}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400 block text-xs">End Date</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    {batchStats.batch?.endDate ? new Date(batchStats.batch.endDate).toLocaleDateString() : 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Statistics Grid */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50 dark:bg-blue-900/30 p-5 rounded-xl border border-blue-100 dark:border-blue-800">
                                            <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">Total Students</h4>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{batchStats.students?.total || 0}</p>
                                                <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800/50 px-2 py-0.5 rounded-full">
                                                    {batchStats.students?.active || 0} Active
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-purple-50 dark:bg-purple-900/30 p-5 rounded-xl border border-purple-100 dark:border-purple-800">
                                            <h4 className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-2">Problems Solved</h4>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">{batchStats.problems?.solved || 0}</p>
                                            </div>
                                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                                {batchStats.problems?.solvedPercentage || '0.00'}% Completion Rate
                                            </p>
                                        </div>

                                        <div className="bg-green-50 dark:bg-green-900/30 p-5 rounded-xl border border-green-100 dark:border-green-800">
                                            <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Total Submissions</h4>
                                            <p className="text-3xl font-bold text-green-900 dark:text-green-100">{batchStats.submissions?.total || 0}</p>
                                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                                Avg {batchStats.submissions?.averagePerStudent || '0.00'} per student
                                            </p>
                                        </div>

                                        <div className="bg-yellow-50 dark:bg-yellow-900/30 p-5 rounded-xl border border-yellow-100 dark:border-yellow-800">
                                            <h4 className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">Acceptance Rate</h4>
                                            <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{batchStats.submissions?.acceptanceRate || 0}%</p>
                                            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                                {batchStats.submissions?.accepted || 0} Accepted
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-center py-12">
                                    <div className="spinner"></div>
                                </div>
                            )}
                            <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => setShowStatsModal(false)}
                                    className="btn-secondary"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchManager;
