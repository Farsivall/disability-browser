/**
 * Perceptual theme — agent sets via updateDataModel at `/perceptualTheme`.
 * CSS applies modes via data attributes on `.a2ui-surface`.
 */

export type ContrastMode = "default" | "high";
export type TextScale = "default" | "large" | "xlarge";
export type FocusStyle = "default" | "emphasized";
export type SpacingMode = "default" | "cognitive";

export interface PerceptualTheme {
  contrast?: ContrastMode;
  textScale?: TextScale;
  focusStyle?: FocusStyle;
  spacing?: SpacingMode;
  /** Vestibular profile — kill animation inside surface */
  reduceMotion?: boolean;
  /** Visual profile — hide decorative images */
  hideDecorations?: boolean;
  /** Readable font opt-in (dyslexia-friendly stack) */
  readableFont?: boolean;
}

export const DEFAULT_PERCEPTUAL_THEME: PerceptualTheme = {
  contrast: "default",
  textScale: "default",
  focusStyle: "default",
  spacing: "default",
  reduceMotion: false,
  hideDecorations: false,
  readableFont: false,
};

/** Data-model path the agent writes theme directives to */
export const PERCEPTUAL_THEME_PATH = "/perceptualTheme";

export function parsePerceptualTheme(raw: unknown): PerceptualTheme {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const theme: PerceptualTheme = {};

  if (o.contrast === "high" || o.contrast === "default")
    theme.contrast = o.contrast;
  if (o.textScale === "large" || o.textScale === "xlarge" || o.textScale === "default")
    theme.textScale = o.textScale;
  if (o.focusStyle === "emphasized" || o.focusStyle === "default")
    theme.focusStyle = o.focusStyle;
  if (o.spacing === "cognitive" || o.spacing === "default")
    theme.spacing = o.spacing;
  if (typeof o.reduceMotion === "boolean") theme.reduceMotion = o.reduceMotion;
  if (typeof o.hideDecorations === "boolean")
    theme.hideDecorations = o.hideDecorations;
  if (typeof o.readableFont === "boolean") theme.readableFont = o.readableFont;

  return theme;
}

export function mergePerceptualThemes(
  ...layers: (PerceptualTheme | undefined)[]
): PerceptualTheme {
  return layers.reduce<PerceptualTheme>(
    (acc, layer) => (layer ? { ...acc, ...layer } : acc),
    { ...DEFAULT_PERCEPTUAL_THEME },
  );
}

/** Maps theme state → data attributes on `.a2ui-surface` */
export function perceptualThemeToDataAttributes(
  theme: PerceptualTheme,
): Record<string, string | undefined> {
  return {
    "data-pw-contrast":
      theme.contrast === "high" ? "high" : undefined,
    "data-pw-text-scale":
      theme.textScale && theme.textScale !== "default"
        ? theme.textScale
        : undefined,
    "data-pw-focus":
      theme.focusStyle === "emphasized" ? "emphasized" : undefined,
    "data-pw-spacing":
      theme.spacing === "cognitive" ? "cognitive" : undefined,
    "data-pw-motion": theme.reduceMotion ? "reduced" : undefined,
    "data-pw-hide-decor": theme.hideDecorations ? "true" : undefined,
    "data-pw-readable-font": theme.readableFont ? "true" : undefined,
  };
}

/** Profile presets Builder A can reference in generation */
export const PROFILE_THEME_PRESETS: Record<string, Partial<PerceptualTheme>> = {
  visual: {
    contrast: "high",
    textScale: "large",
    focusStyle: "emphasized",
    hideDecorations: true,
  },
  cognitive: {
    textScale: "large",
    spacing: "cognitive",
    readableFont: false,
  },
  motor: {
    focusStyle: "emphasized",
    textScale: "default",
  },
  vestibular: {
    reduceMotion: true,
  },
  essentialist: {
    contrast: "high",
    spacing: "cognitive",
  },
};
