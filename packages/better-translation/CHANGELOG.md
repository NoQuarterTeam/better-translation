# better-translation

## 0.6.5

### Patch Changes

- [`9c3ea16`](https://github.com/NoQuarterTeam/better-translation/commit/9c3ea16d1d65c2280fe87e98cd6186639eeaec8b) Thanks [@JClackett](https://github.com/JClackett)! - Show rich-text Message previews without editor annotations

- [`0f328eb`](https://github.com/NoQuarterTeam/better-translation/commit/0f328ebeae0b6d5b641fa518f3b225e6a3d258c8) Thanks [@JClackett](https://github.com/JClackett)! - Distinguish Variable placeholders from Rich-text slots across the editor, diagnostics, and documentation.

## 0.6.4

### Patch Changes

- [`342e824`](https://github.com/NoQuarterTeam/better-translation/commit/342e824cf5d4a856d875ed7b3730b21597ecfbd7) Thanks [@JClackett](https://github.com/JClackett)! - Use www.better-translation.dev as the default hosted platform URL.

## 0.6.3

### Patch Changes

- [`6bcebe9`](https://github.com/NoQuarterTeam/better-translation/commit/6bcebe978da871fae471b3f7adfde3865dbca3db) Thanks [@JClackett](https://github.com/JClackett)! - Improve rich-text Message previews in the locale editor

## 0.6.2

### Patch Changes

- [#358](https://github.com/NoQuarterTeam/better-translation/pull/358) [`0f0601b`](https://github.com/NoQuarterTeam/better-translation/commit/0f0601b942401b9260e55590abaa267d627bdf96) Thanks [@JClackett](https://github.com/JClackett)! - Fix the published npm manifest so the AI SDK dependency uses a registry-compatible version.

## 0.6.1

### Patch Changes

- [`88496f8`](https://github.com/NoQuarterTeam/better-translation/commit/88496f82e50974dbcde97bed6bf8ebd46085007e) Thanks [@JClackett](https://github.com/JClackett)! - Support TypeScript 7 tooling while preserving TypeScript 6 API compatibility.

## 0.6.0

### Minor Changes

- [`2c84712`](https://github.com/NoQuarterTeam/better-translation/commit/2c8471235909655fe2a604a53be4ba577fed2074) Thanks [@JClackett](https://github.com/JClackett)! - Add safe rich text to React and Svelte T markers. Supported inline elements and arbitrary source-owned components keep their
  authored props and behavior while translated Messages can reorder their numbered sibling slots without rendering arbitrary
  HTML.

  Harden Vite-plugin lookup-id and option analysis, persist local translation progress in configurable plugin-sized batches,
  serialize dev translation and remote Manifest sync, protect malformed local Runtime bundles from destructive rewrites, and keep
  Message validation and context-setting helpers private to the runtime implementation.

  Make Svelte Rich-text Message analysis near-linear by indexing source edits and walking its AST once, without retaining
  duplicated placeholder expressions in transformed source. Treat reordered equivalent file Messages as an unchanged Manifest
  contribution. Add statistically sampled source-analysis benchmarks and scaling guards for giant files, project-shaped
  TypeScript and Svelte analysis, incremental Manifest updates, Message templates, and cached source edits. Compare p50 benchmark
  reports between the pull-request base and current revision in CI, retaining the reports as build artifacts.

  Apply completed local development translations to React and Svelte providers through Vite HMR so authored fallbacks switch to
  their active Locale values without a page reload or component-state loss.

  Document the published API through generated declaration JSDoc, keep transform-only component props out of author-facing
  types, move `RuntimeMessages` to the generated-messages entrypoint, and remove implementation-only Manifest and Svelte
  context types from package entrypoints.

## 0.5.0

### Minor Changes

- [`969a2cd`](https://github.com/NoQuarterTeam/better-translation/commit/969a2cd3413a940627387fbc53daea7ca7d8f665) Thanks [@JClackett](https://github.com/JClackett)! - Add `bt generate` and `better-translation generate` to regenerate local Runtime bundles without starting Vite dev.

## 0.4.6

### Patch Changes

- [`9cabf90`](https://github.com/NoQuarterTeam/better-translation/commit/9cabf904f86c21c54546aaf905bac87a021b1be1) Thanks [@JClackett](https://github.com/JClackett)! - Allow static string expression children inside React `<T>` markers.

## 0.4.5

### Patch Changes

- [`9ff8126`](https://github.com/NoQuarterTeam/better-translation/commit/9ff81261b631cf6ff2e2ac7b512efa376e53979c) Thanks [@JClackett](https://github.com/JClackett)! - Expose local runtime `translationBatchSize` so apps can choose how many missing messages are translated before progress is persisted.

## 0.4.4

### Patch Changes

- [`a04ba63`](https://github.com/NoQuarterTeam/better-translation/commit/a04ba637f3d3f21056d972824d0c4bc6984909fb) Thanks [@JClackett](https://github.com/JClackett)! - Persist local translation progress after each batch so large locale regenerations can resume instead of waiting for every missing message to finish.

## 0.4.3

### Patch Changes

- [`79e5d61`](https://github.com/NoQuarterTeam/better-translation/commit/79e5d61d2cda9ce4379c28224a85232f19834711) Thanks [@JClackett](https://github.com/JClackett)! - Inject React `<T>` message and values props so `<Var>` interpolation works reliably with translated Locale values.

## 0.4.2

### Patch Changes

- [`ae9cdaf`](https://github.com/NoQuarterTeam/better-translation/commit/ae9cdaf805349a2aba7efb5526e7fdec2524bfa5) Thanks [@JClackett](https://github.com/JClackett)! - Update the AI SDK dependency to the v7 beta.

## 0.4.1

### Patch Changes

- [`8937094`](https://github.com/NoQuarterTeam/better-translation/commit/8937094e47fb63253b7aa300a0d0081fab6daed5) Thanks [@JClackett](https://github.com/JClackett)! - Rename the framework-neutral runtime helper from `createTranslator` to `createT`.

## 0.4.0

### Minor Changes

- [`9d3064b`](https://github.com/NoQuarterTeam/better-translation/commit/9d3064b6b04a104d843424c93a859fc235c812eb) Thanks [@JClackett](https://github.com/JClackett)! - Add Svelte translation markers and rename the framework-neutral translator export to `better-translation/runtime`.

## 0.3.0

### Minor Changes

- [`bd606db`](https://github.com/NoQuarterTeam/better-translation/commit/bd606db292f5ff4791ba099dc47059585cdb2edd) Thanks [@JClackett](https://github.com/JClackett)! - set production hosted url

## 0.2.7

### Patch Changes

- [`05568bf`](https://github.com/NoQuarterTeam/better-translation/commit/05568bfb4875250947d1d86abe8f7e585930ac9b) Thanks [@JClackett](https://github.com/JClackett)! - Export the local editor options type from the Vite entry.

## 0.2.6

### Patch Changes

- [`d3c833c`](https://github.com/NoQuarterTeam/better-translation/commit/d3c833c3081d8252f40896e8df1a5c9cb65c92e6) Thanks [@JClackett](https://github.com/JClackett)! - Add a dev-only local editor for local runtime Locale values, with shared UI and Locale editor packages.

## 0.2.5

### Patch Changes

- [`1bb76b9`](https://github.com/NoQuarterTeam/better-translation/commit/1bb76b91a3a8cc3d68803e02fe0233c2d5fa4136) Thanks [@JClackett](https://github.com/JClackett)! - Trim synced Message source metadata to stable file, marker kind, and marker name fields, and keep successful no-op remote syncs quiet.

## 0.2.4

### Patch Changes

- [`b70978b`](https://github.com/NoQuarterTeam/better-translation/commit/b70978bda55164de911b5da9ac98e69681acb53b) Thanks [@JClackett](https://github.com/JClackett)! - Sort generated local translation artifacts deterministically

- Keep local runtime output to committed Locale bundles and move the private Manifest to `.cache/better-translation`.

## 0.2.3

### Patch Changes

- [`40ca51d`](https://github.com/NoQuarterTeam/better-translation/commit/40ca51d9205d3aa603785700ab97c44fb650add7) Thanks [@JClackett](https://github.com/JClackett)! - fixes local ai translation

## 0.2.2

### Patch Changes

- [`c5d51bb`](https://github.com/NoQuarterTeam/better-translation/commit/c5d51bbfa6a95c94f736c11690a25d34e9af6a84) Thanks [@JClackett](https://github.com/JClackett)! - Prevent SSR builds from externalizing the virtual messages module.

## 0.2.1

### Patch Changes

- [`f5748af`](https://github.com/NoQuarterTeam/better-translation/commit/f5748afe2bae477076eed50a1b769a036b839523) Thanks [@JClackett](https://github.com/JClackett)! - use react use instead of useContext

## 0.2.0

### Minor Changes

- [`778f2bc`](https://github.com/NoQuarterTeam/better-translation/commit/778f2bcd1fb89b5f2965b4cf1eb962ffdf7e7351) Thanks [@JClackett](https://github.com/JClackett)! - Add local runtime targets and a virtual messages loader.

## 0.1.7

### Patch Changes

- Rename bundle storage to local storage and stop generating the load-messages helper.

## 0.1.6

### Patch Changes

- Change the AI translation helper to translate one message per request and use plain text responses.

## 0.1.5

### Patch Changes

- Add the built-in AI translation helper.

## 0.1.4

### Patch Changes

- [`7ad0663`](https://github.com/NoQuarterTeam/better-translation/commit/7ad06638f7dbf8e2a4781ea3a1b94061ce131475) Thanks [@JClackett](https://github.com/JClackett)! - rename plugin export

## 0.1.3

### Patch Changes

- [`f011764`](https://github.com/NoQuarterTeam/better-translation/commit/f011764830320ead02f96fbe1bd38c50d2faffc8) Thanks [@JClackett](https://github.com/JClackett)! - prune orphans in dev

- [`dc8549b`](https://github.com/NoQuarterTeam/better-translation/commit/dc8549b3f6368f79f380fb2891f85ada1f153b65) Thanks [@JClackett](https://github.com/JClackett)! - fixes plugin startup issue

- [`a16015f`](https://github.com/NoQuarterTeam/better-translation/commit/a16015f3d0811869f062de4492feaa205f7614a2) Thanks [@JClackett](https://github.com/JClackett)! - fix generated file checks

- [`5a178b7`](https://github.com/NoQuarterTeam/better-translation/commit/5a178b7bafb8a14a380043097e3960f4b5dad23d) Thanks [@JClackett](https://github.com/JClackett)! - fixes server side extractor and cleans up server api

## 0.1.2

### Patch Changes

- [`ed4df5e`](https://github.com/NoQuarterTeam/better-translation/commit/ed4df5eb23510c61b5899167d88bd82c01f0c182) Thanks [@JClackett](https://github.com/JClackett)! - update server helpers to use content for id and update useT to allow variables
