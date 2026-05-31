# Better Translation

Better Translation is a developer tool and hosted translation platform for Vite applications. This context defines the domain language used across the Vite plugin, runtime helpers, hosted service, and example consumer surfaces.

## Language

**Consumer app**:
An application that installs Better Translation, marks source copy, and loads translated messages at runtime.
_Avoid_: client app, downstream app, customer app

**Vite plugin**:
The build-time integration that discovers translation markers in a Consumer app and produces or syncs message data.
_Avoid_: extractor, compiler

**Translation marker**:
A source-code call or component that identifies copy as translatable.
_Avoid_: wrapper, tag

**Message**:
A single translatable unit of source copy identified by a stable lookup id.
_Avoid_: string, text, phrase

**Lookup id**:
A stable key used to find a Message's Locale value at runtime. Better Translation can generate it from source copy and metadata, or a developer can provide it through an explicit `id` option on a Translation marker.
_Avoid_: key, translation key

**Default locale**:
The source language of a Consumer app's authored copy.
_Avoid_: source locale, fallback locale

**Locale**:
A language or regional variant that a Consumer app supports.
_Avoid_: language

**Locale values**:
Translated message values for one Locale, keyed by lookup id.
_Avoid_: translations file, locale file

**Manifest**:
The source metadata catalog of Messages discovered in a Consumer app.
_Avoid_: runtime bundle, catalog

**Runtime bundle**:
The flat public payload of translated strings that a Consumer app loads at runtime.
_Avoid_: manifest, locale metadata

**Project**:
The hosted-service container for one Consumer app's Messages, Locale values, and Branches.
_Avoid_: app, workspace

**Branch**:
A hosted working line for Manifest and Locale value changes, usually named after a Git branch.
_Avoid_: translation branch, channel, environment

**Branch override**:
A Branch-local Locale value stored for a Branch Message.
_Avoid_: branch copy, forked translation

**Platform translator**:
The hosted translation service that generates Locale values using a Project's configured translation settings.
_Avoid_: local translator, translate callback

**Snapshot fallback**:
A generated local copy of Runtime bundles used when remote runtime loading is unavailable or unsuitable.
_Avoid_: local source of truth, backup locale files

**Orphaned message**:
A Message that exists in hosted history but no longer appears in the current Manifest.
_Avoid_: deleted message, stale key
