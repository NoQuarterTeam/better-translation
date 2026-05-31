import { useRouteContext, useRouter } from "@tanstack/react-router"
import * as React from "react"

import type { Locale } from "better-translation/messages"
import { useT } from "better-translation/react"

import { setLocale } from "@/routes/-locale"

import { NativeSelect, NativeSelectOption } from "./ui/native-select"

export function LocaleSwitcher() {
  const router = useRouter()
  const t = useT()
  const { locale } = useRouteContext({ from: "/" })
  return (
    <NativeSelect
      aria-label={t("Select locale")}
      size="sm"
      value={locale}
      onChange={(e) => {
        setLocale(e.target.value as Locale)
        void router.invalidate()
      }}
    >
      <NativeSelectOption value="en">English</NativeSelectOption>
      <NativeSelectOption value="nl">Nederlands</NativeSelectOption>
    </NativeSelect>
  )
}
