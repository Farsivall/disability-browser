"use client";

import { useSyncExternalStore } from "react";
import { statusBus, type StatusLine } from "@/a2ui/status-bus";

export function SidePanelStatus() {
  const lines = useSyncExternalStore(
    statusBus.subscribe.bind(statusBus),
    statusBus.snapshot,
    () => [] as StatusLine[],
  );

  return (
    <section
      className="pw-side-panel-status"
      aria-label="Agent status"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {lines.length === 0 ? (
        <p className="pw-side-panel-status-empty">
          Agent status will appear here while generating…
        </p>
      ) : (
        <ul className="pw-side-panel-status-list">
          {lines.map((line) => (
            <li
              key={line.id}
              className={`pw-side-panel-status-item${
                line.tone === "success"
                  ? " pw-side-panel-status-item--success"
                  : line.tone === "warn"
                    ? " pw-side-panel-status-item--warn"
                    : ""
              }`}
            >
              <span className="pw-side-panel-status-dot" aria-hidden />
              {line.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
