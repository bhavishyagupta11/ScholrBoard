import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Auth Pages
import { StudentLoginPage } from '../pages/auth/StudentLoginPage';
import { FacultyLoginPage } from '../pages/auth/FacultyLoginPage';
import { AdminLoginPage } from '../pages/auth/AdminLoginPage';

// Protected Pages
import { DashboardPage } from '../pages/DashboardPage';
import { ProfilePage } from '../pages/ProfilePage';
import { PortfolioPage } from '../pages/PortfolioPage';
import { CodingPage } from '../pages/CodingPage';
import { ActivitiesPage } from '../pages/ActivitiesPage';
import { UploadPage } from '../pages/UploadPage';
import { ResumeImportPage } from '../pages/ResumeImportPage';
import { VerifierPage } from '../pages/VerifierPage';

// Layouts
import { StudentLayout } from '../layouts/StudentLayout';
import { FacultyLayout } from '../layouts/FacultyLayout';
import { AdminLayout } from '../layouts/AdminLayout';

// Protected Route Component
const ProtectedRoute = ({ element: Element, allowedRoles, ...rest }) => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login/${role || 'student'}`} />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={`/login/${role}`} />;
  }

  return <Element {...rest} />;
};

export function AppRoutes() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login">
        <Route index element={<Navigate to="/login/student" replace />} />
        <Route path="student" element={<StudentLoginPage />} />
        <Route path="faculty" element={<FacultyLoginPage />} />
        <Route path="admin" element={<AdminLoginPage />} />
      </Route>

      {/* Student Routes */}
      <Route
        path="/student/*"
        element={
          <ProtectedRoute
            element={StudentLayout}
            allowedRoles={['student']}
          />
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="coding" element={<CodingPage />} />
        <Route path="activities" element={<ActivitiesPage />} />
        <Route path="resume" element={<ResumeImportPage />} />
      </Route>

      {/* Faculty Routes */}
      <Route
        path="/faculty/*"
        element={
          <ProtectedRoute
            element={FacultyLayout}
            allowedRoles={['faculty']}
          />
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="students" element={<FacultyStudents />} />
        <Route path="approvals" element={<FacultyApprovals />} />
        <Route path="student360" element={<FacultyStudent360 />} />
      </Route>

      {/* Admin Routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute
            element={AdminLayout}
            allowedRoles={['admin']}
          />
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="placements" element={<AdminPlacements />} />
      </Route>

      {/* Default Route */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* 404 Route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}