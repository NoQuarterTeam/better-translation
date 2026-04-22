import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRight, Blocks, Cloud, Code2, Component, FileCode2, Globe2, Languages, PencilLine, ServerCog } from "lucide-react"

import { T } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const featureCards = [
  {
    title: "Wrap UI copy in T",
    description: "Mark strings directly in React with T or useT so translation starts where the UI is authored.",
    icon: Component,
  },
  {
    title: "Bring your own translator",
    description: "Use your own translator functions and provider choices instead of getting locked into a single service.",
    icon: Languages,
  },
  {
    title: "Generate local locale files",
    description: "Build locale output that lives in your repo, stays reviewable, and ships with your app.",
    icon: FileCode2,
  },
  {
    title: "Open-source editor on the way",
    description: "A hosted locale editor will let contributors update copy in the cloud without touching app code.",
    icon: PencilLine,
  },
] as const

const steps = [
  {
    title: "Instrument the app",
    description: "Developers wrap visible copy in T and use the same translation primitives they already write in the product.",
    icon: Code2,
  },
  {
    title: "Run your translation pipeline",
    description:
      "Better Translation extracts messages and hands them to your own translator functions so you control quality and cost.",
    icon: Blocks,
  },
  {
    title: "Ship or sync locales",
    description:
      "Generated locales stay local for fast app usage today, and can later sync with the hosted or self-hosted editor.",
    icon: Globe2,
  },
] as const

const deploymentCards = [
  {
    title: "Cloud",
    description:
      "Use the hosted Better Translation editor so teams can manage locale updates without cloning the app or opening a PR.",
    icon: Cloud,
  },
  {
    title: "Self-hosted",
    description:
      "Run the same editor and locale workflow inside your own infrastructure when policy or customer requirements demand it.",
    icon: ServerCog,
  },
] as const

export const Route = createFileRoute("/")({
  component: HomePage,
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)

    return {
      meta: [
        { title: `${t("Better Translation")} · ${t("Developer-first localization that stays in your stack")}` },
        {
          name: "description",
          content: t(
            "Wrap text in T, run your own translator functions, generate local locale files, and manage future edits in the cloud or on your own infrastructure.",
          ),
        },
      ],
    }
  },
})

