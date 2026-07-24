# Orb — source

This bundle is the complete source for the **Orb** 3D scene: a single self-contained
`orb.html` file plus every asset it needs (in `assets/`). It's built with Three.js and
has a clearly separated `CONFIG` block, GLSL shaders, and an animation loop.

## Drop it into your AI

Hand this whole folder to your AI coding assistant — Claude, Cursor, Copilot, v0, whatever you
use — and ask it to reimplement the effect inside the project you already have, whether that's
**React, Next.js, Vue, Svelte, or a plain HTML/JS site**. Because the scene lives in one file
with the tunable parameters grouped up top, the assistant can lift the geometry, shaders, and
render loop and wrap them in a component that fits your stack. A prompt as simple as *"reuse this
Three.js scene in my Next.js app as a reusable component, keeping the CONFIG values adjustable"*
is enough to get started.

## Run it as-is first

The file pulls Three.js from a CDN and loads its assets with relative paths, so serve it from a
local web server rather than double-clicking it:

```sh
npx serve .          # then open the printed URL and click orb.html
# or:  python3 -m http.server
```

Tweak the values in the `CONFIG` object (or the on-screen control panel) to make the effect your
own, then port it across with your AI.
