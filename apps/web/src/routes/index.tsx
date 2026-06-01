import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, GitBranchIcon, LanguagesIcon, PackageIcon, WorkflowIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect } from "react"
import * as z from "zod"

import { T } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { Button } from "@/components/ui/button"

// PROTOTYPE: Three variants of the homepage, switchable via `?variant=`, on the existing `/` route.
const variantSearchSchema = z.object({
  variant: z.enum(["A", "B", "C"]).optional().catch(undefined),
})

const variantLabels = {
  A: "Direct",
  B: "Workflow",
  C: "Product",
} as const

type VariantKey = keyof typeof variantLabels

export const Route = createFileRoute("/")({
  validateSearch: variantSearchSchema,
  component: HomePage,
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)

    return {
      meta: [
        { title: `${t("Better Translation")} · ${t("Developer-first localization that stays in your stack")}` },
        {
          name: "description",
          content: t(
            "Wrap text in T, generate local locale files today, and manage branch-local translations in the hosted platform next.",
          ),
        },
      ],
    }
  },
})

function HomePage() {
  const { variant = "A" } = Route.useSearch()

  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      <PrototypeSwitcher current={variant} />
    </>
  )
}

function VariantA() {
  return (
    <main className="min-h-dvh bg-background">
      <LandingHeader />
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center">
          <div className="max-w-2xl">
            <p className="mb-5 text-sm font-medium text-primary">
              <T>For Vite applications</T>
            </p>
            <h1 className="text-4xl font-semibold text-balance sm:text-5xl">
              <T>Better Translation</T>
            </h1>
            <p className="mt-6 text-lg leading-8 text-balance text-muted-foreground">
              <T>Mark copy in code, sync Messages from the Vite plugin, and edit branch-local Locale values before they ship.</T>
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button nativeButton={false} render={<Link to="/sign-up" />}>
                <T>Start translating</T>
                <ArrowRightIcon />
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link to="/sign-in" />}>
                <T>Sign in</T>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="rounded-md border bg-background">
              <div className="border-b px-4 py-3 text-sm font-medium">
                <T>Runtime bundle</T>
              </div>
              <div className="space-y-3 p-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs text-muted-foreground">m_checkout_title</span>
                  <span>
                    <T>Checkout</T>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs text-muted-foreground">m_payment_cta</span>
                  <span>
                    <T>Pay now</T>
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-xs text-muted-foreground">m_receipt_email</span>
                  <span>
                    <T>Email receipt</T>
                  </span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              <T>Runtime bundles stay flat: lookup id to translated string. No Manifest metadata reaches the browser.</T>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

function VariantB() {
  return (
    <main className="min-h-dvh bg-background">
      <LandingHeader />
      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-8">
        <aside className="flex flex-col justify-between border-b pb-8 lg:border-r lg:border-b-0 lg:pr-8 lg:pb-0">
          <div>
            <p className="text-sm font-medium text-primary">
              <T>Local first, hosted when ready</T>
            </p>
            <h1 className="mt-5 text-3xl font-semibold text-balance">
              <T>Better Translation</T>
            </h1>
          </div>
          <div className="mt-8 flex gap-3 lg:flex-col">
            <Button className="w-fit" nativeButton={false} render={<Link to="/sign-up" />}>
              <T>Create account</T>
            </Button>
            <Button variant="outline" className="w-fit" nativeButton={false} render={<Link to="/sign-in" />}>
              <T>Sign in</T>
            </Button>
          </div>
        </aside>

        <div className="flex flex-col justify-center gap-10">
          <div className="max-w-3xl">
            <h2 className="text-4xl font-semibold text-balance sm:text-5xl">
              <T>A translation workflow that follows your code.</T>
            </h2>
            <p className="mt-5 text-lg leading-8 text-balance text-muted-foreground">
              <T>
                Start with generated local Locale values, then move the same Messages into Projects and Branches when the hosted
                workflow becomes useful.
              </T>
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Step number="01" title={<T>Mark</T>} text={<T>Use Translation markers where copy is authored.</T>} />
            <Step number="02" title={<T>Sync</T>} text={<T>The Vite plugin uploads the Manifest for the current Branch.</T>} />
            <Step number="03" title={<T>Load</T>} text={<T>Consumer apps read flat Runtime bundles by Locale.</T>} />
          </div>
        </div>
      </section>
    </main>
  )
}

function VariantC() {
  return (
    <main className="min-h-dvh bg-background">
      <LandingHeader />
      <section className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
          <div>
            <p className="text-sm font-medium text-primary">
              <T>Hosted translation platform for Vite apps</T>
            </p>
            <h1 className="mt-5 text-4xl font-semibold text-balance sm:text-5xl">
              <T>Better Translation</T>
            </h1>
          </div>
          <div>
            <p className="text-lg leading-8 text-muted-foreground">
              <T>
                Keep source copy in your app, give each Git Branch its own Locale values, and serve complete Runtime bundles
                without shipping editor metadata.
              </T>
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button nativeButton={false} render={<Link to="/sign-up" />}>
                <T>Start translating</T>
                <ArrowRightIcon />
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link to="/sign-in" />}>
                <T>Open dashboard</T>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground">
              <span>
                <T>Message</T>
              </span>
              <span>
                <T>Branch</T>
              </span>
              <span>
                <T>Status</T>
              </span>
            </div>
            <div className="divide-y">
              <MessageRow message={<T>Start free trial</T>} branch="feature/pricing" status={<T>Manual</T>} />
              <MessageRow message={<T>Invite your team</T>} branch="main" status={<T>AI</T>} />
              <MessageRow message={<T>Usage this month</T>} branch="feature/billing" status={<T>Synced</T>} />
            </div>
          </div>

          <div className="grid gap-4">
            <Benefit
              icon={<PackageIcon />}
              title={<T>Vite plugin</T>}
              text={<T>Discovers Messages from source code and writes local artifacts.</T>}
            />
            <Benefit
              icon={<GitBranchIcon />}
              title={<T>Branches</T>}
              text={<T>Keep feature work separate from Production Branch Locale values.</T>}
            />
            <Benefit
              icon={<LanguagesIcon />}
              title={<T>Runtime bundles</T>}
              text={<T>Serve flat lookup id maps that are ready for the Consumer app.</T>}
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function LandingHeader() {
  return (
    <header className="border-b bg-background/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="font-semibold">
          <T>Better Translation</T>
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" nativeButton={false} render={<Link to="/sign-in" />}>
            <T>Sign in</T>
          </Button>
          <Button nativeButton={false} render={<Link to="/sign-up" />}>
            <T>Get started</T>
          </Button>
        </nav>
      </div>
    </header>
  )
}

function Step({ number, title, text }: { number: string; title: ReactNode; text: ReactNode }) {
  return (
    <div className="rounded-lg border p-5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">{number}</span>
        <WorkflowIcon className="text-primary" />
      </div>
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  )
}

function MessageRow({ message, branch, status }: { message: ReactNode; branch: string; status: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-4 text-sm">
      <span className="font-medium">{message}</span>
      <span className="font-mono text-xs text-muted-foreground">{branch}</span>
      <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
        <CheckIcon />
        {status}
      </span>
    </div>
  )
}

function Benefit({ icon, title, text }: { icon: ReactNode; title: ReactNode; text: ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-primary">{icon}</div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  )
}

function PrototypeSwitcher({ current }: { current: VariantKey }) {
  const navigate = useNavigate()
  const variants = Object.keys(variantLabels) as VariantKey[]
  const currentIndex = variants.indexOf(current)
  const previous = variants[(currentIndex + variants.length - 1) % variants.length]
  const next = variants[(currentIndex + 1) % variants.length]

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      void navigate({ to: "/", search: { variant: event.key === "ArrowLeft" ? previous : next }, replace: true })
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [navigate, next, previous])

  if (import.meta.env.PROD) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-foreground px-2 py-1 text-background shadow-lg">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-background hover:bg-background/10 hover:text-background"
        aria-label="Previous prototype variant"
        onClick={() => void navigate({ to: "/", search: { variant: previous }, replace: true })}
      >
        <ArrowLeftIcon />
      </Button>
      <div className="min-w-32 px-2 text-center text-sm font-medium">
        {current} - {variantLabels[current]}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-background hover:bg-background/10 hover:text-background"
        aria-label="Next prototype variant"
        onClick={() => void navigate({ to: "/", search: { variant: next }, replace: true })}
      >
        <ArrowRightIcon />
      </Button>
    </div>
  )
}
