import { createRouter as createTanStackRouter, Link, type ErrorComponentProps } from "@tanstack/react-router"

import { routeTree } from "./routeTree.gen"

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultErrorComponent: DefaultError,
    defaultNotFoundComponent: () => (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <a href="/" className="text-fd-primary underline">
          Back to the docs
        </a>
      </div>
    ),
  })
}

function DefaultError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="max-w-xl space-y-3">
        <p className="text-fd-muted-foreground text-sm font-medium">Something went wrong</p>
        <h1 className="text-2xl font-semibold">The docs could not load this page.</h1>
        <details className="bg-fd-muted/40 rounded-lg border p-3 text-left text-sm">
          <summary className="text-fd-muted-foreground cursor-pointer">Error details</summary>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap">{error.message}</pre>
        </details>
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <button className="bg-fd-primary text-fd-primary-foreground rounded-md px-3 py-2" onClick={reset}>
          Try again
        </button>
        <Link to="/" className="rounded-md border px-3 py-2">
          Back to the docs
        </Link>
      </div>
    </div>
  )
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
