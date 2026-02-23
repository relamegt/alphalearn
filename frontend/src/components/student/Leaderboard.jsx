import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import leaderboardService from '../../services/leaderboardService';
import contestService from '../../services/contestService';
import toast from 'react-hot-toast';
import { Calendar, Zap, Trophy, Link as LinkIcon } from 'lucide-react';
import CustomDropdown from '../shared/CustomDropdown';

const PLATFORMS = [
    { value: 'leetcode', label: 'LeetCode' },
    { value: 'codechef', label: 'CodeChef' },
    { value: 'codeforces', label: 'Codeforces' }
];

const Leaderboard = ({ batchId, isBatchView }) => {
    const { contestId, batchName: urlBatchId } = useParams();
    const [searchParams] = useSearchParams();
    const viewType = searchParams.get('type');
    const { user } = useAuth();
    const navigate = useNavigate();
    const targetBatchId = batchId || urlBatchId || user?.batchId;

    useEffect(() => {
        if (isBatchView && targetBatchId && user) {
            // Check against both batchId (ObjectId string) and batchName (URL slug)
            const isStudentAuthorized = user.role === 'student' &&
                (user.batchId === targetBatchId || user.batchName === targetBatchId || encodeURIComponent(user.batchName) === targetBatchId);

            // Instructors might have batch name mappings, but assignedBatches are ObjectIds. We bypass strict validation on frontend for the slug unless we pre-map it, but for safety, we simply let the backend reject them if we don't have the assignedBatches mapped. However, we'll allow it on frontend if it's not a clear rejection, or simply rely on the API to give 403.
            // Since instructors arrays hold only IDs, we check if target is an ID, else skip strict frontend check.
            const isInstructorIDAuthorized = user.role === 'instructor' && user.assignedBatches && user.assignedBatches.includes(targetBatchId);
            const isTargetAnId = /^[0-9a-fA-F]{24}$/.test(targetBatchId);

            if (user.role === 'student' && !isStudentAuthorized) {
                toast.error('Unauthorized access to this batch');
                navigate('/unauthorized');
            } else if (user.role === 'instructor' && isTargetAnId && !isInstructorIDAuthorized) {
                toast.error('Unauthorized access to this batch');
                navigate('/unauthorized');
            }
        }
    }, [isBatchView, targetBatchId, user, navigate]);

    // Local Token Rescue for Bulletproof Highlighting
    const [tokenUserId, setTokenUserId] = useState(null);
    const [localUserData, setLocalUserData] = useState(null);
    useEffect(() => {
        try {
            const token = document.cookie.split('; ').find(row => row.startsWith('accessToken='))?.split('=')[1];
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setTokenUserId(payload.userId || payload.id);
            }
            const stored = localStorage.getItem('user');
            if (stored) {
                setLocalUserData(JSON.parse(stored));
            }
        } catch (e) {
            console.error('Local token bypass highlighting lookup error:', e);
        }
    }, []);

    // Options menu state for Batch View
    const [showOptions, setShowOptions] = useState(false);
    const [batchName, setBatchName] = useState('');
    const optionsRef = useRef(null);
    const kebabBtnRef = useRef(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                optionsRef.current && !optionsRef.current.contains(e.target) &&
                kebabBtnRef.current && !kebabBtnRef.current.contains(e.target)
            ) {
                setShowOptions(false);
            }
        };
        if (showOptions) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showOptions]);

    const handleToggleOptions = () => {
        if (!showOptions && kebabBtnRef.current) {
            const rect = kebabBtnRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            });
        }
        setShowOptions(prev => !prev);
    };

    const [activeTab, setActiveTab] = useState(() => {
        if (contestId) return 'internal';
        if (viewType === 'contest') return 'external';
        return 'practice';
    });

    useEffect(() => {
        if (viewType === 'contest') {
            setActiveTab('external');
        } else if (contestId) {
            setActiveTab('internal');
        } else if (!contestId && viewType !== 'contest') {
            // If we are just visiting /student/leaderboard, default to practice
            setActiveTab('practice');
        }
    }, [viewType, contestId]);

    const [viewMode, setViewMode] = useState('summary'); // 'summary' | 'detailed'

    // RAW DATA (fetched ONCE from backend or cache)
    const [rawPracticeData, setRawPracticeData] = useState([]);
    const [rawAllExternalData, setRawAllExternalData] = useState(null);
    const [rawInternalData, setRawInternalData] = useState([]);
    const [contestInfo, setContestInfo] = useState(null);
    const [internalContestsMeta, setInternalContestsMeta] = useState([]); // List of internal contests for columns

    // Loading states
    const [practiceLoading, setPracticeLoading] = useState(false);
    const [externalLoading, setExternalLoading] = useState(false);
    const [internalLoading, setInternalLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    // Data loaded flags
    const [practiceDataLoaded, setPracticeDataLoaded] = useState(false);
    const [externalDataLoaded, setExternalDataLoaded] = useState(false);

    // CLIENT-SIDE FILTERS
    const [filters, setFilters] = useState({
        section: '',
        timeline: '',
        branch: '',
    });

    // External contest selection (CLIENT-SIDE)
    const [selectedPlatform, setSelectedPlatform] = useState('leetcode');
    const [selectedContest, setSelectedContest] = useState(null);

    // Internal contests
    const [internalContests, setInternalContests] = useState([]);
    const [selectedInternalContest, setSelectedInternalContest] = useState(contestId || null);

    // Reset loaded flags when batchId changes to force refetch
    useEffect(() => {
        setPracticeDataLoaded(false);
        setExternalDataLoaded(false);
        setRawPracticeData([]);
        setRawAllExternalData(null);
        setRawInternalData([]);
        setInternalContestsMeta([]);
    }, [targetBatchId]);

    // ========== FETCH DATA ONCE ==========
    useEffect(() => {
        if (targetBatchId && !practiceDataLoaded) {
            fetchPracticeLeaderboard();
        }
    }, [targetBatchId, practiceDataLoaded]);

    useEffect(() => {
        if (targetBatchId) {
            fetchInternalContests();
        }
    }, [targetBatchId]);

    // Fetch external data when tab is opened
    useEffect(() => {
        if (activeTab === 'external' && targetBatchId && !externalDataLoaded) {
            fetchAllExternalData();
        }
    }, [activeTab, targetBatchId, externalDataLoaded]);

    useEffect(() => {
        if (selectedInternalContest) {
            fetchInternalContestLeaderboard();
        }
    }, [selectedInternalContest]);

    // Auto-refresh internal leaderboard using WebSockets
    const wsRef = useRef(null);
    const [liveParticipants, setLiveParticipants] = useState(0);

    useEffect(() => {
        const isFinished = contestInfo && new Date() > new Date(contestInfo.endTime);
        if (activeTab === 'internal' && selectedInternalContest && !isFinished) {
            const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:5000'}/ws`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                const token = localStorage.getItem('token');
                ws.send(JSON.stringify({
                    type: 'join',
                    contestId: selectedInternalContest,
                    token
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'leaderboardUpdate') {
                        setRawInternalData(data.leaderboard);
                    } else if (data.type === 'participantCount') {
                        setLiveParticipants(data.count);
                    }
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            };

            return () => {
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close();
                }
            };
        }
    }, [activeTab, selectedInternalContest, contestInfo]);

    const fetchPracticeLeaderboard = async (forceRefresh = false) => {
        if (!targetBatchId) return;
        setPracticeLoading(true);
        try {
            const data = await leaderboardService.getBatchLeaderboard(targetBatchId, forceRefresh);
            setRawPracticeData(data.leaderboard || []);
            if (data.batchName) setBatchName(data.batchName);
            setInternalContestsMeta(data.contests || []); // Capture contest metadata
            setPracticeDataLoaded(true);
        } catch (error) {
            toast.error('Failed to fetch leaderboard');
            setRawPracticeData([]);
        } finally {
            setPracticeLoading(false);
            setInitialLoading(false);
        }
    };

    // Fetch ALL platforms data in ONE call with caching
    const fetchAllExternalData = async (forceRefresh = false) => {
        if (!targetBatchId) return;
        setExternalLoading(true);
        try {
            const data = await leaderboardService.getAllExternalData(targetBatchId, forceRefresh);
            setRawAllExternalData(data.platforms || {});
            setExternalDataLoaded(true);

            // Set initial contest selection
            const platformData = data.platforms?.[selectedPlatform];
            if (platformData?.contests && platformData.contests.length > 0) {
                setSelectedContest(platformData.contests[0].contestName);
            } else {
                setSelectedContest(null);
            }
        } catch (error) {
            toast.error('Failed to fetch external contest data');
            setRawAllExternalData({});
        } finally {
            setExternalLoading(false);
            setInitialLoading(false);
        }
    };

    const fetchInternalContestLeaderboard = async (isBackground = false) => {
        if (!isBackground) setInternalLoading(true);
        try {
            const data = await leaderboardService.getInternalContestLeaderboard(
                selectedInternalContest
            );
            setRawInternalData(data.leaderboard || []);
            setContestInfo(data.contest || null);
        } catch (error) {
            if (!isBackground) {
                toast.error('Failed to fetch internal contest leaderboard');
                setRawInternalData([]);
            }
        } finally {
            if (!isBackground) {
                setInternalLoading(false);
                setInitialLoading(false);
            }
        }
    };

    const fetchInternalContests = async () => {
        if (!targetBatchId) return;
        try {
            const data = await contestService.getContestsByBatch(targetBatchId);
            setInternalContests(data.contests || []);
            if (data.contests && data.contests.length > 0) {
                if (!contestId) {
                    setSelectedInternalContest(data.contests[0]._id);
                }
            } else if (!contestId) {
                setSelectedInternalContest(null);
            }
        } catch (error) {
            console.error('Failed to fetch internal contests');
            setInternalContests([]);
            setSelectedInternalContest(null);
        }
    };

    // ========== CLIENT-SIDE FILTERING ==========

    // Filter state
    const [activeFilter, setActiveFilter] = useState(null); // 'branch' | 'section' | 'timeline'
    const [searchQuery, setSearchQuery] = useState('');

    // Sorting state
    const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });
    const [internalSortConfig, setInternalSortConfig] = useState({ key: 'score', direction: 'desc' });
    const [internalPageSize, setInternalPageSize] = useState(50);
    const [internalPage, setInternalPage] = useState(1);

    const handleFilterClick = (filterName) => {
        setActiveFilter(activeFilter === filterName ? null : filterName);
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleInternalSort = (key) => {
        let direction = 'desc'; // Default to desc for internal score
        if (internalSortConfig.key === key && internalSortConfig.direction === 'desc') {
            direction = 'asc';
        } else if (internalSortConfig.key === key && internalSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setInternalSortConfig({ key, direction });
    };

    // Helper to get value for sorting
    const getValueByPath = (obj, path) => {
        if (!path) return null;
        if (typeof path === 'function') return path(obj);
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    const FilterIcon = ({ active }) => (
        <svg className={`w-4 h-4 ml-1 cursor-pointer ${active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
    );

    // Computed available branches from data
    const availableBranches = useMemo(() => {
        const branches = new Set(rawPracticeData.map(d => d.branch));
        return Array.from(branches).filter(Boolean).sort();
    }, [rawPracticeData]);

    // Filter practice leaderboard
    const filteredPracticeLeaderboard = useMemo(() => {
        if (!Array.isArray(rawPracticeData)) return [];

        // 1. Assign Global Rank (assuming rawPracticeData is sorted by score from backend)
        let processed = [...rawPracticeData];

        // 2. Apply Filters
        if (filters.branch) {
            processed = processed.filter(entry => entry.branch === filters.branch);
        }

        if (filters.section) {
            processed = processed.filter(entry => entry.section === filters.section);
        }

        if (filters.timeline) {
            const now = new Date();
            processed = processed.filter(entry => {
                const lastUpdated = new Date(entry.lastUpdated);
                if (filters.timeline === 'week') {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 1000);
                    return lastUpdated >= weekAgo;
                } else if (filters.timeline === 'month') {
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 1000);
                    return lastUpdated >= monthAgo;
                }
                return true;
            });
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            processed = processed.filter(entry =>
                (entry.name && String(entry.name).toLowerCase().includes(query)) ||
                (entry.username && String(entry.username).toLowerCase().includes(query)) ||
                (entry.rollNumber && String(entry.rollNumber).toLowerCase().includes(query))
            );
        }

        // 3. Assign Filtered Rank (Branch/Section Rank)
        // Sort by score desc to assign rank, then restore or keep sorted
        // We need a stable score comparison. overallScore is the main metric.
        // We create a temporary sorted version to determine ranks.
        const scoreSorted = [...processed].sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));

        // Map rank back to the items
        // Since scoreSorted contents are references, we can't just mutate. 
        // Better: Create a map of ID/RollNo -> Rank? Or just map the sorted list?
        // Actually, we can just map the scoreSorted list to new objects with 'rank'.
        // But wait, the user might want to sort by 'Name'. 
        // If we only have scoreSorted, we can't sort by Name easily without losing the rank info if we don't stamp it.

        // Let's stamp 'rank' on the objects.
        const ranked = scoreSorted.map((entry, index) => ({
            ...entry,
            rank: index + 1
        }));

        // 4. Apply User Sort
        if (sortConfig.key) {
            ranked.sort((a, b) => {
                let aValue = getValueByPath(a, sortConfig.key);
                let bValue = getValueByPath(b, sortConfig.key);

                // Check if numeric
                const aNum = parseFloat(aValue);
                const bNum = parseFloat(bValue);

                if (!isNaN(aNum) && !isNaN(bNum) && typeof aValue !== 'string') {
                    if (aNum < bNum) return sortConfig.direction === 'asc' ? -1 : 1;
                    if (aNum > bNum) return sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                }

                // String sorting
                const aStr = String(aValue || '').toLowerCase();
                const bStr = String(bValue || '').toLowerCase();

                if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return ranked;
    }, [rawPracticeData, filters, sortConfig, searchQuery]);

    // Get external leaderboard for selected platform and contest (CLIENT-SIDE)
    const externalLeaderboard = useMemo(() => {
        if (!rawAllExternalData || !selectedPlatform || !selectedContest) return [];

        const platformData = rawAllExternalData[selectedPlatform];
        if (!platformData || !platformData.contests) return [];

        const contest = platformData.contests.find(c => c.contestName === selectedContest);
        return contest && Array.isArray(contest.leaderboard) ? contest.leaderboard : [];
    }, [rawAllExternalData, selectedPlatform, selectedContest]);

    // Get available contests for selected platform (CLIENT-SIDE)
    const availableContests = useMemo(() => {
        if (!rawAllExternalData || !selectedPlatform) return [];

        const platformData = rawAllExternalData[selectedPlatform];
        if (!platformData || !platformData.contests) return [];

        return platformData.contests.map(c => ({
            contestName: c.contestName,
            participants: c.participants,
            startTime: c.startTime
        }));
    }, [rawAllExternalData, selectedPlatform]);

    // Computed Internal Leaderboard Data
    const sortedInternalData = useMemo(() => {
        if (!Array.isArray(rawInternalData)) return [];
        let data = [...rawInternalData];

        if (internalSortConfig.key) {
            data.sort((a, b) => {
                let aValue = getValueByPath(a, internalSortConfig.key);
                let bValue = getValueByPath(b, internalSortConfig.key);

                if (internalSortConfig.key === 'score') {
                    // special handling for score as string/number
                    aValue = parseFloat(aValue);
                    bValue = parseFloat(bValue);
                }

                // Check if numeric
                const aNum = parseFloat(aValue);
                const bNum = parseFloat(bValue);

                if (!isNaN(aNum) && !isNaN(bNum) && typeof aValue !== 'string') {
                    if (aNum < bNum) return internalSortConfig.direction === 'asc' ? -1 : 1;
                    if (aNum > bNum) return internalSortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                }

                // String sorting
                const aStr = String(aValue || '').toLowerCase();
                const bStr = String(bValue || '').toLowerCase();

                if (aStr < bStr) return internalSortConfig.direction === 'asc' ? -1 : 1;
                if (aStr > bStr) return internalSortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return data;
    }, [rawInternalData, internalSortConfig]);

    // Reset to page 1 when contest changes or data changes
    useEffect(() => { setInternalPage(1); }, [selectedInternalContest, rawInternalData]);

    const internalTotalPages = Math.max(1, Math.ceil(sortedInternalData.length / internalPageSize));
    const paginatedInternalData = sortedInternalData.slice((internalPage - 1) * internalPageSize, internalPage * internalPageSize);

    const downloadInternalCSV = () => {
        if (!sortedInternalData.length) return;

        // Escape helper: only quote cells that contain commas, quotes, or newlines
        const escapeCell = (val) => {
            const str = String(val ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        // Format raw minutes into '4m' or '1:01h'
        const formatTime = (mins) => {
            if (mins === null || mins === undefined) return '';
            if (mins < 60) return `${mins}m`;
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return `${h}:${m.toString().padStart(2, '0')}h`;
        };

        // ONE column per problem –" header is "P1: Title"
        const problemHeaders = contestInfo?.problems?.map((p, i) =>
            `P${i + 1}: ${p.title}`
        ) || [];

        const headers = [
            'Rank', 'Roll No', 'Username', 'Full Name', 'Branch',
            ...problemHeaders,
            'Total Time (min)', 'Solved',
            'Tab Switches', 'FS Exits', 'Total Violations',
            'Status', 'Score'
        ];

        const totalProblems = contestInfo?.totalProblems || contestInfo?.problems?.length || 0;

        const rows = sortedInternalData.map((entry, index) => {
            // One cell per problem: "Accepted-3m" / "Wrong Answer-7m" / "Not Attempted"
            const problemCells = contestInfo?.problems?.map(p => {
                const pData = entry.problems?.[p._id];
                const status = pData?.status || 'Not Attempted';
                if (status === 'Not Attempted') return 'Not Attempted';
                const subTimeStr = pData?.submittedAt !== undefined && pData?.submittedAt !== null
                    ? `-${formatTime(pData.submittedAt)}`
                    : '';
                return `${status}${subTimeStr}`;  // e.g. "Accepted-3m" or "Wrong Answer-1:01h"
            }) || [];

            // Plain "1/2" –✓ prefix with a tab so Excel treats it as text instead of converting to a date
            const solvedCell = `\t${entry.problemsSolved}/${totalProblems}`;

            return [
                index + 1,
                entry.rollNumber,
                (entry.isSpotUser || entry.username?.startsWith('spot_')) ? '-' : (entry.username !== 'N/A' && entry.username ? entry.username : entry.fullName),
                entry.fullName,
                entry.branch,
                ...problemCells,
                formatTime(entry.time),
                solvedCell,
                entry.tabSwitchCount || 0,
                entry.fullscreenExits || 0,
                (entry.tabSwitchCount || 0) + (entry.fullscreenExits || 0),
                entry.isCompleted ? 'Finished' : 'In Progress',
                entry.score
            ];
        });

        const csvContent = [
            headers.map(escapeCell).join(','),
            ...rows.map(row => row.map(escapeCell).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${contestInfo?.title || 'contest'}_leaderboard.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    // Handle platform change (CLIENT-SIDE filtering)
    const handlePlatformChange = (platform) => {
        setSelectedPlatform(platform);

        // Auto-select first contest for new platform
        const platformData = rawAllExternalData?.[platform];
        if (platformData?.contests && platformData.contests.length > 0) {
            setSelectedContest(platformData.contests[0].contestName);
        } else {
            setSelectedContest(null);
        }
    };

    const handleResetFilters = () => {
        setFilters({ section: '', timeline: '', branch: '' });
        setSearchQuery('');
    };

    const handleRefreshPractice = () => {
        toast.success('Refreshing practice leaderboard...');
        fetchPracticeLeaderboard(true);
    };

    const handleRefreshExternal = () => {
        toast.success('Refreshing external contest data...');
        fetchAllExternalData(true);
    };

    const downloadPracticeCSV = () => {
        if (!filteredPracticeLeaderboard || filteredPracticeLeaderboard.length === 0) {
            toast.error('No data to download');
            return;
        }

        const headers = [
            'Rank', 'Global Rank', 'Roll Number', 'Full Name', 'Username', 'Branch',
            'Overall Score', 'Alpha Coins',
            'HackerRank', 'LeetCode', 'InterviewBit', 'CodeChef', 'CodeForces'
        ];

        internalContestsMeta.forEach((contest, idx) => {
            headers.push(`Contest-${idx + 1} (${contest.maxScore})`);
        });

        const escapeCell = (str) => {
            if (str === null || str === undefined) return '';
            const val = String(str).replace(/"/g, '""');
            return `"${val}"`;
        };

        const rows = filteredPracticeLeaderboard.map((entry) => {
            const row = [
                entry.rank,
                entry.globalRank || '-',
                entry.rollNumber,
                entry.name,
                entry.username,
                entry.branch,
                entry.overallScore,
                entry.alphaCoins || 0,
                entry.externalScores?.hackerrank || 0,
                entry.externalScores?.leetcode || 0,
                entry.externalScores?.interviewbit || 0,
                entry.externalScores?.codechef || 0,
                entry.externalScores?.codeforces || 0
            ];

            internalContestsMeta.forEach((contest) => {
                row.push(entry.internalContests?.[contest.id] || 0);
            });

            return row;
        });

        const csvContent = [
            headers.map(escapeCell).join(','),
            ...rows.map(row => row.map(escapeCell).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${batchName || 'batch'}_practice_leaderboard.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (showOptions) setShowOptions(false);
    };

    const LoadingSpinner = () => (
        <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    if (initialLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading leaderboard data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 pb-12">

            {/* Fixed Dropdown Portal –" renders outside sticky header stacking context */}
            {isBatchView && showOptions && (
                <div
                    ref={optionsRef}
                    className="fixed w-64 bg-white rounded-xl border border-gray-100 overflow-hidden z-[9999]"
                    style={{
                        top: dropdownPos.top,
                        right: dropdownPos.right,
                        boxShadow: '0 20px 60px -10px rgba(0,0,0,0.25), 0 4px 20px -4px rgba(0,0,0,0.12)',
                    }}
                >
                    {/* Header */}
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Options</p>
                    </div>

                    {/* Timeline Filters */}
                    <div className="px-3 py-3 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase mb-2 px-1">Timeline</p>
                        <div className="space-y-0.5">
                            {[
                                { value: '', label: 'All Time' },
                                { value: 'month', label: 'This Month' },
                                { value: 'week', label: 'This Week' },
                            ].map(({ value: t, label }) => (
                                <button
                                    key={t}
                                    onClick={() => { setFilters({ ...filters, timeline: t }); setShowOptions(false); }}
                                    className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${filters.timeline === t ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                                >
                                    <span>{label}</span>
                                    {filters.timeline === t && (
                                        <svg className="w-4 h-4 ml-auto text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-800">Detailed View</p>
                                <p className="text-xs text-gray-400 mt-0.5">Show platform breakdowns</p>
                            </div>
                            <button
                                onClick={() => setViewMode(viewMode === 'summary' ? 'detailed' : 'summary')}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${viewMode === 'detailed' ? 'bg-blue-600' : 'bg-gray-200'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${viewMode === 'detailed' ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="p-2 space-y-1">
                        <button
                            onClick={downloadPracticeCSV}
                            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Download Report</span>
                        </button>
                        <button
                            onClick={() => { handleRefreshPractice(); setShowOptions(false); }}
                            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <svg className={`w-4 h-4 text-gray-500 ${practiceLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>{practiceLoading ? 'Refreshing...' : 'Refresh Data'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Header Section */}
            {isBatchView ? (
                <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm sticky top-0 z-30">
                    <div className="w-full mx-auto px-6 h-16 flex items-center justify-between relative">
                        {/* Left: Logo */}
                        <div className="flex items-center gap-2">
                            <img
                                src="/alphalogo.png"
                                alt="AlphaKnowledge"
                                className="h-6 w-auto object-contain"
                            />
                            <span className="text-lg font-bold text-gray-800 tracking-tight">AlphaKnowledge</span>
                        </div>

                        {/* Center: Batch Name + current filter indicator */}
                        <div className="absolute left-1/2 transform -translate-x-1/2 text-center hidden md:block">
                            <div className="text-base font-semibold text-gray-800">
                                {batchName || user?.education?.batch || 'Batch Leaderboard'}
                            </div>
                            {filters.timeline && (
                                <div className="text-[10px] text-blue-500 font-medium mt-0.5">
                                    {filters.timeline === 'month' ? 'This Month' : 'This Week'}
                                </div>
                            )}
                        </div>

                        {/* Right: Options Kebab */}
                        <div>
                            <button
                                ref={kebabBtnRef}
                                onClick={handleToggleOptions}
                                className={`p-1.5 rounded-full transition-colors focus:outline-none ${showOptions ? 'bg-gray-100 text-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
                                title="Options"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className={`${isBatchView ? 'min-w-full' : 'max-w-7xl mx-auto'} px-4 sm:px-6 mt-2`}>

                {/* Practice Leaderboard Controls */}
                {activeTab === 'practice' && (
                    <div className="space-y-6">
                        {!isBatchView && (
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

                                {/* Timeline Filters */}
                                <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex items-center">
                                    <button
                                        onClick={() => setFilters({ ...filters, timeline: '' })}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${!filters.timeline ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        All Time
                                    </button>
                                    <button
                                        onClick={() => setFilters({ ...filters, timeline: 'month' })}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filters.timeline === 'month' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        This Month
                                    </button>
                                    <button
                                        onClick={() => setFilters({ ...filters, timeline: 'week' })}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filters.timeline === 'week' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        This Week
                                    </button>
                                </div>

                                {/* View Mode Toggle & Refresh */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setViewMode(viewMode === 'summary' ? 'detailed' : 'summary')}
                                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${viewMode === 'detailed' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l4 4a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>{viewMode === 'summary' ? 'Detailed View' : 'Summary View'}</span>
                                    </button>

                                    <button
                                        onClick={handleRefreshPractice}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 bg-white transition-colors"
                                        title="Refresh Data"
                                        disabled={practiceLoading}
                                    >
                                        <svg className={`w-5 h-5 ${practiceLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Search Input Filter for Everyone */}
                        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                            <div className="relative w-full sm:w-80">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50/50 hover:bg-white focus:bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    placeholder="Search Roll No, Name, or Username..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {(searchQuery || filters.branch || filters.section || filters.timeline) && (
                                <button
                                    onClick={handleResetFilters}
                                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap"
                                >
                                    Clear All Filters
                                </button>
                            )}
                        </div>


                        <div className="card !p-0 overflow-hidden">
                            {practiceLoading ? (
                                <LoadingSpinner />
                            ) : filteredPracticeLeaderboard.length === 0 ? (
                                <div className="text-center py-12">
                                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                    <p className="text-gray-600 text-lg font-medium">No leaderboard data available</p>
                                    <p className="text-gray-500 text-sm mt-2">Start solving problems to appear on the leaderboard!</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr className="border-b border-gray-200">
                                                <th
                                                    className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200 sticky left-0 bg-gray-50 z-20 w-[90px] min-w-[90px] cursor-pointer hover:bg-gray-100"
                                                    onClick={() => handleSort('rank')}
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="flex items-center gap-1">
                                                            Rank {sortConfig.key === 'rank' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-normal normal-case">(Global)</span>
                                                    </div>
                                                </th>
                                                <th
                                                    className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200 sticky left-[90px] bg-gray-50 z-20 w-[130px] min-w-[130px] cursor-pointer hover:bg-gray-100"
                                                    onClick={() => handleSort('rollNumber')}
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    Roll No {sortConfig.key === 'rollNumber' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                </th>
                                                <th
                                                    className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200 sticky left-[220px] bg-gray-50 z-20 w-[260px] min-w-[260px] cursor-pointer hover:bg-gray-100"
                                                    onClick={() => handleSort('name')}
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                </th>
                                                <th
                                                    className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200 relative group"
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    <div className="flex items-center cursor-pointer hover:text-gray-900" onClick={() => handleSort('branch')}>
                                                        Branch {sortConfig.key === 'branch' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        <button onClick={(e) => { e.stopPropagation(); handleFilterClick('branch'); }} className="ml-1 focus:outline-none">
                                                            <FilterIcon active={!!filters.branch} />
                                                        </button>
                                                    </div>
                                                    {/* Dynamic Branch Filter Dropdown */}
                                                    {activeFilter === 'branch' && (
                                                        <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-2 max-h-60 overflow-y-auto">
                                                            <div className="space-y-0.5">
                                                                <button
                                                                    onClick={() => { setFilters({ ...filters, branch: '' }); setActiveFilter(null); }}
                                                                    className={`block w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 ${!filters.branch ? 'font-bold text-blue-600' : 'text-gray-700'}`}
                                                                >
                                                                    All Branches
                                                                </button>
                                                                {availableBranches.map(branch => (
                                                                    <button
                                                                        key={branch}
                                                                        onClick={() => { setFilters({ ...filters, branch }); setActiveFilter(null); }}
                                                                        className={`block w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 ${filters.branch === branch ? 'font-bold text-blue-600' : 'text-gray-700'}`}
                                                                    >
                                                                        {branch}
                                                                    </button>
                                                                ))}
                                                                {availableBranches.length === 0 && (
                                                                    <div className="px-2 py-1.5 text-xs text-gray-400 italic">No available branches</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200 hidden lg:table-cell min-w-[120px]" rowSpan={viewMode === 'detailed' ? 2 : 1}>Username</th>
                                                <th
                                                    className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100 min-w-[180px]"
                                                    onClick={() => handleSort('alphaCoins')}
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    <div>Alpha Coins</div>
                                                    <div className="text-[10px] font-normal text-gray-400 mt-1 normal-case leading-tight">
                                                        (Easy*20 + Med*50 + Hard*100 + Contests)
                                                    </div>
                                                </th>

                                                {/* Detailed Columns */}
                                                {viewMode === 'detailed' ? (
                                                    <>
                                                        {/* HackerRank - Single Column even in Detailed */}
                                                        <th
                                                            className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase bg-gray-50 cursor-pointer hover:bg-gray-100 border-r border-gray-200 min-w-[120px]"
                                                            rowSpan={2}
                                                            onClick={() => handleSort('externalScores.hackerrank')}
                                                        >
                                                            <div>HackerRank</div>
                                                            <div className="text-[10px] font-normal text-gray-500 mt-1 normal-case">(DS+Algo)</div>
                                                        </th>

                                                        {/* LeetCode */}
                                                        <th
                                                            className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase bg-yellow-50 cursor-pointer hover:bg-yellow-100 border-r border-yellow-100"
                                                            colSpan="4"
                                                            onClick={() => handleSort('externalScores.leetcode')}
                                                        >
                                                            LeetCode (LC)
                                                        </th>

                                                        {/* InterviewBit */}
                                                        <th
                                                            className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase bg-blue-50 cursor-pointer hover:bg-blue-100 border-r border-blue-100"
                                                            colSpan="3"
                                                            onClick={() => handleSort('externalScores.interviewbit')}
                                                        >
                                                            InterviewBit (IB)
                                                        </th>

                                                        {/* CodeChef */}
                                                        <th
                                                            className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase bg-orange-50 cursor-pointer hover:bg-orange-100 border-r border-orange-100"
                                                            colSpan="4"
                                                            onClick={() => handleSort('externalScores.codechef')}
                                                        >
                                                            CodeChef (CC)
                                                        </th>

                                                        {/* Codeforces */}
                                                        <th
                                                            className="px-2 py-2 text-center text-xs font-bold text-gray-700 uppercase bg-red-50 cursor-pointer hover:bg-red-100 border-r border-red-100"
                                                            colSpan="4"
                                                            onClick={() => handleSort('externalScores.codeforces')}
                                                        >
                                                            Codeforces (CF)
                                                        </th>
                                                    </>
                                                ) : (
                                                    // Summary Platform Columns - Full Names as requested
                                                    <>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer border-r border-gray-200 hover:bg-gray-100 min-w-[120px] whitespace-nowrap" onClick={() => handleSort('externalScores.hackerrank')}>
                                                            <div>HackerRank</div>
                                                            <div className="text-[10px] font-normal text-gray-400 mt-1 normal-case leading-tight text-wrap max-w-[120px] mx-auto">(DS+Algo)</div>
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer border-r border-gray-200 hover:bg-gray-100 min-w-[180px] whitespace-nowrap" onClick={() => handleSort('externalScores.leetcode')}>
                                                            <div>LeetCode</div>
                                                            <div className="text-[10px] font-normal text-gray-400 mt-1 normal-case leading-tight text-wrap max-w-[170px] mx-auto">(LCPS*10 + (LCR-1300)²/10 + LCNC*50)</div>
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer border-r border-gray-200 hover:bg-gray-100 min-w-[120px] whitespace-nowrap" onClick={() => handleSort('externalScores.interviewbit')}>
                                                            <div>InterviewBit</div>
                                                            <div className="text-[10px] font-normal text-gray-400 mt-1 normal-case leading-tight text-wrap max-w-[110px] mx-auto">(Score / 5)</div>
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer border-r border-gray-200 hover:bg-gray-100 min-w-[180px] whitespace-nowrap" onClick={() => handleSort('externalScores.codechef')}>
                                                            <div>CodeChef</div>
                                                            <div className="text-[10px] font-normal text-gray-400 mt-1 normal-case leading-tight text-wrap max-w-[170px] mx-auto">(CCPS*2 + (CCR-1200)²/10 + CCNC*50)</div>
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider cursor-pointer border-r border-gray-200 hover:bg-gray-100 min-w-[180px] whitespace-nowrap" onClick={() => handleSort('externalScores.codeforces')}>
                                                            <div>Codeforces</div>
                                                            <div className="text-[10px] font-normal text-gray-400 mt-1 normal-case leading-tight text-wrap max-w-[170px] mx-auto">(CFPS*2 + (CFR-800)²/10 + CFNC*50)</div>
                                                        </th>
                                                    </>
                                                )}

                                                {/* Internal Contests –" styled like SmartInterviews reference */}
                                                {internalContestsMeta.map((contest, idx) => {
                                                    const date = contest.startTime
                                                        ? new Date(contest.startTime).toLocaleDateString('en-IN', {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })
                                                        : '';
                                                    return (
                                                        <th
                                                            key={contest.id}
                                                            className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap border-l border-gray-100 border-r border-gray-200 cursor-pointer hover:bg-indigo-50 min-w-[160px]"
                                                            onClick={() => handleSort(`internalContests.${contest.id}`)}
                                                            rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                        >
                                                            <div className="flex flex-col gap-0.5">
                                                                {/* Contest link row */}
                                                                <div className="flex items-center gap-1">
                                                                    <a
                                                                        href={`/contests/${contest.id}/leaderboard`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="text-indigo-600 font-semibold hover:underline text-xs flex items-center gap-0.5"
                                                                        title={contest.title}
                                                                    >
                                                                        Contest-{idx + 1}
                                                                        <svg className="w-3 h-3 inline opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                        </svg>
                                                                    </a>
                                                                </div>
                                                                {/* Max score */}
                                                                <span className="text-[10px] font-bold text-emerald-600 normal-case">
                                                                    (Max: {contest.maxScore || 0})
                                                                </span>
                                                                {/* Date */}
                                                                {date && (
                                                                    <span className="text-[10px] text-gray-400 normal-case font-normal">
                                                                        ({date})
                                                                    </span>
                                                                )}
                                                                {/* Sort indicator */}
                                                                {sortConfig.key === `internalContests.${contest.id}` && (
                                                                    <span className="text-[9px] text-indigo-500">{sortConfig.direction === 'asc' ? '²' : ''}</span>
                                                                )}
                                                            </div>
                                                        </th>
                                                    );
                                                })}

                                                <th
                                                    className="px-4 py-3 text-center text-xs font-bold text-gray-900 uppercase tracking-wider border-l-2 border-gray-200 bg-gray-50 sticky right-0 z-20 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:bg-gray-100 min-w-[100px]"
                                                    onClick={() => handleSort('overallScore')}
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    <div className="flex flex-col items-center" title="Calculated based on weighted performance across all platforms">
                                                        <span>Overall</span>
                                                        <span>Score</span>
                                                    </div>
                                                </th>
                                            </tr>

                                            {/* Sub-headers for Detailed View */}
                                            {viewMode === 'detailed' && (
                                                <tr className="bg-gray-50/50 text-[10px] text-gray-600 border-b border-gray-200">
                                                    {/* No static columns here as they are rowSpanned */}

                                                    {/* LC Sub-cols */}
                                                    <th className="px-1 py-1 text-center border-l border-gray-100 bg-yellow-50/30">Problems</th>
                                                    <th className="px-1 py-1 text-center bg-yellow-50/30">Rating</th>
                                                    <th className="px-1 py-1 text-center bg-yellow-50/30">Contests</th>
                                                    <th className="px-1 py-1 text-center font-bold bg-yellow-100 border-r border-gray-200 min-w-[200px]">
                                                        <div>Total</div>
                                                        <div className="text-[9px] font-normal text-gray-500 mt-0.5 normal-case leading-tight">
                                                            (LCPS*10 + (LCR-1300)²/10 + LCNC*50)
                                                        </div>
                                                    </th>

                                                    {/* IB Sub-cols */}
                                                    <th className="px-1 py-1 text-center border-l border-gray-100 bg-blue-50/30">Problems</th>
                                                    <th className="px-1 py-1 text-center bg-blue-50/30">Score</th>
                                                    <th className="px-1 py-1 text-center font-bold bg-blue-100 border-r border-gray-200 min-w-[100px]">
                                                        <div>Total</div>
                                                        <div className="text-[9px] font-normal text-gray-500 mt-0.5 normal-case leading-tight">
                                                            (Score / 5)
                                                        </div>
                                                    </th>

                                                    {/* CC Sub-cols */}
                                                    <th className="px-1 py-1 text-center border-l border-gray-100 bg-orange-50/30">Problems</th>
                                                    <th className="px-1 py-1 text-center bg-orange-50/30">Rating</th>
                                                    <th className="px-1 py-1 text-center bg-orange-50/30">Contests</th>
                                                    <th className="px-1 py-1 text-center font-bold bg-orange-100 border-r border-gray-200 min-w-[200px]">
                                                        <div>Total</div>
                                                        <div className="text-[9px] font-normal text-gray-500 mt-0.5 normal-case leading-tight">
                                                            (CCPS*2 + (CCR-1200)²/10 + CCNC*50)
                                                        </div>
                                                    </th>

                                                    {/* CF Sub-cols */}
                                                    <th className="px-1 py-1 text-center border-l border-gray-100 bg-red-50/30">Problems</th>
                                                    <th className="px-1 py-1 text-center bg-red-50/30">Rating</th>
                                                    <th className="px-1 py-1 text-center bg-red-50/30">Contests</th>
                                                    <th className="px-1 py-1 text-center font-bold bg-red-100 border-r border-gray-200 min-w-[200px]">
                                                        <div>Total</div>
                                                        <div className="text-[9px] font-normal text-gray-500 mt-0.5 normal-case leading-tight">
                                                            (CFPS*2 + (CFR-800)²/10 + CFNC*50)
                                                        </div>
                                                    </th>
                                                </tr>
                                            )}
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredPracticeLeaderboard.map((entry, index) => {
                                                const actualUserId = user?._id || user?.id || tokenUserId || localUserData?._id || localUserData?.id;
                                                const actualRoll = user?.education?.rollNumber || localUserData?.education?.rollNumber;
                                                const actualUsername = user?.username || localUserData?.username;

                                                const isCurrentUser = Boolean(
                                                    (entry.studentId && actualUserId && String(entry.studentId) === String(actualUserId)) ||
                                                    (actualRoll && entry.rollNumber && entry.rollNumber !== 'N/A' && String(entry.rollNumber).toLowerCase() === String(actualRoll).toLowerCase()) ||
                                                    (actualUsername && entry.username && entry.username !== 'N/A' && String(entry.username).toLowerCase() === String(actualUsername).toLowerCase())
                                                );

                                                return (
                                                    <tr
                                                        key={`${entry.studentId || entry.rollNumber}-${index}`}
                                                        className={`group transition-colors ${isCurrentUser
                                                            ? 'bg-purple-100'
                                                            : 'hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <td className={`px-4 py-3 whitespace-nowrap font-bold sticky left-0 z-10 text-center border-b border-gray-100 border-r border-gray-200 w-[90px] min-w-[90px] ${isCurrentUser ? 'bg-purple-100' : 'bg-white group-hover:bg-gray-50'
                                                            }`}>
                                                            <div className="flex flex-col items-center justify-center mx-auto rounded-full font-bold text-sm">
                                                                <div>
                                                                    {entry.rank === 1 ? (
                                                                        <span className="text-2xl">🥇</span>
                                                                    ) : entry.rank === 2 ? (
                                                                        <span className="text-2xl">🥈</span>
                                                                    ) : entry.rank === 3 ? (
                                                                        <span className="text-2xl">🥉</span>
                                                                    ) : (
                                                                        <span className="text-gray-500">{entry.rank}</span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-gray-400 font-normal leading-none mt-1 whitespace-nowrap">({entry.globalRank || '-'})</span>
                                                            </div>
                                                        </td>
                                                        <td className={`px-4 py-3 whitespace-nowrap sticky left-[90px] z-10 border-b border-gray-100 border-r border-gray-200 w-[130px] min-w-[130px] ${isCurrentUser ? 'bg-purple-100' : 'bg-white group-hover:bg-gray-50'
                                                            }`}>
                                                            {entry.rollNumber}
                                                        </td>
                                                        <td className={`px-4 py-3 whitespace-nowrap font-medium sticky left-[220px] z-10 border-b border-gray-100 border-r border-gray-200 w-[260px] min-w-[260px] truncate ${isCurrentUser ? 'bg-purple-100' : 'bg-white group-hover:bg-gray-50'
                                                            }`} title={entry.name}>
                                                            {entry.name}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-b border-gray-100 border-r border-gray-200">
                                                            {entry.branch}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-b border-gray-100 border-r border-gray-200 hidden lg:table-cell">
                                                            {entry.username && entry.username !== 'N/A' ? (
                                                                <a href={`/profile/${entry.username}`} target="_blank" rel="noreferrer" className="text-blue-600 font-medium hover:text-blue-800 hover:underline transition-colors flex items-center gap-1">
                                                                    {entry.username}
                                                                </a>
                                                            ) : (
                                                                <span className="text-gray-400">N/A</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-600 border-r border-gray-200 border-b border-gray-100 text-center">
                                                            {entry.alphaCoins || 0}
                                                        </td>


                                                        {viewMode === 'detailed' ? (
                                                            <>
                                                                {/* HR - Single Column */}
                                                                <td className="px-2 py-2 text-center border-r border-gray-200 border-b border-gray-100 font-medium bg-gray-50 text-gray-700">
                                                                    {entry.externalScores?.hackerrank || 0}
                                                                </td>

                                                                {/* LC */}
                                                                <td className="px-1 py-1 text-center border-l border-gray-200 border-b border-gray-100 bg-yellow-50/30 text-xs">{entry.detailedStats?.leetcode?.problemsSolved || 0}</td>
                                                                <td className="px-1 py-1 text-center border-b border-gray-100 bg-yellow-50/30 text-xs">{entry.detailedStats?.leetcode?.rating || 0}</td>
                                                                <td className="px-1 py-1 text-center border-b border-gray-100 bg-yellow-50/30 text-xs">{entry.detailedStats?.leetcode?.totalContests || 0}</td>
                                                                <td className="px-1 py-1 text-center font-medium bg-yellow-50 text-yellow-800 border-r border-gray-200 border-b border-gray-100">
                                                                    {entry.externalScores?.leetcode || 0}
                                                                </td>

                                                                {/* IB */}
                                                                <td className="px-1 py-1 text-center border-l border-gray-200 border-b border-gray-100 bg-blue-50/30 text-xs">{entry.detailedStats?.interviewbit?.problemsSolved || 0}</td>
                                                                <td className="px-1 py-1 text-center border-b border-gray-100 bg-blue-50/30 text-xs">{entry.detailedStats?.interviewbit?.rating || 0}</td>
                                                                <td className="px-1 py-1 text-center font-medium bg-blue-50 text-blue-800 border-r border-gray-200 border-b border-gray-100">
                                                                    {entry.externalScores?.interviewbit || 0}
                                                                </td>

                                                                {/* CC */}
                                                                <td className="px-1 py-1 text-center border-l border-gray-200 border-b border-gray-100 bg-orange-50/30 text-xs">{entry.detailedStats?.codechef?.problemsSolved || 0}</td>
                                                                <td className="px-1 py-1 text-center border-b border-gray-100 bg-orange-50/30 text-xs">{entry.detailedStats?.codechef?.rating || 0}</td>
                                                                <td className="px-1 py-1 text-center border-b border-gray-100 bg-orange-50/30 text-xs">{entry.detailedStats?.codechef?.totalContests || 0}</td>
                                                                <td className="px-1 py-1 text-center font-medium bg-orange-50 text-orange-800 border-r border-gray-200 border-b border-gray-100">
                                                                    {entry.externalScores?.codechef || 0}
                                                                </td>

                                                                {/* CF */}
                                                                <td className="px-1 py-1 text-center border-l border-gray-200 border-b border-gray-100 bg-red-50/30 text-xs">{entry.detailedStats?.codeforces?.problemsSolved || 0}</td>
                                                                <td className="px-1 py-1 text-center border-b border-gray-100 bg-red-50/30 text-xs">{entry.detailedStats?.codeforces?.rating || 0}</td>
                                                                <td className="px-1 py-1 text-center border-b border-gray-100 bg-red-50/30 text-xs">{entry.detailedStats?.codeforces?.totalContests || 0}</td>
                                                                <td className="px-1 py-1 text-center font-medium bg-red-50 text-red-800 border-r border-gray-200 border-b border-gray-100">
                                                                    {entry.externalScores?.codeforces || 0}
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className="px-2 py-1.5 whitespace-nowrap text-center text-gray-700 border-b border-gray-100 border-r border-gray-200">{entry.externalScores?.hackerrank || 0}</td>
                                                                <td className="px-2 py-1.5 whitespace-nowrap text-center text-gray-700 border-b border-gray-100 border-r border-gray-200">{entry.externalScores?.leetcode || 0}</td>
                                                                <td className="px-2 py-1.5 whitespace-nowrap text-center text-gray-700 border-b border-gray-100 border-r border-gray-200">{entry.externalScores?.interviewbit || 0}</td>
                                                                <td className="px-2 py-1.5 whitespace-nowrap text-center text-gray-700 border-b border-gray-100 border-r border-gray-200">{entry.externalScores?.codechef || 0}</td>
                                                                <td className="px-2 py-1.5 whitespace-nowrap text-center text-gray-700 border-b border-gray-100 border-r border-gray-200">{entry.externalScores?.codeforces || 0}</td>
                                                            </>
                                                        )}

                                                        {/* Internal Contests */}
                                                        {internalContestsMeta.map(contest => {
                                                            const score = entry.internalContests?.[contest.id];
                                                            const participated = score !== undefined;
                                                            return (
                                                                <td key={contest.id} className="px-3 py-2 whitespace-nowrap text-center text-gray-600 border-l border-gray-100 border-r border-gray-200 border-b border-gray-100">
                                                                    {participated ? (
                                                                        <span className={`font-semibold ${score > 0 ? 'text-indigo-700' : 'text-gray-400'}`}>
                                                                            {score}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-300 text-xs">—</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}


                                                        <td className={`px-2 py-1.5 whitespace-nowrap font-bold text-lg text-primary-600 border-l-2 border-gray-200 sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center border-b border-gray-100 ${isCurrentUser ? 'bg-purple-100' : 'bg-gray-50'
                                                            }`}>
                                                            {entry.overallScore}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div >
                )
                }

                {/* External Contest Leaderboard */}
                {
                    activeTab === 'external' && (
                        <div className="space-y-6">
                            {externalLoading ? (
                                <div className="card">
                                    <LoadingSpinner />
                                    <p className="text-center text-gray-600 mt-4">Loading all external contest data...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="card">
                                        <div className="flex justify-between items-center mb-4">
                                            <h2 className="text-xl font-semibold text-gray-900">
                                                Filter External Contests (Client-Side)
                                            </h2>
                                            <button
                                                onClick={handleRefreshExternal}
                                                className="btn-secondary flex items-center space-x-2"
                                                disabled={externalLoading}
                                            >
                                                <svg className={`w-4 h-4 ${externalLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                <span>Refresh</span>
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                                                <CustomDropdown
                                                    options={PLATFORMS}
                                                    value={selectedPlatform}
                                                    onChange={(val) => handlePlatformChange(val)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Contest</label>
                                                <CustomDropdown
                                                    options={
                                                        availableContests.length === 0
                                                            ? [{ value: '', label: 'No contests available' }]
                                                            : availableContests.map((contest) => ({
                                                                value: contest.contestName,
                                                                label: `${contest.contestName} (${contest.participants} participants)`
                                                            }))
                                                    }
                                                    value={selectedContest || ''}
                                                    onChange={(val) => setSelectedContest(val)}
                                                    disabled={availableContests.length === 0}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="card">
                                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                            {selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} - {selectedContest || 'Select Contest'}
                                        </h2>
                                        {externalLeaderboard.length === 0 ? (
                                            <div className="text-center py-12">
                                                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <p className="text-gray-600 text-lg font-medium">No contest data available</p>
                                                <p className="text-gray-500 text-sm mt-2">No students have participated in contests on this platform yet.</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Global Rank</th>
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Roll Number</th>
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                                                            {/* <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Section</th> */}
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Problems Solved</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {externalLeaderboard.map((entry, index) => (
                                                            <tr key={`${entry.rollNumber}-${index}`}>
                                                                <td className="px-3 py-2 whitespace-nowrap font-bold">
                                                                    <div className="flex flex-col items-center justify-center font-bold text-sm w-full">
                                                                        <div>
                                                                            {entry.rank === 1 ? (
                                                                                <span className="text-2xl">🥇</span>
                                                                            ) : entry.rank === 2 ? (
                                                                                <span className="text-2xl">🥈</span>
                                                                            ) : entry.rank === 3 ? (
                                                                                <span className="text-2xl">🥉</span>
                                                                            ) : (
                                                                                <span className="text-gray-500">#{entry.rank}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{entry.globalRank}</td>
                                                                <td className="px-3 py-2 whitespace-nowrap">{entry.rollNumber}</td>
                                                                <td className="px-3 py-2 whitespace-nowrap font-medium">{entry.username}</td>
                                                                <td className="px-3 py-2 whitespace-nowrap">{entry.branch}</td>
                                                                {/* <td className="px-3 py-2 whitespace-nowrap">{entry.section}</td> */}
                                                                <td className="px-3 py-2 whitespace-nowrap">{entry.rating}</td>
                                                                <td className="px-3 py-2 whitespace-nowrap">{entry.problemsSolved}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )
                }

                {/* Internal Contest Leaderboard - Same as before with better empty state */}
                {
                    activeTab === 'internal' && (
                        <div className="space-y-6">
                            {!contestId && (
                                <div className="card">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Internal Contest</h2>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Contest</label>
                                    <CustomDropdown
                                        options={
                                            internalContests.length === 0
                                                ? [{ value: '', label: 'No contests available' }]
                                                : [
                                                    { value: '', label: 'Select a contest' },
                                                    ...internalContests.map((contest) => ({
                                                        value: contest._id,
                                                        label: `${contest.title} - ${new Date(contest.startTime).toLocaleDateString()}`
                                                    }))
                                                ]
                                        }
                                        value={selectedInternalContest || ''}
                                        onChange={(val) => setSelectedInternalContest(val)}
                                        disabled={internalContests.length === 0}
                                    />
                                </div>
                            )}

                            {contestInfo && !internalLoading && (
                                <div className="card bg-blue-50 border-l-4 border-blue-600">
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">{contestInfo.title}</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-700">
                                        <div>
                                            <span className="font-medium">Problems:</span> {contestInfo.totalProblems}
                                        </div>
                                        <div>
                                            <span className="font-medium">Proctoring:</span>{' '}
                                            {contestInfo.proctoringEnabled ? '🔒 Enabled' : 'Disabled'}
                                        </div>
                                        <div>
                                            <span className="font-medium">Start:</span>{' '}
                                            {new Date(contestInfo.startTime).toLocaleString('en-US', {
                                                month: 'short', day: 'numeric', year: 'numeric',
                                                hour: 'numeric', minute: '2-digit', hour12: true
                                            })}
                                        </div>
                                        <div>
                                            <span className="font-medium">End:</span>{' '}
                                            {new Date(contestInfo.endTime).toLocaleString('en-US', {
                                                month: 'short', day: 'numeric', year: 'numeric',
                                                hour: 'numeric', minute: '2-digit', hour12: true
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="card">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-semibold text-gray-900">
                                        Contest Leaderboard {!internalLoading && rawInternalData.length > 0 && `(${rawInternalData.length} participants)`}
                                    </h2>
                                    {!internalLoading && selectedInternalContest && (
                                        <div className="flex gap-4 items-center">
                                            <button
                                                onClick={downloadInternalCSV}
                                                className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium transition-colors"
                                            >
                                                Download Report
                                            </button>
                                            {contestInfo && new Date() <= new Date(contestInfo.endTime) ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-lg border border-green-100">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                        <span className="text-sm text-green-700 font-bold">{liveParticipants}</span>
                                                        <span className="text-xs text-green-600 font-medium">Live</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-400 font-medium">
                                                    ✓ Contest Ended
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {internalLoading ? (
                                    <LoadingSpinner />
                                ) : rawInternalData.length === 0 ? (
                                    <div className="text-center py-12">
                                        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        <p className="text-gray-600 text-lg font-medium">Be the first to submit!</p>
                                    </div>
                                ) : (
                                    <div>
                                        {/* Pagination Controls */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 px-1">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <span>Show:</span>
                                                {[20, 50, 100, 200, 500].map(size => (
                                                    <button
                                                        key={size}
                                                        onClick={() => { setInternalPageSize(size); setInternalPage(1); }}
                                                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${internalPageSize === size
                                                            ? 'bg-blue-600 text-white border-blue-600'
                                                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                                                            }`}
                                                    >
                                                        {size}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <button
                                                    onClick={() => setInternalPage(p => Math.max(1, p - 1))}
                                                    disabled={internalPage === 1}
                                                    className="px-3 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                                                >
                                                    ← Prev
                                                </button>
                                                <span className="font-medium">
                                                    Page {internalPage} / {internalTotalPages}
                                                    <span className="ml-2 text-gray-400 font-normal text-xs">({sortedInternalData.length} total)</span>
                                                </span>
                                                <button
                                                    onClick={() => setInternalPage(p => Math.min(internalTotalPages, p + 1))}
                                                    disabled={internalPage === internalTotalPages}
                                                    className="px-3 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                                                >
                                                    Next →
                                                </button>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto pb-4">
                                            <table className="min-w-max w-full divide-y divide-gray-200 border-collapse">
                                                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                                    <tr>
                                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 sticky left-0 bg-gray-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[60px]" onClick={() => handleInternalSort('rank')}>
                                                            Rank {internalSortConfig.key === 'rank' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 sticky left-[60px] bg-gray-50 z-20 border-r border-gray-200 min-w-[110px]" onClick={() => handleInternalSort('rollNumber')}>
                                                            Roll No {internalSortConfig.key === 'rollNumber' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 sticky left-[170px] bg-gray-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-gray-200 min-w-[140px]" onClick={() => handleInternalSort('username')}>
                                                            Username {internalSortConfig.key === 'username' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 min-w-[120px]" onClick={() => handleInternalSort('fullName')}>
                                                            Full Name {internalSortConfig.key === 'fullName' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100" onClick={() => handleInternalSort('branch')}>
                                                            Branch {internalSortConfig.key === 'branch' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>

                                                        {/* Dynamic Problem Columns: problem title as header */}
                                                        {contestInfo?.problems?.map((prob, i) => (
                                                            <th key={prob._id} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap min-w-[160px] border-l border-gray-200">
                                                                P{i + 1}: {prob.title}
                                                            </th>
                                                        ))}

                                                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap" onClick={() => handleInternalSort('time')}>
                                                            Time (min) {internalSortConfig.key === 'time' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap" onClick={() => handleInternalSort('problemsSolved')}>
                                                            Solved {internalSortConfig.key === 'problemsSolved' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Tab Switches</th>
                                                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">FS Exits</th>
                                                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Violations</th>
                                                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                                                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 sticky right-0 bg-gray-50 z-20 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[70px]" onClick={() => handleInternalSort('score')}>
                                                            Score {internalSortConfig.key === 'score' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {paginatedInternalData.map((entry, index) => {
                                                        const actualUserId = user?._id || user?.id || tokenUserId || localUserData?._id || localUserData?.id;
                                                        const actualRoll = user?.education?.rollNumber || localUserData?.education?.rollNumber;
                                                        const actualUsername = user?.username || localUserData?.username;

                                                        const isCurrentUser = Boolean(
                                                            (entry.studentId && actualUserId && String(entry.studentId) === String(actualUserId)) ||
                                                            (actualRoll && entry.rollNumber && entry.rollNumber !== 'N/A' && String(entry.rollNumber).toLowerCase() === String(actualRoll).toLowerCase()) ||
                                                            (actualUsername && entry.username && entry.username !== 'N/A' && String(entry.username).toLowerCase() === String(actualUsername).toLowerCase())
                                                        );
                                                        return (
                                                            <tr
                                                                key={`${entry.studentId || entry.rollNumber}-${index}`}
                                                                className={`hover:bg-gray-50 transition-colors ${isCurrentUser
                                                                    ? 'bg-purple-100'
                                                                    : 'bg-white'
                                                                    }`}
                                                            >
                                                                <td className="px-3 py-3 whitespace-nowrap sticky left-0 bg-inherit z-10 border-r border-gray-100">
                                                                    <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm mx-auto">
                                                                        {entry.rank === 1 ? (
                                                                            <span className="text-2xl">🥇</span>
                                                                        ) : entry.rank === 2 ? (
                                                                            <span className="text-2xl">🥈</span>
                                                                        ) : entry.rank === 3 ? (
                                                                            <span className="text-2xl">🥉</span>
                                                                        ) : (
                                                                            <span className="text-gray-500">#{entry.rank}</span>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                {/* Roll No - sticky */}
                                                                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700 font-mono sticky left-[60px] bg-inherit z-10 border-r border-gray-100">{entry.rollNumber}</td>
                                                                {/* Username Column */}
                                                                <td className="px-3 py-3 text-sm text-gray-900 font-semibold max-w-[140px] min-w-[140px] truncate sticky left-[170px] bg-inherit z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]" title={(entry.isSpotUser || entry.username?.startsWith('spot_')) ? '' : (entry.username !== 'N/A' && entry.username ? entry.username : entry.fullName)}>
                                                                    {(entry.isSpotUser || entry.username?.startsWith('spot_')) ? (
                                                                        <span className="text-gray-400 font-medium">-</span>
                                                                    ) : entry.username !== 'N/A' && entry.username ? (
                                                                        <a href={`/profile/${entry.username}`} target="_blank" rel="noreferrer" className="text-blue-600 font-medium hover:text-blue-800 hover:underline transition-colors flex items-center gap-1">
                                                                            {entry.username}
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-gray-500 italic">No Username</span>
                                                                    )}
                                                                </td>
                                                                {/* Full Name */}
                                                                <td className="px-3 py-3 text-sm text-gray-500 max-w-[120px] truncate" title={entry.fullName}>{entry.fullName}</td>
                                                                {/* Branch */}
                                                                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{entry.branch}</td>

                                                                {/* Per-Problem Cells: status badge + tries + submission time */}
                                                                {contestInfo?.problems?.map(prob => {
                                                                    const pData = entry.problems?.[prob._id];
                                                                    const status = pData?.status || 'Not Attempted';
                                                                    const rawTime = pData?.submittedAt;
                                                                    let formattedSubTime = null;
                                                                    if (rawTime !== undefined && rawTime !== null) {
                                                                        if (rawTime < 60) {
                                                                            formattedSubTime = `${rawTime}m`;
                                                                        } else {
                                                                            const h = Math.floor(rawTime / 60);
                                                                            const m = rawTime % 60;
                                                                            formattedSubTime = `${h}:${m.toString().padStart(2, '0')}h`;
                                                                        }
                                                                    }

                                                                    let bgClass = 'bg-gray-50 border-gray-200';
                                                                    let textClass = 'text-gray-400';
                                                                    let statusText = 'Not Tried';
                                                                    let statusIcon = '—';

                                                                    if (status === 'Accepted') {
                                                                        bgClass = 'bg-green-50 border-green-200';
                                                                        textClass = 'text-green-700';
                                                                        statusText = 'Accepted';
                                                                        statusIcon = '✓';
                                                                    } else if (status === 'Wrong Answer') {
                                                                        bgClass = 'bg-red-50 border-red-200';
                                                                        textClass = 'text-red-600';
                                                                        statusText = 'Wrong Ans';
                                                                        statusIcon = '✗';
                                                                    }

                                                                    return (
                                                                        <td key={prob._id} className="px-2 py-2 text-center border-l border-gray-100 min-w-[160px]">
                                                                            <div className={`rounded border inline-flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[130px] ${bgClass}`}>
                                                                                <span className={`text-xs font-bold ${textClass}`}>
                                                                                    {statusIcon} {statusText}
                                                                                </span>
                                                                                {(pData?.tries > 0 || formattedSubTime) && (
                                                                                    <span className="text-[11px] text-gray-500 font-medium">
                                                                                        {pData.tries > 0 ? `${pData.tries} ${pData.tries === 1 ? 'try' : 'tries'}` : ''}
                                                                                        {pData.tries > 0 && formattedSubTime ? ` · ${formattedSubTime}` : formattedSubTime}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                })}

                                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-600 font-mono">
                                                                    {entry.time < 60 ? `${entry.time}m` : `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}h`}
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-nowrap text-center">
                                                                    <span className="inline-block bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold border border-indigo-100">
                                                                        {entry.problemsSolved}/{contestInfo?.totalProblems || contestInfo?.problems?.length || 0}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                                                    <span className={entry.tabSwitchCount > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                                                                        {entry.tabSwitchCount || 0}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                                                    <span className={entry.fullscreenExits > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                                                                        {entry.fullscreenExits || 0}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                                                    {(() => {
                                                                        const total = (entry.tabSwitchCount || 0) + (entry.fullscreenExits || 0);
                                                                        return (
                                                                            <span className={`px-2 py-1 rounded-full text-xs font-bold inline-block ${total === 0 ? 'bg-green-100 text-green-800'
                                                                                : total < 3 ? 'bg-yellow-100 text-yellow-800'
                                                                                    : 'bg-red-100 text-red-800'
                                                                                }`}>
                                                                                {total}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                </td>
                                                                <td className="px-3 py-2 whitespace-nowrap text-sm text-center">
                                                                    {entry.isCompleted ? (
                                                                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium border border-green-200 inline-block">
                                                                            Finished
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium border border-yellow-200 inline-block">
                                                                            In Progress
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-3 whitespace-nowrap text-center sticky right-0 bg-inherit z-10 border-l border-gray-100 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                                    <span className="font-bold text-lg text-blue-600">{entry.score}</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
    );
};

export default Leaderboard;
