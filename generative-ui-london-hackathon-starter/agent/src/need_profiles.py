"""The five accessibility need-profiles, encoded as structured data.

This is what makes generation RELIABLE instead of the LLM improvising. A
user's free-text need ("too much going on, text's too small") maps to one or
more profile ids; each profile carries concrete, deterministic directives that
get injected verbatim into the generation prompt.

Keep these as DATA, not prose buried in a prompt — so they are testable
(assert MOTOR always yields big-target directives), tweakable (one place), and
composable (a need can select several profiles; we merge their directives).

Grounded in real accessibility practice. See CAUTION below re: dyslexia fonts.
"""
from __future__ import annotations

from dataclasses import dataclass

# Stable profile ids. Use these strings everywhere (mapping output, tests).
VISUAL = "VISUAL"
COGNITIVE = "COGNITIVE"
MOTOR = "MOTOR"
VESTIBULAR = "VESTIBULAR"
ESSENTIALIST = "ESSENTIALIST"

PROFILE_IDS = [VISUAL, COGNITIVE, MOTOR, VESTIBULAR, ESSENTIALIST]


@dataclass(frozen=True)
class Profile:
    """One accessibility profile.

    `directives` are concrete, imperative generation rules. They are dropped
    into the generation prompt as-is, so write them as instructions to the
    model, not descriptions of the user.
    """

    id: str
    title: str
    description: str  # what kind of user/need this serves (for the mapper + humans)
    directives: list[str]


PROFILES: dict[str, Profile] = {
    VISUAL: Profile(
        id=VISUAL,
        title="Visual / Perceptual",
        description=(
            "Low vision, astigmatism, colour blindness. The user struggles to "
            "see small, low-contrast, or visually noisy content."
        ),
        directives=[
            "Render all body text at >=18pt and headings proportionally larger.",
            "Keep navigation proportionate and in view — do NOT merely zoom the "
            "whole page; rebuild it at a readable scale.",
            "Rebuild in strict high-contrast monochrome (e.g. white text on near-"
            "black) using the high-contrast theme mode.",
            "Remove decorative images, gradients, shadows, and background imagery "
            "that interfere with text boundaries.",
            "Give the active/focused interactive element a thick high-contrast "
            "focus outline (e.g. 4px solid yellow on black).",
            "Ensure every control has a visible text label; never rely on colour "
            "or icon alone to convey meaning.",
        ],
    ),
    COGNITIVE: Profile(
        id=COGNITIVE,
        title="Cognitive / Reading",
        description=(
            "Dyslexia, ADHD, reading or attention difficulty. The user is "
            "overwhelmed by clutter and dense text."
        ),
        directives=[
            "Lay out content as a SINGLE centered column; remove sidebars, "
            "related-item rails, ads, and floating widgets.",
            "Remove autoplay video, newsletter popups, cookie banners, and any "
            "non-essential interruption.",
            "Set line-height to ~1.5 and increase letter and word spacing for "
            "comfortable reading.",
            "Break content with clear semantic headings (one h1, then h2s) so the "
            "structure is scannable.",
            "Keep paragraphs short; prefer bullet lists for enumerations.",
            "Offer a readability font as an OPTIONAL choice — do not force it; "
            "lead the experience on spacing, contrast, and layout (see CAUTION).",
        ],
    ),
    MOTOR: Profile(
        id=MOTOR,
        title="Motor",
        description=(
            "Tremor, limited dexterity, switch or eye-tracking users. The user "
            "cannot reliably hit small or closely-spaced targets."
        ),
        directives=[
            "Regenerate EVERY interactive element (buttons, links, inputs, "
            "toggles) at >=44x44 CSS px with ample padding and spacing between "
            "targets.",
            "Flatten nested or hover-activated navigation into a flat, static "
            "list or grid of large buttons — no hover-only menus.",
            "Replace infinite scroll with pagination: chunk content and provide "
            "large Next / Previous buttons.",
            "Space interactive elements generously so adjacent targets are not "
            "easily mis-tapped.",
        ],
    ),
    VESTIBULAR: Profile(
        id=VESTIBULAR,
        title="Neurological / Vestibular",
        description=(
            "Motion sickness, vestibular disorders, photosensitive seizures. "
            "The user is harmed by motion and unexpected change."
        ),
        directives=[
            "Use STATIC components only — no animation, autoplay, parallax, or "
            "transitions.",
            "Unpack carousels and sliders into a static grid showing items at "
            "once.",
            "Keep layout anchored and predictable — no layout jumps, no animated "
            "popups or modals.",
            "Confirmations are inline static text changes, never toasts or "
            "animated overlays.",
        ],
    ),
    ESSENTIALIST: Profile(
        id=ESSENTIALIST,
        title="Essentialist",
        description=(
            "A synthetic 'just show me X' profile. The user wants only the one "
            "task or piece of content they named, nothing else."
        ),
        directives=[
            "Strip the page to the single task or content the user named plus the "
            "minimum controls needed to complete it.",
            "Remove everything not required for that task — secondary content, "
            "promotions, navigation not needed for the task.",
            "When the user names a focus (e.g. 'just the article', 'the real "
            "price'), make that the sole subject of the surface.",
        ],
    ),
}


