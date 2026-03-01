import { useState, useEffect } from 'react';
import sectionService from '../../services/sectionService';
import problemService from '../../services/problemService';
import toast from 'react-hot-toast';
import {
    Plus,
    Trash2,
    ChevronRight,
    ChevronDown,
    Folder,
    FileText,
    Layers,
    Search,
    Check
} from 'lucide-react';

const SectionManager = () => {
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expandedSection, setExpandedSection] = useState(null);
    const [expandedSubsection, setExpandedSubsection] = useState(null);
    const [selectedToRemove, setSelectedToRemove] = useState([]);

    // Modals
    const [showCreateSectionModal, setShowCreateSectionModal] = useState(false);
    const [showCreateSubsectionModal, setShowCreateSubsectionModal] = useState(false);
    const [showAddProblemModal, setShowAddProblemModal] = useState(false);

    // Form Data
    const [sectionTitle, setSectionTitle] = useState('');
    const [subsectionTitle, setSubsectionTitle] = useState('');
    const [selectedSectionId, setSelectedSectionId] = useState(null);
    const [selectedSubsectionId, setSelectedSubsectionId] = useState(null);

    // Problem Search
    const [allProblems, setAllProblems] = useState([]);
    const [problemSearch, setProblemSearch] = useState('');
    const [filteredProblems, setFilteredProblems] = useState([]);
    const [selectedProblemId, setSelectedProblemId] = useState([]);

    const [problemsMap, setProblemsMap] = useState({});

    useEffect(() => {
        fetchSections();
        fetchProblems();
    }, []);

    useEffect(() => {
        if (showAddProblemModal) {
            // Already fetched, but maybe refresh?
            // fetchProblems(); 
        }
    }, [showAddProblemModal]);

    useEffect(() => {
        let available = allProblems;

        // Filter out problems already in the selected subsection
        if (selectedSectionId && selectedSubsectionId && sections.length > 0) {
            const section = sections.find(s => s._id === selectedSectionId);
            if (section) {
                const subsection = section.subsections?.find(sub => sub._id === selectedSubsectionId);
                if (subsection && subsection.problemIds) {
                    const existingIds = new Set(subsection.problemIds);
                    available = available.filter(p => !existingIds.has(p._id || p.id));
                }
            }
        }

        if (problemSearch) {
            const lower = problemSearch.toLowerCase();
            setFilteredProblems(
                available.filter(p =>
                    p.title.toLowerCase().includes(lower) ||
                    (p.section && p.section.toLowerCase().includes(lower))
                )
            );
        } else {
            setFilteredProblems(available);
        }
    }, [problemSearch, allProblems, selectedSectionId, selectedSubsectionId, sections]);

    const fetchSections = async () => {
        setLoading(true);
        try {
            const data = await sectionService.getAllSections();
            setSections(data.sections);
        } catch (error) {
            toast.error(error.message || 'Failed to fetch sections');
        } finally {
            setLoading(false);
        }
    };

    const fetchProblems = async () => {
        try {
            const data = await problemService.getAllProblems();
            setAllProblems(data.problems);
            setFilteredProblems(data.problems);

            // Create map
            const map = {};
            data.problems.forEach(p => {
                map[p._id || p.id] = p;
            });
            setProblemsMap(map);
        } catch (error) {
            console.error(error);
            toast.error('Failed to fetch problems');
        }
    };

    const handleCreateSection = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await sectionService.createSection(sectionTitle);
            toast.success('Section created');
            setShowCreateSectionModal(false);
            setSectionTitle('');
            fetchSections();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSection = async (id) => {
        if (!window.confirm('Delete this section?\nThis will remove all subsections and problem associations.')) return;
        try {
            await sectionService.deleteSection(id);
            toast.success('Section deleted');
            fetchSections();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleAddSubsection = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await sectionService.addSubsection(selectedSectionId, subsectionTitle);
            toast.success('Subsection added');
            setShowCreateSubsectionModal(false);
            setSubsectionTitle('');
            fetchSections();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSubsection = async (sectionId, subsectionId) => {
        if (!window.confirm('Delete this subsection?')) return;
        try {
            await sectionService.deleteSubsection(sectionId, subsectionId);
            toast.success('Subsection deleted');
            fetchSections();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleAddProblem = async (e) => {
        e.preventDefault();
        if (!selectedProblemId || selectedProblemId.length === 0) {
            toast.error('Please select at least one problem');
            return;
        }
        setIsSubmitting(true);
        try {
            await sectionService.addProblemToSubsection(selectedSectionId, selectedSubsectionId, selectedProblemId);
            toast.success('Problem(s) added to subsection');
            setShowAddProblemModal(false);
            setSelectedProblemId([]); // Clear selection
            fetchSections();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveProblem = async (sectionId, subsectionId, problemId) => {
        // Can handle array or single string
        const isMultiple = Array.isArray(problemId);
        const count = isMultiple ? problemId.length : 1;

        if (count === 0) return;
        if (!window.confirm(`Remove ${count} problem(s) from this subsection?`)) return;

        try {
            await sectionService.removeProblemFromSubsection(sectionId, subsectionId, problemId);
            toast.success(`${count} problem(s) removed`);
            if (isMultiple) setSelectedToRemove([]);
            fetchSections();
        } catch (error) {
            toast.error(error.message);
        }
    };

    const toggleProblemToRemove = (pid) => {
        setSelectedToRemove(prev =>
            prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
        );
    };

    const toggleSection = (id) => {
        if (expandedSection === id) {
            setExpandedSection(null);
        } else {
            setExpandedSection(id);
        }
    };

    const toggleSubsection = (id) => {
        if (expandedSubsection === id) {
            setExpandedSubsection(null);
        } else {
            setExpandedSubsection(id);
        }
        setSelectedToRemove([]); // Reset multiple selection when switching
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Curriculum Management</h1>
                    <p className="text-gray-500 mt-1">Organize learning content into sections and subsections.</p>
                </div>
                <button
                    onClick={() => setShowCreateSectionModal(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus size={18} />
                    Create Section
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="spinner"></div>
                </div>
            ) : (
                <div className="space-y-4">
                    {sections.map(section => (
                        <div key={section._id} className="glass-panel overflow-hidden transition-all duration-300 hover:shadow-md border border-gray-200 rounded-xl">
                            {/* Section Header */}
                            <div
                                className={`p-4 flex justify-between items-center cursor-pointer transition-colors duration-200 ${expandedSection === section._id ? 'bg-primary-50/30' : 'hover:bg-gray-50'}`}
                                onClick={() => toggleSection(section._id)}
                            >
                                <div className="flex items-center space-x-4">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 ${expandedSection === section._id ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500'}`}>
                                        {expandedSection === section._id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                            {section.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-full shadow-sm">
                                                {section.subsections?.length || 0} subsections
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => {
                                            setSelectedSectionId(section._id);
                                            setShowCreateSubsectionModal(true);
                                        }}
                                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                                    >
                                        <Plus size={14} />
                                        Add Subsection
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSection(section._id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Section"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Section Content (Subsections) */}
                            {expandedSection === section._id && (
                                <div className="bg-gray-50/30 border-t border-gray-100 p-4 space-y-3 animate-fade-in">
                                    {section.subsections && section.subsections.length > 0 ? (
                                        section.subsections.map(sub => (
                                            <div key={sub._id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                                                <div
                                                    className="p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                                                    onClick={() => toggleSubsection(sub._id)}
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <div className={`p-1.5 rounded-md transition-colors ${expandedSubsection === sub._id ? 'text-primary-600 bg-primary-50' : 'text-gray-400'}`}>
                                                            {expandedSubsection === sub._id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                        </div>
                                                        <span className="font-semibold text-gray-700 flex items-center gap-2">
                                                            <Folder size={16} className="text-gray-400" />
                                                            {sub.title}
                                                        </span>
                                                        <span className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full font-medium">
                                                            {sub.problemIds?.length || 0} problems
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedSectionId(section._id);
                                                                setSelectedSubsectionId(sub._id);
                                                                setShowAddProblemModal(true);
                                                            }}
                                                            className="text-xs font-medium text-primary-600 hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                                        >
                                                            <Plus size={14} />
                                                            Add Problem
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSubsection(section._id, sub._id)}
                                                            className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg transition-colors"
                                                            title="Delete Subsection"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Problems List */}
                                                {expandedSubsection === sub._id && (
                                                    <div className="border-t border-gray-100 bg-gray-50/30">
                                                        {sub.problemIds && sub.problemIds.length > 0 ? (
                                                            <>
                                                                {selectedToRemove.length > 0 && (
                                                                    <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex justify-between items-center">
                                                                        <span className="text-sm font-medium text-red-700">{selectedToRemove.length} selected</span>
                                                                        <button
                                                                            onClick={() => handleRemoveProblem(section._id, sub._id, selectedToRemove)}
                                                                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded shadow-sm transition-colors"
                                                                        >
                                                                            Remove Selected
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                <ul className="divide-y divide-gray-100">
                                                                    {sub.problemIds.map(pid => {
                                                                        const problem = problemsMap[pid];
                                                                        const isChecked = selectedToRemove.includes(pid);

                                                                        return (
                                                                            <li key={pid} className={`flex justify-between items-center text-sm p-3 transition-colors pl-4 group ${isChecked ? 'bg-red-50/40' : 'hover:bg-white'}`}>
                                                                                <div className="flex items-center space-x-3">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={isChecked}
                                                                                        onChange={() => toggleProblemToRemove(pid)}
                                                                                        className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500 mr-2 cursor-pointer"
                                                                                    />
                                                                                    <FileText size={16} className="text-gray-400" />
                                                                                    <span className="text-gray-700 font-medium">
                                                                                        {problem ? problem.title : 'Unknown Problem'}
                                                                                    </span>
                                                                                    {problem && (
                                                                                        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-bold ${problem.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                                                                                            problem.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                                                                'bg-rose-100 text-rose-700'
                                                                                            }`}>
                                                                                            {problem.difficulty}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleRemoveProblem(section._id, sub._id, pid)}
                                                                                    className="text-gray-300 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                                                                    title="Remove from subsection"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            </>
                                                        ) : (
                                                            <div className="p-6 text-center">
                                                                <p className="text-sm text-gray-400 flex flex-col items-center gap-2">
                                                                    <Layers size={24} className="text-gray-300" />
                                                                    No problems in this subsection
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-white/50">
                                            <p className="text-sm text-gray-500 mb-2">Each section needs at least one subsection to hold problems.</p>
                                            <button
                                                onClick={() => {
                                                    setSelectedSectionId(section._id);
                                                    setShowCreateSubsectionModal(true);
                                                }}
                                                className="text-primary-600 font-medium text-sm hover:underline flex items-center justify-center gap-1"
                                            >
                                                <Plus size={14} /> Create your first subsection
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {sections.length === 0 && (
                        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Layers size={32} className="text-gray-300" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-1">No curriculum content yet</h3>
                            <p className="text-gray-500 mb-6 max-w-sm mx-auto">Start building your course structure by creating a section (e.g., "Data Structures").</p>
                            <button
                                onClick={() => setShowCreateSectionModal(true)}
                                className="btn-primary"
                            >
                                + Create First Section
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Create Section Modal */}
            {showCreateSectionModal && (
                <div className="modal-backdrop" onClick={() => setShowCreateSectionModal(false)}>
                    <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                                <Layers size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">Create New Section</h2>
                        </div>
                        <form onSubmit={handleCreateSection} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Section Title</label>
                                <input
                                    type="text"
                                    value={sectionTitle}
                                    onChange={(e) => setSectionTitle(e.target.value)}
                                    className="input-field w-full"
                                    placeholder="e.g. Dynamic Programming"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateSectionModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary px-6" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Creating...
                                        </>
                                    ) : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Subsection Modal */}
            {showCreateSubsectionModal && (
                <div className="modal-backdrop" onClick={() => setShowCreateSubsectionModal(false)}>
                    <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                                <Folder size={20} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">Add Subsection</h2>
                        </div>
                        <form onSubmit={handleAddSubsection} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subsection Title</label>
                                <input
                                    type="text"
                                    value={subsectionTitle}
                                    onChange={(e) => setSubsectionTitle(e.target.value)}
                                    className="input-field w-full"
                                    placeholder="e.g. 1D DP"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateSubsectionModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" className="btn-primary px-6" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Adding...
                                        </>
                                    ) : 'Add'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Problem Modal */}
            {showAddProblemModal && (
                <div className="modal-backdrop" onClick={() => setShowAddProblemModal(false)}>
                    <div className="modal-content max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Add Problem to Subsection</h2>
                            <button onClick={() => setShowAddProblemModal(false)} className="text-gray-400 hover:text-gray-600">
                                <span className="sr-only">Close</span>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                value={problemSearch}
                                onChange={(e) => setProblemSearch(e.target.value)}
                                className="input-field w-full pl-9"
                                placeholder="Search by title..."
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl mb-4 bg-gray-50/50">
                            {filteredProblems.length > 0 ? (
                                <ul className="divide-y divide-gray-100">
                                    {filteredProblems.map(p => {
                                        const isSelected = Array.isArray(selectedProblemId)
                                            ? selectedProblemId.includes(p._id || p.id)
                                            : selectedProblemId === (p._id || p.id);
                                        return (
                                            <li
                                                key={p._id || p.id}
                                                className={`p-3 cursor-pointer transition-colors flex justify-between items-center ${isSelected ? 'bg-primary-50' : 'hover:bg-white'}`}
                                                onClick={() => {
                                                    const pid = p._id || p.id;
                                                    const current = Array.isArray(selectedProblemId) ? selectedProblemId : (selectedProblemId ? [selectedProblemId] : []);
                                                    if (current.includes(pid)) {
                                                        setSelectedProblemId(current.filter(id => id !== pid));
                                                    } else {
                                                        setSelectedProblemId([...current, pid]);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center space-x-3">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300 bg-white'}`}>
                                                        {isSelected && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <span className="font-medium text-gray-900 text-sm">{p.title}</span>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : p.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                    {p.difficulty}
                                                </span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                    <Search size={24} className="mb-2 opacity-20" />
                                    <p>No problems found.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                            <div className="text-sm text-gray-500 font-medium">
                                {Array.isArray(selectedProblemId) ? selectedProblemId.length : (selectedProblemId ? 1 : 0)} selected
                            </div>
                            <div className="flex space-x-3">
                                <button type="button" onClick={() => setShowAddProblemModal(false)} className="btn-secondary">
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAddProblem({ preventDefault: () => { } })}
                                    className="btn-primary"
                                    disabled={!selectedProblemId || (Array.isArray(selectedProblemId) && selectedProblemId.length === 0) || isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Adding...
                                        </>
                                    ) : 'Add Selected'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SectionManager;
