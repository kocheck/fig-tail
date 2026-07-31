# fig-tail

Tailwind class names in Figma Dev Mode, resolved against your real Tailwind config.

A designer drops the team's `tailwind.config.js` (v3) or `app.css` (v4) into the
plugin once. Developers install fig-tail and, in Dev Mode, see real classes —
`bg-brand-500`, `p-6`, `rounded-lg` — next to Figma's CSS. No CLI required for
day-to-day use.

## Installing the plugin

1. Clone this repo and install dependencies:

```bash
corepack enable
pnpm install
pnpm --filter @fig-tail/plugin build
```

2. Open the **Figma desktop app** (browser install cannot load local manifests).
3. Menu: **Plugins → Development → Import plugin from manifest…**
4. Select `packages/plugin/manifest.json`.
5. Open a file → run **fig-tail** from Plugins (design) or switch to **Dev Mode**
   and pick **Tailwind CSS** in the Code section / Inspect panel.

### First-time config

1. In design mode, run the plugin (or use **Configure Tailwind…** from the
   codegen preferences menu in Dev Mode).
2. Drop `tailwind.config.js` / `.ts` or a v4 CSS file.
3. Optionally drop `package.json` so an exact `tailwindcss` version can confirm
   bundled defaults.
4. Click **Resolve**, review warnings, then **Save on file** (shared) or
   **Save personal** (per-user fallback; no edit access required).

Raw source is discarded after resolve. Only the token set is stored.

## What fig-tail can read from your Tailwind config

**v3 (JS/TS)**

- Plain `theme` / `theme.extend` objects, nested colours (`brand.500` → `brand-500`)
- `require('tailwindcss/defaultTheme'|'/colors'|'/defaultConfig')` and ESM imports
  of those same modules
- Spreads of statically known arrays/objects
- TypeScript configs after a bounded pre-pass (`import type`, annotations, `satisfies`)

**Not evaluated (reported, not guessed)**

- Function-valued theme keys
- External presets / plugins / local modules outside the known-module table
- Dynamic expressions, conditionals, computed keys

**Safe-fallback rule:** an unreadable *replacing* `theme.colors` marks colours
**unknown** (raw values only). An unreadable *extend* keeps confirmed defaults
when an exact Tailwind version was supplied.

**v4 (CSS)**

- `@theme` / `@theme inline` / `@theme static` custom properties
- `--color-*: initial` and bare `--*: initial` resets
- `var()` aliases between theme entries
- `--spacing` multiplier vs named `--spacing-*`
- `@config` when the referenced JS file is also provided
- Missing `@import`s are reported so setup can ask for the file

**Version evidence:** only an exact `x.y.z` in `package.json` confirms bundled
defaults. Ranges and same-major guesses are rejected.

## Optional CLI escape hatch

For configs the in-plugin resolver cannot fully evaluate:

```bash
pnpm --filter @fig-tail/cli build
node packages/cli/dist/cli.js export \
  --entry tailwind.config.js \
  --out fig-tail.tokens.json \
  --package-json package.json \
  --trust-project
```

The `--trust-project` flag is required. Import the JSON via plugin setup when
offered (plan 009).

## Packages

| Package | Role |
|---|---|
| `@fig-tail/theme` | In-browser Tailwind theme resolver |
| `@fig-tail/match` | CSS → class matching + confidence ladder |
| `@fig-tail/plugin` | Figma plugin (not published) |
| `@fig-tail/cli` | Optional trusted-checkout exporter |

## Development

```bash
pnpm check   # typecheck + lint + build + test
```

## Licence

MIT