# The honesty hedge for the pitch and the prompt. The evidence that specialised
# dyslexia fonts (OpenDyslexic) beat plain sans-serifs is MIXED; spacing,
# contrast, touch-target size, and de-cluttering are on much firmer ground.
CAUTION = (
    "Specialised dyslexia fonts have mixed evidence. Offer a readability font "
    "as a user choice, but lead with spacing, contrast, touch-target size, and "
    "de-cluttering — those are well supported."
)


# Theme presets per profile — EXACT mirror of PROFILE_THEME_PRESETS in
# src/a2ui/perceptual-theme.ts. The agent writes the merged result to the A2UI
# data model at "/perceptualTheme"; Builder C's PerceptualSurface reads it and
# applies the matching CSS (contrast/text-scale/spacing/motion/etc.). Keeping
# this server-side makes the visual transform deterministic, not LLM-dependent.
THEME_PRESETS: dict[str, dict] = {
    VISUAL: {
        "contrast": "high",
        "textScale": "large",
        "focusStyle": "emphasized",
        "hideDecorations": True,
    },
    COGNITIVE: {
        "textScale": "large",
        "spacing": "cognitive",
        "readableFont": False,
    },
    MOTOR: {
        "focusStyle": "emphasized",
        "textScale": "default",
    },
    VESTIBULAR: {
        "reduceMotion": True,
    },
    ESSENTIALIST: {
        "contrast": "high",
        "spacing": "cognitive",
    },
}


def theme_for(ids: list[str]) -> dict:
    """Merge the theme presets of the selected profiles into one PerceptualTheme
    dict (later profiles override earlier on conflicts). Unknown ids are ignored.
    """
    merged: dict = {}
    for pid in normalize_ids(ids):
        merged.update(THEME_PRESETS.get(pid, {}))
    return merged


def get_profile(profile_id: str) -> Profile | None:
    """Look up a profile by id (case-insensitive)."""
    return PROFILES.get(profile_id.strip().upper())


def normalize_ids(ids: list[str]) -> list[str]:
    """Filter/normalize a list of profile ids to known ones, de-duplicated and
    in canonical PROFILE_IDS order. Unknown ids are dropped silently so a noisy
    mapper response can't break generation.
    """
    upper = {i.strip().upper() for i in ids if isinstance(i, str)}
    return [pid for pid in PROFILE_IDS if pid in upper]


def directives_for(ids: list[str], focus: str | None = None) -> str:
    """Build the directive block injected into the generation prompt.

    Merges the directives of the selected profiles (deduped, profile-labelled,
    in canonical order). If an ESSENTIALIST focus is supplied it is surfaced at
    the top so the model treats it as the primary subject. Falls back to
    COGNITIVE if no known profiles were selected (a sensible safe default — a
    decluttered single column rarely hurts).
    """
    selected = normalize_ids(ids)
    if not selected:
        selected = [COGNITIVE]

    lines: list[str] = []
    if focus:
        lines.append(f"PRIMARY FOCUS (essentialist): {focus}\n")

    for pid in selected:
        profile = PROFILES[pid]
        lines.append(f"## {profile.title} directives")
        lines.extend(f"- {d}" for d in profile.directives)
        lines.append("")  # blank line between profiles

    lines.append(f"NOTE: {CAUTION}")
    return "\n".join(lines).strip()


def mapper_profile_menu() -> str:
    """A compact menu of profile ids + descriptions for the need-mapper prompt,
    so the mapping LLM knows exactly which ids it may choose and what each means.
    """
    return "\n".join(
        f"- {p.id}: {p.title} — {p.description}" for p in PROFILES.values()
    )
