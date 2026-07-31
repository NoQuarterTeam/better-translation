import { MessageInbox } from "@better-translation/locale-editor"
import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"

describe("local editor", () => {
  test("omits rich-text tags from Message previews", () => {
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
})
