import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import leaderboardService from '../../services/leaderboardService';
import contestService from '../../services/contestService';
import toast from 'react-hot-toast';
import { Calendar, Zap, Trophy, Link as LinkIcon } from 'lucide-react';
import CustomDropdown from '../shared/CustomDropdown';
import { useTheme } from '../../contexts/ThemeContext';

const PLATFORMS = [
    { value: 'leetcode', label: 'LeetCode' },
    { value: 'codechef', label: 'CodeChef' },
    { value: 'codeforces', label: 'Codeforces' }
];

const formatTime = (mins) => {
    if (mins === null || mins === undefined) return 'N/A';
    const totalSeconds = Math.round(mins * 60);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.round(totalSeconds % 60);
    return h > 0
        ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const Leaderboard = ({ batchId, isBatchView }) => {
    const { contestId, batchName: urlBatchId } = useParams();
    const [searchParams] = useSearchParams();
    const viewType = searchParams.get('type');
    const { user } = useAuth();
    const { isDark } = useTheme();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
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

    // Redirect unlocked students back to the contest interface.
    // When a student's contest is auto-submitted, they land on /contests/:id/leaderboard.
    // If an admin later unlocks them, refreshing should take them back to the contest.
    useEffect(() => {
        if (!contestId || !user || user.role !== 'student') return;
        let cancelled = false;
        (async () => {
            try {
                const data = await contestService.getContestById(contestId);
                if (cancelled) return;
                const contest = data.contest;
                if (!contest) return;
                const now = new Date();
                const isActive = now >= new Date(contest.startTime) && now <= new Date(contest.endTime);
                // If contest is active and student is NOT submitted (unlocked), redirect to contest
                if (isActive && !contest.isSubmitted) {
                    // Clear proctoring localStorage so violations start fresh after unlock
                    const userId = user?.userId || user?.id || user?._id;
                    if (userId) {
                        try { localStorage.removeItem(`proctoring_${contestId}_${userId}`); } catch { }
                    }
                    navigate(`/contests/${contestId}`, { replace: true });
                }
            } catch (e) {
                // Silently ignore — they stay on the leaderboard
            }
        })();
        return () => { cancelled = true; };
    }, [contestId, user, navigate]);

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

    // Filter state
    const [activeFilter, setActiveFilter] = useState(null); // 'branch' | 'section' | 'timeline'
    const [searchQuery, setSearchQuery] = useState('');

    // Sorting state
    const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });
    const [internalSortConfig, setInternalSortConfig] = useState({ key: 'score', direction: 'desc' });
    const [internalPageSize, setInternalPageSize] = useState(50);
    const [internalPage, setInternalPage] = useState(1);

    // Unlock contest state — tracks per-student loading to handle concurrent unlocks
    const [unlockingStudents, setUnlockingStudents] = useState(new Set());

    const isContestStillActive = contestInfo && new Date() <= new Date(contestInfo.endTime) && new Date() >= new Date(contestInfo.startTime);
    const canUnlockUsers = (user?.role === 'admin' || user?.role === 'instructor') && isContestStillActive;

    const handleUnlockUser = async (studentId, studentName) => {
        if (!selectedInternalContest || !studentId) return;
        const confirmed = window.confirm(`Are you sure you want to unlock the contest for ${studentName || 'this student'}?\n\nThis will allow them to continue their test from where they left off.`);
        if (!confirmed) return;

        setUnlockingStudents(prev => new Set(prev).add(studentId));
        try {
            await contestService.unlockContestForUser(selectedInternalContest, studentId);
            toast.success(`Contest unlocked for ${studentName || 'student'}`);
            // Refresh the leaderboard to reflect updated status
            fetchInternalContestLeaderboard(true);
        } catch (error) {
            toast.error(error.message || 'Failed to unlock contest');
        } finally {
            setUnlockingStudents(prev => {
                const next = new Set(prev);
                next.delete(studentId);
                return next;
            });
        }
    };

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
        // Only fetch contests separately if the practice leaderboard didn't populate them
        // (i.e. it failed, or the user navigated directly to the internal tab).
        // In normal flow, fetchPracticeLeaderboard() already fills internalContests
        // from data.contests, avoiding a redundant GET /api/contest/batch call.
        if (targetBatchId && practiceDataLoaded && internalContests.length === 0) {
            fetchInternalContests();
        }
    }, [targetBatchId, practiceDataLoaded, internalContests.length]);

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
    }, [selectedInternalContest, internalPage, internalPageSize]);

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
                    } else if (data.type === 'leaderboardRefetch') {
                        // TanStack Query handles the jitter + background refetch.
                        // invalidateContestLeaderboard marks the query stale so the
                        // next useQuery subscriber refetches it automatically in the BG.
                        const jitter = Math.floor(Math.random() * 3000);
                        setTimeout(() => {
                            leaderboardService.invalidateContestLeaderboard(selectedInternalContest);
                            // Also trigger a direct fetch to update local rawInternalData state
                            fetchInternalContestLeaderboard(true);
                        }, jitter);
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
            const contestsMeta = data.contests || [];
            setInternalContestsMeta(contestsMeta);

            // Populate internalContests from the leaderboard response so we avoid
            // a redundant GET /api/contest/batch/{batchId} call on every page load.
            // The leaderboard response uses `id` (not `_id`), so normalise to `_id`
            // so the dropdown at line 1507 (which uses contest._id) works correctly.
            if (contestsMeta.length > 0) {
                const normalised = contestsMeta.map(c => ({
                    ...c,
                    _id: c._id || c.id  // handle both shapes
                }));
                setInternalContests(normalised);
                if (!contestId && !selectedInternalContest) {
                    const firstId = normalised[0]._id?.toString();
                    if (firstId) setSelectedInternalContest(firstId);
                }
            }


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

    const [internalTotalPagesState, setInternalTotalPagesState] = useState(1);
    const [internalTotalCount, setInternalTotalCount] = useState(0);

    const fetchInternalContestLeaderboard = async (isBackground = false) => {
        if (!isBackground) setInternalLoading(true);
        try {
            const data = await leaderboardService.getInternalContestLeaderboard(
                selectedInternalContest, internalPage, internalPageSize
            );
            setRawInternalData(data.leaderboard || []);
            setContestInfo(data.contest || null);
            setInternalTotalPagesState(data.totalPages || 1);
            setInternalTotalCount(data.total || 0);
        } catch (error) {
            if (!isBackground) {
                toast.error('Failed to fetch internal contest leaderboard');
                setRawInternalData([]);
                setInternalTotalPagesState(1);
                setInternalTotalCount(0);
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
            const contests = data.contests || [];
            setInternalContests(contests);
            setInternalContestsMeta(contests.map(c => ({
                id: c._id,
                title: c.title,
                startTime: c.startTime,
                endTime: c.endTime,
                maxScore: 0
            })));
            if (contests.length > 0) {
                if (!contestId && !selectedInternalContest) {
                    setSelectedInternalContest(contests[0]._id);
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
        <svg className={`w-4 h-4 ml-1 cursor-pointer ${active ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
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

    // Reset to page 1 when contest changes
    useEffect(() => { setInternalPage(1); }, [selectedInternalContest]);

    const internalTotalPages = Math.max(1, internalTotalPagesState);
    const paginatedInternalData = sortedInternalData;

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

        // Format raw minutes into '01:20:25' or '36:58'
        const formatCSVTime = (mins) => {
            const time = formatTime(mins);
            return time === 'N/A' ? '' : time;
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400"></div>
        </div>
    );

    if (initialLoading) {
        return (
            <div className="flex justify-center items-center h-screen bg-[#F7F5FF] dark:bg-[#111117] transition-colors">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 dark:border-primary-400 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading leaderboard data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F7F5FF] dark:bg-[#111117] pb-12 transition-colors">

            {/* Fixed Dropdown Portal –" renders outside sticky header stacking context */}
            {isBatchView && showOptions && (
                <div
                    ref={optionsRef}
                    className="fixed w-64 bg-white/95 dark:bg-[#1a1a24]/95 backdrop-blur-xl rounded-2xl border border-gray-100 dark:border-gray-700/50 overflow-hidden z-[9999]"
                    style={{
                        top: dropdownPos.top,
                        right: dropdownPos.right,
                    }}
                >
                    {/* Header */}
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Options</p>
                    </div>

                    {/* Timeline Filters */}
                    {/* <div className="px-3 py-3 border-b border-gray-100">
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
                                    className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${filters.timeline === t ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#23232e]'}`}
                                >
                                    <span>{label}</span>
                                    {filters.timeline === t && (
                                        <svg className="w-4 h-4 ml-auto text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div> */}

                    {/* View Mode Toggle */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-800">Detailed View</p>
                                <p className="text-xs text-gray-400 mt-0.5">Show platform breakdowns</p>
                            </div>
                            <button
                                onClick={() => setViewMode(viewMode === 'summary' ? 'detailed' : 'summary')}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${viewMode === 'detailed' ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
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
                <div className="bg-white/95 dark:bg-[#111117] backdrop-blur-md border-b border-gray-100 dark:border-gray-700 shadow-sm sticky top-0 z-30 transition-colors">
                    <div className="w-full mx-auto px-6 h-16 flex items-center justify-between relative">
                        {/* Left: Logo */}
                        <div className="flex items-center gap-2">
                            <img
                                src="/alphalogo.png"
                                alt="AlphaLearn"
                                className="h-6 w-auto object-contain"
                            />
                            <span className="text-lg font-bold text-gray-800 dark:text-white tracking-tight">AlphaLearn</span>
                        </div>

                        {/* Center: Batch Name + current filter indicator */}
                        <div className="absolute left-1/2 transform -translate-x-1/2 text-center hidden md:block">
                            <div className="text-base font-semibold text-gray-800 dark:text-gray-100">
                                {batchName || user?.education?.batch || 'Batch Leaderboard'}
                            </div>
                            {/* {filters.timeline && (
                                <div className="text-[10px] text-primary-500 dark:text-primary-400 font-medium mt-0.5 uppercase tracking-wider">
                                    {filters.timeline === 'month' ? 'This Month' : 'This Week'}
                                </div>
                            )} */}
                        </div>

                        {/* Right: Options Kebab */}
                        <div>
                            <button
                                ref={kebabBtnRef}
                                onClick={handleToggleOptions}
                                className={`p-1.5 rounded-full transition-colors focus:outline-none ${showOptions ? 'bg-gray-100 dark:bg-[#111117] text-gray-700 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#23232e]'}`}
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
                                {/* <div className="bg-white dark:bg-[#111117] p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center transition-colors">
                                    <button
                                        onClick={() => setFilters({ ...filters, timeline: '' })}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${!filters.timeline ? 'bg-white dark:bg-[#23232e] text-indigo-600 dark:text-indigo-300 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600' : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-gray-50 dark:hover:bg-[#23232e]'}`}
                                    >
                                        All Time
                                    </button>
                                    <button
                                        onClick={() => setFilters({ ...filters, timeline: 'month' })}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filters.timeline === 'month' ? 'bg-white dark:bg-[#23232e] text-indigo-600 dark:text-indigo-300 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600' : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-gray-50 dark:hover:bg-[#23232e]'}`}
                                    >
                                        This Month
                                    </button>
                                    <button
                                        onClick={() => setFilters({ ...filters, timeline: 'week' })}
                                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filters.timeline === 'week' ? 'bg-white dark:bg-[#23232e] text-indigo-600 dark:text-indigo-300 shadow-sm ring-1 ring-gray-200 dark:ring-gray-600' : 'text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-gray-50 dark:hover:bg-[#23232e]'}`}
                                    >
                                        This Week
                                    </button>
                                </div> */}

                                {/* View Mode Toggle & Refresh */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setViewMode(viewMode === 'summary' ? 'detailed' : 'summary')}
                                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all ${viewMode === 'detailed' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-primary-200 dark:border-primary-900/50' : 'bg-white dark:bg-[#111117] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#23232e]'}`}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l4 4a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>{viewMode === 'summary' ? 'Detailed View' : 'Summary View'}</span>
                                    </button>

                                    <button
                                        onClick={handleRefreshPractice}
                                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111117] transition-all"
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

                        {/* Search Input Filter - Simplified as per user request */}
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="relative w-full sm:w-80 group">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg className="w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-[#111117] text-gray-900 dark:text-gray-100 text-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all shadow-sm"
                                    placeholder="Search student..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {(searchQuery || filters.branch || filters.section) && (
                                <button
                                    onClick={handleResetFilters}
                                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors whitespace-nowrap"
                                >
                                    Clear Filters
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
                                    <table className="min-w-full text-sm border-separate border-spacing-0">
                                        <thead className="bg-gray-50 dark:bg-[#111117] transition-colors sticky top-0 z-[100]">
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                                <th
                                                    className="px-4 py-3 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-white dark:bg-[#111117] z-[120] w-[90px] min-w-[90px] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#23232e]"
                                                    onClick={() => handleSort('rank')}
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="flex items-center gap-1">
                                                            Rank {sortConfig.key === 'rank' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal normal-case">(Global)</span>
                                                    </div>
                                                </th>
                                                <th
                                                    className="px-4 py-3 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 static md:sticky md:left-[90px] bg-white dark:bg-[#111117] z-[120] w-[130px] min-w-[130px] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#23232e]"
                                                    onClick={() => handleSort('rollNumber')}
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    Roll No {sortConfig.key === 'rollNumber' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                </th>
                                                <th
                                                    className="px-4 py-3 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 static md:sticky md:left-[220px] bg-white dark:bg-[#111117] z-[120] w-[260px] min-w-[260px] cursor-pointer hover:bg-gray-50 dark:hover:bg-[#23232e]"
                                                    onClick={() => handleSort('name')}
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                </th>
                                                <th
                                                    className="px-4 py-3 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 relative group transition-colors"
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    <div className="flex items-center cursor-pointer hover:text-gray-900 dark:hover:text-gray-200" onClick={() => handleSort('branch')}>
                                                        Branch {sortConfig.key === 'branch' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        <button onClick={(e) => { e.stopPropagation(); handleFilterClick('branch'); }} className="ml-1 focus:outline-none">
                                                            <FilterIcon active={!!filters.branch} />
                                                        </button>
                                                    </div>
                                                    {/* Dynamic Branch Filter Dropdown */}
                                                    {activeFilter === 'branch' && (
                                                        <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#111117] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 p-2 max-h-60 overflow-y-auto transition-colors">
                                                            <div className="space-y-0.5">
                                                                <button
                                                                    onClick={() => { setFilters({ ...filters, branch: '' }); setActiveFilter(null); }}
                                                                    className={`block w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${!filters.branch ? 'font-bold text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}
                                                                >
                                                                    All Branches
                                                                </button>
                                                                {availableBranches.map(branch => (
                                                                    <button
                                                                        key={branch}
                                                                        onClick={() => { setFilters({ ...filters, branch }); setActiveFilter(null); }}
                                                                        className={`block w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${filters.branch === branch ? 'font-bold text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}
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
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 hidden lg:table-cell min-w-[120px]" rowSpan={viewMode === 'detailed' ? 2 : 1}>Username</th>
                                                <th
                                                    className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider border-r border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#23232e] min-w-[180px]"
                                                    onClick={() => handleSort('alphaCoins')}
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    <div>Alpha Coins</div>
                                                    <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-1 normal-case leading-tight">
                                                        (Easy*20 + Med*50 + Hard*100 + Contests)
                                                    </div>
                                                </th>

                                                {/* Detailed Columns */}
                                                {viewMode === 'detailed' ? (
                                                    <>
                                                        {/* HackerRank - Single Column even in Detailed */}
                                                        <th
                                                            className="px-4 py-3 text-center text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase bg-[#f0fdf4] dark:bg-[#061a11] cursor-pointer hover:bg-emerald-100 dark:hover:bg-[#082217] border-r border-emerald-200 dark:border-gray-700 min-w-[120px]"
                                                            rowSpan={2}
                                                            onClick={() => handleSort('externalScores.hackerrank')}
                                                        >
                                                            <div>HackerRank</div>
                                                            <div className="text-[10px] font-normal text-emerald-600 dark:text-emerald-500/70 mt-1 normal-case">(DS+Algo)</div>
                                                        </th>

                                                        {/* LeetCode */}
                                                        <th
                                                            className="px-2 py-2 text-center text-xs font-bold text-amber-800 dark:text-amber-400 uppercase bg-[#fffbeb] dark:bg-[#1a1205] cursor-pointer hover:bg-amber-100 dark:hover:bg-[#251b08] border-r border-amber-200 dark:border-gray-700"
                                                            colSpan="4"
                                                            onClick={() => handleSort('externalScores.leetcode')}
                                                        >
                                                            LeetCode (LC)
                                                        </th>

                                                        {/* InterviewBit */}
                                                        <th
                                                            className="px-2 py-2 text-center text-xs font-bold text-blue-800 dark:text-sky-400 uppercase bg-[#f0f9ff] dark:bg-[#05121a] cursor-pointer hover:bg-blue-100 dark:hover:bg-[#081b25] border-r border-blue-200 dark:border-gray-700"
                                                            colSpan="3"
                                                            onClick={() => handleSort('externalScores.interviewbit')}
                                                        >
                                                            InterviewBit (IB)
                                                        </th>

                                                        {/* CodeChef */}
                                                        <th
                                                            className="px-2 py-2 text-center text-xs font-bold text-orange-800 dark:text-orange-400 uppercase bg-[#fff7ed] dark:bg-[#1a0f05] cursor-pointer hover:bg-orange-100 dark:hover:bg-[#251608] border-r border-orange-200 dark:border-gray-700"
                                                            colSpan="4"
                                                            onClick={() => handleSort('externalScores.codechef')}
                                                        >
                                                            CodeChef (CC)
                                                        </th>

                                                        {/* Codeforces */}
                                                        <th
                                                            className="px-2 py-2 text-center text-xs font-bold text-rose-800 dark:text-rose-400 uppercase bg-[#fff1f2] dark:bg-[#1a0508] cursor-pointer hover:bg-rose-100 dark:hover:bg-[#25080c] border-r border-rose-200 dark:border-gray-700"
                                                            colSpan="4"
                                                            onClick={() => handleSort('externalScores.codeforces')}
                                                        >
                                                            Codeforces (CF)
                                                        </th>
                                                    </>
                                                ) : (
                                                    // Summary Platform Columns - Full Names as requested
                                                    <>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider cursor-pointer border-r border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#23232e] min-w-[120px] whitespace-nowrap transition-colors" onClick={() => handleSort('externalScores.hackerrank')}>
                                                            <div>HackerRank</div>
                                                            <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-1 normal-case leading-tight text-wrap max-w-[120px] mx-auto">(DS+Algo)</div>
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider cursor-pointer border-r border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#23232e] min-w-[180px] whitespace-nowrap transition-colors" onClick={() => handleSort('externalScores.leetcode')}>
                                                            <div>LeetCode</div>
                                                            <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-1 normal-case leading-tight text-wrap max-w-[170px] mx-auto">(LCPS*10 + (LCR-1300)²/10 + LCNC*50)</div>
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider cursor-pointer border-r border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#23232e] min-w-[120px] whitespace-nowrap transition-colors" onClick={() => handleSort('externalScores.interviewbit')}>
                                                            <div>InterviewBit</div>
                                                            <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-1 normal-case leading-tight text-wrap max-w-[110px] mx-auto">(Score / 5)</div>
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider cursor-pointer border-r border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#23232e] min-w-[180px] whitespace-nowrap transition-colors" onClick={() => handleSort('externalScores.codechef')}>
                                                            <div>CodeChef</div>
                                                            <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-1 normal-case leading-tight text-wrap max-w-[170px] mx-auto">(CCPS*2 + (CCR-1200)²/10 + CCNC*50)</div>
                                                        </th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider cursor-pointer border-r border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#23232e] min-w-[180px] whitespace-nowrap transition-colors" onClick={() => handleSort('externalScores.codeforces')}>
                                                            <div>Codeforces</div>
                                                            <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-1 normal-case leading-tight text-wrap max-w-[170px] mx-auto">(CFPS*2 + (CFR-800)²/10 + CFNC*50)</div>
                                                        </th>
                                                    </>
                                                )}

                                                {/* Internal Contests –" styled like reference */}
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
                                                            className="px-3 py-2 text-left text-xs font-bold text-gray-900 dark:text-white uppercase whitespace-nowrap border-l border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-750 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 min-w-[160px] transition-colors"
                                                            onClick={() => handleSort(`internalContests.${contest.id}`)}
                                                            rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                        >
                                                            <div className="flex flex-col gap-0.5">
                                                                {/* Contest link row */}
                                                                <div className="flex items-center gap-1">
                                                                    <a
                                                                        href={`/contests/${contest.slug || contest.id}/leaderboard`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="text-primary-600 dark:text-primary-400 font-semibold hover:underline text-xs flex items-center gap-0.5"
                                                                        title={contest.title}
                                                                    >
                                                                        Contest-{idx + 1}
                                                                        <svg className="w-3 h-3 inline opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                        </svg>
                                                                    </a>
                                                                </div>
                                                                {/* Max score */}
                                                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 normal-case">
                                                                    (Max: {contest.maxScore || 0})
                                                                </span>
                                                                {/* Date */}
                                                                {date && (
                                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 normal-case font-normal">
                                                                        ({date})
                                                                    </span>
                                                                )}
                                                                {/* Sort indicator */}
                                                                {sortConfig.key === `internalContests.${contest.id}` && (
                                                                    <span className="text-[9px] text-primary-500">{sortConfig.direction === 'asc' ? '²' : ''}</span>
                                                                )}
                                                            </div>
                                                        </th>
                                                    );
                                                })}

                                                <th
                                                    className="px-4 py-3 text-center text-xs font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider border-l-2 border-gray-200 dark:border-indigo-900/50 bg-[#f8faff] dark:bg-[#111117] sticky right-0 z-[120] cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/40 min-w-[100px] transition-colors"
                                                    onClick={() => handleSort('overallScore')}
                                                    rowSpan={viewMode === 'detailed' ? 2 : 1}
                                                >
                                                    Total Score
                                                </th>
                                            </tr>

                                            {/* Sub-headers for Detailed View */}
                                            {viewMode === 'detailed' && (
                                                <tr className="bg-gray-50/50 dark:bg-[#0c1118] text-[10px] text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                                    {/* No static columns here as they are rowSpanned */}

                                                    {/* LC Sub-cols */}
                                                    <th className="px-1 py-1 text-center bg-[#fffbeb] dark:bg-[#151208] text-amber-800 dark:text-amber-500/80 border-r border-amber-100 dark:border-amber-900/20">Problems</th>
                                                    <th className="px-1 py-1 text-center bg-[#fffbeb] dark:bg-[#151208] text-amber-800 dark:text-amber-500/80 border-r border-amber-100 dark:border-amber-900/20">Rating</th>
                                                    <th className="px-1 py-1 text-center bg-[#fffbeb] dark:bg-[#151208] text-amber-800 dark:text-amber-500/80 border-r border-amber-100 dark:border-amber-900/20">Contests</th>
                                                    <th className="px-1 py-1 text-center font-bold bg-[#fef3c7] dark:bg-[#1a1205] text-amber-900 dark:text-amber-400 min-w-[200px]">
                                                        <div>Total</div>
                                                        <div className="text-[9px] font-normal text-amber-700/70 dark:text-amber-500/50 mt-0.5 normal-case leading-tight">
                                                            (LCPS*10 + (LCR-1300)²/10 + LCNC*50)
                                                        </div>
                                                    </th>

                                                    {/* IB Sub-cols */}
                                                    <th className="px-1 py-1 text-center bg-[#f0f9ff] dark:bg-[#0a1420] text-blue-800 dark:text-sky-500/80 border-r border-blue-100 dark:border-blue-900/20">Problems</th>
                                                    <th className="px-1 py-1 text-center bg-[#f0f9ff] dark:bg-[#0a1420] text-blue-800 dark:text-sky-500/80 border-r border-blue-100 dark:border-blue-900/20">Score</th>
                                                    <th className="px-1 py-1 text-center font-bold bg-[#e0f2fe] dark:bg-[#05121a] text-blue-900 dark:text-sky-400 min-w-[100px]">
                                                        <div>Total</div>
                                                        <div className="text-[9px] font-normal text-blue-700/70 dark:text-sky-500/50 mt-0.5 normal-case leading-tight">
                                                            (Score / 5)
                                                        </div>
                                                    </th>

                                                    {/* CC Sub-cols */}
                                                    <th className="px-1 py-1 text-center bg-[#fff7ed] dark:bg-[#150e08] text-orange-800 dark:text-orange-500/80 border-r border-orange-100 dark:border-orange-900/20">Problems</th>
                                                    <th className="px-1 py-1 text-center bg-[#fff7ed] dark:bg-[#150e08] text-orange-800 dark:text-orange-500/80 border-r border-orange-100 dark:border-orange-900/20">Rating</th>
                                                    <th className="px-1 py-1 text-center bg-[#fff7ed] dark:bg-[#150e08] text-orange-800 dark:text-orange-500/80 border-r border-orange-100 dark:border-orange-900/20">Contests</th>
                                                    <th className="px-1 py-1 text-center font-bold bg-[#ffedd5] dark:bg-[#1a0f05] text-orange-900 dark:text-orange-400 min-w-[200px]">
                                                        <div>Total</div>
                                                        <div className="text-[9px] font-normal text-orange-700/70 dark:text-orange-500/50 mt-0.5 normal-case leading-tight">
                                                            (CCPS*2 + (CCR-1200)²/10 + CCNC*50)
                                                        </div>
                                                    </th>

                                                    {/* CF Sub-cols */}
                                                    <th className="px-1 py-1 text-center bg-[#fff1f2] dark:bg-[#160a0e] text-rose-800 dark:text-rose-500/80 border-r border-rose-100 dark:border-rose-900/20">Problems</th>
                                                    <th className="px-1 py-1 text-center bg-[#fff1f2] dark:bg-[#160a0e] text-rose-800 dark:text-rose-500/80 border-r border-rose-100 dark:border-rose-900/20">Rating</th>
                                                    <th className="px-1 py-1 text-center bg-[#fff1f2] dark:bg-[#160a0e] text-rose-800 dark:text-rose-500/80 border-r border-rose-100 dark:border-rose-900/20">Contests</th>
                                                    <th className="px-1 py-1 text-center font-bold bg-[#ffe4e6] dark:bg-[#1a0508] text-rose-900 dark:text-rose-400 min-w-[200px]">
                                                        <div>Total</div>
                                                        <div className="text-[9px] font-normal text-rose-700/70 dark:text-rose-500/50 mt-0.5 normal-case leading-tight">
                                                            (CFPS*2 + (CFR-800)²/10 + CFNC*50)
                                                        </div>
                                                    </th>
                                                </tr>
                                            )}
                                        </thead>
                                        <tbody className="bg-white dark:bg-[#111117]">
                                            {filteredPracticeLeaderboard.map((entry, index) => {
                                                const actualUserId = user?._id || user?.id || tokenUserId || localUserData?._id || localUserData?.id;

                                                const isCurrentUser = Boolean(entry.studentId && actualUserId && String(entry.studentId) === String(actualUserId));

                                                // Inline style for current user bg — guarantees opaque background on sticky cells in dark mode
                                                // Tailwind's JIT scanner can miss dark:bg-[...] inside conditional ternaries
                                                const currentUserBg = isCurrentUser ? (isDark ? { backgroundColor: '#1e1b4b' } : { backgroundColor: '#ede9fe' }) : undefined;
                                                const currentUserBgLight = isCurrentUser ? (isDark ? { backgroundColor: '#1e1b4b' } : { backgroundColor: '#ede9fe' }) : undefined;

                                                return (
                                                    <tr
                                                        key={`${entry.studentId || entry.rollNumber}-${index}`}
                                                        style={currentUserBg}
                                                        className={`group transition-colors ${isCurrentUser
                                                            ? ''
                                                            : 'bg-white dark:bg-[#111117] hover:bg-gray-50 dark:hover:bg-[#23232e]'
                                                            }`}
                                                    >
                                                        <td
                                                            style={currentUserBg}
                                                            className={`px-4 py-3 whitespace-nowrap font-bold sticky left-0 z-40 text-center border-b border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 w-[90px] min-w-[90px] ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117] group-hover:bg-gray-50 dark:group-hover:bg-[#23232e]'}`}
                                                        >
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
                                                        <td
                                                            style={currentUserBg}
                                                            className={`px-4 py-3 whitespace-nowrap static md:sticky md:left-[90px] z-40 border-b border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 w-[130px] min-w-[130px] ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117] group-hover:bg-gray-50 dark:group-hover:bg-[#23232e]'}`}
                                                        >
                                                            <span className="text-gray-900 dark:text-gray-100">{entry.rollNumber}</span>
                                                        </td>
                                                        <td
                                                            style={currentUserBg}
                                                            className={`px-4 py-3 whitespace-nowrap font-bold static md:sticky md:left-[220px] z-40 border-b border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 w-[260px] min-w-[260px] truncate ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117] group-hover:bg-gray-50 dark:group-hover:bg-[#23232e]'}`}
                                                            title={entry.name}
                                                        >
                                                            {entry.socialProfiles?.linkedin ? (
                                                                <a
                                                                    href={entry.socialProfiles.linkedin.startsWith('http') ? entry.socialProfiles.linkedin : `https://www.linkedin.com/in/${entry.socialProfiles.linkedin}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline transition-colors w-fit"
                                                                >
                                                                    {entry.name}
                                                                </a>
                                                            ) : (
                                                                <span className="text-gray-900 dark:text-gray-100">{entry.name}</span>
                                                            )}
                                                        </td>
                                                        <td style={currentUserBg} className={`px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117]'}`}>
                                                            {entry.branch}
                                                        </td>
                                                        <td style={currentUserBg} className={`px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 hidden lg:table-cell ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117]'}`}>
                                                            {entry.username && entry.username !== 'N/A' ? (
                                                                <a href={`/profile/${entry.username}`} target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 font-medium hover:text-purple-800 dark:hover:text-purple-300 hover:underline transition-colors flex items-center gap-1">
                                                                    {entry.username}
                                                                </a>
                                                            ) : (
                                                                <span className="text-gray-400 dark:text-gray-500">N/A</span>
                                                            )}
                                                        </td>
                                                        <td style={currentUserBg} className={`px-4 py-3 whitespace-nowrap font-medium text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 border-b border-gray-100 dark:border-gray-700 text-center ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117]'}`}>
                                                            {entry.alphaCoins || 0}
                                                        </td>


                                                        {viewMode === 'detailed' ? (
                                                            <>
                                                                {/* HR - Single Column */}
                                                                <td style={currentUserBgLight} className={`px-2 py-2 text-center border-r border-gray-200 dark:border-gray-700 border-b border-gray-100 dark:border-gray-700 font-medium text-emerald-800 dark:text-emerald-400 ${isCurrentUser ? '' : 'bg-emerald-50/30 dark:bg-[#061a11]/40'}`}>
                                                                    {entry.externalScores?.hackerrank || 0}
                                                                </td>

                                                                {/* LC */}
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center border-b border-gray-100 dark:border-gray-700 text-xs dark:text-gray-300 ${isCurrentUser ? '' : 'bg-amber-50/20 dark:bg-[#1a1205]/30'}`}>{entry.detailedStats?.leetcode?.problemsSolved || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center border-b border-gray-100 dark:border-gray-700 text-xs dark:text-gray-300 ${isCurrentUser ? '' : 'bg-amber-50/20 dark:bg-[#1a1205]/30'}`}>{entry.detailedStats?.leetcode?.rating || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center border-b border-gray-100 dark:border-gray-700 text-xs dark:text-gray-300 ${isCurrentUser ? '' : 'bg-amber-50/20 dark:bg-[#1a1205]/30'}`}>{entry.detailedStats?.leetcode?.totalContests || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center font-bold text-amber-800 dark:text-amber-400 border-b border-gray-100 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-amber-50/50 dark:bg-[#1a1205]/60'}`}>
                                                                    {entry.externalScores?.leetcode || 0}
                                                                </td>

                                                                {/* IB */}
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center border-b border-gray-100 dark:border-gray-700 text-xs dark:text-gray-300 ${isCurrentUser ? '' : 'bg-blue-50/20 dark:bg-[#05121a]/30'}`}>{entry.detailedStats?.interviewbit?.problemsSolved || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center border-b border-gray-100 dark:border-gray-700 text-xs dark:text-gray-300 ${isCurrentUser ? '' : 'bg-blue-50/20 dark:bg-[#05121a]/30'}`}>{entry.detailedStats?.interviewbit?.rating || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center font-bold text-blue-800 dark:text-sky-400 border-b border-gray-100 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-blue-50/50 dark:bg-[#05121a]/60'}`}>
                                                                    {entry.externalScores?.interviewbit || 0}
                                                                </td>

                                                                {/* CC */}
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center border-b border-gray-100 dark:border-gray-700 text-xs dark:text-gray-300 ${isCurrentUser ? '' : 'bg-orange-50/20 dark:bg-[#1a0f05]/30'}`}>{entry.detailedStats?.codechef?.problemsSolved || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center border-b border-gray-100 dark:border-gray-700 text-xs dark:text-gray-300 ${isCurrentUser ? '' : 'bg-orange-50/20 dark:bg-[#1a0f05]/30'}`}>{entry.detailedStats?.codechef?.rating || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center border-b border-gray-100 dark:border-gray-700 text-xs dark:text-gray-300 ${isCurrentUser ? '' : 'bg-orange-50/20 dark:bg-[#1a0f05]/30'}`}>{entry.detailedStats?.codechef?.totalContests || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center font-bold text-orange-800 dark:text-orange-400 border-b border-gray-100 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-orange-50/50 dark:bg-[#1a0f05]/60'}`}>
                                                                    {entry.externalScores?.codechef || 0}
                                                                </td>

                                                                {/* CF */}
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center border-b border-gray-100 dark:border-gray-700 text-xs dark:text-gray-300 ${isCurrentUser ? '' : 'bg-rose-50/20 dark:bg-[#1a0508]/30'}`}>{entry.detailedStats?.codeforces?.problemsSolved || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center border-b border-gray-100 dark:border-gray-700 text-xs dark:text-gray-300 ${isCurrentUser ? '' : 'bg-rose-50/20 dark:bg-[#1a0508]/30'}`}>{entry.detailedStats?.codeforces?.rating || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center border-b border-gray-100 dark:border-gray-700 text-xs dark:text-gray-300 ${isCurrentUser ? '' : 'bg-rose-50/20 dark:bg-[#1a0508]/30'}`}>{entry.detailedStats?.codeforces?.totalContests || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-1 py-1 text-center font-bold text-rose-800 dark:text-rose-400 border-b border-gray-100 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-rose-50/50 dark:bg-[#1a0508]/60'}`}>
                                                                    {entry.externalScores?.codeforces || 0}
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td style={currentUserBgLight} className={`px-2 py-1.5 whitespace-nowrap text-center text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117]'}`}>{entry.externalScores?.hackerrank || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-2 py-1.5 whitespace-nowrap text-center text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117]'}`}>{entry.externalScores?.leetcode || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-2 py-1.5 whitespace-nowrap text-center text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117]'}`}>{entry.externalScores?.interviewbit || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-2 py-1.5 whitespace-nowrap text-center text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117]'}`}>{entry.externalScores?.codechef || 0}</td>
                                                                <td style={currentUserBgLight} className={`px-2 py-1.5 whitespace-nowrap text-center text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117]'}`}>{entry.externalScores?.codeforces || 0}</td>
                                                            </>
                                                        )}

                                                        {/* Internal Contests */}
                                                        {internalContestsMeta.map(contest => {
                                                            const score = entry.internalContests?.[contest.id];
                                                            const participated = score !== undefined;
                                                            return (
                                                                <td key={contest.id} style={currentUserBgLight} className={`px-3 py-2 whitespace-nowrap text-center text-gray-600 dark:text-gray-400 border-l border-gray-100 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 border-b border-gray-100 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-white dark:bg-[#111117]'}`}>
                                                                    {participated ? (
                                                                        <span className={`font-semibold ${score > 0 ? 'text-primary-700 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                                                            {score}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}


                                                        <td
                                                            style={currentUserBg}
                                                            className={`px-2 py-1.5 whitespace-nowrap font-extrabold text-lg text-indigo-700 dark:text-indigo-300 border-l-2 border-gray-200 dark:border-indigo-900/40 sticky right-0 z-40 text-center border-b border-gray-100 dark:border-gray-700 ${isCurrentUser ? '' : 'bg-[#f8faff] dark:bg-[#111117]'}`}
                                                        >
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
                                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
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
                                        <div className="grid grid-cols-2 gap-4 relative z-[150]">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Platform</label>
                                                <CustomDropdown
                                                    options={PLATFORMS}
                                                    value={selectedPlatform}
                                                    onChange={(val) => handlePlatformChange(val)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contest</label>
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
                                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
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
                                                    <thead className="bg-gray-50 dark:bg-[#111117] transition-colors border-b border-gray-200 dark:border-gray-800 sticky top-0 z-[100]">
                                                        <tr>
                                                            <th className="px-4 py-4 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight sticky left-0 z-[110] bg-gray-50 dark:bg-[#111117] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_8px_-2px_rgba(0,0,0,0.5)] w-[80px] min-w-[80px]">Rank</th>
                                                            <th className="px-4 py-4 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight static md:sticky md:left-[80px] z-[110] bg-gray-50 dark:bg-[#111117] md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:md:shadow-[2px_0_8px_-2px_rgba(0,0,0,0.5)] w-[140px] min-w-[140px]">Roll Number</th>
                                                            <th className="px-4 py-4 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight static md:sticky md:left-[220px] z-[110] bg-gray-50 dark:bg-[#111117] md:shadow-[4px_0_10px_-4px_rgba(0,0,0,0.2)] dark:md:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.7)] w-[180px] min-w-[180px]">Username</th>
                                                            <th className="px-4 py-4 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">Branch</th>
                                                            <th className="px-4 py-4 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">Rating</th>
                                                            <th className="px-4 py-4 text-left text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight">Problems Solved</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white dark:bg-[#111117] divide-y divide-gray-200">
                                                        {externalLeaderboard.map((entry, index) => {
                                                            const actualUserId = user?._id || user?.id || tokenUserId || localUserData?._id || localUserData?.id;
                                                            const isCurrentUser = Boolean(entry.studentId && actualUserId && String(entry.studentId) === String(actualUserId));
                                                            return (
                                                                <tr key={`${entry.rollNumber}-${index}`} className={`border-b border-gray-100 dark:border-gray-700 transition-colors ${isCurrentUser ? 'bg-purple-100 dark:bg-[#1e1b4b]' : 'bg-white dark:bg-[#111117] hover:bg-gray-50 dark:hover:bg-[#23232e]'}`}>
                                                                    <td className={`px-3 py-2 whitespace-nowrap font-bold sticky left-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_8px_-2px_rgba(0,0,0,0.5)] w-[80px] min-w-[80px] ${isCurrentUser ? 'bg-purple-100 dark:bg-[#1e1b4b]' : 'bg-white dark:bg-[#111117]'}`}>
                                                                        <div className="flex flex-col items-center justify-center font-extrabold text-sm w-full">
                                                                            <div>
                                                                                {entry.rank === 1 ? (
                                                                                    <span className="text-2xl">🥇</span>
                                                                                ) : entry.rank === 2 ? (
                                                                                    <span className="text-2xl">🥈</span>
                                                                                ) : entry.rank === 3 ? (
                                                                                    <span className="text-2xl">🥉</span>
                                                                                ) : (
                                                                                    <span className="text-gray-500 dark:text-gray-400">#{entry.rank}</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className={`px-3 py-2 whitespace-nowrap text-gray-900 dark:text-gray-100 static md:sticky md:left-[80px] z-40 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:md:shadow-[2px_0_8px_-2px_rgba(0,0,0,0.5)] font-mono w-[140px] min-w-[140px] ${isCurrentUser ? 'bg-purple-100 dark:bg-[#1e1b4b]' : 'bg-white dark:bg-[#111117]'}`}>{entry.rollNumber}</td>
                                                                    <td className={`px-3 py-2 whitespace-nowrap font-bold text-gray-900 dark:text-gray-100 static md:sticky md:left-[220px] z-40 md:shadow-[4px_0_10px_-4px_rgba(0,0,0,0.2)] dark:md:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.7)] w-[180px] min-w-[180px] truncate ${isCurrentUser ? 'bg-purple-100 dark:bg-[#1e1b4b]' : 'bg-white dark:bg-[#111117]'}`}>{entry.username}</td>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{entry.branch}</td>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300 font-bold">{entry.rating}</td>
                                                                    <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-300">{entry.problemsSolved}</td>
                                                                </tr>
                                                            );
                                                        })}
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
                                <div className="card relative z-[150]">
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
                                <div className="card bg-primary-50 dark:bg-primary-900/10 border-l-4 border-primary-600 dark:border-primary-500 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{contestInfo.title}</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-700 dark:text-gray-300">
                                        <div>
                                            <span className="font-medium">Problems:</span> {contestInfo.totalProblems}
                                        </div>
                                        <div>
                                            <span className="font-medium">Proctoring:</span>{' '}
                                            {contestInfo.proctoringEnabled ? '🔒 Enabled' : 'Disabled'}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900 dark:text-gray-200">Start:</span>{' '}
                                            {new Date(contestInfo.startTime).toLocaleString('en-US', {
                                                month: 'short', day: 'numeric', year: 'numeric',
                                                hour: 'numeric', minute: '2-digit', hour12: true
                                            })}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900 dark:text-gray-200">End:</span>{' '}
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
                                                className="text-sm bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-3 py-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 font-medium transition-colors border border-primary-100 dark:border-primary-800"
                                            >
                                                Download Report
                                            </button>
                                            {contestInfo && new Date() <= new Date(contestInfo.endTime) ? (
                                                <div className="flex items-center gap-3">
                                                    {/* Live participant count removed — not reliable across multi-instance deployments
                                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-lg border border-green-100">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                        <span className="text-sm text-green-700 font-bold">{liveParticipants}</span>
                                                        <span className="text-xs text-green-600 font-medium">Live</span>
                                                    </div>
                                                    */}
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
                                                            ? 'bg-purple-600 text-white border-purple-600'
                                                            : 'bg-white dark:bg-[#111117] text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-purple-400 hover:text-purple-600'
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
                                                    className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#111117] hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-gray-700 dark:text-gray-300 transition-colors"
                                                >
                                                    ← Prev
                                                </button>
                                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                                    Page {internalPage} / {internalTotalPages}
                                                    <span className="ml-2 text-gray-400 font-normal text-xs">({sortedInternalData.length} total)</span>
                                                </span>
                                                <button
                                                    onClick={() => setInternalPage(p => Math.min(internalTotalPages, p + 1))}
                                                    disabled={internalPage === internalTotalPages}
                                                    className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#111117] hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-gray-700 dark:text-gray-300 transition-colors"
                                                >
                                                    Next →
                                                </button>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto pb-4 custom-scrollbar">
                                            <table className="min-w-max w-full border-separate border-spacing-0">
                                                <thead className="bg-[#f8fafc] dark:bg-[#111117] sticky top-0 z-10 shadow-sm transition-colors">
                                                    <tr>
                                                        <th className="px-3 py-4 text-left text-xs font-bold text-gray-900 dark:text-white uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[#23232e] sticky left-0 bg-white dark:bg-[#111117] z-[120] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_8px_-2px_rgba(0,0,0,0.5)] min-w-[60px] border-b border-gray-200 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700" onClick={() => handleInternalSort('rank')}>
                                                            Rank {internalSortConfig.key === 'rank' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                        <th className="px-3 py-4 text-left text-xs font-bold text-gray-900 dark:text-white uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[#23232e] static md:sticky md:left-[60px] bg-white dark:bg-[#111117] z-[120] border-b border-gray-200 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 min-w-[110px] md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:md:shadow-[2px_0_8px_-2px_rgba(0,0,0,0.5)]" onClick={() => handleInternalSort('rollNumber')}>
                                                            Roll No {internalSortConfig.key === 'rollNumber' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                        <th className="px-3 py-4 text-left text-xs font-bold text-gray-900 dark:text-white uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[#23232e] static md:sticky md:left-[170px] bg-white dark:bg-[#111117] z-[120] dark:md:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.7)] border-b border-gray-200 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 min-w-[140px]" onClick={() => handleInternalSort('username')}>
                                                            Username {internalSortConfig.key === 'username' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                        <th className="px-3 py-4 text-left text-xs font-bold text-gray-900 dark:text-white uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[#23232e] min-w-[120px] border-b border-gray-200 dark:border-gray-700" onClick={() => handleInternalSort('fullName')}>
                                                            Full Name {internalSortConfig.key === 'fullName' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                        <th className="px-3 py-4 text-left text-xs font-bold text-gray-900 dark:text-white uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[#23232e] border-b border-gray-200 dark:border-gray-700" onClick={() => handleInternalSort('branch')}>
                                                            Branch {internalSortConfig.key === 'branch' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>

                                                        {contestInfo?.problems?.map((prob, i) => (
                                                            <th key={prob._id} className="px-3 py-4 text-center text-xs font-bold text-gray-900 dark:text-white uppercase whitespace-nowrap min-w-[160px] border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700">
                                                                P{i + 1}: {prob.title}
                                                            </th>
                                                        ))}
                                                        <th className="px-3 py-4 text-center text-xs font-bold text-gray-900 dark:text-white uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[#23232e] whitespace-nowrap border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700" onClick={() => handleInternalSort('time')}>Time</th>
                                                        <th className="px-3 py-4 text-center text-xs font-bold text-gray-900 dark:text-white uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[#23232e] whitespace-nowrap border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700" onClick={() => handleInternalSort('problemsSolved')}>Solved</th>
                                                        <th className="px-3 py-4 text-center text-xs font-bold text-gray-900 dark:text-white uppercase whitespace-nowrap border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700">Tab Switches</th>
                                                        <th className="px-3 py-4 text-center text-xs font-bold text-gray-900 dark:text-white uppercase whitespace-nowrap border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700">FS Exits</th>
                                                        <th className="px-3 py-4 text-center text-xs font-bold text-gray-900 dark:text-white uppercase whitespace-nowrap border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700">Violations</th>
                                                        <th className="px-3 py-4 text-center text-xs font-bold text-gray-900 dark:text-white uppercase whitespace-nowrap border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700">Status</th>
                                                        <th className="px-3 py-4 text-center text-xs font-bold text-gray-900 dark:text-white uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-[#23232e] whitespace-nowrap sticky right-0 bg-white dark:bg-[#111117] z-[120] dark:shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.7)] min-w-[70px] border-b border-gray-200 dark:border-gray-700 border-l-2 border-gray-200 dark:border-gray-700" onClick={() => handleInternalSort('score')}>
                                                            Score {internalSortConfig.key === 'score' && (internalSortConfig.direction === 'asc' ? '▲' : '▼')}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-[#111117]">
                                                    {(() => {
                                                        const actualUserId = user?._id || user?.id || tokenUserId || localUserData?._id || localUserData?.id;
                                                        const currentUserEntry = sortedInternalData.find(entry => entry.studentId && actualUserId && String(entry.studentId) === String(actualUserId));
                                                        const pinnedBg = isDark ? { backgroundColor: '#1e1b4b' } : { backgroundColor: '#faf5ff' };

                                                        return (
                                                            <>
                                                                {/* Pinned Current User Row */}
                                                                {currentUserEntry && (
                                                                    <tr
                                                                        key="pinned-current-user"
                                                                        style={pinnedBg}
                                                                        className="dark:ring-2 dark:ring-purple-600 sticky top-[48px] z-40 dark:shadow-md transition-colors"
                                                                    >
                                                                        <td style={pinnedBg} className="px-3 py-4 whitespace-nowrap sticky left-0 z-40 dark:border-b dark:border-gray-700 dark:border-r dark:border-gray-700 transition-colors dark:shadow-[2px_0_8px_-2px_rgba(0,0,0,0.5)] w-[60px] min-w-[60px]">
                                                                            <div className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm mx-auto bg-purple-600 text-white shadow">
                                                                                #{currentUserEntry.rank}
                                                                            </div>
                                                                        </td>
                                                                        <td style={pinnedBg} className="px-3 py-4 whitespace-nowrap text-sm font-mono static md:sticky md:left-[60px] z-40 dark:border-b dark:border-gray-700 dark:border-r dark:border-gray-700 transition-colors dark:md:shadow-[2px_0_8px_-2px_rgba(0,0,0,0.5)] w-[110px] min-w-[110px] text-purple-900 dark:text-purple-300">{currentUserEntry.rollNumber}</td>
                                                                        <td style={pinnedBg} className="px-3 py-4 text-sm font-bold max-w-[140px] min-w-[140px] truncate static md:sticky md:left-[170px] z-40 dark:border-b dark:border-gray-700 dark:border-r dark:border-gray-700 dark:md:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.7)] transition-colors text-purple-900 dark:text-purple-200" title={(currentUserEntry.isSpotUser || currentUserEntry.username?.startsWith('spot_')) ? '' : (currentUserEntry.username !== 'N/A' && currentUserEntry.username ? currentUserEntry.username : currentUserEntry.fullName)}>
                                                                            {(currentUserEntry.isSpotUser || currentUserEntry.username?.startsWith('spot_')) ? (
                                                                                <span className="text-gray-400 font-medium">-</span>
                                                                            ) : currentUserEntry.username && currentUserEntry.username !== 'N/A' ? (
                                                                                <a href={`/profile/${currentUserEntry.username}`} target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 font-medium hover:text-purple-800 dark:hover:text-purple-300 hover:underline transition-colors flex items-center gap-1">
                                                                                    {currentUserEntry.username}
                                                                                </a>
                                                                            ) : (
                                                                                <span className="text-gray-500 italic">No Username</span>
                                                                            )} (You)
                                                                        </td>
                                                                        <td style={pinnedBg} className="px-3 py-3 text-sm max-w-[120px] truncate dark:border-b dark:border-gray-700 text-purple-900 dark:text-purple-200" title={currentUserEntry.fullName}>{currentUserEntry.fullName}</td>
                                                                        <td style={pinnedBg} className="px-3 py-3 whitespace-nowrap text-sm dark:border-b dark:border-gray-700 text-purple-900 dark:text-purple-200">{currentUserEntry.branch}</td>

                                                                        {contestInfo?.problems?.map(prob => {
                                                                            const pData = currentUserEntry.problems?.[prob._id];
                                                                            const status = pData?.status || 'Not Attempted';
                                                                            const rawTime = pData?.submittedAt;
                                                                            let formattedSubTime = (rawTime !== undefined && rawTime !== null)
                                                                                ? (() => {
                                                                                    const totalSeconds = Math.round(rawTime * 60);
                                                                                    const h = Math.floor(totalSeconds / 3600);
                                                                                    const m = Math.floor((totalSeconds % 3600) / 60);
                                                                                    const s = totalSeconds % 60;
                                                                                    return h > 0
                                                                                        ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                                                                                        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                                                                                })()
                                                                                : null;

                                                                            let bgClass = 'bg-gray-50 dark:bg-[#111117]/40 border-gray-200 dark:border-gray-700';
                                                                            let textClass = 'text-gray-400 dark:text-gray-500';
                                                                            let statusText = 'Not Tried';
                                                                            let statusIcon = '—';

                                                                            if (status === 'Accepted') {
                                                                                bgClass = 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
                                                                                textClass = 'text-green-700 dark:text-green-400';
                                                                                statusText = 'Accepted';
                                                                                statusIcon = '✓';
                                                                            } else if (status === 'Wrong Answer') {
                                                                                bgClass = 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
                                                                                textClass = 'text-red-600 dark:text-red-400';
                                                                                statusText = 'Wrong Ans';
                                                                                statusIcon = '✗';
                                                                            }

                                                                            return (
                                                                                <td key={prob._id} style={pinnedBg} className="px-2 py-2 text-center dark:border-b dark:border-gray-700 dark:border-l dark:border-gray-700 min-w-[160px]">
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

                                                                        <td style={pinnedBg} className="px-3 py-2 whitespace-nowrap text-sm text-center text-purple-900 dark:text-purple-400 font-mono dark:border-b dark:border-gray-700 dark:border-l dark:border-gray-700">
                                                                            {(() => {
                                                                                const totalSeconds = Math.round(currentUserEntry.time * 60);
                                                                                const h = Math.floor(totalSeconds / 3600);
                                                                                const m = Math.floor((totalSeconds % 3600) / 60);
                                                                                const s = totalSeconds % 60;
                                                                                return h > 0
                                                                                    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                                                                                    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                                                                            })()}
                                                                        </td>
                                                                        <td style={pinnedBg} className="px-3 py-2 whitespace-nowrap text-center dark:border-b dark:border-gray-700 dark:border-l dark:border-gray-700">
                                                                            <span className="inline-block bg-purple-200 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full text-xs font-bold border border-purple-300 dark:border-purple-700">
                                                                                {currentUserEntry.problemsSolved}/{contestInfo?.totalProblems || contestInfo?.problems?.length || 0}
                                                                            </span>
                                                                        </td>
                                                                        <td style={pinnedBg} className="px-3 py-2 whitespace-nowrap text-sm text-center dark:border-b dark:border-gray-700 dark:border-l dark:border-gray-700">
                                                                            <span className={currentUserEntry.tabSwitchCount > 0 ? 'text-red-600 font-bold' : 'text-purple-900 dark:text-purple-200'}>
                                                                                {currentUserEntry.tabSwitchCount || 0}
                                                                            </span>
                                                                        </td>
                                                                        <td style={pinnedBg} className="px-3 py-2 whitespace-nowrap text-sm text-center dark:border-b dark:border-gray-700 dark:border-l dark:border-gray-700">
                                                                            <span className={currentUserEntry.fullscreenExits > 0 ? 'text-red-600 font-bold' : 'text-purple-900 dark:text-purple-200'}>
                                                                                {currentUserEntry.fullscreenExits || 0}
                                                                            </span>
                                                                        </td>
                                                                        <td style={pinnedBg} className="px-3 py-2 whitespace-nowrap text-sm text-center dark:border-b dark:border-gray-700 dark:border-l dark:border-gray-700">
                                                                            {(() => {
                                                                                const total = (currentUserEntry.tabSwitchCount || 0) + (currentUserEntry.fullscreenExits || 0);
                                                                                return (
                                                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold inline-block border ${total === 0 ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800/50'
                                                                                        : total < 3 ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50'
                                                                                            : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/50'
                                                                                        }`}>
                                                                                        {total}
                                                                                    </span>
                                                                                );
                                                                            })()}
                                                                        </td>
                                                                        <td style={pinnedBg} className="px-3 py-2 whitespace-nowrap text-sm text-center dark:border-b dark:border-gray-700 dark:border-l dark:border-gray-700">
                                                                            <div className="flex flex-col items-center gap-1">
                                                                                {currentUserEntry.isCompleted ? (
                                                                                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium border border-green-200 dark:border-green-800/50 inline-block transition-colors">
                                                                                        Finished
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="px-2 py-1 bg-amber-500 text-black rounded-full text-xs font-black shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                                                                                        In Progress
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td style={pinnedBg} className="px-3 py-4 whitespace-nowrap text-center sticky right-0 z-[120] dark:border-l-2 dark:border-gray-700 dark:border-b dark:border-gray-700 dark:shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.6)] transition-colors">
                                                                            <span className="font-bold text-lg text-primary-600 dark:text-primary-400">{currentUserEntry.score}</span>
                                                                        </td>
                                                                    </tr>
                                                                )}

                                                                {paginatedInternalData.map((entry, index) => {
                                                                    const isCurrentUser = Boolean(entry.studentId && actualUserId && String(entry.studentId) === String(actualUserId));
                                                                    if (isCurrentUser) return null;

                                                                    return (
                                                                        <tr
                                                                            key={`${entry.studentId || entry.rollNumber}-${index}`}
                                                                            className="group transition-colors bg-white dark:bg-[#111117] hover:bg-gray-50 dark:hover:bg-[#23232e]"
                                                                        >
                                                                            <td className="px-3 py-4 whitespace-nowrap sticky left-0 z-40 border-b border-gray-200 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_8px_-2px_rgba(0,0,0,0.5)] w-[60px] min-w-[60px] bg-white dark:bg-[#111117] group-hover:bg-gray-50 dark:group-hover:bg-[#23232e]">
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
                                                                            <td className="px-3 py-4 whitespace-nowrap text-sm font-mono static md:sticky md:left-[60px] z-40 border-b border-gray-200 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 transition-colors md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] dark:md:shadow-[2px_0_8px_-2px_rgba(0,0,0,0.5)] w-[110px] min-w-[110px] bg-white dark:bg-[#111117] text-gray-700 dark:text-gray-300 group-hover:bg-gray-50 dark:group-hover:bg-[#23232e]">{entry.rollNumber}</td>
                                                                            {/* Username Column */}
                                                                            <td className="px-3 py-4 text-sm font-bold max-w-[140px] min-w-[140px] truncate static md:sticky md:left-[170px] z-40 border-b border-gray-200 dark:border-gray-700 border-r border-gray-200 dark:border-gray-700 dark:md:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.7)] transition-colors bg-white dark:bg-[#111117] group-hover:bg-gray-50 dark:group-hover:bg-[#23232e] text-gray-900 dark:text-gray-100" title={(entry.isSpotUser || entry.username?.startsWith('spot_')) ? '' : (entry.username !== 'N/A' && entry.username ? entry.username : entry.fullName)}>
                                                                                {(entry.isSpotUser || entry.username?.startsWith('spot_')) ? (
                                                                                    <span className="text-gray-400 font-medium">-</span>
                                                                                ) : entry.username && entry.username !== 'N/A' ? (
                                                                                    <a href={`/profile/${entry.username}`} target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 font-medium hover:text-purple-800 dark:hover:text-purple-300 hover:underline transition-colors flex items-center gap-1">
                                                                                        {entry.username}
                                                                                    </a>
                                                                                ) : (
                                                                                    <span className="text-gray-500 italic">No Username</span>
                                                                                )}
                                                                            </td>
                                                                            {/* Full Name */}
                                                                            <td className="px-3 py-3 text-sm max-w-[120px] truncate border-b border-gray-200 dark:border-gray-700 text-gray-500" title={entry.fullName}>{entry.fullName}</td>
                                                                            {/* Branch */}
                                                                            <td className="px-3 py-3 whitespace-nowrap text-sm border-b border-gray-200 dark:border-gray-700 text-gray-500">{entry.branch}</td>

                                                                            {/* Per-Problem Cells: status badge + tries + submission time */}
                                                                            {contestInfo?.problems?.map(prob => {
                                                                                const pData = entry.problems?.[prob._id];
                                                                                const status = pData?.status || 'Not Attempted';
                                                                                const rawTime = pData?.submittedAt;
                                                                                let formattedSubTime = (rawTime !== undefined && rawTime !== null)
                                                                                    ? (() => {
                                                                                        const totalSeconds = Math.round(rawTime * 60);
                                                                                        const h = Math.floor(totalSeconds / 3600);
                                                                                        const m = Math.floor((totalSeconds % 3600) / 60);
                                                                                        const s = totalSeconds % 60;
                                                                                        return h > 0
                                                                                            ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                                                                                            : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                                                                                    })()
                                                                                    : null;

                                                                                let bgClass = 'bg-gray-50 dark:bg-[#111117]/40 border-gray-200 dark:border-gray-700';
                                                                                let textClass = 'text-gray-400 dark:text-gray-500';
                                                                                let statusText = 'Not Tried';
                                                                                let statusIcon = '—';

                                                                                if (status === 'Accepted') {
                                                                                    bgClass = 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
                                                                                    textClass = 'text-green-700 dark:text-green-400';
                                                                                    statusText = 'Accepted';
                                                                                    statusIcon = '✓';
                                                                                } else if (status === 'Wrong Answer') {
                                                                                    bgClass = 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
                                                                                    textClass = 'text-red-600 dark:text-red-400';
                                                                                    statusText = 'Wrong Ans';
                                                                                    statusIcon = '✗';
                                                                                }

                                                                                return (
                                                                                    <td key={prob._id} className="px-2 py-2 text-center border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700 min-w-[160px]">
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

                                                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-center text-gray-600 dark:text-gray-400 font-mono border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700">
                                                                                {(() => {
                                                                                    const totalSeconds = Math.round(entry.time * 60);
                                                                                    const h = Math.floor(totalSeconds / 3600);
                                                                                    const m = Math.floor((totalSeconds % 3600) / 60);
                                                                                    const s = totalSeconds % 60;
                                                                                    return h > 0
                                                                                        ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                                                                                        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                                                                                })()}
                                                                            </td>
                                                                            <td className="px-3 py-2 whitespace-nowrap text-center border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700">
                                                                                <span className="inline-block bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded-full text-xs font-bold border border-primary-100 dark:border-primary-900/50">
                                                                                    {entry.problemsSolved}/{contestInfo?.totalProblems || contestInfo?.problems?.length || 0}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-center border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700">
                                                                                <span className={entry.tabSwitchCount > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                                                                                    {entry.tabSwitchCount || 0}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-center border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700">
                                                                                <span className={entry.fullscreenExits > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                                                                                    {entry.fullscreenExits || 0}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-center border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700">
                                                                                {(() => {
                                                                                    const total = (entry.tabSwitchCount || 0) + (entry.fullscreenExits || 0);
                                                                                    return (
                                                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold inline-block border ${total === 0 ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800/50'
                                                                                            : total < 3 ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50'
                                                                                                : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/50'
                                                                                            }`}>
                                                                                            {total}
                                                                                        </span>
                                                                                    );
                                                                                })()}
                                                                            </td>
                                                                            <td className="px-3 py-2 whitespace-nowrap text-sm text-center border-b border-gray-200 dark:border-gray-700 border-l border-gray-200 dark:border-gray-700">
                                                                                <div className="flex flex-col items-center gap-1">
                                                                                    {entry.isCompleted ? (
                                                                                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium border border-green-200 dark:border-green-800/50 inline-block transition-colors">
                                                                                            Finished
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-medium border border-yellow-200 dark:border-yellow-800/50 inline-block transition-colors">
                                                                                            In Progress
                                                                                        </span>
                                                                                    )}
                                                                                    {canUnlockUsers && entry.isCompleted && (
                                                                                        <button
                                                                                            onClick={(e) => { e.stopPropagation(); handleUnlockUser(entry.studentId, entry.fullName || entry.username); }}
                                                                                            disabled={unlockingStudents.has(String(entry.studentId))}
                                                                                            className="px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-all duration-200 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                                                            title="Unlock contest for this student to continue"
                                                                                        >
                                                                                            {unlockingStudents.has(String(entry.studentId)) ? (
                                                                                                <>
                                                                                                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                                                                                    Unlocking…
                                                                                                </>
                                                                                            ) : (
                                                                                                <>
                                                                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 018 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                                                                                    </svg>
                                                                                                    Unlock
                                                                                                </>
                                                                                            )}
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-3 py-4 whitespace-nowrap text-center sticky right-0 z-[120] border-l-2 border-gray-200 dark:border-gray-700 border-b border-gray-200 dark:border-gray-700 dark:shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.6)] transition-colors bg-white dark:bg-[#111117] group-hover:bg-gray-50 dark:group-hover:bg-[#23232e]">
                                                                                <span className="font-bold text-lg text-primary-600 dark:text-primary-400">{entry.score}</span>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </>
                                                        );
                                                    })()}
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
