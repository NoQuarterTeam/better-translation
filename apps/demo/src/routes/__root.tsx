import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, HeadContent, Outlet, ScriptOnce, Scripts } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import z from "zod"

import { loadMessages } from "better-translation/messages"
import { TranslateProvider } from "better-translation/react"

import { DefaultError } from "@/components/default-error"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

import appCss from "../styles.css?url"
import { getLocaleFn } from "./-locale"

interface MyRouterContext {
  queryClient: QueryClient
}

const getMessagesFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ locale: z.string() }))
  .handler(async ({ data }) => {
    return await loadMessages(data.locale).catch(() => ({}))
  })

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async () => {
    const locale = await getLocaleFn()
    const messages = await getMessagesFn({ data: { locale } })

    return { locale, messages }
  },
  head: () => {
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: `Better Translation` },
      ],
      links: [{ rel: "stylesheet", href: appCss }],
    }
  },
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
