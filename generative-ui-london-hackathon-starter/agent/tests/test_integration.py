"""I1 integration gate — the agent emits Builder C's exact accessible catalog.

With PERCEPTUAL_USE_A11Y on (default), generate_surface must:
  * use only component names that exist in C's catalog,
  * carry a TOP-LEVEL `sourceRef` on every interactive component (no action obj),
  * emit a /perceptualTheme data-model entry derived from the profiles.
Live (needs Gemini); skips cleanly without a key via the live_llm fixture.
"""
from __future__ import annotations

from conftest import (
    ACCESSIBLE_INTERACTIVE,
    ALLOWED_A11Y_COMPONENTS,
    assert_valid_surface,
)
from src import need_profiles as np
from src import perceptual_agent as pa


def _gen(page, profile):
    selection = {"profiles": [profile], "focus": None, "rationale": "x"}
    return pa.generate_surface(page, selection, need_text=profile.lower())


def test_a11y_enabled_by_default():
    assert pa.PERCEPTUAL_USE_A11Y is True


def test_only_catalog_components_emitted(live_llm, shop_page):
    result = _gen(shop_page, "MOTOR")
    assert_valid_surface(result["components"])
    names = {c.get("component") for c in result["components"] if isinstance(c, dict)}
    unknown = names - ALLOWED_A11Y_COMPONENTS
    assert not unknown, f"emitted components not in C's catalog: {unknown}"


def test_interactive_components_are_accessible_with_toplevel_sourceref(live_llm, shop_page):
    result = _gen(shop_page, "MOTOR")
    interactive = [
        c for c in result["components"]
        if isinstance(c, dict) and c.get("component") in ACCESSIBLE_INTERACTIVE
    ]
    assert interactive, "expected Big* interactive components for MOTOR"
    for c in interactive:
        ref = c.get("sourceRef")
        assert isinstance(ref, str) and ref, f"{c.get('component')} missing top-level sourceRef"
        assert "action" not in c, f"{c.get('component')} must NOT carry an action object"


def test_flatnav_items_carry_sourceref(live_llm, shop_page):
    result = _gen(shop_page, "MOTOR")
    for c in result["components"]:
        if isinstance(c, dict) and c.get("component") == "FlatNav":
            for item in c.get("items", []):
                assert isinstance(item.get("sourceRef"), str) and item["sourceRef"], (
                    "FlatNav item missing sourceRef"
                )


def test_perceptual_theme_emitted_from_profiles(live_llm, shop_page):
    # VISUAL preset → high contrast + large text (mirror of C's presets).
    result = _gen(shop_page, "VISUAL")
    theme = result["data"].get("perceptualTheme")
    assert isinstance(theme, dict), "no /perceptualTheme in data model"
    assert theme.get("contrast") == "high"
    assert theme.get("textScale") == "large"


def test_theme_for_matches_presets_pure():
    # Pure (no LLM) — guards the Python mirror of C's PROFILE_THEME_PRESETS.
    assert np.theme_for(["VISUAL"]) == {
        "contrast": "high", "textScale": "large",
        "focusStyle": "emphasized", "hideDecorations": True,
    }
    assert np.theme_for(["VESTIBULAR"]) == {"reduceMotion": True}
    assert np.theme_for([]) == {}
