import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '@attendance/shared';

interface Props {
  role: UserRole;
  children: React.ReactNode;
}

export function ProtectedRoute({ role, children }: Props) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return <>{children}</>;
}
