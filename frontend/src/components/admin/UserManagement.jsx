import { useState, useEffect } from 'react';
import adminService from '../../services/adminService';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

const UserManagement = () => {
    const [viewMode, setViewMode] = useState('batch'); // 'batch' or 'admin'
    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState('');
    const [users, setUsers] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modals
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
    const [showAddAdminModal, setShowAddAdminModal] = useState(false);

    const [uploadMode, setUploadMode] = useState('single'); // 'single' or 'bulk'

    const [singleUserData, setSingleUserData] = useState({
        email: '',
        role: 'student',
    });

    const [adminFormData, setAdminFormData] = useState({
        email: '',
    });

    const [bulkUploadData, setBulkUploadData] = useState({
        file: null,
        role: 'student',
    });

    useEffect(() => {
        fetchBatches();
    }, []);

    useEffect(() => {
        if (viewMode === 'batch' && selectedBatch) {
            fetchBatchUsers();
        } else if (viewMode === 'admin') {
            fetchAdmins();
        }
    }, [selectedBatch, viewMode]);

    const fetchBatches = async () => {
        try {
            const data = await adminService.getAllBatches();
            setBatches(data.batches.filter((b) => b.status === 'active'));
        } catch (error) {
            toast.error('Failed to fetch batches');
        }
    };

    const fetchBatchUsers = async () => {
        setLoading(true);
        try {
            const data = await adminService.getBatchUsers(selectedBatch);
            setUsers(data.users);
        } catch (error) {
            toast.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const data = await adminService.getAllUsers({ role: 'admin' });
            setAdmins(data.users);
        } catch (error) {
            toast.error('Failed to fetch admins');
        } finally {
            setLoading(false);
        }
    };

    const handleAddSingleUser = async (e) => {
        e.preventDefault();
        try {
            const response = await adminService.addUserToBatch(selectedBatch, singleUserData);
            toast.success(response.message);
            toast(`Temp Password: ${response.user.tempPassword}`, { duration: 10000 });
            setShowAddUserModal(false);
            setSingleUserData({ email: '', role: 'student' });
            fetchBatchUsers();
        } catch (error) {
            toast.error(error.message || 'Failed to add user');
        }
    };

    const handleCreateAdmin = async (e) => {
        e.preventDefault();
        try {
            const response = await adminService.createAdminUser(adminFormData.email);
            toast.success(response.message);
            toast(`Temp Password: ${response.admin.tempPassword}`, { duration: 10000 });
            setShowAddAdminModal(false);
            setAdminFormData({ email: '' });
            fetchAdmins();
        } catch (error) {
            toast.error(error.message || 'Failed to create admin');
        }
    };

    const handleBulkUpload = async (e) => {
        e.preventDefault();
        if (!bulkUploadData.file) {
            toast.error('Please select a CSV file');
            return;
        }

        try {
            const response = await adminService.bulkAddUsersToBatch(
                selectedBatch,
                bulkUploadData.file,
                bulkUploadData.role
            );

            toast.success(response.message);

            if (response.created?.length > 0) {
                console.log('Created users:', response.created);
            }

            if (response.errors?.length > 0) {
                toast.error(`${response.errors.length} errors occurred. Check console.`);
                console.error('Upload errors:', response.errors);
            }

            setShowBulkUploadModal(false);
            setBulkUploadData({ file: null, role: 'student' });
            fetchBatchUsers();
        } catch (error) {
            toast.error(error.message || 'Bulk upload failed');
        }
    };

    const handleRemoveUser = async (userId, userName) => {
        if (!window.confirm(`Remove user "${userName}"? This will permanently delete their account and all data.`)) {
            return;
        }

        try {
            await adminService.removeUserFromBatch(selectedBatch, userId);
            toast.success('User removed successfully');
            fetchBatchUsers();
        } catch (error) {
            toast.error(error.message || 'Failed to remove user');
        }
    };

    const downloadSampleCSV = () => {
        const csv = 'email\nstudent1@example.com\nstudent2@example.com\nstudent3@example.com';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample_users.csv';
        a.click();
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">User Management</h1>

            {/* View Toggle */}
            <div className="flex space-x-4 mb-6 border-b border-gray-200 pb-4">
                <button
                    onClick={() => setViewMode('batch')}
                    className={`px-4 py-2 font-medium rounded-lg transition-colors ${viewMode === 'batch'
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                >
                    Batch Users
                </button>
                <button
                    onClick={() => setViewMode('admin')}
                    className={`px-4 py-2 font-medium rounded-lg transition-colors ${viewMode === 'admin'
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                >
                    System Admins
                </button>
            </div>

            {viewMode === 'batch' ? (
                <>
                    {/* Batch Selection */}
                    <div className="card mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Batch
                        </label>
                        <select
                            value={selectedBatch}
                            onChange={(e) => setSelectedBatch(e.target.value)}
                            className="input-field max-w-md"
                        >
                            <option value="">-- Select a Batch --</option>
                            {batches.map((batch) => (
                                <option key={batch._id} value={batch._id}>
                                    {batch.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedBatch && (
                        <>
                            {/* Action Buttons */}
                            <div className="flex space-x-4 mb-6">
                                <button
                                    onClick={() => {
                                        setUploadMode('single');
                                        setShowAddUserModal(true);
                                    }}
                                    className="btn-primary"
                                >
                                    + Add Single User
                                </button>
                                <button
                                    onClick={() => {
                                        setUploadMode('bulk');
                                        setShowBulkUploadModal(true);
                                    }}
                                    className="btn-secondary"
                                >
                                    📁 Bulk Upload (CSV)
                                </button>
                                <button onClick={downloadSampleCSV} className="btn-secondary">
                                    ⬇️ Download Sample CSV
                                </button>
                            </div>

                            {/* Users Table */}
                            <div className="card">
                                <h2 className="text-xl font-semibold mb-4">
                                    Users ({users.length})
                                </h2>
                                {loading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="spinner"></div>
                                    </div>
                                ) : users.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No users in this batch</p>
                                ) : (
                                    <div className="table-container">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Email</th>
                                                    <th>Name</th>
                                                    <th>Role</th>
                                                    <th>Status</th>
                                                    <th>Profile</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {users.map((user) => (
                                                    <tr key={user.id || user._id}>
                                                        <td>{user.email}</td>
                                                        <td>
                                                            {user.firstName && user.lastName
                                                                ? `${user.firstName} ${user.lastName}`
                                                                : <span className="text-gray-400">Not set</span>}
                                                        </td>
                                                        <td>
                                                            <span className="capitalize font-medium">{user.role}</span>
                                                        </td>
                                                        <td>
                                                            <span
                                                                className={`px-2 py-1 rounded text-xs ${user.isActive
                                                                    ? 'bg-green-100 text-green-700'
                                                                    : 'bg-red-100 text-red-700'
                                                                    }`}
                                                            >
                                                                {user.isActive ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {user.isFirstLogin ? (
                                                                <span className="text-yellow-600 text-sm">⚠️ First Login</span>
                                                            ) : user.profileCompleted ? (
                                                                <span className="text-green-600 text-sm">✅ Complete</span>
                                                            ) : (
                                                                <span className="text-gray-400 text-sm">Incomplete</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <button
                                                                onClick={() =>
                                                                    handleRemoveUser(
                                                                        user.id || user._id,
                                                                        user.firstName || user.email
                                                                    )
                                                                }
                                                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                                                            >
                                                                Remove
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            ) : (
                /* Admin Management View */
                <>
                    <div className="flex justify-end mb-6">
                        <button
                            onClick={() => setShowAddAdminModal(true)}
                            className="btn-primary"
                        >
                            + Create New Admin
                        </button>
                    </div>

                    <div className="card">
                        <h2 className="text-xl font-semibold mb-4">
                            System Administrators ({admins.length})
                        </h2>
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <div className="spinner"></div>
                            </div>
                        ) : admins.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No admins found</p>
                        ) : (
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Email</th>
                                            <th>Name</th>
                                            <th>Status</th>
                                            <th>Last Login</th>
                                            <th>Profile</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {admins.map((admin) => (
                                            <tr key={admin.id || admin._id}>
                                                <td>{admin.email}</td>
                                                <td>
                                                    {admin.firstName ? `${admin.firstName} ${admin.lastName}` : <span className="text-gray-400">Not set</span>}
                                                </td>
                                                <td>
                                                    <span className={`px-2 py-1 rounded text-xs ${admin.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {admin.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>
                                                    {admin.lastLogin ? new Date(admin.lastLogin).toLocaleDateString() : 'Never'}
                                                </td>
                                                <td>
                                                    {admin.isFirstLogin ? '⚠️ First Login' : '✅ Active'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Add Single User Modal */}
            {showAddUserModal && (
                <div className="modal-backdrop" onClick={() => setShowAddUserModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Add User to Batch</h2>
                        <form onSubmit={handleAddSingleUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Email *
                                </label>
                                <input
                                    type="email"
                                    value={singleUserData.email}
                                    onChange={(e) =>
                                        setSingleUserData({ ...singleUserData, email: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    placeholder="user@example.com"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Role *
                                </label>
                                <select
                                    value={singleUserData.role}
                                    onChange={(e) =>
                                        setSingleUserData({ ...singleUserData, role: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                >
                                    <option value="student">Student</option>
                                    <option value="instructor">Instructor</option>
                                </select>
                            </div>
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                                <p className="text-yellow-800">
                                    ℹ️ Temporary password will be generated for the user.
                                </p>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddUserModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Add User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Admin Modal */}
            {showAddAdminModal && (
                <div className="modal-backdrop" onClick={() => setShowAddAdminModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Create New Administrator</h2>
                        <form onSubmit={handleCreateAdmin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Admin Email *
                                </label>
                                <input
                                    type="email"
                                    value={adminFormData.email}
                                    onChange={(e) =>
                                        setAdminFormData({ ...adminFormData, email: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    placeholder="admin@example.com"
                                    required
                                />
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                                <p className="text-red-800">
                                    ⚠️ This user will have full access to the system.
                                </p>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowAddAdminModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Create Admin
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            {showBulkUploadModal && (
                <div className="modal-backdrop" onClick={() => setShowBulkUploadModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Bulk Upload Users (CSV)</h2>
                        <form onSubmit={handleBulkUpload} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Upload CSV File *
                                </label>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) =>
                                        setBulkUploadData({
                                            ...bulkUploadData,
                                            file: e.target.files[0],
                                        })
                                    }
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Role *
                                </label>
                                <select
                                    value={bulkUploadData.role}
                                    onChange={(e) =>
                                        setBulkUploadData({ ...bulkUploadData, role: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                >
                                    <option value="student">Student</option>
                                    <option value="instructor">Instructor</option>
                                </select>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                                <p className="text-blue-800 font-semibold mb-1">CSV Format:</p>
                                <pre className="bg-white p-2 rounded text-xs">email{'\n'}student1@example.com{'\n'}student2@example.com</pre>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowBulkUploadModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Upload Users
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
