"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import { createMirrorActivityRenderer } from "@/a2ui/MirrorRenderer";
import { PERCEPTUAL_AGENT_CHANNEL } from "@/lib/proxy-transport";

const RUNTIME_URL =
  process.env.NEXT_PUBLIC_COPILOT_RUNTIME_URL ?? "/api/copilotkit-pdf";

const RENDERERS = [createMirrorActivityRenderer(PERCEPTUAL_AGENT_CHANNEL)];

/**
 * CopilotKit provider for the side panel.
 * Builder B: point extension side panel at this app's /side-panel route;
 * runtimeUrl reaches the Next.js AG-UI broker → Python agent.
 */
export function SidePanelProviders({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl={RUNTIME_URL} renderActivityMessages={RENDERERS}>
      {children}
    </CopilotKit>
  );
}
