import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export function VerifierPage() {
  const { user } = useAuth();

  if (user?.role === 'admin') return <Navigate to="/admin/approvals" replace />;
  if (user?.role === 'faculty') return <Navigate to="/faculty/approvals" replace />;
  if (user?.role === 'student') return <Navigate to="/student/dashboard" replace />;

  return <Navigate to="/login/student" replace />;
}
