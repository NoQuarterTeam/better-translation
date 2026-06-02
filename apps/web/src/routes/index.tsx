import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowRightIcon,
  CheckIcon,
  CodeIcon,
  EyeIcon,
  GitPullRequestIcon,
  LanguagesIcon,
  PackageIcon,
  ScanIcon,
  ServerIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"

import { T } from "better-translation/react"

import { DefaultError } from "@/components/default-error"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/")({
  component: HomePage,
  errorComponent: (props) => (
    <div className="h-screen w-screen">
      <DefaultError {...props} />
    </div>
  ),
  head: () => {
    const title = "Better Translation · Ship every language without leaving your code"
    const description =
      "Stop dancing between source and locale files. Wrap copy in one component and translations sync themselves, with no keys and no file-hopping. Open source, self-hostable, with an optional cloud platform."

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
    }
  },
})

function HomePage() {
  return (
    <main className="min-h-dvh bg-background">
      <LandingHeader />
      <Hero />
      <LogoStrip />
      <QuickStart />
      <Workflow />
      <Features />
      <CloudPlatform />
      <FinalCta />
      <LandingFooter />
    </main>
  )
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.34-1.74-1.34-1.74-1.09-.73.08-.72.08-.72 1.21.08 1.84 1.22 1.84 1.22 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 3-.4c1.02 0 2.05.13 3 .4 2.29-1.53 3.3-1.21 3.3-1.21.66 1.64.24 2.86.12 3.16.77.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.28 0 .31.21.68.83.56A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  )
}

function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LanguagesIcon className="size-4" />
          </span>
          <T>Better Translation</T>
        </Link>
        <nav className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            nativeButton={false}
            render={<a href="https://github.com/NoQuarterTeam/better-translation" target="_blank" rel="noreferrer" />}
          >
            <GitHubMark />
            <span className="sr-only">GitHub</span>
          </Button>
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

function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 max-w-4xl rounded-full bg-primary/20 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_30rem] lg:items-center lg:px-8 lg:py-28">
        <div className="max-w-2xl">
          <Badge variant="outline" className="mb-6 gap-1.5 font-mono">
            npm i better-translation
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            <T>Ship every language without leaving your code.</T>
          </h1>
          <p className="mt-6 text-lg leading-8 text-balance text-muted-foreground">
            <T>
              No more dancing between source and locale files. Most tools make you invent a key, then jump to a JSON file to fill
              it in. Wrap your copy in a single component and the translations sync themselves, with no keys and no file-hopping.
            </T>
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" nativeButton={false} render={<Link to="/docs" />}>
              <T>Read the docs</T>
              <ArrowRightIcon />
            </Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<a href="#cloud" />}>
              <T>Explore the platform</T>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            <T>Open source and self-hostable. The hosted platform is optional.</T>
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  )
}

const heroPhrases = [
  { locale: "es", value: "Pagar ahora" },
  { locale: "fr", value: "Payer maintenant" },
  { locale: "de", value: "Jetzt bezahlen" },
]

function HeroVisual() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setIndex((i) => (i + 1) % heroPhrases.length), 1800)
    return () => clearInterval(interval)
  }, [])

  const current = heroPhrases[index]!

  return (
    <div className="relative rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="ml-2 font-mono text-xs text-muted-foreground">Checkout.tsx</span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-xs leading-6 text-foreground">
        <code>
          <span className="text-muted-foreground">{"export function Checkout() {"}</span>
          {"\n"}
          {"  return ("}
          {"\n"}
          {"    <button>"}
          {"\n"}
          {"      "}
          <span className="rounded bg-primary/15 px-1 text-primary dark:text-emerald-400">{"<T>Pay now</T>"}</span>
          {"  "}
          <span key={current.locale} className="animate-in text-muted-foreground/70 duration-300 fade-in slide-in-from-left-1">
            {`// ${current.value}`}
          </span>
          {"\n"}
          {"    </button>"}
          {"\n"}
          {"  )"}
          {"\n"}
          <span className="text-muted-foreground">{"}"}</span>
        </code>
      </pre>
    </div>
  )
}

