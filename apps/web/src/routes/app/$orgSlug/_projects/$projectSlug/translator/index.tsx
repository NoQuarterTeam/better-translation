import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontalIcon, PencilIcon, PlusIcon, PowerIcon, PowerOffIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { DataTable } from "@/components/data-table"
import { useAppForm } from "@/components/react-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NativeSelectOption } from "@/components/ui/native-select"
import { formatLocale } from "@/lib/locales"

import {
  createTranslationGlossaryTermFn,
  deleteTranslationGlossaryTermFn,
  glossaryTermInputSchema,
  projectTranslatorQueryOptions,
  setTranslationGlossaryTermEnabledFn,
  updateProjectTranslatorFn,
  updateTranslationGlossaryTermFn,
  type getProjectTranslatorFn,
} from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_projects/$projectSlug/translator/")({
  component: ProjectTranslatorPage,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(projectTranslatorQueryOptions(params.orgSlug, params.projectSlug))
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Translator")} · Better Translation` }] }
  },
})

type ProjectTranslator = Awaited<ReturnType<typeof getProjectTranslatorFn>>
type GlossaryTerm = ProjectTranslator["translationGlossaryTerms"][number]
type GlossaryTermAction = GlossaryTerm["action"]

function ProjectTranslatorPage() {
  const { orgSlug, projectSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const t = useT()
  const translatorQuery = useSuspenseQuery(projectTranslatorQueryOptions(orgSlug, projectSlug))
  const project = translatorQuery.data
  const projectTranslatorQueryKey = projectTranslatorQueryOptions(orgSlug, projectSlug).queryKey
  const [createGlossaryTermOpen, setCreateGlossaryTermOpen] = useState(false)

  const updateTranslatorMutation = useMutation({
    mutationFn: updateProjectTranslatorFn,
    onSuccess: (updatedProject) => {
      toast.success(t("Project translator updated"))
      queryClient.setQueryData<ProjectTranslator>(projectTranslatorQueryKey, updatedProject)
    },
  })

  const translatorForm = useAppForm({
    defaultValues: {
      translationPrompt: project.translationPrompt,
    },
    validators: {
      onSubmit: z.object({
        translationPrompt: z.string().trim().min(1).max(4000),
      }),
    },
    onSubmit: ({ value }) => {
      updateTranslatorMutation.mutate({
        data: {
          orgSlug,
          projectSlug,
          translationPrompt: value.translationPrompt.trim(),
        },
      })
    },
  })

  const glossaryColumns = useMemo<ColumnDef<GlossaryTerm>[]>(
    () => [
      {
        accessorKey: "sourceTerm",
        header: t("Source term"),
        cell: ({ row }) => <span className="font-medium">{row.original.sourceTerm}</span>,
      },
      {
        accessorKey: "action",
        header: t("Rule"),
        cell: ({ row }) => formatGlossaryAction(row.original.action, t),
      },
      {
        accessorKey: "targetLocale",
        header: t("Locale"),
        cell: ({ row }) => row.original.targetLocale ?? t("All Locales"),
      },
      {
        accessorKey: "targetTerm",
        header: t("Target term"),
        cell: ({ row }) => row.original.targetTerm ?? <span className="text-muted-foreground">{t("None")}</span>,
      },
      {
        accessorKey: "enabled",
        header: t("Status"),
        cell: ({ row }) =>
          row.original.enabled ? <Badge>{t("Enabled")}</Badge> : <Badge variant="secondary">{t("Disabled")}</Badge>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <GlossaryTermActions term={row.original} />,
      },
    ],
    [t],
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Translator</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Configure how the Platform translator generates blank Locale values.</T>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Custom instructions</T>
          </CardTitle>
          <CardDescription>
            <T>Tone, style, and product guidance for AI-generated Locale values.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <translatorForm.AppForm>
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void translatorForm.handleSubmit()
              }}
            >
              <translatorForm.AppField name="translationPrompt">
                {(field) => (
                  <field.TextareaField
                    aria-label={t("Custom instructions")}
                    placeholder={t("Tone, glossary, and style guidance")}
                    rows={5}
                  />
                )}
              </translatorForm.AppField>
              <translatorForm.SubmitButton className="w-fit">
                {(isSubmitting) =>
                  isSubmitting || updateTranslatorMutation.isPending ? <T>Saving...</T> : <T>Save translator</T>
                }
              </translatorForm.SubmitButton>
              <translatorForm.FormError>{updateTranslatorMutation.error?.message}</translatorForm.FormError>
            </form>
          </translatorForm.AppForm>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>
            <T>Glossary terms</T>
          </CardTitle>
          <CardDescription>
            <T>Project terms the Platform translator should preserve, prefer, or avoid.</T>
          </CardDescription>
          <CardAction>
            <Dialog open={createGlossaryTermOpen} onOpenChange={setCreateGlossaryTermOpen}>
              <DialogTrigger render={<Button className="w-fit" />}>
                <PlusIcon />
                <T>Add term</T>
              </DialogTrigger>
              <GlossaryTermDialog projectLocales={project.projectLocales} term={null} onOpenChange={setCreateGlossaryTermOpen} />
            </Dialog>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataTable columns={glossaryColumns} data={project.translationGlossaryTerms} />
        </CardContent>
      </Card>
    </div>
  )
}

