import { useState, useEffect, useMemo } from 'react';
import profileService from '../../services/profileService';
import adminService from '../../services/adminService';
import toast from 'react-hot-toast';
import CustomDropdown from '../shared/CustomDropdown';

const ProfileReset = () => {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [batches, setBatches] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingStudents, setFetchingStudents] = useState(true);

    useEffect(() => {
        fetchAllStudents();
        fetchBatches();
    }, []);

    const fetchBatches = async () => {
        try {
            const data = await adminService.getAllBatches();
            setBatches(data.batches || []);
            if (data.batches?.length === 1) {
                setSelectedBatchId(data.batches[0]._id);
            }
        } catch (error) {
            console.error('Failed to fetch batches', error);
        }
    };

    const fetchAllStudents = async () => {
        setFetchingStudents(true);
        try {
            const data = await profileService.getAllStudents();
            setStudents(data.students || []);
        } catch (error) {
            toast.error('Failed to fetch students');
        } finally {
            setFetchingStudents(false);
        }
    };

    // CLIENT-SIDE SEARCH with useMemo
    const filteredStudents = useMemo(() => {
        let result = students;

        // Filter by batch
        if (selectedBatchId) {
            result = result.filter(s => s.batchId === selectedBatchId);
        }

        if (!searchQuery.trim()) {
            return result;
        }

        const searchLower = searchQuery.toLowerCase().trim();

        return result.filter((student) => {
            const email = (student.email || '').toLowerCase();
            const firstName = (student.firstName || '').toLowerCase();
            const lastName = (student.lastName || '').toLowerCase();
            const fullName = `${firstName} ${lastName}`.trim();
            const rollNumber = (student.rollNumber || '').toLowerCase();
            const branch = (student.branch || '').toLowerCase();

            return (
                email.includes(searchLower) ||
                firstName.includes(searchLower) ||
                lastName.includes(searchLower) ||
                fullName.includes(searchLower) ||
                rollNumber.includes(searchLower) ||
                branch.includes(searchLower)
            );
        });
    }, [students, searchQuery, selectedBatchId]);

    const handleSelectStudent = (student) => {
        setSelectedStudent(student);
    };

    const handleResetProfile = async () => {
        if (!selectedStudent) {
            toast.error('Please select a student');
            return;
        }

        const studentName = `${selectedStudent.firstName || ''} ${selectedStudent.lastName || ''}`.trim() || 'Student';

        const confirmText = window.prompt(
            `⚠️ CRITICAL ACTION: Reset AlphaKnowledge Practice Data for ${studentName}\n\n` +
            `Email: ${selectedStudent.email}\n` +
            `Roll Number: ${selectedStudent.rollNumber}\n` +
            `Branch: ${selectedStudent.branch}\n\n` +
            'This will PERMANENTLY DELETE:\n' +
            '✗ All AlphaKnowledge practice submissions\n' +
            '✗ Practice progress & statistics\n' +
            '✗ AlphaKnowledge coins & achievements\n\n' +
            'PRESERVED (Student will keep):\n' +
            '✓ Contest submissions & records\n' +
            '✓ Contest leaderboard rankings\n' +
            '✓ External profiles (LeetCode, CodeChef, etc.)\n' +
            '✓ Personal information\n' +
            '✓ Education details\n' +
            '✓ Batch assignment\n' +
            '✓ Account access\n\n' +
            'Type "RESET" to confirm:'
        );

        if (confirmText !== 'RESET') {
            toast.error('Reset cancelled');
            return;
        }

        setLoading(true);
        try {
            const result = await profileService.resetStudentProfile(selectedStudent.id);
            toast.success(result.message);
            toast('Student has been notified via email');
            setSelectedStudent(null);
            setSearchQuery('');
            fetchAllStudents();
        } catch (error) {
            toast.error(error.message || 'Failed to reset profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6">
            <div className="max-w-6xl mx-auto">
                {/* Warning Banner */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                    <h2 className="text-2xl font-bold text-red-800 mb-2">
                        ⚠️ Reset AlphaKnowledge Practice Data
                    </h2>
                    <p className="text-red-700">
                        This action resets only the student's <strong>AlphaKnowledge practice submissions and scores</strong>.
                        Contest records, external profiles, and batch assignment will be preserved.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Student Selection */}
                    <div className="card">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Select Student
                        </h3>

                        {/* Batch Filter */}
                        {batches.length > 0 && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Filter by Batch
                                </label>
                                <CustomDropdown
                                    options={[
                                        { value: '', label: 'All Batches' },
                                        ...batches.map(batch => ({ value: batch._id, label: batch.name }))
                                    ]}
                                    value={selectedBatchId}
                                    onChange={(val) => {
                                        setSelectedBatchId(val);
                                        setSelectedStudent(null);
                                    }}
                                    placeholder="All Batches"
                                />
                            </div>
                        )}

                        {/* Search Bar */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Search by Email, Name, Roll Number, or Branch
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="input-field pl-10"
                                    placeholder="Type to search..."
                                />
                                <svg
                                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path
                                                fillRule="evenodd"
                                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Showing {filteredStudents.length} of {students.length} students
                            </p>
                        </div>

                        {/* Student List */}
                        {fetchingStudents ? (
                            <div className="text-center py-12">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2"></div>
                                <p className="text-gray-500 text-sm">Loading students...</p>
                            </div>
                        ) : filteredStudents.length === 0 ? (
                            <div className="text-center py-12">
                                <svg
                                    className="mx-auto h-12 w-12 text-gray-400 mb-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                                <p className="text-gray-500 text-sm">
                                    {searchQuery ? 'No students match your search' : 'No students found'}
                                </p>
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="mt-3 text-sm text-primary-600 hover:text-primary-700"
                                    >
                                        Clear search
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
                                {filteredStudents.map((student) => (
                                    <div
                                        key={student.id}
                                        onClick={() => handleSelectStudent(student)}
                                        className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedStudent?.id === student.id
                                            ? 'border-primary-600 bg-primary-50 shadow-md'
                                            : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 truncate">
                                                    {student.firstName} {student.lastName}
                                                </p>
                                                <p className="text-sm text-gray-600 truncate">{student.email}</p>
                                                <div className="flex gap-2 mt-2 flex-wrap">
                                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                        {student.rollNumber}
                                                    </span>
                                                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                                                        {student.branch}
                                                    </span>
                                                    {student.isActive && (
                                                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                                            Active
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {selectedStudent?.id === student.id && (
                                                <div className="ml-3 flex-shrink-0 text-primary-600">
                                                    <svg
                                                        className="w-6 h-6"
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path
                                                            fillRule="evenodd"
                                                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                            clipRule="evenodd"
                                                        />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Selected Student Details & Reset */}
                    <div className="space-y-6">
                        {selectedStudent ? (
                            <>
                                {/* Student Details */}
                                <div className="card bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-primary-200">
                                    <div className="flex items-start justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Selected Student
                                        </h3>
                                        <button
                                            onClick={() => setSelectedStudent(null)}
                                            className="text-gray-400 hover:text-gray-600"
                                            title="Deselect"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path
                                                    fillRule="evenodd"
                                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">
                                                Full Name
                                            </p>
                                            <p className="text-lg font-semibold text-gray-900 mt-1">
                                                {selectedStudent.firstName} {selectedStudent.lastName}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">
                                                Email
                                            </p>
                                            <p className="font-medium text-gray-900 mt-1">
                                                {selectedStudent.email}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">
                                                    Roll Number
                                                </p>
                                                <p className="font-semibold text-gray-900 mt-1">
                                                    {selectedStudent.rollNumber}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">
                                                    Branch
                                                </p>
                                                <p className="font-semibold text-gray-900 mt-1">
                                                    {selectedStudent.branch}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-600 uppercase tracking-wide font-medium">
                                                Status
                                            </p>
                                            <span
                                                className={`inline-block mt-1 px-3 py-1 text-sm font-semibold rounded-full ${selectedStudent.isActive
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {selectedStudent.isActive ? '✓ Active' : '✗ Inactive'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Reset Info */}
                                <div className="card">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                        Reset Information
                                    </h3>
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                        <p className="text-yellow-800 font-semibold mb-3 flex items-center">
                                            <svg
                                                className="w-5 h-5 mr-2"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            What will be deleted:
                                        </p>
                                        <ul className="list-disc list-inside text-yellow-700 space-y-1 text-sm ml-7">
                                            <li>All AlphaKnowledge practice submissions</li>
                                            <li>Practice progress statistics</li>
                                            <li>AlphaKnowledge coins & achievements</li>
                                        </ul>
                                        <p className="text-yellow-800 font-semibold mt-4 mb-3 flex items-center">
                                            <svg
                                                className="w-5 h-5 mr-2"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fillRule="evenodd"
                                                    d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                    clipRule="evenodd"
                                                />
                                            </svg>
                                            What will be preserved:
                                        </p>
                                        <ul className="list-disc list-inside text-yellow-700 space-y-1 text-sm ml-7">
                                            <li><strong>Contest submissions & records</strong></li>
                                            <li><strong>Contest leaderboard rankings</strong></li>
                                            <li>Personal information (name, email, phone)</li>
                                            <li>Education details</li>
                                            <li>External profiles (LeetCode, CodeChef, etc.)</li>
                                            <li>Batch assignment</li>
                                            <li>Account access credentials</li>
                                        </ul>
                                    </div>

                                    <button
                                        onClick={handleResetProfile}
                                        disabled={loading}
                                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex justify-center items-center"
                                    >
                                        {loading ? (
                                            <>
                                                <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                                Resetting Practice Data...
                                            </>
                                        ) : (
                                            <>
                                                <svg
                                                    className="w-5 h-5 mr-2"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                                    />
                                                </svg>
                                                Reset AlphaKnowledge Practice Data
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="card">
                                <div className="text-center py-16">
                                    <svg
                                        className="mx-auto h-16 w-16 text-gray-400 mb-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                        />
                                    </svg>
                                    <p className="text-gray-500 text-lg font-medium mb-2">
                                        Select a student
                                    </p>
                                    <p className="text-gray-400 text-sm">
                                        Choose a student from the list to reset their practice data
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileReset;
