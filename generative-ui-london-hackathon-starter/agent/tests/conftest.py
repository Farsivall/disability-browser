"""Shared pytest fixtures + helpers for the Perceptual Web agent tests.

Run from the agent/ directory:  uv run pytest
LLM-backed tests skip cleanly when GEMINI_API_KEY is missing or blocked (the
`live_llm` fixture probes once and skips the rest if the model isn't reachable).
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

# Importing main runs load_dotenv() (so GEMINI_API_KEY / LINKUP_API_KEY are
# picked up exactly as in production) and builds the graphs lazily. The /legal
# warning it may print is harmless.
import main  # noqa: F401,E402
from src import perceptual_agent as pa  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"

# Component types that MUST carry a sourceRef (interactive controls).
INTERACTIVE_COMPONENTS = {
    "Button", "BigButton", "BigLink", "BigInput", "BigSelect", "BigToggle",
}


# ── helpers (imported by test modules via `from conftest import ...`) ──────────

def load_page(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def child_refs(node: dict) -> list[str]:
    """All component ids a node points at via `children` or `child`."""
    refs: list[str] = []
    children = node.get("children")
    if isinstance(children, list):
        refs.extend(c for c in children if isinstance(c, str))
    elif isinstance(children, dict) and isinstance(children.get("componentId"), str):
        refs.append(children["componentId"])
    child = node.get("child")
    if isinstance(child, str):
        refs.append(child)
    return refs


def sourceref_of(component: dict) -> str | None:
    """Pull the sourceRef off a component — top-level prop (canonical) or nested
    in action.event.context (stock-Button fallback)."""
    if not isinstance(component, dict):
        return None
    top = component.get("sourceRef")
    if isinstance(top, str) and top:
        return top
    ctx = (((component.get("action") or {}).get("event") or {}).get("context") or {})
    ref = ctx.get("sourceRef")
    return ref if isinstance(ref, str) and ref else None


def collect_refs(obj, found: set[str]) -> None:
    """Every sourceRef value appearing anywhere in the structure."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "sourceRef" and isinstance(v, str):
                found.add(v)
            else:
                collect_refs(v, found)
    elif isinstance(obj, list):
        for item in obj:
            collect_refs(item, found)


def interactive_components(components: list) -> list[dict]:
    return [
        c for c in components
        if isinstance(c, dict) and c.get("component") in INTERACTIVE_COMPONENTS
    ]


def assert_valid_surface(components: list) -> None:
    """Structural A2UI validity: non-empty, exactly one root, all child refs
    resolve, every node reachable from root."""
    assert isinstance(components, list) and components, "surface has no components"
    by_id = {c["id"]: c for c in components if isinstance(c, dict) and "id" in c}
    ids = [c.get("id") for c in components if isinstance(c, dict)]
    assert ids.count("root") == 1, f"need exactly one id='root', got {ids.count('root')}"

    for c in components:
        if isinstance(c, dict):
            for ref in child_refs(c):
                assert ref in by_id, f"dangling child ref {ref!r} from {c.get('id')!r}"

    reachable: set[str] = set()
    stack = ["root"]
    while stack:
        cid = stack.pop()
        if cid in reachable:
            continue
        reachable.add(cid)
        node = by_id.get(cid)
        if node:
            stack.extend(child_refs(node))
    orphans = set(by_id) - reachable
    assert not orphans, f"nodes not reachable from root: {orphans}"


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def shop_page() -> dict:
    return load_page("sample_shop_page.json")


@pytest.fixture(scope="session")
def live_llm() -> bool:
    """Probe Gemini once. Skip the dependent test if the model isn't reachable
    (no key, blocked key, network). Keeps the suite green offline."""
    result = pa.map_need("the text is too small and it is cluttered")
    if result["rationale"].startswith("fallback"):
        pytest.skip("Gemini not reachable (missing/blocked key) — skipping live LLM test")
    return True
