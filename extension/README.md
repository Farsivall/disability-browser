# Perceptual Web — Chrome Extension (Builder B)

Builder C owns the **side panel React app**. Builder B loads it into `chrome.sidePanel`.

## Dev preview (no extension)

```bash
cd disability-browser/generative-ui-london-hackathon-starter
npm run dev:ui
```

Open **http://localhost:3000/side-panel**

## Extension integration checklist

1. **Side panel HTML** — point at the built side panel URL:
   - Dev: `http://localhost:3000/side-panel`
   - Prod: bundle from Next export or dedicated Vite entry (TBD)

2. **manifest.json** — `side_panel.default_path` or `chrome.sidePanel.setOptions({ path })`

3. **Message passing** — side panel emits `ProxyMessage` via:
   ```ts
   chrome.runtime.sendMessage(message)
   ```
   Implemented in `src/lib/proxy-transport.ts`. Background worker forwards to content script.

4. **Extraction trigger** — on need submit, side panel sends `{ type: "REQUEST_EXTRACTION" }` via `chrome.runtime.sendMessage`. Response must be `ExtractedPage`. Dev fallback: mock ShopClutter page in `request-extraction.ts`.

5. **CopilotKit runtime** — `SidePanelProviders` uses:
   - `NEXT_PUBLIC_COPILOT_RUNTIME_URL` (default `/api/copilotkit-pdf`)
   - Agent channel: `perceptual_agent` (`PERCEPTUAL_AGENT_CHANNEL`)

6. **A2UI stream** — mirror renderer forwards ops to `surfaceBus` channel `perceptual_agent`; `SidePanelSurface` renders them.

## Key files (Builder C)

| File | Purpose |
|------|---------|
| `src/components/perceptual-web/SidePanelShell.tsx` | Full shell layout |
| `src/components/perceptual-web/SidePanelSurface.tsx` | A2UI render + proxy |
| `src/components/perceptual-web/SidePanelStatus.tsx` | Agent status (`statusBus`) |
| `src/components/perceptual-web/NeedInput.tsx` | Voice + text input (Step 4) |
| `src/hooks/use-speech-recognition.ts` | Web Speech API hook |
| `src/components/perceptual-web/use-submit-need.ts` | Need → agent submit flow |
| `src/lib/proxy-transport.ts` | ProxyMessage → extension |
| `src/a2ui/status-bus.ts` | Status line pub/sub |

## Dummy test site

http://localhost:8080/shop-clutter.html — run `npm start` in `GenUI/dummy-test-site`
