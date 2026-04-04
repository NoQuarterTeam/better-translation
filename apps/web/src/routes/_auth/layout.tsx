import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router"
import * as z from "zod"

import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

import { getAuthSessionFn } from "./-data"

export const Route = createFileRoute("/_auth")({
  validateSearch: z.object({ locale: z.enum(["en", "nl", "fr", "es"]).optional().catch(undefined) }),
  beforeLoad: async () => {
    const session = await getAuthSessionFn()
    if (session?.user) throw redirect({ to: "/dashboard" })
  },
  component: AuthLayout,
})

function AuthLayout() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <NativeSelect
          aria-label="Select locale"
          size="sm"
          value={search.locale ?? "nl"}
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
