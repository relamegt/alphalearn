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
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4">
                <div className="max-w-md w-full bg-white p-10 rounded-xl shadow-2xl text-center">
                    <div className="text-6xl mb-4">📧</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">OTP Sent!</h2>
                    <p className="text-gray-600 mb-6">
                        We've sent a 6-digit OTP to <strong>{email}</strong>.
                        The OTP is valid for 10 minutes.
                    </p>
                    <Link
                        to={`/reset-password?email=${encodeURIComponent(email)}`}
                        className="btn-primary inline-block"
                    >
                        Enter OTP & Reset Password
                    </Link>
                    <p className="mt-4 text-sm text-gray-500">
                        Didn't receive the OTP? Check your spam folder.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 py-12 px-4">
            <div className="max-w-md w-full bg-white p-10 rounded-xl shadow-2xl">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900">Forgot Password?</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Enter your email to receive a password reset OTP
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                            Email Address
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 input-field"
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary flex justify-center items-center"
                    >
                        {loading ? (
                            <>
                                <span className="spinner mr-2"></span>
                                Sending OTP...
                            </>
                        ) : (
                            'Send OTP'
                        )}
                    </button>

                    <div className="text-center">
                        <Link
                            to="/login"
                            className="text-sm font-medium text-primary-600 hover:text-primary-500"
                        >
                            ← Back to Login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ForgotPassword;
