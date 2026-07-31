# Dev Mode discovery — plan 005

| Surface | How a user finds it | Evidence |
|---|---|---|
| Code section (codegen) | Dev Mode → Inspect → language dropdown → "Tailwind CSS" | Manifest `codegenLanguages`; in-product UNVERIFIED |
| Inspect panel | Dev Mode → plugin in Inspect panel / org pin | Manifest `inspect` capability; in-product UNVERIFIED |
| Setup from codegen | Preferences action "Configure Tailwind…" | `codegenPreferences` action → `preferenceschange` |

Both surfaces share `src/pipeline.ts` so class output cannot drift.
