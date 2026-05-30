# Default remote dev to platform-backed mode

When a Consumer app chooses `runtime.type: "remote"`, local dev should use the platform by default: read hosted branch Runtime bundles and use the Platform translator to fill blank branch Locale values. This makes remote mode behave consistently across local dev and deployed builds, and lets multiple developers on the same Branch share generated values.

The opt-out is `dev.offline: true`, which keeps local dev isolated by using local extraction/cache and Default locale fallback. The default is intentionally not offline because "remote" should mean the hosted platform is the translation state, not only a production-time fetch target.
