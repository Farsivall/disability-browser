"use client";

import { usePerceptualTheme } from "./use-perceptual-theme";
import type { ContrastMode, FocusStyle, TextScale } from "./perceptual-theme";

/**
 * Dev / catalog controls for TEST C3 — toggles perceptual theme modes live.
 */
export function PerceptualThemeControls({ compact }: { compact?: boolean }) {
  const { theme, patchTheme, resetTheme } = usePerceptualTheme();

  return (
    <div
      className={
        compact
          ? "flex flex-wrap gap-2 items-center"
          : "surface p-4 flex flex-col gap-3 mb-6"
      }
      role="group"
      aria-label="Perceptual theme controls"
    >
      {!compact && (
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">
            Perceptual theme (TEST C3)
          </h2>
          <p className="text-[13px] text-[var(--muted)] mt-1">
            Same content, different sensory modes — agent sets these via{" "}
            <code className="mono text-[11px]">updateDataModel /perceptualTheme</code>
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <TogglePill
          label="High contrast"
          pressed={theme.contrast === "high"}
          onClick={() =>
            patchTheme({
              contrast: (theme.contrast === "high" ? "default" : "high") as ContrastMode,
            })
          }
        />
        <TogglePill
          label="Large text"
          pressed={theme.textScale === "large"}
          onClick={() =>
            patchTheme({
              textScale: (theme.textScale === "large" ? "default" : "large") as TextScale,
            })
          }
        />
        <TogglePill
          label="XL text"
          pressed={theme.textScale === "xlarge"}
          onClick={() =>
            patchTheme({
              textScale: (theme.textScale === "xlarge" ? "default" : "xlarge") as TextScale,
            })
          }
        />
        <TogglePill
          label="Focus outline"
          pressed={theme.focusStyle === "emphasized"}
          onClick={() =>
            patchTheme({
              focusStyle: (theme.focusStyle === "emphasized"
                ? "default"
                : "emphasized") as FocusStyle,
            })
          }
        />
        <TogglePill
          label="Cognitive spacing"
          pressed={theme.spacing === "cognitive"}
          onClick={() =>
            patchTheme({
              spacing: theme.spacing === "cognitive" ? "default" : "cognitive",
            })
          }
        />
        <TogglePill
          label="No motion"
          pressed={theme.reduceMotion === true}
          onClick={() =>
            patchTheme({ reduceMotion: !theme.reduceMotion })
          }
        />
        <button
          type="button"
          onClick={resetTheme}
          className="px-3 py-1.5 rounded-lg text-sm mono border border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-2)]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function TogglePill({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm mono transition border ${
        pressed
          ? "bg-[var(--ink)] text-white border-[var(--ink)]"
          : "bg-[var(--surface)] text-[var(--ink-2)] border-[var(--line)] hover:border-[var(--ink-2)]"
      }`}
    >
      {label}
    </button>
  );
}
