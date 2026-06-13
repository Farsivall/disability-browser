/**
 * DOM extractor — produces the ExtractedPage contract (Contract 1).
 *
 * Contract shape:
 *   {
 *     url: string,
 *     pageType: "article" | "product" | "form" | "feed" | "dashboard" | null,
 *     title: string,
 *     elements: ExtractedElement[]
 *   }
 *
 *   ExtractedElement = {
 *     sourceRef: string,     // "pw-<n>" stamped as data-pw-ref on the live DOM element
 *     role: string,
 *     level?: number,        // h1-h6
 *     text?: string,         // truncated to MAX_TEXT_LEN
 *     href?: string,
 *     inputType?: string,
 *     options?: string[],
 *     alt?: string,
 *     children?: ExtractedElement[]  // forms only
 *   }
 *
 * Design notes:
 *   - Stamps data-pw-ref on every element so proxy lookup is O(1).
 *   - Skips hidden/junk nodes to keep the payload compact.
 *   - Caps at MAX_ELEMENTS total so we don't flood the agent token budget.
 */

const MAX_TEXT_LEN  = 200;
const MAX_ELEMENTS  = 300;
const DATA_ATTR     = "data-pw-ref";
const REF_PREFIX    = "pw-";

let _counter = 0;

/**
 * Assign a stable sourceRef to a DOM element and return it.
 * Idempotent: if the element already has one we reuse it.
 */
function assignRef(el) {
  let ref = el.getAttribute(DATA_ATTR);
  if (!ref) {
    ref = `${REF_PREFIX}${++_counter}`;
    el.setAttribute(DATA_ATTR, ref);
  }
  return ref;
}

function truncate(str, len = MAX_TEXT_LEN) {
  if (!str) return undefined;
  const s = str.trim().replace(/\s+/g, " ");
  return s.length > len ? s.slice(0, len) + "…" : s || undefined;
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
  const tag = el.tagName?.toLowerCase() ?? "";
  return ["script", "style", "noscript", "template", "meta", "link", "head"].includes(tag);
}

/**
 * Walk the DOM and emit ExtractedElement objects.
 *
 * We do a single linear walk of the document and build a flat list.
 * The children[] property is only populated for <form> -> its inputs,
 * which is the one genuinely hierarchical case the contract calls for.
 */
export function extractPage() {
  _counter = 0; // reset counter on each extraction so refs are stable per-run

  const elements = [];
  let count = 0;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        if (isJunk(node) || isHidden(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let node;
  while ((node = walker.nextNode()) && count < MAX_ELEMENTS) {
    const el = /** @type {HTMLElement} */ (node);
    const tag = el.tagName.toLowerCase();

    let entry = null;

    if (/^h[1-6]$/.test(tag)) {
      entry = {
        sourceRef: assignRef(el),
        role: "heading",
        level: parseInt(tag[1], 10),
        text: truncate(el.textContent),
      };
    } else if (tag === "p") {
      const t = truncate(el.textContent);
      if (t) {
        entry = { sourceRef: assignRef(el), role: "paragraph", text: t };
      }
    } else if (tag === "a" && el.href) {
      entry = {
        sourceRef: assignRef(el),
        role: "link",
        text: truncate(el.textContent) || truncate(el.getAttribute("aria-label")),
        href: el.href,
      };
    } else if (tag === "button") {
      entry = {
        sourceRef: assignRef(el),
        role: "button",
        text: truncate(el.textContent) || truncate(el.getAttribute("aria-label")),
      };
    } else if (tag === "input") {
      const type = el.type || "text";
      if (type === "hidden" || type === "submit" || type === "reset") {
        // submit/reset buttons aren't interactive content we expose individually
      } else {
        const opts =
          type === "radio" || type === "checkbox"
            ? undefined
            : undefined;
        entry = {
          sourceRef: assignRef(el),
          role: "input",
          inputType: type,
          text: truncate(el.placeholder || el.getAttribute("aria-label") || el.name),
          ...(opts ? { options: opts } : {}),
        };
      }
    } else if (tag === "select") {
      const options = Array.from(el.options).map((o) => o.text).filter(Boolean);
      entry = {
        sourceRef: assignRef(el),
        role: "input",
        inputType: "select",
        text: truncate(el.getAttribute("aria-label") || el.name),
        options: options.slice(0, 20),
      };
    } else if (tag === "textarea") {
      entry = {
        sourceRef: assignRef(el),
        role: "input",
        inputType: "textarea",
        text: truncate(el.placeholder || el.getAttribute("aria-label") || el.name),
      };
    } else if (tag === "img") {
      const alt = el.alt?.trim();
      if (alt) {
        entry = { sourceRef: assignRef(el), role: "image", alt: truncate(alt) };
      }
    } else if (tag === "nav") {
      entry = {
        sourceRef: assignRef(el),
        role: "nav",
        text: truncate(el.getAttribute("aria-label")),
      };
    } else if (tag === "form") {
      entry = {
        sourceRef: assignRef(el),
        role: "form",
        text: truncate(el.getAttribute("aria-label") || el.id),
        children: extractFormInputs(el),
      };
    } else if (tag === "li") {
      const t = truncate(el.textContent);
      if (t) {
        entry = { sourceRef: assignRef(el), role: "list-item", text: t };
      }
    }

    if (entry) {
      elements.push(entry);
      count++;
    }
  }

  return {
    url: location.href,
    pageType: detectPageType(document, elements),
    title: document.title,
    elements,
  };
}

/**
 * Extract inputs inside a form for the children[] field.
 */
function extractFormInputs(form) {
  const inputs = [];
  for (const el of form.querySelectorAll("input, select, textarea, button")) {
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

/**
 * Best-effort page type from DOM signals.
 * Returns one of: "article" | "product" | "form" | "feed" | "dashboard" | null
 */
function detectPageType(doc, elements) {
  const body = doc.body.innerText.toLowerCase();
  const hasPrice = /\$[\d,]+|£[\d,]+|€[\d,]+/.test(body);
  const hasCart  = /add to cart|buy now|add to bag/i.test(body);
  const hasArticle = !!doc.querySelector("article, [role='article']");
  const wordCount  = body.split(/\s+/).length;
  const inputCount = elements.filter((e) => e.role === "input").length;

  if (hasPrice && hasCart) return "product";
  if (hasArticle || wordCount > 500) return "article";
  if (inputCount >= 5) return "form";
  return null;
}
