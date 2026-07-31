# Code-syntax spike findings (plan 007 Step 1)

Environment: code + Figma published docs review, 2026-07-31. No desktop session —
answers that require product observation are UNVERIFIED.

1. **Does Inspect display code syntax?** Documented for Dev Mode variable inspect.
   UNVERIFIED in-product for this account.
2. **setVariableCodeSyntax available?** Yes in Plugin API typings.
3. **removeVariableCodeSyntax available?** Yes per docs.
4. **Design-editor write required?** Assumed yes; Dev Mode apply is refused in code.
5. **Native undo restores?** UNVERIFIED — rely on Figma undo; document for users.
6. **Library variables writable?** UNVERIFIED — ship stamps local variables only.

**STOP:** If in-product Inspect does not show WEB syntax, re-decide product value
before enabling Apply in Community builds.
