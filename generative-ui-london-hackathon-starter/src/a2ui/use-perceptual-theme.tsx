"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_PERCEPTUAL_THEME,
  mergePerceptualThemes,
  type PerceptualTheme,
} from "./perceptual-theme";

type PerceptualThemeContextValue = {
  theme: PerceptualTheme;
  setTheme: (next: PerceptualTheme) => void;
  patchTheme: (patch: Partial<PerceptualTheme>) => void;
  resetTheme: () => void;
};

const PerceptualThemeContext =
  createContext<PerceptualThemeContextValue | null>(null);

export function PerceptualThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme?: PerceptualTheme;
}) {
  const [theme, setThemeState] = useState<PerceptualTheme>(() =>
    mergePerceptualThemes(initialTheme),
  );

  const setTheme = useCallback((next: PerceptualTheme) => {
    setThemeState(mergePerceptualThemes(next));
  }, []);

  const patchTheme = useCallback((patch: Partial<PerceptualTheme>) => {
    setThemeState((prev) => mergePerceptualThemes(prev, patch));
  }, []);

  const resetTheme = useCallback(() => {
    setThemeState({ ...DEFAULT_PERCEPTUAL_THEME });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, patchTheme, resetTheme }),
    [theme, setTheme, patchTheme, resetTheme],
  );

  return (
    <PerceptualThemeContext.Provider value={value}>
      {children}
    </PerceptualThemeContext.Provider>
  );
}

export function usePerceptualTheme() {
  const ctx = useContext(PerceptualThemeContext);
  if (!ctx) {
    return {
      theme: DEFAULT_PERCEPTUAL_THEME,
      setTheme: () => {},
      patchTheme: () => {},
      resetTheme: () => {},
    };
  }
  return ctx;
}
