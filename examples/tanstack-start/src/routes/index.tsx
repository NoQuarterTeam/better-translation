import { createFileRoute } from "@tanstack/react-router"

import { T, Var } from "better-translation/react"
import { createTranslator } from "better-translation/runtime"

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

const name = "Jack"
const date = formatExampleDate(new Date())

function HomePage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <LocaleSwitcher />

      <h1>
        <T>Hello there!</T>
      </h1>
      <p>
        <T context="A welcome greeting to the user, be super friendly.">
          Welcome <Var name={name} />, the date is <Var date={date} />!
        </T>
      </p>

      <p>
        <T>And more things</T>
      </p>
    </div>
  )
}

function formatExampleDate(date: Date) {
  return date.toISOString().slice(0, 10)
}
