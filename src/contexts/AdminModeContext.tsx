import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AdminModeContextType {
  isAdminMode: boolean;
  toggleAdminMode: () => void;
  canUseAdminMode: boolean;
}

const AdminModeContext = createContext<AdminModeContextType | undefined>(undefined);

export const AdminModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useAuth();
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Reset to user mode when user is no longer admin
  useEffect(() => {
    if (!isAdmin) {
      setIsAdminMode(false);
    }
  }, [isAdmin]);

  const toggleAdminMode = () => {
    if (isAdmin) {
      setIsAdminMode(prev => !prev);
    }
  };

  const value = {
    isAdminMode: isAdmin ? isAdminMode : false,
    toggleAdminMode,
    canUseAdminMode: isAdmin,
  };

  return (
    <AdminModeContext.Provider value={value}>
      {children}
    </AdminModeContext.Provider>
  );
};

export const useAdminMode = () => {
  const context = useContext(AdminModeContext);
  if (context === undefined) {
    throw new Error('useAdminMode must be used within an AdminModeProvider');
  }
  return context;
};