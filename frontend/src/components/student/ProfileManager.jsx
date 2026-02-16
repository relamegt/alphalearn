import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import profileService from '../../services/profileService';
import authService from '../../services/authService';
import toast from 'react-hot-toast';

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

    const [linkProfileData, setLinkProfileData] = useState({
        platform: 'leetcode',
        username: '',
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
        } catch (error) {
            toast.error('Failed to load profile');
        }
    };

    const fetchExternalProfiles = async () => {
        try {
            const data = await profileService.getExternalProfiles();
            setExternalProfiles(data.profiles);
        } catch (error) {
            console.error('Failed to load external profiles');
        }
    };

    const handleUpdatePersonal = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await profileService.updateProfile(personalData);
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
                                <select
                                    value={personalData.gender}
                                    onChange={(e) =>
                                        setPersonalData({ ...personalData, gender: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                >
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">T-shirt Size</label>
                                <select
                                    value={personalData.tshirtSize}
                                    onChange={(e) =>
                                        setPersonalData({ ...personalData, tshirtSize: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                >
                                    <option value="">Select Size</option>
                                    <option value="S">S</option>
                                    <option value="M">M</option>
                                    <option value="L">L</option>
                                    <option value="XL">XL</option>
                                    <option value="XXL">XXL</option>
                                </select>
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
                            {loading ? 'Saving...' : 'Save Personal Details'}
                        </button>
                    </form>
                </div>
            )}

            {/* Professional Details Tab */}
            {activeTab === 'professional' && user.role === 'student' && (
                <div className="card">
                    <form onSubmit={handleUpdateProfessional} className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900">Education</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Institution *</label>
                                <input
                                    type="text"
                                    value={professionalData.education.institution}
                                    onChange={(e) =>
                                        setProfessionalData({
                                            ...professionalData,
                                            education: { ...professionalData.education, institution: e.target.value },
                                        })
                                    }
                                    className="mt-1 input-field"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Roll Number *</label>
                                <input
                                    type="text"
                                    value={professionalData.education.rollNumber}
                                    onChange={(e) =>
                                        setProfessionalData({
                                            ...professionalData,
                                            education: { ...professionalData.education, rollNumber: e.target.value },
                                        })
                                    }
                                    className="mt-1 input-field"
                                    required
                                />
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
                            {loading ? 'Saving...' : 'Save Professional Details'}
                        </button>
                    </form>
                </div>
            )}

            {/* Coding Profiles Tab */}
            {activeTab === 'coding' && (
                <div className="space-y-6">
                    <div className="card">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">External Coding Profiles</h3>
                            <div className="space-x-2">
                                <button onClick={() => setShowLinkModal(true)} className="btn-primary">
                                    + Link Profile
                                </button>
                                <button onClick={handleManualSync} disabled={syncing} className="btn-secondary">
                                    {syncing ? 'Syncing...' : '🔄 Manual Sync (1/week)'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {externalProfiles.map((profile) => (
                                <div
                                    key={profile._id}
                                    className="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
                                >
                                    <div>
                                        <p className="font-semibold text-gray-900 capitalize">{profile.platform}</p>
                                        <p className="text-sm text-gray-600">@{profile.username}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Last synced: {new Date(profile.lastSynced).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-700">
                                            Problems: {profile.stats.problemsSolved} | Rating: {profile.stats.rating}
                                        </p>
                                        <button
                                            onClick={() => handleDeleteProfile(profile._id, profile.platform)}
                                            className="text-sm text-red-600 hover:text-red-800 mt-2"
                                        >
                                            Unlink
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
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
                                <label className="block text-sm font-medium text-gray-700">Platform *</label>
                                <select
                                    value={linkProfileData.platform}
                                    onChange={(e) =>
                                        setLinkProfileData({ ...linkProfileData, platform: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                >
                                    {PLATFORMS.map((platform) => (
                                        <option key={platform.value} value={platform.value}>
                                            {platform.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Username *</label>
                                <input
                                    type="text"
                                    value={linkProfileData.username}
                                    onChange={(e) =>
                                        setLinkProfileData({ ...linkProfileData, username: e.target.value })
                                    }
                                    className="mt-1 input-field"
                                    placeholder="Your username on the platform"
                                    required
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
