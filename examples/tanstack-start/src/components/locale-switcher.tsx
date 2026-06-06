import { NativeSelect, NativeSelectOption } from "@better-translation/ui/components/native-select"
import { useRouteContext, useRouter } from "@tanstack/react-router"

import { locales, type Locale } from "better-translation/messages"

import { setLocale } from "@/routes/-locale"

export function LocaleSwitcher() {
  const router = useRouter()
  const { locale } = useRouteContext({ from: "/" })
  return (
    <NativeSelect
      aria-label="Select locale"
      size="sm"
      value={locale}
      onChange={(e) => {
        setLocale(e.target.value as Locale)
        void router.invalidate()
      }}
    >
      {locales.map((locale) => (
        <NativeSelectOption key={locale} value={locale}>
          {locale.toUpperCase()}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
