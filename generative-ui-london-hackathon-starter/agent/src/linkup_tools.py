"""Linkup web-search tool for the agents.

Linkup (https://app.linkup.so) is a web-search API for AI agents: one call
returns sourced, cited answers grounded in live web data. This wires it in as
a LangChain `@tool` the dynamic agent can call when the uploaded PDF doesn't
contain the answer (current events, definitions, external facts, etc.).

Design mirrors the other tool modules in this package:
  * The LinkupClient is constructed LAZILY (first call), not at import time,
    so `import main` succeeds with no key / OFFLINE=1.
  * A missing LINKUP_API_KEY degrades gracefully — the tool returns a short
    "not configured" note instead of raising, so the agent keeps working
    PDF-only.
  * The return value is a compact JSON string (answer + sources) that the
    dynamic agent's generate_a2ui step can fold straight into a surface.
"""
from __future__ import annotations

import json
import os
from typing import Any

from langchain.tools import tool

# linkup-sdk exposes the `linkup` package. Imported lazily inside the tool so a
# missing optional dependency never breaks `import main`.
_CLIENT: Any | None = None


def _client() -> Any | None:
    """Return a cached LinkupClient, or None when no API key is configured."""
    global _CLIENT
    if _CLIENT is not None:
        return _CLIENT

    api_key = os.getenv("LINKUP_API_KEY")
    if not api_key:
        return None

    try:
        from linkup import LinkupClient
    except ImportError:
        return None

    _CLIENT = LinkupClient(api_key=api_key)
    return _CLIENT


def _serialize(response: Any) -> str:
    """Flatten a Linkup response into a compact JSON string for the LLM."""
    # sourcedAnswer → object with `.answer` + `.sources`; searchResults →
    # object with `.results`. Pydantic models expose model_dump(); fall back to
    # __dict__ or str() for anything unexpected.
    if hasattr(response, "model_dump"):
        payload = response.model_dump()
    elif hasattr(response, "__dict__"):
        payload = dict(response.__dict__)
    else:
        payload = {"result": str(response)}
    return json.dumps(payload, default=str, ensure_ascii=False)


@tool
def web_search(query: str) -> str:
    """Search the live web for facts NOT in the uploaded PDF.

    Use this for current events, external definitions, statistics, or any
    question the document itself can't answer. Returns a JSON string with a
    sourced answer and its citations (title + url). Call at most once per turn,
    BEFORE rendering the answer surface.

    Args:
        query: A focused natural-language search query.
    """
    client = _client()
    if client is None:
        return json.dumps(
            {
                "error": "web_search unavailable",
                "detail": (
                    "LINKUP_API_KEY is not set (or linkup-sdk is not "
                    "installed). Answer from the PDF only."
                ),
            }
        )

    try:
        response = client.search(
            query=query,
            depth="standard",
            output_type="sourcedAnswer",
            include_images=False,
        )
    except Exception as exc:  # noqa: BLE001 — never crash the agent loop
        return json.dumps({"error": "linkup search failed", "detail": str(exc)})

    return _serialize(response)
