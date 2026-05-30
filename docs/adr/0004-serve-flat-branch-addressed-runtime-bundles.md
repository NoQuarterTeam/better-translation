# Serve flat branch-addressed Runtime bundles

Consumer apps keep the simple `loadMessages(locale)` API while the Vite plugin bakes the endpoint, Project id, and resolved Branch into the generated loader. Remote Runtime bundles are addressed as `/projects/:projectId/branches/:branch/locales/:locale.json` and stay flat `Record<string, string>` payloads.

Runtime bundles must not include Manifest metadata, source locations, editor state, missing-value flags, or draft details. Missing non-default Locale values fall back to the Default locale text inside the flat payload, while completeness and fallback status remain hosted-service metadata for dashboard views.
