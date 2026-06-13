"""The custom A2UI catalog. Python mirror.

CUSTOMIZATION SEAM #4 (agent-side mirror) — Add an A2UI component.
See HACKATHON.md §4. When you add a component to
src/a2ui/catalog/definitions.ts (+ a renderer in renderers.tsx), add a
one-line summary of it to CATALOG_PROMPT below or the agent will never
emit it.

This must stay in sync with src/a2ui/catalog/definitions.ts. Only the
catalog ID and the component prop summary live here; the JSON Schema for each
component is owned by the frontend (it's where the renderers are).

The agent reads CATALOG_PROMPT to know which components exist and what they
accept; createSurface uses CATALOG_ID so the runtime resolves to our renderers.
"""

CATALOG_ID = "https://cpk-a2ui.local/catalogs/copilotkit/v1"

CATALOG_PROMPT = """\
## Available A2UI components. CopilotKit custom catalog

You may ONLY use the components listed here. Do not invent new component
types. All `id` values must be unique within the surface; exactly one
component must have `id: "root"`.

### Layout
- **Stack** { children: [ids] | { componentId, path }, gap?: xs|sm|md|lg|xl, align?: start|center|end|stretch }
    Vertical layout. The default container for surfaces and sections.
- **Row** { children: [ids], gap?: xs|sm|md|lg, justify?: start|center|end|spaceBetween, align?: start|center|end }
    Horizontal layout (wraps). Use for toolbars, metric rows, badge groups.
- **Grid** { children: [ids], columns?: 1-6, gap?: xs|sm|md|lg }
    Responsive grid. Use for stat-card rows and chart pairs.
- **Section** { title: string, eyebrow?: string, child: id }
    Titled section header + child container.
- **Card** { child: id, tone?: default|lilac|mint|warning }
    Bordered, padded surface. Pass a Stack/Row/Grid as child.
- **Divider** { }
    1px line.

### Content
- **Heading** { text: string|{path}, level?: "1"|"2"|"3" }
- **Text** { text: string|{path}, tone?: default|muted, size?: sm|md|lg, weight?: regular|medium|semibold }
- **Overline** { text: string|{path} }
    Tiny ALL-CAPS mono label above a heading. Also known as "overline" in typography.
- **Badge** { label: string|{path}, tone?: neutral|positive|warning|danger|info }
- **Callout** { body: string|{path}, title?: string|{path}, tone?: info|positive|warning|neutral }
    Block-level highlight for a key insight, definition, or warning. Use for "the takeaway" moments inside an explanation surface.
- **BulletList** { items: [string] | {path}, ordered?: bool }
    Bulleted or numbered list. Use for short enumerations like "three contributions" or "steps to reproduce".

### Data viz
- **StatCard** { label, value, delta?, deltaTone?: positive|negative|neutral, caption? }
    Single big-number metric.
- **BarChart** { data: [{label,value}], height?: 120-480 }
    Vertical bars. Use when labels are short (< 7 chars).
- **HorizontalBarChart** { data: [{label,value}], height?: 120-640 }
    Bars rendered as rows. Use for ranked lists with long labels (top customers, country names).
- **LineChart** { data: [{label,value}], height?: 120-480 }
    Trend where direction is the main signal.
- **DonutChart** { data: [{label,value}], height?: 120-480 }
    Share-of-total breakdown (3-6 slices).
- **ScatterChart** { data: [{x:number, y:number, label?}], xLabel?: string, yLabel?: string, height?: 160-560 }
    X/Y dots for correlation. Always provide xLabel and yLabel so the user knows what each axis is.
- **DataTable** { columns: [{key,label,align?}], rows: [record by column key] }

### Interactive (use only when the surface needs interactivity)
- **Button** { label, variant?: primary|secondary|ghost, action: { event: { name, context? } } }
- **ChoiceChips** { label, options: [{label,value}], value: {path}, multi?: bool }


### Rules
1. Exactly one component has id="root". Everything else must be reachable from root.
2. Repeating content uses `children: { componentId: "card-id", path: "/items" }`.
   Components INSIDE a List template use RELATIVE paths (no leading slash).
3. Chart `data` and DataTable `rows` may be inline arrays or `{ path: "/..." }`.
   When you pass `data` as a `{ path }` binding, populate that path via updateDataModel.
4. Inline values are preferred for everything else; do not use `{ path }`
   bindings on properties whose schema doesn't accept them.
5. Buttons must include an `action`. Action format:
   "action": { "event": { "name": "approve_plan", "context": { ... } } }
"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PERCEPTUAL WEB — accessibility component mirror (Builder A owns this).
#
# These are the accessibility-engineered components for the /perceptual agent.
# Builder C owns their frontend renderers (src/a2ui/catalog/definitions.ts +
# renderers.tsx); this is the agent-side prompt mirror so the generator knows
# they exist and what props they take. They share the SAME catalog id, so the
# runtime resolves them through the same renderer registry.
#
# IMPORTANT: kept SEPARATE from CATALOG_PROMPT above on purpose — the /fixed and
# /dynamic agents must NOT start emitting components whose renderers don't exist
# yet. The /perceptual generator composes CATALOG_PROMPT (the already-renderable
# floor) with this block; enable the accessible components for emission only
# once Builder C confirms their renderers are live (see PERCEPTUAL_USE_A11Y in
# perceptual_agent.py).
#
# Every INTERACTIVE accessible component carries a `sourceRef` (the bridge key
# from the ExtractedPage) and an `action` whose event drives proxying:
#   "action": { "event": { "name": "proxy_event",
#                          "context": { "sourceRef": "el-42",
#                                       "action": "click|navigate|input|submit",
#                                       "value"?: "..." } } }
# The side panel turns that context into a ProxyMessage (see CONTRACTS.md).
ACCESSIBLE_COMPONENTS_PROMPT = """\
## Perceptual Web accessibility components

