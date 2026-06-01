import { useRouteContext, useRouter } from "@tanstack/react-router"
import * as React from "react"

import type { Locale } from "better-translation/messages"

import { setLocaleFn } from "@/routes/-locale"

import { NativeSelect, NativeSelectOption } from "./ui/native-select"

export function LocaleSwitcher() {
  const router = useRouter()
  const { locale } = useRouteContext({ from: "/" })
  return (
    <NativeSelect
      aria-label="Select locale"
      size="sm"
      value={locale}
      onChange={(e) => {
        void setLocaleFn({ data: { locale: e.target.value as Locale } }).then(() => router.invalidate())
      }}
    >
      <NativeSelectOption value="en">English</NativeSelectOption>
      <NativeSelectOption value="nl">Nederlands</NativeSelectOption>
    </NativeSelect>
  )
}
