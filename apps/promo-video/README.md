# Better Translation promo video

Programmatic Remotion demo of the local-first Vite plugin workflow.

```bash
bun run video:preview
bun run video:render
bun run video:render:teasers
```

The render is written to `apps/promo-video/out/better-translation-vite-plugin-demo.mp4`. The output directory is intentionally ignored; the composition is the source of truth.

The teaser command additionally renders 11-second landscape, square, and vertical cuts for social posts.

## Storyboard

1. Start with an English-only checkout.
2. Mark authored copy with `<T>`.
3. Let the Vite plugin discover Messages.
4. Edit a Dutch Locale value directly in the generated flat JSON.
5. Show the Consumer app update through Vite HMR.
6. Show optional automatic filling through an AI-backed `translate()` function.
7. Show the production build check and package install command.
