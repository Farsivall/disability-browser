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
      const page = await new Promise<ExtractedPage>((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("timed out (no response from the page bridge)"));
        }, 8000);
        const onMsg = (e: MessageEvent) => {
          const d = e.data;
          if (!d || typeof d !== "object") return;
          if (
            d.type === "EXTRACTED_PAGE" &&
            d.data &&
            typeof d.data === "object" &&
            "elements" in d.data
          ) {
            cleanup();
            resolve(d.data as ExtractedPage);
          } else if (d.type === "ERROR") {
            // Surface the REAL reason (e.g. missing host permission, no active
            // tab) instead of silently using the mock.
            cleanup();
            reject(new Error(typeof d.detail === "string" ? d.detail : "extraction error"));
          }
        };
        const cleanup = () => {
          clearTimeout(timer);
          window.removeEventListener("message", onMsg);
        };
        window.addEventListener("message", onMsg);
        window.parent.postMessage({ type: EXTRACTION_REQUEST }, "*");
      });
      statusBus.push(
        `Extracted ${page.elements.length} elements from the live page`,
        "success",
      );
      return page;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn("[PerceptualWeb] iframe extraction failed:", reason);
      statusBus.push(`Extraction failed: ${reason} — using sample page`, "warn");
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
    title: "AudioMax Pro Wireless Headphones - MEGA DEAL - Best Price Online",
    elements: [
      { sourceRef: "pw-1", role: "button", text: "Accept all cookies" },
      { sourceRef: "pw-4", role: "button", text: "No thanks (close newsletter)" },
      { sourceRef: "pw-5", role: "nav", text: "Main navigation" },
      { sourceRef: "pw-6", role: "link", text: "Home", href: "shop.html" },
      { sourceRef: "pw-7", role: "link", text: "Headphones", href: "shop.html" },
      { sourceRef: "pw-8", role: "link", text: "Speakers", href: "shop.html" },
      { sourceRef: "pw-9", role: "link", text: "Earbuds", href: "shop.html" },
      { sourceRef: "pw-10", role: "link", text: "Flash Sale", href: "shop.html" },
      { sourceRef: "pw-11", role: "link", text: "Clearance", href: "shop.html" },
      { sourceRef: "pw-12", role: "link", text: "My Account", href: "shop.html" },
      { sourceRef: "pw-13", role: "link", text: "Cart (0)", href: "shop.html" },
      { sourceRef: "pw-14", role: "button", text: "Previous image" },
      { sourceRef: "pw-15", role: "button", text: "Next image" },
      { sourceRef: "pw-16", role: "image", alt: "AudioMax Pro headphones front view" },
      {
        sourceRef: "pw-17",
        role: "heading",
        level: 1,
        text: "AudioMax Pro Wireless Bluetooth Over-Ear Headphones Noise Cancelling Hi-Fi Stereo Premium Sound Best Seller 2024 Limited Edition",
      },
      { sourceRef: "pw-18", role: "paragraph", text: "Was $399.99  Now $149.99  Extra 10% with coupon" },
      { sourceRef: "pw-19", role: "input", inputType: "checkbox", text: "Apply 10% coupon" },
      { sourceRef: "pw-20", role: "button", text: "S" },
      { sourceRef: "pw-21", role: "button", text: "M" },
      { sourceRef: "pw-22", role: "button", text: "L" },
      { sourceRef: "pw-23", role: "button", text: "XL" },
      { sourceRef: "pw-24", role: "button", text: "XXL" },
      { sourceRef: "pw-25", role: "button", text: "Add to Cart" },
      { sourceRef: "pw-26", role: "button", text: "Buy Now" },
      { sourceRef: "pw-27", role: "button", text: "Save for Later" },
      { sourceRef: "pw-28", role: "button", text: "Compare" },
      {
        sourceRef: "pw-29",
        role: "paragraph",
        text: "Experience studio-grade audio with 40mm drivers, 30-hour battery life, active noise cancellation, and plush memory-foam ear cups designed for all-day comfort.",
      },
      { sourceRef: "pw-30", role: "link", text: "Related: BassBoost Earbuds", href: "shop.html" },
      { sourceRef: "pw-31", role: "link", text: "Related: SoundWave Speaker", href: "shop.html" },
      { sourceRef: "pw-32", role: "link", text: "Sponsored: Buy 2 get 1 free!", href: "shop.html" },
    ],
  };
}
