"use client";

import { useRefinementSession } from "@/a2ui/refinement-session";
import { usePerceptualTheme } from "@/a2ui/use-perceptual-theme";

/** Shows accumulated refinement needs for the current session */
export function RefinementHistory() {
  const { session, resetSession } = useRefinementSession();
  const { resetTheme } = usePerceptualTheme();

  if (session.needs.length === 0) return null;

  const handleClear = () => {
    resetSession();
    resetTheme();
  };

  return (
    <section
      className="pw-refinement-history"
      aria-label="Your refinement history"
    >
      <div className="pw-refinement-history-header">
        <span className="pw-refinement-history-title">
          Active needs ({session.needs.length})
        </span>
        <button
          type="button"
          className="pw-refinement-clear-btn"
          onClick={handleClear}
        >
          Clear session
        </button>
      </div>
      <ol className="pw-refinement-list">
        {session.needs.map((need, i) => (
          <li key={`${i}-${need.slice(0, 24)}`} className="pw-refinement-item">
            <span className="pw-refinement-num">{i + 1}</span>
            {need}
          </li>
        ))}
      </ol>
      {session.profiles.length > 0 && (
        <p className="pw-refinement-profiles">
          Profiles: {session.profiles.join(", ")}
        </p>
      )}
    </section>
  );
}
