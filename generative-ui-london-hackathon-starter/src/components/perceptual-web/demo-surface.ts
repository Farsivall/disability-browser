import { CATALOG_ID } from "@/a2ui/catalog";
import type { A2UIOp } from "@/a2ui/surface-bus";
import type { PerceptualTheme } from "@/a2ui/perceptual-theme";
import type { NeedProfileId } from "@/a2ui/need-inference";

const SURFACE_ID = "perceptual-main";

function envelope(
  theme: PerceptualTheme,
  components: unknown[],
): A2UIOp[] {
  return [
    { createSurface: { surfaceId: SURFACE_ID, catalogId: CATALOG_ID } },
    {
      updateDataModel: {
        surfaceId: SURFACE_ID,
        value: { perceptualTheme: theme },
      },
    },
    { updateComponents: { surfaceId: SURFACE_ID, components } },
  ];
}

/** Demo surface — cognitive profile (command 1) */
export function buildDemoCognitiveSurface(): A2UIOp[] {
  return buildDemoSurfaceForProfiles(["cognitive"], {
    textScale: "large",
    spacing: "cognitive",
    focusStyle: "emphasized",
  });
}

/** Build demo layout reflecting accumulated need-profiles (offline refinement) */
export function buildDemoSurfaceForProfiles(
  profiles: NeedProfileId[],
  themeOverride?: Partial<PerceptualTheme>,
): A2UIOp[] {
  const hasMotor = profiles.includes("motor");
  const hasVisual = profiles.includes("visual");
  const hasEssentialist = profiles.includes("essentialist");
  const hasCognitive = profiles.includes("cognitive");

  const theme: PerceptualTheme = {
    textScale: hasCognitive || hasVisual ? "large" : "default",
    spacing: hasCognitive || hasEssentialist ? "cognitive" : "default",
    focusStyle: hasMotor || hasVisual ? "emphasized" : "default",
    contrast: hasVisual || hasEssentialist ? "high" : "default",
    hideDecorations: hasVisual || hasEssentialist,
    reduceMotion: profiles.includes("vestibular"),
    ...themeOverride,
  };

  if (hasEssentialist || (hasVisual && profiles.length >= 2)) {
    return envelope(theme, [
      {
        id: "root",
        component: "Stack",
        gap: "md",
        children: ["h1", "price", "cta"],
      },
      {
        id: "h1",
        component: "AccessibleHeading",
        level: "1",
        size: "xlarge",
        text: "Wireless Headphones",
        sourceRef: "product-title",
      },
      {
        id: "price",
        component: "ReadableText",
        text: "Deal price: £149.99 — essentials only, high contrast.",
        sourceRef: "price-deal",
      },
      {
        id: "cta",
        component: "BigButton",
        label: "Add to Cart",
        sourceRef: "btn-add-to-cart",
        variant: "primary",
      },
    ]);
  }

  if (hasMotor) {
    return envelope(theme, [
      {
        id: "root",
        component: "Stack",
        gap: "lg",
        children: ["h1", "intro", "nav", "actions"],
      },
      {
        id: "h1",
        component: "AccessibleHeading",
        level: "1",
        size: "xlarge",
        text: "Wireless Headphones — motor-friendly",
        sourceRef: "product-title",
      },
      {
        id: "intro",
        component: "ReadableText",
        text: "Large touch targets throughout. Navigation flattened to big buttons.",
        sourceRef: "product-desc",
      },
      {
        id: "nav",
        component: "FlatNav",
        items: [
          { label: "Home", sourceRef: "nav-home" },
          { label: "Shop", sourceRef: "nav-shop" },
          { label: "Headphones", sourceRef: "nav-headphones" },
          { label: "News", sourceRef: "nav-news" },
          { label: "Deals", sourceRef: "nav-deals" },
        ],
      },
      {
        id: "actions",
        component: "Stack",
        gap: "sm",
        children: ["cta1", "cta2", "cta3"],
      },
      {
        id: "cta1",
        component: "BigButton",
        label: "Add to Cart",
        sourceRef: "btn-add-to-cart",
        variant: "primary",
      },
      {
        id: "cta2",
        component: "BigButton",
        label: "Buy Now",
        sourceRef: "btn-buy-now",
        variant: "secondary",
      },
      {
        id: "cta3",
        component: "BigButton",
        label: "Select Size L",
        sourceRef: "size-l",
        variant: "secondary",
      },
    ]);
  }

  return envelope(theme, [
    {
      id: "root",
      component: "Stack",
      gap: "md",
      children: ["h1", "intro", "nav", "cta"],
    },
    {
      id: "h1",
      component: "AccessibleHeading",
      level: "1",
      size: "xlarge",
      text: "Wireless Headphones — simplified view",
      sourceRef: "product-title",
    },
    {
      id: "intro",
      component: "ReadableText",
      text: "Decluttered single column. Large text. Sidebar and ads removed.",
      sourceRef: "product-desc",
    },
    {
      id: "nav",
      component: "FlatNav",
      items: [
        { label: "Home", sourceRef: "nav-home" },
        { label: "Shop", sourceRef: "nav-shop" },
        { label: "News", sourceRef: "nav-news" },
      ],
    },
    {
      id: "cta",
      component: "BigButton",
      label: "Add to Cart",
      sourceRef: "btn-add-to-cart",
      variant: "primary",
    },
  ]);
}

/** Scripted demo commands for TEST C6 / C7 */
export const DEMO_REFINEMENT_COMMANDS = [
  "Too much going on, text's too small",
  "I also can't click small things",
  "Just show me the essentials with high contrast",
] as const;