function LogoStrip() {
  return (
    <section className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">
          <T>Built for the modern Vite and React stack</T>
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-muted-foreground">
          <span>Vite</span>
          <span>React</span>
          <span>TanStack Start</span>
          <span>TypeScript</span>
          <span>Vercel</span>
        </div>
      </div>
    </section>
  )
}

function QuickStart() {
  return (
    <section className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-center">
          <div>
            <Badge variant="outline" className="mb-5 gap-1.5">
              <PackageIcon />
              <T>Drop-in setup</T>
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              <T>One plugin. That is the whole config.</T>
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              <T>
                Add the plugin, list your Locales, and you get local locale files out of the box. The runtime is optional: point
                it at the hosted platform, your own self-hosted server, or any custom endpoint URL.
              </T>
            </p>
          </div>

          <div className="rounded-xl border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="ml-2 font-mono text-xs text-muted-foreground">vite.config.ts</span>
            </div>
            <pre className="overflow-x-auto px-4 py-4 font-mono text-xs leading-6">
              <code>
                <span className="text-muted-foreground">{'import { defineConfig } from "vite"'}</span>
                {"\n"}
                <span className="text-primary">{'import { betterTranslation } from "better-translation/vite"'}</span>
                {"\n\n"}
                {"export default defineConfig({"}
                {"\n"}
                {"  plugins: ["}
                {"\n"}
                {"    "}
                <span className="text-primary">betterTranslation</span>
                {"({"}
                {"\n"}
                {"      locales: ["}
                <span className="text-foreground">{'"en", "es", "fr"'}</span>
                {"],"}
                {"\n"}
                {"      defaultLocale: "}
                <span className="text-foreground">{'"en"'}</span>
                {","}
                {"\n"}
                {"    }),"}
                {"\n"}
                {"  ],"}
                {"\n"}
                {"})"}
              </code>
            </pre>
            <div className="border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              <T>Self-host or use the hosted platform: set runtime to a custom endpoint URL.</T>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Workflow() {
  return (
    <section className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={<T>End-to-end localization</T>}
          title={<T>From source copy to shipped translations</T>}
          description={<T>The Vite plugin does the heavy lifting so translations follow your code, branch by branch.</T>}
        />
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <WorkflowStep
            step="01"
            icon={<ScanIcon />}
            title={<T>Mark</T>}
            text={<T>Wrap copy in a Translation marker where it is authored. No keys to invent or maintain.</T>}
          />
          <WorkflowStep
            step="02"
            icon={<PackageIcon />}
            title={<T>Sync</T>}
            text={<T>The Vite plugin discovers Messages and uploads the Manifest for the current Branch.</T>}
          />
          <WorkflowStep
            step="03"
            icon={<SparklesIcon />}
            title={<T>Translate</T>}
            text={<T>Generate Locale values locally, or with your own translator, ready for review.</T>}
          />
          <WorkflowStep
            step="04"
            icon={<GitPullRequestIcon />}
            title={<T>Ship</T>}
            text={<T>Consumer apps load flat Runtime bundles by Locale. No editor metadata reaches the browser.</T>}
          />
        </div>
      </div>
    </section>
  )
}

function WorkflowStep({ step, icon, title, text }: { step: string; icon: ReactNode; title: ReactNode; text: ReactNode }) {
  return (
    <div className="relative rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span>
        <span className="font-mono text-sm text-muted-foreground">{step}</span>
      </div>
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  )
}

function CloudPlatform() {
  return (
    <section id="cloud" className="scroll-mt-16 border-b bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-center">
          <div>
            <Badge variant="secondary" className="mb-5 gap-1.5">
              <SparklesIcon />
              <T>Cloud platform · Optional</T>
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              <T>Add the hosted platform when you want it</T>
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              <T>
                Everything above works without an account. When you want branch-aware translations, AI generation, and a visual
                editor, connect the cloud platform, or self-host the same thing.
              </T>
            </p>
            <ul className="mt-8 space-y-3">
              <EditorPoint>
                <T>Let non-developers update translations in real time, no code access required</T>
              </EditorPoint>
              <EditorPoint>
                <T>Branch overrides that never touch Production</T>
              </EditorPoint>
              <EditorPoint>
                <T>AI translations generated in context</T>
              </EditorPoint>
              <EditorPoint>
                <T>A visual editor built for clarity first</T>
              </EditorPoint>
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button nativeButton={false} render={<Link to="/sign-up" />}>
                <T>Get started free</T>
                <ArrowRightIcon />
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link to="/sign-in" />}>
                <T>Open dashboard</T>
              </Button>
            </div>
          </div>

          {/* Placeholder for visual editor screenshots */}
          <div className="relative aspect-16/10 overflow-hidden rounded-xl border bg-card">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-brand-secondary/10"
            />
            <div className="relative flex h-full flex-col items-center justify-center gap-2 text-center">
              <EyeIcon className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">
                <T>Visual editor screenshot</T>
              </p>
              <p className="text-xs text-muted-foreground">
                <T>Placeholder: drop the editor screenshots here</T>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function EditorPoint({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="text-muted-foreground">{children}</span>
    </li>
  )
}

function Features() {
  return (
    <section className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={<T>The open-source library</T>}
          title={<T>Localization that lives with your codebase</T>}
          description={<T>Developer-first primitives that work entirely local, with no account and no platform required.</T>}
        />
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={<PackageIcon />}
            title={<T>Vite plugin</T>}
            text={<T>Discovers Messages from source code and writes local artifacts on every build.</T>}
          />
          <Feature
            icon={<CodeIcon />}
            title={<T>React and server helpers</T>}
            text={<T>Render Messages in React components and translate on the server with the same lookup ids.</T>}
          />
          <Feature
            icon={<ScanIcon />}
            title={<T>Automatic lookup ids</T>}
            text={<T>Wrap copy in a Translation marker. There are no keys to invent or maintain by hand.</T>}
          />
          <Feature
            icon={<LanguagesIcon />}
            title={<T>Runtime bundles</T>}
            text={<T>Serve flat lookup id maps that are ready for the Consumer app, with zero metadata.</T>}
          />
          <Feature
            icon={<ZapIcon />}
            title={<T>Local locale files</T>}
            text={<T>Generated snapshot fallbacks keep your app working with no network at runtime.</T>}
          />
          <Feature
            icon={<ServerIcon />}
            title={<T>Open source and self-hostable</T>}
            text={<T>Run entirely local, self-host the platform, or point the runtime at any custom endpoint URL.</T>}
          />
        </div>
      </div>
    </section>
  )
}

function Feature({ icon, title, text }: { icon: ReactNode; title: ReactNode; text: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span>
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  )
}

function FinalCta() {
  return (
    <section className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl border bg-card px-6 py-16 text-center sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -bottom-32 mx-auto h-72 max-w-2xl rounded-full bg-primary/20 blur-3xl"
          />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              <T>Translate your Vite app today</T>
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              <T>Wrap your first Message, run the plugin, and watch translations follow your code.</T>
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" nativeButton={false} render={<Link to="/docs" />}>
                <T>Read the docs</T>
                <ArrowRightIcon />
              </Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<a href="#cloud" />}>
                <T>Explore the cloud platform</T>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LandingFooter() {
  return (
    <footer>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 text-sm font-medium">
          <span className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground">
            <LanguagesIcon className="size-3.5" />
          </span>
          <T>Better Translation</T>
        </Link>
        <p className="text-sm text-muted-foreground">
          <T>Developer-first localization that stays in your stack.</T>
        </p>
      </div>
    </footer>
  )
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: ReactNode; title: ReactNode; description: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      <p className="mt-4 text-lg leading-8 text-balance text-muted-foreground">{description}</p>
    </div>
  )
}
