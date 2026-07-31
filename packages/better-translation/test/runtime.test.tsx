import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { act, cloneElement, Fragment, type ReactNode, useState } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { compile } from "svelte/compiler"
import { render } from "svelte/server"

import { getMessageId } from "../src/message/id.js"
import { hasSameMessageStructure } from "../src/message/template.js"
import { T, TranslateProvider, Var, useT, type TProps } from "../src/react.js"
import { createT } from "../src/runtime.js"
import { compileSvelteFile, compileSvelteProbe, type SvelteProbeComponent } from "./svelte-probe.js"

type TransformedTProps = TProps & {
  message?: string
  values?: Record<string, ReactNode>
}

const TransformedT = T as (props: TransformedTProps) => ReturnType<typeof T>

describe("rich-text rendering", () => {
  test("renders custom React component identifiers beginning with underscores or dollar signs", () => {
    function _B({ children }: { children: ReactNode }) {
      return <b data-component="underscore">{children}</b>
    }
    function $B({ children }: { children: ReactNode }) {
      return <i data-component="dollar">{children}</i>
    }

    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ custom: "<1>second translated</1><0>first translated</0>" }}>
        <TransformedT id="custom" message="<0>first</0><1>second</1>">
          <_B>first</_B>
          <$B>second</$B>
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe('<i data-component="dollar">second translated</i><b data-component="underscore">first translated</b>')
  })

  test("renders translated children through source-owned React components", () => {
    function B({ children }: { children: ReactNode }) {
      return <b data-emphasis="custom">{children}</b>
    }
    const Text = {
      Italic: ({ children }: { children: ReactNode }) => <i data-emphasis="member">{children}</i>,
    }

    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ custom: "Blijf <0>altijd veilig</0> met <1>aandacht</1>." }}>
        <TransformedT id="custom" message="Stay <0>safe</0> with <1>care</1>.">
          Stay <B>safe</B> with <Text.Italic>care</Text.Italic>.
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe('Blijf <b data-emphasis="custom">altijd veilig</b> met <i data-emphasis="member">aandacht</i>.')
  })

  test("renders explicit React Fragments as invisible rich-text slots", () => {
    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ fragment: "Voor <0>vertaald</0> na" }}>
        <TransformedT id="fragment" message="Before <0>source</0> after">
          Before <Fragment>source</Fragment> after
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe("Voor vertaald na")
  })

  test("keeps state attached to authored custom-component slots when a translation reorders them", () => {
    const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
      JSDOM: new (html: string) => {
        window: {
          document: Document
          navigator: Navigator
          Node: typeof Node
          HTMLElement: typeof HTMLElement
          close: () => void
        }
      }
    }
    const dom = new JSDOM('<div id="root"></div>')
    const testGlobal = globalThis as unknown as Record<string, unknown>
    const globalValues = {
      window: dom.window,
      document: dom.window.document,
      navigator: dom.window.navigator,
      Node: dom.window.Node,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    }
    const originalDescriptors = new Map(
      Object.keys(globalValues).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    )

    for (const [name, value] of Object.entries(globalValues)) {
      Object.defineProperty(globalThis, name, { configurable: true, value, writable: true })
    }

    function StatefulSlot({ children, source }: { children: ReactNode; source: string }) {
      const [authoredSource] = useState(source)
      return <span data-authored-source={authoredSource}>{children}</span>
    }

    function StatefulMessage({ template }: { template: string }) {
      return (
        <TranslateProvider messages={{ stateful: template }}>
          <TransformedT id="stateful" message="<0>Alpha</0><1>Beta</1>">
            <StatefulSlot source="alpha">Alpha</StatefulSlot>
            <StatefulSlot source="beta">Beta</StatefulSlot>
          </TransformedT>
        </TranslateProvider>
      )
    }

    const container = dom.window.document.getElementById("root")
    if (!container) throw new Error("Expected the test root")
    const root = createRoot(container)

    try {
      act(() => root.render(<StatefulMessage template="<0>Alpha</0><1>Beta</1>" />))
      act(() => root.render(<StatefulMessage template="<1>Bèta</1><0>Alfa</0>" />))

      expect(container.innerHTML).toBe(
        '<span data-authored-source="beta">Bèta</span><span data-authored-source="alpha">Alfa</span>',
      )
    } finally {
      act(() => root.unmount())
      dom.window.close()
      for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else delete testGlobal[name]
      }
    }
  })

  test("applies a translated Locale update without remounting the React subtree", () => {
    const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
      JSDOM: new (html: string) => {
        window: Window & typeof globalThis
      }
    }
    const dom = new JSDOM('<div id="root"></div>')
    const testGlobal = globalThis as unknown as Record<string, unknown>
    const globalValues = {
      window: dom.window,
      document: dom.window.document,
      navigator: dom.window.navigator,
      Node: dom.window.Node,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    }
    const originalDescriptors = new Map(
      Object.keys(globalValues).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    )

    for (const [name, value] of Object.entries(globalValues)) {
      Object.defineProperty(globalThis, name, { configurable: true, value, writable: true })
    }

    let mountCount = 0
    function StatefulMessage() {
      const [mount] = useState(() => {
        mountCount += 1
        return mountCount
      })
      return (
        <span data-mount={mount}>
          <TransformedT id="greeting" message="Hello">
            Hello
          </TransformedT>
        </span>
      )
    }

    const container = dom.window.document.getElementById("root")
    if (!container) throw new Error("Expected the test root")
    const root = createRoot(container)

    try {
      act(() =>
        root.render(
          <TranslateProvider locale="fr" messages={{}}>
            <StatefulMessage />
          </TranslateProvider>,
        ),
      )
      expect(container.innerHTML).toBe('<span data-mount="1">Hello</span>')

      act(() => {
        dom.window.dispatchEvent(
          new dom.window.CustomEvent("better-translation:locale-values", {
            detail: { locale: "es", messages: { greeting: "Hola" } },
          }),
        )
      })
      expect(container.innerHTML).toBe('<span data-mount="1">Hello</span>')

      act(() => {
        dom.window.dispatchEvent(
          new dom.window.CustomEvent("better-translation:locale-values", {
            detail: { locale: "fr", messages: { greeting: "Bonjour" } },
          }),
        )
      })

      expect(container.innerHTML).toBe('<span data-mount="1">Bonjour</span>')
      expect(mountCount).toBe(1)
    } finally {
      act(() => root.unmount())
      dom.window.close()
      for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else delete testGlobal[name]
      }
    }
  })

  test("reorders translated Rich-text slots while preserving their JSX props", () => {
    const html = renderToStaticMarkup(
      <TranslateProvider
        messages={{
          safety: "Before approaching the casualty, <0>always ensure <1>your own safety</1> first</0>.<2/>",
        }}
      >
        <TransformedT
          id="safety"
          message="Always make sure <0>you are <1>safe</1> first</0> before approaching the casualty.<2/>"
        >
          Always make sure{" "}
          <strong className="font-semibold">
            you are <i>safe</i> first
          </strong>{" "}
          before approaching the casualty.
          <br />
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe(
      'Before approaching the casualty, <strong class="font-semibold">always ensure <i>your own safety</i> first</strong>.<br/>',
    )
  })

  test("interpolates Var values inside translated Rich-text slots", () => {
    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ delete: "<0>{name}</0> verwijderen" }}>
        <TransformedT id="delete" message="Delete <0>{name}</0>" values={{ name: "Event" }}>
          Delete{" "}
          <strong>
            <Var name="Event" />
          </strong>
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe("<strong>Event</strong> verwijderen")
  })

  test("falls back to the authored JSX when translated rich-text structure is invalid", () => {
    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ safety: "Veiligheid <0>eerst" }}>
        <TransformedT id="safety" message="Safety <0>first</0>">
          Safety <strong>first</strong>
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe("Safety <strong>first</strong>")
  })

  test("renders explicit Var values when malformed rich text falls back to authored JSX", () => {
    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ total: "Waarde <0>{total}" }}>
        <TransformedT id="total" message="Value <0>{total}</0>" values={{ total: 42 }}>
          Value{" "}
          <strong>
            <Var name="total" value={42} />
          </strong>
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe("Value <strong>42</strong>")
  })

  test("preserves meaningful spaces inside Rich-text slots", () => {
    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ spacing: "Hallo<0> heel <1>veilig</1> persoon </0>vandaag" }}>
        <TransformedT id="spacing" message="Hello<0> very <1>safe</1> person </0>today">
          Hello
          <strong>
            {" "}
            very <i>safe</i> person{" "}
          </strong>
          today
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe("Hallo<strong> heel <i>veilig</i> persoon </strong>vandaag")
  })

  test("does not place translated children into void or authored self-closing elements", () => {
    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ break: "<0>translated</0>", span: "Move <0/>" }}>
        <TransformedT id="break" message="<0>source</0>">
          <br />
        </TransformedT>
        <TransformedT id="span" message="Move <0/>">
          {cloneElement(<span />, {}, "Authored")}
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe("<br/><span>Authored</span>")
  })
})

