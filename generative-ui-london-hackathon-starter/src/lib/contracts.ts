/**
 * Perceptual Web — shared TS contracts (single source of truth).
 *
 * Imported across the app via `@/lib/contracts`. Mirrors the agent-side Python
 * contracts in `agent/src/contracts.py` and Builder B's
 * `extension/src/contracts.js`. Keep those three aligned.
 */

export const DUMMY_SITE_BASE_URL = "http://localhost:8080";

export const DUMMY_SITE_PAGES = {
  shopClutter: `${DUMMY_SITE_BASE_URL}/shop-clutter.html`,
  newsWall: `${DUMMY_SITE_BASE_URL}/news-wall.html`,
  formMaze: `${DUMMY_SITE_BASE_URL}/form-maze.html`,
} as const;

export interface ExtractedPage {
  url: string;
  pageType: string | null;
  title: string;
  elements: ExtractedElement[];
}

export interface ExtractedElement {
  sourceRef: string;
  role: string;
  level?: number;
  text?: string;
  href?: string;
  inputType?: string;
  options?: string[];
  alt?: string;
  children?: ExtractedElement[];
}

export interface ProxyMessage {
  type: "PROXY_EVENT";
  action: "click" | "navigate" | "input" | "submit";
  sourceRef: string;
  value?: string;
}

export const SOURCE_REF_PROP = "sourceRef" as const;

export const PERCEPTUAL_THEME_PATH = "/perceptualTheme";

export interface PerceptualTheme {
  contrast?: "default" | "high";
  textScale?: "default" | "large" | "xlarge";
  focusStyle?: "default" | "emphasized";
  spacing?: "default" | "cognitive";
  reduceMotion?: boolean;
  hideDecorations?: boolean;
  readableFont?: boolean;
}

/**
 * Payload the side panel sends to the /perceptual agent (Builder C → A),
 * including the accumulated refinement state. The agent reads `extractedPage`
 * + `latestNeed` (or `need`) and the running `needHistory`/`activeProfiles`
 * to build on prior turns.
 */
export interface PerceptualWebSubmitPayload {
  need: string;
  latestNeed: string;
  needHistory: string[];
  activeProfiles: string[];
  isRefinement: boolean;
  extractedPage: ExtractedPage;
  perceptualTheme?: PerceptualTheme;
}
