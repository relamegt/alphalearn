import { useState, useEffect } from 'react';
import adminService from '../../services/adminService';
import toast from 'react-hot-toast';

const BatchManager = () => {
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [systemAnalytics, setSystemAnalytics] = useState(null);

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
        streams: [] // Available branches/streams for students
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
        streams: [] // Available branches/streams for students
    });

    useEffect(() => {
        fetchBatches();
        fetchSystemAnalytics();
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

    const fetchSystemAnalytics = async () => {
        try {
            const data = await adminService.getSystemAnalytics();
            setSystemAnalytics(data.analytics);
        } catch (error) {
            console.error('Failed to fetch system analytics', error);
        }
    };

    const handleCreateBatch = async (e) => {
        e.preventDefault();
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
                    degree: ''
                },
                streams: []
            });
            fetchBatches();
            fetchSystemAnalytics();
        } catch (error) {
            toast.error(error.message || 'Failed to create batch');
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
            streams: batch.streams || []
        });
        setShowEditModal(true);
    };

    const handleUpdateBatch = async (e) => {
        e.preventDefault();
        try {
            await adminService.updateBatch(selectedBatch._id, editFormData);
            toast.success('Batch updated successfully');
            setShowEditModal(false);
            setSelectedBatch(null);
            fetchBatches();
        } catch (error) {
            toast.error(error.message || 'Failed to update batch');
        }
    };

    const handleExtendExpiry = async (newEndDate) => {
        try {
            await adminService.extendBatchExpiry(selectedBatch._id, newEndDate);
            toast.success('Batch expiry extended successfully');
            setShowExtendModal(false);
            setSelectedBatch(null);
            fetchBatches();
        } catch (error) {
            toast.error(error.message || 'Failed to extend batch');
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
            fetchSystemAnalytics();
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
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Batch Management</h1>

            {/* System Analytics Cards */}
            {systemAnalytics && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="card bg-blue-50 border-blue-100">
                        <h3 className="text-gray-500 text-sm font-medium">Total Users</h3>
                        <p className="text-3xl font-bold text-blue-600">{systemAnalytics.users?.total || 0}</p>
                        <p className="text-xs text-blue-400 mt-1">
                            {systemAnalytics.users?.students || 0} Students | {systemAnalytics.users?.instructors || 0} Instructors
                        </p>
                    </div>
                    <div className="card bg-green-50 border-green-100">
                        <h3 className="text-gray-500 text-sm font-medium">Active Batches</h3>
                        <p className="text-3xl font-bold text-green-600">{systemAnalytics.batches?.active || 0}</p>
                        <p className="text-xs text-green-400 mt-1">Total: {systemAnalytics.batches?.total || 0}</p>
                    </div>
                    <div className="card bg-purple-50 border-purple-100">
                        <h3 className="text-gray-500 text-sm font-medium">Problems</h3>
                        <p className="text-3xl font-bold text-purple-600">{systemAnalytics.problems?.total || 0}</p>
                        <p className="text-xs text-purple-400 mt-1">
                            {systemAnalytics.problems?.byDifficulty?.Easy || 0} Easy | {systemAnalytics.problems?.byDifficulty?.Hard || 0} Hard
                        </p>
                    </div>
                    <div className="card bg-orange-50 border-orange-100">
                        <h3 className="text-gray-500 text-sm font-medium">Total Submissions</h3>
                        <p className="text-3xl font-bold text-orange-600">{systemAnalytics.submissions?.total || 0}</p>
                    </div>
                </div>
            )}

            <div className="flex justify-end mb-4">
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary"
                >
                    + Create Batch
                </button>
            </div>

            {/* Batches Table */}
            <div className="card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Batch Name</th>
                                <th>Start Date</th>
                                <th>End Date</th>
                                <th>Status</th>
                                <th>Students</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {batches.map((batch) => (
                                <tr key={batch._id}>
                                    <td className="font-semibold">{batch.name}</td>
                                    <td>{new Date(batch.startDate).toLocaleDateString()}</td>
                                    <td>{new Date(batch.endDate).toLocaleDateString()}</td>
                                    <td>
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-medium ${batch.status === 'active'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-red-100 text-red-700'
                                                }`}
                                        >
                                            {batch.status}
                                        </span>
                                    </td>
                                    <td>{batch.studentCount || 0}</td>
                                    <td className="space-x-2">
                                        <button
                                            onClick={() => handleViewStats(batch)}
                                            className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                                        >
                                            Stats
                                        </button>
                                        <button
                                            onClick={() => handleEditClick(batch)}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedBatch(batch);
                                                setShowExtendModal(true);
                                            }}
                                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                                        >
                                            Extend
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBatch(batch._id, batch.name)}
                                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Batch Modal */}
            {showCreateModal && (
                <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Create New Batch</h2>
                        <form onSubmit={handleCreateBatch} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Batch Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    placeholder="e.g., 2022-2026 Batch"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Start Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) =>
                                            setFormData({ ...formData, startDate: e.target.value })
                                        }
                                        className="mt-1 input-field"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        End Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) =>
                                            setFormData({ ...formData, endDate: e.target.value })
                                        }
                                        className="mt-1 input-field"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Educational Details Section */}
                            <div className="border-t pt-4 mt-4">
                                <h3 className="text-lg font-semibold text-gray-800 mb-3">Educational Details</h3>
                                <p className="text-sm text-gray-600 mb-4">These details will be automatically assigned to all students in this batch</p>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
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
                                        className="mt-1 input-field"
                                        placeholder="e.g., ABC Engineering College"
                                    />
                                </div>

                                <div className="mt-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
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
                                            className="mt-1 input-field"
                                            placeholder="e.g., B.Tech, B.E., MCA"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Available Branches/Streams
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Students will select from these options</p>
                                <div className="space-y-2">
                                    {formData.streams.map((stream, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={stream}
                                                onChange={(e) => {
                                                    const newStreams = [...formData.streams];
                                                    newStreams[index] = e.target.value;
                                                    setFormData({ ...formData, streams: newStreams });
                                                }}
                                                className="input-field flex-1"
                                                placeholder="e.g., CSE, IT, AIML"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newStreams = formData.streams.filter((_, i) => i !== index);
                                                    setFormData({ ...formData, streams: newStreams });
                                                }}
                                                className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, streams: [...formData.streams, ''] })}
                                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                                    >
                                        + Add Branch/Stream
                                    </button>
                                </div>
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({ ...formData, description: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    rows="3"
                                    placeholder="Optional batch description"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Create Batch
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Batch Modal */}
            {showEditModal && selectedBatch && (
                <div className="modal-backdrop" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Edit Batch</h2>
                        <form onSubmit={handleUpdateBatch} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Batch Name *
                                </label>
                                <input
                                    type="text"
                                    value={editFormData.name}
                                    onChange={(e) =>
                                        setEditFormData({ ...editFormData, name: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        Start Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={editFormData.startDate}
                                        onChange={(e) =>
                                            setEditFormData({ ...editFormData, startDate: e.target.value })
                                        }
                                        className="mt-1 input-field"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                        End Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={editFormData.endDate}
                                        onChange={(e) =>
                                            setEditFormData({ ...editFormData, endDate: e.target.value })
                                        }
                                        className="mt-1 input-field"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Educational Details Section */}
                            <div className="border-t pt-4 mt-4">
                                <h3 className="text-lg font-semibold text-gray-800 mb-3">Educational Details</h3>
                                <p className="text-sm text-gray-600 mb-4">These details will be automatically assigned to all students in this batch</p>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700">
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
                                        className="mt-1 input-field"
                                        placeholder="e.g., ABC Engineering College"
                                    />
                                </div>

                                <div className="mt-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
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
                                            className="mt-1 input-field"
                                            placeholder="e.g., B.Tech, B.E., MCA"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Description
                                </label>
                                <textarea
                                    value={editFormData.description}
                                    onChange={(e) =>
                                        setEditFormData({ ...editFormData, description: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    rows="3"
                                />
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Update Batch
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Extend Expiry Modal */}
            {showExtendModal && selectedBatch && (
                <div className="modal-backdrop" onClick={() => setShowExtendModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">
                            Extend Batch: {selectedBatch.name}
                        </h2>
                        <p className="text-gray-600 mb-4">
                            Current End Date:{' '}
                            <strong>{new Date(selectedBatch.endDate).toLocaleDateString()}</strong>
                        </p>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const newDate = e.target.newEndDate.value;
                                handleExtendExpiry(newDate);
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    New End Date *
                                </label>
                                <input
                                    type="date"
                                    name="newEndDate"
                                    min={selectedBatch.endDate}
                                    className="mt-1 input-field"
                                    required
                                />
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowExtendModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Extend Expiry
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Statistics Modal */}
            {showStatsModal && selectedBatch && (
                <div className="modal-backdrop" onClick={() => setShowStatsModal(false)}>
                    <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">
                            Statistics: {selectedBatch.name}
                        </h2>
                        {batchStats ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <h4 className="text-sm font-medium text-blue-700">Students</h4>
                                        <p className="text-2xl font-bold text-blue-900">{batchStats.studentCount}</p>
                                    </div>
                                    <div className="bg-green-50 p-4 rounded-lg">
                                        <h4 className="text-sm font-medium text-green-700">Total Submissions</h4>
                                        <p className="text-2xl font-bold text-green-900">{batchStats.totalSubmissions || batchStats.submissionCount}</p>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-lg">
                                        <h4 className="text-sm font-medium text-purple-700">Problems Solved</h4>
                                        <p className="text-2xl font-bold text-purple-900">{batchStats.problemsSolvedCount || 0}</p>
                                    </div>
                                    <div className="bg-yellow-50 p-4 rounded-lg">
                                        <h4 className="text-sm font-medium text-yellow-700">Accepted Submissions</h4>
                                        <p className="text-2xl font-bold text-yellow-900">{batchStats.acceptedSubmissions || batchStats.acceptedCount}</p>
                                    </div>
                                </div>

                                {batchStats.topPerformers && batchStats.topPerformers.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2">Top Performers</h3>
                                        <div className="table-container">
                                            <table className="table min-w-full">
                                                <thead>
                                                    <tr>
                                                        <th className="py-2">Name</th>
                                                        <th className="py-2">Solved</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {batchStats.topPerformers.map((student, idx) => (
                                                        <tr key={idx} className="border-b">
                                                            <td className="py-2">{student.firstName} {student.lastName}</td>
                                                            <td className="py-2">{student.problemsSolved}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex justify-center py-8">
                                <div className="spinner"></div>
                            </div>
                        )}
                        <div className="flex justify-end mt-6">
                            <button
                                onClick={() => setShowStatsModal(false)}
                                className="btn-secondary"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BatchManager;
