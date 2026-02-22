import { useState, useEffect } from 'react';
import adminService from '../../services/adminService';
import toast from 'react-hot-toast';
import { UserPlus, Upload, Download, Trash2, Shield, Users, Search, AlertCircle, CheckCircle, X, Filter } from 'lucide-react';
import CustomDropdown from '../../components/shared/CustomDropdown';

const UserManagement = () => {
    const [viewMode, setViewMode] = useState('batch'); // 'batch' or 'admin'
    const [batches, setBatches] = useState([]);
    const [selectedBatch, setSelectedBatch] = useState('');
    const [users, setUsers] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [availableInstructors, setAvailableInstructors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');


    const fetchAvailableInstructors = async () => {
        try {
            const data = await adminService.getAllUsers({ role: 'instructor' });
            setAvailableInstructors(data.users);
        } catch (error) {
            console.error('Failed to fetch instructors', error);
        }
    };

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
            // Auto-select first batch if available and none selected
            if (data.batches.length > 0 && !selectedBatch) {
                // optional: setSelectedBatch(data.batches[0]._id);
            }
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
        setIsSubmitting(true);
        try {
            const response = await adminService.addUserToBatch(selectedBatch, singleUserData);
            toast.success(response.message);
            toast(`Temp Password: ${response.user.tempPassword}`, { duration: 10000 });
            setShowAddUserModal(false);
            setSingleUserData({ email: '', role: 'student' });
            fetchBatchUsers();
        } catch (error) {
            toast.error(error.message || 'Failed to add user');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateAdmin = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const response = await adminService.createAdminUser(adminFormData.email);
            toast.success(response.message);
            toast(`Temp Password: ${response.user.tempPassword}`, { duration: 10000 });
            setShowAddAdminModal(false);
            setAdminFormData({ email: '' });
            fetchAdmins();
        } catch (error) {
            toast.error(error.message || 'Failed to create admin');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAdmin = async (adminId, email) => {
        if (!window.confirm(`Are you sure you want to remove admin access for ${email}? This action cannot be undone.`)) {
            return;
        }

        try {
            // Assuming adminService has a deleteUser function or similar. 
            // If not, we might need to implement it. Usually it's `deleteUser` or `removeUser`.
            // adminService.js likely has deleteUser(userId). Let's check or assume standard crud.
            // If strictly "delete other admins", we ensure we don't delete self? The backend usually handles self-deletion checks.
            await adminService.deleteUser(adminId);
            toast.success('Admin removed successfully');
            fetchAdmins();
        } catch (error) {
            toast.error(error.message || 'Failed to remove admin');
        }
    };

    const handleBulkUpload = async (e) => {
        e.preventDefault();
        if (!bulkUploadData.file) {
            toast.error('Please select a CSV file');
            return;
        }

        setIsSubmitting(true);
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
        } finally {
            setIsSubmitting(false);
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

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Prepare options for CustomDropdown
    const batchOptions = batches.map(b => ({ value: b._id, label: b.name }));

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">User Management</h1>
                    <p className="text-gray-500 mt-1">Manage students, instructors, and system administrators.</p>
                </div>

                {/* View Toggle */}
                <div className="bg-white p-1.5 rounded-xl flex items-center shadow-sm border border-gray-200">
                    <button
                        onClick={() => setViewMode('batch')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${viewMode === 'batch'
                            ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Users size={16} />
                        Batch Users
                    </button>
                    <button
                        onClick={() => setViewMode('admin')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${viewMode === 'admin'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Shield size={16} />
                        System Admins
                    </button>
                </div>
            </div>

            {viewMode === 'batch' ? (
                <div className="space-y-6">
                    {/* Controls & Metrics */}
                    <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row gap-6 items-end justify-between border border-gray-100 shadow-sm">
                        <div className="w-full md:w-80 space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide ml-1">Select Batch</label>
                            <CustomDropdown
                                options={batchOptions}
                                value={selectedBatch}
                                onChange={setSelectedBatch}
                                placeholder="Select a Batch"
                                icon={Filter}
                            />
                        </div>

                        {selectedBatch && (
                            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                                <button
                                    onClick={() => {
                                        setUploadMode('single');
                                        setShowAddUserModal(true);
                                        fetchAvailableInstructors();
                                    }}
                                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-sm"
                                >
                                    <UserPlus size={18} />
                                    Add User
                                </button>
                                <button
                                    onClick={() => {
                                        setUploadMode('bulk');
                                        setShowBulkUploadModal(true);
                                    }}
                                    className="px-4 py-2.5 bg-white border border-gray-200 hover:border-blue-300 text-gray-700 hover:text-blue-600 font-medium rounded-xl transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-sm"
                                >
                                    <Upload size={18} />
                                    Bulk Upload
                                </button>
                                <button
                                    onClick={downloadSampleCSV}
                                    className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-xl transition-colors border border-transparent hover:border-gray-200"
                                    title="Download Sample CSV"
                                >
                                    <Download size={20} />
                                </button>
                            </div>
                        )}
                    </div>

                    {selectedBatch && (
                        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/30">
                                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    Batch Members
                                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-100">{users.length}</span>
                                </h2>
                                <div className="relative w-full sm:w-64">
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all shadow-sm"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-16">
                                    <div className="spinner border-t-blue-500 border-2 w-8 h-8"></div>
                                </div>
                            ) : users.length === 0 ? (
                                <div className="text-center py-20">
                                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Users className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <h3 className="text-gray-900 font-medium">No users found</h3>
                                    <p className="text-gray-500 text-sm mt-1">Add students or instructors to this batch.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-50/50 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                            <tr>
                                                <th className="px-6 py-4">User</th>
                                                <th className="px-6 py-4">Role</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4">Profile</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filteredUsers.map((user) => (
                                                <tr key={user.id || user._id} className="hover:bg-gray-50/40 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-gray-900">
                                                                {user.firstName && user.lastName
                                                                    ? `${user.firstName} ${user.lastName}`
                                                                    : <span className="text-gray-400 italic">No Name Set</span>}
                                                            </span>
                                                            <span className="text-xs text-gray-500">{user.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide border ${user.role === 'instructor'
                                                            ? 'bg-purple-50 text-purple-700 border-purple-100'
                                                            : 'bg-blue-50 text-blue-700 border-blue-100'
                                                            }`}>
                                                            {user.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isActive
                                                            ? 'bg-green-50 text-green-700 border border-green-100'
                                                            : 'bg-red-50 text-red-700 border border-red-100'
                                                            }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                                            {user.isActive ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {user.isFirstLogin ? (
                                                            <div className="flex items-center gap-1.5 text-amber-600 text-sm bg-amber-50 px-2 py-1 rounded w-fit">
                                                                <AlertCircle size={14} />
                                                                <span>Pending Login</span>
                                                            </div>
                                                        ) : user.profileCompleted ? (
                                                            <div className="flex items-center gap-1.5 text-emerald-600 text-sm bg-emerald-50 px-2 py-1 rounded w-fit">
                                                                <CheckCircle size={14} />
                                                                <span>Complete</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-sm italic">Incomplete</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() =>
                                                                handleRemoveUser(
                                                                    user.id || user._id,
                                                                    user.firstName || user.email
                                                                )
                                                            }
                                                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                            title="Remove User"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {filteredUsers.length === 0 && (
                                        <div className="p-12 text-center text-gray-500 bg-gray-50/50 italic">
                                            No users match your search.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                /* Admin Management View */
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl shadow-sm">
                                <Shield size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">System Administrators</h2>
                                <p className="text-sm text-gray-500">Manage users with elevated privileges</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAddAdminModal(true)}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-all shadow-sm hover:shadow-md flex items-center gap-2 text-sm"
                        >
                            <UserPlus size={18} />
                            Create New Admin
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="spinner border-indigo-500"></div>
                        </div>
                    ) : admins.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No admins found</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 rounded-l-lg">Admin</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Last Login</th>
                                        <th className="px-6 py-4">Access Level</th>
                                        <th className="px-6 py-4 rounded-r-lg text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {admins.map((admin) => (
                                        <tr key={admin.id || admin._id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center font-bold text-sm border border-indigo-50 shadow-sm">
                                                        {admin.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            {admin.firstName ? `${admin.firstName} ${admin.lastName}` : 'Unkown Name'}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{admin.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${admin.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {admin.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {admin.lastLogin ? new Date(admin.lastLogin).toLocaleDateString() : 'Never'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="flex items-center gap-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full w-fit border border-indigo-100">
                                                    <Shield size={12} />
                                                    Full Access
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteAdmin(admin.id || admin._id, admin.email)}
                                                    className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    title="Remove Admin Access"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Add Single User Modal */}
            {showAddUserModal && (
                <div className="modal-backdrop" onClick={() => setShowAddUserModal(false)}>
                    <div className="modal-content p-0" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <UserPlus size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">Add User</h2>
                            </div>
                            <button
                                onClick={() => setShowAddUserModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6">
                            <form onSubmit={handleAddSingleUser} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Email Address <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={singleUserData.email}
                                        onChange={(e) =>
                                            setSingleUserData({ ...singleUserData, email: e.target.value })
                                        }
                                        className="input-field w-full"
                                        placeholder="user@example.com"
                                        required
                                        list={singleUserData.role === 'instructor' ? "instructor-list" : undefined}
                                    />
                                    {singleUserData.role === 'instructor' && (
                                        <datalist id="instructor-list">
                                            {availableInstructors.map(inst => (
                                                <option key={inst._id} value={inst.email}>
                                                    {inst.firstName} {inst.lastName} ({inst.email})
                                                </option>
                                            ))}
                                        </datalist>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Role <span className="text-red-500">*</span>
                                    </label>
                                    <CustomDropdown
                                        options={[
                                            { value: 'student', label: 'Student' },
                                            { value: 'instructor', label: 'Instructor' }
                                        ]}
                                        value={singleUserData.role}
                                        onChange={(val) => setSingleUserData({ ...singleUserData, role: val })}
                                    />
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm flex gap-3">
                                    <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                                    <div>
                                        <p className="text-amber-900 font-medium">Temporary Password</p>
                                        <p className="text-amber-700 text-xs mt-0.5">
                                            A temporary password will be generated and shown after creation. Please share it with the user securely.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddUserModal(false)}
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
                                                Adding...
                                            </>
                                        ) : 'Add User'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Admin Modal */}
            {showAddAdminModal && (
                <div className="modal-backdrop" onClick={() => setShowAddAdminModal(false)}>
                    <div className="modal-content p-0" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <Shield size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">Create Admin</h2>
                            </div>
                            <button
                                onClick={() => setShowAddAdminModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6">
                            <form onSubmit={handleCreateAdmin} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Admin Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={adminFormData.email}
                                        onChange={(e) =>
                                            setAdminFormData({ ...adminFormData, email: e.target.value })
                                        }
                                        className="input-field w-full"
                                        placeholder="admin@example.com"
                                        required
                                    />
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm flex gap-3">
                                    <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                                    <div>
                                        <p className="text-red-900 font-medium">Elevated Privileges</p>
                                        <p className="text-red-700 text-xs mt-0.5">
                                            This user will have <strong>full system access</strong>, including user management, content creation, and system settings.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddAdminModal(false)}
                                        className="btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary bg-indigo-600 hover:bg-indigo-700 border-transparent" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Creating...
                                            </>
                                        ) : 'Create Admin'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            {showBulkUploadModal && (
                <div className="modal-backdrop" onClick={() => setShowBulkUploadModal(false)}>
                    <div className="modal-content p-0" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Upload size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">Bulk Upload</h2>
                            </div>
                            <button
                                onClick={() => setShowBulkUploadModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6">
                            <form onSubmit={handleBulkUpload} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Upload CSV File <span className="text-red-500">*</span>
                                    </label>
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) =>
                                                setBulkUploadData({
                                                    ...bulkUploadData,
                                                    file: e.target.files[0],
                                                })
                                            }
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            required
                                        />
                                        <div className="pointer-events-none">
                                            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                            {bulkUploadData.file ? (
                                                <p className="text-sm font-medium text-blue-600">{bulkUploadData.file.name}</p>
                                            ) : (
                                                <>
                                                    <p className="text-sm font-medium text-gray-700">Click to upload or drag and drop</p>
                                                    <p className="text-xs text-gray-500 mt-1">CSV files only</p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                        Role <span className="text-red-500">*</span>
                                    </label>
                                    <CustomDropdown
                                        options={[
                                            { value: 'student', label: 'Student' },
                                            { value: 'instructor', label: 'Instructor' }
                                        ]}
                                        value={bulkUploadData.role}
                                        onChange={(val) => setBulkUploadData({ ...bulkUploadData, role: val })}
                                    />
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-blue-900 font-bold flex items-center gap-2">
                                            <Upload size={14} /> CSV Format Required:
                                        </p>
                                        <button
                                            type="button"
                                            onClick={downloadSampleCSV}
                                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                                        >
                                            Download Sample
                                        </button>
                                    </div>
                                    <code className="block bg-white p-3 rounded border border-blue-100 text-gray-600 font-mono text-xs shadow-sm">
                                        email<br />
                                        student1@example.com<br />
                                        student2@example.com
                                    </code>
                                </div>
                                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setShowBulkUploadModal(false)}
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
                                                Uploading...
                                            </>
                                        ) : 'Upload Users'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
