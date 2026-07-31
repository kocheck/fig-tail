# Contributing

## Rules (non-negotiable)

1. Never write the Figma document except:
   - `figma.root.setPluginData` under `figtail.*` keys (config storage)
   - `Variable.setVariableCodeSyntax('WEB', …)` from `packages/plugin/src/stamp/apply.ts`
2. Never assign `variable.name`.
3. Never `eval` / `new Function` user config in the plugin.
4. No network — manifest `allowedDomains: ["none"]`.
5. Never emit a named token class the config does not confirm.
6. Never fall back silently — label every degradation.
7. No secrets in the repo.

## Checks

```bash
pnpm check
```

Plugin tests always rebuild before Vitest. Match coverage thresholds are enforced.

## Plans

Numbered plans in `plans/` are the source of truth. Prefer their Done criteria
over inventing parallel designs. Plan 009 (CLI) is out of scope for the current
ship pass.
