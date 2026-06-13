"""Live LLM tests (A1-A4, A6) — need a reachable Gemini key.

All depend on the `live_llm` fixture, which probes once and skips the whole set
if the model isn't reachable, so the suite stays green offline.
"""
from __future__ import annotations

import json

import pytest

from conftest import (
    assert_valid_surface,
    collect_refs,
    interactive_components,
    sourceref_of,
)
from src import need_profiles as np
from src import perceptual_agent as pa


# ── A1 — need mapping ─────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "phrase,expected",
    [
        ("everything is tiny and there's way too much on the screen", "VISUAL"),
        ("I can't click small things", "MOTOR"),
        ("the animations make me dizzy", "VESTIBULAR"),
        ("just show me the article and nothing else", "ESSENTIALIST"),
        ("too much going on, text is too small", "COGNITIVE"),
    ],
)
def test_a1_mapping_picks_sensible_profiles(live_llm, phrase, expected):
    r = pa.map_need(phrase)
    assert r["profiles"], "no profiles selected"
    assert all(p in np.PROFILE_IDS for p in r["profiles"]), r["profiles"]
    assert not r["rationale"].startswith("fallback"), "LLM call did not succeed"
    assert expected in r["profiles"], f"expected {expected} in {r['profiles']} for {phrase!r}"


def test_a1_essentialist_extracts_focus(live_llm):
    r = pa.map_need("just show me the article and make it high contrast")
    assert "ESSENTIALIST" in r["profiles"]
    assert r["focus"], "essentialist need should populate a focus string"


# ── A2 — generation validity ──────────────────────────────────────────────────

def test_a2_generation_is_valid_a2ui(live_llm, shop_page):
    selection = {"profiles": ["COGNITIVE"], "focus": None, "rationale": "x"}
    result = pa.generate_surface(shop_page, selection, need_text="declutter this")
    assert_valid_surface(result["components"])


# ── A3 — sourceRef preservation (the proxying gate) ───────────────────────────

def test_a3_rendered_controls_all_carry_sourceref(live_llm, shop_page):
    # MOTOR keeps controls (just enlarges them) -> best profile to test this on.
    selection = {"profiles": ["MOTOR"], "focus": None, "rationale": "x"}
    result = pa.generate_surface(shop_page, selection, need_text="big buttons please")
    controls = interactive_components(result["components"])
    assert controls, "expected interactive components in the surface"
    missing = [c.get("id") for c in controls if not sourceref_of(c)]
    assert not missing, f"interactive components missing a sourceRef: {missing}"


def test_a3_key_action_is_preserved(live_llm, shop_page):
    # pw-25 == "Add to Cart" — the control the demo finale clicks.
    selection = {"profiles": ["MOTOR"], "focus": None, "rationale": "x"}
    result = pa.generate_surface(shop_page, selection, need_text="big buttons please")
    found: set[str] = set()
    collect_refs(result["components"], found)
    assert "pw-25" in found, "Add to Cart sourceRef (pw-25) was dropped"


# ── A4 — profile differentiation ──────────────────────────────────────────────

def test_a4_profiles_produce_different_surfaces(live_llm, shop_page):
    surfaces = {}
    refs = {}
    for pid in ("COGNITIVE", "MOTOR", "VISUAL"):
        selection = {"profiles": [pid], "focus": None, "rationale": "x"}
        comps = pa.generate_surface(shop_page, selection, need_text=pid.lower())["components"]
        assert_valid_surface(comps)
        surfaces[pid] = json.dumps(comps, sort_keys=True)
        found: set[str] = set()
        collect_refs(comps, found)
        refs[pid] = found

    # The three rebuilds must not be byte-identical.
    assert len({surfaces["COGNITIVE"], surfaces["MOTOR"], surfaces["VISUAL"]}) == 3, (
        "profiles produced identical surfaces — directives aren't reaching output"
    )
    # Declutter profiles keep a different control set than motor.
    assert refs["MOTOR"] != refs["VISUAL"], "MOTOR and VISUAL kept identical controls"


# ── A6 — full pipeline end to end (real map_need + generate) ──────────────────

def test_a6_end_to_end_pipeline(live_llm, shop_page):
    need = "too much going on and the text is too small"
    selection = pa.map_need(need)
    assert not selection["rationale"].startswith("fallback")
    result = pa.generate_surface(
        shop_page, selection, guidance=None, need_text=need
    )
    assert_valid_surface(result["components"])
    controls = interactive_components(result["components"])
    assert controls, "no interactive controls generated"
    assert all(sourceref_of(c) for c in controls), "a control lost its sourceRef"
