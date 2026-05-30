# Hosted platform owns remote Locale values

Local mode and remote mode have different Locale value owners. In local mode, the Consumer app repo owns generated Locale files and local `translate` fills those files; in remote mode, the hosted platform owns Locale values and package-local translation callbacks are not canonical.

The config should make that boundary visible: local translation belongs under local runtime config, while remote translation goes through the Platform translator using Project-level model, tone, glossary, and billing settings. Top-level `translate` remains deprecated compatibility for local mode and should warn or be ignored when used with remote mode.
