import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { ProfileProvider } from './contexts/ProfileContext.jsx';
import { FirebaseAuthProvider, useFirebaseAuth } from './contexts/FirebaseAuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
	const { user, loading } = useFirebaseAuth();
	
	console.log('ProtectedRoute check:', { user, loading, allowedRoles, path: window.location.pathname });
	
	if (loading) {
		// Show loading spinner or placeholder while checking auth
		return <div>Loading...</div>;
	}
	
	if (!user) {
		console.log('No user, redirecting to login');
		return <Navigate to="/login/student" replace />;
	}

	if (!user.role || !allowedRoles.includes(user.role)) {
		console.log('Access denied - invalid role:', user.role);
		return <Navigate to={`/login/${user.role || 'student'}`} replace />;
	}
	
	console.log('Access granted for role:', user.role);
	return <>{children}</>;
}

// Auth pages
import { StudentLoginPage } from './pages/auth/StudentLoginPage';
import { FacultyLoginPage } from './pages/auth/FacultyLoginPage';
import { AdminLoginPage } from './pages/auth/AdminLoginPage';
import { LandingPage } from './pages/LandingPage.jsx';
import { StudentLayout } from './layouts/StudentLayout.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { UploadPage } from './pages/UploadPage.jsx';
import { ActivitiesPage } from './pages/ActivitiesPage.jsx';
import { PortfolioPage } from './pages/PortfolioPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { CodingPage } from './pages/CodingPage.jsx';
import { ResumeImportPage } from './pages/ResumeImportPage.jsx';
import { FacultyAdminAuth } from './pages/AuthFacultyAdmin.jsx';
import { FacultyLayout } from './layouts/FacultyLayout.jsx';
import { AdminLayout } from './layouts/AdminLayout.jsx';
import { FacultyDashboard } from './pages/FacultyDashboard.jsx';
import { FacultyApprovals } from './pages/FacultyApprovals.jsx';
import { FacultyStudents } from './pages/FacultyStudents.jsx';
import { FacultyStudent360 } from './pages/FacultyStudent360.jsx';
import { AdminDashboard } from './pages/AdminDashboard.jsx';
import { AdminAnalytics } from './pages/AdminAnalytics.jsx';
import { AdminPlacements } from './pages/AdminPlacements.jsx';
import { AdminEvents } from './pages/AdminEvents.jsx';
import { VerifierPage } from './pages/VerifierPage.jsx';

export default function App() {
	return (
		<FirebaseAuthProvider>
			<ProfileProvider>
				<BrowserRouter>
					<Routes>
					<Route path="/" element={<LandingPage />} />
					<Route path="/login">
						<Route index element={<Navigate to="/login/student" replace />} />
						<Route path="student" element={<StudentLoginPage />} />
						<Route path="faculty" element={<FacultyLoginPage />} />
						<Route path="admin" element={<AdminLoginPage />} />
					</Route>
					<Route path="/student" element={
						<ProtectedRoute allowedRoles={['student']}>
							<StudentLayout />
						</ProtectedRoute>
					}>
						<Route index element={<DashboardPage />} />
						<Route path="dashboard" element={<DashboardPage />} />
						<Route path="upload" element={<UploadPage />} />
						<Route path="activities" element={<ActivitiesPage />} />
						<Route path="portfolio" element={<PortfolioPage />} />
						<Route path="profile" element={<ProfilePage />} />
						<Route path="coding" element={<CodingPage />} />
						<Route path="resume" element={<ResumeImportPage />} />
					</Route>

					<Route path="/faculty" element={
						<ProtectedRoute allowedRoles={['faculty']}>
							<FacultyLayout />
						</ProtectedRoute>
					}>
						<Route index element={<FacultyDashboard />} />
						<Route path="approvals" element={<FacultyApprovals />} />
						<Route path="students" element={<FacultyStudents />} />
						<Route path="mentor" element={<FacultyStudent360 />} />
					</Route>

					<Route path="/admin" element={
						<ProtectedRoute allowedRoles={['admin']}>
							<AdminLayout />
						</ProtectedRoute>
					}>
						<Route index element={<AdminDashboard />} />
						<Route path="approvals" element={<FacultyApprovals />} />
						<Route path="analytics" element={<AdminAnalytics />} />
						<Route path="placements" element={<AdminPlacements />} />
						<Route path="events" element={<AdminEvents />} />
					</Route>

					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</BrowserRouter>
		</ProfileProvider>
		</FirebaseAuthProvider>
	);
}
