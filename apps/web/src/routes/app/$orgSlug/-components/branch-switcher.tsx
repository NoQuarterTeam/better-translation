import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate, useParams, useRouter } from "@tanstack/react-router"
import { CheckIcon, ChevronsUpDownIcon, GitBranchIcon, StarIcon } from "lucide-react"

import { T } from "better-translation/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { organizationProjectsQueryOptions, setSelectedBranchFn } from "../-data"

export function BranchSwitcher() {
  const { orgSlug } = useParams({ from: "/app/$orgSlug" })
  const params = useParams({ strict: false })
  const projectSlug = typeof params.projectSlug === "string" ? params.projectSlug : null
  const branchName = typeof params.branchName === "string" ? params.branchName : null
  const projects = useSuspenseQuery(organizationProjectsQueryOptions(orgSlug)).data
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const router = useRouter()
  const setSelectedBranch = useMutation({
    mutationFn: setSelectedBranchFn,
    onSuccess: () => {
      void queryClient.invalidateQueries(organizationProjectsQueryOptions(orgSlug))
    },
  })

  if (!projectSlug || !branchName) return null

  const branches = projects.find((project) => project.slug === projectSlug)?.branches ?? []
  const activeBranch = branches.find((branch) => branch.name === branchName)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="h-9 max-w-56 min-w-0 justify-start gap-2 px-2 font-medium" />}
      >
        <GitBranchIcon className="text-muted-foreground" />
        <span className="truncate">{activeBranch?.name ?? branchName}</span>
        <ChevronsUpDownIcon data-icon="inline-end" className="ml-auto text-muted-foreground" />
        <span className="sr-only">Switch Branch</span>
      </DropdownMenuTrigger>
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
                      to: "/app/$orgSlug/projects/$projectSlug/branches/$branchName",
                      params: { orgSlug, projectSlug, branchName: branch.name },
                    })
                  }
                }}
                onFocus={() => {
                  if (!isActive) {
                    void router.preloadRoute({
                      to: "/app/$orgSlug/projects/$projectSlug/branches/$branchName",
                      params: { orgSlug, projectSlug, branchName: branch.name },
                    })
                  }
                }}
                onClick={() => {
                  if (isActive) return
                  setSelectedBranch.mutate({ data: { orgSlug, projectSlug, branchName: branch.name } })
                  void navigate({
                    to: "/app/$orgSlug/projects/$projectSlug/branches/$branchName",
                    params: { orgSlug, projectSlug, branchName: branch.name },
                  })
                }}
              >
                <GitBranchIcon className="text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{branch.name}</div>
                  <BranchRoleBadge isProduction={branch.isDefault} />
                </div>
                <CheckIcon className={isActive ? "opacity-100" : "opacity-0"} />
              </DropdownMenuItem>
            )
          })}
          {branches.length === 0 && (
            <DropdownMenuItem disabled>
              <T>No Branches</T>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BranchRoleBadge({ isProduction }: { isProduction: boolean }) {
  return isProduction ? (
    <Badge className="mt-1">
      <StarIcon data-icon="inline-start" />
      <T>Production</T>
    </Badge>
  ) : (
    <Badge variant="secondary" className="mt-1">
      <GitBranchIcon data-icon="inline-start" />
      <T>Feature</T>
    </Badge>
  )
}
