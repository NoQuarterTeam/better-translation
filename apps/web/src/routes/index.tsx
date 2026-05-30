import { createFileRoute } from "@tanstack/react-router"

import { createTranslator } from "better-translation/server"

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
  return <div>hello</div>
}
