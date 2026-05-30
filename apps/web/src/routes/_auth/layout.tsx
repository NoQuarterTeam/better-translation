import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { LocaleSwitcher } from "@/components/locale-switcher"

import { getAuthSessionFn } from "./-data"

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const session = await getAuthSessionFn()
    if (session?.user) throw redirect({ to: "/app" })
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </main>
  )
}
