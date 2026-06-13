"use client";

import { useCallback, useState } from "react";
import { SidePanelProviders } from "./SidePanelProviders";
import { SidePanelStatus } from "./SidePanelStatus";
import { SidePanelSurface } from "./SidePanelSurface";
import { NeedInput } from "./NeedInput";
import { RefinementHistory } from "./RefinementHistory";
import { PerceptualThemeProvider } from "@/a2ui/use-perceptual-theme";
import { RefinementSessionProvider, useRefinementSession } from "@/a2ui/refinement-session";
import { statusBus } from "@/a2ui/status-bus";
import { surfaceBus } from "@/a2ui/surface-bus";
import {
  buildDemoCognitiveSurface,
  DEMO_REFINEMENT_COMMANDS,
} from "./demo-surface";
import { PERCEPTUAL_AGENT_CHANNEL } from "@/lib/proxy-transport";
import { useSubmitNeed } from "./use-submit-need";

/**
 * Perceptual Web side panel — loaded by Builder B into chrome.sidePanel.
 * Dev: http://localhost:3000/side-panel
 */
export function SidePanelShell() {
  return (
    <SidePanelProviders>
      <RefinementSessionProvider>
        <PerceptualThemeProvider>
          <SidePanelShellInner />
        </PerceptualThemeProvider>
      </RefinementSessionProvider>
    </SidePanelProviders>
  );
}

function SidePanelShellInner() {
  const { resetSession } = useRefinementSession();
  const { submitNeed } = useSubmitNeed();
  const [c6Running, setC6Running] = useState(false);

  const loadDemoSurface = useCallback(() => {
    resetSession();
    statusBus.clear();
    statusBus.push("Loading demo cognitive layout…", "info");
    surfaceBus.reset(PERCEPTUAL_AGENT_CHANNEL);
    surfaceBus.push(PERCEPTUAL_AGENT_CHANNEL, buildDemoCognitiveSurface());
    statusBus.push("Demo surface ready", "success");
  }, [resetSession]);

  const runRefinementDemoC6 = useCallback(async () => {
    if (c6Running) return;
    setC6Running(true);
    resetSession();
    statusBus.clear();
    statusBus.push("TEST C6 — three-command refinement demo", "info");

    for (let i = 0; i < DEMO_REFINEMENT_COMMANDS.length; i++) {
      statusBus.push(`Command ${i + 1} of 3…`, "info");
      await submitNeed(DEMO_REFINEMENT_COMMANDS[i], { forceDemo: true });
      if (i < DEMO_REFINEMENT_COMMANDS.length - 1) {
        await new Promise((r) => window.setTimeout(r, 1200));
      }
    }

    statusBus.push("TEST C6 complete — three layouts applied", "success");
    setC6Running(false);
  }, [c6Running, resetSession, submitNeed]);

  return (
    <div className="pw-side-panel-root">
      <header className="pw-side-panel-header">
        <div>
          <div className="pw-side-panel-title">Perceptual Web</div>
          <div className="pw-side-panel-tagline">
            Responsive design fits devices. We fit people.
          </div>
        </div>
        <div className="pw-side-panel-dev-bar">
          <button
            type="button"
            className="pw-side-panel-dev-btn"
            onClick={loadDemoSurface}
          >
            Demo surface
          </button>
          <button
            type="button"
            className="pw-side-panel-dev-btn"
            onClick={() => void runRefinementDemoC6()}
            disabled={c6Running}
          >
            {c6Running ? "C6 running…" : "TEST C6"}
          </button>
        </div>
      </header>

      <SidePanelStatus />
      <RefinementHistory />
      <SidePanelSurface />
      <NeedInput />
    </div>
  );
}
