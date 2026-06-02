import { createRouter as createTanStackRouter } from "@tanstack/react-router"

import { routeTree } from "./routeTree.gen"

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultNotFoundComponent: () => (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <a href="/docs" className="text-fd-primary underline">
          Back to the docs
        </a>
      </div>
    ),
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
