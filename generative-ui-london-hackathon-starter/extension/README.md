# Perceptual Web — Chrome Extension (Builder B)

MV3 extension: content script DOM extraction + event proxying + side panel.

## Load the extension (all phases)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `extension/` folder

After any file change: click the **reload** icon on the extension card.

---

## Phase 1 — TEST B1 (skeleton)

1. Open the dummy test site (`http://localhost:<port>`)
2. Click the Extensions toolbar icon → **Open side panel**
3. The side panel opens at `side-panel/test-panel.html`
4. ✅ PASS: page title appears in the "Page (TEST B1)" section

---

## Phase 2 — TEST B2 (extraction)

1. Open the dummy test site
2. Open the side panel
3. Click **Extract Page**
4. ✅ PASS: `ExtractedPage` JSON appears in the output box — every interactive
   element has a unique `sourceRef` (`pw-N`), headings have `level`, links have `href`

---

## Phase 3 — TEST B3 (proxying)

1. Extract the page (B2) so you have real `sourceRef` values
2. Copy a `sourceRef` from the JSON (e.g. `pw-5`)
3. Paste it into the **sourceRef** field in the "Proxy events" section
4. Select action → **Send**
5. ✅ PASS: the real element on the page visibly reacts; ack appears in the log

Alternatively, from the side panel's DevTools console:
```js
_pw.sendProxy("pw-5", "click")
_pw.sendProxy("pw-12", "input", "hello world")
```

---

## Phase 4 — TEST B4 (CopilotKit runtime link — RISK GATE)

### Switch manifest to the React app

Once you've built the React side panel:

```bash
cd extension/side-panel
pnpm install
pnpm build   # outputs to extension/side-panel/dist/
```

Then edit `extension/manifest.json` — change `default_path`:
```json
"side_panel": {
  "default_path": "side-panel/dist/index.html"
}
```

Reload the extension.

### OR: dev mode (faster iteration)

```bash
cd extension/side-panel
pnpm dev    # starts Vite on http://localhost:5173
```

Edit manifest to point at `http://localhost:5173`:
```json
"side_panel": {
  "default_path": "http://localhost:5173"
}
```

**Note:** Chrome requires HTTPS or localhost for extension pages; `localhost:5173` works.

### Test

1. Start the full stack: `pnpm dev` in the hackathon-starter root
2. Load the extension with the React dist / Vite dev URL
3. Open side panel on the dummy test site
4. Open DevTools on the side panel → Network tab
5. Type anything in the chat input
6. ✅ PASS: a POST to `localhost:3000/api/copilotkit-pdf` appears and returns a streaming response

If this doesn't work: check the CORS headers (`next.config.ts` already adds them).
If still blocked after ~45 min: raise the web-app fallback flag to the team.

---

## Phase 5 — TEST B5 (full bridge)

1. Full stack running, extension loaded with React panel
2. Open dummy test site; open side panel
3. Panel auto-extracts on load (watch status line)
4. Type: `"too much going on, text too small"`
5. ✅ PASS: extraction fires → ExtractedPage reaches agent (visible in FastAPI logs at :8123) → A2UI envelopes stream back → Builder C's surface renders in the panel → click a generated button → the real page element fires

---

## File layout

```
extension/
  manifest.json               MV3 manifest
  background.js               Service worker — message relay hub
  content.js                  Content script — extraction + proxy trigger
  src/
    extractor.js              DOM walker → ExtractedPage (Contract 1)
    proxy.js                  ProxyMessage handler (Contract 2)
    contracts.js              Shared constants (sourceRef prop name etc.)
  side-panel/
    test-panel.html           Plain HTML test panel (Phases 1-3, no build)
    panel.js                  JS for test-panel.html
    index.html                Entry for the Vite React app
    package.json              Dependencies (CopilotKit 1.57.4, React 19)
    vite.config.ts            Vite config
    tsconfig.json
    src/
      main.tsx                React entry point
      App.tsx                 CopilotKit provider + PanelShell
      useBackgroundBridge.ts  Hook managing chrome.runtime port
      panel.css               Shell styles
    dist/                     Built output (gitignored, run `pnpm build`)
```

## Shared contracts (lock with Builders A + C)

| Constant | Value |
|---|---|
| DOM attribute | `data-pw-ref` |
| A2UI component prop | `sourceRef` |
| ProxyMessage type | `PROXY_EVENT` |
| Valid actions | `click`, `navigate`, `input`, `submit` |
