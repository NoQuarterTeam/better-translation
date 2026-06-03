# better-translation

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
