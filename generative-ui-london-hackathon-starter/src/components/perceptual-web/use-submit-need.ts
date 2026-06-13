"use client";

import { useCallback, useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { statusBus } from "@/a2ui/status-bus";
import { requestExtractedPage } from "@/lib/request-extraction";
import { PERCEPTUAL_AGENT_CHANNEL } from "@/lib/proxy-transport";
import { surfaceBus } from "@/a2ui/surface-bus";
import { buildDemoSurfaceForProfiles } from "@/components/perceptual-web/demo-surface";
import { useRefinementSession } from "@/a2ui/refinement-session";
import { usePerceptualTheme } from "@/a2ui/use-perceptual-theme";

const AGENT_SURFACE_TIMEOUT_MS = 8_000;

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
