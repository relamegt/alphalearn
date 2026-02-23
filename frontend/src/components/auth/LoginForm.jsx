import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';


const LoginForm = () => {
    const { login } = useAuth();
    const location = useLocation();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});


    // Show message from state (e.g., after profile completion)
    useEffect(() => {
        if (location.state?.message) {
            toast.success(location.state.message, { duration: 6000 });
            // Clear the state to prevent showing message on refresh
            window.history.replaceState({}, document.title);
        }


        // Show session expired message from query params
        const params = new URLSearchParams(location.search);
        if (params.get('reason') === 'session_expired') {
            toast.error('Your session has expired. Please login again.');
        }
    }, [location]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        // Clear error for this field when user starts typing
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };


    const validateForm = () => {
        const newErrors = {};


        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }


        if (!formData.password) {
            newErrors.password = 'Password is required';
        }


        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };


    const handleSubmit = async (e) => {
        e.preventDefault();


        if (!validateForm()) {
            return;
        }


        setLoading(true);
        try {
            await login(formData.email.trim(), formData.password);
            // Success handling is done in the login function
        } catch (error) {
            console.error('Login error:', error);
            // Error toast is already shown in login function
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="min-h-screen flex bg-white font-sans">
            {/* Left Side - Brand/Illustration */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 justify-center items-center relative overflow-hidden">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-blue-500/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse"></div>
                    <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-indigo-500/30 rounded-full mix-blend-screen filter blur-[100px] animate-pulse" style={{ animationDelay: '2s' }}></div>
                </div>

                <div className="relative z-10 text-center px-12 max-w-2xl transform transition-transform duration-700 hover:scale-105">
                    <div className="inline-flex items-center justify-center p-5 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 shadow-2xl mb-8">
                        <img
                            src="/alphalogo.png"
                            alt="AlphaKnowledge"
                            className="w-24 h-24 object-contain drop-shadow-xl"
                        />
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
                        Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">AlphaKnowledge</span>
                    </h1>
                    <p className="text-lg lg:text-xl text-blue-100/90 leading-relaxed font-light">
                        Accelerate your learning journey with cutting-edge tools, comprehensive resources, and a vibrant community.
                    </p>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-gray-50/50 relative">
                <div className="max-w-md w-full space-y-8">
                    {/* Mobile Header */}
                    <div className="text-center lg:hidden">
                        <div className="inline-flex justify-center mb-6 p-4 bg-white rounded-full shadow-md border border-gray-100">
                            <img
                                src="/alphalogo.png"
                                alt="AlphaKnowledge"
                                className="w-14 h-14 object-contain"
                            />
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            AlphaKnowledge
                        </h2>
                        <p className="mt-2 text-sm text-gray-500 font-medium">
                            Sign in to continue your learning journey
                        </p>
                    </div>

                    <div className="hidden lg:block mb-10">
                        <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">Sign in</h2>
                        <p className="text-base text-gray-500 font-medium">Please enter your credentials to access your account.</p>
                    </div>

                    {/* Form container */}
                    <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div className="space-y-5">
                                {/* Email Field */}
                                <div>
                                    <label
                                        htmlFor="email"
                                        className="block text-sm font-semibold text-gray-700 mb-2"
                                    >
                                        Email Address
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className={`input-field pl-11 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all ${errors.email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                                            placeholder="you@example.com"
                                            disabled={loading}
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="mt-2 text-sm text-red-600 flex items-center font-medium">
                                            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            {errors.email}
                                        </p>
                                    )}
                                </div>

                                {/* Password Field */}
                                <div>
                                    <label
                                        htmlFor="password"
                                        className="block text-sm font-semibold text-gray-700 mb-2"
                                    >
                                        Password
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        </div>
                                        <input
                                            id="password"
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            autoComplete="current-password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            className={`input-field pl-11 pr-12 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all ${errors.password ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                                            placeholder="••••••••"
                                            disabled={loading}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600 transition-colors"
                                            disabled={loading}
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
                                    {errors.password && (
                                        <p className="mt-2 text-sm text-red-600 flex items-center font-medium">
                                            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            {errors.password}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Forgot Password Link */}
                            <div className="flex items-center justify-end">
                                <Link
                                    to="/forgot-password"
                                    className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                    Forgot your password?
                                </Link>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-primary h-12 rounded-xl flex justify-center items-center text-base font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 transition-all duration-200"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                        </svg>
                                        Sign in
                                    </>
                                )}
                            </button>

                            {/* Security Notice */}
                            {/* <div className="mt-6 p-4 bg-orange-50/80 border border-orange-100 rounded-xl flex items-start">
                                <svg className="w-5 h-5 text-orange-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="text-sm font-bold text-orange-800 mb-0.5">
                                        Single Session Security
                                    </p>
                                    <p className="text-xs text-orange-700 font-medium">
                                        Logging in here will automatically log you out from other devices for security reasons.
                                    </p>
                                </div>
                            </div> */}
                        </form>
                    </div>

                    {/* Help Text */}
                    <div className="text-center mt-6">
                        <p className="text-xs text-gray-400 font-medium">
                            Need help? <a href="#" className="text-blue-600 hover:text-blue-700">Contact your administrator</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default LoginForm;
