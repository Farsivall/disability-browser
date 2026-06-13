"""Pure unit tests — no LLM, always run (the deterministic floor)."""
from __future__ import annotations

from src import contracts as c
from src import need_profiles as np
from src import perceptual_agent as pa


# ── need_profiles ─────────────────────────────────────────────────────────────

def test_all_five_profiles_present():
    assert set(np.PROFILE_IDS) == {
        "VISUAL", "COGNITIVE", "MOTOR", "VESTIBULAR", "ESSENTIALIST"
    }
    for pid in np.PROFILE_IDS:
        assert np.PROFILES[pid].directives, f"{pid} has no directives"


def test_normalize_ids_dedupes_and_drops_unknown():
    assert np.normalize_ids(["cognitive", "VISUAL", "bogus", "visual"]) == [
        "VISUAL", "COGNITIVE"
    ]


def test_directives_carry_profile_signatures():
    # MOTOR -> big targets; VISUAL -> contrast/large; COGNITIVE -> single column
    assert "44x44" in np.directives_for(["MOTOR"])
    assert "contrast" in np.directives_for(["VISUAL"]).lower()
    assert "single" in np.directives_for(["COGNITIVE"]).lower()


def test_directives_empty_falls_back_to_cognitive():
    assert np.directives_for([]).startswith("## Cognitive")


def test_essentialist_focus_surfaces_first():
    out = np.directives_for(["ESSENTIALIST"], focus="the price")
    assert out.splitlines()[0].startswith("PRIMARY FOCUS")
    assert "the price" in out


# ── contracts ─────────────────────────────────────────────────────────────────

def test_valid_extracted_page_passes():
    page = {
        "url": "u", "title": "t", "pageType": "article",
        "elements": [
            {"role": "heading", "level": 1, "text": "H", "sourceRef": "pw-1"},
            {"role": "button", "text": "Go", "sourceRef": "pw-2"},
        ],
    }
    assert c.validate_extracted_page(page) == []


def test_invalid_page_flags_missing_url_and_sourceref_and_dupes():
    bad = {
        "title": "t",
        "elements": [
            {"role": "button"},                       # interactive w/o sourceRef
            {"role": "link", "sourceRef": "pw-1"},
            {"role": "input", "sourceRef": "pw-1"},  # duplicate ref
        ],
    }
    problems = c.validate_extracted_page(bad)
    assert any("url" in p for p in problems)
    assert any("missing 'sourceRef'" in p for p in problems)
    assert any("duplicate" in p for p in problems)


def test_proxy_constants_match_builder_b():
    # aligned with extension/src/contracts.js
    assert c.SOURCE_REF_PROP == "sourceRef"
    assert c.REF_PREFIX == "pw-"
    assert c.PROXY_MESSAGE_TYPE == "PROXY_EVENT"


# ── perceptual_agent pure helpers ─────────────────────────────────────────────

def test_content_text_handles_gemini_list_blocks():
    # Gemini 3.x returns content as a list of blocks with a thought signature.
    blocks = [{"type": "text", "text": '{"a":1}', "extras": {"signature": "x"}}]
    assert pa._content_text(blocks) == '{"a":1}'
    assert pa._content_text("plain") == "plain"


def test_map_need_empty_is_fallback_without_llm():
    r = pa.map_need("")
    assert r["profiles"] == ["COGNITIVE"]
    assert r["rationale"].startswith("fallback")


def test_extract_page_from_context_parses_string_and_object():
    page = {"url": "u", "title": "t", "pageType": None, "elements": []}
    import json
    assert pa.extract_page_from_context([{"value": json.dumps(page)}]) == page
    assert pa.extract_page_from_context([{"value": page}]) == page
    assert pa.extract_page_from_context([{"value": "not json"}]) is None


def test_latest_user_text_reads_dict_and_object_messages():
    msgs = [{"role": "user", "content": "first"}, {"role": "user", "content": "latest"}]
    assert pa._latest_user_text(msgs) == "latest"


def test_enrich_returns_none_without_key(monkeypatch):
    monkeypatch.delenv("LINKUP_API_KEY", raising=False)
    assert pa.enrich("product", ["VISUAL"]) is None
