import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/app/context/AuthContext';

interface ProtectedRouteProps {
  requiredRole?: 'security' | 'admin';
}

// The security/guard module is for personnel: both 'security' (guard) and 'supervisor'.
// The admin console is admin-only. (Three levels: admin · supervisor · guard.)
const roleSatisfies = (role: string, required: 'security' | 'admin'): boolean => {
  if (required === 'admin') return role === 'admin';
  return role === 'security' || role === 'supervisor';
};

export const ProtectedRoute = ({ requiredRole }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  // Wait for the session-restore (authApi.me) to settle before deciding,
  // otherwise a refresh bounces an authenticated user to /login.
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center" style={{ background: '#EEF2FE' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-blue border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If a specific role is required, check if the user's role satisfies it
  if (requiredRole && !roleSatisfies(user.role, requiredRole)) {
    // Redirect to the appropriate landing based on the user's actual role
    return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  }

  return <Outlet />;
};