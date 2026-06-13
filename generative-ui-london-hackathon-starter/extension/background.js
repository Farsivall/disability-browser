/**
 * Background service worker — message hub + on-demand script injection.
 *
 * Extraction and proxying are done with chrome.scripting.executeScript instead
 * of a persistent content script. This is far more robust:
 *   - No "receiving end does not exist" after an extension reload.
 *   - No dynamic import() of web-accessible resources.
 *   - The injected function returns its result directly to the worker.
 *
 * The injected functions (pwExtractPage, pwProxyEvent) MUST be fully
 * self-contained — every helper is nested inside, because executeScript
 * serializes the function source and runs it in the page with no closure.
 *
 * Side panel <--port--> background --executeScript--> page
 */

let sidePanelPort = null;

// Open the side panel from the toolbar icon.
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "side-panel") return;
  sidePanelPort = port;

  port.onDisconnect.addListener(() => {
    sidePanelPort = null;
  });

  // On connect: push the active tab's title immediately so the panel isn't blank.
  getActiveTab().then((tab) => {
    if (tab && tab.title) {
      pushToPanel({ type: "PAGE_TITLE", title: tab.title });
    }
  });

  port.onMessage.addListener(async (msg) => {
    const tab = await getActiveTab();
    if (!tab) {
      pushToPanel({ type: "ERROR", detail: "No active tab" });
      return;
    }

    if (msg.type === "REQUEST_EXTRACTION") {
      await runExtraction(tab.id);
    } else if (msg.type === "PROXY_EVENT") {
      await runProxy(tab.id, msg);
    }
  });
});

// ─── Extraction ─────────────────────────────────────────────────────────
async function runExtraction(tabId) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: pwExtractPage,
    });
    pushToPanel({ type: "EXTRACTED_PAGE", data: res.result });
  } catch (err) {
    pushToPanel({ type: "ERROR", detail: "Extraction failed: " + String(err) });
  }
}

