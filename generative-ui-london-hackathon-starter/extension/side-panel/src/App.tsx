/**
 * Perceptual Web — Side Panel React App (Phase 4+)
 *
 * This is the CopilotKit-connected side panel. It replaces the plain HTML
 * panel.js panel from Phases 1-3 once you point manifest.json's default_path
 * at dist/index.html (or http://localhost:5173 during dev).
 *
 * Architecture:
 *   CopilotKit provider  -> talks to Next.js runtime at RUNTIME_URL
 *   useBackgroundBridge  -> long-lived port to background.js for DOM messages
 *   NeedInput            -> text + voice input, sends need + ExtractedPage
 *   AgentSurface         -> renders the A2UI envelopes the agent streams back
 *
 * TEST B4 (risk gate): with `pnpm dev` running in the hackathon-starter dir,
 * open DevTools → Network on this panel. Type anything in the chat. You should
 * see a POST to localhost:3000/api/copilotkit-pdf and a streaming response.
 */

import React, { useEffect, useState } from "react";
import { CopilotKit, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import { useBackgroundBridge } from "./useBackgroundBridge";

// ─── Config ────────────────────────────────────────────────────────────────
// The Next.js runtime endpoint that brokers AG-UI to the Python agent.
// Matches the route at src/app/api/copilotkit-pdf/route.ts.
const RUNTIME_URL = "http://localhost:3000/api/copilotkit-pdf";

// ─── Root ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <CopilotKit runtimeUrl={RUNTIME_URL} agent="dynamic_agent">
      <PanelShell />
    </CopilotKit>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────
function PanelShell() {
  const bridge = useBackgroundBridge();
  const [status, setStatus] = useState("Connecting…");
  const [statusKind, setStatusKind] = useState<"idle" | "ok" | "error">("idle");

  // Inject ExtractedPage into agent context so every message automatically
  // carries the live page structure. The agent reads this via CopilotKit's
  // readable context alongside the user's free-text need.
  useCopilotReadable({
    description:
      "The current web page's semantic structure, extracted live from the DOM. " +
      "Each element has a sourceRef (data-pw-ref attribute) that MUST be preserved " +
      "on every interactive component you generate so click-proxying works.",
    value: bridge.extractedPage ?? "Page not yet extracted — wait for extraction or ask user to refresh.",
  });

  useEffect(() => {
    if (bridge.pageTitle) {
      setStatus(
        bridge.extractedPage
          ? `Extracted: ${bridge.extractedPage.elements.length} elements`
          : `Page: ${bridge.pageTitle} — extracting…`
      );
      setStatusKind("ok");
    }
  }, [bridge.pageTitle, bridge.extractedPage]);

  return (
    <div className="shell">
      <header className="shell-header">
        <span className="logo">Perceptual Web</span>
        <span className={`status-dot ${statusKind}`} title={status} />
      </header>

      <div className="shell-status">{status}</div>

      {/* Phase 4 TEST: CopilotChat proves the runtime link works */}
      <div className="chat-wrapper">
        <CopilotChat
          instructions={buildInstructions(bridge.extractedPage)}
          labels={{
            title: "Perceptual Web Agent",
            initial: bridge.extractedPage
              ? "Page extracted. Describe what's hard for you and I'll regenerate the interface."
              : "Extracting page… or describe a need to start.",
          }}
        />
      </div>

      {/* Phase 5: extraction trigger button (also available in chat) */}
      <div className="extract-bar">
        <button
          className="btn-extract"
          onClick={() => {
            setStatus("Extracting page…");
            bridge.requestExtraction();
          }}
        >
          Re-extract Page
        </button>
        {bridge.extractedPage && (
          <span className="extract-count">
            {bridge.extractedPage.elements.length} elements · {bridge.extractedPage.pageType ?? "unknown type"}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Build the system instructions that inject the ExtractedPage into the agent's
 * context. The agent reads this alongside the user's need text.
 *
 * Coordinate the exact format with Builder A — they read this in the Python agent.
 */
function buildInstructions(_extractedPage: ExtractedPage | null): string {
  return (
    "You are the Perceptual Web agent. The user is on a web page and has described what " +
    "they find hard about it. You have access to the page's semantic structure via the " +
    "'extracted page' readable context (see above). " +
    "Map the user's need text to one or more need-profiles:\n" +
    "  VISUAL — large text, high contrast, remove decorative clutter\n" +
    "  COGNITIVE — single column, de-clutter, semantic headings, generous spacing\n" +
    "  MOTOR — every interactive element >=44x44px, flatten nav, big buttons\n" +
    "  VESTIBULAR — static only, no animations, unpack carousels to grids\n" +
    "  ESSENTIALIST — strip to the single task the user named\n\n" +
    "Generate an accessible A2UI surface applying the matching directives. " +
    "CRITICAL: every interactive component you emit MUST carry the original sourceRef " +
    "from the ExtractedPage so click-proxying back to the live page works."
  );
}

// ─── Types ────────────────────────────────────────────────────────────────
interface ExtractedPage {
  url: string;
  pageType: string | null;
  title: string;
  elements: Array<{
    sourceRef: string;
    role: string;
    level?: number;
    text?: string;
    href?: string;
    inputType?: string;
    options?: string[];
    alt?: string;
  }>;
}
