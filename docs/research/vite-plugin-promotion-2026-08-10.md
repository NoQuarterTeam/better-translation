# Promoting the Better Translation Vite plugin

**Researched:** 2026-08-10
**Scope:** the working local bundle-first package, not the future hosted platform
**Sources:** official documentation, registries, repositories, and community-owned submission pages only

## Recommendation

Promote Better Translation as a **local-first Vite i18n workflow**, not as a smaller translation platform:

> Mark copy in React or Svelte, let one Vite plugin generate flat Locale value JSON, and optionally fill missing values with AI. No account and no hand-maintained translation keys.

The first job is not a large launch. It is fixing the package's discovery surfaces, proving the workflow in a tiny demo, and then putting that demo in the few places where Vite, Svelte, and developer-tool users already look.

## Five highest-leverage actions

### 1. Fix the published npm package before sending it traffic

The published `better-translation@0.6.5` registry record currently has a generic description and **no keywords, README, or license metadata**. The GitHub repository currently has **no description and no topics**. Those are material discovery gaps, not cosmetic polish. ([npm registry record](https://registry.npmjs.org/better-translation/latest), [GitHub repository metadata](https://api.github.com/repos/NoQuarterTeam/better-translation))

npm search matches package name, description, README, and keywords. npm explicitly recommends a package-root README because it helps people find and evaluate a package, and renders it on the package page. ([npm search documentation](https://docs.npmjs.com/searching-for-and-choosing-packages-to-download/), [npm README documentation](https://docs.npmjs.com/about-package-readme-files/))

For the next package release:

- Put a focused `README.md` and `LICENSE` in `packages/better-translation`, so they ship from the actual package root.
- Replace the description with something searchable and concrete, for example: `Local-first Vite i18n plugin for React and Svelte that turns source copy into flat locale JSON, with optional AI translation.`
- Add at least: `vite-plugin`, `vite`, `i18n`, `internationalization`, `localization`, `translation`, `react`, `svelte`, `typescript`, `ai-translation`.
- Add `license: "MIT"`, `bugs`, and the monorepo `repository.directory` field. npm documents each of these as package metadata and recommends a package-root license. ([npm package.json documentation](https://docs.npmjs.com/files/package.json/))

### 2. Get into the Vite Plugin Registry automatically

Vite 8 launched a new searchable Plugin Registry which refreshes daily from npm. Its discovery rule is explicit: a Vite plugin must carry the `vite-plugin` keyword. Better Translation does not currently carry it, so the package misses the most relevant official discovery surface. The existing `vite >=8` peer dependency should let the registry derive its compatibility once it is indexed. ([Vite 8 announcement](https://vite.dev/blog/announcing-vite8), [registry discovery guide](https://registry.vite.dev/guide/discovery), [compatibility guide](https://registry.vite.dev/guide/compatibility))

Do not spend launch energy on an Awesome Vite pull request: its own plugin section says it is no longer updated and points to the registry instead. ([Awesome Vite](https://github.com/vitejs/awesome-vite#plugins))

### 3. Make one proof artifact that shows the whole loop

Build a 60-90 second, copyable demonstration with no account:

1. add `betterTranslation()` to `vite.config.ts`
2. wrap real copy in `<T>` and use `useT()` once
3. start Vite
4. show generated flat Locale value JSON
5. change source copy and show regeneration/HMR
6. optionally show AI fill and the local editor

Use one React/TanStack Start example for the main launch, then publish the same story for Svelte. Point launch traffic to this local quick start or the package README, not to cloud signup. The package already supports the required local, account-free path and public examples. ([Better Translation README](https://github.com/NoQuarterTeam/better-translation#readme), [documentation quick start](https://docs.better-translation.dev/))

### 4. Lead with the workflow difference, not the AI adjective

The comparison set already owns broad promises:

| Product      | Official positioning                                                                                                                                                                                                      | Implication for Better Translation                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| i18next      | A flexible internationalization framework with a large plugin and framework ecosystem. ([docs](https://www.i18next.com/))                                                                                                 | Do not compete on breadth or maturity. Show the shorter Vite source-to-bundle loop.                                                      |
| Lingui       | Source-authored Messages plus CLI extraction, catalog translation/compilation, a Vite plugin, and lint tooling. ([site](https://lingui.dev/))                                                                             | This is the closest workflow comparison. Emphasize one-plugin dev regeneration, committed flat JSON, local editor, and optional AI fill. |
| Paraglide JS | A compiler-based, type-safe, tree-shakable i18n library with broad framework and inlang ecosystem support. ([official listing](https://inlang.com/m/gerre34r/library-inlang-paraglideJs))                                 | Do not claim bundle-size or type-safety leadership without evidence. Emphasize source-copy authoring and the local Vite workflow.        |
| Tolgee       | A developer-focused TMS with native SDKs, in-context editing, AI translation, cloud, and self-hosting. ([platform docs](https://docs.tolgee.io/platform), [React integration](https://tolgee.io/apps-integrations/react)) | Do not wait for or lead with the cloud dashboard. The wedge is useful local mode without a Project or account.                           |

“AI translation” is a useful feature demonstration, but it is not a distinct category. The differentiating promise is: **the Vite plugin owns discovery, generation, and runtime loading while the developer keeps ordinary flat files**.

### 5. Launch in a narrow sequence and learn from adopters

Recommended order:

1. **npm + Vite Plugin Registry + GitHub** — permanent discovery; fix metadata, package README, repository description/topics, and a social preview. GitHub says topics help people find related repositories and that a social preview controls how shared repository links render. ([topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics), [social preview](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview))
2. **Five to ten direct adopters** — Vite developers with a small real app. Watch them install it; record every question and failed step. Two successful public integrations are more valuable than a broad announcement with no proof.
3. **Svelte Society library submission** — it has an official package submission form, and Svelte's own package directory has an i18n category. Submit after the Svelte demo is crisp; the main Svelte directory is curated, so inclusion is not guaranteed. ([submission form](https://sveltesociety.dev/submit/library), [Svelte packages](https://svelte.dev/packages))
4. **Framework-specific community posts** — one useful integration write-up each for Vite, TanStack Start, and Svelte, in a channel that permits showcases. Vite and TanStack both point users to their official Discord/community surfaces. ([Vite community links](https://vite.dev/guide/), [TanStack community](https://tanstack.com/))
5. **Show HN** — only after the public package and demo are frictionless. Show HN explicitly welcomes things people can run, prefers no signup barrier, and asks makers to explain how and why they built it. Better Translation's local mode fits that shape. ([Show HN guidelines](https://news.ycombinator.com/showhn.html))

Product Hunt and a cloud-dashboard launch are lower priority for this stage. The package's natural audience is developers already searching for Vite/i18n tooling, and the current local workflow is the thing they can use immediately.

## Suggested launch material

**Headline**

> Better Translation: local-first i18n for Vite apps

**Subhead**

> Mark copy in React or Svelte and generate flat Locale value JSON during development. Bring your own AI translator or edit locally; no account required.

**Technical post angle**

> I wanted Vite i18n without inventing keys or jumping between components and locale files. Here is how the plugin discovers source copy, preserves React/Svelte rich text, and emits flat runtime JSON.

That angle invites useful technical discussion and demonstrates the real product. It is stronger than announcing “an AI translation tool,” which places Better Translation against mature localization platforms before that is necessary.

## Baseline and a 30-day test

For 2026-08-03 through 2026-08-09, npm reports **496 downloads** for `better-translation`; the repository reports **5 stars** as of 2026-08-10. Treat these as a starting snapshot, not a verdict. ([npm download API](https://api.npmjs.org/downloads/point/2026-08-03:2026-08-09/better-translation), [GitHub repository metadata](https://api.github.com/repos/NoQuarterTeam/better-translation))

Run one small funnel for 30 days:

- ship the metadata/package-page fixes and verify registry inclusion
- publish one React/TanStack demo and one Svelte follow-up
- personally onboard 5-10 developers
- make one substantive launch post after at least two external installs succeed
- measure weekly npm downloads, quick-start visits, successful external example repos, issues/questions, and repeat contributors

The decision after 30 days should be based primarily on **successful real integrations and recurring friction**, not impressions or launch-day stars.
