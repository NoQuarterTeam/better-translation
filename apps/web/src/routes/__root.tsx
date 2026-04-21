import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, HeadContent, Outlet, ScriptOnce, Scripts } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { setResponseHeaders } from "@tanstack/react-start/server"
import { z } from "zod"

import { TranslateProvider } from "@better-translate/vite/react"

import { DefaultError } from "@/components/default-error"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import type { AppLocale } from "@/lib/bt/load-messages"
import { loadMessages } from "@/lib/bt/load-messages"

import appCss from "../styles.css?url"
import { getLocale } from "./-locale"

interface MyRouterContext {
  queryClient: QueryClient
}

const getMessagesFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ locale: z.string() }))
  .handler(async ({ data }) => {
    setResponseHeaders(
      new Headers({
        "Cache-Control": "public, max-age=300",
        "Vercel-CDN-Cache-Control": "max-age=3600, stale-while-revalidate=600",
        "CDN-Cache-Control": "max-age=3600, stale-while-revalidate=600",
      }),
    )
    return loadMessages(data.locale as AppLocale)
  })

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async () => {
    const locale = getLocale()
    const messages = await getMessagesFn({ data: { locale } })
    return { locale, messages }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Better Translation Dashboard" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  headers: () => ({ "Cache-Control": "no-cache", "CDN-Cache-Control": "no-cache", "Vercel-CDN-Cache-Control": "no-cache" }),
  errorComponent: (p) => (
    <div className="h-screen w-screen">
      <DefaultError {...p} />
    </div>
  ),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const { messages } = Route.useRouteContext()
  return (
    <TranslateProvider messages={messages}>
      <Outlet />
    </TranslateProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { locale } = Route.useRouteContext()
  return (
    <ThemeProvider>
      <html lang={locale} suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body>
          <VitePreloadErrorHandler />
          {children}
          <Toaster />
          <Scripts />
        </body>
      </html>
    </ThemeProvider>
  )
}

function VitePreloadErrorHandler() {
  return <ScriptOnce>{`window.addEventListener("vite:preloadError", () => { window.location.reload() })`}</ScriptOnce>
}
