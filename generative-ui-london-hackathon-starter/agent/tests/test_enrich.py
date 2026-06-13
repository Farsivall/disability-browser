"""A5 — Linkup enrichment: graceful timeout, status emission, optional live."""
from __future__ import annotations

import os
import time

import pytest

from src import perceptual_agent as pa


class _SlowClient:
    """Fake LinkupClient whose search exceeds the enrich timeout."""

    def __init__(self, *a, **k):
        pass

    def search(self, *a, **k):
        time.sleep(2.0)
        return type("R", (), {"answer": "too late"})()


def test_enrich_times_out_gracefully(monkeypatch):
    monkeypatch.setenv("LINKUP_API_KEY", "dummy")
    monkeypatch.setattr("linkup.LinkupClient", _SlowClient)
    # 0.3s budget vs a 2s call -> must fall back to None, never hang/raise.
    assert pa.enrich("product", ["VISUAL"], timeout_s=0.3) is None


def test_enrich_survives_client_error(monkeypatch):
    def _boom(*a, **k):
        raise RuntimeError("linkup down")

    monkeypatch.setenv("LINKUP_API_KEY", "dummy")
    monkeypatch.setattr("linkup.LinkupClient", _boom)
    assert pa.enrich("article", ["COGNITIVE"]) is None


def test_emit_status_never_raises():
    # Called outside a LangGraph run (no stream writer) — must be a safe no-op.
    pa.emit_status("Researching best practices…")


@pytest.mark.skipif(
    not os.getenv("LINKUP_API_KEY") or os.getenv("RUN_LIVE_LINKUP") != "1",
    reason="set RUN_LIVE_LINKUP=1 (and a real LINKUP_API_KEY) for the live call",
)
def test_enrich_live_returns_text_or_none():
    out = pa.enrich("product", ["VISUAL"])
    assert out is None or isinstance(out, str)
