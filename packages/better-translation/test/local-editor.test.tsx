import { MessageInbox } from "@better-translation/locale-editor"
import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"

describe("local editor", () => {
  test("previews paired and self-closing rich-text tags as annotated content", () => {
    const html = renderToStaticMarkup(
      <MessageInbox
        mode="local"
        config={{ appLocale: "en", defaultLocale: "en", locales: ["en", "nl"] }}
        messages={[
          {
            id: "safety",
            lookupId: "safety",
            defaultMessage: "Always <0>keep {status} <1>safe</1></0>.<2/>",
            placeholders: ["status"],
            done: 1,
            total: 1,
          },
        ]}
        selectedMessage={{
          id: "safety",
          lookupId: "safety",
          defaultMessage: "Always <0>keep {status} <1>safe</1></0>.<2/>",
          placeholders: ["status"],
          done: 1,
          total: 1,
          localeValues: {
            nl: {
              value: "Blijf <0>{status} <1>veilig</1></0>.<2/>",
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

    expect(html).toContain('data-rich-text-slot="0"')
    expect(html).toContain('data-rich-text-slot="1"')
    expect(html).toContain('data-rich-text-slot="2"')
    expect(html).not.toContain("&lt;0&gt;")
    expect(html).not.toContain("&lt;/0&gt;")
    expect(html).toContain("Status")
  })
})
