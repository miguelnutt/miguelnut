import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdmin } from '@/hooks/useAdmin';
import { useAdminMode } from '@/contexts/AdminModeContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAdmin } = useAdmin();
  const { isAdminMode } = useAdminMode();

  if (!isAdmin || !isAdminMode) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};