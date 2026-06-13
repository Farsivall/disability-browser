/**
 * Event proxy — fires real DOM events on the live page in response to
 * ProxyMessage (Contract 2) sent from the side panel.
 *
 * Contract 2 shape:
 *   {
 *     type: "PROXY_EVENT",
 *     action: "click" | "navigate" | "input" | "submit",
 *     sourceRef: string,   // matches a data-pw-ref attribute stamped at extraction
 *     value?: string       // for "input" actions
 *   }
 *
 * Returns:
 *   { status: "OK" | "NOT_FOUND" | "ERROR", action, sourceRef, detail? }
 *
 * Framework-compat notes:
 *   - "click": dispatches a real MouseEvent (bubbles=true) rather than calling
 *     .click() — this triggers both native and React/Vue synthetic handlers.
 *   - "input": uses the native HTMLInputElement.prototype value setter so React's
 *     synthetic event system detects the change. Plain `el.value =` bypasses it.
 *   - "submit": prefers form.requestSubmit() (triggers HTML5 validation) and falls
 *     back to the form's submit button click.
 */

const DATA_ATTR = "data-pw-ref";

/**
 * Handle a ProxyMessage. Returns a result object.
 * @param {{ action: string, sourceRef: string, value?: string }} msg
 */
export function handleProxyEvent(msg) {
  const { action, sourceRef, value } = msg;
  const base = { action, sourceRef };

  const el = document.querySelector(`[${DATA_ATTR}="${sourceRef}"]`);
  if (!el) {
    return { ...base, status: "NOT_FOUND", detail: `No element with ${DATA_ATTR}="${sourceRef}"` };
  }

  try {
    switch (action) {
      case "click":
        return doClick(el, base);

      case "navigate":
        return doNavigate(el, base);

      case "input":
        return doInput(el, base, value ?? "");

      case "submit":
        return doSubmit(el, base);

      default:
        return { ...base, status: "ERROR", detail: `Unknown action: ${action}` };
    }
  } catch (err) {
    return { ...base, status: "ERROR", detail: String(err) };
  }
}

// ─── Action handlers ──────────────────────────────────────────────────────

function doClick(el, base) {
  el.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    }),
  );
  return { ...base, status: "OK" };
}

function doNavigate(el, base) {
  const href = el.href || el.getAttribute("href");
  if (href) {
    // Use click so the browser handles target="_blank", rel, etc. correctly.
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
    );
  } else {
    // Fallback: try clicking anyway (may be a button that triggers navigation).
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, view: window }));
  }
  return { ...base, status: "OK" };
}

function doInput(el, base, value) {
  if (el.tagName.toLowerCase() === "select") {
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { ...base, status: "OK" };
  }

  if (el.tagName.toLowerCase() === "input" || el.tagName.toLowerCase() === "textarea") {
    // Native setter trick: bypasses React's synthetic event system override.
    const proto =
      el.tagName.toLowerCase() === "textarea"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { ...base, status: "OK" };
  }

  // Fallback for anything else (contenteditable, etc.)
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return { ...base, status: "OK", detail: "fallback input dispatch" };
}

function doSubmit(el, base) {
  // Try to find the form this element belongs to.
  const form = el.tagName.toLowerCase() === "form" ? el : el.closest("form");

  if (form) {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      // Older Chrome / edge case: click the first submit button.
      const submitBtn = form.querySelector('[type="submit"], button:not([type])');
      if (submitBtn) {
        submitBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, view: window }));
      } else {
        form.submit();
      }
    }
    return { ...base, status: "OK" };
  }

  // No form found — treat as a click (covers submit buttons outside a form).
  return doClick(el, base);
}
