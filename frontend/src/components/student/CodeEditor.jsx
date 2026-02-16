import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import problemService from '../../services/problemService';
import useCodeExecution from '../../hooks/useCodeExecution';
import { initPasteDetection } from '../../utils/pasteDetector';
import { initSecurityFeatures } from '../../utils/disableInspect';
import toast from 'react-hot-toast';

const LANGUAGE_OPTIONS = [
    { value: 'c', label: 'C', monacoLang: 'c' },
    { value: 'cpp', label: 'C++', monacoLang: 'cpp' },
    { value: 'java', label: 'Java', monacoLang: 'java' },
    { value: 'python', label: 'Python 3', monacoLang: 'python' },
    { value: 'javascript', label: 'JavaScript (Node.js)', monacoLang: 'javascript' },
];

const DEFAULT_CODE_TEMPLATES = {
    c: '// Write your C code here\n#include <stdio.h>\n\nint main() {\n    // Your code\n    return 0;\n}',
    cpp: '// Write your C++ code here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    // Your code\n    return 0;\n}',
    java: '// Write your Java code here\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Your code\n    }\n}',
    python: '# Write your Python code here\n\ndef main():\n    # Your code\n    pass\n\nif __name__ == "__main__":\n    main()',
    javascript: '// Write your JavaScript code here\n\nfunction main() {\n    // Your code\n}\n\nmain();',
};

