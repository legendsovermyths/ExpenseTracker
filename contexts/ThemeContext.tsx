import React, { createContext, useContext, useState, ReactNode } from 'react';
import { LIGHT_COLORS, DARK_COLORS, FONTS, SIZES, PRETTYCOLORS, BANKCARDTHEMES } from '../constants/theme';

type ColorPalette = typeof LIGHT_COLORS;
type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  COLORS: ColorPalette;
  FONTS: typeof FONTS;
  SIZES: typeof SIZES;
  PRETTYCOLORS: typeof PRETTYCOLORS;
  BANKCARDTHEMES: typeof BANKCARDTHEMES;
  theme: ThemeMode;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeMode>('light');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const COLORS = theme === 'light' ? LIGHT_COLORS : DARK_COLORS;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider
      value={{
        COLORS,
        FONTS,
        SIZES,
        PRETTYCOLORS,
        BANKCARDTHEMES,
        theme,
        toggleTheme,
        isDark,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
