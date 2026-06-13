/**
 * Content script — runs on every matched page (localhost/*).
 *
 * MV3 content scripts cannot use ES module `import` statements (Chrome does not
 * support the "type": "module" flag on content_scripts). So extractor.js and
 * proxy.js are loaded at runtime via dynamic import() using their
 * chrome.runtime.getURL paths. The extension declares them as
 * web_accessible_resources in manifest.json so this works.
 *
 * Responsibilities:
 *   Phase 1: Send PAGE_TITLE to the background on load.
 *   Phase 2: Extract DOM into ExtractedPage on REQUEST_EXTRACTION.
 *   Phase 3: Fire real DOM events on PROXY_EVENT.
 */

// ─── Phase 1: announce page title on load ─────────────────────────────────
chrome.runtime.sendMessage({ type: "PAGE_TITLE", title: document.title });

// ─── Lazy-load helpers (avoids import) ────────────────────────────────────
let _extractPage = null;
let _handleProxyEvent = null;

async function getExtractor() {
  if (!_extractPage) {
    const mod = await import(chrome.runtime.getURL("src/extractor.js"));
    _extractPage = mod.extractPage;
  }
  return _extractPage;
}

async function getProxy() {
  if (!_handleProxyEvent) {
    const mod = await import(chrome.runtime.getURL("src/proxy.js"));
    _handleProxyEvent = mod.handleProxyEvent;
  }
  return _handleProxyEvent;
}

// ─── Message listener ─────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "REQUEST_TITLE") {
    const payload = { type: "PAGE_TITLE", title: document.title };
    sendResponse(payload);
    chrome.runtime.sendMessage(payload);
    return true;
  }

  if (msg.type === "REQUEST_EXTRACTION") {
    getExtractor().then((extractPage) => {
      const data = extractPage();
      sendResponse({ type: "EXTRACTED_PAGE", data });
      // Also push via one-time message so background relays it to the panel.
      chrome.runtime.sendMessage({ type: "EXTRACTED_PAGE", data });
    });
    return true; // keep channel open for async sendResponse
  }

  if (msg.type === "PROXY_EVENT") {
    getProxy().then((handleProxyEvent) => {
      const result = handleProxyEvent(msg);
      sendResponse({ type: "PROXY_ACK", ...result });
      chrome.runtime.sendMessage({ type: "PROXY_ACK", ...result });
    });
    return true;
  }
});
