import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import leaderboardService from '../services/leaderboardService';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const initAuth = async () => {
            try {
                if (authService.isAuthenticated()) {
                    const userData = await authService.getCurrentUser();
                    setUser(userData);
                    setIsAuthenticated(true);

                    if (userData.isFirstLogin && !userData.isSpotUser && window.location.pathname !== '/complete-profile') {
                        navigate('/complete-profile');
                    }
                }
            } catch (error) {
                console.error('Auth initialization failed:', error);
                setUser(null);
                setIsAuthenticated(false);
                await authService.logout();
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, [navigate]);

    const login = async (email, password) => {
        try {
            const response = await authService.login(email, password);

            if (response.success) {
                setUser(response.user);
                setIsAuthenticated(true);

                if (response.sessionReplaced) {
                    toast('⚠️ Your previous session was automatically logged out', {
                        duration: 5000,
                        icon: '🔐'
                    });
                }

                if (response.isFirstLogin) {
                    toast.success('Welcome! Please complete your profile to get started.');
                    navigate('/complete-profile');
                } else {
                    toast.success(`Welcome back, ${response.user.firstName || 'User'}!`);

                    switch (response.user.role) {
                        case 'admin':
                            navigate('/admin/dashboard');
                            break;
                        case 'instructor':
                            navigate('/instructor/dashboard');
                            break;
                        case 'student':
                            navigate('/student/dashboard');
                            break;
                        default:
                            navigate('/');
                    }
                }

                return {
                    success: true,
                    isFirstLogin: response.isFirstLogin,
                    sessionReplaced: response.sessionReplaced
                };
            }
        } catch (error) {
            const errorMessage = error.message || 'Login failed';
            toast.error(errorMessage);

            if (error.code === 'MULTIPLE_SESSION_DETECTED') {
                toast.error('Already logged in on another device!', { duration: 5000 });
            }

            throw error;
        }
    };

    const loginAsSpotUser = (userData, token) => {
        authService.spotLogin(userData, token);
        setUser(userData);
        setIsAuthenticated(true);
        toast.success('Joined contest successfully!');
    };

    const completeProfile = async (profileData) => {
        try {
            await authService.completeFirstLoginProfile(profileData);

            setUser(null);
            setIsAuthenticated(false);

            toast.success('Profile completed successfully! Please login with your new password.', {
                duration: 5000
            });

            navigate('/login', {
                state: {
                    message: 'Profile completed successfully! Please login with your new password.'
                }
            });

            return { success: true };
        } catch (error) {
            toast.error(error.message || 'Profile completion failed');
            throw error;
        }
    };

    const logout = async () => {
        try {
            await authService.logout();

            // Clear all leaderboard caches on logout
            leaderboardService.clearAllCaches();
            console.log('🗑️ All caches cleared on logout');

            setUser(null);
            setIsAuthenticated(false);
            toast.success('Logged out successfully');
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);

            // Force clear caches even if API fails
            leaderboardService.clearAllCaches();

            setUser(null);
            setIsAuthenticated(false);
            navigate('/login');
        }
    };

    const updateUser = (updatedData) => {
        const updatedUser = { ...user, ...updatedData };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
    };

    const refreshUser = async () => {
        try {
            const userData = await authService.getCurrentUser();
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            return userData;
        } catch (error) {
            console.error('Refresh user error:', error);
            throw error;
        }
    };

    const value = {
        user,
        loading,
        isAuthenticated,
        login,
        loginAsSpotUser,
        logout,
        completeProfile,
        updateUser,
        refreshUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
