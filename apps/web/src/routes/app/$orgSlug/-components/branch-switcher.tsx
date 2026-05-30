import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams, useRouter } from "@tanstack/react-router"
import { CheckIcon, ChevronsUpDownIcon, GitBranchIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { T, useT } from "better-translation/react"

import { useAppForm } from "@/components/react-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { createTranslationBranchFn, setSelectedBranchFn, type getProjectDetailFn } from "../projects/$projectId/-data"

type ProjectDetail = Awaited<ReturnType<typeof getProjectDetailFn>>

export function BranchSwitcher({
  branches,
  currentBranchName,
}: {
  branches: ProjectDetail["branches"]
  currentBranchName: string
}) {
  const { orgSlug, projectId } = useParams({ from: "/app/$orgSlug/projects/$projectId" })
  const navigate = useNavigate()
  const router = useRouter()
  const activeBranch = branches.find((branch) => branch.name === currentBranchName) ?? branches.find((branch) => branch.isDefault)
  const setSelectedBranch = useMutation({ mutationFn: setSelectedBranchFn })
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 max-w-64 min-w-0 justify-start px-2 font-medium" />}>
          <GitBranchIcon className="text-muted-foreground" />
          <span className="truncate">{activeBranch?.name ?? currentBranchName}</span>
          <ChevronsUpDownIcon data-icon="inline-end" className="text-muted-foreground" />
          <span className="sr-only">Switch Translation Branch</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-72" align="start" sideOffset={8}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>Translation Branches</DropdownMenuLabel>
            {branches.map((branch) => {
              const isActive = branch.name === activeBranch?.name

              return (
                <DropdownMenuItem
                  key={branch.id}
                  disabled={isActive}
                  onMouseEnter={() => {
                    if (!isActive) {
                      void router.preloadRoute({
                        to: "/app/$orgSlug/projects/$projectId/branches/$branchName",
                        params: { orgSlug, projectId, branchName: branch.name },
                      })
                    }
                  }}
                  onFocus={() => {
                    if (!isActive) {
                      void router.preloadRoute({
                        to: "/app/$orgSlug/projects/$projectId/branches/$branchName",
                        params: { orgSlug, projectId, branchName: branch.name },
                      })
                    }
                  }}
                  onClick={() => {
                    if (isActive) return
                    setSelectedBranch.mutate({ data: { orgSlug, projectId, branchName: branch.name } })
                    void navigate({
                      to: "/app/$orgSlug/projects/$projectId/branches/$branchName",
                      params: { orgSlug, projectId, branchName: branch.name },
                    })
                  }}
                >
                  <GitBranchIcon className="text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{branch.name}</div>
                    <div className="truncate text-xs leading-3 text-muted-foreground">
                      {branch.isDefault ? (
                        <T>Default</T>
                      ) : branch.parentBranchName ? (
                        <>
                          <T>Inherits from</T> {branch.parentBranchName}
                        </>
                      ) : (
                        <T>Feature</T>
                      )}
                    </div>
                  </div>
                  <CheckIcon className={isActive ? "opacity-100" : "opacity-0"} />
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              Create Translation Branch
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateBranchDialog branches={branches} open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}

function CreateBranchDialog({
  branches,
  onOpenChange,
  open,
}: {
  branches: ProjectDetail["branches"]
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const { orgSlug, projectId } = useParams({ from: "/app/$orgSlug/projects/$projectId" })
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [branchError, setBranchError] = useState<string | null>(null)
  const createBranchMutation = useMutation({
    mutationFn: (data: { name: string; orgSlug: string; parentBranchId: number | null; projectId: string }) =>
      createTranslationBranchFn({ data }),
    onSuccess: (branch) => {
      toast.success(t("Translation Branch created"))
      void setSelectedBranchFn({ data: { orgSlug, projectId, branchName: branch.name } })
      void queryClient.invalidateQueries({ queryKey: ["project-detail", orgSlug, projectId] })
      onOpenChange(false)
      void navigate({
        to: "/app/$orgSlug/projects/$projectId/branches/$branchName",
        params: { orgSlug, projectId, branchName: branch.name },
      })
    },
    onError: (error: Error) => setBranchError(error.message),
  })

  const form = useAppForm({
    defaultValues: { name: "", parentBranchId: "default" },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, { error: t("Branch name is required") })
          .max(120),
        parentBranchId: z.string(),
      }),
    },
    onSubmit: ({ value }) => {
      setBranchError(null)
      createBranchMutation.mutate({
        orgSlug,
        projectId,
        name: value.name.trim(),
        parentBranchId: value.parentBranchId === "default" ? null : Number(value.parentBranchId),
      })
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <T>New Translation Branch</T>
          </DialogTitle>
          <DialogDescription>
            <T>Create a branch-local workspace for Manifest and Locale value changes.</T>
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
              {(field) => <field.TextField label={t("Branch name")} placeholder="feature/pricing-copy" />}
            </form.AppField>
            <form.AppField name="parentBranchId">
              {(field) => (
                <field.NativeSelectField label={t("Parent branch")}>
                  <option value="default">
                    {t("Default")} ({branches.find((branch) => branch.isDefault)?.name ?? "main"})
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </field.NativeSelectField>
              )}
            </form.AppField>
            <form.SubmitButton>
              {(isSubmitting) => (isSubmitting || createBranchMutation.isPending ? <T>Creating...</T> : <T>Create branch</T>)}
            </form.SubmitButton>
            <form.FormError>{branchError}</form.FormError>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  )
}
