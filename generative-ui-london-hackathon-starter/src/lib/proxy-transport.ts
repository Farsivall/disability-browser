import type { ProxyMessage } from "@/lib/contracts";

/** Channel Builder B + CopilotKit use for perceptual-web surfaces */
export const PERCEPTUAL_AGENT_CHANNEL = "perceptual_agent";

/**
 * Sends ProxyMessage to the extension content script (Builder B).
 * Falls back to console when not running inside chrome.sidePanel.
 */
export function sendProxyMessage(message: ProxyMessage): void {
  const chromeApi = (
    globalThis as typeof globalThis & {
      chrome?: { runtime?: { sendMessage: (msg: unknown) => Promise<unknown> } };
    }
  ).chrome;

  if (chromeApi?.runtime?.sendMessage) {
    void chromeApi.runtime.sendMessage(message).catch((err) => {
      console.warn("[PerceptualWeb] chrome.runtime.sendMessage failed", err);
      console.log("[PerceptualWeb] ProxyMessage (fallback)", message);
    });
    return;
  }

  console.log("[PerceptualWeb] ProxyMessage", message);
}
