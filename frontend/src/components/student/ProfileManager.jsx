import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import profileService from '../../services/profileService';
import uploadService from '../../services/uploadService';
import authService from '../../services/authService';
import toast from 'react-hot-toast';
import CustomDropdown from '../shared/CustomDropdown';

const PLATFORMS = [
    { value: 'leetcode', label: 'LeetCode' },
    { value: 'codechef', label: 'CodeChef' },
    { value: 'codeforces', label: 'Codeforces' },
    { value: 'hackerrank', label: 'HackerRank' },
    { value: 'interviewbit', label: 'InterviewBit' },
    { value: 'spoj', label: 'SPOJ' },
];

const ProfileManager = () => {
    const { user, updateUser } = useAuth();
    const [activeTab, setActiveTab] = useState('personal');
    const [loading, setLoading] = useState(false);
    const [externalProfiles, setExternalProfiles] = useState([]);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const [personalData, setPersonalData] = useState({
        profilePicture: '',
        profilePictureFile: null,
        phone: '',
        whatsapp: '',
        dob: '',
        gender: '',
        tshirtSize: '',
        aboutMe: '',
        address: {
            building: '',
            street: '',
            city: '',
            state: '',
            postalCode: '',
        },
        socialLinks: {
            facebook: '',
            twitter: '',
            quora: '',
        },
        professionalLinks: {
            website: '',
            linkedin: '',
        },
    });

    const [professionalData, setProfessionalData] = useState({
        education: {
            institution: '',
            degree: '',
            stream: '',
            rollNumber: '',
            startYear: '',
            endYear: '',
        },
        skills: [],
    });

    const [codingData, setCodingData] = useState({
        leetcode: '',
        codechef: '',
        codeforces: '',
        hackerrank: '',
        interviewbit: '',
        spoj: ''
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    useEffect(() => {
        fetchUserProfile();
        fetchExternalProfiles();
    }, []);

    const fetchUserProfile = async () => {
        try {
            const userData = await authService.getCurrentUser();

            setPersonalData({
                profilePicture: userData.profile?.profilePicture || '',
                phone: userData.profile?.phone || '',
                whatsapp: userData.profile?.whatsapp || '',
                dob: userData.profile?.dob || '',
                gender: userData.profile?.gender || '',
                tshirtSize: userData.profile?.tshirtSize || '',
                aboutMe: userData.profile?.aboutMe || '',
                address: userData.profile?.address || {},
                socialLinks: userData.profile?.socialLinks || {},
                professionalLinks: userData.profile?.professionalLinks || {},
            });

            setProfessionalData({
                education: userData.education || {},
                skills: userData.skills || [],
            });
            // Map existing external profiles to the form fields
            if (userData.externalProfiles) {
                const mappedCoding = {};
                userData.externalProfiles.forEach(p => {
                    mappedCoding[p.platform] = p.username;
                });
                setCodingData(prev => ({ ...prev, ...mappedCoding }));
            }
        } catch (error) {
            toast.error('Failed to load profile');
        }
    };

    const fetchExternalProfiles = async () => {
        try {
            const data = await profileService.getExternalProfiles();
            setExternalProfiles(data.profiles);

            // This populates the input fields with existing data
            if (data.profiles && data.profiles.length > 0) {
                const existingMappedData = {};
                data.profiles.forEach(p => {
                    existingMappedData[p.platform] = p.username;
                });
                setCodingData(prev => ({ ...prev, ...existingMappedData }));
            }
        } catch (error) {
            console.error('Failed to load external profiles');
        }
    };
    const handleProfilePictureChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB');
            return;
        }

        if (!file.type.startsWith('image/')) {
            toast.error('Only image files are allowed');
            return;
        }

        setPersonalData({
            ...personalData,
            profilePictureFile: file
        });

        const reader = new FileReader();
        reader.onloadend = () => {
            setPersonalData(prev => ({
                ...prev,
                profilePicture: reader.result
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleUpdatePersonal = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            let profilePictureUrl = personalData.profilePicture;

            // Upload new profile picture if file selected
            if (personalData.profilePictureFile) {
                const uploadResult = await uploadService.uploadProfilePicture(personalData.profilePictureFile);
                profilePictureUrl = uploadResult.data.url;
            }

            await profileService.updateProfile({
                ...personalData,
                profilePicture: profilePictureUrl
            });
            toast.success('Personal details updated successfully');
            updateUser(personalData);
        } catch (error) {
            toast.error(error.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfessional = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await profileService.updateProfile(professionalData);
            toast.success('Professional details updated successfully');
        } catch (error) {
            toast.error(error.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleLinkProfile = async (e) => {
        e.preventDefault();
        try {
            await profileService.linkExternalProfile(
                linkProfileData.platform,
                linkProfileData.username
            );
            toast.success('External profile linked successfully');
            setShowLinkModal(false);
            setLinkProfileData({ platform: 'leetcode', username: '' });
            fetchExternalProfiles();
        } catch (error) {
            toast.error(error.message || 'Failed to link profile');
        }
    };

    const handleManualSync = async () => {
        setSyncing(true);
        try {
            const result = await profileService.manualSyncProfiles();
            toast.success(result.message);
            toast(`Next sync allowed: ${new Date(result.nextSyncAllowed).toLocaleDateString()}`, {
                duration: 5000,
            });
            fetchExternalProfiles();
        } catch (error) {
            toast.error(error.message || 'Failed to sync profiles');
        } finally {
            setSyncing(false);
        }
    };
    const handleUpdateCodingProfiles = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const platforms = Object.keys(codingData);
            const updatePromises = [];

            for (const platform of platforms) {
                const username = codingData[platform];

                // Get the existing profile for this platform from our state
                const existing = externalProfiles.find(p => p.platform === platform);

                // Only call the API if:
                // 1. There is a username entered AND (it's new OR it has changed)
                if (username && (!existing || existing.username !== username)) {
                    updatePromises.push(profileService.linkExternalProfile(platform, username));
                }
            }

            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                toast.success('Coding profiles updated successfully');
                await fetchExternalProfiles(); // Refresh local data
            } else {
                toast('No changes detected', { icon: 'ℹ️' });
            }
        } catch (error) {
            // The backend now updates instead of erroring, 
            // so this will only trigger for actual network/server errors.
            toast.error(error.message || 'Error updating profiles');
        } finally {
            setLoading(false);
        }
    };
    const handleDeleteProfile = async (profileId, platform) => {
        if (!window.confirm(`Delete ${platform} profile link?`)) return;

        try {
            await profileService.deleteExternalProfile(profileId);
            toast.success('Profile deleted successfully');
            fetchExternalProfiles();
        } catch (error) {
            toast.error('Failed to delete profile');
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        try {
            await authService.changePassword(
                passwordData.currentPassword,
                passwordData.newPassword
            );
            toast.success('Password changed successfully');
            setShowPasswordModal(false);
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error) {
            toast.error(error.message || 'Failed to change password');
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile Management</h1>

            {/* Tabs */}
            <div className="flex space-x-4 border-b border-gray-200 mb-6">
                <button
                    onClick={() => setActiveTab('personal')}
                    className={`px-4 py-2 font-medium ${activeTab === 'personal'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Personal Details
                </button>
                <button
                    onClick={() => setActiveTab('professional')}
                    className={`px-4 py-2 font-medium ${activeTab === 'professional'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Professional Details
                </button>
                <button
                    onClick={() => setActiveTab('coding')}
                    className={`px-4 py-2 font-medium ${activeTab === 'coding'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Coding Profiles
                </button>
                <button
                    onClick={() => setActiveTab('security')}
                    className={`px-4 py-2 font-medium ${activeTab === 'security'
                        ? 'border-b-2 border-primary-600 text-primary-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Security
                </button>
            </div>

            {/* Personal Details Tab */}
            {activeTab === 'personal' && (
                <div className="card">
                    <form onSubmit={handleUpdatePersonal} className="space-y-6">
                        {/* Profile Picture */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Profile Picture
                            </label>
                            <div className="flex items-center space-x-4">
                                {personalData.profilePicture && (
                                    <img
                                        src={personalData.profilePicture}
                                        alt="Profile"
                                        className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                                    />
                                )}
                                <div className="flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleProfilePictureChange}
                                        className="input-field"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        JPG, PNG, GIF, WebP. Max 5MB
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Basic Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Phone *</label>
                                <input
                                    type="tel"
                                    value={personalData.phone}
                                    onChange={(e) =>
                                        setPersonalData({ ...personalData, phone: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">WhatsApp *</label>
                                <input
                                    type="tel"
                                    value={personalData.whatsapp}
                                    onChange={(e) =>
                                        setPersonalData({ ...personalData, whatsapp: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                                <input
                                    type="date"
                                    value={personalData.dob ? new Date(personalData.dob).toISOString().split('T')[0] : ''}
                                    onChange={(e) => setPersonalData({ ...personalData, dob: e.target.value })}
                                    className="mt-1 input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Gender</label>
                                <CustomDropdown
                                    options={[
                                        { value: '', label: 'Select Gender' },
                                        { value: 'Male', label: 'Male' },
                                        { value: 'Female', label: 'Female' },
                                        { value: 'Other', label: 'Other' }
                                    ]}
                                    value={personalData.gender}
                                    onChange={(val) =>
                                        setPersonalData({ ...personalData, gender: val })
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">T-shirt Size</label>
                                <CustomDropdown
                                    options={[
                                        { value: '', label: 'Select Size' },
                                        { value: 'S', label: 'S' },
                                        { value: 'M', label: 'M' },
                                        { value: 'L', label: 'L' },
                                        { value: 'XL', label: 'XL' },
                                        { value: 'XXL', label: 'XXL' }
                                    ]}
                                    value={personalData.tshirtSize}
                                    onChange={(val) =>
                                        setPersonalData({ ...personalData, tshirtSize: val })
                                    }
                                />
                            </div>
                        </div>

                        {/* Address */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-3">Address</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Building / Flat No</label>
                                    <input
                                        type="text"
                                        value={personalData.address.building || ''}
                                        onChange={(e) =>
                                            setPersonalData({
                                                ...personalData,
                                                address: { ...personalData.address, building: e.target.value }
                                            })
                                        }
                                        className="mt-1 input-field"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Street / Area</label>
                                    <input
                                        type="text"
                                        value={personalData.address.street || ''}
                                        onChange={(e) =>
                                            setPersonalData({
                                                ...personalData,
                                                address: { ...personalData.address, street: e.target.value }
                                            })
                                        }
                                        className="mt-1 input-field"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">City</label>
                                    <input
                                        type="text"
                                        value={personalData.address.city || ''}
                                        onChange={(e) =>
                                            setPersonalData({
                                                ...personalData,
                                                address: { ...personalData.address, city: e.target.value }
                                            })
                                        }
                                        className="mt-1 input-field"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">State</label>
                                    <input
                                        type="text"
                                        value={personalData.address.state || ''}
                                        onChange={(e) =>
                                            setPersonalData({
                                                ...personalData,
                                                address: { ...personalData.address, state: e.target.value }
                                            })
                                        }
                                        className="mt-1 input-field"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Postal Code</label>
                                    <input
                                        type="text"
                                        value={personalData.address.postalCode || ''}
                                        onChange={(e) =>
                                            setPersonalData({
                                                ...personalData,
                                                address: { ...personalData.address, postalCode: e.target.value }
                                            })
                                        }
                                        className="mt-1 input-field"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Social Links */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-3">Social Profiles</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Facebook</label>
                                    <input
                                        type="url"
                                        value={personalData.socialLinks.facebook || ''}
                                        onChange={(e) =>
                                            setPersonalData({
                                                ...personalData,
                                                socialLinks: { ...personalData.socialLinks, facebook: e.target.value }
                                            })
                                        }
                                        className="mt-1 input-field"
                                        placeholder="https://facebook.com/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Twitter</label>
                                    <input
                                        type="url"
                                        value={personalData.socialLinks.twitter || ''}
                                        onChange={(e) =>
                                            setPersonalData({
                                                ...personalData,
                                                socialLinks: { ...personalData.socialLinks, twitter: e.target.value }
                                            })
                                        }
                                        className="mt-1 input-field"
                                        placeholder="https://twitter.com/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Quora</label>
                                    <input
                                        type="url"
                                        value={personalData.socialLinks.quora || ''}
                                        onChange={(e) =>
                                            setPersonalData({
                                                ...personalData,
                                                socialLinks: { ...personalData.socialLinks, quora: e.target.value }
                                            })
                                        }
                                        className="mt-1 input-field"
                                        placeholder="https://quora.com/..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Professional Links */}
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-3">Professional Profiles</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">LinkedIn</label>
                                    <input
                                        type="url"
                                        value={personalData.professionalLinks.linkedin || ''}
                                        onChange={(e) =>
                                            setPersonalData({
                                                ...personalData,
                                                professionalLinks: { ...personalData.professionalLinks, linkedin: e.target.value }
                                            })
                                        }
                                        className="mt-1 input-field"
                                        placeholder="https://linkedin.com/in/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Website / Portfolio</label>
                                    <input
                                        type="url"
                                        value={personalData.professionalLinks.website || ''}
                                        onChange={(e) =>
                                            setPersonalData({
                                                ...personalData,
                                                professionalLinks: { ...personalData.professionalLinks, website: e.target.value }
                                            })
                                        }
                                        className="mt-1 input-field"
                                        placeholder="https://yourwebsite.com"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">About Me</label>
                            <textarea
                                value={personalData.aboutMe}
                                onChange={(e) =>
                                    setPersonalData({ ...personalData, aboutMe: e.target.value })
                                }
                                className="mt-1 input-field"
                                rows="3"
                                maxLength="250"
                                placeholder="Tell us about yourself (250 characters max)"
                            />
                        </div>

                        <button type="submit" disabled={loading} className="btn-primary w-full md:w-auto">
                            {loading ? (<>
    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Saving...
</>) : 'Save Personal Details'}
                        </button>
                    </form>
                </div>
            )}

            {/* Professional Details Tab */}
            {activeTab === 'professional' && user.role === 'student' && (
                <div className="card">
                    <form onSubmit={handleUpdateProfessional} className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Education</h3>

                        {/* Read-only fields from batch */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <p className="text-sm text-blue-800 mb-3">
                                <strong>Note:</strong> These education details are set during batch creation and profile completion, and cannot be modified here.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Institution (From Batch)</label>
                                    <input
                                        type="text"
                                        value={professionalData.education.institution || ''}
                                        readOnly
                                        disabled
                                        className="mt-1 input-field bg-gray-100 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Degree (From Batch)</label>
                                    <input
                                        type="text"
                                        value={professionalData.education.degree || ''}
                                        readOnly
                                        disabled
                                        className="mt-1 input-field bg-gray-100 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Start Year (From Batch)</label>
                                    <input
                                        type="number"
                                        value={professionalData.education.startYear || ''}
                                        readOnly
                                        disabled
                                        className="mt-1 input-field bg-gray-100 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">End Year (From Batch)</label>
                                    <input
                                        type="number"
                                        value={professionalData.education.endYear || ''}
                                        readOnly
                                        disabled
                                        className="mt-1 input-field bg-gray-100 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Branch/Stream (Selected During Profile Completion)</label>
                                    <input
                                        type="text"
                                        value={professionalData.education.stream || ''}
                                        readOnly
                                        disabled
                                        className="mt-1 input-field bg-gray-100 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Roll Number (Entered During Profile Completion)</label>
                                    <input
                                        type="text"
                                        value={professionalData.education.rollNumber || ''}
                                        readOnly
                                        disabled
                                        className="mt-1 input-field bg-gray-100 cursor-not-allowed"
                                    />
                                </div>


                            </div>
                        </div>



                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                            <input
                                type="text"
                                placeholder="Enter skills separated by commas"
                                value={professionalData.skills.join(', ')}
                                onChange={(e) =>
                                    setProfessionalData({
                                        ...professionalData,
                                        skills: e.target.value.split(',').map((s) => s.trim()),
                                    })
                                }
                                className="input-field"
                            />
                        </div>

                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? (<>
    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Saving...
</>) : 'Save Professional Details'}
                        </button>
                    </form>
                </div>
            )}

            {/* Coding Profiles Tab */}
            {activeTab === 'coding' && (
                <div className="card">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-semibold text-gray-900">Coding Platform Profiles</h3>
                        <button
                            onClick={handleManualSync}
                            disabled={syncing}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center"
                        >
                            {syncing ? 'Syncing...' : '🔄 Sync All Stats'}
                        </button>
                    </div>

                    <form onSubmit={handleUpdateCodingProfiles} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                            {PLATFORMS.map((platform) => {
                                // Find existing data for this specific platform
                                const stats = externalProfiles.find(p => p.platform === platform.value);

                                return (
                                    <div key={platform.value} className="flex flex-col">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {platform.label} Username
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder={`Enter ${platform.label} handle`}
                                                value={codingData[platform.value] || ''}
                                                onChange={(e) => setCodingData({
                                                    ...codingData,
                                                    [platform.value]: e.target.value
                                                })}
                                                className="input-field w-full"
                                            />
                                            {stats && (
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" title="Profile Linked">
                                                    ✓
                                                </span>
                                            )}
                                        </div>

                                        {/* Statistics Display Below the Input */}
                                        <div className="mt-2 flex items-center space-x-4 h-5">
                                            {stats ? (
                                                <>
                                                    <div className="flex items-center text-xs text-gray-500">
                                                        <span className="font-semibold text-gray-700 mr-1">Rating:</span>
                                                        {stats.stats?.rating || 'N/A'}
                                                    </div>
                                                    <div className="flex items-center text-xs text-gray-500">
                                                        <span className="font-semibold text-gray-700 mr-1">Solved:</span>
                                                        {stats.stats?.problemsSolved || 0}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 italic">
                                                        Synced: {new Date(stats.lastSynced).toLocaleDateString()}
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-[10px] text-gray-400 italic">No profile linked yet</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                            <p className="text-xs text-gray-500 max-w-xs">
                                Updates may take a few minutes to reflect after saving. All fields are optional.
                            </p>
                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary"
                            >
                                {loading ? (<>
    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-current inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Saving...
</>) : 'Update All Profiles'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {/* Security Tab */}
            {activeTab === 'security' && (
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
                    <button onClick={() => setShowPasswordModal(true)} className="btn-primary">
                        Change Password
                    </button>
                </div>
            )}

            {/* Link Profile Modal */}
            {showLinkModal && (
                <div className="modal-backdrop" onClick={() => setShowLinkModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Link External Profile</h2>
                        <form onSubmit={handleLinkProfile} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Platform</label>
                                <CustomDropdown
                                    options={PLATFORMS}
                                    value={linkProfileData.platform}
                                    onChange={(val) =>
                                        setLinkProfileData({ ...linkProfileData, platform: val })
                                    }
                                />
                                <p className="text-xs text-gray-500 mt-1">You can only add each platform once</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Username</label>
                                <input
                                    type="text"
                                    value={linkProfileData.username}
                                    onChange={(e) =>
                                        setLinkProfileData({ ...linkProfileData, username: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    placeholder="Your username on the platform (optional)"
                                />
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowLinkModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Link Profile
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Change Password Modal */}
            {showPasswordModal && (
                <div className="modal-backdrop" onClick={() => setShowPasswordModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold mb-4">Change Password</h2>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Current Password *
                                </label>
                                <input
                                    type="password"
                                    value={passwordData.currentPassword}
                                    onChange={(e) =>
                                        setPasswordData({ ...passwordData, currentPassword: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">New Password *</label>
                                <input
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={(e) =>
                                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    minLength="8"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Confirm Password *
                                </label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) =>
                                        setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    required
                                />
                            </div>
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    Change Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileManager;
