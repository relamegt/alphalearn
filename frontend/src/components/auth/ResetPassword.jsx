import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import authService from '../../services/authService';
import toast from 'react-hot-toast';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        email: searchParams.get('email') || '',
        otp: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!formData.email) {
            toast.error('Email is missing. Please restart the process.');
            navigate('/forgot-password');
        }
    }, [formData.email, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: '' }));
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.otp || formData.otp.length !== 6) {
            newErrors.otp = 'OTP must be 6 digits';
        }

        if (!formData.newPassword) {
            newErrors.newPassword = 'Password is required';
        } else if (formData.newPassword.length < 8) {
            newErrors.newPassword = 'Password must be at least 8 characters';
        }

        if (formData.newPassword !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        try {
            const response = await authService.resetPassword(
                formData.email,
                formData.otp,
                formData.newPassword
            );
            toast.success(response.message);
            navigate('/login');
        } catch (error) {
            toast.error(error.message || 'Password reset failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4">
            <div className="max-w-md w-full bg-white p-10 rounded-xl shadow-2xl">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900">Reset Password</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Enter the OTP sent to <strong>{formData.email}</strong>
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* OTP */}
                    <div>
                        <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                            6-Digit OTP
                        </label>
                        <input
                            id="otp"
                            name="otp"
                            type="text"
                            maxLength="6"
                            value={formData.otp}
                            onChange={handleChange}
                            className={`mt-1 input-field text-center text-2xl tracking-widest ${errors.otp ? 'border-red-500' : ''
                                }`}
                            placeholder="123456"
                            required
                        />
                        {errors.otp && <p className="mt-1 text-sm text-red-600">{errors.otp}</p>}
                    </div>

                    {/* New Password */}
                    <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                            New Password
                        </label>
                        <div className="relative mt-1">
                            <input
                                id="newPassword"
                                name="newPassword"
                                type={showPassword ? 'text' : 'password'}
                                value={formData.newPassword}
                                onChange={handleChange}
                                className={`input-field ${errors.newPassword ? 'border-red-500' : ''}`}
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                        {errors.newPassword && (
                            <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                            Confirm Password
                        </label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className={`mt-1 input-field ${errors.confirmPassword ? 'border-red-500' : ''}`}
                            placeholder="••••••••"
                            required
                        />
                        {errors.confirmPassword && (
                            <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary flex justify-center items-center"
                    >
                        {loading ? (
                            <>
                                <span className="spinner mr-2"></span>
                                Resetting Password...
                            </>
                        ) : (
                            'Reset Password'
                        )}
                    </button>

                    <div className="text-center">
                        <Link
                            to="/forgot-password"
                            className="text-sm font-medium text-primary-600 hover:text-primary-500"
                        >
                            ← Resend OTP
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
