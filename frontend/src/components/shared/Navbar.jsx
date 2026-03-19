import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import toast from 'react-hot-toast';
import { useTheme } from '../../contexts/ThemeContext';

const NavItem = ({ link, isDark, setIsMenuOpen }) => {
    const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
    
    if (link.children) {
        return (
            <div className="relative group/item">
                <button 
                    onClick={() => setIsSubmenuOpen(!isSubmenuOpen)}
                    className={`w-[calc(100%-1rem)] flex items-center justify-between px-4 py-2.5 mx-2 rounded-md transition-all text-sm font-medium ${isSubmenuOpen ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#23232e]'}`}
                >
                    <div className="flex items-center space-x-3">
                        <span className={`opacity-70 group-hover/item:opacity-100 transition-opacity ${isSubmenuOpen ? 'opacity-100' : ''}`}>
                            {link.icon}
                        </span>
                        <span>{link.label}</span>
                    </div>
                    <svg className={`w-3.5 h-3.5 transition-transform duration-200 lg:hidden ${isSubmenuOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
                
                {/* Submenu - Accordion style on mobile */}
                <div className={`${isSubmenuOpen ? 'block' : 'hidden'} lg:hidden bg-gray-50 dark:bg-[#1a1a24] mx-2 mt-0.5 rounded-md overflow-hidden animate-in slide-in-from-top-1 duration-200`}>
                    {link.children.map((child, cIdx) => (
                        <Link
                            key={cIdx}
                            to={child.to}
                            onClick={() => setIsMenuOpen(false)}
                            className="block px-11 py-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 text-xs font-semibold transition-colors"
                        >
                            {child.label}
                        </Link>
                    ))}
                </div>

                {/* Desktop Flyout */}
                <div className="absolute right-full top-0 pr-1 hidden lg:group-hover/item:block z-[500]">
                    <div className={`w-56 bg-white dark:bg-[#111117] rounded-lg border border-gray-100 dark:border-gray-700 py-1 ${!isDark ? 'shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1)]' : ''}`}>
                        {link.children.map((child, cIdx) => (
                            <Link
                                key={cIdx}
                                to={child.to}
                                onClick={() => setIsMenuOpen(false)}
                                className="block px-4 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-500/10 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-all text-sm font-medium truncate"
                            >
                                {child.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative group/item">
            <Link
                to={link.to}
                target={link.newTab ? "_blank" : undefined}
                rel={link.newTab ? "noopener noreferrer" : undefined}
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-2.5 mx-2 rounded-md hover:bg-primary-50 dark:hover:bg-primary-500/10 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-all text-sm font-medium w-[calc(100%-1rem)]"
            >
                <span className="opacity-70 group-hover/item:opacity-100 transition-opacity">
                    {link.icon}
                </span>
                <span>{link.label}</span>
            </Link>
        </div>
    );
};

const Navbar = () => {
    const { user, logout } = useAuth();
    const { isDark } = useTheme();
    const navigate = useNavigate();

    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logout();
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
                { to: '/problems', label: 'Problems Workspace', icon: Icons.Practice, newTab: true },
                {
                    label: 'Settings',
                    icon: Icons.Settings,
                    children: [
                        { to: '/admin/settings/personal', label: 'Personal details' },
                        { to: '/admin/settings/security', label: 'Change password' },
                    ]
                },
            ],
            // ...
            instructor: [
                { to: '/instructor/dashboard', label: 'Dashboard', icon: Icons.Dashboard },
                { to: '/instructor/contests', label: 'Contests', icon: Icons.Contest },
                { to: '/instructor/reports', label: 'Reports', icon: Icons.Dashboard },
                { to: '/problems', label: 'Problems Workspace', icon: Icons.Practice, newTab: true },
                { to: '/instructor/reset-profile', label: 'Reset Profile', icon: Icons.Profile },
                {
                    label: 'Settings',
                    icon: Icons.Settings,
                    children: [
                        { to: '/instructor/settings/personal', label: 'Personal details' },
                        { to: '/instructor/settings/security', label: 'Change password' },
                    ]
                },
            ],
            student: [
                { to: '/student/dashboard', label: 'Dashboard', icon: Icons.Dashboard },
                { to: '/problems', label: 'Practice Workspace', icon: Icons.Practice, newTab: true },
                {
                    label: 'Contests',
                    icon: Icons.Contest,
                    children: [
                        { to: '/student/contests', label: 'Internal Contests' },
                        { to: '/student/leaderboard?type=contest', label: 'External Contests' },
                    ]
                },
                { to: `/${user?.batchName ? encodeURIComponent(user.batchName) : (user?.batchId || 'unassigned')}/leaderboard`, label: 'Batch Leaderboard', icon: Icons.Leaderboard, newTab: true },
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
        <nav className="bg-white dark:bg-[#111117] border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo (Left side) */}
                    <div className="flex-shrink-0 flex items-center">
                        <Link to="/" className="flex items-center space-x-1.5 sm:space-x-2">
                            <img
                                src="/alphalogo.png"
                                alt="AlphaKnowledge"
                                className="h-6 sm:h-8 w-auto object-contain"
                            />
                            <span className="text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">AlphaKnowledge</span>
                        </Link>
                    </div>

                    {/* Right Side: Theme Toggle & Profile & Dropdown */}
                    <div className="flex items-center gap-2">
                        {/* Theme Toggle */}
                        <ThemeToggle size="sm" className="sm:size-9" />

                        <div className="relative h-16 flex items-center" ref={menuRef}>
                            <button 
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className="flex items-center space-x-2 sm:space-x-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white focus:outline-none transition-colors px-2 sm:px-3 py-1.5 sm:py-2 rounded-md hover:bg-gray-50 dark:hover:bg-[#23232e]"
                            >
                                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 overflow-hidden shrink-0">
                                    {user.profile?.profilePicture ? (
                                        <img
                                            src={user.profile.profilePicture}
                                            alt={user.firstName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <>
                                            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                                        </>
                                    )}
                                </div>
                                <span className="font-medium text-sm hidden md:block">
                                    {user.username || user.firstName}
                                </span>
                                <svg className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isMenuOpen ? 'rotate-180 text-gray-900 dark:text-white' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                                <div className={`absolute top-[60px] right-0 w-64 bg-white dark:bg-[#111117] rounded-lg border border-gray-100 dark:border-gray-700 block z-[500] py-2 ${!isDark ? 'shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1)]' : ''}`}>
                                {/* Header in Dropdown (optional context) */}
                                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 mb-1">
                                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{user.firstName} {user.lastName}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                                </div>

                                {/* Menu Items */}
                                <div className="space-y-0.5">
                                    {links.map((link, idx) => (
                                        <NavItem key={idx} link={link} isDark={isDark} setIsMenuOpen={setIsMenuOpen} />
                                    ))}
                                </div>

                                {/* Divider */}
                                <div className="my-2 border-t border-gray-100 dark:border-gray-700" />

                                {/* Logout */}
                                <button
                                    onClick={handleLogout}
                                    disabled={isLoggingOut}
                                    className="w-[calc(100%-1rem)] flex items-center space-x-3 px-4 py-2.5 mx-2 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-all text-sm font-medium text-left disabled:opacity-70 disabled:cursor-not-allowed"
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
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