function GlossaryTermActions({ term }: { term: GlossaryTerm }) {
  const { orgSlug, projectSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const t = useT()
  const [editOpen, setEditOpen] = useState(false)
  const queryOptions = projectTranslatorQueryOptions(orgSlug, projectSlug)

  const setEnabledMutation = useMutation({
    mutationFn: setTranslationGlossaryTermEnabledFn,
    onSuccess: () => {
      toast.success(term.enabled ? t("Glossary term disabled") : t("Glossary term enabled"))
      void queryClient.invalidateQueries(queryOptions)
    },
    onError: (error: Error) => toast.error(t("Could not update glossary term"), { description: error.message }),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteTranslationGlossaryTermFn,
    onSuccess: () => {
      toast.success(t("Glossary term removed"))
      void queryClient.invalidateQueries(queryOptions)
    },
    onError: (error: Error) => toast.error(t("Could not remove glossary term"), { description: error.message }),
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontalIcon />
          <span className="sr-only">Glossary term actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <PencilIcon />
              <T>Edit</T>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={setEnabledMutation.isPending}
              onClick={() =>
                setEnabledMutation.mutate({ data: { orgSlug, projectSlug, termId: term.id, enabled: !term.enabled } })
              }
            >
              {term.enabled ? <PowerOffIcon /> : <PowerIcon />}
              {term.enabled ? <T>Disable</T> : <T>Enable</T>}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ data: { orgSlug, projectSlug, termId: term.id } })}
            >
              <Trash2Icon />
              <T>Remove</T>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <GlossaryTermDialog
          projectLocales={queryClient.getQueryData<ProjectTranslator>(queryOptions.queryKey)?.projectLocales ?? []}
          term={term}
          onOpenChange={setEditOpen}
        />
      </Dialog>
    </>
  )
}

