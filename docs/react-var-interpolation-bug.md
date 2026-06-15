# React Var Interpolation Bug

## Summary

React `<T>` Messages with `<Var>` placeholders can render raw placeholders when a Locale value exists.

Observed in a Consumer app:

```tsx
<T>
  <Var count={event.pageViewCount} /> views
</T>
```

With Dutch Locale value:

```json
"m_1m4u4y": "{count} weergaven"
```

Rendered output:

```text
{count} weergaven
```

Expected output:

```text
12 weergaven
```

This is not a Locale value issue. The Runtime bundle correctly contains `{count}`. The problem is that React `<T>` sometimes does not have the runtime `count` value when it replaces the source children with the translated template.

## Affected Consumer App Example

Repo:

```text
/Users/jclackett/Apps/NoQuarter/unlisted
```

Affected source:

```text
src/routes/dashboard/_org/events/_list/-components/event-item.tsx
```

Original pattern:

```tsx
{
  event.pageViewCount === 1 ? (
    <T>
      <Var count={event.pageViewCount} /> view
    </T>
  ) : (
    <T>
      <Var count={event.pageViewCount} /> views
    </T>
  )
}
```

Affected generated Locale values:

```json
"m_4c8umt": "{count} weergave",
"m_1m4u4y": "{count} weergaven",
"m_cg4ns2": "{count} deelnemer",
"m_1d42r43": "{count} deelnemers"
```

## Why It Can Look Like It Worked Before

When no translated Locale value exists, React `<T>` renders its original children:

```tsx
<Var count={12} /> views
```

In that fallback path, `<Var>` renders its value directly, so the UI displays:

```text
12 views
```

Once a translated Locale value exists, `<T>` stops rendering its children and renders the translated template instead:

```text
{count} weergaven
```

At that point `<T>` must have a runtime value map:

```ts
{
  count: 12
}
```

If `<T>` fails to recover that map from its children, interpolation cannot happen and `{count}` remains visible.

## Current React Implementation

Relevant files:

```text
packages/better-translation/src/extractors/typescript.ts
packages/better-translation/src/react.tsx
```

The React/TypeScript extractor can statically identify the placeholder name and extracted Message:

```ts
const extraction = extractJSXChildren(node.children)
messages.push({
  id,
  defaultMessage: extraction.message,
  placeholders: extraction.placeholders,
  // ...
})
```

For a React `<T>` marker, it currently only injects the `id`:

```ts
if (!hasJSXAttribute(opening.attributes as Array<unknown>, "id")) {
  edits.push({
    start: opening.name.end,
    end: opening.name.end,
    replacement: ` id="${id}"`,
  })
}
```

That means the transformed React source is effectively:

```tsx
<T id="m_1m4u4y">
  <Var count={event.pageViewCount} /> views
</T>
```

The React runtime then tries to reconstruct the source Message and runtime values by walking React children:

```ts
function extractRuntimeContent(children: ReactNode) {
  const parts: string[] = []
  const vars: Record<string, ReactNode> = {}

  Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      parts.push(String(child))
      return
    }

    if (isValidElement<VarProps>(child) && child.type === Var) {
      const entry = getRuntimeVarEntry(child.props)
      if (entry) {
        parts.push(`{${entry.name}}`)
        vars[entry.name] = entry.value
      }
    }
  })

  return {
    message: parts.join("").replace(/\s+/g, " ").trim(),
    vars: Object.keys(vars).length > 0 ? vars : undefined,
  }
}
```

Then `<T>` does:

```ts
const vars = template?.includes("{") ? runtimeContent.vars : undefined
if (!vars) return <>{template}</>
```

So if `child.type === Var` does not match, `vars` is `undefined`, and the translated template is returned as raw text.

## Likely Root Cause

React `<T>` relies on runtime component identity:

```ts
child.type === Var
```

That is brittle across bundling and runtime boundaries. It can fail when a Consumer app ends up with more than one module instance or when the rendered `Var` element does not reference the exact same function object as the `Var` captured inside the `T` module closure.

Potential triggers include:

- Vite dev/HMR boundaries
- SSR/client chunk boundaries
- duplicated package instances
- transformed output importing aliased/minified exports
- package linking or monorepo dependency resolution

The concrete symptom is independent of extraction: the Manifest and Locale values can be correct, but runtime interpolation still fails because the runtime value map was not recovered.

## Why Svelte Is Less Fragile

The Svelte extractor already injects compile-time runtime props into `<T>`:

```ts
if (!hasAttribute(node.attributes, "message") && insertAt !== undefined) {
  edits.push({
    replacement: ` message=${JSON.stringify(extraction.message)}`,
  })
}

if (!hasAttribute(node.attributes, "values") && extraction.values.length > 0 && insertAt !== undefined) {
  edits.push({
    replacement: ` values={{ ${extraction.values.map((entry) => `${entry.name}: ${entry.value}`).join(", ")} }}`,
  })
}
```

Svelte runtime accepts:

```ts
interface Props {
  id?: string
  context?: string
  message?: string
  values?: Record<string, unknown>
  children?: Snippet
}
```

Then it interpolates with explicit `values`:

```ts
const translated = $derived(template ? interpolateString(template, normalizeValues(values)) : undefined)
```

React should follow the same model.

## Desired Fix

Keep the authoring API unchanged:

```tsx
<T>
  <Var count={event.pageViewCount} /> views
</T>
```

