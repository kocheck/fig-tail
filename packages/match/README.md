# `@fig-tail/match`

CSS → Tailwind class matching with a confidence ladder (`exact-variable`,
`exact-value`, `nearest`, unsupported / `none`). Used by
[fig-tail](https://github.com/kocheck/fig-tail) to emit real class names in
Figma Dev Mode without inventing tokens.

Depends on [`@fig-tail/theme`](https://www.npmjs.com/package/@fig-tail/theme).

```bash
pnpm add @fig-tail/match
```

Near matches emit the raw value and report the near token; they are never
silently promoted to named classes, and never silently dropped.

MIT © 2026 Kyle Kochanek
