"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PerceptualTheme } from "./perceptual-theme";
import { DEFAULT_PERCEPTUAL_THEME, mergePerceptualThemes } from "./perceptual-theme";
import {
  buildAccumulatedNeed,
  inferProfilesFromNeed,
  mergeProfiles,
  themeFromProfiles,
  type NeedProfileId,
} from "./need-inference";

export type RefinementSession = {
  needs: string[];
  profiles: NeedProfileId[];
  theme: PerceptualTheme;
  /** Bumps when surface should fully refresh (refinement regen) */
  generation: number;
};

type RefinementContextValue = {
  session: RefinementSession;
  appendNeed: (need: string) => RefinementSession;
  resetSession: () => void;
  accumulatedNeed: string;
};

const RefinementSessionContext = createContext<RefinementContextValue | null>(
  null,
);

const EMPTY_SESSION: RefinementSession = {
  needs: [],
  profiles: [],
  theme: { ...DEFAULT_PERCEPTUAL_THEME },
  generation: 0,
};

export function RefinementSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<RefinementSession>(EMPTY_SESSION);

  const appendNeed = useCallback((need: string) => {
    const trimmed = need.trim();
    const incomingProfiles = inferProfilesFromNeed(trimmed);
    let nextSession: RefinementSession = EMPTY_SESSION;

    setSession((prev) => {
      const profiles = mergeProfiles(prev.profiles, incomingProfiles);
      const theme = mergePerceptualThemes(
        prev.theme,
        themeFromProfiles(incomingProfiles),
      );
      nextSession = {
        needs: [...prev.needs, trimmed],
        profiles,
        theme,
        generation: prev.generation + 1,
      };
      return nextSession;
    });

    return nextSession;
  }, []);

  const resetSession = useCallback(() => {
    setSession({ ...EMPTY_SESSION });
  }, []);

  const accumulatedNeed = useMemo(
    () => buildAccumulatedNeed(session.needs),
    [session.needs],
  );

  const value = useMemo(
    () => ({ session, appendNeed, resetSession, accumulatedNeed }),
    [session, appendNeed, resetSession, accumulatedNeed],
  );

  return (
    <RefinementSessionContext.Provider value={value}>
      {children}
    </RefinementSessionContext.Provider>
  );
}

export function useRefinementSession() {
  const ctx = useContext(RefinementSessionContext);
  if (!ctx) {
    throw new Error(
      "useRefinementSession must be used within RefinementSessionProvider",
    );
  }
  return ctx;
}
