import { useRouteContext, useRouter } from "@tanstack/react-router"

import { locales, type Locale } from "better-translation/messages"
import { T, useT } from "better-translation/react"

import { setLocale } from "@/routes/-locale"

export function LocaleSwitcher() {
  const router = useRouter()
  const { locale } = useRouteContext({ from: "/" })
  const t = useT()

  return (
    <label className="locale-control">
      <span>
        <T>Locale</T>
      </span>
      <select
        aria-label={t("Select locale")}
        value={locale}
        onChange={(event) => {
          setLocale(event.target.value as Locale)
          void router.invalidate()
        }}
      >
        {locales.map((option) => (
          <option key={option} value={option}>
            {option.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  )
}
