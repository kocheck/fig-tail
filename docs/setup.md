# Setup guide

## Install from source (team demo)

1. `corepack enable && pnpm install`
2. `pnpm --filter @fig-tail/plugin build`
3. Figma desktop → **Plugins → Development → Import plugin from manifest…**
4. Choose `packages/plugin/manifest.json`

## Designer: save a Tailwind config

1. Run **fig-tail** in the design editor (or **Configure Tailwind…** from Dev Mode codegen preferences).
2. Drop `tailwind.config.js` / `.ts` or a v4 CSS entry, plus `package.json` when you have an exact `tailwindcss` version.
3. Click **Resolve**, read unresolved warnings, then **Apply to file** (shared) or **Save personally**.
4. Raw source is discarded — only the resolved token set is stored.

## Developer: read classes

1. Open the file in **Dev Mode**.
2. Code section → language **Tailwind CSS**, or open fig-tail in the **Inspect** panel.
3. Select a layer. Copy the class string. Near-misses appear as notes, never as invented tokens.

## Config tiers

| Tier | When | Label |
|---|---|---|
| Document | Shared private plugin data on the file | Using the config saved on this file |
| Personal | Your clientStorage fallback | Using your personal config — this file has no shared one |
| None | No config | Generic arbitrary suggestions + Add your config |

## Designer tools

- **Lint drift** — page/selection scan for nearest / off-system / unbound findings (read-only).
- **Stamp dry-run / Apply** — opt-in WEB code-syntax keys on local variables (design editor only; confirm dialog; undo via Figma).
- **Export subtree** — HTML / JSX / outline skeletons with classNames (also via codegen preference).
