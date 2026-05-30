import { createFileRoute } from "@tanstack/react-router"

import { T } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { LocaleSwitcher } from "@/components/locale-switcher"

export const Route = createFileRoute("/")({
  component: HomePage,
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)

    return {
      meta: [
        { title: `${t("Better Translation")} · ${t("Developer-first localization that stays in your stack")}` },
        {
          name: "description",
          content: t(
            "Wrap text in T, generate local locale files today, and manage branch-local translations in the hosted platform next.",
          ),
        },
      ],
    }
  },
})

function HomePage() {
  return (
    <div className="flex flex-col gap-4 p-8">
      <p>
        <T>Hello</T>
      </p>
      <LocaleSwitcher />
      <p>Wow this is something</p>
      <p>
        <T>And more things</T>
      </p>
    </div>
  )
}
