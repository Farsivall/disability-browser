/**
 * Request ExtractedPage from extension content script (Builder B).
 * Dev fallback: minimal mock from ShopClutter dummy site.
 */
import type { ExtractedPage } from "@/lib/contracts";
import { DUMMY_SITE_PAGES } from "@/lib/contracts";
import { statusBus } from "@/a2ui/status-bus";

const EXTRACTION_REQUEST = "REQUEST_EXTRACTION" as const;

export async function requestExtractedPage(): Promise<ExtractedPage> {
  const chromeApi = (
    globalThis as typeof globalThis & {
      chrome?: {
        runtime?: {
          sendMessage: (msg: unknown) => Promise<unknown>;
        };
      };
    }
  ).chrome;

  if (chromeApi?.runtime?.sendMessage) {
    try {
      statusBus.push("Extracting page from tab…", "info");
      const response = await chromeApi.runtime.sendMessage({
        type: EXTRACTION_REQUEST,
      });
      if (response && typeof response === "object" && "elements" in response) {
        return response as ExtractedPage;
      }
    } catch (err) {
      console.warn("[PerceptualWeb] extraction request failed", err);
      statusBus.push("Extraction failed — using dev mock page", "warn");
    }
  }

  // Extension mode: this panel runs inside the extension host's iframe (no
  // chrome.* here). Ask the host (which holds the background Port) to extract
  // and await the EXTRACTED_PAGE it relays back. Falls back to the mock on
  // timeout, so web-app mode (not in an iframe) is unaffected.
  if (inIframe()) {
    try {
      statusBus.push("Extracting page from tab…", "info");
      return await new Promise<ExtractedPage>((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("extraction timeout"));
        }, 4000);
        const onMsg = (e: MessageEvent) => {
          const d = e.data;
          if (
            d &&
            typeof d === "object" &&
            d.type === "EXTRACTED_PAGE" &&
            d.data &&
            typeof d.data === "object" &&
            "elements" in d.data
          ) {
            cleanup();
            resolve(d.data as ExtractedPage);
          }
        };
        const cleanup = () => {
          clearTimeout(timer);
          window.removeEventListener("message", onMsg);
        };
        window.addEventListener("message", onMsg);
        window.parent.postMessage({ type: EXTRACTION_REQUEST }, "*");
      });
    } catch (err) {
      console.warn("[PerceptualWeb] iframe extraction failed", err);
      statusBus.push("Extraction failed — using dev mock page", "warn");
    }
  }

  return mockShopClutterPage();
}

/** True when running inside an iframe (the extension host wraps C's panel). */
function inIframe(): boolean {
  try {
    return typeof window !== "undefined" && window.parent !== window;
  } catch {
    return true;
  }
}

/** Minimal ExtractedPage for dev without extension */
function mockShopClutterPage(): ExtractedPage {
  return {
    url: DUMMY_SITE_PAGES.shopClutter,
    pageType: "product",
    title: "UltraMega Pro Wireless Headphones",
    elements: [
      {
        sourceRef: "product-title",
        role: "heading",
        level: 1,
        text: "UltraMega Pro Wireless Noise-Cancelling Bluetooth Headphones",
      },
      {
        sourceRef: "product-desc",
        role: "paragraph",
        text: "Experience unparalleled audio fidelity with flagship wireless headphones.",
      },
      {
        sourceRef: "btn-add-to-cart",
        role: "button",
        text: "Add to Cart",
      },
      {
        sourceRef: "nav-home",
        role: "link",
        text: "Home",
        href: "index.html",
      },
      {
        sourceRef: "nav-news",
        role: "link",
        text: "News",
        href: "news-wall.html",
      },
    ],
  };
}
