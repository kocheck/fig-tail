# Setup guide

## Install from source (team demo)

Use the Figma **desktop** app — browser install cannot load local manifests.

1. `corepack enable && pnpm install`
2. `pnpm --filter @fig-tail/plugin build`
3. Figma → **Plugins → Development → Import plugin from manifest…**
4. Choose `packages/plugin/manifest.json`

Community install (when published) replaces steps 1–4 with “Install” from the
listing. Same Dev Mode paths afterwards.

## Designer: save a Tailwind config

1. Run **fig-tail** in the design editor (or **Configure Tailwind…** from Dev Mode codegen preferences).
2. Drop:
   - **v3:** `tailwind.config.js` / `.ts`
   - **v4:** CSS entry with `@theme` / `@theme inline` / `@theme static`
   - Optionally `package.json` with an exact `tailwindcss` version (`x.y.z`)
3. Click **Resolve**, read unresolved warnings, then **Save on file** (shared) or **Save personal**.
4. Raw source is discarded — only the resolved token set is stored. No CLI for normal setup.

### Keeping config fresh

Re-run setup after theme changes. Stale tokens produce nearest / off-system drift
and more arbitrary values. Prefer document save so collaborators share one source.

### Monorepos

Drop the config file that actually defines your design tokens (often a package
under `packages/…`), not a root stub that only re-exports. If `@config` (v4)
points at a JS file, provide that file too.

## Developer: read classes

1. Open the file in **Dev Mode**.
2. Code section → language **Tailwind CSS**, or open fig-tail in the **Inspect** panel.
3. Select a layer. Copy the class string. Near-misses appear as notes, never as invented tokens.

## Config tiers

| Tier | When | Label |
|---|---|---|
| Document | Shared private plugin data on the file | Using the config saved on this file |
| Personal | Your clientStorage fallback (view-only seats welcome) | Using your personal config — this file has no shared one |
| None | No config | Generic arbitrary suggestions + Add your config |

## What the resolver can read

**v3 (JS/TS)** — plain `theme` / `theme.extend`, nested colours, known
`tailwindcss/defaultTheme|colors|defaultConfig` requires/imports, static spreads,
bounded TypeScript pre-pass.

**Not evaluated** — function-valued theme keys, external presets/plugins/local
modules outside the known table, dynamic expressions / conditionals / computed keys.

**v4 (CSS)** — `@theme` variants, `--color-*: initial` resets, `var()` aliases,
`--spacing` multiplier vs named `--spacing-*`, `@config` when the JS file is also provided.

**Version evidence:** only exact `x.y.z` in `package.json` confirms bundled defaults.

## Designer tools

- **Lint drift** — page/selection scan for nearest / off-system / unbound findings (read-only).
- **Stamp dry-run / Apply** — opt-in WEB code-syntax keys on local variables (design editor only for Apply; confirm dialog; undo via Figma).
- **Export subtree** — HTML / JSX / outline skeletons with classNames (also via codegen preference).
