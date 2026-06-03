import { createFileRoute, Link } from "@tanstack/react-router"
import {
  ArrowLeftIcon,
  BookMarkedIcon,
  BoxIcon,
  CloudIcon,
  CodeIcon,
  FolderTreeIcon,
  GitBranchIcon,
  LanguagesIcon,
  ListIcon,
  PackageIcon,
  RocketIcon,
  ScanIcon,
  ServerIcon,
  SparklesIcon,
  TerminalIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { T } from "better-translation/react"

import { DefaultError } from "@/components/default-error"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/docs/")({
  component: DocsPage,
  errorComponent: (props) => (
    <div className="h-screen w-screen">
      <DefaultError {...props} />
    </div>
  ),
  head: () => {
    const title = "Better Translation · Documentation"
    const description =
      "Install the Vite plugin, mark your copy, and ship translations without leaving your code. Full reference for the plugin, runtime helpers, local mode, and the hosted platform."

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

const nav = [
  {
    title: <T>Getting started</T>,
    items: [
      { id: "introduction", label: <T>Introduction</T> },
      { id: "how-it-works", label: <T>How it works</T> },
      { id: "installation", label: <T>Installation</T> },
      { id: "configure", label: <T>Configure the plugin</T> },
    ],
  },
  {
    title: <T>Marking copy</T>,
    items: [
      { id: "t-component", label: <T>The T component</T> },
      { id: "variables", label: <T>Variables</T> },
      { id: "use-t", label: <T>useT hook</T> },
      { id: "server", label: <T>Server translator</T> },
      { id: "ids", label: <T>Lookup ids and context</T> },
    ],
  },
  {
    title: <T>Runtime</T>,
    items: [
      { id: "loading", label: <T>Loading messages</T> },
      { id: "provider", label: <T>Provider setup</T> },
    ],
  },
  {
    title: <T>Modes</T>,
    items: [
      { id: "local-mode", label: <T>Local mode</T> },
      { id: "ai", label: <T>AI translation</T> },
      { id: "remote-mode", label: <T>Remote mode</T> },
      { id: "platform", label: <T>The platform</T> },
      { id: "repository", label: <T>Connect a repository</T> },
      { id: "glossary", label: <T>Glossary terms</T> },
      { id: "builds", label: <T>Production builds</T> },
    ],
  },
  { title: <T>Reference</T>, items: [{ id: "reference", label: <T>Plugin options</T> }] },
]

function DocsPage() {
  return (
    <main className="min-h-dvh bg-background">
      <DocsHeader />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
          <DocsSidebar />
          <div className="min-w-0 py-10 lg:py-16">
            <Intro />
            <HowItWorks />
            <Installation />
            <Configure />
            <TComponent />
            <Variables />
            <UseT />
            <ServerSection />
            <Ids />
            <Loading />
            <Provider />
            <LocalMode />
            <Ai />
            <RemoteMode />
            <Platform />
            <Repository />
            <Glossary />
            <Builds />
            <Reference />
            <DocsFooter />
          </div>
        </div>
      </div>
    </main>
  )
}

function DocsHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LanguagesIcon className="size-4" />
          </span>
          <T>Better Translation</T>
          <Badge variant="outline" className="ml-1 font-mono text-[10px]">
            <T>Docs</T>
          </Badge>
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" nativeButton={false} render={<Link to="/" />}>
            <ArrowLeftIcon />
            <T>Home</T>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            nativeButton={false}
            render={<a href="https://github.com/NoQuarterTeam/better-translation" target="_blank" rel="noreferrer" />}
          >
            <GitHubMark />
            <span className="sr-only">GitHub</span>
          </Button>
          <Button nativeButton={false} render={<Link to="/sign-up" />}>
            <T>Get started</T>
          </Button>
        </nav>
      </div>
    </header>
  )
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.21 3.44 9.63 8.21 11.19.6.11.82-.25.82-.56 0-.28-.01-1.02-.02-2-3.34.71-4.04-1.58-4.04-1.58-.55-1.37-1.34-1.74-1.34-1.74-1.09-.73.08-.72.08-.72 1.21.08 1.84 1.22 1.84 1.22 1.07 1.8 2.81 1.28 3.5.98.11-.76.42-1.28.76-1.57-2.67-.3-5.47-1.31-5.47-5.83 0-1.29.47-2.34 1.24-3.17-.12-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.21a11.6 11.6 0 0 1 3-.4c1.02 0 2.05.13 3 .4 2.29-1.53 3.3-1.21 3.3-1.21.66 1.64.24 2.86.12 3.16.77.83 1.24 1.88 1.24 3.17 0 4.53-2.81 5.53-5.49 5.82.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.28 0 .31.21.68.83.56A12.02 12.02 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
    </svg>
  )
}