Change the React extraction and runtime path so the Vite plugin injects enough compile-time data for deterministic interpolation.

Target transformed shape:

```tsx
<T id="m_1m4u4y" message="{count} views" values={{ count: event.pageViewCount }}>
  <Var count={event.pageViewCount} /> views
</T>
```

Then React `<T>` should prefer explicit props:

```ts
export interface TProps {
  id?: string
  context?: string
  message?: string
  values?: Record<string, unknown>
  children?: ReactNode
}
```

Runtime behavior:

1. Resolve the translated template by `id`.
2. If a translated template exists, interpolate it with `values`.
3. If no translated template exists but `message` exists, render `message` interpolated with `values`.
4. Otherwise fall back to `children`.

The original `children` should remain for source readability and fallback rendering, but translated rendering should not depend on inspecting those children.

## Implementation Notes

### 1. Extend React `TProps`

File:

```text
packages/better-translation/src/react.tsx
```

Add `message?: string` and `values?: Record<string, unknown>` to `TProps`.

Use existing `normalizeValues` and interpolation logic, or share `interpolateString` where appropriate. React interpolation must preserve ReactNode values, not force all values to strings, because `<Var title={<strong>{title}</strong>} />` is supported in existing Consumer app code.

Do not blindly use `interpolateString` for React if it stringifies ReactNode placeholders. The current React `interpolate()` function returns `ReactNode[]`, which is the right output shape for JSX values.

### 2. Extend React Extraction Result To Include Values

File:

```text
packages/better-translation/src/extractors/typescript.ts
```

Current `extractJSXChildren` returns:

```ts
{
  message: string
  placeholders: string[]
  valid: boolean
}
```

It needs to return value expressions too, similar to Svelte:

```ts
{
  message: string
  placeholders: string[]
  values: Array<{ name: string; value: string }>
  valid: boolean
}
```

For `<Var count={event.pageViewCount} />`, capture:

```ts
{ name: "count", value: "event.pageViewCount" }
```

For shorthand child normalization:

```tsx
<Var>{count}</Var>
```

The existing transform already rewrites this to:

```tsx
<Var count={count} />
```

Make sure extraction either:

- reads the original shorthand child and captures `{ name: "count", value: "count" }`, or
- relies on a predictable edit ordering that keeps the final output correct.

Prefer making `extractJSXChildren` able to read both forms directly.

### 3. Inject `message` And `values` For React `<T>`

When a React `<T>` has placeholders:

- Add `message={JSON.stringify(extraction.message)}` unless already present.
- Add `values={{ ... }}` unless already present.

When there are no placeholders:

- `message` is still useful for deterministic fallback without child reconstruction, but it is optional.
- To keep output smaller, it is acceptable to only inject `message` when there are placeholders or when needed for explicit behavior.

Important: avoid duplicating props if the user explicitly provided `message` or `values` in future usage.

### 4. Keep Runtime Bundle Flat

Do not change Runtime bundle shape.

Runtime bundles must remain:

```json
{
  "m_lookup": "Translated string"
}
```

This fix belongs in source transform/runtime helper behavior, not in Locale values or Runtime bundle metadata.

## Tests To Add

Add focused tests around the package behavior.

Suggested coverage:

1. React extractor transforms `<T><Var count={count} /> views</T>` into a `<T>` with:
   - `id`
   - `message="{count} views"`
   - `values={{ count }}`

2. React extractor transforms `<T><Var count={event.pageViewCount} /> views</T>` into:
   - `values={{ count: event.pageViewCount }}`

3. React runtime renders translated template with values:

```tsx
<TranslateProvider messages={{ m_test: "{count} weergaven" }}>
  <T id="m_test" message="{count} views" values={{ count: 12 }}>
    <Var count={12} /> views
  </T>
</TranslateProvider>
```

Expected:

```text
12 weergaven
```

4. React runtime supports ReactNode placeholder values:

```tsx
<T id="m_test" message="Delete {name}" values={{ name: <strong>Event</strong> }}>
  Delete <Var name={<strong>Event</strong>} />
</T>
```

Expected rendered output should preserve the `<strong>` node.

5. Fallback behavior still works when no translated template exists:

```tsx
<T message="{count} views" values={{ count: 12 }}>
  <Var count={12} /> views
</T>
```

Expected:

```text
12 views
```

## Manual Verification

Use the Unlisted Consumer app as an end-to-end repro:

```text
/Users/jclackett/Apps/NoQuarter/unlisted
```

Run its dev server and open:

```text
http://unlisted.localhost:1355/dashboard/events
```

Switch to Dutch and inspect event cards. Counts should render as:

```text
12 weergaven
4 deelnemers
```

They must not render as:

```text
{count} weergaven
{count} deelnemers
```

Also check other `<Var>` examples in the Consumer app, especially messages with ReactNode placeholder values:

- delete confirmation dialogs with `<strong>` placeholders
- ticket/order/refund strings with amount placeholders
- inventory count strings

## Acceptance Criteria

- React `<T>` placeholder interpolation does not depend on `child.type === Var` when transform-injected `values` are present.
- Existing authoring API remains unchanged.
- Svelte behavior remains unchanged.
- Runtime bundles remain flat lookup-id to string maps.
- ReactNode placeholder values still render as ReactNode values.
- Package checks pass:

```bash
bun run check
bun --filter better-translation build
```

- If changing `packages/better-translation`, add a changeset.
