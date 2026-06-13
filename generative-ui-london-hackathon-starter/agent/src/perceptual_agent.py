"""Perceptual Web — the accessibility regeneration agent (Builder A, the brain).

Takes {ExtractedPage + a user's free-text accessibility need} and emits streamed
A2UI envelopes that rebuild the page into an interface shaped to that need.

Modeled 1:1 on the template's dynamic_agent.py:
  * a server-side `render_a2ui` tool with SCALAR STRING params
    (`components_json`, `data_json`) so Gemini's tool-arg parser can't strip the
    component props (typed object/array params get undeclared keys stripped — see
    dynamic_agent.py's "Gemini prop-stripping fix").
  * the secondary LLM is FORCED (`tool_choice="render_a2ui"`) to return a
    structured component tree, which we wrap into A2UI ops with `a2ui.render`.
  * lazy Gemini client so `import main` works with no key / OFFLINE=1.

The pipeline (three steps), exposed as pure importable functions so the A1–A6
tests don't need the full graph:
  1. map_need(need_text)            -> {profiles, focus, rationale}   (STEP 2)
  2. enrich(page_type, profiles)    -> guidance text | None           (STEP 4)
  3. generate_surface(page, …)      -> {components, data, ops, …}     (STEP 3)

The model line is FROZEN (gemini-3.5-flash via langchain-google-genai) — see
FROZEN.md. Do not change it.
"""
from __future__ import annotations

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from copilotkit import CopilotKitMiddleware, a2ui
from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool as lc_tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import MemorySaver

from src.catalog import (
    ACCESSIBLE_COMPONENTS_PROMPT,
    CATALOG_ID,
    CATALOG_PROMPT,
)
from src.contracts import PROXY_EVENT_NAME, SOURCE_REF_PROP
from src.need_profiles import (
    PROFILES,
    directives_for,
    mapper_profile_menu,
    normalize_ids,
)

SURFACE = "perceptual-surface"

# When set, the generator emits Builder C's accessibility components (BigButton,
# BigInput, …) which carry a top-level `sourceRef` prop. Default OFF until those
# renderers ship — until then we emit the STOCK catalog components (which render
# today and pass the template validator), carrying sourceRef via the event
# channel. Flip to "1" once Builder C confirms the accessible renderers exist.
PERCEPTUAL_USE_A11Y = os.getenv("PERCEPTUAL_USE_A11Y") == "1"

# Bound the page payload so a bloated real page can't blow the token budget /
# latency. Builder B already caps extraction (~300 elements), this is a backstop.
_MAX_PAGE_CHARS = 18000