type TocRow = { key: string; depth: 1 | 2; label: ReactNode; id?: string }

const tocRows: TocRow[] = nav.flatMap((group, index) => [
  { key: `group-${index}`, depth: 1, label: group.title },
  ...group.items.map((item) => ({ key: item.id, depth: 2 as const, label: item.label, id: item.id })),
])

const sectionIds = tocRows.flatMap((row) => (row.id ? [row.id] : []))

function getLineOffset(depth: 1 | 2) {
  return depth <= 1 ? 2 : 12
}

function getItemPadding(depth: 1 | 2) {
  return depth <= 1 ? 12 : 24
}

function useActiveSections() {
  const [active, setActive] = useState<string[]>(() => sectionIds.slice(0, 1))

  useEffect(() => {
    const visible = new Set<string>()
    const elements = sectionIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        const ordered = sectionIds.filter((id) => visible.has(id))
        if (ordered.length > 0) setActive(ordered)
      },
      { rootMargin: "-80px 0px -45% 0px", threshold: 0 },
    )

    for (const element of elements) observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return active
}

function DocsSidebar() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLElement | null)[]>([])
  const active = useActiveSections()
  const [track, setTrack] = useState<{ d: string; width: number; height: number; positions: [number, number][] }>()

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      let d = ""
      let width = 0
      let height = 0
      let upperBottom = 0
      const positions: [number, number][] = []

      tocRows.forEach((row, i) => {
        const element = rowRefs.current[i]
        if (!element) return
        const styles = getComputedStyle(element)
        const x = getLineOffset(row.depth) + 0.5
        const top = element.offsetTop + parseFloat(styles.paddingTop)
        const bottom = element.offsetTop + element.clientHeight - parseFloat(styles.paddingBottom)
        positions[i] = [top, bottom]
        width = Math.max(width, x + 0.5)
        height = Math.max(height, bottom)

        if (i === 0) {
          d += `M${x} ${top} L${x} ${bottom}`
        } else {
          const upperX = getLineOffset(tocRows[i - 1]!.depth) + 0.5
          d += ` C ${upperX} ${top - 4} ${x} ${upperBottom + 4} ${x} ${top} L${x} ${bottom}`
        }
        upperBottom = bottom
      })

      setTrack({ d, width, height, positions })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const thumb = useMemo(() => {
    if (!track) return null
    const activeIndexes = tocRows.flatMap((row, i) => (row.id && active.includes(row.id) ? [i] : []))
    if (activeIndexes.length === 0) return null
    let startIdx = activeIndexes[0]!
    const endIdx = activeIndexes[activeIndexes.length - 1]!
    if (tocRows[startIdx]?.depth === 2 && tocRows[startIdx - 1]?.depth === 1) startIdx -= 1
    const top = track.positions[startIdx]?.[0]
    const bottom = track.positions[endIdx]?.[1]
    if (top === undefined || bottom === undefined) return null
    return { top, bottom }
  }, [track, active])

  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto py-16 pr-4 text-sm">
        <p className="mb-3 ml-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ListIcon className="size-3.5" />
          <T>On this page</T>
        </p>
        <div ref={containerRef} className="relative">
          {track ? (
            <>
              <svg
                width={track.width}
                height={track.height}
                viewBox={`0 0 ${track.width} ${track.height}`}
                className="absolute top-0 left-0 text-border"
                aria-hidden
              >
                <path d={track.d} stroke="currentColor" strokeWidth={1} fill="none" />
              </svg>
              <div
                className="pointer-events-none absolute inset-0 text-primary transition-[clip-path] duration-300 ease-out"
                style={{
                  clipPath: thumb
                    ? `polygon(0 ${thumb.top}px, 100% ${thumb.top}px, 100% ${thumb.bottom}px, 0 ${thumb.bottom}px)`
                    : "polygon(0 0, 100% 0, 100% 0, 0 0)",
                }}
                aria-hidden
              >
                <svg
                  width={track.width}
                  height={track.height}
                  viewBox={`0 0 ${track.width} ${track.height}`}
                  className="absolute top-0 left-0"
                >
                  <path d={track.d} stroke="currentColor" strokeWidth={1} fill="none" />
                </svg>
              </div>
            </>
          ) : null}

          {tocRows.map((row, i) => {
            const isActive = row.id ? active.includes(row.id) : false
            const content = (
              <span data-active={isActive} className="transition-colors data-[active=true]:text-primary">
                {row.label}
              </span>
            )
            return (
              <div
                key={row.key}
                ref={(node) => {
                  rowRefs.current[i] = node
                }}
                className="py-2 first:pt-0 last:pb-0"
                style={{ paddingInlineStart: getItemPadding(row.depth) }}
              >
                {row.id ? (
                  <a
                    href={`#${row.id}`}
                    className="text-muted-foreground transition-colors hover:text-foreground data-[active=true]:text-primary"
                    data-active={isActive}
                  >
                    {row.label}
                  </a>
                ) : (
                  <span className="text-xs font-semibold tracking-wide text-foreground uppercase">{content}</span>
                )}
              </div>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}

function Intro() {
  return (
    <section className="border-b pb-12">
      <Badge variant="outline" className="mb-5 gap-1.5 font-mono">
        npm i better-translation
      </Badge>
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        <T>Documentation</T>
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-balance text-muted-foreground">
        <T>
          Better Translation adds AI-assisted translations to your Vite app without keys, JSON file-hopping, or a build step you
          have to babysit. Wrap your copy in one component and the plugin does the rest, locally or through the hosted platform.
        </T>
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button nativeButton={false} render={<a href="#installation" />}>
          <T>Quick start</T>
        </Button>
        <Button variant="outline" nativeButton={false} render={<a href="#platform" />}>
          <T>How the platform works</T>
        </Button>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <Section id="how-it-works" eyebrow={<T>Overview</T>} title={<T>How it works</T>}>
      <Lead>
        <T>
          The Vite plugin scans your source for Translation markers at build time, gives each Message a stable lookup id, and
          keeps your Locale values in sync. Your app never imports a key by hand.
        </T>
      </Lead>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Step icon={ScanIcon} step="01" title={<T>Mark</T>}>
          <T>Wrap copy in a Translation marker where you author it. No keys to invent.</T>
        </Step>
        <Step icon={PackageIcon} step="02" title={<T>Extract</T>}>
          <T>The plugin discovers Messages and builds a Manifest keyed by stable lookup id.</T>
        </Step>
        <Step icon={SparklesIcon} step="03" title={<T>Translate</T>}>
          <T>Fill missing Locale values locally with AI, or sync them to the platform.</T>
        </Step>
        <Step icon={LanguagesIcon} step="04" title={<T>Load</T>}>
          <T>Your app loads flat Runtime bundles by Locale. No metadata reaches the browser.</T>
        </Step>
      </div>
    </Section>
  )
}

function Installation() {
  return (
    <Section id="installation" eyebrow={<T>Getting started</T>} title={<T>Installation</T>}>
      <Lead>
        <T>Add the package to any Vite app running React 19 or later and Vite 8 or later.</T>
      </Lead>
      <CodeWindow filename="terminal" icon={TerminalIcon}>
        {`# bun\nbun add better-translation\n\n# npm\nnpm i better-translation\n\n# pnpm\npnpm add better-translation`}
      </CodeWindow>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        <T>
          The package ships several entry points. Import the plugin from the vite entry, the React helpers from the react entry,
          and the server helper from the server entry. The messages entry is a virtual module created by the plugin.
        </T>
      </p>
      <ApiList>
        <ApiRow term="better-translation/vite">
          <T>The Vite plugin and its configuration types.</T>
        </ApiRow>
        <ApiRow term="better-translation/react">
          <T>The T and Var components, the useT hook, and TranslateProvider.</T>
        </ApiRow>
        <ApiRow term="better-translation/server">
          <T>createTranslator for server-side rendering and metadata.</T>
        </ApiRow>
        <ApiRow term="better-translation/ai">
          <T>createAiTranslate, the optional AI Gateway translation helper.</T>
        </ApiRow>
        <ApiRow term="better-translation/messages">
          <T>Virtual module the plugin fills with loadMessages and your locales.</T>
        </ApiRow>
      </ApiList>
    </Section>
  )
}

function Configure() {
  return (
    <Section id="configure" eyebrow={<T>Getting started</T>} title={<T>Configure the plugin</T>}>
      <Lead>
        <T>
          Add the plugin to your Vite config, list your Locales, and pick a default. That is the whole required setup. With no
          runtime option you get local mode, which writes Locale files into your app.
        </T>
      </Lead>
      <CodeWindow filename="vite.config.ts" icon={CodeIcon}>
        {`import { defineConfig } from "vite"
import { betterTranslation } from "better-translation/vite"

export default defineConfig({
  plugins: [
    betterTranslation({
      locales: ["en", "es", "fr"],
      defaultLocale: "en",
    }),
  ],
})`}
      </CodeWindow>
      <Callout icon={BoxIcon} title={<T>Plugin order</T>}>
        <T>
          Place betterTranslation before your React plugin. It runs with enforce set to pre so it can rewrite markers and inject
          stable lookup ids before other transforms see your code.
        </T>
      </Callout>
    </Section>
  )
}

function TComponent() {
  return (
    <Section id="t-component" eyebrow={<T>Marking copy</T>} title={<T>The T component</T>}>
      <Lead>
        <T>
          Wrap any JSX copy in T. At build time the plugin hashes the rendered text into a stable lookup id, so there is nothing
          to name and nothing to keep in sync by hand.
        </T>
      </Lead>
      <CodeWindow filename="Checkout.tsx" icon={CodeIcon}>
        {`import { T } from "better-translation/react"

export function Checkout() {
  return (
    <button>
      <T>Pay now</T>
    </button>
  )
}`}
      </CodeWindow>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        <T>
          At runtime T looks up the translated value for the active Locale and renders it. If no value exists yet it falls back to
          the original source copy, so your UI is never blank while translations catch up.
        </T>
      </p>
    </Section>
  )
}

function Variables() {
  return (
    <Section id="variables" eyebrow={<T>Marking copy</T>} title={<T>Variables</T>}>
      <Lead>
        <T>
          Use Var inside T to interpolate runtime values without breaking the translatable sentence. The placeholder name is part
          of the Message, so translators can move it wherever the target language needs it.
        </T>
      </Lead>
      <CodeWindow filename="Greeting.tsx" icon={CodeIcon}>
        {`import { T, Var } from "better-translation/react"

export function Greeting({ name, date }: { name: string; date: string }) {
  return (
    <T>
      Hello <Var name={name} />, the date is <Var date={date} />!
    </T>
  )
}`}
      </CodeWindow>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        <T>
          The prop key becomes the placeholder name. The example above extracts the Message with name and date placeholders and
          fills the values at render time.
        </T>
      </p>
    </Section>
  )
}

function UseT() {
  return (
    <Section id="use-t" eyebrow={<T>Marking copy</T>} title={<T>The useT hook</T>}>
      <Lead>
        <T>
          Some copy lives in places that are not JSX children, like an aria-label, a placeholder, or a title. Use the useT hook to
          translate plain strings in those positions.
        </T>
      </Lead>
      <CodeWindow filename="SearchBar.tsx" icon={CodeIcon}>
        {`import { useT } from "better-translation/react"

export function SearchBar() {
  const t = useT()
  return <input aria-label={t("Search products")} placeholder={t("Search...")} />
}`}
      </CodeWindow>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        <T>
          You can pass values for interpolation and disambiguating options as a second argument. Both T and useT share the same
          lookup ids, so the same sentence resolves to the same Message wherever it appears.
        </T>
      </p>
      <CodeWindow filename="usage.ts" icon={CodeIcon}>
        {`t("Welcome back, {name}", { name: user.name })
t("Archive", { context: "Verb on a button" })`}
      </CodeWindow>
    </Section>
  )
}

function ServerSection() {
  return (
    <Section id="server" eyebrow={<T>Marking copy</T>} title={<T>Server translator</T>}>
      <Lead>
        <T>
          For server-side rendering, document titles, or metadata you can build a translator from a loaded message map with
          createTranslator. It has the same call signature as useT but takes the messages directly.
        </T>
      </Lead>
      <CodeWindow filename="route.tsx" icon={ServerIcon}>
        {`import { createTranslator } from "better-translation/server"

const t = createTranslator(messages)

export const meta = {
  title: t("Better Translation"),
  description: t("Welcome back, {name}", { name }),
}`}
      </CodeWindow>
    </Section>
  )
}

function Ids() {
  return (
    <Section id="ids" eyebrow={<T>Marking copy</T>} title={<T>Lookup ids and context</T>}>
      <Lead>
        <T>
          Every Message has a stable lookup id. By default it is derived from the source copy and metadata, so identical copy
          shares one Message. When two identical strings need different translations, disambiguate them with context.
        </T>
      </Lead>
      <CodeWindow filename="ambiguous.tsx" icon={CodeIcon}>
        {`<T context="Verb, archives the item">Archive</T>
<T context="Noun, the archive page title">Archive</T>`}
      </CodeWindow>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        <T>
          You can also pin an explicit id when you want full control. The context is also passed to the translator, so it improves
          AI translations even when you do not need it for disambiguation.
        </T>
      </p>
      <Callout icon={ScanIcon} title={<T>Collisions are caught early</T>}>
        <T>
          If the same lookup id is produced for two Messages with different text, placeholders, or context, the plugin throws with
          both source locations so you can fix it before it ships.
        </T>
      </Callout>
    </Section>
  )
}

function Loading() {
  return (
    <Section id="loading" eyebrow={<T>Runtime</T>} title={<T>Loading messages</T>}>
      <Lead>
        <T>
          The plugin generates the virtual better-translation/messages module. Import loadMessages to fetch a flat lookup id map
          for a Locale, and locales for the list of codes you configured.
        </T>
      </Lead>
      <CodeWindow filename="messages.ts" icon={LanguagesIcon}>
        {`import { loadMessages, locales, type Locale } from "better-translation/messages"

const messages = await loadMessages("es")
// { "m_abc123": "Pagar ahora", ... }`}
      </CodeWindow>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        <T>
          The shape of loadMessages is identical across modes. The plugin bakes the right loader into the virtual module, whether
          that reads local files, fetches from your public directory, or calls the hosted Runtime bundle endpoint.
        </T>
      </p>
    </Section>
  )
}

function Provider() {
  return (
    <Section id="provider" eyebrow={<T>Runtime</T>} title={<T>Provider setup</T>}>
      <Lead>
        <T>
          Load the messages for the active Locale and pass them to TranslateProvider near the root of your app. Everything below
          it can use T, Var, and useT.
        </T>
      </Lead>
      <CodeWindow filename="root.tsx" icon={CodeIcon}>
        {`import { loadMessages } from "better-translation/messages"
import { TranslateProvider } from "better-translation/react"

const messages = await loadMessages(locale)

export function App({ children }) {
  return <TranslateProvider messages={messages}>{children}</TranslateProvider>
}`}
      </CodeWindow>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        <T>
          Resolve the Locale however you like, for example from a cookie or the request URL, then load and provide its messages.
          Switching Locale is just loading a different bundle and re-rendering the provider.
        </T>
      </p>
    </Section>
  )
}

function LocalMode() {
  return (
    <Section id="local-mode" eyebrow={<T>Modes</T>} title={<T>Local mode</T>}>
      <Lead>
        <T>
          Local mode is the default and needs no account. The plugin writes Locale files into your repo and the runtime loads
          them. You commit the generated artifacts alongside your code.
        </T>
      </Lead>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        <T>
          By default everything lands under src/lib/bt in your app. Here is what the plugin generates and where, so you know
          exactly what is in your tree.
        </T>
      </p>
      <CodeWindow filename="generated artifacts" icon={FolderTreeIcon}>
        {`src/lib/bt/
└─ locales/
│  ├─ en.json          # flat lookup id -> string per Locale
│  ├─ es.json
│  └─ fr.json

.cache/better-translation/
├─ cache.json          # translation cache, avoids re-translating
└─ manifest.json       # private source metadata catalog`}
      </CodeWindow>
      <ApiList>
        <ApiRow term="locales/*.json">
          <T>Flat Runtime bundles, one per Locale, keyed by lookup id. These are what your app loads. Commit them.</T>
        </ApiRow>
        <ApiRow term=".cache/better-translation">
          <T>Plugin-owned cache and private Manifest state. Do not commit it.</T>
        </ApiRow>
      </ApiList>
      <p className="mt-8 text-sm leading-7 text-muted-foreground">
        <T>
          Prefer fetching Locale files as static assets instead of bundling them? Set the local runtime target to public. The
          plugin writes the files under your Vite public directory and the loader fetches them at runtime.
        </T>
      </p>
      <CodeWindow filename="vite.config.ts" icon={CodeIcon}>
        {`betterTranslation({
  locales: ["en", "es", "fr"],
  defaultLocale: "en",
  runtime: {
    type: "local",
    target: "public", // default is "module"
  },
})`}
      </CodeWindow>
    </Section>
  )
}

function Ai() {
  return (
    <Section id="ai" eyebrow={<T>Modes</T>} title={<T>AI translation</T>}>
      <Lead>
        <T>
          In local mode you can fill missing non-default Locale values automatically with a translate function. The package ships
          createAiTranslate, which routes through the Vercel AI Gateway.
        </T>
      </Lead>
      <CodeWindow filename="vite.config.ts" icon={SparklesIcon}>
        {`import { betterTranslation } from "better-translation/vite"
import { createAiTranslate } from "better-translation/ai"

betterTranslation({
  locales: ["en", "es", "fr"],
  defaultLocale: "en",
  runtime: {
    type: "local",
    translate: createAiTranslate({
      prompt: "Friendly, concise product UI copy.",
    }),
  },
})`}
      </CodeWindow>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        <T>
          During dev the plugin batches missing Messages, calls translate, and writes the results into your Locale files and
          cache. Production local builds never call translate, they only check that committed files are complete.
        </T>
      </p>
      <ApiList>
        <ApiRow term="model">
          <T>AI SDK model value. Defaults to an AI Gateway model string.</T>
        </ApiRow>
        <ApiRow term="prompt">
          <T>Translation brief for tone, glossary, and domain guidance.</T>
        </ApiRow>
        <ApiRow term="temperature">
          <T>Optional temperature forwarded to the model provider.</T>
        </ApiRow>
        <ApiRow term="concurrency">
          <T>Max number of per-message requests to run at once. Defaults to 10.</T>
        </ApiRow>
      </ApiList>
      <Callout icon={SparklesIcon} title={<T>Write your own translator</T>}>
        <T>
          translate is just a function that receives the missing Messages and a target Locale and returns a map of lookup id to
          translated string. Use any provider you like, createAiTranslate is only a convenience.
        </T>
      </Callout>
    </Section>
  )
}

function RemoteMode() {
  return (
    <Section id="remote-mode" eyebrow={<T>Modes</T>} title={<T>Remote mode</T>}>
      <Lead>
        <T>
          Remote mode connects your app to the hosted platform. The plugin syncs your Manifest to a Project on each dev run and
          build, and your app loads branch-aware Runtime bundles at runtime.
        </T>
      </Lead>
      <CodeWindow filename="vite.config.ts" icon={CloudIcon}>
        {`betterTranslation({
  locales: ["en", "es", "fr"],
  defaultLocale: "en",
  runtime: {
    type: "remote",
    projectId: "prj_xxxxxxxxxxxxxxxx",
    // apiKey falls back to BETTER_TRANSLATION_API_KEY
    branch: "auto",
  },
})`}
      </CodeWindow>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        <T>
          The Project API key is a plugin-only write credential used to sync Manifests. It never reaches the browser and is
          stripped from generated runtime artifacts. Runtime bundle reads are public and read-only.
        </T>
      </p>
      <ApiList>
        <ApiRow term="projectId">
          <T>The hosted Project to sync to. Required in remote mode.</T>
        </ApiRow>
        <ApiRow term="apiKey">
          <T>Write credential for Manifest sync. Falls back to the BETTER_TRANSLATION_API_KEY env var.</T>
        </ApiRow>
        <ApiRow term="endpoint">
          <T>Override the platform URL, for self-hosting or a preview environment.</T>
        </ApiRow>
        <ApiRow term="branch">
          <T>Branch to read and sync, or "auto" to infer it from the environment and Git.</T>
        </ApiRow>
        <ApiRow term="dev.offline">
          <T>Set true to skip platform reads and writes during local dev and use local cache fallbacks instead.</T>
        </ApiRow>
      </ApiList>
      <Callout icon={GitBranchIcon} title={<T>Branch resolution</T>}>
        <T>
          With branch set to auto the plugin resolves, in order: explicit config, BETTER_TRANSLATION_BRANCH, the provider branch
          such as VERCEL_GIT_COMMIT_REF, the current Git branch, then the Project Production Branch.
        </T>
      </Callout>
    </Section>
  )
}

function Platform() {
  return (
    <Section id="platform" eyebrow={<T>Modes</T>} title={<T>The platform</T>}>
      <Lead>
        <T>
          The hosted platform is optional. It becomes useful when you want non-developers editing copy, branch-aware translations,
          AI generation in context, and a visual editor, without giving anyone code access.
        </T>
      </Lead>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Step icon={PackageIcon} title={<T>Projects and Manifests</T>}>
          <T>A Project holds one app's Messages and Locale values. Plugin sync uploads the Manifest to it.</T>
        </Step>
        <Step icon={GitBranchIcon} title={<T>Branches</T>}>
          <T>Each Branch isolates work. Feature branches seed from the Production Branch and never touch it automatically.</T>
        </Step>
        <Step icon={SparklesIcon} title={<T>Platform translator</T>}>
          <T>The platform fills missing Locale values with a hosted model, guided by your Project translation brief.</T>
        </Step>
        <Step icon={LanguagesIcon} title={<T>Runtime bundles</T>}>
          <T>Apps fetch flat per-Locale bundles by Project and Branch. No editor metadata is ever exposed.</T>
        </Step>
      </div>
      <p className="mt-8 text-sm leading-7 text-muted-foreground">
        <T>
          Editing a Branch is live for apps reading that Branch. Editing the Production Branch affects production; editing a
          feature branch affects only that preview. The whole platform is open source and self-hostable.
        </T>
      </p>
      <div className="mt-8">
        <Button nativeButton={false} render={<Link to="/sign-up" />}>
          <T>Create a Project</T>
        </Button>
      </div>
    </Section>
  )
}

function Repository() {
  return (
    <Section id="repository" eyebrow={<T>Modes</T>} title={<T>Connect a repository</T>}>
      <Lead>
        <T>
          A Project can optionally connect to one GitHub repository through the GitHub App. It is not required for remote mode,
          Manifest sync, or Runtime bundle loading. It exists to keep your Branches in step with your Git branches.
        </T>
      </Lead>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Step icon={GitBranchIcon} title={<T>Branches are automatic</T>}>
          <T>
            Projects are explicit, but Branches are not. The first time the plugin syncs from a Git branch, the matching Branch is
            created for you and named after it.
          </T>
        </Step>
        <Step icon={Trash2Icon} title={<T>Cleanup follows the origin</T>}>
          <T>
            With a repository connected and Branch cleanup enabled, deleting an upstream branch on GitHub archives its matching
            Branch automatically. The Production Branch is never touched.
          </T>
        </Step>
      </div>
      <p className="mt-8 text-sm leading-7 text-muted-foreground">
        <T>
          Cleanup is webhook-driven and listens for GitHub branch deletion events only. Closing or merging a pull request does not
          archive a Branch on its own. Branch cleanup is a Project setting, enabled by default, and only takes effect once a
          repository is connected.
        </T>
      </p>
      <Callout icon={GitBranchIcon} title={<T>Archived, not deleted</T>}>
        <T>
          When an upstream branch disappears, the matching Branch is archived rather than hard-deleted, so preview deployments
          that outlive the branch keep serving Runtime bundles. If a later sync targets an Archived Branch, it becomes active
          again.
        </T>
      </Callout>
    </Section>
  )
}

function Glossary() {
  return (
    <Section id="glossary" eyebrow={<T>Modes</T>} title={<T>Glossary terms</T>}>
      <Lead>
        <T>
          A Project glossary steers the Platform translator so product names, jargon, and banned wording stay consistent across
          every Locale. Each term pairs a source term with an action.
        </T>
      </Lead>
      <ApiList>
        <ApiRow term="preserve">
          <T>Keep the source term unchanged wherever it appears, instead of translating it.</T>
        </ApiRow>
        <ApiRow term="translate as">
          <T>Always render a specific target term for the source term in translations.</T>
        </ApiRow>
        <ApiRow term="avoid">
          <T>Never use a given term when translating, steering the model toward better wording.</T>
        </ApiRow>
      </ApiList>
      <p className="mt-8 text-sm leading-7 text-muted-foreground">
        <T>
          Terms can be scoped to a single Locale or apply everywhere, carry a note for translators, and be toggled on or off.
          Together with the Project translation brief for tone and style, the glossary shapes every AI-generated Locale value.
        </T>
      </p>
      <Callout icon={BookMarkedIcon} title={<T>Brief plus glossary</T>}>
        <T>
          The translation brief sets the overall voice; the glossary enforces exact terms. Both are applied during Manifest sync
          and local dev platform translation, so generated copy follows your guidance from the first run.
        </T>
      </Callout>
    </Section>
  )
}

function Builds() {
  return (
    <Section id="builds" eyebrow={<T>Modes</T>} title={<T>Production builds</T>}>
      <Lead>
        <T>
          Production builds are deterministic. In local mode the build is check-only: it never regenerates or re-translates, it
          verifies that the committed artifacts match your current source.
        </T>
      </Lead>
      <Callout icon={RocketIcon} title={<T>The build fails if artifacts are stale</T>}>
        <T>
          If committed Locale files are missing, incomplete, out of date, or contain orphaned ids, the build throws and tells you
          to run the dev workflow and commit the result. This keeps shipped translations honest.
        </T>
      </Callout>
      <p className="mt-6 text-sm leading-7 text-muted-foreground">
        <T>
          In remote mode the build pushes Manifest changes to the resolved Branch. Sync is idempotent and fails clearly if the
          Project does not exist or the credentials are invalid.
        </T>
      </p>
    </Section>
  )
}

const referenceRows: { term: string; type: string; description: ReactNode }[] = [
  { term: "locales", type: "string[]", description: <T>All Locale codes to emit. Required.</T> },
  { term: "defaultLocale", type: "string", description: <T>The source language. Defaults to the first locale.</T> },
  { term: "rootDir", type: "string | string[]", description: <T>Source directory or directories to scan. Defaults to "src".</T> },
  { term: "cacheFile", type: "string", description: <T>Translation cache path, relative to the Vite root.</T> },
  { term: "logging", type: "boolean", description: <T>Enables or disables plugin logging. Defaults to true.</T> },
  { term: "runtime", type: "Local | Remote", description: <T>Runtime backend. Defaults to local mode with module target.</T> },
]

function Reference() {
  return (
    <Section id="reference" eyebrow={<T>Reference</T>} title={<T>Plugin options</T>}>
      <Lead>
        <T>The full set of options accepted by betterTranslation in your Vite config.</T>
      </Lead>
      <div className="mt-8 overflow-hidden rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">
                <T>Option</T>
              </th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                <T>Type</T>
              </th>
              <th className="px-4 py-3 font-medium">
                <T>Description</T>
              </th>
            </tr>
          </thead>
          <tbody>
            {referenceRows.map((row) => (
              <tr key={row.term} className="border-t">
                <td className="px-4 py-3 align-top font-mono text-xs text-primary">{row.term}</td>
                <td className="hidden px-4 py-3 align-top font-mono text-xs text-muted-foreground sm:table-cell">{row.type}</td>
                <td className="px-4 py-3 align-top text-muted-foreground">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function DocsFooter() {
  return (
    <footer className="mt-16 border-t pt-10">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
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

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: ReactNode; title: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b py-12">
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Lead({ children }: { children: ReactNode }) {
  return <p className="max-w-2xl text-base leading-7 text-muted-foreground">{children}</p>
}

function CodeWindow({ filename, icon: Icon, children }: { filename: string; icon: LucideIcon; children: string }) {
  return (
    <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="ml-2 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
          <Icon className="size-3.5" />
          {filename}
        </span>
      </div>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-xs leading-6 text-foreground">
        <code>{children}</code>
      </pre>
    </div>
  )
}

function Step({ icon: Icon, step, title, children }: { icon: LucideIcon; step?: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        {step ? <span className="font-mono text-sm text-muted-foreground">{step}</span> : null}
      </div>
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  )
}

function ApiList({ children }: { children: ReactNode }) {
  return <dl className="mt-6 divide-y rounded-xl border">{children}</dl>
}

function ApiRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3.5 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-4">
      <dt className="font-mono text-xs text-primary">{term}</dt>
      <dd className="text-sm leading-6 text-muted-foreground">{children}</dd>
    </div>
  )
}

function Callout({ icon: Icon, title, children }: { icon: LucideIcon; title: ReactNode; children: ReactNode }) {
  return (
    <div className="mt-8 flex gap-3 rounded-xl border bg-muted/30 p-5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}
