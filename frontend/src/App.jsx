import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';
import { useTheme } from './contexts/ThemeContext';
import { loader } from '@monaco-editor/react';

// Define the Antigravity global Monaco dark theme
loader.init().then((monaco) => {
    monaco.editor.defineTheme('antigravity-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { background: '111117' }
        ],
        colors: {
            'editor.background': '#111117',
            'editor.lineHighlightBackground': '#00000000',
            'editor.lineHighlightBorder': '#00000000',
            'editor.selectionBackground': '#2E27AD80',
            'editorCursor.foreground': '#7d63f2',
            'editorIndentGuide.background': '#282833',
            'editorIndentGuide.activeBackground': '#333342',
            'editorWidget.background': '#181820',
            'editorWidget.border': '#282833',
            'minimap.background': '#111117',
            'dropdown.background': '#181820',
            'dropdown.border': '#282833',
            'list.hoverBackground': '#23232e',
        }
    });
});

// Auth Components
import LoginForm from './components/auth/LoginForm';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import CompleteProfile from './components/auth/CompleteProfile';
// Shared Components
import Navbar from './components/shared/Navbar';
import SecurityWrapper from './components/shared/SecurityWrapper';

// Public Components
import PublicProfile from './components/public/PublicProfile';

// Admin Components
import AdminDashboard from './components/admin/AdminDashboard';
import BatchManager from './components/admin/BatchManager';
import UserManagement from './components/admin/UserManagement';
import ProblemManager from './components/admin/ProblemManager';
import SectionManager from './components/admin/SectionManager';
import ContestManager from './components/admin/ContestManager';


// Instructor Components
import ProfileReset from './components/instructor/ProfileReset';
import ReportGenerator from './components/admin/ReportGenerator';
import InstructorDashboard from './components/instructor/InstructorDashboard';

// Student Components
import Dashboard from './components/student/Dashboard';
import ProblemList from './components/student/ProblemList';
import ContestList from './components/student/ContestList';
import CodeEditor from './components/student/CodeEditor';
import Leaderboard from './components/student/Leaderboard';
// Settings Components
import PersonalDetails from './components/student/settings/PersonalDetails';
import ProfessionalDetails from './components/student/settings/ProfessionalDetails';
import CodingProfiles from './components/student/settings/CodingProfiles';
import SecuritySettings from './components/student/settings/SecuritySettings';
import ContestInterface from './components/student/ContestInterface';
import ContestJoin from './components/student/ContestJoin';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles, hideNavbar = false }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-[#F7F5FF] dark:bg-[#111117] transition-colors">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!user) {
        const contestMatch = location.pathname.match(/^\/contests\/([^/]+)/);
        if (contestMatch) {
            const contestId = contestMatch[1];
            if (contestId && !location.pathname.includes('/leaderboard')) {
                return <Navigate to={`/join/${contestId}`} replace />;
            }
        }
        return <Navigate to="/login" replace />;
    }

    if (user.isSpotUser && user.registeredForContest) {
        const isContestPath = location.pathname.startsWith('/contests/') || location.pathname.startsWith('/join/');
        if (!isContestPath) {
            return <Navigate to={`/contests/${user.registeredForContest}`} replace />;
        }
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return (
        <>
            {!hideNavbar && !user.isSpotUser && <Navbar />}
            <div className="min-h-screen bg-[#F7F5FF] dark:bg-[#111117] transition-colors">{children}</div>
        </>
    );
};

// Public Route Component (only for non-authenticated users)
const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-[#F7F5FF] dark:bg-[#111117] transition-colors">
                <div className="spinner"></div>
            </div>
        );
    }

    if (user) {
        if (user.isSpotUser && user.registeredForContest) {
            return <Navigate to={`/contests/${user.registeredForContest}`} replace />;
        }
        // Redirect to role-based dashboard
        switch (user.role) {
            case 'admin':
                return <Navigate to="/admin/dashboard" replace />;
            case 'instructor':
                return <Navigate to="/instructor/dashboard" replace />;
            case 'student':
                return <Navigate to="/student/dashboard" replace />;
            default:
                return <Navigate to="/login" replace />;
        }
    }

    return children;
};

