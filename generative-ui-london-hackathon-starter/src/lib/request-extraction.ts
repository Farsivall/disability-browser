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

  return mockShopClutterPage();
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
