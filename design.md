# Design — MovieMatch

A locked design system for the MovieMatch interface. Every page and component
uses this file as its visual source of truth. Product logic, routes, and data
behavior remain independent from this system.

## Genre

Editorial utility: film-journal typography with precise application controls.

## Macrostructure family

- Marketing pages: not currently applicable.
- App pages: Split Studio. Controls and context occupy one pane; evidence and
  results occupy the other. Mobile collapses to one ordered column.
- Content pages: Index-First if introduced later.

## Theme

- `--color-paper`: `oklch(96.5% 0.012 92)`
- `--color-paper-2`: `oklch(93.5% 0.015 92)`
- `--color-ink`: `oklch(18% 0.018 75)`
- `--color-ink-2`: `oklch(30% 0.016 78)`
- `--color-rule`: `oklch(83% 0.02 92)`
- `--color-accent`: `oklch(66% 0.17 145)`
- `--color-focus`: `oklch(35% 0.11 145)`

The palette is warm paper and charcoal ink with one projection-green signal.
Green is reserved for primary actions, active states, and meaningful success.

## Typography

- Display: Newsreader, weight 600–700, roman.
- Body: Outfit, weight 400–700.
- Mono: JetBrains Mono, weight 400–600, used only for compact metadata.
- Display tracking: `-0.03em`.
- Type scale anchor: `--text-display: clamp(2.75rem, 5vw + 0.5rem, 5.25rem)`.

## Spacing

Four-point named scale defined in `frontend/tokens.css`. Components use named
tokens or matching Tailwind scale values and avoid arbitrary one-off spacing.

## Motion

- Easings: `--ease-out`, `--ease-in`, and `--ease-in-out`.
- Page reveal: none. Content is present immediately.
- State feedback: opacity and transform only.
- Reduced-motion fallback: opacity-only, at most 150 ms.

## Microinteractions stance

- Successful visible actions are silent.
- Focus rings appear instantly.
- Buttons press by one pixel; cards do not float or glow.
- Loading motion is functional and exposes a readable status.

## CTA voice

- Primary CTA: green rectangular fill, concise action label.
- Secondary CTA: paper surface with charcoal rule and explicit destination.

## Per-page allowances

- App pages use no decorative enrichment; function carries the page.
- Film posters and user avatars are product data, not decoration.

## What pages MUST share

- MovieMatch wordmark.
- Warm paper, charcoal ink, and projection-green accent.
- Newsreader display and Outfit body typography.
- Eight-pixel inputs, twelve-pixel major surfaces, and one-pixel rules.
- Split Studio hierarchy and the same button/input state language.

## What pages MAY differ on

- Pane ratios based on workflow complexity.
- Result density: two columns for taste matches, three for single-film scouting.
- Presence of progress and export controls when the workflow requires them.

## Exports

### tokens.css

The canonical implementation is `frontend/tokens.css`.

### Tailwind v4 `@theme`

```css
@theme inline {
  --color-brand-dark: var(--color-paper);
  --color-brand-darker: var(--color-paper-2);
  --color-brand-card: var(--color-paper);
  --color-brand-cardHover: var(--color-paper-3);
  --color-brand-border: var(--color-rule);
  --color-brand-borderLight: var(--color-rule-2);
  --color-brand-muted: var(--color-muted);
  --color-brand-subtext: var(--color-neutral);
  --color-brand-text: var(--color-ink-2);
  --color-brand-green: var(--color-accent);
  --color-brand-greenHover: var(--color-accent-hover);
  --font-sans: var(--font-body);
  --font-display: var(--font-newsreader);
  --font-mono: var(--font-outlier);
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(96.5% 0.012 92)", "$type": "color" },
    "ink": { "$value": "oklch(18% 0.018 75)", "$type": "color" },
    "accent": { "$value": "oklch(66% 0.17 145)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Newsreader, Times New Roman, serif", "$type": "fontFamily" },
    "body": { "$value": "Outfit, Trebuchet MS, sans-serif", "$type": "fontFamily" },
    "outlier": { "$value": "JetBrains Mono, Lucida Console, monospace", "$type": "fontFamily" }
  },
  "space": {
    "sm": { "$value": "1rem", "$type": "dimension" },
    "md": { "$value": "1.5rem", "$type": "dimension" },
    "lg": { "$value": "2rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 96.5% 0.012 92;
  --foreground: 18% 0.018 75;
  --card: 96.5% 0.012 92;
  --card-foreground: 18% 0.018 75;
  --popover: 96.5% 0.012 92;
  --popover-foreground: 18% 0.018 75;
  --primary: 66% 0.17 145;
  --primary-foreground: 18% 0.025 145;
  --secondary: 93.5% 0.015 92;
  --secondary-foreground: 30% 0.016 78;
  --muted: 83% 0.02 92;
  --muted-foreground: 44% 0.018 82;
  --border: 83% 0.02 92;
  --input: 83% 0.02 92;
  --ring: 35% 0.11 145;
  --radius: 0.75rem;
}
```
