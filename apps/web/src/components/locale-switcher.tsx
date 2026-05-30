import { useRouter } from "@tanstack/react-router"
import * as React from "react"

import { useT } from "better-translation/react"

import type { AppLocale } from "@/routes/-locale"
import { getLocale, setLocale } from "@/routes/-locale"

import { NativeSelect, NativeSelectOption } from "./ui/native-select"

export function LocaleSwitcher() {
  const router = useRouter()
  const t = useT()
  const locale = getLocale()
  return (
    <NativeSelect
      aria-label={t("Select locale")}
      size="sm"
      value={locale}
      onChange={(e) => {
        setLocale(e.target.value as AppLocale)
        void router.invalidate()
      }}
    >
      <NativeSelectOption value="en">English</NativeSelectOption>
      <NativeSelectOption value="nl">Nederlands</NativeSelectOption>
    </NativeSelect>
  )
}