Accessibility-engineered components. Prefer these over the generic catalog
components when building an accessible surface. Visual scale, contrast, and
focus styling come from the active theme mode — you do not set pixel sizes;
you choose the right component and the directives + theme do the rest.

### Content
- **AccessibleHeading** { text: string, level?: "1"|"2"|"3"|"4"|"5"|"6" }
    Semantic heading, large and high-contrast capable.
- **ReadableText** { text: string, size?: "md"|"lg"|"xl" }
    Body text at >=18pt with 1.5 line-height and increased letter/word spacing.

### Interactive (each carries sourceRef + a proxy_event action)
- **BigButton** { label: string, sourceRef: string, variant?: primary|secondary,
    action: { event: { name:"proxy_event", context:{sourceRef, action:"click"} } } }
    >=44x44px target, ample padding, thick high-contrast focus outline.
- **BigLink** { label: string, href?: string, sourceRef: string,
    action: { event: { name:"proxy_event", context:{sourceRef, action:"navigate"} } } }
    Link sized as a big target; navigates via the proxy.
- **BigInput** { label: string, sourceRef: string, inputType?: string,
    placeholder?: string,
    action: { event: { name:"proxy_event", context:{sourceRef, action:"input"} } } }
    Large hit area; label always visible ABOVE the field.
- **BigSelect** { label: string, sourceRef: string, options: [{label,value}],
    action: { event: { name:"proxy_event", context:{sourceRef, action:"input"} } } }
    Large select; label always visible above.
- **BigToggle** { label: string, sourceRef: string, checked?: bool,
    action: { event: { name:"proxy_event", context:{sourceRef, action:"input"} } } }
    Large checkbox/switch with generous tap area.

### Structure
- **FlatNav** { items: [{label, sourceRef, href?}] }
    A flattened list/grid of big nav buttons from a nested/hover menu. Each item
    proxies a navigate action on click.
- **StaticImageGrid** { images: [{alt, sourceRef?}] }
    Unpacks a carousel into a static, non-animated grid (vestibular-safe).
- **PaginatedList** { items: [id], pageSize?: number }
    Chunks long content with big Next/Previous buttons instead of infinite
    scroll.

Reuse **Callout** (from the main catalog) for inline static confirmations and
for "uncertain element — open original" flags (no popups, vestibular-safe).
"""
