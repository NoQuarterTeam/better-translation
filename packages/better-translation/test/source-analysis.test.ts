import { describe, expect, spyOn, test } from "bun:test"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { compile } from "svelte/compiler"
import { render } from "svelte/server"

import { getMessageId } from "../src/message/id.js"
import { analyzeSourceFile, type SourceEdit } from "../src/vite-plugin/source-analysis/index.js"
import { analyzeSvelteSourceFile } from "../src/vite-plugin/source-analysis/svelte.js"
import { analyzeTypeScriptSourceFile } from "../src/vite-plugin/source-analysis/typescript.js"
import { compileSvelteFile, compileSvelteProbe } from "./svelte-probe.js"

const markers = {
  call: ["t", "translate"],
  component: ["T", "Translate"],
  logging: false,
}

function applyEdits(code: string, edits: SourceEdit[]) {
  let transformed = code
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    transformed = `${transformed.slice(0, edit.start)}${edit.replacement}${transformed.slice(edit.end)}`
  }
  return transformed
}

describe("source analyzer dispatch", () => {
  test("routes Svelte files to the Svelte analyzer and other source files to the TypeScript analyzer", () => {
    const svelte = analyzeSourceFile("<T>Svelte message</T>", "component.svelte", markers)
    const typescript = analyzeSourceFile("const content = <T>TypeScript message</T>", "component.tsx", markers)

    expect(svelte.parsed).toBe(true)
    expect(svelte.messages[0]?.defaultMessage).toBe("Svelte message")
    expect(typescript.parsed).toBe(true)
    expect(typescript.messages[0]?.defaultMessage).toBe("TypeScript message")
  })

  test("returns an empty failed analysis for parser errors in either language", () => {
    expect(analyzeTypeScriptSourceFile("const =", "broken.ts", markers)).toEqual({
      parsed: false,
      messages: [],
      edits: [],
    })
    expect(analyzeSvelteSourceFile("<T>Unclosed", "broken.svelte", markers)).toEqual({
      parsed: false,
      messages: [],
      edits: [],
    })
  })
})

describe("lookup id stability", () => {
  test("keeps ids stable and excludes explicit ids from generated identity metadata", () => {
    expect(getMessageId("Hello {name}")).toBe("m_8rxiqo")
    expect(getMessageId("Save", { context: "button" })).toBe("m_31pijb")
    expect(getMessageId("Save", { id: "ignored-by-the-hash", context: "button" })).toBe("m_31pijb")
  })
})

describe("TypeScript and JSX calls", () => {
  test("extracts configured calls, placeholders, metadata, and durable source ownership", () => {
    const code = `
      const basic = t("Hello {name}, meet {name}")
      const contextual = t("Save", "button")
      const withValues = translate("Welcome {name}", { name }, { context: "greeting" })
      const explicit = t("Cancel", { id: "cancel-action", context: "dialog" })
      const dynamic = t(message)
      const member = translator.t("Ignored")
      const other = otherMarker("Ignored")
    `
    const analysis = analyzeTypeScriptSourceFile(code, "src/example.tsx", markers)

    expect(analysis.parsed).toBe(true)
    expect(analysis.messages).toEqual([
      {
        id: getMessageId("Hello {name}, meet {name}"),
        defaultMessage: "Hello {name}, meet {name}",
        meta: {},
        placeholders: ["name"],
        source: {
          file: "src/example.tsx",
          kind: "call",
          marker: "t",
        },
      },
      {
        id: getMessageId("Save", { context: "button" }),
        defaultMessage: "Save",
        meta: { context: "button" },
        placeholders: [],
        source: {
          file: "src/example.tsx",
          kind: "call",
          marker: "t",
        },
      },
      {
        id: getMessageId("Welcome {name}", { context: "greeting" }),
        defaultMessage: "Welcome {name}",
        meta: { context: "greeting" },
        placeholders: ["name"],
        source: {
          file: "src/example.tsx",
          kind: "call",
          marker: "translate",
        },
      },
      {
        id: "cancel-action",
        defaultMessage: "Cancel",
        meta: { id: "cancel-action", context: "dialog" },
        placeholders: [],
        source: {
          file: "src/example.tsx",
          kind: "call",
          marker: "t",
        },
      },
    ])
  })

  test("rewrites every supported call option shape exactly once", () => {
    const code = `
      const basic = t("Basic")
      const withValues = t("Hello {name}", { name })
      const legacyContext = t("Save", "button")
      const options = t("Delete", { context: "dialog" })
      const valuesAndOptions = t("Welcome {name}", { name }, { context: "greeting" })
      const explicit = t("Cancel", { id: "cancel-action" })
    `
    const first = analyzeTypeScriptSourceFile(code, "calls.ts", markers)
    const transformed = applyEdits(code, first.edits)

    expect(first.edits).toHaveLength(5)
    expect(transformed).toContain(`t("Basic", { id: "${getMessageId("Basic")}" })`)
    expect(transformed).toContain(`t("Hello {name}", { name }, { id: "${getMessageId("Hello {name}")}" })`)
    expect(transformed).toContain(`t("Save", { id: "${getMessageId("Save", { context: "button" })}", context: "button" })`)
    expect(transformed).toContain(`t("Delete", { id: "${getMessageId("Delete", { context: "dialog" })}", context: "dialog"`)
    expect(transformed).toContain(
      `t("Welcome {name}", { name }, { id: "${getMessageId("Welcome {name}", { context: "greeting" })}", context: "greeting"`,
    )
    expect(transformed).toContain(`t("Cancel", { id: "cancel-action" })`)

    const second = analyzeTypeScriptSourceFile(transformed, "calls.ts", markers)
    expect(second.messages.map(({ id, defaultMessage }) => ({ id, defaultMessage }))).toEqual(
      first.messages.map(({ id, defaultMessage }) => ({ id, defaultMessage })),
    )
    expect(second.edits).toEqual([])
  })

  test("skips a call whose opaque options cannot prove the runtime lookup id", () => {
    const analysis = analyzeTypeScriptSourceFile(`const value = t("Message", values, options)`, "calls.ts", markers)

    expect(analysis.messages).toEqual([])
    expect(analysis.edits).toEqual([])
    expect(analysis.diagnostics?.map(({ code }) => code)).toEqual(["ambiguous-call-arguments"])
  })
})