def _content_text(content: Any) -> str:
    """Extract plain text from a LangChain message `.content`.

    Gemini 3.x returns content as a LIST of blocks
    (e.g. [{"type":"text","text":"…","extras":{"signature":…}}]) carrying the
    thought-signature, NOT a bare string. Naively str()-ing that list yields
    Python-repr (single quotes) and breaks json.loads. Join the text blocks
    instead.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and isinstance(block.get("text"), str):
                parts.append(block["text"])
        return "".join(parts)
    return str(content)


def _strip_to_json(text: str) -> str:
    """Strip ```json fences an LLM may wrap JSON in (mirrors pdf_tools.py)."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


# ── Models (lazy — no Gemini client built at import time) ─────────────────────

_MODEL: ChatGoogleGenerativeAI | None = None


def _model() -> ChatGoogleGenerativeAI:
    global _MODEL
    if _MODEL is None:
        _MODEL = ChatGoogleGenerativeAI(
            model=os.getenv("MODEL", "gemini-3.5-flash"),
            google_api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0,
        )
    return _MODEL


class _LazyModel:
    """Defers ChatGoogleGenerativeAI construction until the agent's model node
    first touches it — so building the graph at import never needs a key.
    Mirrors dynamic_agent.py's _LazyRenderModel.
    """

    @property
    def profile(self) -> Any:
        return _model().profile

    def bind_tools(self, *args: Any, **kwargs: Any) -> Any:
        return _model().bind_tools(*args, **kwargs)

    def bind(self, *args: Any, **kwargs: Any) -> Any:
        return _model().bind(*args, **kwargs)

    def __getattr__(self, name: str) -> Any:
        return getattr(_model(), name)


# ── The render tool (scalar string params survive Gemini's arg parser) ────────

@lc_tool
def render_a2ui(
    surfaceId: str,
    catalogId: str,
    components_json: str,
    data_json: str = "{}",
) -> str:
    """Render a dynamic A2UI v0.9 surface.

    Args:
        surfaceId: Unique surface identifier (kebab-case).
        catalogId: The catalog ID. Use the one provided in context.
        components_json: The FULL A2UI v0.9 flat component array, serialized as a
            JSON array string. Each node is an object with its real catalog props
            inline (id, component, plus text/children/label/sourceRef/action/etc.
            for that component type). Exactly one node MUST have id="root".
        data_json: Optional initial data model, serialized as a JSON object
            string. Use "{}" (the default) when all data is inlined.
    """
    return "rendered"


# ── Status emission (visible "the agent is thinking" lines over AG-UI) ────────

def emit_status(message: str) -> None:
    """Emit a progress line. Best-effort over AG-UI via LangGraph's custom-event
    stream writer; always echoed to the agent log so it's visible in the
    terminal even if the frontend channel isn't wired yet.
    """
    try:
        from langgraph.config import get_stream_writer

        writer = get_stream_writer()
        if writer:
            writer({"type": "status", "message": message})
    except Exception:  # noqa: BLE001 — status is never load-bearing
        pass
    print(f"[perceptual] {message}")


# ── STEP 2 — map the free-text need to profile ids ────────────────────────────

def map_need(need_text: str) -> dict:
    """Map a user's free-text accessibility need to one or more profile ids.

    Returns {"profiles": [ids], "focus": str|None, "rationale": str}. Strict
    JSON from the LLM, parsed defensively; falls back to COGNITIVE on any
    failure so generation never stalls on a bad mapping.
    """
    fallback = {
        "profiles": ["COGNITIVE"],
        "focus": None,
        "rationale": "fallback: could not parse a profile selection",
    }
    if not need_text or not need_text.strip():
        return fallback

    sys = (
        "You map a user's plain-language description of how they struggle with a "
        "web page to one or more accessibility need-profiles. Return ONLY a JSON "
        "object, no prose, no markdown fences.\n\n"
        "Choose from THESE profile ids (and ONLY these):\n"
        f"{mapper_profile_menu()}\n\n"
        "Select every profile that genuinely applies (often 1-2; up to 3). If "
        "the user names a single thing they want (e.g. 'just the article', 'only "
        "the price'), include ESSENTIALIST and put that thing in `focus`.\n\n"
        'Return exactly: {"profiles": ["ID", ...], "focus": "<string or null>", '
        '"rationale": "<one short sentence>"}'
    )
    try:
        out = _model().invoke(
            [SystemMessage(content=sys), HumanMessage(content=need_text)]
        )
        raw = _strip_to_json(_content_text(out.content))
        parsed = json.loads(raw)
    except Exception as exc:  # noqa: BLE001
        print(f"[perceptual] map_need failed, using fallback: {exc}")
        return fallback

    profiles = normalize_ids(parsed.get("profiles", []))
    if not profiles:
        profiles = ["COGNITIVE"]
    focus = parsed.get("focus")
    if not isinstance(focus, str) or not focus.strip():
        focus = None
    return {
        "profiles": profiles,
        "focus": focus,
        "rationale": str(parsed.get("rationale", ""))[:200],
    }


# ── STEP 4 — Linkup enrichment (auto-on; silently skipped without a key) ──────

def _linkup_query(page_type: str | None, profile_ids: list[str]) -> str:
    primary = profile_ids[0] if profile_ids else "COGNITIVE"
    profile = PROFILES.get(primary)
    audience = profile.title if profile else "accessibility"
    surface = page_type or "web"
    return (
        f"web accessibility best practices: how to design an accessible "
        f"{surface} page layout for users with {audience} needs "
        f"(text size, contrast, spacing, touch targets, decluttering)"
    )


def enrich(
    page_type: str | None,
    profile_ids: list[str],
    timeout_s: float = 6.0,
) -> str | None:
    """Query Linkup for best-practice guidance at the pageType x profile
    intersection. AUTO-ON when LINKUP_API_KEY is set; returns None (so
    generation proceeds on profiles only) when the key is absent, the call times
    out, or anything errors. Mirrors the LinkupClient pattern from
    linkup_tools.py.
    """
    api_key = os.getenv("LINKUP_API_KEY")
    if not api_key:
        return None

    query = _linkup_query(page_type, profile_ids)

    def _run() -> str:
        from linkup import LinkupClient

        client = LinkupClient(api_key=api_key)
        resp = client.search(
            query=query,
            depth="standard",
            output_type="sourcedAnswer",
            include_images=False,
        )
        # sourcedAnswer -> object with .answer; degrade gracefully otherwise.
        answer = getattr(resp, "answer", None)
        return answer if isinstance(answer, str) else str(resp)

    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            guidance = ex.submit(_run).result(timeout=timeout_s)
    except Exception as exc:  # noqa: BLE001 — enrichment is never load-bearing
        print(f"[perceptual] linkup enrichment skipped: {exc}")
        return None
    return guidance.strip()[:1500] if guidance else None


# ── STEP 3 — generate the accessible A2UI surface ─────────────────────────────

def _active_catalog_block() -> str:
    """The catalog the generator may emit from. Stock components (renderable
    today) by default; the accessible components when PERCEPTUAL_USE_A11Y is on.
    """
    if PERCEPTUAL_USE_A11Y:
        return (
            f"{CATALOG_PROMPT}\n\n"
            f"PREFER these accessibility components over the generic ones:\n"
            f"{ACCESSIBLE_COMPONENTS_PROMPT}"
        )
    return CATALOG_PROMPT


def _sourceref_rules() -> str:
    if PERCEPTUAL_USE_A11Y:
        return (
            f"PROXYING (critical): every interactive component MUST carry a "
            f'top-level "{SOURCE_REF_PROP}" prop equal to the source element\'s '
            f"sourceRef from the ExtractedPage. The proxy action is implied by "
            f"the component (BigButton=click, BigLink=navigate, BigInput/"
            f"BigSelect/BigToggle=input). Never drop a sourceRef — if it is "
            f"missing, that control cannot be operated."
        )
    return (
        f"PROXYING (critical): the stock catalog has Button as its interactive "
        f"primitive. For EVERY interactive source element (link/button/input), "
        f"emit a Button whose action carries the source sourceRef so it can be "
        f"proxied back to the real page:\n"
        f'  "action": {{ "event": {{ "name": "{PROXY_EVENT_NAME}", "context": '
        f'{{ "sourceRef": "<the element\'s sourceRef>", "action": '
        f'"click|navigate|input", "value": "" }} }} }}\n'
        f"Map link->navigate, button->click, input->input. Label the button "
        f"with the element's text (for an input, e.g. \"Edit: <label>\"). NEVER "
        f"drop a sourceRef — it is the only way the control can be operated."
    )


def _build_generation_prompt(
    page: dict,
    selection: dict,
    guidance: str | None,
    need_text: str,
) -> str:
    page_json = json.dumps(page, ensure_ascii=False)
    if len(page_json) > _MAX_PAGE_CHARS:
        page_json = page_json[:_MAX_PAGE_CHARS] + " …(truncated)"

    directives = directives_for(selection["profiles"], selection.get("focus"))
    guidance_block = (
        f"\n## Live best-practice guidance (apply where it helps)\n{guidance}\n"
        if guidance
        else ""
    )

    return (
        "You rebuild a web page into an ACCESSIBLE interface for a specific "
        "user. You are given the page's extracted structure and a set of "
        "accessibility directives. Produce an A2UI surface that follows the "
        "directives exactly.\n\n"
        f"## The user said\n{need_text or '(no words — apply the directives)'}\n\n"
        f"## Accessibility directives (FOLLOW THESE)\n{directives}\n"
        f"{guidance_block}\n"
        f"## The page (ExtractedPage JSON)\n{page_json}\n\n"
        f"## Components you may use\n{_active_catalog_block()}\n\n"
        f"{_sourceref_rules()}\n\n"
        "## How to build it\n"
        "- Walk the page elements and map each meaningful one to a component.\n"
        "- Apply the directives: declutter, single column, big targets, high "
        "contrast intent, static-only, larger text, flatten nav, etc.\n"
        "- Drop junk the directives say to remove (ads, popups, sidebars, "
        "autoplay) — do NOT recreate it.\n"
        "- Order for progressive paint: heading(s) first, then content, then "
        "interactive controls.\n"
        "- Exactly one node has id=\"root\"; every other node is reachable from "
        "it via children/child.\n\n"
        "Call render_a2ui exactly once. Pass the COMPLETE component tree as a "
        "JSON array STRING in `components_json` (every node an object with its "
        "props inline). Use data_json=\"{}\" unless you bind a {path}. Emit "
        "STRICT JSON (double-quoted keys, no trailing commas, no comments)."
    )


def generate_surface(
    page: dict,
    selection: dict,
    guidance: str | None = None,
    need_text: str = "",
) -> dict:
    """Run the generation LLM and return the rendered A2UI surface.

    Returns {"surface_id", "components", "data", "ops"}; `ops` is what gets fed
    to a2ui.render. Pure + importable so tests A2/A3/A4 can inspect the emitted
    components directly.
    """
    prompt = _build_generation_prompt(page, selection, guidance, need_text)
    model_with_tool = _model().bind_tools(
        [render_a2ui], tool_choice="render_a2ui"
    )
    response = model_with_tool.invoke(
        [SystemMessage(content=prompt),
         HumanMessage(content=need_text or "Generate the accessible interface.")]
    )

    if not response.tool_calls:
        return {"surface_id": SURFACE, "components": [], "data": {}, "ops": []}

    args = response.tool_calls[0]["args"]
    surface_id = args.get("surfaceId", SURFACE)
    catalog_id = args.get("catalogId", CATALOG_ID)

    try:
        components = json.loads(args.get("components_json", "[]") or "[]")
    except (json.JSONDecodeError, TypeError) as exc:
        print(f"[perceptual] failed to parse components_json: {exc}")
        components = []
    try:
        data = json.loads(args.get("data_json", "{}") or "{}")
    except (json.JSONDecodeError, TypeError) as exc:
        print(f"[perceptual] failed to parse data_json: {exc}")
        data = {}

    ops = [
        a2ui.create_surface(surface_id, catalog_id=catalog_id),
        a2ui.update_components(surface_id, components),
    ]
    if data:
        ops.append(a2ui.update_data_model(surface_id, data))

    return {
        "surface_id": surface_id,
        "components": components,
        "data": data,
        "ops": ops,
    }


# ── Reading the ExtractedPage + need out of the agent run state ───────────────

def _looks_like_page(obj: Any) -> bool:
    return isinstance(obj, dict) and isinstance(obj.get("elements"), list)


def extract_page_from_context(context_entries: list) -> dict | None:
    """Find the ExtractedPage among CopilotKit context entries. The side panel
    sends it as a context entry whose value is the page (object or JSON string).
    """
    for entry in context_entries:
        if not isinstance(entry, dict):
            continue
        value = entry.get("value")
        if _looks_like_page(value):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
            except (json.JSONDecodeError, TypeError):
                continue
            if _looks_like_page(parsed):
                return parsed
    return None


def _extract_page_from_messages(messages: list) -> dict | None:
    """Fallback: scan messages for an embedded JSON object carrying `elements`.
    Lets a caller inline the page into the message if no context channel exists.
    """
    for msg in reversed(messages):
        content = getattr(msg, "content", None)
        if content is None and isinstance(msg, dict):
            content = msg.get("content")
        if not isinstance(content, str) or '"elements"' not in content:
            continue
        for match in re.finditer(r"\{.*\}", content, re.DOTALL):
            try:
                parsed = json.loads(match.group(0))
            except (json.JSONDecodeError, TypeError):
                continue
            if _looks_like_page(parsed):
                return parsed
    return None


def _latest_user_text(messages: list) -> str:
    """The most recent human message's text (the user's need on this turn)."""
    for msg in reversed(messages):
        role = getattr(msg, "type", None)
        content = getattr(msg, "content", None)
        if role is None and isinstance(msg, dict):
            role = msg.get("role")
            content = msg.get("content")
        is_user = role in ("human", "user")
        if is_user and isinstance(content, str) and content.strip():
            return content.strip()
    return ""


# ── The tool the agent calls (orchestrates the pipeline) ──────────────────────

@tool()
def generate_interface(runtime: ToolRuntime[Any]) -> str:
    """Rebuild the current page into an accessible A2UI surface for the user's
    stated need. Reads the ExtractedPage from context and the need from the
    latest user message. Takes no arguments — it picks everything up from state.
    """
    state = runtime.state
    messages = state.get("messages", [])
    need_text = _latest_user_text(messages)

    context_entries = state.get("copilotkit", {}).get("context", [])
    page = extract_page_from_context(context_entries)
    if page is None:
        page = _extract_page_from_messages(messages)
    if page is None:
        return json.dumps(
            {"error": "no ExtractedPage found in context or messages"}
        )

    emit_status("Understanding your needs…")
    selection = map_need(need_text)
    emit_status(
        f"Adapting for: {', '.join(selection['profiles'])}"
        + (f" (focus: {selection['focus']})" if selection.get("focus") else "")
    )

    emit_status("Researching best practices…")
    guidance = enrich(page.get("pageType"), selection["profiles"])

    emit_status("Generating your interface…")
    result = generate_surface(page, selection, guidance, need_text)

    if not result["ops"]:
        return json.dumps({"error": "generation produced no surface"})
    return a2ui.render(operations=result["ops"])


# ── The agent graph ───────────────────────────────────────────────────────────

SYSTEM_PROMPT = f"""\
You are Perceptual Web. You rebuild the web page the user is on into an
interface tailored to how they struggle with the web.

## How a turn MUST go (do not deviate)
1. ONE call to `generate_interface()`. No arguments — it reads the extracted
   page and the user's need from state itself.
2. STOP. Do not call any more tools. Your final assistant message MUST be an
   empty string. The rendered surface IS the user-visible answer.

## Refinement
On later turns the user refines ("make the buttons even bigger", "hide
images", "just the article"). Treat each new message as a fresh need and call
`generate_interface()` again — the same surface updates in place.

## Hard rules (breaking these breaks the run)
- Call `generate_interface` AT MOST ONCE per turn. Never twice.
- After it returns, you are DONE. Do not write prose. Do not describe the
  surface. Reply with an empty string.

{CATALOG_PROMPT}
"""


def build_perceptual_agent():
    # _LazyModel defers the Gemini client to first use, so building the graph at
    # import never needs a key. /perceptual still requires a key the moment a
    # request hits it.
    return create_agent(
        model=_LazyModel(),
        tools=[generate_interface],
        middleware=[CopilotKitMiddleware()],
        system_prompt=SYSTEM_PROMPT,
        checkpointer=MemorySaver(),
    )


graph = build_perceptual_agent()
