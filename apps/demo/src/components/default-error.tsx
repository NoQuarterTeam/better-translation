import type { ErrorComponentProps } from "@tanstack/react-router"
import { Link, rootRouteId, useMatch, useRouter } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function DefaultError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })
  return (
    <div className="flex h-full w-full flex-1 items-center justify-center bg-linear-to-b from-background via-background to-muted/30 p-4">
      <Card className="mx-auto w-full max-w-xl rounded-3xl border border-border bg-background shadow-none ring-0">
        <CardContent className="space-y-4 py-2">
          <div>
            <h1 className="bg-linear-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-4xl font-semibold tracking-tight text-balance text-transparent">
              Something went wrong
            </h1>
            <p className="mx-auto max-w-xl text-sm text-pretty text-muted-foreground sm:text-base">
              We hit an unexpected issue while loading this page.
            </p>
          </div>

          <details>
            <summary className="text-sm text-muted-foreground">View error details</summary>
            <div className="mx-auto max-h-[400px] max-w-xl overflow-y-auto rounded-xl border border-border/70 bg-muted/30 p-4 text-left text-sm">
              <pre className="whitespace-pre-wrap">{error.message}</pre>
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={() => {
                reset()
                void router.invalidate()
              }}
            >
              Try again
            </Button>
            {isRoot ? (
              <Button size="lg" variant="outline" nativeButton={false} render={<Link to="/" />}>
                Go home
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={
                  <Link
                    to="/"
                    onClick={(e) => {
                      e.preventDefault()
                      window.history.back()
                    }}
                  />
                }
              >
                Take me back
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground/80">If this keeps happening, refresh the page or contact support.</p>
        </CardContent>
      </Card>
    </div>
  )
}
