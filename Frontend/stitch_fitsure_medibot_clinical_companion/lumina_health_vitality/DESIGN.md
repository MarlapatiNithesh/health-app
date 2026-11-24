---
name: Lumina Health & Vitality
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#4953bc'
  on-secondary: '#ffffff'
  secondary-container: '#8792fe'
  on-secondary-container: '#17228f'
  tertiary: '#00668a'
  on-tertiary: '#ffffff'
  tertiary-container: '#19aee8'
  on-tertiary-container: '#003e55'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#e0e0ff'
  secondary-fixed-dim: '#bdc2ff'
  on-secondary-fixed: '#000767'
  on-secondary-fixed-variant: '#2f3aa3'
  tertiary-fixed: '#c4e7ff'
  tertiary-fixed-dim: '#7bd0ff'
  on-tertiary-fixed: '#001e2c'
  on-tertiary-fixed-variant: '#004c69'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
  metric-numeral:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.03em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  margin: 1rem
  margin-md: 2rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
This design system marries high-precision clinical utility with soft-tactile, calming wellness aesthetics. Drawing inspiration from modern iOS design standards, the sleek utilitarian focus of Linear, and contemporary frosted glassmorphism, it evokes clarity, organic vitality, reassurance, and modern sophistication. 

The target audience consists of health-conscious individuals, patients tracking vitals, and wellness practitioners who demand both analytical accuracy and an inviting, anxiety-reducing digital environment. The visual style relies on:
- Layered translucent panels (`rgba(255, 255, 255, 0.82)`) with high-diffusion backdrop blurs.
- Soft, organic container forms featuring sweeping 24px–32px corner radiuses.
- Deep, tactile inner-light highlights mimicking curved acrylic sheets and molded resin pills.
- Restrained, crisp information hierarchy: compact micro-badges, clean circular progress dials, and soft pill toggles that keep complex biometric data approachable.

## Colors
The color architecture combines a serene clinical canvas with energizing botanical and physiological accent tones.

### Canvas & Glass Surfaces
- **Canvas Base:** `#F8FAFC` to `#F1F5F9` subtle gradient, creating a pristine, glare-free backdrop.
- **Glass Panel Surface:** `rgba(255, 255, 255, 0.85)` with `backdrop-filter: blur(20px)`.
- **Raised Card Surface:** `#FFFFFF` with soft tinted boundary rings.
- **Glass Rim Highlight:** `rgba(255, 255, 255, 0.65)` on top and left borders, and `rgba(15, 23, 42, 0.04)` on the bottom perimeter.

### Semantic & Metric Palette
- **Vital Mint (Primary):** `#10B981` (interactive / base) paired with `#A3E635` and `#86EFAC` for recovery, steps, metabolic targets, and positive delta indicators.
- **Neural Lavender (Secondary):** `#818CF8` and `#A78BFA` for circadian rhythms, focus, sleep stages, and active navigation tab accents.
- **Hydration Sky (Tertiary):** `#38BDF8` and `#06B6D4` for respiratory telemetry, water intake, and cool status containers.
- **Vital Ember (Warning / Cardiac):** `#F43F5E` paired with `#F59E0B` for active heart rate spikes, calorie deficits, and urgent notifications.

### Text & Contrast Hierarchy
- **Text Primary:** `#0F172A` (deep slate navy, eliminating pure black harshness).
- **Text Secondary:** `#475569` for meta-labels, sub-headers, and unit markers.
- **Text Muted:** `#94A3B8` for axis keys and placeholder icons.

## Typography
Plus Jakarta Sans serves across all typographic tiers, leveraging its refined geometric structure and gentle, organic terminals to align with healthcare legibility and modern digital ergonomics.

- **Numerals & Metrics:** Large biometric readouts (calories, step counts, BPM) utilize `metric-numeral` or `display-lg` with tight tracking (`-0.03em`) and tabular figure settings (`tnum`) to keep rapidly updating figures jitter-free.
- **Labels & Micro-data:** Micro-metrics, timestamps, and metric units ("kcal", "glass", "bpm") are styled using `label-md` or `label-sm`, always set in medium or semi-bold weights to guarantee high contrast over frosted background plates.

## Layout & Spacing
The layout model employs a flexible, card-modular system centered on an 8px base rhythm.

### Grid & Density
- **Mobile Handheld:** 4-column fluid layout with `1rem` outer canvas padding and `1rem` gutters. Elements snap into full-width metric summaries or 2-column square biometric cards.
- **Tablet / Split Screen:** 8-column layout with `1.5rem` outer margins.
- **Desktop / Dashboard:** 12-column grid capped at `1280px` max-width, with `2rem` to `3rem` canvas margins and generous `1.5rem` gutters.

