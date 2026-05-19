import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RequestFormPage } from './pages/RequestFormPage';
import { ConfirmPage } from './pages/ConfirmPage';
import { AdminPage } from './pages/AdminPage';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} /> : <LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute role="applicant"><DashboardPage /></ProtectedRoute>} />
      <Route path="/request/new" element={<ProtectedRoute role="applicant"><RequestFormPage /></ProtectedRoute>} />
      <Route path="/request/confirm" element={<ProtectedRoute role="applicant"><ConfirmPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
