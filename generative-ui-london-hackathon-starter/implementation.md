IMPLEMENTATION PLAN — PERCEPTUAL WEB (working title)

A voice/text-driven accessibility agent that regenerates websites into interfaces tailored to how each user struggles with the web.

====================================================================

SHARED CONTEXT — EVERY BUILDER READS THIS FIRST

====================================================================

THE PRODUCT IN ONE PARAGRAPH

The user is on a cluttered, hard-to-use website. They open our side panel, and in their own words (voice or text) say what they find hard ("too much going on", "text too small", "I can't click small things"). An agent extracts the live page's content and structure, maps the user's words to one or more accessibility need-profiles, and generates a brand-new accessible interface for that page using A2UI components. The generated interface renders in the side panel. Interactions in the generated view (clicks, link navigations, form entries) are proxied back to the real page running in the tab. The user can refine by speaking/typing again, and the view regenerates live.

THE CORE FRAME (use this language in the demo)

This is a shift from RESPONSIVE design (adapt the layout to the screen) to PERCEPTUAL design (adapt the layout to the human's sensory and cognitive processing). Responsive design fits devices. We fit people.

WHAT THIS IS NOT

- Not an accessibility overlay (accessiBe/UserWay). Those toggle CSS from a fixed menu and can't restructure anything. We throw away the structure and generate a new one. Never claim "compliance".

- Not a browser automation agent. Agents do things FOR you. We let you do things YOURSELF in an interface shaped to how you work.

ARCHITECTURE (template-plus-extension hybrid)

Three running pieces:

1. PYTHON AGENT (from template, agent/ dir, FastAPI on :8123) — LangGraph loop that takes {extracted page + user need} and emits A2UI envelopes. This is reused almost as-is from the template, with our generation logic swapped into the agent flow.

2. NEXT.JS RUNTIME (from template) — hosts the CopilotKit runtime endpoint that brokers AG-UI between the browser and the Python agent. We keep this RUNNING but it is NOT our user-facing UI. It is the transport host.

3. CHROME EXTENSION (new) — Manifest V3 extension. Content script does DOM extraction + event proxying on the live page. Side panel is a React app that imports the template's A2UI catalog + renderer and points its CopilotKit provider at the running Next.js runtime over the network.

DATA FLOW

User speaks/types in side panel

  -> side panel sends {extracted page JSON + user need text} to the agent (via CopilotKit/AG-UI through the Next.js runtime)

  -> agent maps need text to need-profile(s), optionally enriches via Linkup, generates A2UI envelopes

  -> envelopes stream back through AG-UI to the side panel

  -> A2UI renderer paints the accessible interface progressively

  -> user clicks something in the generated view

  -> side panel posts a proxy message {action, sourceRef} to the content script

  -> content script finds the real element by sourceRef and fires the event on the live page

THE TWO SHARED CONTRACTS (agree these in hour 1, write them in a shared types file, do not change them without telling everyone)

CONTRACT 1 — ExtractedPage (Builder B produces, Builder A consumes)

{

  url: string,

  pageType: string | null,        // best guess: "article" | "product" | "form" | "feed" | "dashboard" | null

  title: string,

  elements: ExtractedElement[]

}

ExtractedElement = {

  sourceRef: string,              // STABLE unique id we assign during extraction (see Builder B). This is the bridge key.

  role: string,                   // "heading" | "paragraph" | "link" | "button" | "input" | "image" | "list" | "nav" | "form" | ...

  level?: number,                 // for headings (1-6)

  text?: string,                  // visible text content

  href?: string,                  // for links

  inputType?: string,             // for inputs: "text" | "checkbox" | "radio" | "select" | "email" | ...

  options?: string[],             // for selects/radios

  alt?: string,                   // for images

  children?: ExtractedElement[]   // nested structure where relevant (e.g. form -> inputs)

}

CONTRACT 2 — ProxyMessage (Builder C/side panel produces, Builder B/content script consumes)

{

  type: "PROXY_EVENT",

  action: "click" | "navigate" | "input" | "submit",

  sourceRef: string,              // matches an ExtractedElement.sourceRef

  value?: string                  // for input actions

}

NEED-PROFILES (the heart of generation — Builder A owns, everyone should understand)

The user's free-text need maps to one or more of these five profiles. Each profile carries concrete, deterministic directives. This is what makes generation reliable instead of the LLM improvising. These are grounded in real accessibility practice.

1. VISUAL / PERCEPTUAL (low vision, astigmatism, colour blindness)

   - Extract core text, render at >=18pt, keep nav proportionate and in view (do NOT just zoom).

   - High-contrast: rebuild in strict monochrome / high contrast (e.g. white text on black). Remove decorative images, gradients, shadows that interfere with text boundaries.

   - State highlighting: active/focused element gets a thick high-contrast outline (e.g. 4px solid yellow on black).

2. COGNITIVE / READING (dyslexia, ADHD)

   - Font swap to a readability font (offer as a CHOICE; lean on spacing — see caution below).

   - Line height 1.5x, increased letter and word spacing.

   - Aggressive de-clutter: remove sidebars, autoplay video, floating ads. Single centered column. Clear semantic h1/h2 to break up content.

3. MOTOR (tremor, limited dexterity, switch/eye-tracking users)

   - Every interactive element regenerated at >=44x44 CSS px with ample padding.

   - Flatten nested/hover navigation into a flat static list or grid of large buttons.

   - Pagination over infinite scroll: chunk content with large Next/Previous buttons.

4. NEUROLOGICAL / VESTIBULAR (motion sickness, seizures)

   - Static components only. Carousels unpacked into static grids. No animation.

   - Predictable anchoring: no layout jumps or animated popups. Confirmations are inline static text changes.

5. ESSENTIALIST (a useful synthetic profile for "just show me X")

   - Strip to the single task the user named plus the minimum controls to complete it.

CAUTION FOR THE PITCH: the evidence that specialised dyslexia fonts (OpenDyslexic) beat plain sans-serifs is mixed. Spacing, contrast, touch-target size, and de-cluttering are on much firmer ground. Offer the font as a user choice; lead claims with spacing/contrast/layout.

DEMO TARGET + TEST SURFACE

Do NOT develop against live external sites. They change without warning, may block the extension (X-Frame-Options / CSP), load slowly on venue wifi, use shadow DOM and synthetic React events that fight proxying, and give ambiguous test results (is missing content an extractor bug or just the site being weird?). Instead, develop all day against a DUMMY TEST SITE that we build and control (full spec below). It is stable, offline-capable, designed to exercise every need-profile, and gives unambiguous pass/fail because we know exactly what the DOM contains.

- PRIMARY test surface (all builders, all day): the local dummy site.

- REAL SITES: tested as an ONGOING PARALLEL TRACK (not a final gate — see REAL-SITE VALIDATION TRACK below). Real-site support comes essentially for free architecturally (extension runs on whatever's in the tab; web-app fallback fetches a pasted URL via Linkup), but real sites surface breakage — messy/dynamic DOM, synthetic React/Vue events that resist proxying, CSP, higher latency — that takes hours to harden. So we introduce real sites EARLY-MIDDLE and keep hitting them, rather than discovering the breakage with no time left. We still develop the core loop against the dummy site (stable, unambiguous); real sites are the hardening + credibility track running alongside.

- ON STAGE: lead on the dummy site (reliable, hits all profiles, dramatic before/after), then finish with ONE recognizable real site (Amazon product page / news article) as the "it generalizes" credibility moment. If the real site misbehaves on venue wifi, you've already shown full capability on the dummy and you just describe the architecture.

NOTE: this is the running app (separate session) the user has set up. Treat the dummy site as already available at its [localhost](http://localhost) URL; confirm the exact URL in hour 1 and put it in the shared file.

DUMMY TEST SITE SPEC (Builder C owns building it in hour 1; everyone tests against it)

Build 2-3 deliberately cluttered, deliberately INACCESSIBLE static HTML pages served on [localhost](http://localhost). Plain HTML/CSS/JS only — NO framework, NO shadow DOM — so extraction and proxying are clean and reliable. Each page must contain elements that deliberately trigger each need-profile, so all three demo commands have something visible to transform. Ugly is the point: a bad original makes the regenerated before/after dramatic.

PAGE 1 — "ShopClutter" (e-commerce product page). Must contain:

- A keyword-stuffed 3-line product title (small font) -> exercises VISUAL (large text) + COGNITIVE (declutter).

- A product image CAROUSEL that auto-rotates -> exercises VESTIBULAR (unpack to static grid).

- A price shown as struck-through original + deal price + a coupon checkbox that implies a third price -> exercises ESSENTIALIST (show the real price) + COGNITIVE.

- A size selector as a row of tiny 20px boxes, and a colour picker as tiny unlabeled coloured dots -> exercises MOTOR (big targets) + VISUAL (labels/contrast).

- An "Add to Cart" button styled identically to 3 other CTAs ("Buy Now", "Save", "Compare") -> exercises ESSENTIALIST + MOTOR.

- A junk SIDEBAR (related items, ads) and a fake NEWSLETTER POPUP div -> exercises COGNITIVE (declutter).

- Low-contrast grey-on-white body text -> exercises VISUAL (high contrast).

- A nested hover NAV menu -> exercises MOTOR (flatten nav).

Interactive elements that must really work for the proxy finale: the Add to Cart button (fires a visible inline confirmation), at least one real link in the nav (navigates), the size selector (selectable).

PAGE 2 — "NewsWall" (cluttered article). Must contain:

- A long article body in dense, unspaced paragraphs, justified text, small font -> exercises COGNITIVE (spacing, single column) + VISUAL (large text).

- Ads interleaved between paragraphs, a trending sidebar, floating social-share buttons, an autoplay video embed -> exercises COGNITIVE (declutter) + VESTIBULAR (kill autoplay).

- A comment FORM at the bottom with a tiny textarea and a small submit button -> exercises MOTOR (big input + button) and gives the proxy finale a real form submit.

- A cookie banner and a sticky nav bar -> exercises COGNITIVE.

PAGE 3 (optional, build only if time) — "FormMaze" (a government-style form). Must contain:

- A multi-column layout, 16px checkboxes, radio buttons, a 30+ option dropdown, a 3-dropdown date picker, small red-asterisk required markers, inline small-text validation -> exercises MOTOR heavily + COGNITIVE + VISUAL. Strong for showing form regeneration.

EACH interactive element across all pages MUST be reliably clickable/fillable via plain DOM events (so Builder B's proxy works without fighting a framework). Give each a clear id or data attribute so sourceRef assignment is trivial.

DEMO TARGET (the scripted run uses Page 1 "ShopClutter" or Page 2 "NewsWall" — pick the more visually dramatic one in rehearsal).

REAL-SITE VALIDATION TRACK (runs in parallel, owned jointly by Builders A + B, starts mid-build not at the end)

WHY EARLY: the breakage real sites cause (messy/dynamic/shadow DOM, synthetic framework events that won't proxy, CSP, latency) is slow to fix. Discovering it at the end kills the demo. So we stagger:

- HOUR 1: pick the 2-3 real sites NOW. One e-commerce product page (e.g. an Amazon product page), one article (a news site), optionally one form. Write the exact URLs in the shared file. Picking early means you can test them all day.

- AS SOON AS the dummy-site happy path works for ONE command (this is CHECKPOINT 2, ~2/3 — NOT the end): run that same command against ONE real site. This is the first real-site test and it intentionally happens with time still left to fix what breaks.

- Expect and treat as HARDENING (not new features):

  * Builder B — extraction: handle deeply nested/non-semantic DOM, wait for dynamic content to load before extracting (e.g. small delay or mutation-observer settle), skip shadow-DOM/canvas content gracefully, keep the ExtractedPage compact despite page bloat.

  * Builder B — proxying: plain .click() often fails on React/Vue; dispatch real MouseEvents, set input values via the native setter + dispatch input/change, and test the SPECIFIC real demo site's elements until they fire. Only needs to be bulletproof on the site you'll actually show.

  * Builder A — generation: confirm valid A2UI + preserved sourceRefs + applied directives on a REAL, heavier ExtractedPage; check latency stays acceptable; wrap Linkup in a timeout so a slow real-site enrichment never stalls generation.

- THROUGHOUT THE BACK HALF: re-run the real demo site at least every ~couple hours. If it works at 2pm, 4pm, and 6pm, it'll likely work on stage.

- BACKUP: screen-record a clean successful run on the real demo site once it's working. If venue wifi chokes or the site ships a layout change on the day, the recording saves the credibility beat.

GOAL of this track: not "works on every site on the internet" — just "works on the 2-3 specific real sites we'll show, hardened with time to spare."

THE DEMO (what we're building toward)

Original page in the tab, our side panel open beside it. Three commands, three visibly different layouts, each backed by a nameable rationale:

- Command 1 (cognitive): "Too much going on, text's too small." -> de-cluttered single column, large text, semantic headings. Streams in over 1-3s.

- Command 2 (motor): "I also can't click small things." -> every control becomes a big padded target, nav flattened to big buttons.

- Command 3 (visual/essentialist): "Just show me the article and high contrast." -> monochrome high-contrast, stripped to essentials, thick focus outlines.

- Finale: click a real link/button in the generated view -> it fires on the live page. Functional, not decorative.

THE FALLBACK (cheap insurance — everyone knows this)

The riskiest single thing is connecting the extension side panel's CopilotKit provider to the Next.js runtime cross-origin. If that connection eats too much time, we COLLAPSE TO A WEB APP: drop the extension shell, run the template as a normal web page, user pastes a URL, Linkup fetches the page content instead of the content script. Everything else (need-profiles, generation, A2UI rendering, voice/text input) is IDENTICAL. We lose only live click-proxying. Builders A and C's work is unaffected by this collapse; only Builder B's shell is. Build so this pivot is always one step away.

TEAM

- Builder A (CS student, strongest): Agent + generation pipeline. The brain.

- Builder B (EEE student, extension experience): Extension shell + DOM extraction + event proxying + runtime connection. The bridge.

- Builder C (frontend dev): A2UI accessible component catalog + side panel UI + voice/text input. The face.

Work is skewed to A and B as requested. C has a well-scoped, parallelizable lane that doesn't block on the hardest pieces.

PHASING / CHECKPOINTS (assume a single intense build day)

- Hour 1: All three together. Get the template running (pnpm install, pnpm dev, GEMINI_API_KEY set). Pick the demo page. Write the two shared contracts in a shared file. Agree the need-profiles list.

- Checkpoint 1 (~1/3 of the day): Each builder's piece works in isolation against mocks. B can extract a page to ExtractedPage JSON. A can turn a hardcoded ExtractedPage + need into valid A2UI. C can render a hardcoded A2UI envelope into accessible components in the side panel.

- Checkpoint 2 (~2/3): End-to-end happy path on the DUMMY site for ONE command (extraction -> generation -> render works live). THEN immediately run that same command against ONE real site (first real-site test — deliberately here, with time left to fix breakage). Builders A + B begin the hardening list from the REAL-SITE VALIDATION TRACK.

- Checkpoint 3 (final third): All three commands work on the dummy site, refinement loop works, one real proxied interaction works, Linkup enrichment visible. The chosen REAL demo site is hardened and re-tested. Demo rehearsed twice. Clean run screen-recorded as backup. Lock it.

NAMING NOTE: product still needs a name. Placeholder "Perceptual Web". Decide together when convenient; it's a 2-minute job, don't let it block building.

====================================================================

BUILDER A — AGENT + GENERATION PIPELINE (the brain)

====================================================================

YOUR MISSION

Own the Python agent that turns {ExtractedPage + user need text} into streamed A2UI envelopes, driven by the need-profiles. You are the reason the generated interface is good. Reuse the template's agent loop and A2UI transport; replace the generation logic with ours.

STEP 0 — GROUND YOURSELF IN THE TEMPLATE (do this before writing anything)

Open and read these template files to learn the real shapes (names may differ slightly — trust the code over this doc):

- agent/[main.py](http://main.py) — the FastAPI app, the endpoints (the README mentions /fixed, /dynamic, /legal). The /dynamic flow is closest to ours (it invents a component tree on demand). We will model our agent on /dynamic.

- agent/src/dynamic_[agent.py](http://agent.py) — the dynamic-schema agent. This is your primary reference and likely your primary edit target (template calls this "Seam 5 — swap the agent flow").

- agent/src/[catalog.py](http://catalog.py) — the prompt-side summary of the A2UI component catalog, so the agent knows which components exist. You will EXTEND this when Builder C adds accessibility components.

- Anything named prompt_builder / prompt — to see how the A2UI envelope examples are fed to the LLM. The A2UI envelopes are three messages: surfaceUpdate (components), dataModelUpdate (state), beginRendering (render signal), emitted as JSONL. Confirm exact operation names from the code (the README also calls them createSurface/updateComponents/updateDataModel — same three operations).

- .env.example and [FROZEN.md](http://FROZEN.md) — for the LLM provider (default Gemini 3.5 Flash via langchain-google-genai; the native SDK is required for thought-signature replay across tool turns — do not naively swap providers).

STEP 1 — DEFINE THE NEED-PROFILES AS STRUCTURED DATA

Create a module (e.g. agent/src/need_[profiles.py](http://profiles.py)) that encodes the five profiles from SHARED CONTEXT as structured directive sets. Each profile = an id, a short description, and a list of concrete generation directives (text/contrast/spacing/touch-target/animation rules). These directives get injected into the generation prompt. Keep them as data, not prose buried in a prompt, so they're testable and tweakable.

STEP 2 — BUILD THE NEED-MAPPING STEP

First LLM call (or a cheap classification step): input is the user's free-text need ("too much going on, text too small"). Output is a structured selection of one or more profile ids, plus any specifics ("just the article" -> ESSENTIALIST with focus="article content"). Keep this output strict and parseable (ask for JSON only, no prose). This is cheap and fast; it gates everything downstream.

STEP 3 — BUILD THE GENERATION STEP

Second LLM call: input is {ExtractedPage + selected profiles' directives + any essentialist focus}. Output is A2UI envelopes that the template's transport already knows how to stream. The prompt must instruct the model to:

- Walk the ExtractedPage elements and map each to an appropriate A2UI component from the catalog.

- Apply the directives from the selected profiles (sizing, contrast, spacing, layout, de-clutter, flatten nav, static-only, etc).

- CRITICAL FOR PROXYING: every interactive component it emits MUST carry the source element's sourceRef as a property (e.g. a data attribute or component prop the renderer will preserve). Builder C's components read this; Builder B's content script uses it. If sourceRef is dropped, proxying breaks. Make this non-negotiable in the prompt and verify it in tests.

- Stream progressively (headings first, then content, then interactive) so the side panel paints as it goes.

STEP 4 — ADD LINKUP ENRICHMENT

Template tells you exactly how (README "Linkup for agents": langchain-linkup LinkupSearchTool, or hosted MCP server, or agent skills). Pick the LangChain tool path for simplicity. Use it as an ENRICHMENT step between mapping and generation:

- When pageType + selected profile are known, query Linkup for the specific best practice for that intersection (e.g. "accessible product page layout for low vision", "form design for motor impairment").

- Feed the retrieved guidance into the generation prompt as supplementary context. The need-profiles are your reliable floor; Linkup raises the ceiling for cases the static directives miss.

- For the demo, run enrichment EVERY time on the demo page so it's reliably visible. Emit a status line over AG-UI ("Researching best practices for product pages...") so judges SEE the agent reasoning. Mention uncertainty-gated enrichment as the production optimization.

STEP 5 — CONFIDENCE / UNCERTAIN ELEMENTS (stretch, do only if time)

When the model can't confidently map an element (exotic widget, ambiguous control), have it emit a clearly-flagged "uncertain" component (a callout: "This control couldn't be safely simplified — open original") rather than silently dropping it. This is an honesty feature judges respect. Skip if time-pressed.

VISUAL TESTS FOR BUILDER A (run these, in order — each must pass before moving on)

TEST A1 (mapping, no UI needed): Feed the need-mapper the string "everything is tiny and there's way too much on the screen". PASS = it returns JSON selecting VISUAL/PERCEPTUAL + COGNITIVE/READING (and nothing absurd). Try 5 different phrasings; PASS = sensible profiles every time, valid JSON every time.

TEST A2 (generation validity): Feed the generator a hardcoded sample ExtractedPage (hand-write one with a heading, 2 paragraphs, a link, a button, an input) + COGNITIVE profile. PASS = output is valid A2UI envelopes that the template's own validator accepts (template ships pnpm validate-widget / test:widgets — use them). No malformed JSON.

TEST A3 (sourceRef preservation): In the A2 output, grep for the sourceRefs you put in the input. PASS = every interactive element's sourceRef appears on the corresponding generated component. This is the single most important test for proxying — if it fails, the demo finale fails.

TEST A4 (profile differentiation): Run the SAME sample ExtractedPage through COGNITIVE, then MOTOR, then VISUAL. PASS = three visibly different envelopes (motor has big targets/flattened nav; visual has high-contrast/large-text directives applied; cognitive has single-column/de-clutter). If all three look the same, the directives aren't reaching the output — fix the prompt.

TEST A5 (Linkup visible): Trigger a generation on the demo page's pageType. PASS = a Linkup query actually fires (check logs/network) and a status line is emitted over AG-UI. Generation still completes if Linkup is slow/down (wrap in a timeout + fallback to profiles-only).

TEST A6 (end-to-end with real extraction): Once Builder B has real extraction, feed a REAL ExtractedPage from the demo page. PASS = valid A2UI, sourceRefs preserved, profile directives applied, completes in a few seconds with streaming.

HANDOFF NOTES

- Give Builder C a few sample A2UI envelopes (from your A2/A4 tests) EARLY so they can build/test renderers without waiting for the live agent.

- Coordinate with Builder C on the EXACT property name the sourceRef travels under, and on any NEW accessibility component types you expect to emit (so they exist in both the catalog and the renderer).

====================================================================

BUILDER B — EXTENSION SHELL + EXTRACTION + PROXYING + RUNTIME LINK (the bridge)

====================================================================

YOUR MISSION

Own the Chrome extension. You've shipped extensions before; you're the right person for the plumbing that would sink someone else. Three jobs: (1) the MV3 shell with content script + background + side panel and clean message passing, (2) DOM extraction into ExtractedPage, (3) event proxying from the generated view back to the live page. You also own the riskiest integration: connecting the side panel's CopilotKit provider to the running Next.js runtime cross-origin. Keep the web-app fallback in mind — if the runtime link blocks, the team collapses to web app and your extraction logic still ports (it becomes Linkup-based fetching).

STEP 0 — DECIDE THE SIDE PANEL HOSTING APPROACH EARLY

The hardest unknown is making CopilotKit (built for same-origin Next.js) work inside an extension side panel pointed at a remote runtime. Investigate in hour 1, not hour 6. Two viable shapes:

(a) Side panel loads your React app (built from the template's frontend pieces) and the CopilotKit provider is configured to talk to the Next.js runtime URL (e.g. [http://localhost:3000/api/copilotkit](http://localhost:3000/api/copilotkit) or whatever the template exposes) over the network. You'll deal with CORS on the runtime side and the provider's runtimeUrl config.

(b) If (a) fights too hard, the side panel can load the Next.js app's relevant route in an iframe and you bridge via postMessage. Uglier, but a known escape hatch.

Spike approach (a) first. Timebox it. If it's not connecting within your budget, raise the fallback flag to the team immediately — that's the trigger to collapse to web app, and it's cheap insurance, not failure.

STEP 1 — MV3 SKELETON WITH MESSAGE PASSING

Stand up: manifest.json (MV3), a content script injected on the demo page's origin, a background service worker, and the side panel (chrome.sidePanel API). Prove the skeleton end to end BEFORE anything real depends on it: content script extracts something trivial (page title), sends it through the background worker to the side panel, side panel displays it. This validates the hardest plumbing first.

STEP 2 — DOM EXTRACTION INTO ExtractedPage

Write the extractor (runs in the content script). Walk the live DOM and produce the ExtractedPage contract:

- Capture headings (with level), paragraphs, links (with href), buttons, inputs (with inputType, options), images (with alt), nav, forms, lists.

- Assign each element a STABLE sourceRef. Options: a generated unique attribute you set on the element at extraction time (e.g. data-pw-ref="el-42") is the most robust because you control it and can find it again instantly later. XPath is the fallback. Whatever you choose, the SAME scheme must let you re-find the element during proxying.

- Best-effort pageType guess (article/product/form/feed/dashboard) from signals (presence of price + add-to-cart -> product; long article body -> article; many inputs -> form). Null if unsure — Builder A handles null.

- Keep it COMPACT. Do not dump raw HTML. Send a clean semantic tree. Token count matters for Builder A's latency.

- Skip obviously-junk nodes (hidden elements, script/style, tracking pixels).

STEP 3 — EVENT PROXYING

Listen in the content script for ProxyMessage (Contract 2) coming from the side panel (via background worker). On receive:

- Find the real element by sourceRef (instant if you used a data attribute).

- action "click" -> [element.click](http://element.click)(). action "navigate" -> set location / click the link. action "input" -> set element.value and dispatch input + change events. action "submit" -> submit the form (or click its submit button).

- For framework sites (React/Vue), a naive .click() may not trigger synthetic handlers. For the DEMO PAGE specifically, test the real elements and use whatever reliably fires (dispatch a real MouseEvent if needed). You only need it bulletproof on the demo page.

- Send a small ack back so the side panel can show a static inline confirmation (respects the vestibular "no surprise popups" directive).

STEP 4 — WIRE EXTRACTION TO THE AGENT

When the user submits a need in the side panel, the flow is: content script extraction -> side panel -> agent (through the CopilotKit/AG-UI runtime link from Step 0). Make sure the ExtractedPage actually reaches Builder A's agent as input alongside the need text. Coordinate the exact transport with Builder C (who owns the side panel app) and Builder A (who owns what the agent expects).

VISUAL TESTS FOR BUILDER B (run in order)

TEST B1 (skeleton): Load the unpacked extension, open the side panel on the demo page. PASS = the page title appears in the side panel, proving content-script -> background -> side-panel messaging works.

TEST B2 (extraction shape): Run extraction on the demo page, log the ExtractedPage JSON. PASS = it's valid against Contract 1, every interactive element has a unique sourceRef, headings have levels, links have hrefs, the structure is recognizable as the page. Eyeball it: could a human rebuild the page from this? If key content is missing, fix the walker.

TEST B3 (sourceRef round-trip): Pick 3 sourceRefs from the B2 output. Manually send a ProxyMessage with each from the console/side panel. PASS = the corresponding real element on the live page reacts (link navigates, button clicks, input fills). This proves the bridge works before the generated UI exists.

TEST B4 (runtime link): With the Next.js runtime running, confirm the side panel's CopilotKit provider connects and can round-trip a trivial message to the Python agent. PASS = a request from the side panel reaches the agent and a response comes back. THIS IS THE RISK GATE — if it's not passing by your timebox, call the fallback.

TEST B5 (full bridge on demo page): User submits a need -> extraction runs -> ExtractedPage reaches the agent -> (Builder A generates) -> envelopes return -> (Builder C renders) -> user clicks a generated button -> real page reacts. PASS = the loop closes on the demo page. This is the money test.

HANDOFF NOTES

- Give Builder A a REAL ExtractedPage JSON dump from the demo page as early as possible so A stops testing on hand-written mocks.

- Agree with Builder C on how ProxyMessage travels from side panel React -> content script (through background worker) and how acks come back.

====================================================================

BUILDER C — A2UI ACCESSIBLE CATALOG + SIDE PANEL UI + VOICE/TEXT INPUT (the face)

====================================================================

YOUR MISSION

Own everything the user sees and the components the generated interface is made of, AND the dummy test site everyone develops against. The ACCESSIBILITY QUALITY LITERALLY LIVES IN YOUR COMPONENTS — the agent picks components and applies directives, but if the components themselves aren't accessible, none of it works. Build the dummy test site (hour 1), the input UI (voice OR text, user's choice), the side panel shell, and an accessible A2UI component catalog. You can work largely in parallel against Builder A's sample envelopes, so you're not blocked on the hardest pieces.

STEP 0a — BUILD (OR CONFIRM) THE DUMMY TEST SITE FIRST (hour 1)

The user is running the dummy site in a separate session — confirm its [localhost](http://localhost) URL and put it in the shared file immediately so Builders A and B have a stable test target from the very start. If anything in the DUMMY TEST SITE SPEC (see SHARED CONTEXT) is missing, fill it in. This is your highest-leverage hour-1 task: it unblocks the other two builders AND it teaches you exactly which element types your components must handle, because you're building the things that produce them. Hand Builder B the page(s) so they can start extraction immediately. Do this BEFORE the template reading below.

STEP 0b — GROUND YOURSELF IN THE TEMPLATE'S RENDERER + CATALOG

Read:

- src/a2ui/catalog/definitions.ts and renderers.tsx — the template's 21-component catalog and how each component is defined + rendered (template "Seam 4 — add an A2UI component"). This is your primary edit target.

- The A2UI renderer usage (@copilotkit/a2ui-renderer) and how the template paints a surface into its "canvas" — you'll reuse this renderer in the side panel.

- src/a2ui/theme.css and use-theme.tsx (template "Seam 1 — re-theme") — CSS variables you'll drive for high-contrast / large-text modes.

- /catalog route — renders every component statically with no agent call. This is your best friend for testing components without the live agent.

STEP 1 — BUILD THE ACCESSIBLE COMPONENT CATALOG

Extend the template's catalog with components engineered to the need-profile directives. Each needs a definition (so the agent knows it exists — mirror into agent/src/[catalog.py](http://catalog.py) WITH Builder A) and a renderer. Build at least:

- AccessibleHeading (semantic h1-h6, large, high contrast capable)

- ReadableText (>=18pt option, 1.5 line height, increased letter/word spacing, readability-font option)

- BigButton (>=44x44px, ample padding, thick high-contrast focus outline, carries sourceRef)

- BigLink (same target sizing, carries sourceRef, navigates via proxy)

- BigInput / BigSelect / BigToggle (large hit areas, label always visible above field, carries sourceRef)

- FlatNav (renders a flattened list/grid of big buttons from nested nav)

- StaticImageGrid (unpacks carousels into a static grid — no animation)

- PaginatedList (chunks content with big Next/Prev buttons)

- Callout (for confirmations and for "uncertain element" flags — static, inline, no popup)

CRITICAL: every interactive component must accept and preserve a sourceRef prop and, on interaction, emit a ProxyMessage (Contract 2) up to the content script. Agree the exact prop name with Builder A.

STEP 2 — DRIVE ACCESSIBILITY VIA THEME TOKENS

Implement the visual/perceptual directives as theme states you can switch: a high-contrast monochrome mode (white-on-black), a large-text scale, a focus-outline style (4px solid high-contrast). The agent's generated envelope says WHICH mode; your theme layer applies it. This keeps the heavy visual transforms out of the per-component logic.

STEP 3 — SIDE PANEL SHELL

Build the side panel app (the React app Builder B loads into chrome.sidePanel). It contains: the input UI (Step 4), a status area (shows the agent's AG-UI status lines — "Researching best practices...", "Generating layout..."), and the A2UI render surface where the generated interface paints. Reuse the template's surface renderer. Make the render surface itself accessible (it IS the accessible interface).

STEP 4 — VOICE OR TEXT INPUT (user chooses)

- Text: a simple large input box, submit on enter. Always available.

- Voice: Web Speech API (SpeechRecognition) — a big mic button, transcribes to the same input field, user confirms or it auto-submits. Provide a clear visible toggle between voice and text; never voice-only. Show the transcript so the user sees what was heard.

- On submit (either mode): hand the need text to the flow that combines it with the ExtractedPage and sends to the agent (coordinate transport with Builders A and B).

STEP 5 — REFINEMENT LOOP

After a view is generated, the input stays available. A new need ("make the buttons even bigger", "hide images") triggers a regeneration that updates the surface. Show a subtle non-animated transition (respect vestibular directive — no jarring motion). Persist the accumulated need-profile across refinements within the session so each command builds on the last.

VISUAL TESTS FOR BUILDER C (run in order)

TEST C1 (catalog renders): Open the /catalog route (or your side panel in a static test mode). PASS = every accessible component renders. BigButton is visibly >=44px with a clear focus outline when tabbed to. ReadableText is visibly >=18pt with generous spacing. No console errors.

TEST C2 (renders a real envelope): Take a sample A2UI envelope from Builder A (the A2/A4 test outputs). Feed it to your render surface. PASS = it paints into a recognizable accessible interface. Headings, text, and a big button appear correctly.

TEST C3 (theme switching): Toggle high-contrast mode and large-text mode on a rendered surface. PASS = the SAME content visibly transforms to white-on-black / larger text without breaking layout or losing content.

TEST C4 (sourceRef emission): Click a BigButton/BigLink in a rendered surface. PASS = it emits a correct ProxyMessage (Contract 2) with the right sourceRef and action (check console / the message Builder B receives). Without this, the demo finale fails.

TEST C5 (voice + text): Type a need and submit -> reaches the send flow. Then use the mic, speak the same need -> transcript appears, submits the same way. PASS = both input modes produce an identical downstream submission; toggle between them works; transcript is visible.

TEST C6 (refinement): After a surface is generated, submit a second need. PASS = the surface updates to reflect the combined needs, with no jarring animation, content preserved.

TEST C7 (the three-command demo, with A and B): Run the full scripted demo. PASS = three commands produce three visibly different, usable layouts, each correct to its profile, and a real interaction fires at the end.

HANDOFF NOTES

- Get sample envelopes from Builder A in hour 1-2 so you build renderers against real shapes.

- Lock the sourceRef prop name with Builder A and the ProxyMessage transport with Builder B early.

====================================================================

INTEGRATION CHECKPOINTS (all three, do not skip)

====================================================================

INTEGRATION 1 (after each builder passes their isolation tests):

B feeds a real ExtractedPage to A. A generates real envelopes. C renders them. Confirms the three contracts line up in practice (ExtractedPage shape, sourceRef name, ProxyMessage shape).

INTEGRATION 2 (one full command end to end):

On the demo page: user types "too much going on, text too small" -> extraction -> agent (with Linkup) -> envelopes -> rendered accessible view. Streaming visible. Sub-few-seconds.

INTEGRATION 3 (the whole demo):

Three commands, three layouts, refinement loop, one real proxied interaction, Linkup status visible. Rehearse the on-stage script TWICE. Confirm the chosen REAL demo site still works (it's been hardened since Checkpoint 2) and screen-record one clean run on it as backup. Have the OFFLINE/web-app fallback ready in case the venue network or the runtime link misbehaves on stage. Demo structure: dummy site for the three reliable transformations, then the real site for the "it generalizes" credibility beat — and if the live real-site run fails, fall back to the recording and describe the architecture.

JUDGING ALIGNMENT (say these things in the pitch)

- Use of generative UI: LOAD-BEARING. The right interface depends on the person x the page — a combinatorial space that can't be predesigned. The five need-profiles + live page = generation is the product.

- Originality: every existing accessibility adaptation tool is RULE-BASED (overlays, Easy Reading, GPII/Morphic, reader mode). Generative-UI research (Bespoke, Jelly) builds NEW interfaces for new tasks, not regenerations of existing pages, and isn't accessibility-focused. We're first at the intersection: generative UI for user-side accessibility adaptation of existing web pages. "Responsive design fits devices; we fit people."

- Economic value: multi-trillion-dollar disability market, EU Accessibility Act in force, most of the web inaccessible, plus aging users and situational impairments.

- Technical difficulty: live DOM extraction, real-time streamed A2UI generation, cross-context event proxying, voice loop, profile-driven deterministic generation.

THE LANDMINE (never forget)

Do NOT frame this as an overlay. Lead the pitch with the inversion: user-controlled, needs-driven, cooperative with assistive tech, never claims compliance. accessiBe got fined $1M by the FTC; judges who know the space will pattern-match negatively if you sound like an overlay.