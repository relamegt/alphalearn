import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
            navigate('/login');
            toast.success('Logged out successfully');
        } catch (error) {
            toast.error('Logout failed');
            setIsLoggingOut(false);
        }
    };

    if (!user) return null;

    const getNavLinks = () => {
        // ... existing getNavLinks ...
        const commonStyle = "flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 text-gray-700 transition-colors w-full text-left";

        // Icons
        const Icons = {
            Dashboard: <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
            Practice: <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
            Contest: <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
            Leaderboard: <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
            Profile: <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
            Settings: <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        };

        const menus = {
            admin: [
                { to: '/admin/dashboard', label: 'Dashboard', icon: Icons.Dashboard },
                { to: '/admin/batches', label: 'Batches', icon: Icons.Practice },
                { to: '/admin/users', label: 'Users', icon: Icons.Profile },
                { to: '/admin/problems', label: 'Problems', icon: Icons.Practice },
                { to: '/admin/sections', label: 'Sections', icon: Icons.Leaderboard },
                { to: '/admin/contests', label: 'Contests', icon: Icons.Contest },
                { to: '/admin/reports', label: 'Reports', icon: Icons.Dashboard },
                { to: '/admin/problems-workspace', label: 'Problems Workspace', icon: Icons.Practice, newTab: true },
            ],
            // ...
            instructor: [
                { to: '/instructor/dashboard', label: 'Dashboard', icon: Icons.Dashboard },
                { to: '/instructor/contests', label: 'Contests', icon: Icons.Contest },
                { to: '/instructor/reports', label: 'Reports', icon: Icons.Dashboard },
                { to: '/instructor/problems-workspace', label: 'Problems Workspace', icon: Icons.Practice, newTab: true },
                { to: '/instructor/reset-profile', label: 'Reset Profile', icon: Icons.Profile },
            ],
            student: [
                { to: '/student/dashboard', label: 'Dashboard', icon: Icons.Dashboard },
                { to: '/student/problems', label: 'Practice', icon: Icons.Practice, newTab: true },
                {
                    label: 'Contests',
                    icon: Icons.Contest,
                    children: [
                        { to: '/student/contests', label: 'Internal Contests' },
                        { to: '/student/leaderboard?type=contest', label: 'External Contests' },
                    ]
                },
                { to: '/student/batch-leaderboard', label: 'Batch Leaderboard', icon: Icons.Leaderboard, newTab: true },
                {
                    label: 'Settings',
                    icon: Icons.Settings,
                    children: [
                        { to: '/student/settings/personal', label: 'Personal details' },
                        { to: '/student/settings/professional', label: 'Professional details' },
                        { to: '/student/settings/coding', label: 'Coding profiles' },
                        { to: '/student/settings/security', label: 'Change password' },
                    ]
                },
            ]
        };

        return menus[user.role] || [];
    };

    const links = getNavLinks();

    return (
        <nav className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo (Left side) */}
                    <div className="flex-shrink-0 flex items-center">
                        <Link to="/" className="flex items-center space-x-2">
                            {/* Assuming logo image or text */}
                            {/* Placeholder Logo Icon */}
                            <div className="bg-yellow-400 p-1.5 rounded-full">
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold text-gray-800 tracking-tight">AlphaLearn</span>
                        </Link>
                    </div>

                    {/* Right Side: Profile & Dropdown */}
                    <div className="flex items-center">
                        <div className="relative group h-16 flex items-center">
                            <button className="flex items-center space-x-3 text-gray-700 hover:text-gray-900 focus:outline-none transition-colors px-3 py-2 rounded-md hover:bg-gray-50">
                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 border border-gray-300">
                                    {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                                </div>
                                <span className="font-medium text-sm hidden md:block">
                                    {user.username || user.firstName}
                                </span>
                                <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-700 transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Dropdown Menu */}
                            <div className="absolute top-[60px] right-0 w-64 bg-white rounded-lg shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1)] border border-gray-100 hidden group-hover:block z-50 py-2">
                                {/* Header in Dropdown (optional context) */}
                                <div className="px-4 py-3 border-b border-gray-100 mb-1">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{user.firstName} {user.lastName}</p>
                                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                </div>

                                {/* Menu Items */}
                                <div className="space-y-0.5">
                                    {links.map((link, idx) => (
                                        <div key={idx} className="relative group/item">
                                            {link.children ? (
                                                <>
                                                    <button className="w-[calc(100%-1rem)] flex items-center justify-between px-4 py-2.5 mx-2 rounded-md hover:bg-blue-50 text-gray-700 hover:text-primary-600 transition-all text-sm font-medium">
                                                        <div className="flex items-center space-x-3">
                                                            <span className="opacity-70 group-hover:opacity-100 transition-opacity">
                                                                {link.icon}
                                                            </span>
                                                            <span>{link.label}</span>
                                                        </div>
                                                    </button>
                                                    {/* Submenu Flyout */}
                                                    <div className="absolute right-full top-0 pr-1 hidden group-hover/item:block z-50">
                                                        <div className="w-56 bg-white rounded-lg shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1)] border border-gray-100 py-1">
                                                            {link.children.map((child, cIdx) => (
                                                                <Link
                                                                    key={cIdx}
                                                                    to={child.to}
                                                                    className="block px-4 py-2.5 hover:bg-blue-50 text-gray-700 hover:text-primary-600 transition-all text-sm font-medium truncate"
                                                                >
                                                                    {child.label}
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <Link
                                                    to={link.to}
                                                    target={link.newTab ? "_blank" : undefined}
                                                    rel={link.newTab ? "noopener noreferrer" : undefined}
                                                    className="flex items-center space-x-3 px-4 py-2.5 mx-2 rounded-md hover:bg-blue-50 text-gray-700 hover:text-primary-600 transition-all text-sm font-medium w-[calc(100%-1rem)]"
                                                >
                                                    <span className="opacity-70 group-hover:opacity-100 transition-opacity">
                                                        {link.icon}
                                                    </span>
                                                    <span>{link.label}</span>
                                                </Link>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Divider */}
                                <div className="my-2 border-t border-gray-100" />

                                {/* Logout */}
                                <button
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="w-[calc(100%-1rem)] flex items-center space-x-3 px-4 py-2.5 mx-2 rounded-md hover:bg-red-50 text-gray-700 hover:text-red-600 transition-all text-sm font-medium text-left disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isLoggingOut ? (
                                        <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                    )}
                                    <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
