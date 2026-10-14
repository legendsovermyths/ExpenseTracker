import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import {
  FONTS,
  SIZES,
  PRETTYCOLORS,
  BANKCARDTHEMES,
  ColorPalette,
  ThemeDefinition,
  ThemeId,
  ThemeMode,
  THEMES,
  DEFAULT_THEME_ID,
  getThemeById,
} from '../constants/theme';
import { useExpensifyStore } from '../store/store';
import { updateAppconstant } from '../services/Appconstants';

interface ThemeContextType {
  COLORS: ColorPalette;
  FONTS: typeof FONTS;
  SIZES: typeof SIZES;
  PRETTYCOLORS: typeof PRETTYCOLORS;
  BANKCARDTHEMES: typeof BANKCARDTHEMES;
  /** Active theme id (e.g. 'light', 'midnight', 'sakura'). */
  themeId: ThemeId;
  /** Full definition of the active theme. */
  activeTheme: ThemeDefinition;
  /** All available themes, in display order. */
  themes: readonly ThemeDefinition[];
  /** Light/dark base of the active theme — drives native widgets & status bar. */
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (id: ThemeId) => void;
  /** Switches between the default light and dark themes. */
  toggleTheme: () => void;
  /** @deprecated use setTheme — kept for back-compat. */
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [initialized, setInitialized] = useState(false);

  const themeConstant = useExpensifyStore((s) => s.getAppconstantByKey('theme'));
  const updateAppconstantInStore = useExpensifyStore((s) => s.updateAppconstant);

  // Stored value is a theme id; legacy 'light' / 'dark' values are valid ids.
  useEffect(() => {
    if (themeConstant && !initialized) {
      setThemeId(getThemeById(themeConstant.value).id);
      setInitialized(true);
    }
  }, [themeConstant, initialized]);

  const persistTheme = useCallback(async (id: ThemeId) => {
    if (themeConstant) {
      const updatedConstant = { ...themeConstant, value: id };
      try {
        await updateAppconstant(updatedConstant);
        updateAppconstantInStore(updatedConstant);
      } catch (error) {
        console.error('Failed to persist theme:', error);
      }
    }
  }, [themeConstant, updateAppconstantInStore]);

  const setTheme = useCallback((id: ThemeId) => {
    if (id !== themeId) {
      setThemeId(id);
      persistTheme(id);
    }
  }, [themeId, persistTheme]);

  const activeTheme = getThemeById(themeId);

  const toggleTheme = useCallback(() => {
    setTheme(activeTheme.mode === 'dark' ? 'light' : 'dark');
  }, [activeTheme.mode, setTheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    if (mode !== activeTheme.mode) setTheme(mode);
  }, [activeTheme.mode, setTheme]);

  const value = useMemo<ThemeContextType>(() => ({
    COLORS: activeTheme.colors,
    FONTS,
    SIZES,
    PRETTYCOLORS,
    BANKCARDTHEMES,
    themeId: activeTheme.id,
    activeTheme,
    themes: THEMES,
    theme: activeTheme.mode,
    isDark: activeTheme.mode === 'dark',
    setTheme,
    toggleTheme,
    setThemeMode,
  }), [activeTheme, setTheme, toggleTheme, setThemeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