describe("TypeScript and JSX components", () => {
  test("extracts static text, literal expressions, comments, and fragments with component metadata", () => {
    const code = `
      const content = (
        <Translate context="homepage">
          Welcome{" "}
          {/* this is not part of the message */}
          <>to Better Translation</>
        </Translate>
      )
    `
    const analysis = analyzeTypeScriptSourceFile(code, "src/home.tsx", markers)
    const message = "Welcome <0>to Better Translation</0>"

    expect(analysis.messages).toEqual([
      {
        id: getMessageId(message, { context: "homepage" }),
        defaultMessage: message,
        meta: { context: "homepage" },
        placeholders: [],
        source: {
          file: "src/home.tsx",
          kind: "component",
          marker: "Translate",
        },
      },
    ])
    expect(analysis.edits).toHaveLength(2)
  })

  test("preserves explicit component fields and does not add duplicate edits", () => {
    const code = `<T id="custom" message={"Authored message"} values={{}}>Authored message</T>`
    const analysis = analyzeTypeScriptSourceFile(code, "component.tsx", markers)

    expect(analysis.messages[0]).toMatchObject({
      id: "custom",
      defaultMessage: "Authored message",
      meta: {},
    })
    expect(analysis.edits).toEqual([])
  })

  test("extracts every supported Var shape and makes shorthand JSX idempotent", () => {
    const code = `
      const content = (
        <T>
          Hello <Var>{name}</Var>,
          account <Var account={user.account} />,
          total <Var name="total" value={format(total)} />,
          label <Var name="label">{label}</Var>,
          and <Var name="constant" />.
        </T>
      )
    `
    const first = analyzeTypeScriptSourceFile(code, "vars.tsx", markers)

    expect(first.messages[0]?.defaultMessage).toBe(
      "Hello {name}, account {account}, total {total}, label {label}, and {constant}.",
    )
    expect(first.messages[0]?.placeholders).toEqual(["name", "account", "total", "label", "constant"])
    expect(first.edits).toContainEqual({
      start: expect.any(Number),
      end: expect.any(Number),
      replacement: "<Var name={name} />",
    })

    const transformed = applyEdits(code, first.edits)
    expect(transformed).not.toContain("values={{")
    expect(transformed.match(/format\(total\)/g)).toHaveLength(1)
    const second = analyzeTypeScriptSourceFile(transformed, "vars.tsx", markers)
    expect(second.messages).toEqual(first.messages)
    expect(second.edits).toEqual([])
  })

  test("encodes intrinsic elements in deterministic preorder while leaving element props in source", () => {
    const code = `
      const content = (
        <T>
          Read <a href={termsUrl}>the <strong>terms</strong></a> before continuing.<br />
        </T>
      )
    `
    const analysis = analyzeTypeScriptSourceFile(code, "rich.tsx", markers)

    expect(analysis.messages[0]?.defaultMessage).toBe("Read <0>the <1>terms</1></0> before continuing.<2/>")
    expect(analysis.messages[0]?.placeholders).toEqual([])
  })

  test("encodes source-owned React components as rich-text elements", () => {
    const analysis = analyzeTypeScriptSourceFile(
      `const content = <T>Stay <B tone="important">safe with <Text.Italic>care</Text.Italic></B>.</T>`,
      "components.tsx",
      markers,
    )

    expect(analysis.messages[0]?.defaultMessage).toBe("Stay <0>safe with <1>care</1></0>.")
  })

  test("numbers every named Fragment as a source-owned rich slot without binding heuristics", () => {
    const reactFragments = analyzeTypeScriptSourceFile(
      `
        import React, { Fragment as F } from "react"
        const direct = <T>Before <F>direct</F> after</T>
        const member = <T>Before <React.Fragment>member</React.Fragment> after</T>
      `,
      "react-fragments.tsx",
      markers,
    )
    const customFragment = analyzeTypeScriptSourceFile(
      `
        import { Fragment } from "./ui"
        const content = <T>Before <Fragment>custom</Fragment> after</T>
      `,
      "custom-fragment.tsx",
      markers,
    )

    expect(reactFragments.messages.map(({ defaultMessage }) => defaultMessage)).toEqual([
      "Before <0>direct</0> after",
      "Before <0>member</0> after",
    ])
    expect(customFragment.messages[0]?.defaultMessage).toBe("Before <0>custom</0> after")
  })

  test("does not treat a nested translation marker as a rich-text component", () => {
    const analysis = analyzeTypeScriptSourceFile(
      `const content = <T>Outer <B><Translate>inner</Translate></B></T>`,
      "nested-marker.tsx",
      markers,
    )

    expect(analysis.messages.map(({ defaultMessage }) => defaultMessage)).toEqual(["inner"])
  })

  test("preserves meaningful spaces at nested intrinsic element boundaries", () => {
    const analysis = analyzeTypeScriptSourceFile(
      `<T>Hello<strong> very <i>safe</i> person </strong>today</T>`,
      "rich-spacing.tsx",
      markers,
    )

    expect(analysis.messages[0]?.defaultMessage).toBe("Hello<0> very <1>safe</1> person </0>today")
  })

  test.each([
    ["runtime expression", `<T>Hello {name}</T>`],
    ["conditional JSX", `<T>Hello {showName && <strong>there</strong>}</T>`],
    ["script element", `<T>Hello <script>dangerous()</script></T>`],
    ["style element", `<T>Hello <style>{".dangerous {}"}</style></T>`],
    ["invalid Var", `<T>Hello <Var /></T>`],
    ["multiple custom Var props", `<T>Hello <Var first={first} second={second} /></T>`],
    ["number literal expression", `<T>Hello {42}</T>`],
    ["empty component", `<T>{/* empty */}</T>`],
  ])("skips a non-static %s body without failing the file parse", (_label, source) => {
    const analysis = analyzeTypeScriptSourceFile(`const content = ${source}`, "dynamic.tsx", markers)

    expect(analysis.parsed).toBe(true)
    expect(analysis.messages).toEqual([])
    expect(analysis.edits).toEqual([])
  })

  test("logs one actionable diagnostic for a skipped non-static component when enabled", () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {})

    try {
      analyzeTypeScriptSourceFile(`<Translate>Hello {name}</Translate>`, "dynamic.tsx", {
        ...markers,
        logging: true,
      })

      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn).toHaveBeenCalledWith("[better-translation] Non-static <Translate> in dynamic.tsx, skipping")
    } finally {
      warn.mockRestore()
    }
  })
})