const DynamicToaster = () => {
    const location = useLocation();
    const path = location.pathname;
    const { isDark } = useTheme();

    // Show toasts at top-center for all coding interfaces so they don't
    // overlap the Run / Submit buttons on the right side of the screen.
    const isCodingInterface =
        path === '/problems' ||
        path.startsWith('/problems/') ||
        path.startsWith('/student/problems/') ||
        path.startsWith('/contests/');

    return (
        <Toaster
            position={isCodingInterface ? 'top-center' : 'top-right'}
            toastOptions={{
                style: {
                    maxWidth: 420,
                    borderRadius: '16px',
                    background: isDark ? '#111117' : '#ffffff',
                    color: isDark ? '#f8fafc' : '#111827',
                    border: isDark ? '1px solid #282833' : '1px solid #f3f4f6',
                    boxShadow: isDark
                        ? '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.5)'
                        : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    fontSize: '14px',
                    fontWeight: '500',
                    padding: '12px 16px',
                },
                success: {
                    iconTheme: {
                        primary: '#10b981',
                        secondary: '#ffffff',
                    },
                },
                error: {
                    iconTheme: {
                        primary: '#ef4444',
                        secondary: '#ffffff',
                    },
                },
            }}
        />
    );
};

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <DynamicToaster />
                <SecurityWrapper>
                    <Routes>
                        {/* ... existing routes ... */}
                        {/* Public Routes */}
                        <Route
                            path="/login"
                            element={
                                <PublicRoute>
                                    <LoginForm />
                                </PublicRoute>
                            }
                        />
                        <Route
                            path="/forgot-password"
                            element={
                                <PublicRoute>
                                    <ForgotPassword />
                                </PublicRoute>
                            }
                        />
                        <Route
                            path="/reset-password"
                            element={
                                <PublicRoute>
                                    <ResetPassword />
                                </PublicRoute>
                            }
                        />
                        {/* Complete Profile Route (First Login) */}
                        <Route
                            path="/join/:contestId"
                            element={<ContestJoin />}
                        />
                        <Route
                            path="/complete-profile"
                            element={
                                <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
                                    <CompleteProfile />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/profile/:username"
                            element={<PublicProfile />}
                        />
                        {/* Admin Routes */}
                        <Route
                            path="/admin/dashboard"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <AdminDashboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/batches"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <BatchManager />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/users"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <UserManagement />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/problems"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <ProblemManager />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/contests"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <ContestManager />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/sections"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <SectionManager />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/reports"
                            element={
                                <ProtectedRoute allowedRoles={['admin', 'instructor']}>
                                    <ReportGenerator />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/problems"
                            element={
                                <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
                                    <CodeEditor />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/problems/:problemId"
                            element={
                                <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
                                    <CodeEditor />
                                </ProtectedRoute>
                            }
                        />

                        {/* Instructor Routes */}
                        <Route
                            path="/instructor/dashboard"
                            element={
                                <ProtectedRoute allowedRoles={['instructor']}>
                                    <InstructorDashboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/instructor/contests"
                            element={
                                <ProtectedRoute allowedRoles={['instructor']}>
                                    <ContestManager />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/instructor/reports"
                            element={
                                <ProtectedRoute allowedRoles={['instructor']}>
                                    <ReportGenerator />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/instructor/reset-profile"
                            element={
                                <ProtectedRoute allowedRoles={['instructor']}>
                                    <ProfileReset />
                                </ProtectedRoute>
                            }
                        />
                        {/* Student Routes */}
                        <Route
                            path="/student/dashboard"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <Dashboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/contests"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <ContestList />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/contests/:contestId"
                            element={
                                <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']} hideNavbar={true}>
                                    <ContestInterface />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/contests/:contestId/practice"
                            element={
                                <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']} hideNavbar={true}>
                                    <ContestInterface isPractice={true} />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/contests/:contestId/leaderboard"
                            element={
                                <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
                                    <Leaderboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route path="/contest/*" element={<Navigate to={`/contests/${location.pathname.split('/').slice(2).join('/')}${location.search}`} replace />} />
                        <Route
                            path="/:batchName/leaderboard"
                            element={
                                <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']} hideNavbar={true}>
                                    <Leaderboard isBatchView={true} />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/leaderboard"
                            element={
                                <ProtectedRoute allowedRoles={['student', 'instructor']}>
                                    <Leaderboard />
                                </ProtectedRoute>
                            }
                        />
                        {/* Settings Routes */}
                        <Route
                            path="/student/profile"
                            element={<Navigate to="/student/settings/personal" replace />}
                        />
                        <Route
                            path="/student/settings/personal"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <PersonalDetails />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/settings/professional"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <ProfessionalDetails />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/settings/coding"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <CodingProfiles />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/settings/security"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <SecuritySettings />
                                </ProtectedRoute>
                            }
                        />
                        {/* Admin Settings Routes */}
                        <Route
                            path="/admin/settings/personal"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <PersonalDetails />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/settings/security"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <SecuritySettings />
                                </ProtectedRoute>
                            }
                        />
                        {/* Instructor Settings Routes */}
                        <Route
                            path="/instructor/settings/personal"
                            element={
                                <ProtectedRoute allowedRoles={['instructor']}>
                                    <PersonalDetails />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/instructor/settings/security"
                            element={
                                <ProtectedRoute allowedRoles={['instructor']}>
                                    <SecuritySettings />
                                </ProtectedRoute>
                            }
                        />

                        {/* Default Redirects */}
                        <Route path="/" element={<Navigate to="/login" replace />} />
                        <Route
                            path="/unauthorized"
                            element={
                                <div className="flex justify-center items-center h-screen bg-[#F7F5FF] dark:bg-[#111117] transition-colors">
                                    <div className="text-center">
                                        <h1 className="text-4xl font-bold text-red-600 dark:text-red-400 mb-4">
                                            403 - Unauthorized
                                        </h1>
                                        <p className="text-gray-600 dark:text-gray-400">
                                            You don't have permission to access this page.
                                        </p>
                                    </div>
                                </div>
                            }
                        />
                        <Route
                            path="*"
                            element={
                                <div className="flex justify-center items-center h-screen bg-[#F7F5FF] dark:bg-[#111117] transition-colors">
                                    <div className="text-center">
                                        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">404 - Not Found</h1>
                                        <p className="text-gray-600 dark:text-gray-400">The page you're looking for doesn't exist.</p>
                                    </div>
                                </div>
                            }
                        />
                    </Routes>
                </SecurityWrapper>
            </AuthProvider >
        </BrowserRouter >
    );
}

export default App;
