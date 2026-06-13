/**
 * Perceptual Web — shared contracts (mirror of GenUI/shared/contracts.ts)
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