// ─── Proxy ──────────────────────────────────────────────────────────────
async function runProxy(tabId, msg) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: pwProxyEvent,
      args: [{ action: msg.action, sourceRef: msg.sourceRef, value: msg.value ?? null }],
    });
    pushToPanel({ type: "PROXY_ACK", ...res.result });
  } catch (err) {
    pushToPanel({
      type: "PROXY_ACK",
      action: msg.action,
      sourceRef: msg.sourceRef,
      status: "ERROR",
      detail: String(err),
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function pushToPanel(msg) {
  if (sidePanelPort) {
    try {
      sidePanelPort.postMessage(msg);
    } catch {
      sidePanelPort = null;
    }
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

// ════════════════════════════════════════════════════════════════════════
// INJECTED FUNCTIONS — run in the page. Must be fully self-contained.
// ════════════════════════════════════════════════════════════════════════

/**
 * Walk the DOM and return the ExtractedPage contract (Contract 1).
 * Stamps data-pw-ref on each element so proxy lookups are O(1).
 */
function pwExtractPage() {
  const MAX_TEXT_LEN = 200;
  const MAX_ELEMENTS = 300;
  const DATA_ATTR = "data-pw-ref";
  let counter = 0;

  function assignRef(el) {
    let ref = el.getAttribute(DATA_ATTR);
    if (!ref) {
      ref = "pw-" + ++counter;
      el.setAttribute(DATA_ATTR, ref);
    }
    return ref;
  }

  function truncate(str, len) {
    if (!str) return undefined;
    const s = String(str).trim().replace(/\s+/g, " ");
    if (!s) return undefined;
    return s.length > (len || MAX_TEXT_LEN) ? s.slice(0, len || MAX_TEXT_LEN) + "…" : s;
  }

  function isHidden(el) {
    if (!el) return true;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return true;
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return true;
    const r = el.getBoundingClientRect();
    return r.width === 0 && r.height === 0;
  }

  function isJunk(el) {
    const tag = (el.tagName || "").toLowerCase();
    return ["script", "style", "noscript", "template", "meta", "link", "head"].includes(tag);
  }

  function extractFormInputs(form) {
    const inputs = [];
    const nodes = form.querySelectorAll("input, select, textarea, button");
    for (const el of nodes) {
      if (isHidden(el)) continue;
      const tag = el.tagName.toLowerCase();
      if (tag === "input" && el.type === "hidden") continue;
      inputs.push({
        sourceRef: assignRef(el),
        role: tag === "button" ? "button" : "input",
        inputType: el.type || tag,
        text: truncate(el.placeholder || el.getAttribute("aria-label") || el.name),
      });
      if (inputs.length >= 20) break;
    }
    return inputs;
  }

  function detectPageType(elements) {
    const body = document.body.innerText.toLowerCase();
    const hasPrice = /\$[\d,]+|£[\d,]+|€[\d,]+/.test(body);
    const hasCart = /add to cart|buy now|add to bag/i.test(body);
    const hasArticle = !!document.querySelector("article, [role='article']");
    const wordCount = body.split(/\s+/).length;
    const inputCount = elements.filter((e) => e.role === "input").length;
    if (hasPrice && hasCart) return "product";
    if (hasArticle || wordCount > 500) return "article";
    if (inputCount >= 5) return "form";
    return null;
  }

  const elements = [];
  let count = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (isJunk(node) || isHidden(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node;
  while ((node = walker.nextNode()) && count < MAX_ELEMENTS) {
    const el = node;
    const tag = el.tagName.toLowerCase();
    let entry = null;

    if (/^h[1-6]$/.test(tag)) {
      entry = { sourceRef: assignRef(el), role: "heading", level: parseInt(tag[1], 10), text: truncate(el.textContent) };
    } else if (tag === "p") {
      const t = truncate(el.textContent);
      if (t) entry = { sourceRef: assignRef(el), role: "paragraph", text: t };
    } else if (tag === "a" && el.href) {
      entry = { sourceRef: assignRef(el), role: "link", text: truncate(el.textContent) || truncate(el.getAttribute("aria-label")), href: el.href };
    } else if (tag === "button") {
      entry = { sourceRef: assignRef(el), role: "button", text: truncate(el.textContent) || truncate(el.getAttribute("aria-label")) };
    } else if (tag === "input") {
      const type = el.type || "text";
      if (type !== "hidden" && type !== "submit" && type !== "reset") {
        entry = { sourceRef: assignRef(el), role: "input", inputType: type, text: truncate(el.placeholder || el.getAttribute("aria-label") || el.name) };
      }
    } else if (tag === "select") {
      const options = Array.from(el.options).map((o) => o.text).filter(Boolean).slice(0, 20);
      entry = { sourceRef: assignRef(el), role: "input", inputType: "select", text: truncate(el.getAttribute("aria-label") || el.name), options };
    } else if (tag === "textarea") {
      entry = { sourceRef: assignRef(el), role: "input", inputType: "textarea", text: truncate(el.placeholder || el.getAttribute("aria-label") || el.name) };
    } else if (tag === "img") {
      const alt = (el.alt || "").trim();
      if (alt) entry = { sourceRef: assignRef(el), role: "image", alt: truncate(alt) };
    } else if (tag === "nav") {
      entry = { sourceRef: assignRef(el), role: "nav", text: truncate(el.getAttribute("aria-label")) };
    } else if (tag === "form") {
      entry = { sourceRef: assignRef(el), role: "form", text: truncate(el.getAttribute("aria-label") || el.id), children: extractFormInputs(el) };
    } else if (tag === "li") {
      const t = truncate(el.textContent);
      if (t) entry = { sourceRef: assignRef(el), role: "list-item", text: t };
    }

    if (entry) {
      elements.push(entry);
      count++;
    }
  }

  return {
    url: location.href,
    pageType: detectPageType(elements),
    title: document.title,
    elements,
  };
}

/**
 * Fire a real DOM event on the element matching sourceRef (Contract 2).
 * Returns { status, action, sourceRef, detail? }.
 */
function pwProxyEvent(msg) {
  const DATA_ATTR = "data-pw-ref";
  const { action, sourceRef, value } = msg;
  const base = { action, sourceRef };

  const el = document.querySelector("[" + DATA_ATTR + '="' + sourceRef + '"]');
  if (!el) return { ...base, status: "NOT_FOUND", detail: "No element for " + sourceRef };

  function fireClick(node) {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  try {
    if (action === "click") {
      fireClick(el);
      return { ...base, status: "OK" };
    }

    if (action === "navigate") {
      fireClick(el);
      return { ...base, status: "OK" };
    }

    if (action === "input") {
      const tag = el.tagName.toLowerCase();
      if (tag === "select") {
        el.value = value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { ...base, status: "OK" };
      }
      const proto = tag === "textarea" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value");
      if (setter && setter.set) setter.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return { ...base, status: "OK" };
    }

    if (action === "submit") {
      const form = el.tagName.toLowerCase() === "form" ? el : el.closest("form");
      if (form) {
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else {
          const btn = form.querySelector('[type="submit"], button:not([type])');
          if (btn) fireClick(btn);
          else form.submit();
        }
        return { ...base, status: "OK" };
      }
      fireClick(el);
      return { ...base, status: "OK" };
    }

    return { ...base, status: "ERROR", detail: "Unknown action: " + action };
  } catch (err) {
    return { ...base, status: "ERROR", detail: String(err) };
  }
}
