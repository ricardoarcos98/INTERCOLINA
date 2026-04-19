import React, { createContext, useContext, useState } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  grassColor: string;
  setGrassColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
  grassColor: '#2e7d32',
  setGrassColor: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const GRASS_COLORS = [
  '#2e7d32', // verde clasico
  '#1b5e20', // verde oscuro
  '#43a047', // verde brillante
  '#558b2f', // verde oliva
  '#00695c', // verde azulado
  '#4a7c59', // verde natural
];

export { GRASS_COLORS };

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(true);
  const [grassColor, setGrassColor] = useState('#2e7d32');

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme: () => setIsDark(d => !d), grassColor, setGrassColor }}>
      {children}
    </ThemeContext.Provider>
  );
};
