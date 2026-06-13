import type { PerceptualTheme } from "./perceptual-theme";
import { mergePerceptualThemes, PROFILE_THEME_PRESETS } from "./perceptual-theme";

export type NeedProfileId =
  | "visual"
  | "cognitive"
  | "motor"
  | "vestibular"
  | "essentialist";

const PROFILE_KEYWORDS: Record<NeedProfileId, RegExp> = {
  cognitive: /\b(clutter|overwhelm|too much|distract|focus|read|small text|dense|busy|adhd|dyslexia)\b/i,
  motor: /\b(click|tap|touch|target|tremor|dexterity|small thing|tiny|button|switch|motor)\b/i,
  visual: /\b(contrast|vision|see|blind|colour|color|blur|astigmat|low vision|bright|dark)\b/i,
  vestibular: /\b(motion|anim|dizzy|vestibular|seizure|parallax|carousel|autoplay)\b/i,
  essentialist: /\b(just show|only|essential|strip|simple|what i need|real price|article only)\b/i,
};

export function inferProfilesFromNeed(need: string): NeedProfileId[] {
  const found = (Object.keys(PROFILE_KEYWORDS) as NeedProfileId[]).filter(
    (id) => PROFILE_KEYWORDS[id].test(need),
  );
  return found.length ? found : ["cognitive"];
}

export function mergeProfiles(
  existing: NeedProfileId[],
  incoming: NeedProfileId[],
): NeedProfileId[] {
  return [...new Set([...existing, ...incoming])];
}

export function themeFromProfiles(profiles: NeedProfileId[]): PerceptualTheme {
  let theme: PerceptualTheme = {};
  for (const p of profiles) {
    theme = mergePerceptualThemes(theme, PROFILE_THEME_PRESETS[p]);
  }
  if (profiles.includes("motor")) {
    theme = mergePerceptualThemes(theme, { focusStyle: "emphasized" });
  }
  if (profiles.includes("vestibular")) {
    theme = mergePerceptualThemes(theme, { reduceMotion: true });
  }
  return theme;
}

export function buildAccumulatedNeed(needs: string[]): string {
  return needs.join(". ");
}
