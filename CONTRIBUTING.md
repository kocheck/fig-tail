# Contributing

## Package layout

| Path | Role |
|---|---|
| `packages/theme` | Tailwind v3/v4 theme resolver (`@fig-tail/theme`) |
| `packages/match` | CSS → class matching (`@fig-tail/match`) |
| `packages/plugin` | Figma plugin (private; not published to npm) |
| `packages/cli` | Out of ship scope (plan 009 REJECTED) — do not publish |

## Local setup

```bash
corepack enable
pnpm install
pnpm check
```

Plugin tests rebuild before Vitest. Match coverage thresholds are enforced.

### Run the plugin locally

Figma **desktop** app required (browser cannot load local manifests):

1. `pnpm --filter @fig-tail/plugin build`
2. **Plugins → Development → Import plugin from manifest…**
3. Select `packages/plugin/manifest.json`

## Rules (non-negotiable)

Write-safety is an invariant (plans 003 and 007), not a lint curiosity:

1. Never write the Figma document except:
   - `figma.root.setPluginData` under `figtail.*` keys (config storage)
   - `Variable.setVariableCodeSyntax('WEB', …)` from `packages/plugin/src/stamp/apply.ts`
2. Never assign `variable.name`.
3. Never `eval` / `new Function` user config in the plugin.
4. No network — manifest `allowedDomains: ["none"]`.
5. Never emit a named token class the config does not confirm.
6. Never fall back silently — label every degradation.
7. No secrets in the repo.

## Plans

Numbered plans in `plans/` are the source of truth. Prefer their Done criteria
over inventing parallel designs. Plan 009 (CLI) is out of scope for the current
ship pass.
