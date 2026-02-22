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
        <div className="min-h-screen flex bg-white font-sans">
            {/* Left Side - Brand/Illustration */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 justify-center items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-blue-500/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"></div>
                    <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-indigo-500/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                </div>

                <div className="relative z-10 text-center px-12 max-w-2xl transform transition-transform duration-700 hover:scale-105">
                    <div className="inline-flex items-center justify-center p-5 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl mb-8">
                        <svg className="w-20 h-20 text-blue-200 drop-shadow-xl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
                        Secure Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">Account</span>
                    </h1>
                    <p className="text-lg lg:text-xl text-blue-100/90 leading-relaxed font-light">
                        Create a strong, unique password to keep your AlphaKnowledge account safe and sound.
                    </p>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-gray-50/50 relative">
                <div className="max-w-md w-full space-y-8">
                    {/* Mobile Header */}
                    <div className="text-center lg:hidden">
                        <div className="inline-flex justify-center mb-6 p-4 bg-white rounded-full shadow-md border border-gray-100">
                            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            Set New Password
                        </h2>
                        <p className="mt-2 text-sm text-gray-500 font-medium whitespace-pre-wrap">
                            Enter the OTP sent to{'\n'}<strong className="text-blue-600">{formData.email}</strong>
                        </p>
                    </div>

                    <div className="hidden lg:block mb-10">
                        <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">Set New Password</h2>
                        <p className="text-base text-gray-500 font-medium">Enter the OTP sent to <strong className="text-blue-600">{formData.email}</strong></p>
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* OTP */}
                            <div>
                                <label htmlFor="otp" className="block text-sm font-semibold text-gray-700 mb-2">
                                    6-Digit OTP
                                </label>
                                <div className="relative group">
                                    <input
                                        id="otp"
                                        name="otp"
                                        type="text"
                                        maxLength="6"
                                        value={formData.otp}
                                        onChange={handleChange}
                                        className={`input-field h-14 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all text-center text-3xl tracking-[0.5em] font-bold text-blue-900 ${errors.otp ? 'border-red-500' : ''
                                            }`}
                                        placeholder="------"
                                        required
                                    />
                                </div>
                                {errors.otp && <p className="mt-2 text-sm text-red-600 font-medium">{errors.otp}</p>}
                            </div>

                            <div className="pt-2">
                                {/* New Password */}
                                <div className="mb-5">
                                    <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                                        New Password
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        </div>
                                        <input
                                            id="newPassword"
                                            name="newPassword"
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.newPassword}
                                            onChange={handleChange}
                                            className={`input-field pl-11 pr-12 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all ${errors.newPassword ? 'border-red-500' : ''}`}
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600 transition-colors"
                                        >
                                            {showPassword ? (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                </svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                    {errors.newPassword && (
                                        <p className="mt-2 text-sm text-red-600 font-medium">{errors.newPassword}</p>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Confirm Password
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                        </div>
                                        <input
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            type="password"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                            className={`input-field pl-11 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all ${errors.confirmPassword ? 'border-red-500' : ''}`}
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                    {errors.confirmPassword && (
                                        <p className="mt-2 text-sm text-red-600 font-medium">{errors.confirmPassword}</p>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-primary h-12 rounded-xl flex justify-center items-center text-base font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 transition-all duration-200 mt-8"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Resetting Password...
                                    </>
                                ) : (
                                    'Reset Password'
                                )}
                            </button>

                            <div className="text-center mt-6">
                                <Link
                                    to="/forgot-password"
                                    className="inline-flex items-center text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors"
                                >
                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    Resend OTP
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
