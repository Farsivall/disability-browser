/**
 * Shared data contracts for Perceptual Web (TypeScript mirror).
 *
 * This is the exact mirror of `agent/src/contracts.py`. The content script
 * (DOM extraction + proxying) and the side panel (generated UI) both import
 * from here so there is one source of truth. Keep this in lockstep with the
 * Python file and CONTRACTS.md.
 */

// ── Constants shared with the agent (mirror of contracts.py) ─────────────────

/** The single A2UI event name every interactive generated component uses. */
export const PROXY_EVENT_NAME = "proxy_event";

/** The literal `type` field on a ProxyMessage. */
export const PROXY_MESSAGE_TYPE = "PROXY_EVENT";

export type ProxyAction = "click" | "navigate" | "input" | "submit";

export type PageType =
  | "article"
  | "product"
  | "form"
  | "feed"
  | "dashboard"
  | null;

// ── CONTRACT 1 — ExtractedPage ───────────────────────────────────────────────

/**
 * One node in the extracted page tree. `sourceRef` is the stable bridge key the
 * proxy uses to re-find the real element; every other field is role-dependent.
 */
export interface ExtractedElement {
  sourceRef: string;
  role: string; // "heading" | "paragraph" | "link" | "button" | "input" | ...
  level?: number; // headings only (1-6)
  text?: string;
  href?: string; // links only
  inputType?: string; // inputs only
  options?: string[]; // selects/radios only
  alt?: string; // images only
  children?: ExtractedElement[];
}

/** The full snapshot the agent receives as input. */
export interface ExtractedPage {
  url: string;
  pageType: PageType;
  title: string;
  elements: ExtractedElement[];
}

// ── CONTRACT 2 — ProxyMessage ────────────────────────────────────────────────

/** Built by the side panel, consumed by the content script. */
export interface ProxyMessage {
  type: typeof PROXY_MESSAGE_TYPE;
  action: ProxyAction;
  sourceRef: string;
  value?: string; // for "input" actions
}

// ── The bridge: A2UI event context <-> ProxyMessage ──────────────────────────

/**
 * The shape the agent inlines into an interactive component's
 * `action.event.context`. The side panel reads this off a dispatch and turns it
 * into a ProxyMessage via `toProxyMessage` below.
 */
export interface ProxyEventContext {
  sourceRef: string;
  action: ProxyAction;
  value?: string;
}

/**
 * Convert the `context` carried on an A2UI proxy event into a ProxyMessage.
 * Call this from the side panel's onAction handler when
 * `event.name === PROXY_EVENT_NAME`. Returns null if the context is malformed.
 */
export function toProxyMessage(
  context: Partial<ProxyEventContext> | undefined,
): ProxyMessage | null {
  if (!context || !context.sourceRef || !context.action) return null;
  const msg: ProxyMessage = {
    type: PROXY_MESSAGE_TYPE,
    action: context.action,
    sourceRef: context.sourceRef,
  };
  if (context.value !== undefined) msg.value = context.value;
  return msg;
}