const CodeEditor = () => {
    const { problemId } = useParams();
    const navigate = useNavigate();
    const editorRef = useRef(null);
    const [problem, setProblem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [language, setLanguage] = useState('cpp');
    const [code, setCode] = useState(DEFAULT_CODE_TEMPLATES.cpp);
    const [activeTab, setActiveTab] = useState('description');
    const [pasteAttempts, setPasteAttempts] = useState(0);

    const { running, submitting, runResult, submitResult, runCode, submitCode } = useCodeExecution();

    useEffect(() => {
        fetchProblem();

        // Initialize security features
        const cleanupSecurity = initSecurityFeatures(() => {
            toast.error('⚠️ DevTools detected! Please close DevTools to continue.', {
                duration: 10000,
            });
        });

        return () => {
            cleanupSecurity();
        };
    }, [problemId]);

    useEffect(() => {
        // Initialize paste detection
        if (editorRef.current) {
            const cleanupPaste = initPasteDetection(editorRef, (attempts) => {
                setPasteAttempts(attempts);
                toast.error(`External paste blocked! Attempts: ${attempts}`, { duration: 3000 });
            });

            return cleanupPaste;
        }
    }, [editorRef.current]);

    const fetchProblem = async () => {
        setLoading(true);
        try {
            const data = await problemService.getProblemById(problemId);
            setProblem(data.problem);
        } catch (error) {
            toast.error('Failed to load problem');
            navigate('/student/problems');
        } finally {
            setLoading(false);
        }
    };

    const handleEditorDidMount = (editor, monaco) => {
        editorRef.current = editor;
    };

    const handleLanguageChange = (newLanguage) => {
        setLanguage(newLanguage);
        setCode(DEFAULT_CODE_TEMPLATES[newLanguage]);
    };

    const handleRunCode = async () => {
        if (!code.trim()) {
            toast.error('Code cannot be empty');
            return;
        }

        await runCode(problemId, code, language);
    };

    const handleSubmitCode = async () => {
        if (!code.trim()) {
            toast.error('Code cannot be empty');
            return;
        }

        const confirm = window.confirm(
            '⚠️ Submit Solution?\n\n' +
            'This will test your code against ALL test cases (including hidden ones).\n' +
            'Make sure you have tested your code with sample test cases first.'
        );

        if (!confirm) return;

        await submitCode(problemId, code, language);
    };

    const getVerdictColor = (verdict) => {
        switch (verdict) {
            case 'Accepted':
                return 'text-green-600 bg-green-100';
            case 'Wrong Answer':
                return 'text-red-600 bg-red-100';
            case 'TLE':
                return 'text-orange-600 bg-orange-100';
            case 'Runtime Error':
                return 'text-purple-600 bg-purple-100';
            case 'Compilation Error':
                return 'text-gray-600 bg-gray-100';
            default:
                return 'text-gray-600 bg-gray-100';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => navigate('/student/problems')}
                        className="text-gray-600 hover:text-gray-900"
                    >
                        ← Back
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">{problem.title}</h1>
                    <span className={`badge-${problem.difficulty.toLowerCase()}`}>
                        {problem.difficulty}
                    </span>
                    <span className="text-sm text-gray-500">{problem.points} points</span>
                </div>
                <div className="flex items-center space-x-3">
                    {pasteAttempts > 0 && (
                        <span className="text-sm text-red-600 font-medium">
                            ⚠️ Paste attempts: {pasteAttempts}
                        </span>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Problem Description */}
                <div className="w-1/2 border-r border-gray-200 flex flex-col">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 bg-gray-50">
                        <button
                            onClick={() => setActiveTab('description')}
                            className={`px-6 py-3 font-medium ${activeTab === 'description'
                                    ? 'bg-white border-b-2 border-primary-600 text-primary-600'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Description
                        </button>
                        <button
                            onClick={() => setActiveTab('editorial')}
                            className={`px-6 py-3 font-medium ${activeTab === 'editorial'
                                    ? 'bg-white border-b-2 border-primary-600 text-primary-600'
                                    : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            Editorial
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'description' ? (
                            <div className="space-y-6">
                                {/* Description */}
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 mb-3">Problem Statement</h2>
                                    <div className="prose max-w-none text-gray-700">
                                        {problem.description}
                                    </div>
                                </div>

                                {/* Constraints */}
                                {problem.constraints?.length > 0 && (
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Constraints</h2>
                                        <ul className="list-disc list-inside space-y-1 text-gray-700">
                                            {problem.constraints.map((constraint, idx) => (
                                                <li key={idx}>{constraint}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Examples */}
                                {problem.examples?.length > 0 && (
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Examples</h2>
                                        {problem.examples.map((example, idx) => (
                                            <div key={idx} className="bg-gray-50 rounded-lg p-4 mb-3">
                                                <p className="text-sm font-semibold text-gray-700 mb-2">
                                                    Example {idx + 1}:
                                                </p>
                                                <div className="space-y-2">
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-600">Input:</span>
                                                        <pre className="bg-white p-2 rounded mt-1 text-sm">
                                                            {example.input}
                                                        </pre>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-600">Output:</span>
                                                        <pre className="bg-white p-2 rounded mt-1 text-sm">
                                                            {example.output}
                                                        </pre>
                                                    </div>
                                                    {example.explanation && (
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-600">
                                                                Explanation:
                                                            </span>
                                                            <p className="text-sm text-gray-700 mt-1">
                                                                {example.explanation}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 mb-3">Approach</h2>
                                    <div className="prose max-w-none text-gray-700">
                                        {problem.editorial?.approach || 'Editorial not available yet.'}
                                    </div>
                                </div>
                                {problem.editorial?.solution && (
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Solution</h2>
                                        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                                            {problem.editorial.solution}
                                        </pre>
                                    </div>
                                )}
                                {problem.editorial?.complexity && (
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900 mb-3">
                                            Time Complexity
                                        </h2>
                                        <p className="text-gray-700">{problem.editorial.complexity}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Code Editor */}
                <div className="w-1/2 flex flex-col">
                    {/* Editor Header */}
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-between items-center">
                        <select
                            value={language}
                            onChange={(e) => handleLanguageChange(e.target.value)}
                            className="input-field w-48"
                        >
                            {LANGUAGE_OPTIONS.map((lang) => (
                                <option key={lang.value} value={lang.value}>
                                    {lang.label}
                                </option>
                            ))}
                        </select>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleRunCode}
                                disabled={running || submitting}
                                className="btn-secondary"
                            >
                                {running ? (
                                    <>
                                        <span className="spinner mr-2"></span>
                                        Running...
                                    </>
                                ) : (
                                    '▶ Run Code'
                                )}
                            </button>
                            <button
                                onClick={handleSubmitCode}
                                disabled={running || submitting}
                                className="btn-primary"
                            >
                                {submitting ? (
                                    <>
                                        <span className="spinner mr-2"></span>
                                        Submitting...
                                    </>
                                ) : (
                                    '✓ Submit'
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Monaco Editor */}
                    <div className="flex-1 editor-container">
                        <Editor
                            height="100%"
                            language={LANGUAGE_OPTIONS.find((l) => l.value === language)?.monacoLang}
                            value={code}
                            onChange={(value) => setCode(value || '')}
                            onMount={handleEditorDidMount}
                            theme="vs-dark"
                            options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                wordWrap: 'on',
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                            }}
                        />
                    </div>

                    {/* Output Panel */}
                    {(runResult || submitResult) && (
                        <div className="border-t border-gray-200 bg-white p-4 max-h-64 overflow-y-auto">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Output</h3>
                            {runResult && (
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-3">
                                        <span className={`px-3 py-1 rounded font-medium ${getVerdictColor(runResult.verdict)}`}>
                                            {runResult.verdict}
                                        </span>
                                        <span className="text-sm text-gray-600">
                                            {runResult.testCasesPassed}/{runResult.totalTestCases} test cases passed
                                        </span>
                                    </div>
                                    {runResult.results?.map((result, idx) => (
                                        <div key={idx} className="bg-gray-50 rounded p-3 text-sm">
                                            <p className="font-medium text-gray-700">Test Case {idx + 1}</p>
                                            <p className={result.passed ? 'text-green-600' : 'text-red-600'}>
                                                {result.passed ? '✓ Passed' : '✗ Failed'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {submitResult && (
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-3">
                                        <span
                                            className={`px-3 py-1 rounded font-medium ${getVerdictColor(
                                                submitResult.submission.verdict
                                            )}`}
                                        >
                                            {submitResult.submission.verdict}
                                        </span>
                                        <span className="text-sm text-gray-600">
                                            {submitResult.submission.testCasesPassed}/
                                            {submitResult.submission.totalTestCases} test cases passed
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CodeEditor;
