// frontend/src/pages/instructor/ContestCreator.jsx (FIXED - COMPLETE)
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import contestService from '../../services/contestService';
import problemService from '../../services/problemService';
import adminService from '../../services/adminService';
import toast from 'react-hot-toast';

const ContestCreator = () => {
    const { user } = useAuth();
    const [batches, setBatches] = useState([]);
    const [existingProblems, setExistingProblems] = useState([]);
    const [loading, setLoading] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState('all');
    const [sectionFilter, setSectionFilter] = useState('all');

    // Form Data
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        batchId: '',
        existingProblemIds: [],
        proctoringEnabled: true,
        tabSwitchLimit: 3,
        maxViolations: 5,
    });

    const [newProblems, setNewProblems] = useState([]);
    const [showProblemModal, setShowProblemModal] = useState(false);
    const [currentProblem, setCurrentProblem] = useState(getEmptyProblem());

    function getEmptyProblem() {
        return {
            title: '',
            description: '',
            difficulty: 'Easy',
            section: 'Contest',
            constraints: [''],
            examples: [{ input: '', output: '', explanation: '' }],
            testCases: [{ input: '', output: '', isHidden: false }],
            timeLimit: 2000,
            points: 20
        };
    }

    useEffect(() => {
        fetchBatches();
        fetchProblems();
    }, []);

    const fetchBatches = async () => {
        try {
            const data = await adminService.getAllBatches();
            setBatches(data.batches?.filter((b) => b.status === 'active') || []);
        } catch (error) {
            toast.error('Failed to fetch batches');
        }
    };

    const fetchProblems = async () => {
        try {
            const data = await problemService.getAllProblems();
            setExistingProblems(data.problems || []);
        } catch (error) {
            toast.error('Failed to fetch problems');
        }
    };

    // Filtered and searched problems with null checks
    const filteredProblems = useMemo(() => {
        if (!Array.isArray(existingProblems)) return [];

        return existingProblems.filter(problem => {
            // Null checks for all fields
            const title = problem?.title || '';
            const description = problem?.description || '';
            const difficulty = problem?.difficulty || '';
            const section = problem?.section || '';

            const matchesSearch =
                title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                description.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesDifficulty =
                difficultyFilter === 'all' || difficulty === difficultyFilter;

            const matchesSection =
                sectionFilter === 'all' || section === sectionFilter;

            return matchesSearch && matchesDifficulty && matchesSection;
        });
    }, [existingProblems, searchQuery, difficultyFilter, sectionFilter]);

    const handleCreateContest = async (e) => {
        e.preventDefault();

        if (formData.existingProblemIds.length === 0 && newProblems.length === 0) {
            toast.error('Please add at least one problem');
            return;
        }

        if (new Date(formData.startTime) >= new Date(formData.endTime)) {
            toast.error('End time must be after start time');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...formData,
                problems: [...formData.existingProblemIds, ...newProblems]
            };

            await contestService.createContest(payload, user.role);
            toast.success('Contest created successfully!');

            // Reset form
            setFormData({
                title: '',
                description: '',
                startTime: '',
                endTime: '',
                batchId: '',
                existingProblemIds: [],
                proctoringEnabled: true,
                tabSwitchLimit: 3,
                maxViolations: 5,
            });
            setNewProblems([]);
            setSearchQuery('');
            setDifficultyFilter('all');
            setSectionFilter('all');
        } catch (error) {
            toast.error(error.message || 'Failed to create contest');
        } finally {
            setLoading(false);
        }
    };

    const toggleExistingProblem = (problemId) => {
        setFormData((prev) => {
            const isCurrentlySelected = prev.existingProblemIds.includes(problemId);
            const newIds = isCurrentlySelected
                ? prev.existingProblemIds.filter((id) => id !== problemId)
                : [...prev.existingProblemIds, problemId];

            return {
                ...prev,
                existingProblemIds: newIds
            };
        });
    };

    const handleAddNewProblem = () => {
        if (!currentProblem.title || !currentProblem.description) {
            toast.error('Title and Description are required');
            return;
        }

        if (currentProblem.testCases.length === 0 || !currentProblem.testCases[0].input) {
            toast.error('At least one test case is required');
            return;
        }

        // Set points based on difficulty
        const points = {
            Easy: 20,
            Medium: 50,
            Hard: 100
        };
        currentProblem.points = points[currentProblem.difficulty];

        setNewProblems([...newProblems, currentProblem]);
        setCurrentProblem(getEmptyProblem());
        setShowProblemModal(false);
        toast.success('Problem added to contest');
    };

    const removeNewProblem = (index) => {
        setNewProblems(newProblems.filter((_, i) => i !== index));
        toast.success('Problem removed');
    };

    // Helper functions for modal
    const updateConstraint = (idx, val) => {
        const updated = [...currentProblem.constraints];
        updated[idx] = val;
        setCurrentProblem({ ...currentProblem, constraints: updated });
    };
    const addConstraint = () => setCurrentProblem({ ...currentProblem, constraints: [...currentProblem.constraints, ''] });
    const removeConstraint = (idx) => setCurrentProblem({ ...currentProblem, constraints: currentProblem.constraints.filter((_, i) => i !== idx) });

    const updateExample = (idx, field, val) => {
        const updated = [...currentProblem.examples];
        updated[idx][field] = val;
        setCurrentProblem({ ...currentProblem, examples: updated });
    };
    const addExample = () => setCurrentProblem({ ...currentProblem, examples: [...currentProblem.examples, { input: '', output: '', explanation: '' }] });
    const removeExample = (idx) => setCurrentProblem({ ...currentProblem, examples: currentProblem.examples.filter((_, i) => i !== idx) });

    const updateTestCase = (idx, field, val) => {
        const updated = [...currentProblem.testCases];
        updated[idx][field] = val;
        setCurrentProblem({ ...currentProblem, testCases: updated });
    };
    const addTestCase = () => setCurrentProblem({ ...currentProblem, testCases: [...currentProblem.testCases, { input: '', output: '', isHidden: false }] });
    const removeTestCase = (idx) => setCurrentProblem({ ...currentProblem, testCases: currentProblem.testCases.filter((_, i) => i !== idx) });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-4xl font-bold text-gray-900 flex items-center">
                    <span className="mr-3">🏆</span> Create Contest
                </h1>
                <p className="text-gray-600 mt-2">Create a new coding contest with problems and proctoring</p>
            </div>

            <div className="card shadow-lg">
                <form onSubmit={handleCreateContest} className="space-y-6">
                    {/* Basic Info */}
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Contest Details</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Contest Title *</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="input-field"
                                    placeholder="e.g. Monthly Coding Challenge"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Batch *</label>
                                <select
                                    value={formData.batchId}
                                    onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                                    className="input-field"
                                    required
                                >
                                    <option value="">Select Batch</option>
                                    {batches.map((batch) => (
                                        <option key={batch._id} value={batch._id}>
                                            {batch.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="input-field"
                            rows="3"
                            placeholder="Describe the contest..."
                        />
                    </div>

                    {/* Timing */}
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Schedule</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
                                <input
                                    type="datetime-local"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                    className="input-field"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">End Time *</label>
                                <input
                                    type="datetime-local"
                                    value={formData.endTime}
                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                    className="input-field"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Proctoring Settings */}
                    <div className="border-t pt-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Proctoring Settings</h2>
                        <div className="space-y-4">
                            <label className="flex items-center cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                                <input
                                    type="checkbox"
                                    checked={formData.proctoringEnabled}
                                    onChange={(e) => setFormData({ ...formData, proctoringEnabled: e.target.checked })}
                                    className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div>
                                    <span className="text-sm font-bold text-gray-800">Enable Proctoring</span>
                                    <p className="text-xs text-gray-600">Track violations like tab switches, paste attempts, and fullscreen exits</p>
                                </div>
                            </label>

                            {formData.proctoringEnabled && (
                                <div className="ml-6 grid grid-cols-2 gap-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Tab Switch Warning Limit</label>
                                        <input
                                            type="number"
                                            value={formData.tabSwitchLimit}
                                            onChange={(e) => setFormData({ ...formData, tabSwitchLimit: parseInt(e.target.value) })}
                                            className="input-field"
                                            min="0"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Warning shown after this many switches</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Max Violations (Auto-Submit)</label>
                                        <input
                                            type="number"
                                            value={formData.maxViolations}
                                            onChange={(e) => setFormData({ ...formData, maxViolations: parseInt(e.target.value) })}
                                            className="input-field"
                                            min="1"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Auto-submit when total violations reach this</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Problems Section */}
                    <div className="border-t pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Contest Problems</h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    {formData.existingProblemIds.length + newProblems.length} problems selected
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowProblemModal(true)}
                                className="btn-primary flex items-center space-x-2"
                            >
                                <span>+</span>
                                <span>Create New Problem</span>
                            </button>
                        </div>

                        {/* New Problems Summary */}
                        {newProblems.length > 0 && (
                            <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500 mb-4">
                                <h4 className="font-bold text-blue-900 mb-3 flex items-center">
                                    <span className="mr-2">✨</span>
                                    New Problems ({newProblems.length})
                                </h4>
                                <ul className="space-y-2">
                                    {newProblems.map((p, idx) => (
                                        <li key={`new-problem-${idx}`} className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
                                            <div>
                                                <span className="font-semibold text-gray-800">{p.title}</span>
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${p.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                                                        p.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>
                                                        {p.difficulty}
                                                    </span>
                                                    <span className="text-xs text-gray-600">{p.points} points</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeNewProblem(idx)}
                                                className="text-red-600 hover:text-red-800 font-medium text-sm"
                                            >
                                                Remove
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Search and Filter */}
                        <div className="mb-4 space-y-3">
                            <div className="flex space-x-3">
                                <input
                                    type="text"
                                    placeholder="🔍 Search problems..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="input-field flex-1"
                                />
                                <select
                                    value={difficultyFilter}
                                    onChange={(e) => setDifficultyFilter(e.target.value)}
                                    className="input-field w-40"
                                >
                                    <option value="all">All Difficulties</option>
                                    <option value="Easy">Easy</option>
                                    <option value="Medium">Medium</option>
                                    <option value="Hard">Hard</option>
                                </select>
                                <select
                                    value={sectionFilter}
                                    onChange={(e) => setSectionFilter(e.target.value)}
                                    className="input-field w-40"
                                >
                                    <option value="all">All Sections</option>
                                    <option value="Arrays">Arrays</option>
                                    <option value="Strings">Strings</option>
                                    <option value="DP">DP</option>
                                    <option value="Graphs">Graphs</option>
                                    <option value="Contest">Contest</option>
                                </select>
                            </div>
                            <div className="text-sm text-gray-600">
                                Showing {filteredProblems.length} of {existingProblems.length} problems
                            </div>
                        </div>

                        {/* Existing Problems List - FIXED */}
                        <div className="max-h-96 overflow-y-auto space-y-2 border rounded-lg p-3 bg-gray-50">
                            {filteredProblems.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <span className="text-4xl block mb-2">🔍</span>
                                    <p>No problems found</p>
                                </div>
                            ) : (
                                filteredProblems.map((problem) => {
                                    // FIX: Use 'id' instead of '_id'
                                    const problemId = problem.id || problem._id;
                                    const isSelected = formData.existingProblemIds.includes(problemId);

                                    return (
                                        <div
                                            key={`problem-item-${problemId}`}
                                            className={`flex items-center p-4 rounded-lg transition ${isSelected
                                                    ? 'bg-blue-100 border-2 border-blue-500'
                                                    : 'bg-white hover:bg-gray-50 border-2 border-transparent'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                id={`checkbox-${problemId}`}
                                                checked={isSelected}
                                                onChange={() => toggleExistingProblem(problemId)}
                                                className="mr-3 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                                            />
                                            <label
                                                htmlFor={`checkbox-${problemId}`}
                                                className="flex-1 cursor-pointer select-none"
                                            >
                                                <div className="font-semibold text-gray-900">
                                                    {problem.title || 'Untitled'}
                                                </div>
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${problem.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                                                            problem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                                'bg-red-100 text-red-700'
                                                        }`}>
                                                        {problem.difficulty || 'N/A'}
                                                    </span>
                                                    <span className="text-sm text-gray-600">
                                                        {problem.points || 0} pts
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        • {problem.section || 'General'}
                                                    </span>
                                                </div>
                                            </label>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary w-full py-4 text-lg font-bold shadow-lg hover:shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center">
                                <div className="spinner border-white mr-3"></div> Creating Contest...
                            </span>
                        ) : (
                            <span>🚀 Create Contest</span>
                        )}
                    </button>
                </form>
            </div>

            {/* Create Problem Modal */}
            {showProblemModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl flex justify-between items-center z-10">
                            <h2 className="text-2xl font-bold">Create New Problem</h2>
                            <button
                                onClick={() => setShowProblemModal(false)}
                                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full text-2xl transition"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Problem Title *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={currentProblem.title}
                                        onChange={(e) => setCurrentProblem({ ...currentProblem, title: e.target.value })}
                                        placeholder="e.g. Two Sum"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                                    <select
                                        className="input-field"
                                        value={currentProblem.difficulty}
                                        onChange={(e) => setCurrentProblem({ ...currentProblem, difficulty: e.target.value })}
                                    >
                                        <option value="Easy">Easy (20 pts)</option>
                                        <option value="Medium">Medium (50 pts)</option>
                                        <option value="Hard">Hard (100 pts)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                                <textarea
                                    className="input-field"
                                    rows="4"
                                    value={currentProblem.description}
                                    onChange={(e) => setCurrentProblem({ ...currentProblem, description: e.target.value })}
                                    placeholder="Describe the problem..."
                                />
                            </div>

                            {/* Constraints */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Constraints</label>
                                {currentProblem.constraints.map((c, idx) => (
                                    <div key={`constraint-${idx}`} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            className="input-field flex-1"
                                            placeholder="e.g. 1 <= N <= 1000"
                                            value={c}
                                            onChange={(e) => updateConstraint(idx, e.target.value)}
                                        />
                                        {currentProblem.constraints.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeConstraint(idx)}
                                                className="px-3 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addConstraint}
                                    className="text-blue-600 text-sm font-medium hover:underline"
                                >
                                    + Add Constraint
                                </button>
                            </div>

                            {/* Examples */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Examples</label>
                                {currentProblem.examples.map((ex, idx) => (
                                    <div key={`example-${idx}`} className="bg-gray-50 p-4 rounded-lg mb-3 border-l-4 border-blue-500">
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <input
                                                type="text"
                                                className="input-field"
                                                placeholder="Input"
                                                value={ex.input}
                                                onChange={(e) => updateExample(idx, 'input', e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                className="input-field"
                                                placeholder="Output"
                                                value={ex.output}
                                                onChange={(e) => updateExample(idx, 'output', e.target.value)}
                                            />
                                        </div>
                                        <textarea
                                            className="input-field w-full"
                                            placeholder="Explanation (optional)"
                                            rows="2"
                                            value={ex.explanation}
                                            onChange={(e) => updateExample(idx, 'explanation', e.target.value)}
                                        />
                                        {currentProblem.examples.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeExample(idx)}
                                                className="text-red-600 text-sm mt-2 hover:underline"
                                            >
                                                Remove Example
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addExample}
                                    className="text-blue-600 text-sm font-medium hover:underline"
                                >
                                    + Add Example
                                </button>
                            </div>

                            {/* Test Cases */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Test Cases *</label>
                                {currentProblem.testCases.map((tc, idx) => (
                                    <div key={`testcase-${idx}`} className="bg-gray-50 p-4 rounded-lg mb-3 border-l-4 border-green-500">
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <textarea
                                                className="input-field"
                                                placeholder="Input"
                                                rows="2"
                                                value={tc.input}
                                                onChange={(e) => updateTestCase(idx, 'input', e.target.value)}
                                            />
                                            <textarea
                                                className="input-field"
                                                placeholder="Expected Output"
                                                rows="2"
                                                value={tc.output}
                                                onChange={(e) => updateTestCase(idx, 'output', e.target.value)}
                                            />
                                        </div>
                                        <label className="flex items-center space-x-2 mb-2">
                                            <input
                                                type="checkbox"
                                                checked={tc.isHidden}
                                                onChange={(e) => updateTestCase(idx, 'isHidden', e.target.checked)}
                                                className="h-4 w-4 text-blue-600 rounded"
                                            />
                                            <span className="text-sm text-gray-700">🔒 Hidden Test Case</span>
                                        </label>
                                        {currentProblem.testCases.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeTestCase(idx)}
                                                className="text-red-600 text-sm hover:underline"
                                            >
                                                Remove Test Case
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addTestCase}
                                    className="text-blue-600 text-sm font-medium hover:underline"
                                >
                                    + Add Test Case
                                </button>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowProblemModal(false);
                                        setCurrentProblem(getEmptyProblem());
                                    }}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddNewProblem}
                                    className="btn-primary"
                                >
                                    Add Problem to Contest
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContestCreator;
