import React, { createContext, useContext, useState, useEffect } from 'react';

interface HalloweenThemeContextType {
  isHalloweenActive: boolean;
  toggleHalloween: () => void;
}

const HalloweenThemeContext = createContext<HalloweenThemeContextType | undefined>(undefined);

export const HalloweenThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHalloweenActive, setIsHalloweenActive] = useState(false);

  useEffect(() => {
    // Aplicar ou remover classes do tema Halloween
    if (isHalloweenActive) {
      document.documentElement.classList.add('halloween-theme');
    } else {
      document.documentElement.classList.remove('halloween-theme');
    }
  }, [isHalloweenActive]);

  const toggleHalloween = () => {
    setIsHalloweenActive(prev => !prev);
  };

  return (
    <HalloweenThemeContext.Provider value={{ isHalloweenActive, toggleHalloween }}>
      {children}
    </HalloweenThemeContext.Provider>
  );
};

export const useHalloweenTheme = () => {
  const context = useContext(HalloweenThemeContext);
  if (context === undefined) {
    throw new Error('useHalloweenTheme must be used within a HalloweenThemeProvider');
  }
  return context;
};
