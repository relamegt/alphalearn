import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'react-hot-toast';

// Auth Components
import LoginForm from './components/auth/LoginForm';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import CompleteProfile from './components/auth/CompleteProfile';
// Shared Components
import Navbar from './components/shared/Navbar';
import SecurityWrapper from './components/shared/SecurityWrapper';
import ExtensionCheck from './components/shared/ExtensionCheck';

// Admin Components
import BatchManager from './components/admin/BatchManager';
import UserManagement from './components/admin/UserManagement';
import ProblemManager from './components/admin/ProblemManager';
import ContestCreator from './components/admin/ContestCreator';


// Instructor Components
import ProfileReset from './components/instructor/ProfileReset';
import ReportAnalytics from './components/instructor/ReportAnalytics';

// Student Components
import Dashboard from './components/student/Dashboard';
import ProblemList from './components/student/ProblemList';
import ContestList from './components/student/ContestList';
import CodeEditor from './components/student/CodeEditor';
import Leaderboard from './components/student/Leaderboard';
import ProfileManager from './components/student/ProfileManager';
import ContestInterface from './components/student/ContestInterface';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-gray-50">{children}</div>
        </>
    );
};

// Public Route Component (only for non-authenticated users)
const PublicRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="spinner"></div>
            </div>
        );
    }

    if (user) {
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

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Toaster position="top-right" />
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
                            path="/reset-password/:token"
                            element={
                                <PublicRoute>
                                    <ResetPassword />
                                </PublicRoute>
                            }
                        />
                        {/* Complete Profile Route (First Login) */}
                        <Route
                            path="/complete-profile"
                            element={
                                <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
                                    <CompleteProfile />
                                </ProtectedRoute>
                            }
                        />
                        {/* Admin Routes */}
                        <Route
                            path="/admin/dashboard"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <BatchManager />
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
                                    <ContestCreator />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/reports"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <ReportAnalytics />
                                </ProtectedRoute>
                            }
                        />

                        {/* Instructor Routes */}
                        <Route
                            path="/instructor/dashboard"
                            element={
                                <ProtectedRoute allowedRoles={['instructor']}>
                                    <ReportAnalytics />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/instructor/contests"
                            element={
                                <ProtectedRoute allowedRoles={['instructor']}>
                                    <ContestCreator />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/instructor/reports"
                            element={
                                <ProtectedRoute allowedRoles={['instructor']}>
                                    <ReportAnalytics />
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
                            path="/student/problems"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <ProblemList />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/problem/:problemId"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <ExtensionCheck>
                                        <CodeEditor />
                                    </ExtensionCheck>
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
                            path="/student/contest/:contestId"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <ExtensionCheck>
                                        <ContestInterface />
                                    </ExtensionCheck>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/contest/:contestId/leaderboard"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <Leaderboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/leaderboard"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <Leaderboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/profile"
                            element={
                                <ProtectedRoute allowedRoles={['student']}>
                                    <ProfileManager />
                                </ProtectedRoute>
                            }
                        />

                        {/* Default Redirects */}
                        <Route path="/" element={<Navigate to="/login" replace />} />
                        <Route
                            path="/unauthorized"
                            element={
                                <div className="flex justify-center items-center h-screen">
                                    <div className="text-center">
                                        <h1 className="text-4xl font-bold text-red-600 mb-4">
                                            403 - Unauthorized
                                        </h1>
                                        <p className="text-gray-600">
                                            You don't have permission to access this page.
                                        </p>
                                    </div>
                                </div>
                            }
                        />
                        <Route
                            path="*"
                            element={
                                <div className="flex justify-center items-center h-screen">
                                    <div className="text-center">
                                        <h1 className="text-4xl font-bold text-gray-900 mb-4">404 - Not Found</h1>
                                        <p className="text-gray-600">The page you're looking for doesn't exist.</p>
                                    </div>
                                </div>
                            }
                        />
                    </Routes>
                </SecurityWrapper>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
