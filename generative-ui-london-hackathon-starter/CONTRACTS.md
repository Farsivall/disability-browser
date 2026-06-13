# Perceptual Web — Shared Contracts

Two messages hold the whole system together. Agree these before wiring
anything; don't change a field without updating **all three** copies:

- Python: [`agent/src/contracts.py`](agent/src/contracts.py) — what the agent consumes/produces
- TypeScript: [`src/perceptual/contracts.ts`](src/perceptual/contracts.ts) — what the extension + side panel use
- This doc — the human spec

---

## Contract 1 — `ExtractedPage`

Produced by DOM extraction (content script). Consumed by the agent.

```jsonc
{
  "url": "https://…",
  "pageType": "product",        // "article"|"product"|"form"|"feed"|"dashboard"|null
  "title": "…",
  "elements": [
    {
      "sourceRef": "el-42",     // STABLE unique id — the bridge key (required on interactive elements)
      "role": "button",         // heading|paragraph|link|button|input|image|list|nav|form|…
      "level": 1,                // headings only (1-6)
      "text": "Add to Cart",
      "href": "https://…",      // links only
      "inputType": "text",      // inputs only: text|checkbox|radio|select|email|…
      "options": ["S", "M"],    // selects/radios only
      "alt": "…",               // images only
      "children": []             // nested structure where relevant (form -> inputs)
    }
  ]
}
```

Rules:
- Every **interactive** element (`link`/`button`/`input`) MUST carry a unique
  `sourceRef`. Without it, proxying that element is impossible.
- Keep it **compact** — a clean semantic tree, never raw HTML. Token count
  drives agent latency.
- `pageType` may be `null`; the agent handles that.

---

## Contract 2 — `ProxyMessage`

Produced by the side panel when the user interacts with the **generated**
interface. Consumed by the content script, which re-fires the event on the
**real** page.

```jsonc
{
  "type": "PROXY_EVENT",
  "action": "click",            // click|navigate|input|submit
  "sourceRef": "el-42",         // matches an ExtractedElement.sourceRef
  "value": "hello"              // input actions only
}
```

---

## The bridge — how `sourceRef` survives the round-trip

The generated A2UI interactive components do **not** need a custom transport.
They reuse the catalog's existing event channel. Every interactive component
the agent emits carries:

```jsonc
"action": {
  "event": {
    "name": "proxy_event",           // PROXY_EVENT_NAME — constant in both contracts files
    "context": {
      "sourceRef": "el-42",
      "action": "click",             // click|navigate|input|submit
      "value": "…"                   // input only
    }
  }
}
```

Flow:

1. Agent generates a `BigButton` (or stock `Button`) with the `action` above.
2. User clicks it in the side panel → the renderer calls
   `dispatch(action)` → the surface's `onAction` fires.
3. The side panel sees `event.name === "proxy_event"`, calls
   `toProxyMessage(event.context)` → a `ProxyMessage`.
4. The `ProxyMessage` goes (via the background worker) to the content script,
   which finds the element by `sourceRef` and fires the real event.

Because the stock `Button` renderer already forwards `action.event.context`
through `dispatch`, this works **without modifying any existing renderer**.
New accessible components (BigButton, BigLink, BigInput…) just follow the same
shape.
