import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router"
import { useT } from "better-translation/react"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import { type AppLocale, setLocale } from "../-locale"
import { getAuthSessionFn } from "./-data"

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await getAuthSessionFn()
    if (session?.user) throw redirect({ to: "/dashboard" })
  },
  component: AuthLayout,
})

function AuthLayout() {
  const { locale } = Route.useRouteContext()
  const router = useRouter()
  const t = useT()

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="absolute top-4 right-4">
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