describe("Svelte calls", () => {
  test("extracts calls before components across scripts, attributes, snippets, and nested expressions", () => {
    const source = `
      <script>
        const scriptMessage = t("Script")
        const nestedScriptMessage = format({ label: t("Nested script") })
      </script>
      {#snippet helper()}
        <Badge title={decorate(t("Attribute"))}>{t("Snippet expression")}</Badge>
        <T>Snippet component</T>
      {/snippet}
      <T>Page component</T>
    `
    const first = analyzeSvelteSourceFile(source, "coverage.svelte", markers)
    const transformed = applyEdits(source, first.edits)

    expect(first.messages.map(({ defaultMessage, source }) => [source.kind, defaultMessage])).toEqual([
      ["call", "Attribute"],
      ["call", "Snippet expression"],
      ["call", "Script"],
      ["call", "Nested script"],
      ["component", "Snippet component"],
      ["component", "Page component"],
    ])
    expect(() => compile(transformed, { filename: "coverage.svelte", generate: "server" })).not.toThrow()
    expect(analyzeSvelteSourceFile(transformed, "coverage.svelte", markers).edits).toEqual([])
  })

  test("extracts configured calls, placeholders, metadata, and call edits from script blocks", () => {
    const code = `
      <script lang="ts">
        const basic = t("Hello {name}")
        const withValues = translate("Welcome {name}", { name }, "greeting")
        const explicit = t("Cancel", { id: "cancel-action", context: "dialog" })
        const dynamic = t(message)
        const member = translator.t("Ignored")
      </script>
    `
    const first = analyzeSvelteSourceFile(code, "src/example.svelte", markers)

    expect(first.parsed).toBe(true)
    expect(first.messages).toEqual([
      {
        id: getMessageId("Hello {name}"),
        defaultMessage: "Hello {name}",
        meta: {},
        placeholders: ["name"],
        source: {
          file: "src/example.svelte",
          kind: "call",
          marker: "t",
        },
      },
      {
        id: getMessageId("Welcome {name}", { context: "greeting" }),
        defaultMessage: "Welcome {name}",
        meta: { context: "greeting" },
        placeholders: ["name"],
        source: {
          file: "src/example.svelte",
          kind: "call",
          marker: "translate",
        },
      },
      {
        id: "cancel-action",
        defaultMessage: "Cancel",
        meta: { id: "cancel-action", context: "dialog" },
        placeholders: [],
        source: {
          file: "src/example.svelte",
          kind: "call",
          marker: "t",
        },
      },
    ])

    const transformed = applyEdits(code, first.edits)
    expect(transformed).toContain(`t("Hello {name}", { id: "${getMessageId("Hello {name}")}" })`)
    expect(transformed).toContain(
      `translate("Welcome {name}", { name }, { id: "${getMessageId("Welcome {name}", { context: "greeting" })}", context: "greeting" })`,
    )
    expect(analyzeSvelteSourceFile(transformed, "src/example.svelte", markers).edits).toEqual([])
  })

  test("extracts static T content, comments, and Var attributes with idempotent edits", () => {
    const code = `
      <T context="dashboard">
        Welcome <!-- translator note --><Var {name} />.
        Total <Var name="total" value={format(total)} />.
        Status <Var name="ready" />.
      </T>
    `
    const first = analyzeSvelteSourceFile(code, "dashboard.svelte", markers)

    expect(first.messages).toEqual([
      {
        id: getMessageId("Welcome {name}. Total {total}. Status {ready}.", { context: "dashboard" }),
        defaultMessage: "Welcome {name}. Total {total}. Status {ready}.",
        meta: { context: "dashboard" },
        placeholders: ["name", "total", "ready"],
        source: {
          file: "dashboard.svelte",
          kind: "component",
          marker: "T",
        },
      },
    ])
    expect(first.edits).toContainEqual({
      start: expect.any(Number),
      end: expect.any(Number),
      replacement: ' values={{ name: name, total: format(total), ready: "ready" }}',
    })

    const transformed = applyEdits(code, first.edits)
    const second = analyzeSvelteSourceFile(transformed, "dashboard.svelte", markers)
    expect(second.messages).toEqual(first.messages)
    expect(second.edits).toEqual([])
  })

  test.each([
    ["runtime expression", `<T>Hello {name}</T>`],
    ["invalid Var", `<T>Hello <Var /></T>`],
    ["Svelte HTML expression", `<T>{@html content}</T>`],
  ])("keeps the current non-static rejection for a %s body", (_label, source) => {
    const analysis = analyzeSvelteSourceFile(source, "dynamic.svelte", markers)

    expect(analysis.parsed).toBe(true)
    expect(analysis.messages).toEqual([])
    expect(analysis.edits).toEqual([])
  })

  test("skips a Svelte call whose opaque options cannot prove the runtime lookup id", () => {
    const analysis = analyzeSvelteSourceFile(
      `<script>const value = t("Message", values, options)</script>`,
      "calls.svelte",
      markers,
    )

    expect(analysis.messages).toEqual([])
    expect(analysis.edits).toEqual([])
    expect(analysis.diagnostics?.map(({ code }) => code)).toEqual(["ambiguous-call-arguments"])
  })

  test("rewrites nested Svelte elements and components into source-owned rich snippets", () => {
    const source = `
      <script>
        import Badge from "./Badge.svelte"
        let emphasized = true
        const handle = () => undefined
      </script>
      <T>
        Always <strong class:emphasized onclick={handle}>be <Badge tone="safe">safe</Badge></strong>.<br />
      </T>
    `
    const first = analyzeSvelteSourceFile(source, "safety.svelte", markers)
    const transformed = applyEdits(source, first.edits)

    expect(first.messages[0]?.defaultMessage).toBe("Always <0>be <1>safe</1></0>.<2/>")
    expect(transformed).toContain("{#snippet __better_translation_0(__better_translation_children_0)}")
    expect(transformed).toContain(
      "<strong class:emphasized onclick={handle}>{@render __better_translation_children_0()}</strong>",
    )
    expect(transformed).toContain("{#snippet __better_translation_1(__better_translation_children_1)}")
    expect(transformed).toContain('<Badge tone="safe">{@render __better_translation_children_1()}</Badge>')
    expect(transformed).toContain("{#snippet __better_translation_2(__better_translation_children_2)}")
    expect(transformed).toContain("<br />")
    expect(() => compile(transformed, { filename: "safety.svelte", generate: "server" })).not.toThrow()
    expect(analyzeSvelteSourceFile(transformed, "safety.svelte", markers).edits).toEqual([])
  })

  test("keeps authored Svelte bindings intact when generated rich snippet names would shadow them", async () => {
    const source = `
      <script>
        let { T } = $props()
        const __better_translation_0 = "outer-name"
        const children = "outer-children"
      </script>
      <T>
        <strong data-name={__better_translation_0} data-children={children}>Safe</strong>
      </T>
    `
    const analysis = analyzeSvelteSourceFile(source, "collision.svelte", markers)
    const transformed = applyEdits(source, analysis.edits)
    const Consumer = await compileSvelteProbe(transformed)
    const Component = await compileSvelteProbe(`
      <script>
        let { __better_translation_0: renderer } = $props()
      </script>
      {#snippet translatedChildren()}Safe{/snippet}
      {@render renderer(translatedChildren)}
    `)

    expect(transformed).toContain("__better_translation_0={__better_translation_9007199254740991}")
    expect(transformed).toContain("{#snippet __better_translation_9007199254740991(__better_translation_children_0)}")
    expect(render(Consumer, { props: { T: Component } }).body.replace(/<!--.*?-->/g, "")).toBe(
      '<strong data-name="outer-name" data-children="outer-children">Safe</strong>',
    )
  })

  test("keeps generated Svelte rich snippets collision-safe around authored snippets", () => {
    const source = `{#snippet __better_translation_0()}Existing{/snippet}<T><strong>Safe</strong></T>`
    const transformed = applyEdits(source, analyzeSvelteSourceFile(source, "collision.svelte", markers).edits)

    expect(() => compile(transformed, { filename: "collision.svelte", generate: "server" })).not.toThrow()
    expect(transformed).toContain("__better_translation_0={__better_translation_9007199254740991}")
  })

  test("folds nested call edits into generated Svelte rich snippet wrappers without overlapping source edits", () => {
    const source = `<T>Read <B title={t("Tooltip")}>carefully</B></T>`
    const analysis = analyzeSvelteSourceFile(source, "nested-call.svelte", markers)
    const transformed = applyEdits(source, analysis.edits)

    expect(analysis.messages.map(({ defaultMessage }) => defaultMessage)).toEqual(["Tooltip", "Read <0>carefully</0>"])
    expect(transformed).toContain(`title={t("Tooltip", { id: "${getMessageId("Tooltip")}" })}`)
    expect(() => compile(transformed, { filename: "nested-call.svelte", generate: "server" })).not.toThrow()
    expect(analyzeSvelteSourceFile(transformed, "nested-call.svelte", markers).edits).toEqual([])
  })

  test("folds nested call edits into generated Svelte placeholder values in one pass", () => {
    const source = `<T>Value <Var name="value" value={t("Nested")} /></T>`
    const analysis = analyzeSvelteSourceFile(source, "nested-value.svelte", markers)
    const transformed = applyEdits(source, analysis.edits)
    const second = analyzeSvelteSourceFile(transformed, "nested-value.svelte", markers)

    expect(analysis.messages.map(({ defaultMessage }) => defaultMessage)).toEqual(["Nested", "Value {value}"])
    expect(transformed).toContain(`values={{ value: t("Nested", { id: "${getMessageId("Nested")}" }) }}`)
    expect(transformed.match(/t\("Nested"/g)).toHaveLength(1)
    expect(
      second.messages.map(({ id, defaultMessage, placeholders, source }) => ({ id, defaultMessage, placeholders, source })),
    ).toEqual(
      analysis.messages.map(({ id, defaultMessage, placeholders, source }) => ({ id, defaultMessage, placeholders, source })),
    )
    expect(second.edits).toEqual([])
  })

  test("distinguishes empty paired and self-closing Svelte components", () => {
    const source = `<T><Badge></Badge><Badge /></T>`
    const analysis = analyzeSvelteSourceFile(source, "empty-components.svelte", markers)
    const transformed = applyEdits(source, analysis.edits)

    expect(analysis.messages[0]?.defaultMessage).toBe("<0></0><1/>")
    expect(transformed).toContain(
      "{#snippet __better_translation_0(__better_translation_children_0)}<Badge>{@render __better_translation_children_0()}</Badge>{/snippet}",
    )
    expect(transformed).toContain("{#snippet __better_translation_1(__better_translation_children_1)}<Badge />{/snippet}")
  })
})

describe("source-analysis regressions", () => {
  test("keeps quote-containing Svelte Messages parseable after source edits", () => {
    const source = `<T>He said "hello" on C:\\drive.</T>`
    const first = analyzeSourceFile(source, "message.svelte", markers)
    const transformed = applyEdits(source, first.edits)
    const second = analyzeSourceFile(transformed, "message.svelte", markers)

    expect(second.parsed).toBe(true)
    expect(second.messages).toEqual(first.messages)
    expect(second.edits).toEqual([])
  })

  test("only normalizes shorthand Var elements owned by an extracted Translation marker", () => {
    const source = `
      const unrelated = <Var>{outside}</Var>
      const message = <T>Hello <Var>{name}</Var></T>
    `
    const first = analyzeSourceFile(source, "message.tsx", markers)
    const transformed = applyEdits(source, first.edits)

    expect(transformed).toContain("const unrelated = <Var>{outside}</Var>")
    expect(transformed).toContain("<Var name={name} />")
    expect(analyzeSourceFile(transformed, "message.tsx", markers).edits).toEqual([])
  })

  test.each([
    ["message.ts", `t("Hello", { id: dynamicId })`],
    ["message.tsx", `<T id={dynamicId}>Hello</T>`],
    ["message.svelte", `<script>t("Hello", { id: dynamicId })</script>`],
    ["message.svelte", `<T id={dynamicId}>Hello</T>`],
  ])("diagnoses and skips a dynamic lookup id in %s", (filename, source) => {
    const analysis = analyzeSourceFile(source, filename, markers)

    expect(analysis.messages).toEqual([])
    expect(analysis.edits).toEqual([])
    expect(analysis.diagnostics?.map(({ code }) => code)).toEqual(["dynamic-lookup-id"])
  })

  test.each([
    ["message.ts", `t("Save", ({ context: "button" } as const))`],
    ["message.svelte", `<script lang="ts">t("Save", ({ context: "button" } as const))</script>`],
  ])("unwraps transparent static option expressions in %s", (filename, source) => {
    const first = analyzeSourceFile(source, filename, markers)
    const transformed = applyEdits(source, first.edits)
    const second = analyzeSourceFile(transformed, filename, markers)

    expect(first.messages[0]?.meta).toEqual({ context: "button" })
    expect(transformed).toContain(`id: "${first.messages[0]?.id}"`)
    expect(second.messages[0]).toMatchObject({
      defaultMessage: "Save",
      id: first.messages[0]?.id,
      meta: { context: "button" },
    })
    expect(second.edits).toEqual([])
  })

  test.each([
    ["message.ts", `t("Hello {name}", valuesOrOptions)`],
    ["message.svelte", `<script>t("Hello {name}", valuesOrOptions)</script>`],
    ["message.ts", `t("Message", values, options)`],
    ["message.svelte", `<script>t("Message", values, options)</script>`],
  ])("skips an ambiguous runtime call shape in %s", (filename, source) => {
    const analysis = analyzeSourceFile(source, filename, markers)

    expect(analysis.messages).toEqual([])
    expect(analysis.edits).toEqual([])
    expect(analysis.diagnostics?.map(({ code }) => code)).toEqual(["ambiguous-call-arguments"])
  })

  test.each([
    {
      call: `t("Save", {})`,
      edit: `{ id: "${getMessageId("Save")}" }`,
      label: "empty options",
      meta: {},
    },
    {
      call: `t("Hello {id} in {context}", { id, context })`,
      edit: `{ id, context }, { id: "${getMessageId("Hello {id} in {context}")}" }`,
      label: "placeholder collisions",
      meta: {},
    },
    {
      call: `t("Hello {name}", { name, ...values })`,
      edit: `{ name, ...values }, { id: "${getMessageId("Hello {name}")}" }`,
      label: "known values plus a spread",
      meta: {},
    },
    {
      call: `t("Save", ({ context: "button" } as const))`,
      edit: `({ id: "${getMessageId("Save", { context: "button" })}", context: "button" } as const)`,
      label: "wrapped options",
      meta: { context: "button" },
    },
    {
      call: `t("Save", { id: dynamicId, id: "last-id", context: "first", context: "last" })`,
      edit: undefined,
      id: "last-id",
      label: "last-write static id and context",
      meta: { context: "last", id: "last-id" },
    },
  ])("shares $label call semantics across TypeScript and Svelte", ({ call, edit, id, meta }) => {
    for (const [filename, source] of [
      ["message.ts", call],
      ["message.svelte", `<script lang="ts">${call}</script>`],
    ] as const) {
      const first = analyzeSourceFile(source, filename, markers)
      const transformed = applyEdits(source, first.edits)
      const second = analyzeSourceFile(transformed, filename, markers)

      expect(first.messages[0]).toMatchObject({
        defaultMessage: expect.any(String),
        id: id ?? expect.any(String),
        meta,
      })
      expect(first.diagnostics).toBeUndefined()
      if (edit) expect(transformed).toContain(edit)
      else expect(first.edits).toEqual([])
      expect(second.messages[0]).toMatchObject({
        defaultMessage: first.messages[0]?.defaultMessage,
        id: first.messages[0]?.id,
        placeholders: first.messages[0]?.placeholders,
      })
      expect(second.edits).toEqual([])
    }
  })

  test.each([
    {
      call: `t("Hello {name}", valuesOrOptions)`,
      code: "ambiguous-call-arguments",
      label: "opaque second argument",
    },
    {
      call: `t("Hello {name}", { name }, options)`,
      code: "ambiguous-call-arguments",
      label: "opaque third argument",
    },
    {
      call: `t("Hello {name}", { ...values })`,
      code: "ambiguous-call-arguments",
      label: "spread-only second argument",
    },
    {
      call: `t("Save", { id: "first-id", id: dynamicId })`,
      code: "dynamic-lookup-id",
      label: "last-write dynamic id",
    },
  ])("shares $label diagnostics across TypeScript and Svelte", ({ call, code }) => {
    for (const [filename, source] of [
      ["message.ts", call],
      ["message.svelte", `<script lang="ts">${call}</script>`],
    ] as const) {
      const analysis = analyzeSourceFile(source, filename, markers)

      expect(analysis.messages).toEqual([])
      expect(analysis.edits).toEqual([])
      expect(analysis.diagnostics?.map((diagnostic) => diagnostic.code)).toEqual([code])
    }
  })

  test.each([
    [`t("Save")`, `t("Save", { id: "${getMessageId("Save")}" })`],
    [`t("Hello {name}", { name })`, `t("Hello {name}", { name }, { id: "${getMessageId("Hello {name}")}" })`],
    [`t("Save", "button")`, `t("Save", { id: "${getMessageId("Save", { context: "button" })}", context: "button" })`],
    [
      `t("Hello {name}", { name }, "button")`,
      `t("Hello {name}", { name }, { id: "${getMessageId("Hello {name}", { context: "button" })}", context: "button" })`,
    ],
    [
      `t("Save", { context: "button" })`,
      `t("Save", { id: "${getMessageId("Save", { context: "button" })}", context: "button" })`,
    ],
    [
      `t("Hello {name}", { name }, { context: "button" })`,
      `t("Hello {name}", { name }, { id: "${getMessageId("Hello {name}", { context: "button" })}", context: "button" })`,
    ],
  ])("materializes every call edit form idempotently in both adapters", (call, expected) => {
    for (const [filename, source, transformedSource] of [
      ["message.ts", call, expected],
      ["message.svelte", `<script>${call}</script>`, `<script>${expected}</script>`],
    ] as const) {
      const first = analyzeSourceFile(source, filename, markers)
      const transformed = applyEdits(source, first.edits)

      expect(transformed).toBe(transformedSource)
      expect(analyzeSourceFile(transformed, filename, markers).edits).toEqual([])
    }
  })

  test.each([
    ["message.ts", `t("Hello {id} in {context}", { id, context })`],
    ["message.svelte", `<script>t("Hello {id} in {context}", { id, context })</script>`],
  ])("classifies id and context as values when they are Message placeholders in %s", (filename, source) => {
    const analysis = analyzeSourceFile(source, filename, markers)
    const transformed = applyEdits(source, analysis.edits)

    expect(analysis.messages[0]).toMatchObject({
      defaultMessage: "Hello {id} in {context}",
      meta: {},
      placeholders: ["id", "context"],
    })
    expect(analysis.diagnostics).toBeUndefined()
    expect(transformed).toContain(`{ id, context }, { id: "${analysis.messages[0]?.id}" }`)
  })

  test.each(["message.tsx", "message.svelte"])("uses one placeholder-name grammar in %s", (filename) => {
    const analysis = analyzeSourceFile(`<T>Hello <Var name="first-name" value={name} /></T>`, filename, markers)

    expect(analysis.messages).toEqual([])
    expect(analysis.edits).toEqual([])
    expect(analysis.diagnostics?.map(({ code }) => code)).toContain("invalid-placeholder-name")
  })

  test.each(["message.tsx", "message.svelte"])("deduplicates placeholder metadata in %s", (filename) => {
    const source = `<T><Var name="1st" value={value} /> <Var name="1st" value={value} /></T>`
    const analysis = analyzeSourceFile(source, filename, markers)
    const transformed = applyEdits(source, analysis.edits)

    expect(analysis.messages[0]?.placeholders).toEqual(["1st"])
    if (filename.endsWith(".svelte")) expect(transformed).toContain(`values={{ "1st": value }}`)
    else expect(transformed).not.toContain("values={{")
    expect(analyzeSourceFile(transformed, filename, markers).parsed).toBe(true)
  })

  test.each(["message.tsx", "message.svelte"])("uses an own property for a generated __proto__ placeholder in %s", (filename) => {
    const source = `<T>Hello <Var name="__proto__" value={value} /></T>`
    const analysis = analyzeSourceFile(source, filename, markers)
    const transformed = applyEdits(source, analysis.edits)

    if (filename.endsWith(".svelte")) expect(transformed).toContain(`values={{ ["__proto__"]: value }}`)
    else expect(transformed).not.toContain("values={{")
    expect(analyzeSourceFile(transformed, filename, markers).parsed).toBe(true)
  })

  test.each(["message.tsx", "message.svelte"])(
    "extracts static quoted and template-literal expression children in %s",
    (filename) => {
      const source = '<T>{"Hello"} {`world`}</T>'
      const analysis = analyzeSourceFile(source, filename, markers)

      expect(analysis.messages[0]?.defaultMessage).toBe("Hello world")
      expect(analysis.diagnostics).toBeUndefined()
    },
  )

  test("rejects source extensions that have no source-analysis adapter", () => {
    expect(analyzeSourceFile(`t("Not source code")`, "styles.css", markers)).toEqual({
      edits: [],
      messages: [],
      parsed: false,
    })
  })

  test.each([
    ["message.tsx", `<T>Hello {name}</T>`],
    ["message.svelte", `<T>Hello {name}</T>`],
  ])("returns a structured diagnostic for non-static content in %s", (filename, source) => {
    const analysis = analyzeSourceFile(source, filename, markers)

    expect(analysis.messages).toEqual([])
    expect(analysis.diagnostics?.map(({ code }) => code)).toContain("non-static-message")
  })

  test("numbers nested shorthand, imported, namespaced, and custom Fragment forms in preorder", () => {
    const source = `
      import { Fragment as ImportedFragment } from "react"
      import * as React from "react"
      const message = (
        <T>
          <>A<strong>B</strong></>
          <ImportedFragment>C</ImportedFragment>
          <React.Fragment>D</React.Fragment>
          <Fragment>E</Fragment>
        </T>
      )
    `

    expect(analyzeSourceFile(source, "message.tsx", markers).messages[0]?.defaultMessage).toBe(
      "<0>A<1>B</1></0><2>C</2><3>D</3><4>E</4>",
    )
  })
})

describe("rich-text extraction", () => {
  test("extracts static intrinsic JSX elements as numbered rich-text tags", () => {
    const analysis = analyzeTypeScriptSourceFile(
      `
        const content = (
          <T>
            Always make sure{" "}
            <strong className="font-semibold">
              you are <i>safe</i> first
            </strong>
            {" "}
            before approaching the casualty.
            <br />
          </T>
        )
      `,
      "example.tsx",
      markers,
    )

    expect(analysis.messages).toHaveLength(1)
    expect(analysis.messages[0]?.defaultMessage).toBe(
      "Always make sure <0>you are <1>safe</1> first</0> before approaching the casualty.<2/>",
    )
    expect(analysis.edits.some((edit) => edit.replacement.includes('message={"Always make sure <0>'))).toBe(true)
  })

  test("extracts Var placeholders nested inside rich-text elements", () => {
    const analysis = analyzeTypeScriptSourceFile(
      `const content = <T>Delete <strong><Var name={event.name} /></strong></T>`,
      "example.tsx",
      markers,
    )

    expect(analysis.messages[0]?.defaultMessage).toBe("Delete <0>{name}</0>")
    expect(analysis.messages[0]?.placeholders).toEqual(["name"])
    expect(analysis.edits.some((edit) => edit.replacement.startsWith(" values={{"))).toBe(false)
  })

  test("extracts custom React component identifiers beginning with underscores or dollar signs", () => {
    const analysis = analyzeTypeScriptSourceFile(`const content = <T><_B>first</_B><$B>second</$B></T>`, "example.tsx", markers)

    expect(analysis.messages[0]?.defaultMessage).toBe("<0>first</0><1>second</1>")
  })

  test("keeps dynamic JSX and unsafe intrinsic elements outside the static rich-text contract", () => {
    const dynamic = analyzeTypeScriptSourceFile(
      `const content = <T>Hello {important && <strong>there</strong>}</T>`,
      "example.tsx",
      markers,
    )
    const custom = analyzeTypeScriptSourceFile(
      `const content = <T>Hello <Highlight>there</Highlight></T>`,
      "example.tsx",
      markers,
    )
    const executable = analyzeTypeScriptSourceFile(
      `const content = <T>Hello <script>alert("no")</script></T>`,
      "example.tsx",
      markers,
    )
    const selfClosingChildren = analyzeTypeScriptSourceFile(
      `const content = <T>Hello <span children="unextracted" /></T>`,
      "example.tsx",
      markers,
    )

    expect(dynamic.messages).toEqual([])
    expect(custom.messages[0]?.defaultMessage).toBe("Hello <0>there</0>")
    expect(executable.messages).toEqual([])
    expect(selfClosingChildren.messages).toEqual([])
  })
})

describe("generated Svelte integration", () => {
  test("evaluates a generated Svelte placeholder value once", async () => {
    const svelteRuntimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/svelte/runtime.ts")).href
    const TComponent = await compileSvelteFile(resolve(import.meta.dir, "../src/svelte/T.svelte"), {
      "../svelte-runtime.mjs": svelteRuntimeUrl,
    })
    const VarComponent = await compileSvelteProbe(`<script>let { value } = $props()</script>{value}`)
    const source = `
      <script>
        import { setMessages } from ${JSON.stringify(svelteRuntimeUrl)}
        let { T, Var } = $props()
        let calls = 0
        function compute() {
          calls += 1
          return "safe"
        }
        setMessages({ value: "Translated {value}" })
      </script>
      <T id="value">Value <Var name="value" value={compute()} /></T><output>{calls}</output>
    `
    const transformed = applyEdits(source, analyzeSvelteSourceFile(source, "value.svelte", markers).edits)
    const Consumer = await compileSvelteProbe(transformed)

    expect(
      render(Consumer, { props: { T: TComponent, Var: VarComponent } })
        .body.replace(/<!--.*?-->/g, "")
        .trim(),
    ).toBe("Translated safe<output>1</output>")
  })
})
