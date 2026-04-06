import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router"

import { getRouteMessages } from "@better-translate/vite/runtime"
import { TranslateProvider, useT } from "@better-translate/vite/react"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import { localeSearchSchema } from "../-locale"
import { getAuthSessionFn } from "./-data"

export const Route = createFileRoute("/_auth")({
  validateSearch: localeSearchSchema,
  beforeLoad: async ({ search }) => {
    const session = await getAuthSessionFn()
    if (session?.user) throw redirect({ to: "/dashboard", search: { locale: search.locale } })

    return { messages: await getRouteMessages(search.locale ?? "en") }
  },
  component: AuthLayout,
})

function AuthLayout() {
  const { messages } = Route.useRouteContext()

  return (
    <TranslateProvider messages={messages}>
      <AuthLayoutContent />
    </TranslateProvider>
  )
}

function AuthLayoutContent() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const t = useT()

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <NativeSelect
          aria-label={t("Select locale")}
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
        <Outlet />
      </div>
    </main>
  )
}
