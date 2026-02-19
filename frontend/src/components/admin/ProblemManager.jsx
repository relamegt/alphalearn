import { useState, useEffect } from 'react';
import problemService from '../../services/problemService';
import toast from 'react-hot-toast';
import CustomDropdown from '../../components/shared/CustomDropdown';
import {
    Plus,
    Upload,
    Download,
    Search,
    Filter,
    Edit2,
    Trash2,
    X,
    Code,
    CheckCircle,
    AlertTriangle,
    FileText,
    List,
    Clock,
    Award
} from 'lucide-react';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const POINTS = {
    Easy: 20,
    Medium: 50,
    Hard: 100,
};

const ProblemManager = () => {
    const [problems, setProblems] = useState([]);
    const [filteredProblems, setFilteredProblems] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState('all');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingProblem, setEditingProblem] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
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
    }, []);

    // Filter logic
    useEffect(() => {
        let result = problems;

        if (difficultyFilter !== 'all') {
            result = result.filter(p => p.difficulty === difficultyFilter);
        }

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(p =>
                (p.title && p.title.toLowerCase().includes(lowerQuery)) ||
                (p.description && p.description.toLowerCase().includes(lowerQuery))
            );
        }

        setFilteredProblems(result);
    }, [problems, difficultyFilter, searchQuery]);

    const fetchProblems = async () => {
        setLoading(true);
        try {
            // Fetch all problems then filter locally for "instant" feel
            const data = await problemService.getAllProblems();
            setProblems(data.problems || []);
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
        if (!window.confirm(`Delete problem "${problemTitle}"? This will also delete all related submissions. This action cannot be undone.`)) {
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
            const data = await problemService.getProblemById(problem.id || problem._id);
            // Ensure data structure matches
            const p = data.problem;
            setEditingProblem(problem);
            setFormData({
                title: p.title,
                difficulty: p.difficulty,
                points: p.points,
                description: p.description,
                constraints: p.constraints || [],
                examples: p.examples || [{ input: '', output: '', explanation: '' }],
                testCases: p.testCases || [{ input: '', output: '', isHidden: false }],
                timeLimit: p.timeLimit || 2000,
                editorial: p.editorial || { approach: '', solution: '', complexity: '' },
            });
            setShowEditModal(true);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load problem details');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
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

    const updateExample = (idx, field, val) => {
        const updated = [...formData.examples];
        updated[idx][field] = val;
        setFormData({ ...formData, examples: updated });
    };

    const updateTestCase = (idx, field, val) => {
        const updated = [...formData.testCases];
        updated[idx][field] = val;
        setFormData({ ...formData, testCases: updated });
    };

    // Helper to remove items
    const removeItem = (type, idx) => {
        if (type === 'example') {
            const updated = formData.examples.filter((_, i) => i !== idx);
            setFormData({ ...formData, examples: updated });
        } else if (type === 'testCase') {
            const updated = formData.testCases.filter((_, i) => i !== idx);
            setFormData({ ...formData, testCases: updated });
        }
    };

    const downloadSampleJSON = () => {
        const sample = [
            {
                title: 'Two Sum',
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

    // Dropdown options
    const difficultyOptions = [
        { value: 'all', label: 'All Difficulties' },
        ...DIFFICULTIES.map(d => ({ value: d, label: d }))
    ];

    const formDifficultyOptions = DIFFICULTIES.map(d => ({ value: d, label: d }));

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-indigo-500 to-primary-600 rounded-xl text-white shadow-sm">
                            <Code size={28} />
                        </div>
                        Problem Management
                    </h1>
                    <p className="text-gray-500 mt-2 ml-1">Create, edit, and manage coding problems.</p>
                </div>
            </div>

            {/* Controls */}
            <div className="glass-panel p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-end">
                <div className="w-full md:w-auto flex flex-col md:flex-row gap-4 flex-1">
                    <div className="relative w-full md:w-96">
                        <input
                            type="text"
                            placeholder="Search problems..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 transition-all shadow-sm"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    </div>
                    <div className="w-full md:w-60">
                        <CustomDropdown
                            options={difficultyOptions}
                            value={difficultyFilter}
                            onChange={setDifficultyFilter}
                            placeholder="Filter by Difficulty"
                            icon={Filter}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button onClick={() => setShowCreateModal(true)} className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold">
                        <Plus size={18} /> Creates Problem
                    </button>
                    <button onClick={() => setShowBulkModal(true)} className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm flex items-center gap-2">
                        <Upload size={18} /> Bulk Upload
                    </button>
                    <button onClick={downloadSampleJSON} className="p-2.5 text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-transparent hover:border-gray-200" title="Download Sample JSON">
                        <Download size={20} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="spinner border-t-primary-500 border-2 w-8 h-8"></div>
                    </div>
                ) : filteredProblems.length === 0 ? (
                    <div className="text-center py-20 px-6">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-gray-900 font-medium">No problems found</h3>
                        <p className="text-gray-500 text-sm mt-1">Try adjusting your filters or search query.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50/50 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Problem</th>
                                    <th className="px-6 py-4">Difficulty</th>
                                    <th className="px-6 py-4">Points</th>
                                    <th className="px-6 py-4">Created Date</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredProblems.map((problem) => (
                                    <tr key={problem.id || problem._id} className="hover:bg-gray-50/40 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-gray-900">{problem.title}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${problem.difficulty === 'Easy' ? 'bg-green-50 text-green-700 border-green-100' :
                                                problem.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                                    'bg-red-50 text-red-700 border-red-100'
                                                }`}>
                                                {problem.difficulty}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                                            {problem.points} pts
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(problem.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-2">
                                                <button onClick={() => openEditModal(problem)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteProblem(problem.id || problem._id, problem.title)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && (
                <div className="modal-backdrop" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>
                    <div className="modal-content max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col my-8" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                    {showEditModal ? <Edit2 size={20} /> : <Plus size={20} />}
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {showEditModal ? 'Edit Problem' : 'Create New Problem'}
                                </h2>
                            </div>
                            <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-6 flex-1">
                            <form id="problemForm" onSubmit={showEditModal ? handleUpdateProblem : handleCreateProblem} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Problem Title <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="input-field w-full"
                                            required
                                            placeholder="e.g. Valid Palindrome"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Difficulty</label>
                                        <CustomDropdown
                                            options={formDifficultyOptions}
                                            value={formData.difficulty}
                                            onChange={(val) => setFormData({
                                                ...formData,
                                                difficulty: val,
                                                points: POINTS[val]
                                            })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                                            <Award size={16} className="text-gray-400" /> Points
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.points}
                                            readOnly
                                            className="input-field w-full bg-gray-50 text-gray-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                                            <Clock size={16} className="text-gray-400" /> Time Limit (ms)
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.timeLimit}
                                            onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) })}
                                            className="input-field w-full"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="input-field w-full min-h-[150px]"
                                        placeholder="Supports Markdown..."
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Constraints</label>
                                    <textarea
                                        value={formData.constraints.join(', ')}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            constraints: e.target.value.split(',').map(c => c.trim())
                                        })}
                                        className="input-field w-full font-mono text-sm"
                                        rows="2"
                                        placeholder="Comma separated, e.g. 1 <= n <= 100, 0 <= nums[i] <= 1000"
                                    />
                                </div>

                                {/* Examples */}
                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                            <List size={16} /> Examples
                                        </label>
                                        <button type="button" onClick={addExample} className="text-sm text-primary-600 hover:text-primary-700 font-medium hover:underline">
                                            + Add Example
                                        </button>
                                    </div>
                                    {formData.examples.map((example, idx) => (
                                        <div key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-200 relative group">
                                            <button type="button" onClick={() => removeItem('example', idx)} className="absolute right-2 top-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X size={16} />
                                            </button>
                                            <div className="grid grid-cols-2 gap-3 mb-2">
                                                <input
                                                    type="text"
                                                    placeholder="Input"
                                                    value={example.input}
                                                    onChange={(e) => updateExample(idx, 'input', e.target.value)}
                                                    className="input-field text-sm font-mono"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Output"
                                                    value={example.output}
                                                    onChange={(e) => updateExample(idx, 'output', e.target.value)}
                                                    className="input-field text-sm font-mono"
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Explanation (Optional)"
                                                value={example.explanation}
                                                onChange={(e) => updateExample(idx, 'explanation', e.target.value)}
                                                className="input-field w-full text-sm"
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Test Cases */}
                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                            <CheckCircle size={16} /> Test Cases
                                        </label>
                                        <button type="button" onClick={addTestCase} className="text-sm text-primary-600 hover:text-primary-700 font-medium hover:underline">
                                            + Add Test Case
                                        </button>
                                    </div>
                                    {formData.testCases.map((tc, idx) => (
                                        <div key={idx} className="bg-gray-900 rounded-xl p-4 border border-gray-800 relative group">
                                            <button type="button" onClick={() => removeItem('testCase', idx)} className="absolute right-2 top-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X size={16} />
                                            </button>
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                <textarea
                                                    placeholder="Input"
                                                    value={tc.input}
                                                    onChange={(e) => updateTestCase(idx, 'input', e.target.value)}
                                                    className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm font-mono text-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                    rows="2"
                                                />
                                                <textarea
                                                    placeholder="Expected Output"
                                                    value={tc.output}
                                                    onChange={(e) => updateTestCase(idx, 'output', e.target.value)}
                                                    className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm font-mono text-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                    rows="2"
                                                />
                                            </div>
                                            <label className="flex items-center space-x-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={tc.isHidden}
                                                    onChange={(e) => updateTestCase(idx, 'isHidden', e.target.checked)}
                                                    className="rounded bg-gray-700 border-gray-600 text-primary-500 focus:ring-offset-gray-900"
                                                />
                                                <span className="text-xs font-medium text-gray-400">Hidden Test Case</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </form>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button type="submit" form="problemForm" className="btn-primary">
                                {showEditModal ? 'Update Problem' : 'Create Problem'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Upload Modal */}
            {showBulkModal && (
                <div className="modal-backdrop" onClick={() => setShowBulkModal(false)}>
                    <div className="modal-content p-0" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <Upload size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">Bulk Upload</h2>
                            </div>
                            <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleBulkUpload} className="space-y-4">
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative">
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={(e) => setBulkFile(e.target.files[0])}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        required
                                    />
                                    <div className="pointer-events-none">
                                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                        {bulkFile ? (
                                            <p className="text-sm font-medium text-blue-600">{bulkFile.name}</p>
                                        ) : (
                                            <>
                                                <p className="text-sm font-medium text-gray-700">Click to upload JSON</p>
                                                <p className="text-xs text-gray-500 mt-1">Array of problems</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end space-x-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowBulkModal(false)}
                                        className="btn-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary">
                                        Upload
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

export default ProblemManager;
