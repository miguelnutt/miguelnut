import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Shield, User } from 'lucide-react';
import { useAdminMode } from '@/contexts/AdminModeContext';

export const AdminModeToggle: React.FC = () => {
  const { isAdminMode, toggleAdminMode, canUseAdminMode } = useAdminMode();

  if (!canUseAdminMode) {
    return null;
  }

  return (
    <div className="fixed top-20 md:top-28 left-1/2 transform -translate-x-1/2 z-[100]">
      <Button
        onClick={toggleAdminMode}
        variant={isAdminMode ? "default" : "outline"}
        size="sm"
        className={`
          shadow-lg border-2 transition-all duration-200 hover:scale-105
          ${isAdminMode 
            ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 border-purple-400 text-white' 
            : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-700'
          }
        `}
      >
        {isAdminMode ? (
          <>
            <Shield className="mr-2 h-4 w-4" />
            Modo Admin
            <EyeOff className="ml-2 h-4 w-4" />
          </>
        ) : (
          <>
            <User className="mr-2 h-4 w-4" />
            Modo Usuário
            <Eye className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
};