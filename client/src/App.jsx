import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { ProfileProvider } from './contexts/ProfileContext.jsx';
import { FirebaseAuthProvider, useFirebaseAuth } from './contexts/FirebaseAuthContext';

const StudentLoginPage = lazy(() => import('./pages/auth/StudentLoginPage').then((module) => ({ default: module.StudentLoginPage })));
const FacultyLoginPage = lazy(() => import('./pages/auth/FacultyLoginPage').then((module) => ({ default: module.FacultyLoginPage })));
const AdminLoginPage = lazy(() => import('./pages/auth/AdminLoginPage').then((module) => ({ default: module.AdminLoginPage })));
const LandingPage = lazy(() => import('./pages/LandingPage.jsx').then((module) => ({ default: module.LandingPage })));
const StudentLayout = lazy(() => import('./layouts/StudentLayout.jsx').then((module) => ({ default: module.StudentLayout })));
const FacultyLayout = lazy(() => import('./layouts/FacultyLayout.jsx').then((module) => ({ default: module.FacultyLayout })));
const AdminLayout = lazy(() => import('./layouts/AdminLayout.jsx').then((module) => ({ default: module.AdminLayout })));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx').then((module) => ({ default: module.DashboardPage })));
const UploadPage = lazy(() => import('./pages/UploadPage.jsx').then((module) => ({ default: module.UploadPage })));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage.jsx').then((module) => ({ default: module.ActivitiesPage })));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage.jsx').then((module) => ({ default: module.PortfolioPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx').then((module) => ({ default: module.ProfilePage })));
const CodingPage = lazy(() => import('./pages/CodingPage.jsx').then((module) => ({ default: module.CodingPage })));
const ResumeImportPage = lazy(() => import('./pages/ResumeImportPage.jsx').then((module) => ({ default: module.ResumeImportPage })));
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard.jsx').then((module) => ({ default: module.FacultyDashboard })));
const FacultyApprovals = lazy(() => import('./pages/FacultyApprovals.jsx').then((module) => ({ default: module.FacultyApprovals })));
const FacultyStudents = lazy(() => import('./pages/FacultyStudents.jsx').then((module) => ({ default: module.FacultyStudents })));
const FacultyStudent360 = lazy(() => import('./pages/FacultyStudent360.jsx').then((module) => ({ default: module.FacultyStudent360 })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx').then((module) => ({ default: module.AdminDashboard })));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics.jsx').then((module) => ({ default: module.AdminAnalytics })));
const AdminPlacements = lazy(() => import('./pages/AdminPlacements.jsx').then((module) => ({ default: module.AdminPlacements })));
const AdminEvents = lazy(() => import('./pages/AdminEvents.jsx').then((module) => ({ default: module.AdminEvents })));

const PageLoader = () => (
	<div className="min-h-screen p-6" style={{ background: 'var(--bg-dark)', color: 'var(--text-primary)' }}>
		<div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-[220px_1fr]">
			<div className="hidden rounded-xl border p-4 md:block" style={{ background: 'var(--surface-card)', borderColor: 'var(--border-color)' }}>
				<div className="skeleton h-8 w-32 mb-8" />
				<div className="space-y-3">
					{Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton h-10 w-full" />)}
				</div>
			</div>
			<div className="space-y-4">
				<div className="skeleton h-16 w-full" />
				<div className="grid gap-4 md:grid-cols-4">
					{Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton h-28 w-full" />)}
				</div>
				<div className="grid gap-4 md:grid-cols-2">
					<div className="skeleton h-72 w-full" />
					<div className="skeleton h-72 w-full" />
				</div>
			</div>
		</div>
	</div>
);

const getDashboardPath = (role) => {
	if (role === 'student') return '/student/dashboard';
	if (role === 'faculty') return '/faculty';
	if (role === 'admin') return '/admin';
	return '/login/student';
};

const ProtectedRoute = ({ children, allowedRoles }) => {
	const { user, loading } = useFirebaseAuth();

	if (loading) {
		return <PageLoader />;
	}
	
	if (!user) {
		return <Navigate to="/login/student" replace />;
	}

	if (!user.role || !allowedRoles.includes(user.role)) {
		return <Navigate to={getDashboardPath(user.role)} replace />;
	}
	
	return <>{children}</>;
}

export default function App() {
	useEffect(() => {
		const savedTheme = localStorage.getItem('theme');
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		document.documentElement.setAttribute('data-theme', savedTheme || (prefersDark ? 'dark' : 'light'));
	}, []);

	return (
		<FirebaseAuthProvider>
			<ProfileProvider>
				<BrowserRouter>
					<Suspense fallback={<PageLoader />}>
						<Routes>
							<Route path="/" element={<LandingPage />} />
							<Route path="/landing" element={<LandingPage />} />
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
					</Suspense>
				</BrowserRouter>
			</ProfileProvider>
		</FirebaseAuthProvider>
	);
}
