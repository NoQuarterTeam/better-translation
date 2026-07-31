# Open Translation Protocol

This document explores a possible open protocol around Better Translation's Manifest, Locale values, editor providers, and Runtime bundles.

The idea is that Better Translation can be more than one hosted product. The hosted Platform can be the managed implementation of an open translation workflow, while local files, GitHub branches, third-party tools, or custom backends can implement the same core shape.

This is exploratory. It is not the current package contract.

## Core Shape

The protocol should describe the flow from source code to runtime strings without forcing every implementation to copy Better Translation's hosted-service model.

```text
source code -> Manifest -> editor provider -> Locale values -> Runtime bundle
```

Each stage has a different job:

- Source code contains Translation markers.
- The Manifest describes discovered Messages and source metadata.
- An editor provider reads and writes Locale values.
- Locale values are the editable translated values for each Locale.
- Runtime bundles are flat payloads loaded by Consumer apps.

The hosted Platform is one editor provider. Local files are another. A third-party system could also be a provider.

## Why This Matters

An open protocol could make Better Translation useful even when teams do not adopt the hosted Platform.

Possible benefits:

- local-first teams can keep Locale values in their repo
- hosted teams can move to the Platform without changing app runtime code
- agencies can build their own review tooling around the Manifest
- open-source projects can accept Locale value edits through GitHub
- third-party translation tools can integrate without owning the Vite plugin
- the same editor UI can work against local files, the Platform, or a custom backend
- the hosted Platform becomes the managed version of a broader framework

The important product distinction is that the protocol should stay small and durable. Hosted concepts can build on top of it, but should not define it.

## Non-Goals

The protocol should not require:

- Projects
- Production Branches
- Branch cleanup
- Project API keys
- repository connections
- Better Translation user accounts
- hosted auth
- the Platform translator

Those are Platform features. They can map onto protocol concepts, but local and third-party implementations should not need to implement them.

The protocol also should not put editor metadata into Runtime bundles. Runtime bundles remain optimized for app rendering.

## Manifest Protocol

The Manifest is the source metadata catalog of Messages discovered in a Consumer app.

Example:

```json
{
  "schemaVersion": 1,
  "defaultLocale": "en",
  "locales": ["en", "nl", "fr"],
  "messages": {
    "checkout.pay_now": {
      "defaultMessage": "Pay now",
      "description": "Primary checkout payment button",
      "placeholders": {},
      "sources": [
        {
          "file": "src/routes/checkout.tsx",
          "kind": "component",
          "marker": "T"
        }
      ]
    }
  }
}
```

The Manifest can include source and editor metadata because it is not loaded by the runtime app as translated strings.

Useful Manifest fields:

- schema version
- Default locale
- supported Locales
- lookup id
- Default locale message
- description or context
- Variable placeholders
- source file path
- marker kind
- marker name
- optional grouping or ownership metadata

The Manifest should identify durable source ownership. Exact line, column, and character offsets are fragile because unrelated source edits can move them.

## Locale Values Protocol

The simplest Locale values format is the current flat shape:

```json
{
  "checkout.pay_now": "Betaal nu"
}
```

This is useful because it can also be emitted directly as a Runtime bundle.

An editor provider may expose richer metadata:

```json
{
  "lookupId": "checkout.pay_now",
  "locale": "nl",
  "value": "Betaal nu",
  "source": "manual",
  "updatedAt": "2026-06-03T10:00:00.000Z",
  "updatedBy": {
    "type": "external",
    "id": "user_123",
    "name": "Avery"
  }
}
```

Richer Locale value metadata can support:

- edit history
- review status
- value source, such as `manual`, `ai`, or `imported`
- stale value detection
- actor attribution
- branch or workspace comparison
- generated value provenance

That metadata should compile down to flat Runtime bundles for app consumption.

## Runtime Bundle Protocol

Runtime bundles must stay plain JSON maps:

```json
{
  "checkout.pay_now": "Betaal nu"
}
```

Runtime bundles should not include:

- Manifest metadata
- source ownership metadata
- editor state
- review status
- value provenance
- draft-only values
- auth or Project metadata

This keeps runtime loading simple, cacheable, and framework-agnostic.

## Editor Provider Protocol

An editor provider is the read/write contract between editor UI and Locale value storage.

Possible TypeScript shape:

```ts
type TranslationEditorProvider = {
  getConfig(): Promise<EditorConfig>
  listMessages(input: ListMessagesInput): Promise<MessageSummaryPage>
  getMessage(lookupId: string): Promise<MessageDetail>
  saveLocaleValue(input: SaveLocaleValueInput): Promise<MessageDetail>
  generateLocaleValue?(input: GenerateLocaleValueInput): Promise<MessageDetail>
}
```

Example supporting types:

