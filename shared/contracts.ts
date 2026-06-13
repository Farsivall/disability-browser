/**
 * Perceptual Web — shared contracts (DO NOT CHANGE without team agreement)
 *
 * Dummy test site: http://localhost:8080
 *   - Page 1: http://localhost:8080/shop-clutter.html  (ShopClutter — primary demo)
 *   - Page 2: http://localhost:8080/news-wall.html      (NewsWall)
 *   - Page 3: http://localhost:8080/form-maze.html      (FormMaze — optional)
 *
 * Real-site validation URLs (fill in during hour 1):
 *   - E-commerce: TBD
 *   - Article: TBD
 */

export const DUMMY_SITE_BASE_URL = "http://localhost:8080";

export const DUMMY_SITE_PAGES = {
  shopClutter: `${DUMMY_SITE_BASE_URL}/shop-clutter.html`,
  newsWall: `${DUMMY_SITE_BASE_URL}/news-wall.html`,
  formMaze: `${DUMMY_SITE_BASE_URL}/form-maze.html`,
} as const;

/** Contract 1 — Builder B produces, Builder A consumes */
export interface ExtractedPage {
  url: string;
  pageType: string | null; // "article" | "product" | "form" | "feed" | "dashboard" | null
  title: string;
  elements: ExtractedElement[];
}

export interface ExtractedElement {
  sourceRef: string;
  role: string; // "heading" | "paragraph" | "link" | "button" | "input" | "image" | "list" | "nav" | "form" | ...
  level?: number;
  text?: string;
  href?: string;
  inputType?: string;
  options?: string[];
  alt?: string;
  children?: ExtractedElement[];
}

/** Contract 2 — Builder C / side panel produces, Builder B / content script consumes */
export interface ProxyMessage {
  type: "PROXY_EVENT";
  action: "click" | "navigate" | "input" | "submit";
  sourceRef: string;
  value?: string;
}

/** Agreed prop name for sourceRef on A2UI accessible components */
export const SOURCE_REF_PROP = "sourceRef" as const;

/** Agent sets theme via updateDataModel at this path */
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

/** Payload extension for refinement loop (Builder C → A) */
export interface PerceptualWebSubmitPayload {
  need: string;
  latestNeed: string;
  needHistory: string[];
  activeProfiles: string[];
  isRefinement: boolean;
  extractedPage: ExtractedPage;
  perceptualTheme?: PerceptualTheme;
}
