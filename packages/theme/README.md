# `@fig-tail/theme`

In-browser Tailwind **v3** (JS/TS) and **v4** (`@theme` CSS) theme resolver used by
[fig-tail](https://github.com/kocheck/fig-tail).

Resolves a dropped config into a token set without `eval` / `new Function`.
Unreadable theme parts are reported, not guessed. Only an exact `tailwindcss`
`x.y.z` in `package.json` confirms bundled defaults.

```bash
pnpm add @fig-tail/theme
```

See the [root README](../../README.md) and [setup guide](../../docs/setup.md) for
what the resolver can and cannot read.

MIT © 2026 Kyle Kochanek
