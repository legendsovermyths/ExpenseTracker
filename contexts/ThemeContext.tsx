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
import { MD3DarkTheme, MD3LightTheme, MD3Theme, PaperProvider } from 'react-native-paper';
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
  /** react-native-paper theme derived from the active palette. */
  paperTheme: MD3Theme;
  setTheme: (id: ThemeId) => void;
  /** Switches between the default light and dark themes. */
  toggleTheme: () => void;
  /** @deprecated use setTheme — kept for back-compat. */
  setThemeMode: (mode: ThemeMode) => void;
}

const buildPaperTheme = (c: ColorPalette, isDark: boolean): MD3Theme => {
  const base = isDark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    dark: isDark,
    colors: {
      ...base.colors,
      primary: c.ink,
      onPrimary: c.paper,
      primaryContainer: c.surface1,
      onPrimaryContainer: c.ink,
      secondary: c.accentWarm,
      onSecondary: c.paper,
      secondaryContainer: c.surface1,
      onSecondaryContainer: c.ink,
      tertiary: c.accent,
      onTertiary: c.paper,
      background: c.paper,
      onBackground: c.ink,
      surface: c.paper,
      onSurface: c.ink,
      surfaceVariant: c.surface1,
      onSurfaceVariant: c.inkMuted,
      outline: c.inkSubtle,
      outlineVariant: c.hairline,
      error: c.deltaUp,
      inverseSurface: c.ink,
      inverseOnSurface: c.paper,
      inversePrimary: c.accent,
      elevation: {
        level0: 'transparent',
        level1: c.surface2,
        level2: c.surface2,
        level3: c.surface2,
        level4: c.surface2,
        level5: c.surface2,
      },
    },
  };
};

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
    paperTheme: buildPaperTheme(activeTheme.colors, activeTheme.mode === 'dark'),
    setTheme,
    toggleTheme,
    setThemeMode,
  }), [activeTheme, setTheme, toggleTheme, setThemeMode]);

  return (
    <ThemeContext.Provider value={value}>
      <PaperProvider theme={value.paperTheme}>{children}</PaperProvider>
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

/** Paper provider bound to the active theme — use instead of paper's bare `Provider`. */
export const ThemedPaperProvider = ({ children }: { children: ReactNode }) => {
  const { paperTheme } = useTheme();
  return <PaperProvider theme={paperTheme}>{children}</PaperProvider>;
};
