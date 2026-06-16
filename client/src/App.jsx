import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { ProfileProvider } from './contexts/ProfileContext.jsx';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthOverlay } from './components/auth/AuthOverlay.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';

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
const ResumeAnalyzerPage = lazy(() => import('./pages/ResumeAnalyzerPage.jsx').then((module) => ({ default: module.ResumeAnalyzerPage })));
const AIChatPage = lazy(() => import('./pages/AIChatPage.jsx').then((module) => ({ default: module.AIChatPage })));
const CertificatesPage = lazy(() => import('./pages/CertificatesPage.jsx').then((module) => ({ default: module.CertificatesPage })));
const StudentOdPage = lazy(() => import('./pages/StudentOdPage.jsx').then((module) => ({ default: module.StudentOdPage })));
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard.jsx').then((module) => ({ default: module.FacultyDashboard })));
const FacultyApprovals = lazy(() => import('./pages/FacultyApprovals.jsx').then((module) => ({ default: module.FacultyApprovals })));
const FacultyStudents = lazy(() => import('./pages/FacultyStudents.jsx').then((module) => ({ default: module.FacultyStudents })));
const FacultyStudent360 = lazy(() => import('./pages/FacultyStudent360.jsx').then((module) => ({ default: module.FacultyStudent360 })));
const FacultyOdApprovals = lazy(() => import('./pages/FacultyOdApprovals.jsx').then((module) => ({ default: module.FacultyOdApprovals })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx').then((module) => ({ default: module.AdminDashboard })));
const AdminAdvisors = lazy(() => import('./pages/AdminAdvisors.jsx').then((module) => ({ default: module.AdminAdvisors })));
const AdminAnalytics = lazy(() => import('./pages/AdminAnalytics.jsx').then((module) => ({ default: module.AdminAnalytics })));
const AdminPlacementDashboard = lazy(() => import('./pages/AdminPlacementDashboard.jsx').then((module) => ({ default: module.AdminPlacementDashboard })));
const StudentPlacementDashboard = lazy(() => import('./pages/StudentPlacementDashboard.jsx').then((module) => ({ default: module.StudentPlacementDashboard })));
const AdminPlacements = lazy(() => import('./pages/AdminPlacements.jsx').then((module) => ({ default: module.AdminPlacements })));
const AdminEvents = lazy(() => import('./pages/AdminEvents.jsx').then((module) => ({ default: module.AdminEvents })));
const AdminAnnouncements = lazy(() => import('./pages/AdminAnnouncements.jsx').then((module) => ({ default: module.AdminAnnouncements })));
const DeveloperDashboard = lazy(() => import('./pages/DeveloperDashboard.jsx').then((module) => ({ default: module.DeveloperDashboard })));
const AdminTalentDiscovery = lazy(() => import('./pages/AdminTalentDiscovery.jsx').then((module) => ({ default: module.AdminTalentDiscovery })));
const StudentEvents = lazy(() => import('./pages/StudentEvents.jsx').then((module) => ({ default: module.StudentEvents })));

// Info pages
const AboutUsPage = lazy(() => import('./pages/info/AboutUsPage.jsx').then((module) => ({ default: module.AboutUsPage })));
const ContactUsPage = lazy(() => import('./pages/info/ContactUsPage.jsx').then((module) => ({ default: module.ContactUsPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/info/PrivacyPolicyPage.jsx').then((module) => ({ default: module.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('./pages/info/TermsPage.jsx').then((module) => ({ default: module.TermsPage })));
const CookiePolicyPage = lazy(() => import('./pages/info/CookiePolicyPage.jsx').then((module) => ({ default: module.CookiePolicyPage })));
const FaqPage = lazy(() => import('./pages/info/FaqPage.jsx').then((module) => ({ default: module.FaqPage })));
const SupportPage = lazy(() => import('./pages/info/SupportPage.jsx').then((module) => ({ default: module.SupportPage })));

// V2 additions:
const StudentSupportPage = lazy(() => import('./pages/StudentSupportPage.jsx').then((module) => ({ default: module.StudentSupportPage })));
const FacultySupportPage = lazy(() => import('./pages/FacultySupportPage.jsx').then((module) => ({ default: module.FacultySupportPage })));
const AdminSupportPage = lazy(() => import('./pages/AdminSupportPage.jsx').then((module) => ({ default: module.AdminSupportPage })));
const CoordinatorDashboard = lazy(() => import('./pages/CoordinatorDashboard.jsx').then((module) => ({ default: module.CoordinatorDashboard })));

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
	const { user, loading } = useAuth();

	if (loading) {
		return <PageLoader />;
	}
	
	if (!user) {
		return <Navigate to="/login/student" replace />;
	}

	const isAllowed = allowedRoles.includes(user.role);

	if (!user.role || !isAllowed) {
		return <Navigate to={getDashboardPath(user.role)} replace />;
	}
	
	return <>{children}</>;
}

export default function App() {
	return (
		<ThemeProvider>
			<AuthProvider>
				<ProfileProvider>
					<BrowserRouter>
						<Suspense fallback={<PageLoader />}>
							<Routes>
								<Route path="/" element={<LandingPage />} />
								<Route path="/landing" element={<LandingPage />} />
								<Route path="/about" element={<AboutUsPage />} />
								<Route path="/contact" element={<ContactUsPage />} />
								<Route path="/privacy" element={<PrivacyPolicyPage />} />
								<Route path="/terms" element={<TermsPage />} />
								<Route path="/cookies" element={<CookiePolicyPage />} />
								<Route path="/faq" element={<FaqPage />} />
								<Route path="/support" element={<SupportPage />} />
								<Route path="/login" element={<AuthOverlay />}>
									<Route index element={<Navigate to="/login/student" replace />} />
									<Route path="student" element={<StudentLoginPage presentation="modal" />} />
									<Route path="faculty" element={<FacultyLoginPage presentation="modal" />} />
									<Route path="admin" element={<AdminLoginPage presentation="modal" />} />
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
									<Route path="resume" element={<ResumeAnalyzerPage />} />
									<Route path="resume-analyzer" element={<ResumeAnalyzerPage />} />
									<Route path="developer" element={<DeveloperDashboard />} />
									<Route path="certificates" element={<CertificatesPage />} />
									<Route path="ai-chat" element={<AIChatPage />} />
									<Route path="od" element={<StudentOdPage />} />
									<Route path="placements" element={<StudentPlacementDashboard />} />
									<Route path="events" element={<StudentEvents />} />
									{/* V2: Student support ticket portal */}
									<Route path="support" element={<StudentSupportPage />} />
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
									<Route path="od-approvals" element={<FacultyOdApprovals />} />
									{/* V2: Faculty support ticket view */}
									<Route path="support" element={<FacultySupportPage />} />
								</Route>

								<Route path="/admin" element={
									<ProtectedRoute allowedRoles={['admin']}>
										<AdminLayout />
									</ProtectedRoute>
								}>
									<Route index element={<AdminDashboard />} />
									<Route path="approvals" element={<FacultyApprovals />} />
									<Route path="analytics" element={<AdminAnalytics />} />
									<Route path="placements" element={<AdminPlacementDashboard />} />
									<Route path="events" element={<AdminEvents />} />
									<Route path="announcements" element={<AdminAnnouncements />} />
									<Route path="talent-discovery" element={<AdminTalentDiscovery />} />
									<Route path="advisors" element={<AdminAdvisors />} />
									{/* V2: Admin support ticket management */}
									<Route path="support" element={<AdminSupportPage />} />
								</Route>



								<Route path="*" element={<Navigate to="/" replace />} />
							</Routes>
						</Suspense>
					</BrowserRouter>
				</ProfileProvider>
			</AuthProvider>
		</ThemeProvider>
	);
}
