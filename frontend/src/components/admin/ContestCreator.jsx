// frontend/src/pages/instructor/ContestCreator.jsx
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import contestService from '../../services/contestService';
import problemService from '../../services/problemService';
import adminService from '../../services/adminService';
import toast from 'react-hot-toast';
import CustomDropdown from '../../components/shared/CustomDropdown';
import {
    Trophy,
    Calendar,
    Clock,
    Users,
    Shield,
    AlertTriangle,
    Plus,
    Search,
    Filter,
    CheckSquare,
    Square,
    X,
    Save,
    Trash2,
    FileText,
    Code,
    BookOpen,
    Layers,
    ArrowLeft
} from 'lucide-react';

const ContestCreator = ({ onSuccess, onBack, initialData }) => {
    const { user } = useAuth();
    const [batches, setBatches] = useState([]);
    const [existingProblems, setExistingProblems] = useState([]);
    const [loading, setLoading] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState('all');

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

    // Load initial data for editing
    useEffect(() => {
        if (initialData) {
            setFormData({
                title: initialData.title || '',
                description: initialData.description || '',
                startTime: initialData.startTime ? new Date(initialData.startTime).toISOString().slice(0, 16) : '',
                endTime: initialData.endTime ? new Date(initialData.endTime).toISOString().slice(0, 16) : '',
                batchId: initialData.batchId || 'global',
                existingProblemIds: (initialData.problems || []).map(p => {
                    // initialData.problems may be fully populated objects or plain ID strings
                    if (typeof p === 'object' && p !== null) {
                        return (p._id || p.id || '').toString();
                    }
                    return p ? p.toString() : '';
                }).filter(id => /^[0-9a-fA-F]{24}$/.test(id)), // keep only valid ObjectId strings
                proctoringEnabled: initialData.proctoringEnabled !== undefined ? initialData.proctoringEnabled : true,
                tabSwitchLimit: initialData.tabSwitchLimit || 3,
                maxViolations: initialData.maxViolations || 5,
            });
            // We cannot easily restore "newProblems" as they are now "existing" in the DB, 
            // but for a simple edit, we rely on existingProblemIds.
        }
    }, [initialData]);

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

            return matchesSearch && matchesDifficulty;
        });
    }, [existingProblems, searchQuery, difficultyFilter]);



    // Prepare dropdown options
    const batchOptions = [
        { value: 'global', label: '🌐 Global Contest (Link Sharing)' },
        ...batches.map(b => ({ value: b._id, label: b.name }))
    ];
    const difficultyOptions = [
        { value: 'all', label: 'All Difficulties' },
        { value: 'Easy', label: 'Easy' },
        { value: 'Medium', label: 'Medium' },
        { value: 'Hard', label: 'Hard' }
    ];

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

        if (!formData.batchId) {
            toast.error('Please select a target batch or Global Contest');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                ...formData,
                batchId: formData.batchId === 'global' ? null : formData.batchId,
                problems: [...formData.existingProblemIds, ...newProblems]
            };

            if (initialData) {
                await contestService.updateContest(initialData._id, payload);
                toast.success('Contest updated successfully!');
            } else {
                await contestService.createContest(payload, user.role);
                toast.success('Contest created successfully!');
            }

            if (onSuccess) onSuccess();

            // Reset form if creating new (optional, but good practice if not unmounting)
            if (!initialData) {
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
            }
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
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <button
                        onClick={onBack}
                        className="flex items-center text-gray-500 hover:text-gray-700 mb-2 transition-colors"
                    >
                        <ArrowLeft size={16} className="mr-1" /> Back to Contests
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl text-white shadow-sm">
                            <Trophy size={28} />
                        </div>
                        {initialData ? 'Edit Contest' : 'Create Contest'}
                    </h1>
                    <p className="text-gray-500 mt-2 ml-1">
                        {initialData ? 'Update contest details and problems.' : 'Set up a new coding challenge for your students.'}
                    </p>
                </div>
            </div>

            <div className="glass-panel p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm">
                <form onSubmit={handleCreateContest} className="space-y-8">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-lg font-semibold text-gray-800 border-b border-gray-100 pb-2">
                                <FileText size={20} className="text-primary-500" />
                                <h3>Contest Details</h3>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Contest Title <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="input-field w-full"
                                        placeholder="e.g. Weekly Algorithms Challenge"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Target Batch <span className="text-red-500">*</span></label>
                                    <CustomDropdown
                                        options={batchOptions}
                                        value={formData.batchId}
                                        onChange={(val) => setFormData({ ...formData, batchId: val })}
                                        placeholder="Select a Batch"
                                        icon={Layers}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="input-field w-full min-h-[120px]"
                                        placeholder="Provide instructions and context for the contest..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-2 text-lg font-semibold text-gray-800 border-b border-gray-100 pb-2">
                                <Calendar size={20} className="text-primary-500" />
                                <h3>Schedule & Security</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Time <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            <input
                                                type="datetime-local"
                                                value={formData.startTime}
                                                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                                className="input-field w-full pl-9"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">End Time <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            <input
                                                type="datetime-local"
                                                value={formData.endTime}
                                                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                                className="input-field w-full pl-9"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Proctoring Settings */}
                                <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg mt-0.5">
                                                <Shield size={18} />
                                            </div>
                                            <div>
                                                <span className="font-semibold text-gray-900 block">Proctoring</span>
                                                <p className="text-xs text-gray-500 mt-0.5">Monitor tab switching and focus loss</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.proctoringEnabled}
                                                onChange={(e) => setFormData({ ...formData, proctoringEnabled: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                        </label>
                                    </div>

                                    {formData.proctoringEnabled && (
                                        <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-4 animate-fade-in-up">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Tab Switch Limit</label>
                                                <input
                                                    type="number"
                                                    value={formData.tabSwitchLimit}
                                                    onChange={(e) => setFormData({ ...formData, tabSwitchLimit: parseInt(e.target.value) })}
                                                    className="input-field w-full text-sm py-1.5"
                                                    min="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Max Violations</label>
                                                <input
                                                    type="number"
                                                    value={formData.maxViolations}
                                                    onChange={(e) => setFormData({ ...formData, maxViolations: parseInt(e.target.value) })}
                                                    className="input-field w-full text-sm py-1.5"
                                                    min="1"
                                                />
                                            </div>
                                            <div className="col-span-2 text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 p-2 rounded-lg">
                                                <AlertTriangle size={12} />
                                                Auto-submits after max violations reached.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Problems Section */}
                    <div className="space-y-6 pt-4 border-t border-gray-100">
                        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <div className="p-1.5 bg-green-50 text-green-600 rounded-lg">
                                        <Code size={20} />
                                    </div>
                                    Problems
                                </h3>
                                <p className="text-sm text-gray-500 mt-1 ml-1">
                                    Select existing problems or create new ones for this contest.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowProblemModal(true)}
                                className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-xl"
                            >
                                <Plus size={16} />
                                Create New Problem
                            </button>
                        </div>

                        {/* New Problems Summary */}
                        {newProblems.length > 0 && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100/50">
                                <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    Newly Created Problems ({newProblems.length})
                                </h4>
                                <div className="space-y-2">
                                    {newProblems.map((p, idx) => (
                                        <div key={`new-problem-${idx}`} className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-blue-100">
                                            <div>
                                                <span className="font-semibold text-gray-800">{p.title}</span>
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${p.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                                                        p.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>
                                                        {p.difficulty}
                                                    </span>
                                                    <span className="text-xs text-gray-500 font-medium">{p.points} points</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeNewProblem(idx)}
                                                className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Search and Filter */}
                        <div className="flex flex-col md:flex-row gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200/50">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search existing problems..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all shadow-sm"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                <div className="w-full sm:w-48">
                                    <CustomDropdown
                                        options={difficultyOptions}
                                        value={difficultyFilter}
                                        onChange={setDifficultyFilter}
                                        placeholder="Difficulty"
                                        icon={Filter}
                                        className="h-full"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Existing Problems List */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                            <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Available Problems</span>
                                <span className="text-xs font-medium text-gray-400">
                                    Selected: {formData.existingProblemIds.length + newProblems.length}
                                </span>
                            </div>
                            <div className="max-h-96 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200">
                                {filteredProblems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                        <Search size={32} className="mb-3 opacity-20" />
                                        <p>No matching problems found.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {filteredProblems.map((problem) => {
                                            // Always use the raw ObjectId (_id), never problem.id which may be a slug
                                            const problemId = (problem._id || '').toString();
                                            const isSelected = formData.existingProblemIds.includes(problemId);

                                            return (
                                                <div
                                                    key={`problem-item-${problemId}`}
                                                    onClick={() => toggleExistingProblem(problemId)}
                                                    className={`flex items-center p-3 rounded-xl transition-all cursor-pointer border ${isSelected
                                                        ? 'bg-primary-50 border-primary-200 shadow-sm'
                                                        : 'bg-white hover:bg-gray-50 border-transparent hover:border-gray-100'
                                                        }`}
                                                >
                                                    <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center transition-colors ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300 bg-white'}`}>
                                                        {isSelected && <CheckSquare size={12} className="text-white" />}
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="font-semibold text-gray-800 text-sm">
                                                            {problem.title || 'Untitled'}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${problem.difficulty === 'Easy' ? 'bg-green-50 text-green-700' :
                                                                problem.difficulty === 'Medium' ? 'bg-yellow-50 text-yellow-700' :
                                                                    'bg-red-50 text-red-700'
                                                                }`}>
                                                                {problem.difficulty || 'N/A'}
                                                            </span>
                                                            <span className="text-xs text-gray-500 font-medium">
                                                                {problem.points || 0} pts
                                                            </span>
                                                            <span className="text-xs text-gray-400">
                                                                {problem.section || 'General'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <div className="fixed bottom-6 right-6 z-20 md:static md:mt-8 md:flex md:justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary shadow-xl md:shadow-lg md:min-w-[200px] flex items-center justify-center gap-2 py-3 rounded-xl text-base font-semibold"
                        >
                            {loading ? (
                                <div className="spinner border-2 w-5 h-5"></div>
                            ) : (
                                <>
                                    <Save size={18} />
                                    <span>{initialData ? 'Update Contest' : 'Create Contest'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div >

            {/* Create Problem Modal - Keeping existing modal logic but ensuring style consistency */}
            {
                showProblemModal && (
                    <div className="modal-backdrop overflow-y-auto">
                        <div className="modal-content max-w-4xl p-0 my-8 shadow-2xl">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                                        <Plus size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Create New Problem</h2>
                                        <p className="text-xs text-gray-500 mt-0.5">Define problem details, test cases, and constraints.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowProblemModal(false)}
                                    className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Problem Title <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            className="input-field w-full"
                                            value={currentProblem.title}
                                            onChange={(e) => setCurrentProblem({ ...currentProblem, title: e.target.value })}
                                            placeholder="e.g. Two Sum"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Difficulty</label>
                                        <CustomDropdown
                                            options={[
                                                { value: 'Easy', label: 'Easy (20 pts)' },
                                                { value: 'Medium', label: 'Medium (50 pts)' },
                                                { value: 'Hard', label: 'Hard (100 pts)' }
                                            ]}
                                            value={currentProblem.difficulty}
                                            onChange={(val) => setCurrentProblem({ ...currentProblem, difficulty: val })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description <span className="text-red-500">*</span></label>
                                    <textarea
                                        className="input-field w-full min-h-[120px]"
                                        value={currentProblem.description}
                                        onChange={(e) => setCurrentProblem({ ...currentProblem, description: e.target.value })}
                                        placeholder="Describe the problem clearly..."
                                    />
                                </div>

                                {/* Constraints */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/60">
                                    <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <AlertTriangle size={16} className="text-amber-500" />
                                        Constraints
                                    </label>
                                    <div className="space-y-3">
                                        {currentProblem.constraints.map((c, idx) => (
                                            <div key={`constraint-${idx}`} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="input-field flex-1 text-sm font-mono"
                                                    placeholder="e.g. 1 <= N <= 1000"
                                                    value={c}
                                                    onChange={(e) => updateConstraint(idx, e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeConstraint(idx)}
                                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={addConstraint}
                                            className="text-primary-600 text-sm font-medium hover:underline flex items-center gap-1"
                                        >
                                            <Plus size={14} /> Add Constraint
                                        </button>
                                    </div>
                                </div>

                                {/* Examples */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-bold text-gray-800">Examples</label>
                                    {currentProblem.examples.map((ex, idx) => (
                                        <div key={`example-${idx}`} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative group">
                                            <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    onClick={() => removeExample(idx)}
                                                    className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Input</div>
                                                    <input
                                                        type="text"
                                                        className="input-field w-full font-mono text-sm bg-gray-50"
                                                        value={ex.input}
                                                        onChange={(e) => updateExample(idx, 'input', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Output</div>
                                                    <input
                                                        type="text"
                                                        className="input-field w-full font-mono text-sm bg-gray-50"
                                                        value={ex.output}
                                                        onChange={(e) => updateExample(idx, 'output', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Explanation (Optional)</div>
                                                <textarea
                                                    className="input-field w-full text-sm"
                                                    rows="2"
                                                    value={ex.explanation}
                                                    onChange={(e) => updateExample(idx, 'explanation', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={addExample}
                                        className="btn-secondary w-full py-2 flex items-center justify-center gap-2 border-dashed"
                                    >
                                        <Plus size={16} /> Add Example
                                    </button>
                                </div>

                                {/* Test Cases */}
                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                    <label className="block text-sm font-bold text-gray-800">Test Cases <span className="text-red-500 px-1 font-normal text-xs">* Required for judging</span></label>
                                    {currentProblem.testCases.map((tc, idx) => (
                                        <div key={`testcase-${idx}`} className="bg-gray-900 text-gray-200 p-4 rounded-xl border border-gray-700 relative group">
                                            <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    type="button"
                                                    onClick={() => removeTestCase(idx)}
                                                    className="text-gray-500 hover:text-red-400 p-1 rounded-md"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Standard Input</div>
                                                    <textarea
                                                        className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm font-mono text-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                        rows="2"
                                                        value={tc.input}
                                                        onChange={(e) => updateTestCase(idx, 'input', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Expected Output</div>
                                                    <textarea
                                                        className="w-full bg-gray-800 border-gray-700 rounded-lg p-2 text-sm font-mono text-white focus:ring-1 focus:ring-primary-500 focus:outline-none"
                                                        rows="2"
                                                        value={tc.output}
                                                        onChange={(e) => updateTestCase(idx, 'output', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <label className="flex items-center space-x-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={tc.isHidden}
                                                    onChange={(e) => updateTestCase(idx, 'isHidden', e.target.checked)}
                                                    className="rounded bg-gray-700 border-gray-600 text-primary-500 focus:ring-offset-gray-900"
                                                />
                                                <span className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                                                    {tc.isHidden ? <Shield size={12} className="text-green-400" /> : <Shield size={12} />}
                                                    Hidden Test Case (Private)
                                                </span>
                                            </label>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={addTestCase}
                                        className="btn-secondary w-full py-2 flex items-center justify-center gap-2 border-dashed"
                                    >
                                        <Plus size={16} /> Add Test Case
                                    </button>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-2xl">
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
                )
            }
        </div >
    );
};

export default ContestCreator;
