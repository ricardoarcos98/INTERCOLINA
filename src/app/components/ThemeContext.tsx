import React, { createContext, useContext, useState } from 'react';

/** Patrón de corte / rayado del césped (no cambia el color base, solo el dibujo). */
export type GrassCutStyle =
  | 'stripe_h'
  | 'stripe_v'
  | 'stripe_wide_h'
  | 'stripe_wide_v'
  | 'checker'
  | 'diagonal';

export const GRASS_CUT_OPTIONS: { id: GrassCutStyle; name: string }[] = [
  { id: 'stripe_h', name: 'Rayas horizontales' },
  { id: 'stripe_v', name: 'Rayas verticales' },
  { id: 'stripe_wide_h', name: 'Rayas anchas (horizontal)' },
  { id: 'stripe_wide_v', name: 'Rayas anchas (vertical)' },
  { id: 'checker', name: 'Cuadros (damero)' },
  { id: 'diagonal', name: 'Corte diagonal' },
];

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  grassColor: string;
  setGrassColor: (color: string) => void;
  grassCut: GrassCutStyle;
  setGrassCut: (cut: GrassCutStyle) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  toggleTheme: () => {},
  grassColor: '#2e7d32',
  setGrassColor: () => {},
  grassCut: 'stripe_h',
  setGrassCut: () => {},
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
  const [grassCut, setGrassCut] = useState<GrassCutStyle>('stripe_h');

  return (
    <ThemeContext.Provider
      value={{
        isDark,
        toggleTheme: () => setIsDark((d) => !d),
        grassColor,
        setGrassColor,
        grassCut,
        setGrassCut,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
