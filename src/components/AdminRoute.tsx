import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminMode } from '@/contexts/AdminModeContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAdmin } = useAuth();
  const { isAdminMode } = useAdminMode();

  if (!isAdmin || !isAdminMode) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};