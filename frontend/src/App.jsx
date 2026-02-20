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


// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles, hideNavbar = false }) => {
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
            {!hideNavbar && <Navbar />}
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
                            path="/admin/problems-workspace"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <ProblemList />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/problem/:problemId"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <ExtensionCheck>
                                        <CodeEditor />
                                    </ExtensionCheck>
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
                        <Route
                            path="/instructor/problems-workspace"
                            element={
                                <ProtectedRoute allowedRoles={['instructor']}>
                                    <ProblemList />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/instructor/problem/:problemId"
                            element={
                                <ProtectedRoute allowedRoles={['instructor']}>
                                    <ExtensionCheck>
                                        <CodeEditor />
                                    </ExtensionCheck>
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
                                <ProtectedRoute allowedRoles={['student']} hideNavbar={true}>
                                    <ExtensionCheck>
                                        <ContestInterface />
                                    </ExtensionCheck>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/contest/:contestId/practice"
                            element={
                                <ProtectedRoute allowedRoles={['student']} hideNavbar={true}>
                                    <ExtensionCheck>
                                        <ContestInterface isPractice={true} />
                                    </ExtensionCheck>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/contest/:contestId/leaderboard"
                            element={
                                <ProtectedRoute allowedRoles={['student', 'instructor', 'admin']}>
                                    <Leaderboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/student/batch-leaderboard"
                            element={
                                <ProtectedRoute allowedRoles={['student', 'instructor']} hideNavbar={true}>
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
            </AuthProvider >
        </BrowserRouter >
    );
}

export default App;
