import { MessageInbox } from "@better-translation/locale-editor"
import { describe, expect, test } from "bun:test"
import { createRequire } from "node:module"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"

describe("local editor", () => {
  test("omits Rich-text slot syntax from Message previews", () => {
    const html = renderToStaticMarkup(
      <MessageInbox
        mode="local"
        config={{ appLocale: "en", defaultLocale: "en", locales: ["en", "nl"] }}
        messages={[
          {
            id: "safety",
            lookupId: "safety",
            defaultMessage: "For a perfect score, you only need to <0>count <1>a little</1> better.</0><2/>",
            placeholders: [],
            done: 1,
            total: 1,
          },
        ]}
        selectedMessage={{
          id: "safety",
          lookupId: "safety",
          defaultMessage: "For a perfect score, you only need to <0>count <1>a little</1> better.</0><2/>",
          placeholders: [],
          done: 1,
          total: 1,
          localeValues: {
            nl: {
              value: "Voor een perfecte score hoef je alleen <0>iets <1>beter</1> te tellen.</0><2/>",
              source: "manual",
              hasValue: true,
            },
          },
          sources: [],
        }}
        selectedMessageId="safety"
        search=""
        view="all"
        incompleteCount={0}
        onSearchChange={() => undefined}
        onViewChange={() => undefined}
        onSelectMessage={() => undefined}
        onSaveLocaleValue={() => undefined}
      />,
    )

    expect(html).toContain("For a perfect score, you only need to count a little better.")
    expect(html).toContain("Voor een perfecte score hoef je alleen iets beter te tellen.")
    expect(html).not.toContain("data-rich-text-slot")
    expect(html).not.toContain("&lt;0&gt;")
    expect(html).not.toContain("&lt;/0&gt;")
    expect(html).not.toContain("&lt;2/&gt;")
  })

  test("distinguishes Variable placeholders from Rich-text slots", () => {
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
      Element: dom.window.Element,
      HTMLElement: dom.window.HTMLElement,
      IS_REACT_ACT_ENVIRONMENT: true,
    }
    const originalDescriptors = new Map(
      Object.keys(globalValues).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
    )

    for (const [name, value] of Object.entries(globalValues)) {
      Object.defineProperty(globalThis, name, { configurable: true, value, writable: true })
    }

    const container = dom.window.document.getElementById("root")
    if (!container) throw new Error("Expected the test root")
    const root = createRoot(container)

    try {
      act(() =>
        root.render(
          <MessageInbox
            mode="local"
            config={{ appLocale: "en", defaultLocale: "en", locales: ["en", "nl"] }}
            messages={[
              {
                id: "welcome",
                lookupId: "welcome",
                defaultMessage: "Welcome <0>{name}</0><1/>",
                placeholders: ["name"],
                done: 0,
                total: 1,
              },
            ]}
            selectedMessage={{
              id: "welcome",
              lookupId: "welcome",
              defaultMessage: "Welcome <0>{name}</0><1/>",
              placeholders: ["name"],
              done: 0,
              total: 1,
              localeValues: {},
              sources: [],
            }}
            selectedMessageId="welcome"
            search=""
            view="all"
            incompleteCount={1}
            onSearchChange={() => undefined}
            onViewChange={() => undefined}
            onSelectMessage={() => undefined}
            onSaveLocaleValue={() => undefined}
          />,
        ),
      )

      const detailsButton = container.querySelector<HTMLButtonElement>('button[aria-label="Show Message details"]')
      if (!detailsButton) throw new Error("Expected the Message details button")
      act(() => detailsButton.click())

      expect(container.textContent).toContain("Variable placeholders")
      expect(container.textContent).toContain("Rich-text slots")
      expect(container.textContent).toContain("Slot 0")
      expect(container.textContent).toContain("Slot 1")
    } finally {
      act(() => root.unmount())
      dom.window.close()
      for (const [name, descriptor] of originalDescriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor)
        else delete testGlobal[name]
      }
    }
  })
})
