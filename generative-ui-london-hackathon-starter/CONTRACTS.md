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

> Roles Builder B's extractor actually emits: `heading`, `paragraph`, `link`,
> `button`, `input` (incl. `inputType: select|textarea|checkbox|radio|…`),
> `image`, `nav`, `form` (with `children[]`), and `list-item` (one per `<li>` —
> there is no `list` container role). sourceRefs look like `pw-42`. This is
> aligned with `extension/src/contracts.js` (the shared coordination point).

## The bridge — how `sourceRef` survives the round-trip

**Canonical (aligned with Builder B's `contracts.js`):** every interactive
component the agent emits carries a **top-level `sourceRef` prop**
(`SOURCE_REF_PROP = "sourceRef"`). The side panel reads that prop off the
rendered component and builds a `ProxyMessage`; the proxy action is implied by
the component type (BigButton → `click`, BigLink → `navigate`, BigInput →
`input`, form → `submit`).

**Stock-Button fallback (used until the accessible renderers ship):** a stock
catalog `Button` has no `sourceRef` prop, only an `action`. There the agent
puts the sourceRef inside the existing event channel instead:

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
