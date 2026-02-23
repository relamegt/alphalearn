import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';
import uploadService from '../../services/uploadService';
import toast from 'react-hot-toast';
import CustomDropdown from '../shared/CustomDropdown';

const CompleteProfile = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [sameWhatsapp, setSameWhatsapp] = useState(false);

    const [formData, setFormData] = useState({
        // Basic Info
        username: '',
        firstName: '',
        lastName: '',
        newPassword: '',
        confirmPassword: '',
        profilePicture: '',
        profilePictureFile: null,
        // Contact Info
        phone: '',
        whatsapp: '',
        dob: '',
        gender: '',
        tshirtSize: '',
        // Address
        address: {
            building: '',
            street: '',
            city: '',
            state: '',
            postalCode: ''
        },

        // Education (for students)
        rollNumber: '',
        institution: '',
        degree: '',
        branch: '',
        startYear: '',
        endYear: ''
    });

    const [errors, setErrors] = useState({});
    const [availableBranches, setAvailableBranches] = useState([]);

    // Live username checking states
    const [usernameStatus, setUsernameStatus] = useState(null); // 'checking', 'available', 'unavailable', 'invalid'
    const [usernameMessage, setUsernameMessage] = useState('');

    // No longer auto-filling username based on email


    useEffect(() => {
        const controller = new AbortController();
        const signal = controller.signal;

        const checkUsername = async () => {
            const val = formData.username;
            if (!val || val.length < 3 || val.length > 10) {
                setUsernameStatus('invalid');
                setUsernameMessage('Username must be 3-10 characters long');
                return;
            }
            if (!/^[a-z0-9_.]+$/.test(val)) {
                setUsernameStatus('invalid');
                setUsernameMessage('Only lowercase letters, numbers, dots and underscores allowed');
                return;
            }
            if (!/^[a-z]/.test(val)) {
                setUsernameStatus('invalid');
                setUsernameMessage('Username must start with a letter');
                return;
            }

            setUsernameStatus('checking');
            try {
                const axios = (await import('axios')).default;
                const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                const res = await axios.get(`${API_BASE_URL}/public/check-username/${val}`, { signal });
                if (res.data.available) {
                    setUsernameStatus('available');
                    setUsernameMessage(res.data.message);
                } else {
                    setUsernameStatus('unavailable');
                    setUsernameMessage(res.data.message);
                }
            } catch (err) {
                if (err.name !== 'CanceledError') {
                    setUsernameStatus('invalid');
                    setUsernameMessage('Error checking availability');
                }
            }
        };

        const timer = setTimeout(() => {
            if (formData.username) {
                checkUsername();
            }
        }, 1200);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [formData.username]);

    // Fetch user data to pre-fill education from batch
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userData = await authService.getCurrentUser(true); // force refresh to get education from batch

                // Pre-fill from batch data first (as baseline)
                let batchEducation = {};
                if (userData && userData.batchId) {
                    try {
                        const batchData = await authService.getBatchDetails(userData.batchId);
                        setAvailableBranches(batchData.branches || []);
                        // Use batch education as fallback values
                        if (batchData.education) {
                            batchEducation = batchData.education;
                        }
                    } catch (error) {
                        console.error('Error fetching batch branches:', error);
                    }
                }

                // User's own education overrides batch defaults (user data takes priority)
                if (userData) {
                    setFormData(prev => ({
                        ...prev,
                        institution: userData.education?.institution || batchEducation?.institution || '',
                        degree: userData.education?.degree || batchEducation?.degree || '',
                        startYear: userData.education?.startYear || batchEducation?.startYear || '',
                        endYear: userData.education?.endYear || batchEducation?.endYear || ''
                        // branch and rollNumber remain empty for user to fill
                    }));
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        if (user?.role === 'student') {
            fetchUserData();
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData({
                ...formData,
                [parent]: {
                    ...formData[parent],
                    [child]: value
                }
            });
        } else {
            setFormData({ ...formData, [name]: value });
        }

        // Clear error for this field
        setErrors({ ...errors, [name]: '' });
    };
    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB');
            return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Only image files are allowed');
            return;
        }

        setFormData({
            ...formData,
            profilePictureFile: file
        });

        // Preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({
                ...prev,
                profilePicture: reader.result
            }));
        };
        reader.readAsDataURL(file);
    };

    const validateStep1 = () => {
        const newErrors = {};

        if (!formData.username.trim() || usernameStatus !== 'available') {
            newErrors.username = 'Please choose a valid and available username';
        }

        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        }

        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        }

        if (!formData.newPassword) {
            newErrors.newPassword = 'Password is required';
        } else {
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
            if (!passwordRegex.test(formData.newPassword)) {
                newErrors.newPassword = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
            }
        }

        if (formData.newPassword !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep2 = () => {
        const newErrors = {};

        if (formData.phone.trim() && !/^\d{10}$/.test(formData.phone)) {
            newErrors.phone = 'Phone number must be 10 digits';
        }

        if (!formData.dob) {
            newErrors.dob = 'Date of Birth is required';
        }

        if (!formData.gender) {
            newErrors.gender = 'Gender is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateStep3 = () => {
        if (user?.role !== 'student') return true;

        const newErrors = {};

        if (!formData.rollNumber.trim()) {
            newErrors.rollNumber = 'Roll number is required';
        }

        if (!formData.branch.trim()) {
            newErrors.branch = 'Branch is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        let isValid = false;

        if (step === 1) {
            isValid = validateStep1();
        } else if (step === 2) {
            isValid = validateStep2();
        }

        if (isValid) {
            setStep(step + 1);
        }
    };

    const handleBack = () => {
        setStep(step - 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (user?.role === 'student' && !validateStep3()) {
            return;
        }

        setLoading(true);

        try {
            let profilePictureUrl = null;

            // Upload profile picture first if exists
            if (formData.profilePictureFile) {
                try {
                    const uploadResult = await uploadService.uploadProfilePicture(formData.profilePictureFile);
                    profilePictureUrl = uploadResult.data.url;
                } catch (error) {
                    toast.error('Failed to upload profile picture');
                    console.error(error);
                }
            }

            const profileData = {
                username: formData.username,
                firstName: formData.firstName,
                lastName: formData.lastName,
                newPassword: formData.newPassword,
                profilePicture: profilePictureUrl,
                phone: formData.phone || null,
                whatsapp: sameWhatsapp ? (formData.phone || null) : (formData.whatsapp || null),
                dob: formData.dob || null,
                gender: formData.gender,
                tshirtSize: formData.tshirtSize || null,
                address: formData.address
            };

            // Add education for students
            if (user?.role === 'student') {
                profileData.rollNumber = formData.rollNumber;
                profileData.institution = formData.institution;
                profileData.degree = formData.degree;
                profileData.branch = formData.branch;
                profileData.startYear = formData.startYear ? parseInt(formData.startYear) : null;
                profileData.endYear = formData.endYear ? parseInt(formData.endYear) : null;
            }

            await authService.completeFirstLoginProfile(profileData);

            toast.success('Profile completed successfully! Please login with your new password.');

            // Logout and redirect to login, skip the extra 'logged out' toast
            await logout(false, true);
        } catch (error) {
            toast.error(error.message || 'Failed to complete profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-200/50 rounded-full mix-blend-multiply filter blur-[80px] animate-blob"></div>
                <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] bg-indigo-200/50 rounded-full mix-blend-multiply filter blur-[80px] animate-blob" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="max-w-4xl w-full relative z-10">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex justify-center mb-6 p-4 bg-white/50 backdrop-blur-sm rounded-full shadow-sm border border-white/50">
                        <img
                            src="/alphalogo.png"
                            alt="AlphaKnowledge"
                            className="w-16 h-16 object-contain drop-shadow"
                        />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-indigo-950 tracking-tight mb-3">
                        Welcome to AlphaKnowledge
                    </h1>
                    <p className="text-lg text-indigo-800/80 font-medium max-w-2xl mx-auto">
                        We're excited to have you on board! Let's get your profile set up so you can start accelerating your learning journey.
                    </p>
                </div>

                {/* Modern Progress Steps */}
                <div className="mb-10">
                    <div className="flex justify-between items-center relative">
                        {/* Connecting Line */}
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10 rounded-full"></div>
                        <div className={`absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-blue-600 transition-all duration-500 -z-0 rounded-full`} style={{ width: `${((step - 1) / 2) * 100}%` }}></div>

                        {[1, 2, 3].map((stepNumber) => (
                            <div key={stepNumber} className="flex flex-col items-center group cursor-default">
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-4 ${step >= stepNumber
                                        ? 'bg-blue-600 border-blue-100 text-white shadow-md scale-110'
                                        : 'bg-white border-gray-200 text-gray-400'
                                        }`}
                                >
                                    {step > stepNumber ? '✓' : stepNumber}
                                </div>
                                <span className={`text-xs mt-3 font-medium uppercase tracking-wide transition-colors ${step >= stepNumber ? 'text-blue-600' : 'text-gray-400'}`}>
                                    {stepNumber === 1 && 'Basic Info'}
                                    {stepNumber === 2 && 'Contact'}
                                    {stepNumber === 3 && (user?.role === 'student' ? 'Education' : 'Finish')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form Card */}
                <div className="bg-white/90 backdrop-blur-md rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-white p-8 sm:p-10 transition-all">
                    <form onSubmit={handleSubmit} noValidate>
                        {/* Step 1: Basic Info */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                                    Basic Information
                                </h2>

                                {/* Profile Picture Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Profile Picture
                                    </label>
                                    <div className="flex items-center space-x-4">
                                        {formData.profilePicture && (
                                            <img
                                                src={formData.profilePicture}
                                                alt="Profile Preview"
                                                className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                                            />
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                            className="input-field"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Upload an image (JPG, PNG, GIF, WebP). Max size: 5MB
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            First Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleChange}
                                            className={`input-field ${errors.firstName ? 'border-red-500' : ''}`}
                                            placeholder="John"
                                        />
                                        {errors.firstName && (
                                            <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Last Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleChange}
                                            className={`input-field ${errors.lastName ? 'border-red-500' : ''}`}
                                            placeholder="Doe"
                                        />
                                        {errors.lastName && (
                                            <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Username *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 font-medium">@</span>
                                        <input
                                            type="text"
                                            name="username"
                                            value={formData.username}
                                            onChange={(e) => {
                                                // Convert to lowercase and strip invalid characters
                                                const sanitizedValue = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '');
                                                handleChange({ target: { name: 'username', value: sanitizedValue } });
                                                setUsernameStatus(null);
                                            }}
                                            maxLength="10"
                                            className={`input-field pl-8 ${errors.username || usernameStatus === 'unavailable' || usernameStatus === 'invalid' ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : usernameStatus === 'available' ? 'border-green-500 focus:ring-green-500 focus:border-green-500' : ''}`}
                                            placeholder="johndoe123"
                                        />
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            {usernameStatus === 'checking' && (
                                                <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                            )}
                                            {usernameStatus === 'available' && (
                                                <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            )}
                                            {(usernameStatus === 'unavailable' || usernameStatus === 'invalid') && (
                                                <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            )}
                                        </div>
                                    </div>
                                    {usernameMessage && (
                                        <p className={`text-xs mt-1.5 font-medium ${usernameStatus === 'available' ? 'text-green-600' : 'text-red-500'}`}>
                                            {usernameMessage}
                                        </p>
                                    )}
                                    {errors.username && !usernameMessage && (
                                        <p className="text-red-500 text-xs mt-1">{errors.username}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        New Password *
                                    </label>
                                    <input
                                        type="password"
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={handleChange}
                                        className={`input-field ${errors.newPassword ? 'border-red-500' : ''}`}
                                        placeholder="Enter strong password"
                                    />
                                    {errors.newPassword && (
                                        <p className="text-red-500 text-xs mt-1">{errors.newPassword}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                        Must contain: 8+ characters, uppercase, lowercase, number, special character
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Confirm Password *
                                    </label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className={`input-field ${errors.confirmPassword ? 'border-red-500' : ''}`}
                                        placeholder="Re-enter password"
                                    />
                                    {errors.confirmPassword && (
                                        <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Contact Info */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                                    Contact Information
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className={`input-field ${errors.phone ? 'border-red-500' : ''}`}
                                            placeholder="9876543210"
                                            maxLength="10"
                                        />
                                        {errors.phone && (
                                            <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-medium text-gray-700">
                                                WhatsApp Number
                                            </label>
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
                                            name="whatsapp"
                                            value={sameWhatsapp ? formData.phone : formData.whatsapp}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="WhatsApp number"
                                            maxLength="10"
                                            disabled={sameWhatsapp}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Date of Birth *
                                        </label>
                                        <input
                                            type="date"
                                            name="dob"
                                            value={formData.dob}
                                            onChange={handleChange}
                                            className={`input-field ${errors.dob ? 'border-red-500' : ''}`}
                                        />
                                        {errors.dob && (
                                            <p className="text-red-500 text-xs mt-1">{errors.dob}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Gender *
                                        </label>
                                        <CustomDropdown
                                            options={[
                                                { value: '', label: 'Select Gender' },
                                                { value: 'Male', label: 'Male' },
                                                { value: 'Female', label: 'Female' },
                                                { value: 'Other', label: 'Other' }
                                            ]}
                                            value={formData.gender}
                                            onChange={(val) => handleChange({ target: { name: 'gender', value: val } })}
                                        />
                                        {errors.gender && (
                                            <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        T-Shirt Size
                                    </label>
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
                                        value={formData.tshirtSize}
                                        onChange={(val) => handleChange({ target: { name: 'tshirtSize', value: val } })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Address
                                    </label>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            name="address.building"
                                            value={formData.address.building}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Building/House No."
                                        />
                                        <input
                                            type="text"
                                            name="address.street"
                                            value={formData.address.street}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Street"
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <input
                                                    type="text"
                                                    name="address.city"
                                                    value={formData.address.city}
                                                    onChange={handleChange}
                                                    className={`input-field ${errors['address.city'] ? 'border-red-500' : ''}`}
                                                    placeholder="City"
                                                />
                                                {errors['address.city'] && (
                                                    <p className="text-red-500 text-xs mt-1">{errors['address.city']}</p>
                                                )}
                                            </div>
                                            <div>
                                                <input
                                                    type="text"
                                                    name="address.state"
                                                    value={formData.address.state}
                                                    onChange={handleChange}
                                                    className={`input-field ${errors['address.state'] ? 'border-red-500' : ''}`}
                                                    placeholder="State"
                                                />
                                                {errors['address.state'] && (
                                                    <p className="text-red-500 text-xs mt-1">{errors['address.state']}</p>
                                                )}
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            name="address.postalCode"
                                            value={formData.address.postalCode}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Postal Code"
                                            maxLength="6"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Education (Students only) */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                                    {user?.role === 'student' ? 'Education Details' : 'Almost Done!'}
                                </h2>

                                {user?.role === 'student' ? (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Roll Number *
                                            </label>
                                            <input
                                                type="text"
                                                name="rollNumber"
                                                value={formData.rollNumber}
                                                onChange={handleChange}
                                                className={`input-field ${errors.rollNumber ? 'border-red-500' : ''}`}
                                                placeholder="20XX-DEPT-XXX"
                                            />
                                            {errors.rollNumber && (
                                                <p className="text-red-500 text-xs mt-1">{errors.rollNumber}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Institution (From Batch)
                                            </label>
                                            <input
                                                type="text"
                                                name="institution"
                                                value={formData.institution}
                                                readOnly
                                                disabled
                                                className="input-field bg-gray-100 cursor-not-allowed"
                                                placeholder="Auto-filled from your batch"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">This is automatically set from your batch</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Degree (From Batch)
                                                </label>
                                                <input
                                                    type="text"
                                                    name="degree"
                                                    value={formData.degree}
                                                    readOnly
                                                    disabled
                                                    className="input-field bg-gray-100 cursor-not-allowed"
                                                    placeholder="Auto-filled from your batch"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">This is automatically set from your batch</p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Branch *
                                                </label>
                                                <CustomDropdown
                                                    options={[
                                                        { value: '', label: 'Select your branch' },
                                                        ...availableBranches.map((branch) => ({ value: branch, label: branch }))
                                                    ]}
                                                    value={formData.branch}
                                                    onChange={(val) => handleChange({ target: { name: 'branch', value: val } })}
                                                />
                                                {errors.branch && (
                                                    <p className="text-red-500 text-xs mt-1">{errors.branch}</p>
                                                )}
                                                {availableBranches.length === 0 && (
                                                    <p className="text-xs text-gray-500 mt-1">No branches available for this batch</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Start Year (From Batch)
                                                </label>
                                                <input
                                                    type="number"
                                                    name="startYear"
                                                    value={formData.startYear}
                                                    readOnly
                                                    disabled
                                                    className="input-field bg-gray-100 cursor-not-allowed"
                                                    placeholder="Auto-filled"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    End Year (From Batch)
                                                </label>
                                                <input
                                                    type="number"
                                                    name="endYear"
                                                    value={formData.endYear}
                                                    readOnly
                                                    disabled
                                                    className="input-field bg-gray-100 cursor-not-allowed"
                                                    placeholder="Auto-filled"
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="text-6xl mb-4">✅</div>
                                        <p className="text-gray-600 mb-4">
                                            Your profile is ready to be submitted!
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            Click submit to complete your registration.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
                            {step > 1 && (
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="btn-secondary"
                                    disabled={loading}
                                >
                                    ← Back
                                </button>
                            )}

                            {step < 3 ? (
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="btn-primary ml-auto"
                                >
                                    Next →
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className="btn-primary ml-auto"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Submitting...
                                        </>
                                    ) : (
                                        'Complete Profile ✓'
                                    )}
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Logout Option */}
                <div className="text-center mt-6">
                    <button
                        onClick={async () => {
                            await logout();
                        }}
                        className="text-sm text-gray-600 hover:text-gray-900"
                    >
                        Logout and return to login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompleteProfile;
