"""Visual end-to-end preview of the Perceptual Web generator.

Runs the REAL generation pipeline against the dummy shop page for three
different accessibility needs, checks sourceRef preservation, and writes an
HTML page that renders the original (messy) page next to the three generated
accessible views — so you can SEE the transformation.

Usage:
    uv run python -m tests.preview_pipeline      # from the agent/ dir
Then open the printed preview.html path (this script tries to open it).
"""
from __future__ import annotations

import html
import json
import os
import subprocess
from pathlib import Path

import main  # noqa: F401 — triggers load_dotenv() so GEMINI_API_KEY is picked up
from src import perceptual_agent as pa

FIXTURE = Path(__file__).parent / "fixtures" / "sample_shop_page.json"
OUT = Path(__file__).resolve().parents[2] / "preview.html"

PROFILE_RUNS = [
    ("COGNITIVE", "Too much going on, text's too small", None),
    ("MOTOR", "I can't click small things", None),
    ("VISUAL", "Just show me the product, high contrast", None),
]


def collect_refs(obj, found):
    """Recursively collect every sourceRef value appearing anywhere in the
    generated component JSON (top-level prop OR nested in action context)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "sourceRef" and isinstance(v, str):
                found.add(v)
            else:
                collect_refs(v, found)
    elif isinstance(obj, list):
        for item in obj:
            collect_refs(item, found)


# ── tiny A2UI -> HTML renderer (stock catalog only; preview-quality) ──────────

def _text_of(val):
    if isinstance(val, dict):
        return ""  # {path} binding — not used in our inlined output
    return html.escape(str(val)) if val is not None else ""


def render_node(cid, by_id, seen=None):
    seen = seen or set()
    if cid in seen:
        return ""
    seen.add(cid)
    node = by_id.get(cid)
    if not node:
        return ""
    comp = node.get("component", "")
    kids = node.get("children", [])
    child = node.get("child")

    def render_kids():
        ids = kids if isinstance(kids, list) else []
        return "".join(render_node(k, by_id, seen) for k in ids)

    if comp in ("Stack", "Row", "Grid"):
        cls = {"Row": "row", "Grid": "grid"}.get(comp, "stack")
        return f'<div class="{cls}">{render_kids()}</div>'
    if comp == "Section":
        title = _text_of(node.get("title"))
        eye = _text_of(node.get("eyebrow"))
        inner = render_node(child, by_id, seen) if child else render_kids()
        return f'<section><div class="eyebrow">{eye}</div><h2>{title}</h2>{inner}</section>'
    if comp == "Card":
        inner = render_node(child, by_id, seen) if child else render_kids()
        return f'<div class="card">{inner}</div>'
    if comp == "Divider":
        return '<hr/>'
    if comp in ("Heading", "AccessibleHeading"):
        lvl = str(node.get("level", "2"))
        return f'<h{lvl} class="hd">{_text_of(node.get("text"))}</h{lvl}>'
    if comp in ("Text", "ReadableText"):
        return f'<p class="txt">{_text_of(node.get("text"))}</p>'
    if comp == "Overline":
        return f'<div class="eyebrow">{_text_of(node.get("text"))}</div>'
    if comp == "Badge":
        return f'<span class="badge">{_text_of(node.get("label"))}</span>'
    if comp in ("Callout", "AccessibleCallout"):
        t = _text_of(node.get("title"))
        b = _text_of(node.get("body"))
        return f'<div class="callout"><b>{t}</b><div>{b}</div></div>'
    if comp == "FlatNav":
        items = node.get("items", []) or []
        btns = "".join(
            f'<button class="btn" data-ref="{html.escape(str(i.get("sourceRef","")))}">'
            f'{_text_of(i.get("label"))}<span class="ref">{html.escape(str(i.get("sourceRef","")))}</span></button>'
            for i in items if isinstance(i, dict)
        )
        return f'<nav class="row">{btns}</nav>'
    if comp == "StaticImageGrid":
        imgs = node.get("images", []) or []
        cells = "".join(
            f'<div class="imgcell">🖼 {_text_of(i.get("alt"))}</div>'
            for i in imgs if isinstance(i, dict)
        )
        return f'<div class="grid">{cells}</div>'
    if comp == "PaginatedList":
        return f'<div class="stack">{render_kids()}</div>'
    if comp == "BulletList":
        items = node.get("items", [])
        lis = "".join(f"<li>{_text_of(i)}</li>" for i in items if not isinstance(i, dict))
        return f"<ul>{lis}</ul>"
    if comp in ("Button", "BigButton", "BigLink"):
        label = _text_of(node.get("label")) or _text_of(node.get("text"))
        ref = node.get("sourceRef")
        if not ref:
            ctx = (((node.get("action") or {}).get("event") or {}).get("context") or {})
            ref = ctx.get("sourceRef")
        tag = f' data-ref="{html.escape(str(ref))}"' if ref else ""
        badge = f'<span class="ref">{html.escape(str(ref))}</span>' if ref else ""
        return f'<button class="btn"{tag}>{label}{badge}</button>'
    if comp in ("BigInput", "BigSelect", "BigToggle"):
        label = _text_of(node.get("label"))
        return f'<label class="field">{label}<input/></label>'
    # unknown component — show its type so nothing silently vanishes
    return f'<div class="unknown">[{html.escape(comp)}]</div>'


def render_surface(components):
    by_id = {c.get("id"): c for c in components if isinstance(c, dict)}
    root = "root" if "root" in by_id else (components[0].get("id") if components else None)
    return render_node(root, by_id) if root else "<i>(empty surface)</i>"


def original_html(page):
    rows = []
    for el in page["elements"]:
        role = el.get("role")
        txt = el.get("text") or el.get("alt") or el.get("inputType") or ""
        rows.append(f'<div class="orig-el orig-{role}">{html.escape(role)}: {html.escape(str(txt))[:60]}</div>')
    return "".join(rows)


def main_run():
    page = json.loads(FIXTURE.read_text())
    input_interactive = {
        el["sourceRef"] for el in page["elements"]
        if el.get("role") in ("link", "button", "input") and el.get("sourceRef")
    }

    columns = []
    summary = []
    for pid, need, _ in PROFILE_RUNS:
        selection = {"profiles": [pid], "focus": None, "rationale": "preview"}
        prompt = pa._build_generation_prompt(page, selection, None, need)
        result = pa.generate_surface(page, selection, guidance=None, need_text=need)
        comps = result["components"]
        found = set()
        collect_refs(comps, found)
        preserved = input_interactive & found
        pct = round(100 * len(preserved) / max(1, len(input_interactive)))
        summary.append((pid, need, len(comps), len(preserved), len(input_interactive), pct))
        body = render_surface(comps)
        columns.append((pid, need, body, len(comps), len(preserved), len(input_interactive), prompt))

    # ---- terminal summary ----
    print("\n" + "=" * 64)
    print("  PERCEPTUAL WEB — generation results (dummy shop page)")
    print("=" * 64)
    print(f"  original interactive elements: {len(input_interactive)}")
    for pid, need, ncomp, npres, ntot, pct in summary:
        bar = "█" * (pct // 10) + "░" * (10 - pct // 10)
        print(f"  {pid:<12} {ncomp:>3} comps | sourceRefs {npres}/{ntot} [{bar}] {pct}%")
    print("=" * 64)
    print(f"  visual preview -> {OUT}")
    print("=" * 64 + "\n")

    # ---- HTML preview ----
    cols_html = []
    cols_html.append(
        f'<div class="col original"><div class="col-head">ORIGINAL WEBSITE (live)</div>'
        f'<div class="need">the real dummy shop page — cluttered on purpose</div>'
        f'<iframe class="orig-frame" src="dummy-site/shop.html"></iframe></div>'
    )
    for pid, need, body, ncomp, npres, ntot, prompt in columns:
        cls = pid.lower()
        cols_html.append(
            f'<div class="col gen {cls}">'
            f'<div class="col-head">REBUILT · {pid}</div>'
            f'<div class="need">PROMPT: “{html.escape(need)}”</div>'
            f'<div class="meta">{ncomp} components · {npres}/{ntot} sourceRefs preserved</div>'
            f'<div class="surface">{body}</div>'
            f'<details class="promptbox"><summary>see the full prompt sent to the model</summary>'
            f'<pre>{html.escape(prompt)}</pre></details>'
            f'</div>'
        )

    page_html = HTML_SHELL.replace("{{COLS}}", "".join(cols_html))
    OUT.write_text(page_html)
    try:
        subprocess.run(["open", str(OUT)], check=False)
    except Exception:
        pass


HTML_SHELL = """<!doctype html><html><head><meta charset="utf-8">
<title>Perceptual Web — preview</title>
<style>
  body { margin:0; font-family:-apple-system,Segoe UI,Roboto,sans-serif; background:#0e0e12; color:#222; }
  header { padding:16px 24px; background:#16161c; color:#fff; }
  header h1 { margin:0; font-size:18px; }
  header p { margin:4px 0 0; color:#9a9ab0; font-size:13px; }
  .cols { display:flex; gap:14px; padding:18px; align-items:flex-start; overflow-x:auto; }
  .col { flex:1; min-width:260px; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px #0006; }
  .col-head { padding:8px 12px; font-weight:700; font-size:12px; letter-spacing:.08em; color:#fff; background:#444; }
  .original .col-head { background:#8a2b2b; }
  .cognitive .col-head { background:#2b5fa8; }
  .motor .col-head { background:#2b8a5f; }
  .visual .col-head { background:#111; }
  .need { padding:6px 12px; font-style:italic; color:#555; font-size:13px; background:#f4f4f8; }
  .meta { padding:4px 12px; font-size:11px; color:#888; border-bottom:1px solid #eee; }
  .surface { padding:14px; }
  /* original website iframe */
  .orig-frame { width:100%; height:680px; border:0; background:#fff; }
  .original { min-width:380px; flex:1.4; }
  /* prompt box */
  .promptbox { border-top:1px solid #eee; padding:8px 12px; font-size:12px; }
  .promptbox summary { cursor:pointer; color:#2b5fa8; }
  .promptbox pre { white-space:pre-wrap; font-size:10px; color:#555; max-height:260px; overflow:auto; background:#fafafc; padding:8px; border-radius:6px; }
  /* shared generated look */
  .stack { display:flex; flex-direction:column; gap:10px; }
  .row { display:flex; gap:10px; flex-wrap:wrap; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .card { border:1px solid #e2e2ea; border-radius:10px; padding:12px; }
  .eyebrow { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:#999; }
  .hd { margin:0; }
  .txt { margin:0; }
  .badge { display:inline-block; background:#eee; border-radius:20px; padding:2px 10px; font-size:12px; }
  .callout { background:#f0f4ff; border-left:4px solid #2b5fa8; padding:8px 12px; border-radius:6px; }
  .btn { position:relative; border:1px solid #ccc; background:#f7f7f7; border-radius:8px; padding:8px 14px; cursor:pointer; font-size:14px; }
  .ref { display:block; font-size:9px; color:#2b8a5f; margin-top:2px; }
  .field { display:flex; flex-direction:column; gap:4px; font-size:13px; }
  .field input { padding:8px; border:1px solid #ccc; border-radius:6px; }
  .unknown { color:#b00; font-size:11px; }
  /* COGNITIVE: single column, calm, spaced */
  .cognitive .surface { line-height:1.7; max-width:340px; }
  .cognitive .txt { letter-spacing:.01em; }
  /* MOTOR: big targets */
  .motor .btn { min-height:48px; min-width:48px; padding:14px 20px; font-size:16px; margin:2px; }
  .motor .surface { line-height:1.6; }
  /* VISUAL: high contrast, large */
  .visual .surface { background:#000; color:#fff; font-size:18px; }
  .visual .card { background:#000; border-color:#fff; }
  .visual .btn { background:#000; color:#ff0; border:2px solid #ff0; font-size:17px; }
  .visual .ref { color:#6f6; }
  .visual .callout { background:#111; color:#fff; border-color:#ff0; }
  .visual .eyebrow { color:#bbb; }
</style></head>
<body>
<header><h1>Perceptual Web — one messy page, three accessible rebuilds</h1>
<p>Generated live by gemini-3.5-flash from the dummy shop page. The green tags under buttons are preserved sourceRefs — that's what makes clicks proxy back to the real page.</p></header>
<div class="cols">{{COLS}}</div>
</body></html>"""


if __name__ == "__main__":
    main_run()
