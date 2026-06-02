import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { ArchiveIcon, CheckIcon, GitBranchIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, StarIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"
import { createTranslator } from "better-translation/server"

import { DataTable } from "@/components/data-table"
import { useAppForm } from "@/components/react-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

import {
  currentProjectSwitcherQueryOptions,
  projectBranchRedirectNameQueryOptions,
  projectSwitcherProjectsQueryOptions,
} from "../-data"
import {
  archiveProjectBranchFn,
  createProjectBranchFn,
  projectBranchesQueryOptions,
  setDefaultProjectBranchFn,
  updateProjectBranchFn,
  type listProjectBranchesFn,
} from "./-data"

export const Route = createFileRoute("/app/$orgSlug/_projects/$projectSlug/branches/")({
  component: ProjectBranchesPage,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(projectBranchesQueryOptions(params.orgSlug, params.projectSlug))
  },
  head: ({ match }) => {
    const t = createTranslator(match.context.messages)
    return { meta: [{ title: `${t("Branches")} · Better Translation` }] }
  },
})

type BranchesData = Awaited<ReturnType<typeof listProjectBranchesFn>>
type BranchRow = BranchesData["branches"][number]

function formatDate(date: Date | string | null) {
  if (!date) return null
  return new Date(date).toISOString().slice(0, 10)
}

