import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@better-translation/ui/components/select"
import { useRouteContext, useRouter } from "@tanstack/react-router"

import { locales, type Locale } from "better-translation/messages"

import { formatLocale } from "@/lib/locales"
import { setLocaleFn } from "@/routes/-locale"

export function LocaleSwitcher({ className }: { className?: string }) {
  const router = useRouter()
  const { locale } = useRouteContext({ from: "__root__" })

  return (
    <Select
      aria-label="Select locale"
      value={locale}
      items={locales.map((option) => ({ label: formatLocale(option, [option]), value: option }))}
      onValueChange={(nextLocale) => {
        void setLocaleFn({ data: { locale: nextLocale as Locale } }).then(() => router.invalidate())
      }}
    >
      <SelectTrigger size="sm" className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {locales.map((option) => (
            <SelectItem key={option} value={option}>
              {formatLocale(option, [option])}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
