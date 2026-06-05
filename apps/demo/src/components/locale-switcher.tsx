import { NativeSelect, NativeSelectOption } from "@better-translation/ui/components/native-select"
import { useRouteContext, useRouter } from "@tanstack/react-router"

import type { Locale } from "better-translation/messages"

import { setLocaleFn } from "@/routes/-locale"

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
