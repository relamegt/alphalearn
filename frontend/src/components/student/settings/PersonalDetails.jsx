import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import profileService from '../../../services/profileService';
import uploadService from '../../../services/uploadService';
import authService from '../../../services/authService';
import toast from 'react-hot-toast';
import CustomDropdown from '../../shared/CustomDropdown';

const PersonalDetails = () => {
    const { updateUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [sameWhatsapp, setSameWhatsapp] = useState(false);
    const [personalData, setPersonalData] = useState({
        username: '',
        firstName: '',
        lastName: '',
        email: '',
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
            linkedin: '', // Moved linkedIn here as per original
        },
    });

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const userData = await authService.getCurrentUser();
                setPersonalData({
                    username: userData.username || '',
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    email: userData.email || '',
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
            } catch (error) {
                toast.error('Failed to load profile');
            }
        };
        fetchUserProfile();
    }, []);

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

        if (!personalData.gender) {
            toast.error('Gender is required');
            return;
        }

        setLoading(true);

        try {
            let profilePictureUrl = personalData.profilePicture;

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

    return (
        <div className="max-w-4xl mx-auto card animate-fade-in">
            <h2 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b border-gray-100">Personal Details</h2>
            <form onSubmit={handleUpdatePersonal} className="space-y-6">
                {/* Profile Picture */}
                <div className="flex items-center space-x-6">
                    <div className="relative group">
                        {personalData.profilePicture ? (
                            <img
                                src={personalData.profilePicture}
                                alt="Profile"
                                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                        )}
                        <label className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 shadow-md cursor-pointer border border-gray-200 hover:bg-gray-50 transition-colors">
                            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleProfilePictureChange}
                                className="hidden"
                            />
                        </label>
                    </div>
                    <div>
                        <h3 className="font-medium text-gray-900">Profile Picture</h3>
                        <p className="text-sm text-gray-500">JPG, PNG, GIF, WebP. Max 5MB</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Readonly Core details */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <input
                            type="text"
                            value={personalData.firstName}
                            readOnly
                            disabled
                            className="input-field bg-gray-100/80 cursor-not-allowed text-gray-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <input
                            type="text"
                            value={personalData.lastName}
                            readOnly
                            disabled
                            className="input-field bg-gray-100/80 cursor-not-allowed text-gray-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input
                            type="text"
                            value={personalData.username}
                            readOnly
                            disabled
                            className="input-field bg-gray-100/80 cursor-not-allowed text-gray-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            value={personalData.email}
                            readOnly
                            disabled
                            className="input-field bg-gray-100/80 cursor-not-allowed text-gray-500"
                        />
                    </div>

                    {/* Editable details */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone </label>
                        <input
                            type="tel"
                            value={personalData.phone}
                            onChange={(e) => setPersonalData({ ...personalData, phone: e.target.value })}
                            className="input-field"
                            maxLength="10"
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <span className="text-xs text-gray-500">Same as phone</span>
                                <div
                                    onClick={() => setSameWhatsapp(v => !v)}
                                    className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${sameWhatsapp ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${sameWhatsapp ? 'translate-x-4' : ''}`} />
                                </div>
                            </label>
                        </div>
                        <input
                            type="tel"
                            value={sameWhatsapp ? personalData.phone : personalData.whatsapp}
                            onChange={(e) => setPersonalData({ ...personalData, whatsapp: e.target.value })}
                            className="input-field"
                            maxLength="10"
                            disabled={sameWhatsapp}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                        <input
                            type="date"
                            value={personalData.dob ? new Date(personalData.dob).toISOString().split('T')[0] : ''}
                            onChange={(e) => setPersonalData({ ...personalData, dob: e.target.value })}
                            className="input-field"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                        <CustomDropdown
                            options={[
                                { value: '', label: 'Select Gender' },
                                { value: 'Male', label: 'Male' },
                                { value: 'Female', label: 'Female' },
                                { value: 'Other', label: 'Other' }
                            ]}
                            value={personalData.gender}
                            onChange={(val) => setPersonalData({ ...personalData, gender: val })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">T-shirt Size</label>
                        <CustomDropdown
                            options={[
                                { value: '', label: 'Select Size' },
                                { value: 'S', label: 'S' },
                                { value: 'M', label: 'M' },
                                { value: 'L', label: 'L' },
                                { value: 'XL', label: 'XL' },
                                { value: 'XXL', label: 'XXL' },
                                { value: 'XXXL', label: 'XXXL' }
                            ]}
                            value={personalData.tshirtSize}
                            onChange={(val) => setPersonalData({ ...personalData, tshirtSize: val })}
                        />
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Address</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Street / Area</label>
                            <input
                                type="text"
                                value={personalData.address.street || ''}
                                onChange={(e) => setPersonalData({ ...personalData, address: { ...personalData.address, street: e.target.value } })}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                            <input
                                type="text"
                                value={personalData.address.city || ''}
                                onChange={(e) => setPersonalData({ ...personalData, address: { ...personalData.address, city: e.target.value } })}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                            <input
                                type="text"
                                value={personalData.address.state || ''}
                                onChange={(e) => setPersonalData({ ...personalData, address: { ...personalData.address, state: e.target.value } })}
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                            <input
                                type="text"
                                value={personalData.address.postalCode || ''}
                                onChange={(e) => setPersonalData({ ...personalData, address: { ...personalData.address, postalCode: e.target.value } })}
                                className="input-field"
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">About Me</h3>
                    <textarea
                        value={personalData.aboutMe}
                        onChange={(e) => setPersonalData({ ...personalData, aboutMe: e.target.value })}
                        className="input-field"
                        rows="4"
                        maxLength="250"
                        placeholder="Tell us about yourself (250 characters max)"
                    />
                    <p className="text-right text-xs text-gray-500 mt-1">
                        {personalData.aboutMe.length}/250
                    </p>
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" disabled={loading} className="btn-primary w-full md:w-auto px-8">
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PersonalDetails;
