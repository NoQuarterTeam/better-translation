import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams, useRouter } from "@tanstack/react-router"
import { CheckIcon, ChevronsUpDownIcon, GitBranchIcon } from "lucide-react"

import { T } from "better-translation/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

import { setSelectedBranchFn, type getProjectDetailFn } from "../projects/$projectId/-data"

type ProjectDetail = Awaited<ReturnType<typeof getProjectDetailFn>>

export function BranchSwitcher({
  branches,
  onNavigate,
  currentBranchName,
}: {
  branches: ProjectDetail["branches"]
  onNavigate?: () => void
  currentBranchName: string
}) {
  const { orgSlug, projectId } = useParams({ from: "/app/$orgSlug/projects/$projectId" })
  const navigate = useNavigate()
  const router = useRouter()
  const queryClient = useQueryClient()
  const activeBranch = branches.find((branch) => branch.name === currentBranchName) ?? branches.find((branch) => branch.isDefault)
  const branchName = activeBranch?.name ?? currentBranchName
  const setSelectedBranch = useMutation({
    mutationFn: setSelectedBranchFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-detail", orgSlug, projectId] })
    },
  })

  return (
    <DropdownMenu>
      <SidebarMenuItem>
        <DropdownMenuTrigger render={<SidebarMenuButton />}>
          <GitBranchIcon className="text-muted-foreground" />
          <span>{branchName}</span>
          <ChevronsUpDownIcon className="ml-auto text-muted-foreground" />
          <span className="sr-only">Switch Branch</span>
        </DropdownMenuTrigger>
      </SidebarMenuItem>
      <DropdownMenuContent className="min-w-72" align="start" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Branches</DropdownMenuLabel>
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
                  onNavigate?.()
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