describe("runtime regressions", () => {
  test("treats lookup ids and placeholder names as own record keys", () => {
    const t = createT({
      ["__proto__"]: "Proto {__proto__}",
      constructor: "Constructor",
      toString: "String",
    })

    expect(t("fallback", { id: "__proto__" })).toBe("Proto {__proto__}")
    expect(t("fallback", { id: "constructor" })).toBe("Constructor")
    expect(t("fallback", { id: "toString" })).toBe("String")
    expect(t("fallback", { ["__proto__"]: "safe" }, { id: "__proto__" })).toBe("Proto safe")
    expect(createT({})("fallback", { id: "constructor" })).toBe("fallback")
    expect(createT({})("Hello {toString}", {})).toBe("Hello {toString}")
  })

  test("keeps runtime-only unsupported React elements as authored fallback", () => {
    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ shared: "Translated" }}>
        <TransformedT id="shared">
          <button type="button">Pay</button>
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe('<button type="button">Pay</button>')
  })

  test("keeps template validation and runtime classification private", async () => {
    expect(Object.keys(await import("../src/runtime.js"))).toEqual(["createT"])
  })

  test("allows a translated Rich-text slot to intentionally have no children", () => {
    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ safety: "Before <0></0> after" }}>
        <TransformedT id="safety" message="Before <0>safe</0> after">
          Before <strong>safe</strong> after
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe("Before <strong></strong> after")
  })

  test("falls back for a malformed translated rich-text closing tag", () => {
    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ safety: "<0>veilig</0/>" }}>
        <TransformedT id="safety" message="<0>safe</0>">
          <strong>safe</strong>
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe("<strong>safe</strong>")
  })

  test("renders nested named and shorthand React Fragments as invisible rich-text slots", () => {
    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ fragment: "<0>Voor <1><2>veilig</2></1></0>" }}>
        <TransformedT id="fragment" message="<0>Before <1><2>safe</2></1></0>">
          <Fragment>
            Before{" "}
            <>
              <strong>safe</strong>
            </>
          </Fragment>
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe("Voor <strong>veilig</strong>")
  })

  test("retains authored rich-text keys and their remount semantics", () => {
    const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
      JSDOM: new (html: string) => {
        window: {
          document: Document
          navigator: Navigator
          Node: typeof Node
          HTMLElement: typeof HTMLElement
          close: () => void
        }
      }
    }
    const dom = new JSDOM('<div id="root"></div>')
    const testGlobal = globalThis as unknown as Record<string, unknown>
    const globalValues = {
      window: dom.window,
      document: dom.window.document,
      navigator: dom.window.navigator,
      Node: dom.window.Node,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    }
    const originalDescriptors = new Map(
      Object.keys(globalValues).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    )
    let mounts = 0

    for (const [name, value] of Object.entries(globalValues)) {
      Object.defineProperty(globalThis, name, { configurable: true, value, writable: true })
    }

    function Slot({ children }: { children: ReactNode }) {
      const [mount] = useState(() => ++mounts)
      return <span data-mount={mount}>{children}</span>
    }

    function Message({ version }: { version: number }) {
      return (
        <TranslateProvider messages={{ keyed: "<0>translated</0>" }}>
          <TransformedT id="keyed" message="<0>source</0>">
            <Slot key={version}>source</Slot>
          </TransformedT>
        </TranslateProvider>
      )
    }

    const container = dom.window.document.getElementById("root")
    if (!container) throw new Error("Expected the test root")
    const root = createRoot(container)

    try {
      act(() => root.render(<Message version={1} />))
      act(() => root.render(<Message version={2} />))
      expect(container.innerHTML).toBe('<span data-mount="2">translated</span>')
    } finally {
      act(() => root.unmount())
      dom.window.close()
      for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else delete testGlobal[name]
      }
    }
  })

  test("uses explicit null and undefined Var values instead of authored fallbacks", () => {
    expect(
      renderToStaticMarkup(
        <>
          <Var name="null" value={null}>
            source
          </Var>
          <Var name="undefined" value={undefined}>
            source
          </Var>
        </>,
      ),
    ).toBe("")
  })

  test("preserves authored JSX on the compiled Default-locale fast path", () => {
    const sourceMessage = "Always <0>{status}</0>"
    const html = renderToStaticMarkup(
      <TranslateProvider messages={{ safety: sourceMessage }}>
        <TransformedT id="safety" message={sourceMessage} values={{ status: "safe" }}>
          Always{" "}
          <strong>
            <Var status="safe" />
          </strong>
        </TransformedT>
      </TranslateProvider>,
    )

    expect(html).toBe("Always <strong>safe</strong>")
  })

  test("disambiguates id and context placeholders from lookup options", () => {
    const message = "Project {id} in {context}"
    const t = createT({
      explicit: "Pay translated",
      [getMessageId("Archive", { context: "verb" })]: "Archive translated",
      [getMessageId(message)]: "Project {id} in the {context}",
    })

    expect(t(message, { id: 42, context: "menu" })).toBe("Project 42 in the menu")
    expect([t("Pay", { id: "explicit" }), t("Archive", { context: "verb" })]).toEqual(["Pay translated", "Archive translated"])
  })

  test("shares plain translator behavior through the React hook", () => {
    const message = "Project {id}"

    function Label() {
      return useT()(message, { id: 42 })
    }

    expect(
      renderToStaticMarkup(
        <TranslateProvider messages={{ [getMessageId(message)]: "Translated project {id}" }}>
          <Label />
        </TranslateProvider>,
      ),
    ).toBe("Translated project 42")
  })

  test("keeps a Svelte translator attached to the latest Locale values", async () => {
    const runtimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/svelte/runtime.ts")).href
    const Component = await compileSvelteProbe(`
      <script>
        import { getT, setMessages } from ${JSON.stringify(runtimeUrl)}
        let { capture, getMessages } = $props()
        setMessages(getMessages)
        capture(getT())
      </script>
    `)
    const state = { messages: { explicit: "First" } }
    let t: ReturnType<typeof createT> | undefined

    void render(Component, {
      props: {
        capture: (translator: ReturnType<typeof createT>) => {
          t = translator
        },
        getMessages: () => state.messages,
      },
    }).body
    if (!t) throw new Error("Expected the Svelte translator")

    expect(t("Source", { id: "explicit" })).toBe("First")
    state.messages = { explicit: "Second" }
    expect(t("Source", { id: "explicit" })).toBe("Second")
  })

  test("applies a translated Locale update without remounting the Svelte subtree", async () => {
    const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
      JSDOM: new (html: string) => {
        window: Window & typeof globalThis
      }
    }
    const directory = mkdtempSync(resolve(import.meta.dir, ".svelte-hot-locale-"))

    try {
      const runtimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/runtime.ts")).href
      const messageTemplateUrl = pathToFileURL(resolve(import.meta.dir, "../src/message/template.ts")).href
      const hotLocaleValuesUrl = pathToFileURL(resolve(import.meta.dir, "../src/runtime/hot-locale-values.ts")).href
      const svelteUrl = pathToFileURL(resolve(import.meta.dir, "../node_modules/svelte/src/index-client.js")).href
      writeFileSync(
        resolve(directory, "svelte-runtime.mjs"),
        `
          import { getContext, setContext } from ${JSON.stringify(svelteUrl)}
          import {
            hasSameRichTextStructure,
            parseRichTextMessage,
          } from ${JSON.stringify(messageTemplateUrl)}

          const key = "better-translation"
          const empty = {}

          export function setMessages(messages) {
            const getMessages = typeof messages === "function" ? messages : () => messages
            return setContext(key, { getMessages })
          }

          export function getMessagesReader() {
            return getContext(key)?.getMessages ?? (() => empty)
          }

          export function getMessages() {
            return getMessagesReader()()
          }

          export function getMessage(messages, id) {
            return Object.hasOwn(messages, id) ? messages[id] : undefined
          }

          export function normalizeValues(values) {
            if (!values) return undefined
            const normalized = Object.create(null)
            for (const [name, value] of Object.entries(values)) normalized[name] = String(value)
            return Object.keys(normalized).length > 0 ? normalized : undefined
          }

          export const parseSvelteRichTextMessage = parseRichTextMessage

          export function resolveSvelteRichTextNodes(source, translated) {
            if (!source) return undefined
            if (!translated || !hasSameRichTextStructure(source.structure, translated.structure)) {
              return source.nodes
            }
            return translated.nodes
          }
        `,
      )
      const provider = compile(readFileSync(resolve(import.meta.dir, "../src/svelte/TranslateProvider.svelte"), "utf8"), {
        filename: "TranslateProvider.svelte",
        generate: "client",
      })
        .js.code.replaceAll("../svelte-runtime.mjs", "./svelte-runtime.mjs")
        .replaceAll("../runtime/hot-locale-values.js", hotLocaleValuesUrl)
        .replaceAll(`from "svelte"`, `from ${JSON.stringify(svelteUrl)}`)
      const translation = compile(readFileSync(resolve(import.meta.dir, "../src/svelte/T.svelte"), "utf8"), {
        filename: "T.svelte",
        generate: "client",
      })
        .js.code.replaceAll("../runtime.mjs", runtimeUrl)
        .replaceAll("../svelte-runtime.mjs", "./svelte-runtime.mjs")
      const app = compile(
        `
          <script>
            import T from "./T.mjs"
            import TranslateProvider from "./TranslateProvider.mjs"

            let count = $state(0)
          </script>

          <TranslateProvider locale="fr" messages={{ greeting: "<0>Initial</0>" }}>
            <button id="count" onclick={() => count += 1}>{count}</button>
            <T id="greeting" message={"<0>Hello</0>"}>
              {#snippet __better_translation_0(children)}
                <strong>{@render children()}</strong>
              {/snippet}
            </T>
          </TranslateProvider>
        `,
        { filename: "App.svelte", generate: "client" },
      ).js.code
      writeFileSync(resolve(directory, "TranslateProvider.mjs"), provider)
      writeFileSync(resolve(directory, "T.mjs"), translation)
      writeFileSync(resolve(directory, "App.mjs"), app)

      const dom = new JSDOM('<div id="root"></div>')
      const testGlobal = globalThis as unknown as Record<string, unknown>
      const globalValues = {
        Comment: dom.window.Comment,
        CustomEvent: dom.window.CustomEvent,
        document: dom.window.document,
        Element: dom.window.Element,
        Event: dom.window.Event,
        HTMLElement: dom.window.HTMLElement,
        MouseEvent: dom.window.MouseEvent,
        navigator: dom.window.navigator,
        Node: dom.window.Node,
        Text: dom.window.Text,
        window: dom.window,
      }
      const originalDescriptors = new Map(
        Object.keys(globalValues).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
      )

      for (const [name, value] of Object.entries(globalValues)) {
        Object.defineProperty(globalThis, name, { configurable: true, value, writable: true })
      }

      try {
        const { flushSync, mount, unmount } = await import(
          pathToFileURL(resolve(import.meta.dir, "../node_modules/svelte/src/index-client.js")).href
        )
        const App = (await import(pathToFileURL(resolve(directory, "App.mjs")).href)) as {
          default: SvelteProbeComponent
        }
        const target = dom.window.document.querySelector("#root")
        if (!target) throw new Error("Expected the Svelte mount root")
        const mounted = mount(App.default, { target })
        await Promise.resolve()
        flushSync()

        target.querySelector<HTMLButtonElement>("#count")?.click()
        flushSync()
        expect(target.querySelector("#count")?.textContent).toBe("1")
        expect(target.querySelector("strong")?.textContent).toBe("Initial")

        dom.window.dispatchEvent(
          new dom.window.CustomEvent("better-translation:locale-values", {
            detail: { locale: "fr", messages: { greeting: "<0>Bonjour</0>" } },
          }),
        )
        await Promise.resolve()
        flushSync()

        expect(target.querySelector("#count")?.textContent).toBe("1")
        expect(target.querySelector("strong")?.textContent).toBe("Bonjour")
        await unmount(mounted)
      } finally {
        dom.window.close()
        for (const [name, descriptor] of originalDescriptors) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor)
          else delete testGlobal[name]
        }
      }
    } finally {
      rmSync(directory, { recursive: true })
    }
  })

  test("treats Svelte lookup ids as own record keys", async () => {
    const runtimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/runtime.ts")).href
    const svelteRuntimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/svelte/runtime.ts")).href
    const TComponent = await compileSvelteFile(resolve(import.meta.dir, "../src/svelte/T.svelte"), {
      "../runtime.mjs": runtimeUrl,
      "../svelte-runtime.mjs": svelteRuntimeUrl,
    })
    const Consumer = await compileSvelteProbe(`
      <script>
        import { setMessages } from ${JSON.stringify(svelteRuntimeUrl)}
        let { Component } = $props()
        setMessages({ "": "Translated" })
      </script>
      <Component id="constructor" message="Source">Source</Component>
      <Component id="" message="Source">Source</Component>
    `)

    expect(render(Consumer, { props: { Component: TComponent } }).body.replace(/<!--.*?-->/g, "")).toBe("Source Translated")
  })

  test("preserves explicit null in the Svelte Var component", async () => {
    const Component = await compileSvelteFile(resolve(import.meta.dir, "../src/svelte/Var.svelte"))

    expect(render(Component, { props: { name: "value", value: null } }).body.replace(/<!--.*?-->/g, "")).toBe("")
  })

  test("distinguishes an empty Svelte Locale value from an intentionally empty interpolation", async () => {
    const runtimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/runtime.ts")).href
    const svelteRuntimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/svelte/runtime.ts")).href
    const TComponent = await compileSvelteFile(resolve(import.meta.dir, "../src/svelte/T.svelte"), {
      "../runtime.mjs": runtimeUrl,
      "../svelte-runtime.mjs": svelteRuntimeUrl,
    })
    const EmptyInterpolation = await compileSvelteProbe(`
      <script>
        import { setMessages } from ${JSON.stringify(svelteRuntimeUrl)}
        let { Component } = $props()
        setMessages({ value: "{value}" })
      </script>
      <Component id="value" message={"Value: {value}"} values={{ value: "" }} />
    `)
    const MissingEmptyLocale = await compileSvelteProbe(`
      <script>
        import { setMessages } from ${JSON.stringify(svelteRuntimeUrl)}
        let { Component } = $props()
        setMessages({ empty: "" })
      </script>
      <Component id="empty" message="Source" />
    `)

    expect(render(EmptyInterpolation, { props: { Component: TComponent } }).body.replace(/<!--.*?-->/g, "")).toBe("")
    expect(render(MissingEmptyLocale, { props: { Component: TComponent } }).body.replace(/<!--.*?-->/g, "")).toBe("Source")
  })

  test("renders translated Svelte rich text through source-owned elements and components", async () => {
    const runtimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/runtime.ts")).href
    const svelteRuntimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/svelte/runtime.ts")).href
    const TComponent = await compileSvelteFile(resolve(import.meta.dir, "../src/svelte/T.svelte"), {
      "../runtime.mjs": runtimeUrl,
      "../svelte-runtime.mjs": svelteRuntimeUrl,
    })
    const Badge = await compileSvelteProbe(`
      <script>
        let { tone, children } = $props()
      </script>
      <i data-tone={tone}>{@render children?.()}</i>
    `)
    const Consumer = await compileSvelteProbe(`
      <script>
        import { setMessages } from ${JSON.stringify(svelteRuntimeUrl)}
        let { Badge, Component, handle, messages } = $props()
        setMessages(messages)
      </script>
      <Component
        id="safety"
        message={"Always <0>be <1>{name}</1></0> before approaching.<2/>"}
        values={{ name: "safe" }}
      >
        {#snippet __better_translation_0(children)}
          <strong class="important" onclick={handle}>{@render children()}</strong>
        {/snippet}
        {#snippet __better_translation_1(children)}
          <Badge tone="high">{@render children()}</Badge>
        {/snippet}
        {#snippet __better_translation_2(_children)}
          <br />
        {/snippet}
      </Component>
    `)

    expect(
      render(Consumer, {
        props: {
          Badge,
          Component: TComponent,
          handle: () => undefined,
          messages: {
            safety: "Before approaching, <0>always be <1>{name}</1></0>.<2/>",
          },
        },
      }).body.replace(/<!--.*?-->/g, ""),
    ).toBe('Before approaching, <strong class="important">always be <i data-tone="high">safe</i></strong>.<br/>')

    for (const invalid of [
      "Broken <0>always <1>{name}</0></1>.<2/>",
      "Before approaching, <0>always be</0> <1>{name}</1>.<2/>",
    ]) {
      expect(
        render(Consumer, {
          props: {
            Badge,
            Component: TComponent,
            handle: () => undefined,
            messages: { safety: invalid },
          },
        }).body.replace(/<!--.*?-->/g, ""),
      ).toBe('Always <strong class="important">be <i data-tone="high">safe</i></strong> before approaching.<br/>')
    }
  })

  test("falls back to authored Svelte children when a rich renderer is missing", async () => {
    const runtimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/runtime.ts")).href
    const svelteRuntimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/svelte/runtime.ts")).href
    const TComponent = await compileSvelteFile(resolve(import.meta.dir, "../src/svelte/T.svelte"), {
      "../runtime.mjs": runtimeUrl,
      "../svelte-runtime.mjs": svelteRuntimeUrl,
    })
    const Consumer = await compileSvelteProbe(`
      <script>
        import { setMessages } from ${JSON.stringify(svelteRuntimeUrl)}
        let { Component } = $props()
        setMessages({ safety: "Translated <0>safe</0>" })
      </script>
      <Component id="safety" message={"Source <0>safe</0>"}>
        Authored <strong>safe</strong>
      </Component>
    `)

    expect(render(Consumer, { props: { Component: TComponent } }).body.replace(/<!--.*?-->/g, "")).toBe(
      "Authored <strong>safe</strong>",
    )
  })

  test("hydrates Svelte rich text and preserves source element identity through sibling reordering", async () => {
    const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
      JSDOM: new (html: string) => {
        window: Window & typeof globalThis
      }
    }
    const directory = mkdtempSync(resolve(import.meta.dir, ".svelte-hydration-"))
    try {
      const runtimeUrl = pathToFileURL(resolve(import.meta.dir, "../src/runtime.ts")).href
      const messageTemplateUrl = pathToFileURL(resolve(import.meta.dir, "../src/message/template.ts")).href
      const componentSource = readFileSync(resolve(import.meta.dir, "../src/svelte/T.svelte"), "utf8")
      const appSource = `
      <script>
        import T from "./T.svelte"
        import { setMessages } from "__SVELTE_RUNTIME__"

        let reversed = $state(false)
        let clicks = $state(0)
        setMessages(() => ({
          rich: reversed ? "<1>Beta</1><0>Alpha</0>" : "<0>Alpha</0><1>Beta</1>",
        }))
      </script>

      <button id="swap" onclick={() => reversed = true}>swap</button>
      <T id="rich" message={"<0>Alpha</0><1>Beta</1>"}>
        {#snippet __better_translation_0(children)}
          <a
            data-slot="alpha"
            href="/safety"
            onclick={(event) => {
              event.preventDefault()
              clicks += 1
            }}
          >{@render children()}</a>
        {/snippet}
        {#snippet __better_translation_1(children)}
          <strong data-slot="beta">{@render children()}</strong>
        {/snippet}
      </T>
      <output>{clicks}</output>
    `

      for (const generate of ["client", "server"] as const) {
        const svelteUrl = pathToFileURL(resolve(import.meta.dir, `../node_modules/svelte/src/index-${generate}.js`)).href
        writeFileSync(
          resolve(directory, `svelte-runtime.${generate}.mjs`),
          `
          import { getContext, setContext } from ${JSON.stringify(svelteUrl)}
          import {
            hasSameRichTextStructure,
            parseRichTextMessage,
          } from ${JSON.stringify(messageTemplateUrl)}

          const key = "better-translation"
          const empty = {}

          export function setMessages(messages) {
            const getMessages = typeof messages === "function" ? messages : () => messages
            return setContext(key, { getMessages })
          }

          export function getMessages() {
            return getContext(key)?.getMessages() ?? empty
          }

          export function getMessagesReader() {
            return getContext(key)?.getMessages ?? (() => empty)
          }

          export function getMessage(messages, id) {
            return Object.hasOwn(messages, id) ? messages[id] : undefined
          }

          export function normalizeValues(values) {
            if (!values) return undefined
            const normalized = Object.create(null)
            for (const [name, value] of Object.entries(values)) normalized[name] = String(value)
            return Object.keys(normalized).length > 0 ? normalized : undefined
          }

          export const parseSvelteRichTextMessage = parseRichTextMessage

          export function resolveSvelteRichTextNodes(source, translated) {
            if (!source) return undefined
            if (!translated || !hasSameRichTextStructure(source.structure, translated.structure)) {
              return source.nodes
            }
            return translated.nodes
          }
          `,
        )
        const component = compile(componentSource, {
          filename: "T.svelte",
          generate,
        })
          .js.code.replaceAll("../runtime.mjs", runtimeUrl)
          .replaceAll("../svelte-runtime.mjs", `./svelte-runtime.${generate}.mjs`)
        const app = compile(appSource, {
          filename: "App.svelte",
          generate,
        })
          .js.code.replaceAll("./T.svelte", `./T.${generate}.mjs`)
          .replaceAll("__SVELTE_RUNTIME__", `./svelte-runtime.${generate}.mjs`)
        writeFileSync(resolve(directory, `T.${generate}.mjs`), component)
        writeFileSync(resolve(directory, `App.${generate}.mjs`), app)
      }

      const AppServer = (await import(pathToFileURL(resolve(directory, "App.server.mjs")).href)) as {
        default: SvelteProbeComponent
      }
      const body = render(AppServer.default).body
      const dom = new JSDOM(`<div id="root">${body}</div>`)
      const testGlobal = globalThis as unknown as Record<string, unknown>
      const globalValues = {
        Comment: dom.window.Comment,
        document: dom.window.document,
        Element: dom.window.Element,
        Event: dom.window.Event,
        HTMLElement: dom.window.HTMLElement,
        MouseEvent: dom.window.MouseEvent,
        navigator: dom.window.navigator,
        Node: dom.window.Node,
        Text: dom.window.Text,
        window: dom.window,
      }
      const originalDescriptors = new Map(
        Object.keys(globalValues).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
      )

      for (const [name, value] of Object.entries(globalValues)) {
        Object.defineProperty(globalThis, name, { configurable: true, value, writable: true })
      }

      try {
        const { flushSync, hydrate, unmount } = await import(
          pathToFileURL(resolve(import.meta.dir, "../node_modules/svelte/src/index-client.js")).href
        )
        const AppClient = (await import(pathToFileURL(resolve(directory, "App.client.mjs")).href)) as {
          default: SvelteProbeComponent
        }
        const target = dom.window.document.querySelector("#root")
        if (!target) throw new Error("Expected the Svelte hydration root")
        const app = hydrate(AppClient.default, { target })
        const sourceElement = target.querySelector('[data-slot="alpha"]')
        if (!sourceElement) throw new Error("Expected the source-owned rich element")

        sourceElement.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
        flushSync()
        expect(target.querySelector("output")?.textContent).toBe("1")

        target.querySelector<HTMLButtonElement>("#swap")?.click()
        flushSync()
        expect([...target.querySelectorAll("[data-slot]")].map((element) => element.textContent)).toEqual(["Beta", "Alpha"])
        expect(target.querySelector('[data-slot="alpha"]')).toBe(sourceElement)

        sourceElement.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))
        flushSync()
        expect(target.querySelector("output")?.textContent).toBe("2")
        await unmount(app)
      } finally {
        dom.window.close()
        for (const [name, descriptor] of originalDescriptors) {
          if (descriptor) Object.defineProperty(globalThis, name, descriptor)
          else delete testGlobal[name]
        }
      }
    } finally {
      rmSync(directory, { recursive: true })
    }
  })
})

describe("rich-text structure validation", () => {
  test("accepts reordered elements with the same variables and element shapes", () => {
    expect(
      hasSameMessageStructure("Use <0>{name} with <1>care</1></0>.<2/>", "<2/>Gebruik <0><1>voorzichtig</1> {name}</0>."),
    ).toBe(true)
  })

  test("rejects missing variables, mismatched tags, and changed self-closing elements", () => {
    expect(hasSameMessageStructure("Hello {name}", "Hallo")).toBe(false)
    expect(hasSameMessageStructure("Hello {name} {name}", "Hallo {name}")).toBe(false)
    expect(hasSameMessageStructure("Safety <0>first</0>", "Veiligheid <0>eerst")).toBe(false)
    expect(hasSameMessageStructure("Next<0/>", "Volgende<0></0>")).toBe(false)
    expect(hasSameMessageStructure("<0>Use <1>care</1></0>", "<0>Gebruik</0> <1>voorzichtigheid</1>")).toBe(false)
  })
})