function ProjectBranchesPage() {
  const { orgSlug, projectSlug } = Route.useParams()
  const t = useT()
  const branchesQuery = useSuspenseQuery(projectBranchesQueryOptions(orgSlug, projectSlug))

  const branchColumns = useMemo<ColumnDef<BranchRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("Branch"),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
          </div>
        ),
      },
      {
        accessorKey: "isDefault",
        header: t("Tags"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <BranchRoleBadge isProduction={row.original.isDefault} />
            {row.original.lastSyncedAt && (
              <Badge variant="outline">
                <T>Synced</T>
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "valueCount",
        header: t("Locale values"),
        cell: ({ row }) => row.original.valueCount.toLocaleString("en-US"),
      },
      {
        accessorKey: "lastSyncedAt",
        header: t("Last sync"),
        cell: ({ row }) => formatDate(row.original.lastSyncedAt) ?? t("Never"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <BranchActions branch={row.original} />,
      },
    ],
    [t],
  )

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Branches</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Branches are created by plugin sync. Set which Branch represents production for this Project.</T>
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent>
          {branchesQuery.data.branches.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
              <GitBranchIcon className="text-muted-foreground" />
              <div>
                <h2 className="font-medium">
                  <T>No Branches</T>
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <T>Create a production Branch only if plugin sync has not created one yet.</T>
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <CreateProductionBranchDialog />
                <Button
                  variant="outline"
                  render={<Link to="/app/$orgSlug/$projectSlug/settings" params={{ orgSlug, projectSlug }} />}
                >
                  <GitBranchIcon />
                  <T>Connect GitHub</T>
                </Button>
              </div>
            </div>
          ) : (
            <DataTable columns={branchColumns} data={branchesQuery.data.branches} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CreateProductionBranchDialog() {
  const { orgSlug, projectSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const [open, setOpen] = useState(false)
  const t = useT()
  const createBranch = useMutation({
    mutationFn: createProjectBranchFn,
    onSuccess: () => {
      toast.success(t("Branch created"))
      void queryClient.invalidateQueries(projectBranchesQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(currentProjectSwitcherQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(projectBranchRedirectNameQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(projectSwitcherProjectsQueryOptions(orgSlug))
      setOpen(false)
    },
  })

  const form = useAppForm({
    defaultValues: { name: "main" },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: t("Branch name is required") })
          .max(120)
          .regex(/^[A-Za-z0-9._/-]+$/, { error: t("Use letters, numbers, dots, slashes, underscores, or dashes") }),
      }),
    },
    onSubmit: ({ value }) => {
      createBranch.mutate({
        data: {
          orgSlug,
          projectSlug,
          name: value.name.trim(),
        },
      })
    },
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="w-fit" />}>
        <PlusIcon />
        <T>Create production Branch</T>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <T>Create production Branch</T>
          </DialogTitle>
          <DialogDescription>
            <T>This creates the first Branch and marks it as the Project default.</T>
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
            <form.AppField name="name">
              {(field) => <field.TextField label={t("Branch name")} placeholder="main" />}
            </form.AppField>
            <DialogFooter>
              <form.SubmitButton className="w-fit">
                {(isSubmitting) =>
                  isSubmitting || createBranch.isPending ? <T>Creating...</T> : <T>Create production Branch</T>
                }
              </form.SubmitButton>
            </DialogFooter>
            <form.FormError>{createBranch.error?.message}</form.FormError>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  )
}

function BranchRoleBadge({ isProduction }: { isProduction: boolean }) {
  return isProduction ? (
    <Badge>
      <StarIcon data-icon="inline-start" />
      <T>Production</T>
    </Badge>
  ) : (
    <Badge variant="secondary">
      <GitBranchIcon data-icon="inline-start" />
      <T>Feature</T>
    </Badge>
  )
}

function BranchActions({ branch }: { branch: BranchRow }) {
  const { orgSlug, projectSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const t = useT()
  const [editOpen, setEditOpen] = useState(false)
  const setDefaultBranch = useMutation({
    mutationFn: setDefaultProjectBranchFn,
    onSuccess: () => {
      toast.success(t("Production Branch updated"))
      void queryClient.invalidateQueries(projectBranchesQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(currentProjectSwitcherQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(projectBranchRedirectNameQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(projectSwitcherProjectsQueryOptions(orgSlug))
    },
    onError: (error: Error) => toast.error(t("Could not update Production Branch"), { description: error.message }),
  })
  const archiveBranch = useMutation({
    mutationFn: archiveProjectBranchFn,
    onSuccess: () => {
      toast.success(t("Branch archived"))
      void queryClient.invalidateQueries(projectBranchesQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(currentProjectSwitcherQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(projectBranchRedirectNameQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(projectSwitcherProjectsQueryOptions(orgSlug))
    },
    onError: (error: Error) => toast.error(t("Could not archive Branch"), { description: error.message }),
  })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontalIcon />
          <span className="sr-only">Branch actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <PencilIcon />
              <T>Edit</T>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={branch.isDefault || setDefaultBranch.isPending}
              onClick={() => setDefaultBranch.mutate({ data: { orgSlug, projectSlug, branchId: branch.id } })}
            >
              {branch.isDefault ? <CheckIcon /> : <StarIcon />}
              <T>Make Production</T>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={branch.isDefault || archiveBranch.isPending}
              onClick={() => archiveBranch.mutate({ data: { orgSlug, projectSlug, branchId: branch.id } })}
            >
              <ArchiveIcon />
              <T>Archive Branch</T>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditBranchDialog branch={branch} open={editOpen} onOpenChange={setEditOpen} />
    </>
  )
}

function EditBranchDialog({
  branch,
  onOpenChange,
  open,
}: {
  branch: BranchRow
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { orgSlug, projectSlug } = Route.useParams()
  const { queryClient } = Route.useRouteContext()
  const t = useT()
  const updateBranch = useMutation({
    mutationFn: updateProjectBranchFn,
    onSuccess: () => {
      toast.success(t("Branch updated"))
      void queryClient.invalidateQueries(projectBranchesQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(currentProjectSwitcherQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(projectBranchRedirectNameQueryOptions(orgSlug, projectSlug))
      void queryClient.invalidateQueries(projectSwitcherProjectsQueryOptions(orgSlug))
      onOpenChange(false)
    },
  })

  const form = useAppForm({
    defaultValues: { name: branch.name },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: t("Branch name is required") })
          .max(120)
          .regex(/^[A-Za-z0-9._/-]+$/, { error: t("Use letters, numbers, dots, slashes, underscores, or dashes") }),
      }),
    },
    onSubmit: ({ value }) => {
      updateBranch.mutate({ data: { orgSlug, projectSlug, branchId: branch.id, name: value.name.trim() } })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <T>Edit Branch</T>
          </DialogTitle>
          <DialogDescription>
            <T>Update the Branch name used in editor and runtime URLs.</T>
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
            <form.AppField name="name">
              {(field) => <field.TextField label={t("Branch name")} placeholder="main" />}
            </form.AppField>
            <DialogFooter>
              <form.SubmitButton className="w-fit">
                {(isSubmitting) => (isSubmitting || updateBranch.isPending ? <T>Saving...</T> : <T>Save Branch</T>)}
              </form.SubmitButton>
            </DialogFooter>
            <form.FormError>{updateBranch.error?.message}</form.FormError>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  )
}
