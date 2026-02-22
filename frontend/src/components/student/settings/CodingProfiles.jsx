import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import profileService from '../../../services/profileService';
import toast from 'react-hot-toast';

const CodingProfiles = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [externalProfiles, setExternalProfiles] = useState([]);
    const [nextSyncAllowed, setNextSyncAllowed] = useState(null);
    const isProduction = import.meta.env.MODE === 'production';

    // Form state for each platform
    const [codingData, setCodingData] = useState({
        github: '',
        leetcode: '',
        codechef: '',
        codeforces: '',
        hackerrank: '',
        interviewbit: '',
    });

    const DSA_PLATFORMS = [
        { value: 'hackerrank', label: 'HackerRank' },
        { value: 'leetcode', label: 'LeetCode' },
        { value: 'interviewbit', label: 'InterviewBit' },
        { value: 'codechef', label: 'CodeChef' },
        { value: 'codeforces', label: 'Codeforces' },
    ];

    useEffect(() => {
        fetchExternalProfiles();
        fetchSyncStatus();
    }, []);

    const fetchExternalProfiles = async () => {
        try {
            const data = await profileService.getExternalProfiles();
            setExternalProfiles(data.profiles || []);

            if (data.profiles && data.profiles.length > 0) {
                const existingMappedData = {};
                data.profiles.forEach(p => {
                    existingMappedData[p.platform] = p.username;
                });
                setCodingData(prev => ({ ...prev, ...existingMappedData }));
            }
        } catch (error) {
            console.error('Failed to load external profiles', error);
        }
    };

    const fetchSyncStatus = async () => {
        // Build a logic to determine next sync allowed based on user data or a specific endpoint
        // Assuming we can get the last sync date from the user object or profile service
        // For now, let's try to get it from profileService if available, or rely on user context if updated
        // Since the backend logic handles the restriction, we can try to "peek" or just use the last known sync date
        // If the backend sends 'nextSyncAllowed' in getExternalProfiles, that would be ideal.
        // If not, we might need to rely on the user object in context, assuming it's updated.
        if (user?.lastProfileSync) {
            const lastSync = new Date(user.lastProfileSync);
            const nextSync = new Date(lastSync);
            nextSync.setDate(lastSync.getDate() + 7); // Add 7 days
            setNextSyncAllowed(nextSync);
        }
    };

    const getProfileUrl = (platform, username) => {
        if (!username) return '#';
        switch (platform) {
            case 'github':
                return `https://github.com/${username}`;
            case 'hackerrank':
                return `https://www.hackerrank.com/profile/${username}`;
            case 'leetcode':
                return `https://leetcode.com/u/${username}`;
            case 'interviewbit':
                return `https://www.interviewbit.com/profile/${username}`;
            case 'codechef':
                return `https://www.codechef.com/users/${username}`;
            case 'codeforces':
                return `https://codeforces.com/profile/${username}`;
            default:
                return '#';
        }
    };

    const handleUpdateProfile = async (platform) => {
        const username = codingData[platform];
        if (!username) {
            toast.error(`Please enter a username for ${platform}`);
            return;
        }

        setLoading(true);
        try {
            await profileService.linkExternalProfile(platform, username);
            toast.success(`${platform} profile updated successfully`);
            await fetchExternalProfiles();
        } catch (error) {
            toast.error(error.message || `Failed to update ${platform} profile`);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateDSAScore = async () => {
        setSyncing(true);
        try {
            const result = await profileService.manualSyncProfiles();
            toast.success(result.message);
            // Update the next sync allowed date from the response
            if (result.nextSyncAllowed) {
                setNextSyncAllowed(new Date(result.nextSyncAllowed));
            }
            await fetchExternalProfiles();
        } catch (error) {
            toast.error(error.message || 'Failed to sync profiles');
        } finally {
            setSyncing(false);
        }
    };

    const isPlatformLinked = (platform) => {
        return externalProfiles.some(p => p.platform === platform);
    };

    const isLocked = isProduction && nextSyncAllowed && new Date(nextSyncAllowed) > new Date();

    // Icons component for reuse or just inline SVG
    const ExternalLinkIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Development Profile Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                        Development Profile
                    </h2>
                </div>
                <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-end gap-4">
                        <div className="flex-grow space-y-2">
                            <label className="text-sm font-medium text-gray-700">Github username</label>
                            <input
                                type="text"
                                value={codingData.github}
                                onChange={(e) => setCodingData({ ...codingData, github: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                                placeholder="Enter Github username"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleUpdateProfile('github')}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 px-6 rounded-lg transition-all shadow hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap h-[44px]"
                            >
                                {loading ? (<>
    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Updating...
</>) : 'Update'}
                            </button>
                            {codingData.github && (
                                <a
                                    href={getProfileUrl('github', codingData.github)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-white hover:bg-gray-50 text-blue-600 border border-gray-200 p-2.5 rounded-lg transition-all shadow-sm hover:shadow h-[44px] w-[44px] flex items-center justify-center"
                                    title="View Github Profile"
                                >
                                    <ExternalLinkIcon />
                                </a>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* DSA Profiles Section */}
            <div className="bg-white rounded-xl shadow-sm border border-yellow-200 overflow-hidden ring-1 ring-yellow-100/50">
                <div className="px-6 py-4 border-b border-yellow-100 bg-gradient-to-r from-yellow-50 to-white">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        DSA Profiles
                    </h2>
                </div>
                <div className="p-6 space-y-6">
                    {DSA_PLATFORMS.map((platform) => (
                        <div key={platform.value} className="flex flex-col md:flex-row md:items-end gap-4 pb-4 border-b last:border-b-0 border-gray-100 last:pb-0">
                            <div className="flex-grow space-y-2 relative">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm font-medium text-gray-700">{platform.label} username</label>
                                    {isPlatformLinked(platform.value) && (
                                        <span className="text-xs text-green-700 font-medium bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200 flex items-center shadow-sm">
                                            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            Linked
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={codingData[platform.value]}
                                    onChange={(e) => setCodingData({ ...codingData, [platform.value]: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 outline-none transition-all shadow-sm"
                                    placeholder={`Enter ${platform.label} username`}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleUpdateProfile(platform.value)}
                                    disabled={loading}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 px-6 rounded-lg transition-all shadow hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap h-[44px]"
                                >
                                    {loading ? (<>
    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    ...
</>) : 'Update'}
                                </button>
                                {/* External Link Icon */}
                                {codingData[platform.value] && (
                                    <a
                                        href={getProfileUrl(platform.value, codingData[platform.value])}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-white hover:bg-gray-50 text-blue-600 border border-gray-200 p-2.5 rounded-lg transition-all shadow-sm hover:shadow h-[44px] w-[44px] flex items-center justify-center group"
                                        title={`View ${platform.label} Profile`}
                                    >
                                        <ExternalLinkIcon />
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Update DSA Score Button */}
                <div className="px-6 py-5 bg-gray-50 border-t border-gray-100 flex justify-center">
                    <button
                        onClick={handleUpdateDSAScore}
                        disabled={syncing || isLocked}
                        className={`relative bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-10 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center space-x-3 ${(syncing || isLocked) ? 'opacity-70 cursor-not-allowed shadow-none translate-y-0' : ''
                            }`}
                    >
                        {syncing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Syncing Scores...</span>
                            </>
                        ) : isLocked ? (
                            <div className="flex flex-col items-center leading-tight">
                                <span>Update Locked</span>
                                <span className="text-xs opacity-80 font-normal">
                                    Next: {nextSyncAllowed.toLocaleDateString()}
                                </span>
                            </div>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Update DSA Score</span>
                            </>
                        )}
                        {/* Notification Badge Style - Show only if NOT locked */}
                        {!isLocked && (
                            <span className="absolute -top-2 -right-2 bg-amber-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full border-2 border-white shadow-md">
                                1 / week
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CodingProfiles;
