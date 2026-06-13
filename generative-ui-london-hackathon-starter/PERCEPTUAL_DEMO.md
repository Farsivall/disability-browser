# Perceptual Web — Run & Demo Runbook

A voice/text accessibility agent that **regenerates the page you're on** into an
interface tailored to how you struggle with the web. Built on the CopilotKit /
LangGraph / A2UI starter.

## Architecture (one line)
Side panel (Builder C UI) → CopilotKit runtime (`/api/copilotkit-pdf`) →
Python agent (`/perceptual`, Builder A) → streams A2UI back → C renders the
accessible surface → clicks proxy through Builder B's extension to the live page.

## Prerequisites (once)
- `uv` on PATH: `curl -LsSf https://astral.sh/uv/install.sh | sh` then `source $HOME/.local/bin/env`
- `pnpm install` (also builds the Python venv via `uv sync`)
- A **Gemini API key from AI Studio** (`AIza…`) in `.env` at the **template root**
  (`generative-ui-london-hackathon-starter/.env`):
  ```
  GEMINI_API_KEY=AIza...        # required (aistudio.google.com/apikey, personal account)
  LINKUP_API_KEY=...            # optional (web-search enrichment; auto-skips if absent)
  ```
  Note: the agent also reads a repo-root `.env`, but the Next.js app + `pnpm doctor`
  only read the template-root one — keep the key there.

## Run
```
pnpm dev      # boots Next.js (:3000) + the FastAPI agent (:8123) together
```
Sanity: `curl localhost:8123/` lists `perceptual_agent: /perceptual/`.

---

## Demo A — Web app (primary, no extension needed — the safety net)
Open **http://localhost:3000/side-panel**. It runs against a built-in mock of the
shop page. Three scripted commands (each yields a visibly different layout):

1. **Cognitive/visual:** *"Too much going on and the text is too small."*
   → decluttered single column, large readable text, semantic headings.
2. **Motor:** *"I also can't click small things."*
   → big ≥44px buttons, flattened nav.
3. **Visual/essentialist:** *"Just show me the product, high contrast."*
   → monochrome high-contrast, stripped to essentials.

Voice: click the mic 🎤 and speak the same commands.
**Tell real vs fallback by the status line:** "Layout updated/refined" = real agent;
"Using demo layout…" = the page didn't reach the agent (debug).

## Demo B — Extension (live page extraction + click-proxy, the "it generalizes" finale)
1. `pnpm dev` running.
2. Chrome → `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → `generative-ui-london-hackathon-starter/extension`.
4. Open a test page in a tab (e.g. `dummy-site/shop.html`).
5. Click the **Perceptual Web** toolbar icon → side panel opens (C's UI inside it).
6. Speak/type a need → extracts the **real** page → regenerates → click a generated
   button → the **real page reacts** (the proxy finale).

How it's wired: `extension/side-panel/host.html` (packaged page) iframes the
Next.js `/side-panel` and bridges `postMessage` ↔ the background `side-panel` Port
(`REQUEST_EXTRACTION`/`PROXY_EVENT` up, `EXTRACTED_PAGE`/`PROXY_ACK` down).

### If the extension panel misbehaves on first load
Right-click the panel → **Inspect** → check the console:
- iframe blocked → CSP (manifest `content_security_policy.extension_pages` already
  allows `frame-src http://localhost:3000`).
- no extraction → confirm `pnpm dev` is up and you're on an `http://localhost/*` tab
  (host permissions are localhost-only by default; widen `host_permissions` for real sites).

---

## Real-site track (I5)
- Widen `extension/manifest.json` `host_permissions` to the target sites.
- Hardening expected (not new features): dynamic/shadow DOM, synthetic React/Vue
  events (proxy already dispatches real MouseEvents + native input setters),
  CSP/X-Frame, latency. Linkup enrichment is timeout-wrapped so it never stalls.
- Record one clean run on the chosen real site as a backup.

## Integration status
- I0 route → `/perceptual`: **done, verified** (curl lists endpoint).
- I1 accessible components + theme: **done, live tests pass.**
- I2 web-app loop: **done, verified end-to-end over HTTP** (agent reads page from
  context, emits C's components + preserved sourceRefs + `/perceptualTheme`).
- I3 extension iframe bridge: **code complete; verify by loading unpacked** (Demo B).
- I4 three-command demo: scripted above.
- I5 real-site hardening: notes above.

## Fallback
If the extension cross-origin link fights on the day, **Demo A (web app) is a
complete demo** of the generative-UI value (everything except live click-proxy).
Lead on it; the extension is the credibility finale.
