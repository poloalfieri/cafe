# Design System (Minimal & Neutral)

## Palette Tokens
- `--color-background`: App background
- `--color-card`: Surfaces and panels
- `--color-text`: Primary text
- `--color-muted-foreground`: Secondary text
- `--color-border`: Dividers and borders
- `--color-primary`: Primary actions
- `--color-secondary`: Subtle surfaces
- `--color-accent`: Highlights

These are defined in `frontend/styles/globals.css` and consumed via Tailwind tokens:
- `bg-background`, `bg-card`, `bg-secondary`
- `text-text`, `text-muted-foreground`
- `border-border`
- `bg-primary`, `hover:bg-primary-hover`

## Typography
- Headings: bold, neutral (`text-text`)
- Body: regular, `text-muted-foreground` for secondary
- Avoid ad‑hoc color classes like `text-gray-*`

## Surfaces & Borders
- Panels: `bg-card` + `border-border` + `shadow-sm`
- Page background: `bg-background`

## Buttons
- Primary: `bg-primary` + `hover:bg-primary-hover` + `text-white`
- Secondary/ghost: `bg-secondary` or `hover:bg-secondary`

## Status/Alerts
- Use `text-destructive` only for errors
- Keep status chips minimal; prefer neutral styling unless critical

## Rules of Use
1. Avoid raw color classes (`text-gray-*`, `bg-red-*`).
2. Always use theme tokens for backgrounds, borders, and text.
3. Keep accents limited to primary actions and key highlights.
