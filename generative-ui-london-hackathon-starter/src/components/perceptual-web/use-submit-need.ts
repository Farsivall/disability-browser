"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgent, useAgentContext } from "@copilotkit/react-core/v2";
import { statusBus } from "@/a2ui/status-bus";
import { requestExtractedPage } from "@/lib/request-extraction";
import type { ExtractedPage } from "@/lib/contracts";
import { PERCEPTUAL_AGENT_CHANNEL } from "@/lib/proxy-transport";
import { surfaceBus } from "@/a2ui/surface-bus";
import { buildDemoSurfaceForProfiles } from "@/components/perceptual-web/demo-surface";
import { useRefinementSession } from "@/a2ui/refinement-session";
import { usePerceptualTheme } from "@/a2ui/use-perceptual-theme";

// Upper bound only — exists solely to detect a genuinely hung/offline agent and
// fall back gracefully, NOT to cap normal generation. Real generation
// (map_need + Linkup enrichment + the generation LLM call on a large page) must
// always win, so keep this generous.
const AGENT_SURFACE_TIMEOUT_MS = 90_000;

export type SubmitNeedOptions = {
  /** Skip agent and always apply offline demo layouts (TEST C6) */
  forceDemo?: boolean;
};

function surfaceOpCount(): number {
  return surfaceBus.snapshot(PERCEPTUAL_AGENT_CHANNEL).ops.length;
}

export function pushDemoSurface(
  profiles: ReturnType<typeof useRefinementSession>["session"]["profiles"],
  theme: ReturnType<typeof useRefinementSession>["session"]["theme"],
) {
  surfaceBus.reset(PERCEPTUAL_AGENT_CHANNEL);
  surfaceBus.push(
    PERCEPTUAL_AGENT_CHANNEL,
    buildDemoSurfaceForProfiles(profiles, theme),
  );
}

/**
 * Submits user need with refinement accumulation + theme persistence.
 */
export function useSubmitNeed() {
  const { agent } = useAgent({ agentId: PERCEPTUAL_AGENT_CHANNEL });
  const { appendNeed, session } = useRefinementSession();
  const { patchTheme } = usePerceptualTheme();
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Make the live page reach the Python agent via the CopilotKit *context*
  // channel (the only path that lands in state["copilotkit"]["context"], which
  // the /perceptual agent reads). forwardedProps are dropped by LangGraph, so
  // this readable — not forwardedProps — is what actually delivers the page.
  // Fetched on mount (web-app: mock; extension: live bridge) so it's present
  // before the user submits (no readable/runAgent race).
  const [pageForContext, setPageForContext] = useState<ExtractedPage | null>(null);
  useEffect(() => {
    let live = true;
    requestExtractedPage()
      .then((p) => { if (live) setPageForContext(p); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  useAgentContext({
    description:
      "The current web page's extracted semantic structure (ExtractedPage). " +
      "Rebuild THIS page. Every interactive element has a sourceRef that MUST be " +
      "preserved on the component you generate so click-proxying works.",
    value: pageForContext ?? "Page not extracted yet.",
  });

  const submitNeed = useCallback(
    async (need: string, options?: SubmitNeedOptions) => {
      const trimmed = need.trim();
      if (!trimmed || submittingRef.current) return;

      submittingRef.current = true;
      setIsSubmitting(true);
      const isRefinement = session.needs.length > 0;
      statusBus.push(
        isRefinement
          ? `Refining layout: "${trimmed}"`
          : `Understanding: "${trimmed}"`,
        "info",
      );

      const updatedSession = appendNeed(trimmed);
      patchTheme(updatedSession.theme);

      const applyDemo = (reason: "offline" | "forced" | "fallback") => {
        if (reason === "forced") {
          statusBus.push("Applying demo refinement layout…", "info");
        } else if (reason === "offline") {
          statusBus.push(
            "Agent offline — applying demo refinement layout",
            "warn",
          );
        } else {
          statusBus.push(
            "Using demo layout (agent produced no surface)",
            "warn",
          );
        }
        pushDemoSurface(updatedSession.profiles, updatedSession.theme);
        statusBus.push("Demo layout ready", "success");
      };

      try {
        const extractedPage = await requestExtractedPage();

        if (options?.forceDemo || !agent) {
          applyDemo(options?.forceDemo ? "forced" : "offline");
          return;
        }

        // DoD #4 — enrichment runs visibly (it auto-runs server-side when a
        // Linkup key is set; never blocks — it's timeout-wrapped in the agent).
        statusBus.push("Researching best practices…", "info");
        statusBus.push("Generating accessible layout…", "info");
        const opsBefore = surfaceOpCount();

        agent.addMessage({
          id: crypto.randomUUID(),
          role: "user",
          content: updatedSession.needs.join(". "),
        });

        try {
          await Promise.race([
            agent.runAgent({
              forwardedProps: {
                perceptualWeb: {
                  need: updatedSession.needs.join(". "),
                  latestNeed: trimmed,
                  needHistory: updatedSession.needs,
                  activeProfiles: updatedSession.profiles,
                  isRefinement,
                  extractedPage,
                  perceptualTheme: updatedSession.theme,
                },
              },
            }),
            new Promise<never>((_, reject) => {
              window.setTimeout(
                () => reject(new Error("agent surface timeout")),
                AGENT_SURFACE_TIMEOUT_MS,
              );
            }),
          ]);
        } catch (err) {
          console.warn("[PerceptualWeb] agent.runAgent failed", err);
        }

        if (surfaceOpCount() <= opsBefore) {
          applyDemo("fallback");
          return;
        }

        statusBus.push(
          isRefinement ? "Layout refined" : "Layout updated",
          "success",
        );
      } catch (err) {
        console.warn("[PerceptualWeb] submitNeed failed", err);
        statusBus.push("Generation failed — try again", "warn");
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [agent, appendNeed, patchTheme, session.needs.length],
  );

  return {
    submitNeed,
    isSubmitting,
    isAgentReady: !!agent,
    refinementCount: session.needs.length,
  };
}
