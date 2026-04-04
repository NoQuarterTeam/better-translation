import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, HeadContent, Outlet, ScriptOnce, Scripts } from "@tanstack/react-router"

import { DefaultError } from "@/components/default-error"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

import appCss from "../styles.css?url"

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Better Translation Dashboard" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  headers: () => ({
    "Cache-Control": "no-cache",
    "CDN-Cache-Control": "no-cache",
    "Vercel-CDN-Cache-Control": "no-cache",
  }),
  errorComponent: (p) => (
    <div className="h-screen w-screen">
      <DefaultError {...p} />
    </div>
  ),
  component: Outlet,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <html lang="en" suppressHydrationWarning>
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
