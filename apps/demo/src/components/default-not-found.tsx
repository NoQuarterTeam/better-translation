import type { NotFoundRouteProps } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function DefaultNotFound({ children }: NotFoundRouteProps & { children?: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-1 items-center justify-center bg-linear-to-b from-background via-background to-muted/30 px-4 py-10">
      <Card className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-background shadow-none ring-0">
        <CardContent className="space-y-4 py-2">
          <div>
            <p className="text-lg font-semibold tracking-[0.24em] text-muted-foreground uppercase">404</p>
            <h1 className="bg-linear-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-4xl font-semibold tracking-tight text-balance text-transparent">
              You seem to be lost
            </h1>
            <div className="text-sm text-pretty text-muted-foreground sm:text-base">
              {children || <p>The page you&apos;re looking for either moved or never existed.</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => window.history.back()}>
              Take me back
            </Button>
            <Button size="lg" variant="outline" onClick={() => window.location.assign("/")}>
              Go home
            </Button>
          </div>

          <p className="text-xs text-muted-foreground/80">Tip: check the URL for typos or head back to a known route.</p>
        </CardContent>
      </Card>
    </div>
  )
}
