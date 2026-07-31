# React Var Interpolation

Status: resolved.

## Original Failure

React `T` Messages with Variable placeholders authored through `Var` could previously render the raw placeholder after a
translated Locale value became available:

```tsx
<T>
  <Var count={event.pageViewCount} /> views
</T>
```

```text
{count} weergaven
```

The Runtime bundle was correct. The old React runtime identified `Var` only through function-object equality while walking
children. That was fragile when a Consumer app loaded the package through different bundling or runtime boundaries.

## Current Contract

The authoring API remains:

```tsx
<T>
  <Var count={event.pageViewCount} /> views
</T>
```

The Vite plugin records the canonical Message and injects the private build-time props needed by the runtime. React `Var`
also carries a global Better Translation marker, so runtime fallback discovery does not depend on one JavaScript function
instance.

Relevant implementation:

```text
packages/better-translation/src/vite-plugin/source-analysis/typescript.ts
packages/better-translation/src/react.tsx
packages/better-translation/src/message/template.ts
```

`message` and `values` on the runtime component are transform details, not an author-facing API. Consumer apps should not set
them, import a parser or validator, or reconstruct Message templates themselves.

## Rich Text And Variables

The same runtime path supports `Var` values inside safe inline elements and source-owned components:

```tsx
<T>
  Delete{" "}
  <strong>
    <Var name={event.name} />
  </strong>
</T>
```

The Vite plugin represents the source renderer as a numbered Rich-text slot while keeping the Variable placeholder as
`{name}`. The React runtime:

1. looks up the translated string by stable lookup id
2. verifies that Variable placeholders and numbered Rich-text slots preserve the source structure
3. interpolates React values without converting them to strings
4. clones only the source-owned elements and components authored inside `T`
5. renders the authored JSX if the translated structure is malformed or incompatible

Runtime bundles remain flat:

```json
{
  "m_lookup": "<0>{name}</0> verwijderen"
}
```

They contain neither React nodes nor private Manifest metadata.

## React And Svelte Parity

React and Svelte share the same Message structure contract and safe-fallback behavior. Their implementation adapters differ:

- React retains authored elements and clones them with translated children.
- Svelte source analysis generates private Snippets that invoke the authored elements or components with translated children.

Neither runtime parses translated values as arbitrary HTML. Neither framework requires a Consumer app to register rich-text
renderers.

## Regression Coverage

The current suite keeps interpolation and rich-text behavior covered at each owning interface:

```text
packages/better-translation/test/source-analysis.test.ts
packages/better-translation/test/runtime.test.tsx
packages/better-translation/test/vite-plugin.test.ts
```

Coverage includes ReactNode Variable placeholder values, Svelte values, source-owned components, nested and reordered elements,
malformed translations, structure repair, source fallback, and prototype-like lookup ids.

Run the complete regression and scaling gate:

```bash
bun run test
```

Run the package build after changing published runtime or Vite-plugin behavior:

```bash
bun --filter better-translation build
```
