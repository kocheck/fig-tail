# `@fig-tail/match`

CSS → Tailwind class matching with a confidence ladder (`exact-variable`,
`exact-value`, `nearest`, unsupported / `none`). Used by
[fig-tail](https://github.com/kocheck/fig-tail) to emit real class names in
Figma Dev Mode without inventing tokens.

Depends on [`@fig-tail/theme`](https://www.npmjs.com/package/@fig-tail/theme).

```bash
pnpm add @fig-tail/match
```

Near matches are reported, never silently promoted to named classes.

MIT © 2026 Kyle Kochanek