function HomePage() {
  return (
    <main className="relative overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-8rem] left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-brand-primary/20 blur-3xl" />
        <div className="absolute top-[12rem] right-[-8rem] h-[22rem] w-[22rem] rounded-full bg-brand-secondary/20 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-[34rem] bg-[linear-gradient(to_bottom,rgba(12,24,24,0.03),transparent)] dark:bg-[linear-gradient(to_bottom,rgba(148,230,204,0.06),transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(12,24,24,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(12,24,24,0.03)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)]" />
      </div>

      <section className="relative mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-6 pt-6 pb-20 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4 rounded-full border border-foreground/10 bg-background/80 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-foreground text-background shadow-sm">
              <Languages className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground uppercase">Better Translation</p>
              <p className="text-sm text-foreground/70">
                <T>Developer-first localization infrastructure</T>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/sign-in" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
              <T>Sign in</T>
            </Link>
            <Link to="/sign-up" className={buttonVariants({ size: "sm" })}>
              <T>Start building</T>
            </Link>
          </div>
        </header>

        <div className="grid flex-1 items-start gap-14 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div className="max-w-3xl">
            <h1 className="max-w-4xl text-5xl leading-none font-semibold text-balance sm:text-6xl lg:text-7xl">
              <T>Localization infrastructure that fits the way developers already build.</T>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-foreground/75 sm:text-xl">
              <T>
                Better Translation lets developers wrap copy in T, plug in their own translator functions, and generate locale
                files that live alongside the app. Teams keep control of the workflow instead of outsourcing the architecture.
              </T>
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/sign-up" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
                <T>Build with Better Translation</T>
                <ArrowRight className="size-4" />
              </Link>
              <Link to="/dashboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <T>Open the app</T>
              </Link>
            </div>

            <div className="mt-10 grid gap-4 text-sm text-foreground/70 sm:grid-cols-3">
              <div className="rounded-3xl border border-foreground/10 bg-background/70 p-4 shadow-sm backdrop-blur">
                <div className="text-2xl font-semibold">`T`</div>
                <p className="mt-1">
                  <T>Mark UI text where it is authored.</T>
                </p>
              </div>
              <div className="rounded-3xl border border-foreground/10 bg-background/70 p-4 shadow-sm backdrop-blur">
                <div className="text-2xl font-semibold">BYO</div>
                <p className="mt-1">
                  <T>Use your own translation functions and providers.</T>
                </p>
              </div>
              <div className="rounded-3xl border border-foreground/10 bg-background/70 p-4 shadow-sm backdrop-blur">
                <div className="text-2xl font-semibold">Git + Cloud</div>
                <p className="mt-1">
                  <T>Keep locales local now and editable in the cloud next.</T>
                </p>
              </div>
            </div>
          </div>

          <Card className="relative overflow-hidden border border-foreground/10 bg-background/88 py-0 shadow-2xl ring-1 ring-foreground/5 shadow-brand-primary/10 backdrop-blur-sm dark:bg-card/92 dark:ring-white/10">
            <div className="border-b border-foreground/10 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    <T>How it feels in code</T>
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    <T>Translation stays in the product workflow</T>
                  </h2>
                </div>
                <div className="rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-foreground/70">
                  <T>Local-first output</T>
                </div>
              </div>
            </div>

            <CardContent className="grid gap-6 px-0 py-0 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="border-b border-foreground/10 px-6 py-6 lg:border-r lg:border-b-0">
                <pre className="overflow-x-auto rounded-3xl bg-[#081311] p-5 text-sm leading-7 text-[#d8fff2] shadow-inner">
                  <code>{`import { T, useT } from "better-translation/react"

function SettingsPage() {
  const t = useT()

  return (
    <>
      <h1><T>Team settings</T></h1>
      <button>{t("Invite member")}</button>
    </>
  )
}

export default defineConfig({
  translate: {
    locales: ["en", "nl", "de"],
    translator: myTranslator,
  },
})`}</code>
                </pre>
              </div>

              <div className="flex flex-col gap-4 px-6 py-6">
                <div className="rounded-3xl border border-foreground/10 bg-background/80 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    <T>Extraction</T>
                  </p>
                  <p className="mt-2 text-base leading-7 text-foreground/80">
                    <T>
                      Messages are discovered from the source code instead of being copied into a separate localization layer.
                    </T>
                  </p>
                </div>
                <div className="rounded-3xl border border-foreground/10 bg-background/80 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    <T>Translation</T>
                  </p>
                  <p className="mt-2 text-base leading-7 text-foreground/80">
                    <T>
                      Your translator functions decide how locales get generated, whether that is AI, APIs, or an internal
                      process.
                    </T>
                  </p>
                </div>
                <div className="rounded-3xl border border-foreground/10 bg-background/80 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    <T>Runtime</T>
                  </p>
                  <p className="mt-2 text-base leading-7 text-foreground/80">
                    <T>
                      Locale files are available locally, so the app ships predictable translations without depending on a remote
                      runtime.
                    </T>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="relative border-y border-foreground/10 bg-foreground/[0.03]">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-16 sm:px-10 lg:grid-cols-3 lg:px-12">
          {steps.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="border border-foreground/10 bg-background/85 shadow-sm">
              <CardHeader>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-foreground text-background shadow-sm">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="mt-4 text-2xl">{title}</CardTitle>
                <CardDescription className="text-base leading-7 text-foreground/75">{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 lg:px-12">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground uppercase">
            <T>Why this exists</T>
          </p>
          <h2 className="mt-4 text-4xl font-semibold text-balance sm:text-5xl">
            <T>Localization should be part of the build system, not a separate product your team has to orbit.</T>
          </h2>
          <p className="mt-5 text-lg leading-8 text-foreground/75">
            <T>
              Better Translation treats localization as code-aware infrastructure. Developers choose the translation logic, the
              generated locales stay inside the repository, and future non-developer editing can happen through an open-source
              locale editor that works as either a hosted service or a self-hosted deployment.
            </T>
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {featureCards.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="border border-foreground/10 bg-background/90 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-brand-primary/12 text-foreground">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-xl">{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 text-base leading-7 text-foreground/75">{description}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 pb-24 sm:px-10 lg:px-12">
        <Card className="overflow-hidden border border-foreground/10 bg-[linear-gradient(135deg,rgba(9,17,17,0.96),rgba(17,46,41,0.94))] py-0 text-white shadow-2xl shadow-brand-primary/10">
          <div className="grid gap-10 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:py-10">
            <div>
              <p className="text-sm font-medium text-white/55 uppercase">
                <T>Editor roadmap</T>
              </p>
              <h2 className="mt-4 text-4xl font-semibold text-balance">
                <T>An open-source locale editor for contributors, reviewers, and operations teams.</T>
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/72">
                <T>
                  The next piece is a hosted locale editor where non-developers can update cloud locales without changing app
                  code. It will be available as our cloud product and as a self-hosted deployment for teams that need to keep
                  everything in their own stack.
                </T>
              </p>
            </div>

            <div className="grid gap-4">
              {deploymentCards.map(({ title, description, icon: Icon }) => (
                <div key={title} className="rounded-3xl border border-white/12 bg-white/6 p-5 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-white/12">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="text-xl font-medium">{title}</h3>
                  </div>
                  <p className="mt-3 text-base leading-7 text-white/72">{description}</p>
                </div>
              ))}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <Link to="/sign-up" className={cn(buttonVariants({ size: "lg" }), "bg-white text-black hover:bg-white/90")}>
                  <T>Join early</T>
                </Link>
                <Link
                  to="/sign-in"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "border-white/20 bg-white/8 text-white hover:bg-white/14 hover:text-white",
                  )}
                >
                  <T>Sign in</T>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </main>
  )
}
