# fig-tail

Tailwind class names in Figma Dev Mode, resolved against your real Tailwind config.

A designer drops the team's `tailwind.config.js` (v3) or `app.css` (v4) into the
plugin once. Developers install fig-tail and, in Dev Mode, see real classes —
`bg-brand-500`, `p-6`, `rounded-lg` — next to Figma's CSS. Install the plugin;
nothing else.

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

Config source tiers (always labelled in the UI):

1. **Document** — shared private plugin data on the file
2. **Personal** — your `clientStorage` copy when the file has no shared config
3. **None** — generic arbitrary-value suggestions until you add a config

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
when an exact Tailwind version was supplied. Unreadable named tokens are never
invented — fig-tail prefers labelled raw values over a wrong class name.

**v4 (CSS)**

- `@theme` / `@theme inline` / `@theme static` custom properties
- `--color-*: initial` and bare `--*: initial` resets
- `var()` aliases between theme entries
- `--spacing` multiplier vs named `--spacing-*`
- `@config` when the referenced JS file is also provided
- Missing `@import`s are reported so setup can ask for the file

**Version evidence:** only an exact `x.y.z` in `package.json` confirms bundled
defaults. Ranges and same-major guesses are rejected.

## Packages

| Package | Role |
|---|---|
| `@fig-tail/theme` | In-browser Tailwind theme resolver |
| `@fig-tail/match` | CSS → class matching + confidence ladder |
| `@fig-tail/plugin` | Figma plugin (not published to npm) |

## Development

```bash
pnpm check   # typecheck + lint + build + test
```

See [docs/setup.md](docs/setup.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Drift linter (designers)

**Lint drift** scans the selection or page (read-only) and groups:

| Finding | Meaning | What to do |
|---|---|---|
| nearest | Value is close to a token but not exact | Nudge the fill/spacing to the token |
| off-system | Arbitrary value emitted | Bind to a token or accept raw |
| unbound | Variable binding could not be resolved | Relink library / check access |
| unmapped-variable | Stale or conflicting code syntax | Re-run stamp dry-run |
| drift | Unsupported / none | Review manually |

Export the Markdown table from the Tools panel for reviews.

## Licence

MIT
