# Lesson: This project's shadcn components are Base UI, not Radix

**Date:** 2026-07-07

The operator_os component library is built on Base UI primitives, not Radix. Two recurring gotchas that cost debugging time during the build:

1. Composition uses the `render` prop, NOT Radix's `asChild` — e.g. `<DialogTrigger render={<Button>Open</Button>} />`.
2. Select's `onValueChange` passes `string | null`, not `string` — every handler needs `(v) => setX(v ?? "")`. This broke the type check across ~10 components until fixed in one batch pass.

**Transferable rule:** before writing UI code in any project, read one existing component of the same kind first. Library dialects (Base UI vs. Radix, Tailwind v3 vs. v4) are invisible in file names and fatal in bulk.

Related: [[2026-07-07_reference-operator-os-architecture]]
