import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
            toast.success('Logged out successfully');
        } catch (error) {
            toast.error('Logout failed');
        }
    };

    if (!user) return null;

    const getNavLinks = () => {
        switch (user.role) {
            case 'admin':
                return [
                    { to: '/admin/dashboard', label: 'Dashboard' },
                    { to: '/admin/batches', label: 'Batches' },
                    { to: '/admin/users', label: 'Users' },
                    { to: '/admin/problems', label: 'Problems' },
                    { to: '/admin/contests', label: 'Contests' },
                    { to: '/admin/reports', label: 'Reports' },
                ];
            case 'instructor':
                return [
                    { to: '/instructor/dashboard', label: 'Dashboard' },
                    { to: '/instructor/contests', label: 'Contests' },
                    { to: '/instructor/reports', label: 'Reports' },
                    { to: '/instructor/reset-profile', label: 'Reset Profile' },
                ];
            case 'student':
                return [
                    { to: '/student/dashboard', label: 'Dashboard' },
                    { to: '/student/problems', label: 'Problems' },
                    { to: '/student/contests', label: 'Contests' },
                    { to: '/student/leaderboard', label: 'Leaderboard' },
                    { to: '/student/profile', label: 'Profile' },
                ];
            default:
                return [];
        }
    };

    return (
        <nav className="bg-primary-600 text-white shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link to="/" className="text-2xl font-bold">
                        AlphaLearn
                    </Link>

                    {/* Navigation Links */}
                    <div className="flex space-x-6">
                        {getNavLinks().map((link) => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className="hover:text-primary-200 transition-colors font-medium"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>

                    {/* User Info & Logout */}
                    <div className="flex items-center space-x-4">
                        <span className="text-sm">
                            {user.firstName} {user.lastName} ({user.role})
                        </span>
                        <button
                            onClick={handleLogout}
                            className="bg-white text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
