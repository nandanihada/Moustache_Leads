import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const SmartRedirect = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If authenticated, redirect to dashboard, otherwise to landing page
  return <Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />;
};