function GlossaryTermDialog({
  onOpenChange,
  projectLocales,
  term,
}: {
  onOpenChange: (open: boolean) => void
  projectLocales: string[]
  term: GlossaryTerm | null
}) {
  const { orgSlug, projectSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const t = useT()
  const queryOptions = projectTranslatorQueryOptions(orgSlug, projectSlug)
  const createMutation = useMutation({
    mutationFn: createTranslationGlossaryTermFn,
    onSuccess: () => {
      toast.success(t("Glossary term added"))
      void queryClient.invalidateQueries(queryOptions)
      onOpenChange(false)
    },
  })
  const updateMutation = useMutation({
    mutationFn: updateTranslationGlossaryTermFn,
    onSuccess: () => {
      toast.success(t("Glossary term updated"))
      void queryClient.invalidateQueries(queryOptions)
      onOpenChange(false)
    },
  })

  const form = useAppForm({
    defaultValues: {
      action: term?.action ?? ("preserve" as GlossaryTermAction),
      enabled: term?.enabled ?? true,
      note: term?.note ?? "",
      sourceTerm: term?.sourceTerm ?? "",
      targetLocale: term?.targetLocale ?? "",
      targetTerm: term?.targetTerm ?? "",
    },
    validators: {
      onSubmit: glossaryTermInputSchema,
    },
    onSubmit: ({ value }) => {
      const data = {
        orgSlug,
        projectSlug,
        action: value.action,
        enabled: value.enabled,
        note: value.note,
        sourceTerm: value.sourceTerm,
        targetLocale: value.targetLocale,
        targetTerm: value.action === "preserve" ? "" : value.targetTerm,
      }

      if (term) updateMutation.mutate({ data: { ...data, termId: term.id } })
      else createMutation.mutate({ data })
    },
  })

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{term ? <T>Edit glossary term</T> : <T>Add glossary term</T>}</DialogTitle>
        <DialogDescription>
          <T>Glossary terms are applied when the Platform translator generates Locale values.</T>
        </DialogDescription>
      </DialogHeader>
      <form.AppForm>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <form.AppField name="sourceTerm">
            {(field) => <field.TextField label={t("Source term")} placeholder={t("Better Translation")} />}
          </form.AppField>
          <form.AppField name="action">
            {(field) => (
              <field.NativeSelectField label={t("Rule")}>
                <NativeSelectOption value="preserve">{t("Do not translate")}</NativeSelectOption>
                <NativeSelectOption value="translate_as">{t("Translate as")}</NativeSelectOption>
                <NativeSelectOption value="avoid">{t("Avoid term")}</NativeSelectOption>
              </field.NativeSelectField>
            )}
          </form.AppField>
          <form.AppField name="targetLocale">
            {(field) => (
              <field.NativeSelectField label={t("Target Locale")}>
                <NativeSelectOption value="">{t("All Locales")}</NativeSelectOption>
                {projectLocales.map((locale) => (
                  <NativeSelectOption key={locale} value={locale}>
                    {formatLocale(locale, [locale])} ({locale})
                  </NativeSelectOption>
                ))}
              </field.NativeSelectField>
            )}
          </form.AppField>
          <form.Subscribe selector={(state) => state.values.action}>
            {(action) =>
              action === "preserve" ? null : (
                <form.AppField name="targetTerm">
                  {(field) => (
                    <field.TextField
                      label={action === "translate_as" ? t("Translate to") : t("Do not use")}
                      placeholder={action === "translate_as" ? t("Preferred translation") : t("Forbidden term")}
                    />
                  )}
                </form.AppField>
              )
            }
          </form.Subscribe>
          <form.AppField name="note">
            {(field) => <field.TextareaField label={t("Note")} placeholder={t("Context for the translator")} rows={3} />}
          </form.AppField>
          <form.AppField name="enabled">
            {(field) => <field.CheckboxField label={t("Enabled")} description={t("Use this term in AI generation")} />}
          </form.AppField>
          <DialogFooter>
            <form.SubmitButton className="w-fit">
              {(isSubmitting) =>
                isSubmitting || createMutation.isPending || updateMutation.isPending ? (
                  <T>Saving...</T>
                ) : term ? (
                  <T>Save term</T>
                ) : (
                  <T>Add term</T>
                )
              }
            </form.SubmitButton>
          </DialogFooter>
          <form.FormError>{createMutation.error?.message ?? updateMutation.error?.message}</form.FormError>
        </form>
      </form.AppForm>
    </DialogContent>
  )
}

function formatGlossaryAction(action: GlossaryTermAction, t: ReturnType<typeof useT>) {
  if (action === "translate_as") return t("Translate as")
  if (action === "avoid") return t("Avoid term")
  return t("Do not translate")
}
