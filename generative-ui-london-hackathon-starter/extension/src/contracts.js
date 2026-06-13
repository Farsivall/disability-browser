/**
 * Shared contract constants — import from here instead of hard-coding strings.
 *
 * All three builders MUST use these same values:
 *   Builder B — stamps DATA_ATTR on the DOM at extraction time; reads it in proxy.
 *   Builder A — must forward SOURCE_REF_PROP on every interactive A2UI component it emits.
 *   Builder C — reads SOURCE_REF_PROP from rendered components; sends ProxyMessage with it.
 */

/** The DOM attribute stamped on each extracted element. */
export const DATA_ATTR = "data-pw-ref";

/** The A2UI component prop name that carries the sourceRef through to the renderer. */
export const SOURCE_REF_PROP = "sourceRef";

/** Prefix for generated sourceRef values (e.g. "pw-42"). */
export const REF_PREFIX = "pw-";

/**
 * ProxyMessage.type constant — the message type sent from side panel → content script.
 * @type {"PROXY_EVENT"}
 */
export const PROXY_EVENT_TYPE = "PROXY_EVENT";

/** Valid proxy actions. */
export const PROXY_ACTIONS = /** @type {const} */ (["click", "navigate", "input", "submit"]);
