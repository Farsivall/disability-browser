"use client";

import { useMemo } from "react";
import { useA2UI } from "@copilotkit/a2ui-renderer";
import { clsx } from "clsx";
import {
  mergePerceptualThemes,
  parsePerceptualTheme,
  PERCEPTUAL_THEME_PATH,
  perceptualThemeToDataAttributes,
  type PerceptualTheme,
} from "./perceptual-theme";
import { usePerceptualTheme } from "./use-perceptual-theme";

type PerceptualSurfaceProps = {
  children: React.ReactNode;
  className?: string;
  /** When set, reads `/perceptualTheme` from the A2UI surface data model */
  surfaceId?: string;
  /** Manual override merged on top of context + data model */
  themeOverride?: Partial<PerceptualTheme>;
};

/**
 * Wraps generated UI with perceptual theme data attributes.
 * Priority: themeOverride > A2UI data model > PerceptualThemeProvider context.
 */
export function PerceptualSurface({
  children,
  className,
  surfaceId,
  themeOverride,
}: PerceptualSurfaceProps) {
  const { theme: contextTheme } = usePerceptualTheme();
  const { getSurface, version } = useA2UI();

  const resolved = useMemo(() => {
    let fromData: PerceptualTheme = {};
    if (surfaceId) {
      const surface = getSurface(surfaceId) as
        | { dataModel?: { get: (path: string) => unknown } }
        | undefined;
      if (surface?.dataModel?.get) {
        fromData = parsePerceptualTheme(
          surface.dataModel.get(PERCEPTUAL_THEME_PATH),
        );
      }
    }
    return mergePerceptualThemes(contextTheme, fromData, themeOverride);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version busts cache on data model updates
  }, [contextTheme, surfaceId, themeOverride, getSurface, version]);

  const dataAttrs = perceptualThemeToDataAttributes(resolved);

  return (
    <div
      className={clsx("a2ui-surface", className)}
      {...filterDefinedDataAttrs(dataAttrs)}
    >
      {children}
    </div>
  );
}

function filterDefinedDataAttrs(
  attrs: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
