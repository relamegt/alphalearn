import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import authService from '../../services/authService';
import uploadService from '../../services/uploadService';
import toast from 'react-hot-toast';

const CompleteProfile = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);

    const [formData, setFormData] = useState({
        // Basic Info
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
        stream: '',
        startYear: '',
        endYear: ''
    });

    const [errors, setErrors] = useState({});
    const [availableStreams, setAvailableStreams] = useState([]);

    // Fetch user data to pre-fill education from batch
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const userData = await authService.getCurrentUser();
                if (userData && userData.education) {
                    setFormData(prev => ({
                        ...prev,
                        institution: userData.education.institution || '',
                        degree: userData.education.degree || '',
                        startYear: userData.education.startYear || '',
                        endYear: userData.education.endYear || ''
                        // stream and rollNumber remain empty for user to fill
                    }));
                }

                // Fetch batch data to get available streams
                if (userData && userData.batchId) {
                    try {
                        const batchData = await authService.getBatchDetails(userData.batchId);
                        setAvailableStreams(batchData.streams || []);
                    } catch (error) {
                        console.error('Error fetching batch streams:', error);
                    }
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

        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
        } else if (!/^\d{10}$/.test(formData.phone)) {
            newErrors.phone = 'Phone number must be 10 digits';
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

        if (!formData.stream.trim()) {
            newErrors.stream = 'Branch/Stream is required';
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
        // ...validation...
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
                firstName: formData.firstName,
                lastName: formData.lastName,
                newPassword: formData.newPassword,
                profilePicture: profilePictureUrl,
                phone: formData.phone,
                whatsapp: formData.whatsapp || formData.phone,
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
                profileData.stream = formData.stream;
                profileData.startYear = formData.startYear ? parseInt(formData.startYear) : null;
                profileData.endYear = formData.endYear ? parseInt(formData.endYear) : null;
            }

            await authService.completeFirstLoginProfile(profileData);

            toast.success('Profile completed successfully! Please login with your new password.');

            // Logout and redirect to login
            await logout();
            navigate('/login', { state: { message: 'Profile completed. Please login with your new password.' } });
        } catch (error) {
            toast.error(error.message || 'Failed to complete profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Welcome to AlphaLearn! 🎉
                    </h1>
                    <p className="text-gray-600">
                        Complete your profile to get started
                    </p>
                </div>

                {/* Progress Steps */}
                <div className="mb-8">
                    <div className="flex justify-between items-center">
                        {[1, 2, 3].map((stepNumber) => (
                            <div key={stepNumber} className="flex-1 flex items-center">
                                <div className="flex flex-col items-center flex-1">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= stepNumber
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-300 text-gray-600'
                                            }`}
                                    >
                                        {step > stepNumber ? '✓' : stepNumber}
                                    </div>
                                    <span className="text-xs mt-2 text-gray-600">
                                        {stepNumber === 1 && 'Basic Info'}
                                        {stepNumber === 2 && 'Contact'}
                                        {stepNumber === 3 && user?.role === 'student' ? 'Education' : 'Finish'}
                                    </span>
                                </div>
                                {stepNumber < 3 && (
                                    <div
                                        className={`flex-1 h-1 mx-2 ${step > stepNumber ? 'bg-primary-600' : 'bg-gray-300'
                                            }`}
                                    ></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-lg shadow-xl p-8">
                    <form onSubmit={handleSubmit}>
                        {/* Step 1: Basic Info */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                                    Basic Information
                                </h2>

                                {/* Profile Picture Upload */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Profile Picture (Optional)
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
                                            Phone Number *
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
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            WhatsApp Number
                                        </label>
                                        <input
                                            type="tel"
                                            name="whatsapp"
                                            value={formData.whatsapp}
                                            onChange={handleChange}
                                            className="input-field"
                                            placeholder="Same as phone (optional)"
                                            maxLength="10"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Date of Birth
                                        </label>
                                        <input
                                            type="date"
                                            name="dob"
                                            value={formData.dob}
                                            onChange={handleChange}
                                            className="input-field"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Gender *
                                        </label>
                                        <select
                                            name="gender"
                                            value={formData.gender}
                                            onChange={handleChange}
                                            className={`input-field ${errors.gender ? 'border-red-500' : ''}`}
                                        >
                                            <option value="">Select Gender</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                        {errors.gender && (
                                            <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        T-Shirt Size (Optional)
                                    </label>
                                    <select
                                        name="tshirtSize"
                                        value={formData.tshirtSize}
                                        onChange={handleChange}
                                        className="input-field"
                                    >
                                        <option value="">Select Size</option>
                                        <option value="XS">XS</option>
                                        <option value="S">S</option>
                                        <option value="M">M</option>
                                        <option value="L">L</option>
                                        <option value="XL">XL</option>
                                        <option value="XXL">XXL</option>
                                        <option value="XXXL">XXXL</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Address (Optional)
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
                                            <input
                                                type="text"
                                                name="address.city"
                                                value={formData.address.city}
                                                onChange={handleChange}
                                                className="input-field"
                                                placeholder="City"
                                            />
                                            <input
                                                type="text"
                                                name="address.state"
                                                value={formData.address.state}
                                                onChange={handleChange}
                                                className="input-field"
                                                placeholder="State"
                                            />
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
                                                    Branch/Stream *
                                                </label>
                                                <select
                                                    name="stream"
                                                    value={formData.stream}
                                                    onChange={handleChange}
                                                    className={`input-field ${errors.stream ? 'border-red-500' : ''}`}
                                                    required
                                                >
                                                    <option value="">Select your branch/stream</option>
                                                    {availableStreams.map((stream, index) => (
                                                        <option key={index} value={stream}>{stream}</option>
                                                    ))}
                                                </select>
                                                {errors.stream && (
                                                    <p className="text-red-500 text-xs mt-1">{errors.stream}</p>
                                                )}
                                                {availableStreams.length === 0 && (
                                                    <p className="text-xs text-gray-500 mt-1">No streams available for this batch</p>
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
                                            <span className="spinner mr-2"></span>
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
                            navigate('/login');
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