### Spacing Behaviors
- **Component Interiors:** Metric cards adopt `space-lg` (24px) for master summary tiles and `space-md` (16px) for compact parameter nodes.
- **Element Stacking:** Vertical flow relies on `space-md` between related cards and `space-xl` (32px) between autonomous diagnostic sections.

## Elevation & Depth
Depth is produced through subtle translucent light displacement rather than opaque, muddy dropshadows.

### The Glass & Tactile Stack
1. **Level 0 (App Shell):** Ultra-light tint (`#F8FAFC`) with soft, diffused radial color blooms (`#E0F2FE` and `#DCFCE7`) placed in the background to illuminate overlapping frosted panels.
2. **Level 1 (Docked & Standard Cards):** Frosted glass panels (`rgba(255, 255, 255, 0.85)`) with `backdrop-filter: blur(20px)`, an ambient shadow of `0 10px 30px -10px rgba(15, 23, 42, 0.05)`, and a hairline outer stroke (`1px solid rgba(255, 255, 255, 0.8)`).
3. **Level 2 (Tactile Accents & Floating Modals):** Semi-opaque tinted metric pods (e.g. lavender progress slabs or lime alert headers). Layered with `box-shadow: 0 14px 34px -8px rgba(99, 102, 241, 0.22)` and a soft white inset glow (`inset 0 1px 1px 0 rgba(255, 255, 255, 0.6)`) to convey physical, injection-molded acrylic tactility.
4. **Level 3 (Floating Bars & Navigation Pills):** Suspended pill tabs with dual-tone ambient shadows (`0 20px 40px -12px rgba(15, 23, 42, 0.12)`) and edge refraction borders.

## Shapes
A soft, pill-forward shape hierarchy (`roundedness: 3`) defines the entire visual language.

- **Primary Cards & Panels:** Bound by `rounded-3xl` (24px to 32px), eliminating sharp angles to reinforce wellness, comfort, and physical touch.
- **Interactive Controls & Toggles:** Pill forms (`rounded-full`, 9999px) are standard for action buttons, segment switchers, tag badges, and navigation bars.
- **Metric Rings & Gauge Endcaps:** Progress loops, chart endpoints, and graph tracks utilize rounded caps (`stroke-linecap: round`) to preserve geometric continuity.

## Components

### Buttons & Interactive Pills
- **Primary Pill Action:** Pill-shaped (`rounded-full`), rendered in vivid gradient mint (`linear-gradient(135deg, #10B981 0%, #059669 100%)`) or electric lavender (`linear-gradient(135deg, #818CF8 0%, #6366F1 100%)`). Text is crisp white `label-lg`, accompanied by an ambient drop shadow matched to the button's hue.
- **Segmented Glass Pill Switcher:** A container of `rgba(241, 245, 249, 0.7)` holding a sliding `rounded-full` white or saturated purple pill that glides smoothly between active states (e.g., "Kcal", "Water", "Steps").

### Progress Rings & Visual Data Gauges
- **Circular Telemetry Rings:** 8px–12px stroke widths with smooth background tracks in `rgba(15, 23, 42, 0.05)`. Active strokes feature vibrant gradients (e.g., mint-to-lime or sky-to-cyan) with centered bold numbers (`metric-numeral`) and small muted unit labels directly underneath.
- **Biometric Bar Graphs:** Slender vertical capsules with rounded caps. Background fill uses low-opacity tint (`rgba(16, 185, 129, 0.12)`), while completed values are filled with vibrant solid color or vertical gradients.

### Metric Cards & Containers
- **Vitals Card:** Built with `rounded-3xl` corners, frosted backdrop, and dual-layer structure. Top left displays an icon badge housed in an off-white circular inset; top right houses optional micro-steppers or status dots. The center highlights the core scalar value followed by small trend tags (+3.8%).
- **Gradient Progress Highlight Card:** Full-bleed saturated card (Lavender `#818CF8` or Mint `#A3E635`) overlaid with subtle, rhythmic geometric wave vector lines at 15% opacity to add visual depth behind the white typography.

### Input Fields & Controls
- **Search & Data Inputs:** Enclosed in continuous pill contours (`rounded-full`) with surface color `#FFFFFF` or `rgba(255, 255, 255, 0.75)`. Inactive border is `1px solid rgba(148, 163, 184, 0.2)`. Focus shifts border to `#10B981` accompanied by a 3px soft mint glow (`rgba(16, 185, 129, 0.15)`).
- **Checkmarks & Radio Elements:** Circular pods featuring a micro-inset drop shadow. When checked, they fill with solid `#10B981` or `#818CF8` displaying an ultra-clean white glyph.

### Badges & Micro-tags
- **Status Pills:** Compact inline tokens with `rounded-full` geometry, `0.25rem 0.65rem` padding, `label-sm` font weight, and muted pastel backgrounds matched to high-contrast foreground text (e.g., `rgba(16, 185, 129, 0.15)` background with `#047857` text).