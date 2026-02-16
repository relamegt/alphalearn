import { useState, useEffect } from 'react';
import problemService from '../../services/problemService';
import toast from 'react-hot-toast';

const SECTIONS = [
    'Introduction',
    'Arrays',
    'Strings',
    'Math',
    'Sorting',
    'Searching',
    'Recursion',
    'Backtracking',
    'Dynamic Programming',
    'Graphs',
    'Trees',
    'Heaps',
    'Advanced Topics',
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const POINTS = {
    Easy: 20,
    Medium: 50,
    Hard: 100,
};

const ProblemManager = () => {
    const [problems, setProblems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ section: '', difficulty: '' });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProblem, setEditingProblem] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        section: 'Arrays',
        difficulty: 'Easy',
        points: 20,
        description: '',
        constraints: [],
        examples: [{ input: '', output: '', explanation: '' }],
        testCases: [{ input: '', output: '', isHidden: false }],
        timeLimit: 2000,
        editorial: {
            approach: '',
            solution: '',
            complexity: '',
        },
    });

    const [bulkFile, setBulkFile] = useState(null);

    useEffect(() => {
        fetchProblems();
    }, [filters]);

    const fetchProblems = async () => {
        setLoading(true);
        try {
            const data = await problemService.getAllProblems(filters);
            setProblems(data.problems);
        } catch (error) {
            toast.error(error.message || 'Failed to fetch problems');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProblem = async (e) => {
        e.preventDefault();
        try {
            await problemService.createProblem(formData);
            toast.success('Problem created successfully');
            setShowCreateModal(false);
            resetForm();
            fetchProblems();
        } catch (error) {
            toast.error(error.message || 'Failed to create problem');
        }
    };

    const handleBulkUpload = async (e) => {
        e.preventDefault();
        if (!bulkFile) {
            toast.error('Please select a JSON file');
            return;
        }

        try {
            const response = await problemService.bulkCreateProblems(bulkFile);
            toast.success(response.message);
            setShowBulkModal(false);
            setBulkFile(null);
            fetchProblems();
        } catch (error) {
            toast.error(error.message || 'Bulk upload failed');
        }
    };

    const handleUpdateProblem = async (e) => {
        e.preventDefault();
        try {
            await problemService.updateProblem(editingProblem.id, formData);
            toast.success('Problem updated successfully');
            setShowEditModal(false);
            setEditingProblem(null);
            resetForm();
            fetchProblems();
        } catch (error) {
            toast.error(error.message || 'Failed to update problem');
        }
    };

    const handleDeleteProblem = async (problemId, problemTitle) => {
        if (
            !window.confirm(
                `Delete problem "${problemTitle}"?\n\nThis will also delete all related submissions. This action cannot be undone.`
            )
        ) {
            return;
        }

        try {
            await problemService.deleteProblem(problemId);
            toast.success('Problem deleted successfully');
            fetchProblems();
        } catch (error) {
            toast.error(error.message || 'Failed to delete problem');
        }
    };

    const openEditModal = async (problem) => {
        try {
            const data = await problemService.getProblemById(problem.id);
            setEditingProblem(problem);
            setFormData({
                title: data.problem.title,
                section: data.problem.section,
                difficulty: data.problem.difficulty,
                points: data.problem.points,
                description: data.problem.description,
                constraints: data.problem.constraints || [],
                examples: data.problem.examples || [{ input: '', output: '', explanation: '' }],
                testCases: data.problem.testCases || [{ input: '', output: '', isHidden: false }],
                timeLimit: data.problem.timeLimit || 2000,
                editorial: data.problem.editorial || { approach: '', solution: '', complexity: '' },
            });
            setShowEditModal(true);
        } catch (error) {
            toast.error('Failed to load problem details');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            section: 'Arrays',
            difficulty: 'Easy',
            points: 20,
            description: '',
            constraints: [],
            examples: [{ input: '', output: '', explanation: '' }],
            testCases: [{ input: '', output: '', isHidden: false }],
            timeLimit: 2000,
            editorial: { approach: '', solution: '', complexity: '' },
        });
    };

    const addExample = () => {
        setFormData({
            ...formData,
            examples: [...formData.examples, { input: '', output: '', explanation: '' }],
        });
    };

    const addTestCase = () => {
        setFormData({
            ...formData,
            testCases: [...formData.testCases, { input: '', output: '', isHidden: false }],
        });
    };

    const downloadSampleJSON = () => {
        const sample = [
            {
                title: 'Two Sum',
                section: 'Arrays',
                difficulty: 'Easy',
                description: 'Given an array of integers...',
                constraints: ['1 <= nums.length <= 10^4'],
                examples: [
                    {
                        input: '[2,7,11,15], 9',
                        output: '[0,1]',
                        explanation: 'nums[0] + nums[1] = 9',
                    },
                ],
                testCases: [
                    { input: '[2,7,11,15]\n9', output: '[0,1]', isHidden: false },
                    { input: '[3,2,4]\n6', output: '[1,2]', isHidden: true },
                ],
                timeLimit: 2000,
                editorial: {
                    approach: 'Use hash map',
                    solution: 'def twoSum(nums, target): ...',
                    complexity: 'O(n)',
                },
            },
        ];

        const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample_problems.json';
        a.click();
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Problem Management</h1>
                <div className="flex space-x-3">
                    <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                        + Create Problem
                    </button>
                    <button onClick={() => setShowBulkModal(true)} className="btn-secondary">
                        📁 Bulk Upload (JSON)
                    </button>
                    <button onClick={downloadSampleJSON} className="btn-secondary">
                        ⬇️ Sample JSON
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                        <select
                            value={filters.section}
                            onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                            className="input-field"
                        >
                            <option value="">All Sections</option>
                            {SECTIONS.map((section) => (
                                <option key={section} value={section}>
                                    {section}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                        <select
                            value={filters.difficulty}
                            onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                            className="input-field"
                        >
                            <option value="">All Difficulties</option>
                            {DIFFICULTIES.map((diff) => (
                                <option key={diff} value={diff}>
                                    {diff}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => setFilters({ section: '', difficulty: '' })}
                            className="btn-secondary w-full"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Problems Table */}
            <div className="card">
                <h2 className="text-xl font-semibold mb-4">Problems ({problems.length})</h2>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="spinner"></div>
                    </div>
                ) : problems.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No problems found</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Section</th>
                                    <th>Difficulty</th>
                                    <th>Points</th>
                                    <th>Created At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {problems.map((problem) => (
                                    <tr key={problem.id}>
                                        <td className="font-semibold">{problem.title}</td>
                                        <td>{problem.section}</td>
                                        <td>
                                            <span className={`badge-${problem.difficulty.toLowerCase()}`}>
                                                {problem.difficulty}
                                            </span>
                                        </td>
                                        <td>{problem.points}</td>
                                        <td>{new Date(problem.createdAt).toLocaleDateString()}</td>
                                        <td className="space-x-2">
                                            <button
                                                onClick={() => openEditModal(problem)}
                                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteProblem(problem.id, problem.title)}
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
                )}
            </div>

            {/* Create Problem Modal */}
            {showCreateModal && (
                <div className="modal-backdrop overflow-y-auto" onClick={() => setShowCreateModal(false)}>
                    <div
                        className="modal-content max-w-4xl my-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-2xl font-bold mb-4">Create New Problem</h2>
                        <form onSubmit={handleCreateProblem} className="space-y-4 max-h-[70vh] overflow-y-auto px-2">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Title *</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="mt-1 input-field"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Section *</label>
                                    <select
                                        value={formData.section}
                                        onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                                        className="mt-1 input-field"
                                    >
                                        {SECTIONS.map((section) => (
                                            <option key={section} value={section}>
                                                {section}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Difficulty *</label>
                                    <select
                                        value={formData.difficulty}
                                        onChange={(e) => {
                                            const diff = e.target.value;
                                            setFormData({
                                                ...formData,
                                                difficulty: diff,
                                                points: POINTS[diff],
                                            });
                                        }}
                                        className="mt-1 input-field"
                                    >
                                        {DIFFICULTIES.map((diff) => (
                                            <option key={diff} value={diff}>
                                                {diff}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Points</label>
                                    <input
                                        type="number"
                                        value={formData.points}
                                        readOnly
                                        className="mt-1 input-field bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Time Limit (ms)</label>
                                    <input
                                        type="number"
                                        value={formData.timeLimit}
                                        onChange={(e) =>
                                            setFormData({ ...formData, timeLimit: parseInt(e.target.value) })
                                        }
                                        className="mt-1 input-field"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description *</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="mt-1 input-field"
                                    rows="4"
                                    placeholder="Problem description in markdown"
                                    required
                                />
                            </div>

                            {/* Constraints */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Constraints (comma-separated)
                                </label>
                                <textarea
                                    value={formData.constraints.join(', ')}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            constraints: e.target.value.split(',').map((c) => c.trim()),
                                        })
                                    }
                                    className="input-field"
                                    rows="2"
                                    placeholder="1 <= n <= 10^4, 0 <= nums[i] <= 100"
                                />
                            </div>

                            {/* Examples */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Examples</label>
                                    <button type="button" onClick={addExample} className="text-sm text-blue-600">
                                        + Add Example
                                    </button>
                                </div>
                                {formData.examples.map((example, idx) => (
                                    <div key={idx} className="border rounded p-3 mb-2 space-y-2">
                                        <input
                                            type="text"
                                            placeholder="Input"
                                            value={example.input}
                                            onChange={(e) => {
                                                const updated = [...formData.examples];
                                                updated[idx].input = e.target.value;
                                                setFormData({ ...formData, examples: updated });
                                            }}
                                            className="input-field"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Output"
                                            value={example.output}
                                            onChange={(e) => {
                                                const updated = [...formData.examples];
                                                updated[idx].output = e.target.value;
                                                setFormData({ ...formData, examples: updated });
                                            }}
                                            className="input-field"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Explanation (optional)"
                                            value={example.explanation}
                                            onChange={(e) => {
                                                const updated = [...formData.examples];
                                                updated[idx].explanation = e.target.value;
                                                setFormData({ ...formData, examples: updated });
                                            }}
                                            className="input-field"
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Test Cases */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Test Cases</label>
                                    <button type="button" onClick={addTestCase} className="text-sm text-blue-600">
                                        + Add Test Case
                                    </button>
                                </div>
                                {formData.testCases.map((tc, idx) => (
                                    <div key={idx} className="border rounded p-3 mb-2 space-y-2">
                                        <textarea
                                            placeholder="Input"
                                            value={tc.input}
                                            onChange={(e) => {
                                                const updated = [...formData.testCases];
                                                updated[idx].input = e.target.value;
                                                setFormData({ ...formData, testCases: updated });
                                            }}
                                            className="input-field"
                                            rows="2"
                                        />
                                        <textarea
                                            placeholder="Expected Output"
                                            value={tc.output}
                                            onChange={(e) => {
                                                const updated = [...formData.testCases];
                                                updated[idx].output = e.target.value;
                                                setFormData({ ...formData, testCases: updated });
                                            }}
                                            className="input-field"
                                            rows="2"
                                        />
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={tc.isHidden}
                                                onChange={(e) => {
                                                    const updated = [...formData.testCases];
                                                    updated[idx].isHidden = e.target.checked;
                                                    setFormData({ ...formData, testCases: updated });
                                                }}
                                                className="mr-2"
                                            />
                                            <span className="text-sm text-gray-700">Hidden Test Case</span>
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end space-x-3 mt-6 sticky bottom-0 bg-white pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        resetForm();
                                    }}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Create Problem
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            {showBulkModal && (
                <div className="modal-backdrop" onClick={() => setShowBulkModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Bulk Upload Problems (JSON)</h2>
                        <form onSubmit={handleBulkUpload} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Upload JSON File *
                                </label>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={(e) => setBulkFile(e.target.files[0])}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                    required
                                />
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
                                <p className="text-blue-800 font-semibold mb-1">JSON must be an array of problems</p>
                                <p className="text-blue-700 text-xs">Download sample JSON for correct format</p>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowBulkModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Upload Problems
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal - Similar structure to Create Modal */}
            {showEditModal && editingProblem && (
                <div className="modal-backdrop overflow-y-auto" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content max-w-4xl my-8" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Edit Problem: {editingProblem.title}</h2>
                        <form onSubmit={handleUpdateProblem} className="space-y-4 max-h-[70vh] overflow-y-auto px-2">
                            {/* Same form fields as Create Modal */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Title *</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="mt-1 input-field"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Section *</label>
                                    <select
                                        value={formData.section}
                                        onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                                        className="mt-1 input-field"
                                    >
                                        {SECTIONS.map((section) => (
                                            <option key={section} value={section}>
                                                {section}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Difficulty *</label>
                                    <select
                                        value={formData.difficulty}
                                        onChange={(e) => {
                                            const diff = e.target.value;
                                            setFormData({
                                                ...formData,
                                                difficulty: diff,
                                                points: POINTS[diff],
                                            });
                                        }}
                                        className="mt-1 input-field"
                                    >
                                        {DIFFICULTIES.map((diff) => (
                                            <option key={diff} value={diff}>
                                                {diff}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Points</label>
                                    <input
                                        type="number"
                                        value={formData.points}
                                        readOnly
                                        className="mt-1 input-field bg-gray-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Time Limit (ms)</label>
                                    <input
                                        type="number"
                                        value={formData.timeLimit}
                                        onChange={(e) =>
                                            setFormData({ ...formData, timeLimit: parseInt(e.target.value) })
                                        }
                                        className="mt-1 input-field"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Description *</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="mt-1 input-field"
                                    rows="4"
                                    placeholder="Problem description in markdown"
                                    required
                                />
                            </div>

                            {/* Constraints */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Constraints (comma-separated)
                                </label>
                                <textarea
                                    value={formData.constraints.join(', ')}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            constraints: e.target.value.split(',').map((c) => c.trim()),
                                        })
                                    }
                                    className="input-field"
                                    rows="2"
                                    placeholder="1 <= n <= 10^4, 0 <= nums[i] <= 100"
                                />
                            </div>

                            {/* Examples */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Examples</label>
                                    <button type="button" onClick={addExample} className="text-sm text-blue-600">
                                        + Add Example
                                    </button>
                                </div>
                                {formData.examples.map((example, idx) => (
                                    <div key={idx} className="border rounded p-3 mb-2 space-y-2">
                                        <input
                                            type="text"
                                            placeholder="Input"
                                            value={example.input}
                                            onChange={(e) => {
                                                const updated = [...formData.examples];
                                                updated[idx].input = e.target.value;
                                                setFormData({ ...formData, examples: updated });
                                            }}
                                            className="input-field"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Output"
                                            value={example.output}
                                            onChange={(e) => {
                                                const updated = [...formData.examples];
                                                updated[idx].output = e.target.value;
                                                setFormData({ ...formData, examples: updated });
                                            }}
                                            className="input-field"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Explanation (optional)"
                                            value={example.explanation}
                                            onChange={(e) => {
                                                const updated = [...formData.examples];
                                                updated[idx].explanation = e.target.value;
                                                setFormData({ ...formData, examples: updated });
                                            }}
                                            className="input-field"
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Test Cases */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Test Cases</label>
                                    <button type="button" onClick={addTestCase} className="text-sm text-blue-600">
                                        + Add Test Case
                                    </button>
                                </div>
                                {formData.testCases.map((tc, idx) => (
                                    <div key={idx} className="border rounded p-3 mb-2 space-y-2">
                                        <textarea
                                            placeholder="Input"
                                            value={tc.input}
                                            onChange={(e) => {
                                                const updated = [...formData.testCases];
                                                updated[idx].input = e.target.value;
                                                setFormData({ ...formData, testCases: updated });
                                            }}
                                            className="input-field"
                                            rows="2"
                                        />
                                        <textarea
                                            placeholder="Expected Output"
                                            value={tc.output}
                                            onChange={(e) => {
                                                const updated = [...formData.testCases];
                                                updated[idx].output = e.target.value;
                                                setFormData({ ...formData, testCases: updated });
                                            }}
                                            className="input-field"
                                            rows="2"
                                        />
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={tc.isHidden}
                                                onChange={(e) => {
                                                    const updated = [...formData.testCases];
                                                    updated[idx].isHidden = e.target.checked;
                                                    setFormData({ ...formData, testCases: updated });
                                                }}
                                                className="mr-2"
                                            />
                                            <span className="text-sm text-gray-700">Hidden Test Case</span>
                                        </label>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end space-x-3 mt-6 sticky bottom-0 bg-white pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingProblem(null);
                                        resetForm();
                                    }}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Update Problem
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProblemManager;
