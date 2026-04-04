import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router"
import * as z from "zod"

import { I18nProvider } from "@better-translate/vite/react"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import { getAuthSessionFn, getI18nMessagesFn } from "./-data"

export const Route = createFileRoute("/_auth")({
  validateSearch: z.object({ locale: z.enum(["en", "nl", "fr", "es"]).optional().catch(undefined) }),
  beforeLoad: async ({ search }) => {
    const session = await getAuthSessionFn()
    if (session?.user) throw redirect({ to: "/dashboard" })

    return { messages: await getI18nMessagesFn({ data: { locale: search.locale ?? "en" } }) }
  },
  component: AuthLayout,
})

function AuthLayout() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { messages } = Route.useRouteContext()
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <NativeSelect
          aria-label="Select locale"
          size="sm"
          value={search.locale ?? "en"}
          onChange={(e) => {
            void navigate({
              to: ".",
              search: (prev) => ({ ...prev, locale: e.target.value as "en" | "nl" | "fr" | "es" }),
            })
          }}
        >
          <NativeSelectOption value="en">English</NativeSelectOption>
          <NativeSelectOption value="nl">Nederlands</NativeSelectOption>
          <NativeSelectOption value="fr">Francais</NativeSelectOption>
          <NativeSelectOption value="es">Espanol</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="w-full max-w-md">
        <I18nProvider messages={messages}>
          <Outlet />
        </I18nProvider>
      </div>
    </main>
  )
}
