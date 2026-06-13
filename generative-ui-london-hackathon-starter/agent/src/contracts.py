"""Shared data contracts for Perceptual Web (Python side).

These are the two messages every part of the system agrees on. They are the
"wire format" between the page, the agent, and the generated interface. Do NOT
change a field name or shape here without updating the TS mirror
(`src/perceptual/contracts.ts`) and `CONTRACTS.md` in the repo root.

CONTRACT 1 — ExtractedPage
    Produced by the content script (DOM extraction), CONSUMED by this agent.
    A compact semantic snapshot of the live page.

CONTRACT 2 — ProxyMessage
    Produced by the side panel when the user interacts with the generated
    interface, CONSUMED by the content script (which re-fires the event on the
    real page). The agent's job is to make sure every interactive component it
    generates carries the source element's `sourceRef` so this message can be
    built later.

THE BRIDGE (how sourceRef survives the round-trip)
    The generated A2UI interactive components do NOT need a bespoke transport.
    They reuse the catalog's existing event channel: an interactive component's
    `action` is `{ "event": { "name": PROXY_EVENT_NAME, "context": {...} } }`,
    and the `context` carries everything needed to rebuild a ProxyMessage:
        { "sourceRef": "el-42", "action": "click", "value"?: "..." }
    The side panel's onAction handler turns that context into a ProxyMessage.
    Because the stock Button renderer already forwards `action.event.context`
    through `dispatch`, proxying works with zero renderer changes.
"""
from __future__ import annotations

from typing import Literal, TypedDict

# ── Constants shared across builders ─────────────────────────────────────────
# These mirror Builder B's extension/src/contracts.js (now merged to main).
# Keep them identical to B's values.

# CANONICAL sourceRef transport: the A2UI component prop name that carries the
# sourceRef through to the renderer. Builder B's contract states the agent must
# forward this prop on EVERY interactive component it emits; Builder C reads it
# off the rendered component to build the ProxyMessage.
SOURCE_REF_PROP = "sourceRef"

# How extracted sourceRefs look (Builder B assigns "pw-<n>"). Opaque to us — we
# only echo whatever B assigned — but documented here so tests use realistic ids.
REF_PREFIX = "pw-"

# The DOM attribute B stamps on the live element (B-internal; here for reference).
DATA_ATTR = "data-pw-ref"

# The literal `type` field on a ProxyMessage (B: PROXY_EVENT_TYPE).
PROXY_MESSAGE_TYPE = "PROXY_EVENT"

# Allowed proxy actions. Keep in sync with ProxyMessage.action below + B's
# PROXY_ACTIONS.
ProxyAction = Literal["click", "navigate", "input", "submit"]

# FALLBACK transport only: when emitting a STOCK catalog Button (which has no
# sourceRef prop, only an `action`), the sourceRef rides inside
# action.event.context under this event name. The canonical path for the
# accessible components is the top-level SOURCE_REF_PROP above.
PROXY_EVENT_NAME = "proxy_event"


# ── CONTRACT 1 — ExtractedPage ───────────────────────────────────────────────

class ExtractedElement(TypedDict, total=False):
    """One node in the extracted page tree.

    `sourceRef` is the ONLY field that is always required in practice — it is
    the stable bridge key the proxy uses to re-find the real element. Every
    other field is role-dependent (a heading has `level`/`text`; a link has
    `href`; an input has `inputType`/`options`; an image has `alt`).
    """

    sourceRef: str          # STABLE unique id assigned at extraction time (pw-<n>)
    role: str               # roles B actually emits: "heading"|"paragraph"|
                            # "link"|"button"|"input"|"image"|"nav"|"form"|
                            # "list-item" (one per <li>; there is no "list"
                            # container role)
    level: int              # headings only (1-6)
    text: str               # visible text content
    href: str               # links only
    inputType: str          # inputs only: "text"|"checkbox"|"radio"|"select"|...
    options: list[str]      # selects/radios only
    alt: str                # images only
    children: list["ExtractedElement"]  # nested structure (e.g. form -> inputs)


class ExtractedPage(TypedDict):
    """The full snapshot the agent receives as input."""

    url: str
    pageType: str | None    # "article"|"product"|"form"|"feed"|"dashboard"|None
    title: str
    elements: list[ExtractedElement]


# ── CONTRACT 2 — ProxyMessage ────────────────────────────────────────────────

class ProxyMessage(TypedDict, total=False):
    """Built by the side panel, consumed by the content script.

    `type` is always PROXY_MESSAGE_TYPE; `action` + `sourceRef` are always
    present; `value` is present only for input actions.
    """

    type: Literal["PROXY_EVENT"]
    action: ProxyAction
    sourceRef: str          # matches an ExtractedElement.sourceRef
    value: str              # for "input" actions


# ── Helpers ──────────────────────────────────────────────────────────────────

def proxy_event_context(
    source_ref: str, action: ProxyAction, value: str | None = None
) -> dict:
    """Build the `context` an interactive A2UI component should carry so the
    side panel can rebuild a ProxyMessage from a dispatch. The agent's
    generation prompt instructs the LLM to inline exactly this shape; this
    helper is the single source of truth for tests and any server-side
    component assembly.
    """
    ctx: dict = {"sourceRef": source_ref, "action": action}
    if value is not None:
        ctx["value"] = value
    return ctx


def validate_extracted_page(obj: object) -> list[str]:
    """Return a list of human-readable problems with an ExtractedPage-shaped
    object. Empty list == valid. Used by tests and as a cheap guard before
    generation. Intentionally lenient about role-specific fields (extraction is
    best-effort); strict only about the structural contract.
    """
    problems: list[str] = []
    if not isinstance(obj, dict):
        return ["ExtractedPage must be an object"]

    for key in ("url", "title", "elements"):
        if key not in obj:
            problems.append(f"missing required key: {key!r}")

    if "pageType" in obj and obj["pageType"] is not None and not isinstance(
        obj["pageType"], str
    ):
        problems.append("pageType must be a string or null")

    elements = obj.get("elements")
    if elements is not None and not isinstance(elements, list):
        problems.append("elements must be a list")
    elif isinstance(elements, list):
        seen_refs: set[str] = set()
        _walk_elements(elements, problems, seen_refs, path="elements")

    return problems


def _walk_elements(
    elements: list, problems: list[str], seen_refs: set[str], path: str
) -> None:
    interactive_roles = {"link", "button", "input"}
    for i, el in enumerate(elements):
        here = f"{path}[{i}]"
        if not isinstance(el, dict):
            problems.append(f"{here} must be an object")
            continue
        if "role" not in el:
            problems.append(f"{here} missing 'role'")
        ref = el.get("sourceRef")
        # Interactive elements MUST have a sourceRef or proxying breaks.
        if el.get("role") in interactive_roles and not ref:
            problems.append(f"{here} ({el.get('role')}) missing 'sourceRef'")
        if ref is not None:
            if not isinstance(ref, str):
                problems.append(f"{here} sourceRef must be a string")
            elif ref in seen_refs:
                problems.append(f"{here} duplicate sourceRef: {ref!r}")
            else:
                seen_refs.add(ref)
        children = el.get("children")
        if isinstance(children, list):
            _walk_elements(children, problems, seen_refs, path=f"{here}.children")
