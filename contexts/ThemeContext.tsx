import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { LIGHT_COLORS, DARK_COLORS, FONTS, SIZES, PRETTYCOLORS, BANKCARDTHEMES } from '../constants/theme';
import { useExpensifyStore } from '../store/store';
import { updateAppconstant } from '../services/Appconstants';

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
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [initialized, setInitialized] = useState(false);

  // Get theme from store
  const themeConstant = useExpensifyStore((s) => s.getAppconstantByKey('theme'));
  const updateAppconstantInStore = useExpensifyStore((s) => s.updateAppconstant);

  // Initialize theme from store when appconstants are loaded
  useEffect(() => {
    if (themeConstant && !initialized) {
      const storedTheme = themeConstant.value as ThemeMode;
      if (storedTheme === 'dark' || storedTheme === 'light') {
        setTheme(storedTheme);
      }
      setInitialized(true);
    }
  }, [themeConstant, initialized]);

  const persistTheme = useCallback(async (newTheme: ThemeMode) => {
    if (themeConstant) {
      const updatedConstant = {
        ...themeConstant,
        value: newTheme,
      };
      try {
        await updateAppconstant(updatedConstant);
        updateAppconstantInStore(updatedConstant);
      } catch (error) {
        console.error('Failed to persist theme:', error);
      }
    }
  }, [themeConstant, updateAppconstantInStore]);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    persistTheme(newTheme);
  }, [theme, persistTheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    if (mode !== theme) {
      setTheme(mode);
      persistTheme(mode);
    }
  }, [theme, persistTheme]);

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
        setThemeMode,
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
