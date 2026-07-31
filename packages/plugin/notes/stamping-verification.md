# Code syntax stamping verification (plan 007)

## Spike answers (code + docs; in-product UNVERIFIED)

| # | Question | Answer |
|---|---|---|
| 1 | Does Inspect show WEB code syntax? | Documented yes for variables with `codeSyntax.WEB`. **UNVERIFIED** in desktop. |
| 2 | Can plugin set WEB syntax? | Yes — `Variable.setVariableCodeSyntax('WEB', value)`. |
| 3 | Can plugin remove syntax? | `removeVariableCodeSyntax('WEB')` documented. |
| 4 | Design vs Dev write? | Apply gated to `figma.editorType === 'figma'`. |
| 5 | Undo? | Native Figma undo after Apply; show result count in UI. |
| 6 | Library variables? | Local variables only in this ship; library vars skipped if unreachable. |

## Guardrails

| Guard | Test |
|---|---|
| Single `setVariableCodeSyntax` in `stamp/apply.ts` | `guardrails.test.ts` |
| Platform always `'WEB'` | `guardrails.test.ts` |
| Never assign `variable.name` | `guardrails.test.ts` |
| Conflict cannot apply | `applyStamp` skips `status === 'conflict'` |
| Overwrite requires explicit opt-in | `overwriteIds` set |
| Design-only apply | throws / blocked when not `figma` |

## Bundle

See `bundle-sizes.md` after build.
