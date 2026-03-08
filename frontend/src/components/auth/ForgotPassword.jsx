import { useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../../services/authService';
import toast from 'react-hot-toast';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        setLoading(true);
        try {
            const response = await authService.forgotPassword(email);
            toast.success(response.message);
            setOtpSent(true);
        } catch (error) {
            toast.error(error.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    if (otpSent) {
        return (
            <div className="min-h-screen flex bg-[#F7F5FF] dark:bg-[#111117] font-sans">
                {/* Left Side - Brand/Illustration (Unified Styling) */}
                <div className="hidden lg:flex lg:w-1/2 justify-center items-center relative overflow-hidden">
                    <div className="relative z-10 text-center px-12 max-w-2xl transform transition-transform duration-700 hover:scale-105 -mt-24">
                        <div className="inline-flex items-center justify-center p-0 mb-14">
                            <span className="text-6xl" role="img" aria-label="email">📧</span>
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-extrabold text-[#111827] dark:text-white mb-6 tracking-tight leading-normal">
                            Check your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-300 dark:to-blue-300">Inbox</span>
                        </h1>
                    </div>
                </div>

                {/* Right Side - OTP Sent Message */}
                <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 relative">
                    <div className="max-w-md w-full space-y-8">
                        <div className="bg-white dark:bg-[#111117] p-8 sm:p-10 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-none border border-gray-100 dark:border-gray-800 transition-all duration-300 text-center">
                            <div className="inline-flex items-center justify-center p-4 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-full mb-6">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight mb-4">OTP Sent!</h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-8 font-medium leading-relaxed">
                                We've sent a 6-digit OTP to <strong className="text-gray-900 dark:text-white">{email}</strong>.
                                The OTP is valid for 10 minutes.
                            </p>
                            <Link
                                to={`/reset-password?email=${encodeURIComponent(email)}`}
                                className="w-full btn-primary h-12 rounded-xl flex justify-center items-center text-base font-bold shadow-lg shadow-blue-500/30 dark:shadow-none hover:shadow-blue-500/50 dark:hover:shadow-none hover:-translate-y-0.5 transition-all duration-200"
                            >
                                Enter OTP & Reset Password
                            </Link>
                            <p className="mt-6 text-sm text-gray-400 font-medium tracking-wide">
                                Didn't receive the OTP? Check your spam folder.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-[#F7F5FF] dark:bg-[#111117] font-sans">
            {/* Left Side - Brand/Illustration (Unified Styling) */}
            <div className="hidden lg:flex lg:w-1/2 justify-center items-center relative overflow-hidden">
                <div className="relative z-10 text-center px-12 max-w-2xl transform transition-transform duration-700 hover:scale-105 -mt-24">
                    <div className="inline-flex items-center justify-center p-0 mb-14">
                        <svg className="w-20 h-20 text-indigo-600 dark:text-indigo-400 filter brightness-110 drop-shadow-xl" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-extrabold text-[#111827] dark:text-white mb-6 tracking-tight leading-tight whitespace-nowrap">
                        Forgot <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-300 dark:to-blue-300">Password?</span>
                    </h1>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 relative">
                <div className="max-w-md w-full space-y-8">
                    {/* Mobile Header */}
                    <div className="text-center lg:hidden">
                        <div className="inline-flex justify-center mb-6 p-4 bg-white dark:bg-[#111117] rounded-full shadow-md border border-gray-100 dark:border-gray-800">
                            <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
                            Password Reset
                        </h2>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                            Enter your email to receive an OTP
                        </p>
                    </div>

                    <div className="hidden lg:block mb-10">
                        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight mb-3">Password Reset</h2>
                        <p className="text-base text-gray-500 dark:text-gray-400 font-medium">Enter your email address to receive a secure one-time password.</p>
                    </div>

                    <div className="bg-white dark:bg-[#111117] p-8 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-none border border-gray-100 dark:border-gray-800 transition-all duration-300">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="email" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
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
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="input-field pl-11 h-12 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-all"
                                        placeholder="you@example.com"
                                        required
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full btn-primary h-12 rounded-xl flex justify-center items-center text-base font-bold shadow-lg shadow-blue-500/30 dark:shadow-none hover:shadow-blue-500/50 dark:hover:shadow-none hover:-translate-y-0.5 transition-all duration-200"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sending OTP...
                                    </>
                                ) : (
                                    'Send OTP'
                                )}
                            </button>

                            <div className="text-center mt-6">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    Back to Login
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