```ts
type EditorConfig = {
  defaultLocale: string
  locales: string[]
}

type ListMessagesInput = {
  q?: string
  view?: "all" | "missing"
}

type SaveLocaleValueInput = {
  lookupId: string
  locale: string
  value: string
}

type GenerateLocaleValueInput = {
  lookupId: string
  locale: string
}
```

The provider contract should be about editor behavior, not storage implementation. A provider could be file-backed, database-backed, API-backed, or Git-backed.

## Provider Examples

Local file provider:

```ts
createLocalFileEditorProvider({
  manifestPath: ".cache/better-translation/manifest.json",
  localesDir: "src/lib/bt/locales",
})
```

Platform provider:

```ts
createPlatformEditorProvider({
  projectId,
  branch,
  apiKey,
})
```

GitHub provider:

```ts
createGitHubEditorProvider({
  owner: "acme",
  repo: "web",
  ref: "feature/checkout-copy",
  manifestPath: ".cache/better-translation/manifest.json",
  localesDir: "src/lib/bt/locales",
})
```

Custom provider:

```ts
createCustomCmsEditorProvider({
  endpoint: "https://cms.example.com/translations",
  token,
})
```

The same editor UI could sit on top of all of these if they implement the provider contract.

## Potential Use Cases

### Local-Only Apps

A team can use the Vite plugin, Manifest, local Locale value files, and local editor without creating a hosted Project.

This keeps the repo as the source of truth and makes Better Translation a local framework for extraction, editing, and runtime loading.

### Hosted Platform Adoption

A team can start local-only, then migrate to the hosted Platform later.

The Platform imports the Manifest and optionally imports existing local Locale values as initial hosted values. Runtime app code can continue calling the same `loadMessages(locale)` helper.

### GitHub-Based Review

Open-source projects could store Locale values in Git and let contributors propose edits through pull requests.

A GitHub provider could read a Manifest and Locale value files from a branch, write changes to a branch, and open or update a pull request.

### Agency or Enterprise Tooling

An agency or enterprise team could build custom review workflows around the Manifest:

- assign Message groups to reviewers
- export work to translators
- run brand or legal review
- compare Locale values across apps
- sync approved values back to files or the Platform

They can use Better Translation's source extraction and runtime helpers while owning their own process.

### Third-Party Translation Systems

Crowdin, Lokalise, Phrase, or a custom translation memory could implement a provider.

Better Translation would still own source extraction and runtime loading in the Consumer app, while the third-party system owns translation workflow.

### Design and Product Review

A design review tool could read the Manifest and rendered lookup ids to show which copy appears on a page, whether values are missing, and who last changed them.

This is editor/diagnostic behavior. Runtime translation should still come from normal runtime bundles.

### Static Export and Offline Review

The Manifest plus Locale values could be exported into a static review bundle.

This could support offline translation review, vendor handoff, or audit snapshots without requiring Platform access.

## Relationship to Branches

The open protocol can allow a branch or workspace identifier, but it should not require Better Translation's hosted Branch model.

Possible generic concept:

```ts
type TranslationWorkspace = {
  id: string
  label: string
}
```

The Platform can map this to Branches. A GitHub provider can map it to Git refs. A local file provider may ignore it entirely.

This keeps the protocol flexible without erasing the stronger hosted Branch model.

## Relationship to the Platform

The Better Translation Platform would be the managed provider:

- Project creation
- hosted Manifest sync
- Branches
- Production Branch
- Branch overrides
- Branch cleanup
- scoped API keys
- Platform translator
- hosted dashboard
- Runtime bundle endpoints

Those features are valuable because the Platform owns collaboration, history, sync, and runtime delivery. But the protocol underneath should still be understandable without the Platform.

## Relationship to Embedded Editors

Embedded editors are one possible UI on top of the provider protocol.

Local mounted editor:

```text
Consumer app component -> local provider -> Vite middleware -> local files
```

Remote mounted editor:

```text
Consumer app component -> framework server adapter -> Platform provider -> hosted data
```

Hosted dashboard:

```text
hosted app route -> Platform provider -> hosted data
```

The editor component can be separate from the protocol. The protocol makes the component portable.

## Versioning

The Manifest and provider protocol should be versioned separately.

Possible version boundaries:

- Manifest schema version
- Locale value metadata version
- editor provider API version
- Runtime bundle version, if the flat runtime shape ever changes

Runtime bundles should change rarely. Manifest and editor metadata can evolve faster.

## Open Questions

- What is the minimum Manifest schema that is useful outside Better Translation?
- Should local flat Locale value files be considered protocol-compliant by themselves?
- Should richer Locale value metadata have a standard file format, or only an API shape?
- How should provider capabilities be discovered, such as `generateLocaleValue` or history support?
- Should workspace/branch concepts be in the base protocol or an optional extension?
- How should stale Locale values be represented without forcing every provider to store hashes?
- Should source file links be opaque strings, structured references, or provider-specific extensions?
- Can third-party providers emit runtime bundles directly, or should Better Translation always compile them?
