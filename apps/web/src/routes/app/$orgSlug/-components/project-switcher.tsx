import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { Link, useNavigate, useParams, useRouter } from "@tanstack/react-router"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { organizationProjectsQueryOptions, setSelectedProjectFn } from "../-data"
import { ResourceMark } from "./resource-mark"

export function ProjectSwitcher() {
  const { orgSlug } = useParams({ from: "/app/$orgSlug" })
  const params = useParams({ strict: false })
  const projectSlug = typeof params.projectSlug === "string" ? params.projectSlug : null
  const navigate = useNavigate()
  const router = useRouter()
  const projects = useSuspenseQuery(organizationProjectsQueryOptions(orgSlug)).data

  const setSelectedProject = useMutation({ mutationFn: setSelectedProjectFn })
  if (!projectSlug) return null

  const project = projects.find((item) => item.slug === projectSlug)
  const branchName = project ? getProjectBranchName(project) : null

  return (
    <DropdownMenu>
      <div className="flex h-9 max-w-64 min-w-0 items-center">
        <Button
          variant="ghost"
          className="h-9 min-w-0 justify-start gap-3 px-2 font-medium"
          render={
            branchName ? (
              <Link to="/app/$orgSlug/projects/$projectSlug/branches/$branchName" params={{ orgSlug, projectSlug, branchName }} />
            ) : (
              <Link to="/app/$orgSlug/projects/$projectSlug" params={{ orgSlug, projectSlug }} />
            )
          }
        >
          <ResourceMark label={project?.name ?? projectSlug} className="size-6 rounded-md" />
          <span className="hidden truncate sm:inline">{project?.name ?? projectSlug}</span>
        </Button>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="h-9" />}>
          <ChevronsUpDownIcon data-icon="inline-end" className="text-muted-foreground" />
          <span className="sr-only">Switch Project</span>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent className="min-w-72" align="start" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          {projects.map((item) => {
            const isActive = item.slug === projectSlug
            const itemBranchName = getProjectBranchName(item)

            return (
              <DropdownMenuItem
                key={item.id}
                disabled={isActive}
                onMouseEnter={() => {
                  if (!isActive && itemBranchName) {
                    void router.preloadRoute({
                      to: "/app/$orgSlug/projects/$projectSlug/branches/$branchName",
                      params: { orgSlug, projectSlug: item.slug, branchName: itemBranchName },
                    })
                  }
                }}
                onFocus={() => {
                  if (!isActive && itemBranchName) {
                    void router.preloadRoute({
                      to: "/app/$orgSlug/projects/$projectSlug/branches/$branchName",
                      params: { orgSlug, projectSlug: item.slug, branchName: itemBranchName },
                    })
                  }
                }}
                onClick={() => {
                  if (isActive) return
                  setSelectedProject.mutate({ data: { orgSlug, projectId: item.id } })
                  if (itemBranchName) {
                    void navigate({
                      to: "/app/$orgSlug/projects/$projectSlug/branches/$branchName",
                      params: { orgSlug, projectSlug: item.slug, branchName: itemBranchName },
                    })
                    return
                  }

                  void navigate({
                    to: "/app/$orgSlug/projects/$projectSlug",
                    params: { orgSlug, projectSlug: item.slug },
                  })
                }}
                className="gap-3"
              >
                <ResourceMark label={item.name} className="size-7 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.name}</div>
                  <div className="truncate text-xs leading-3 text-muted-foreground">{item.slug}</div>
                </div>
                <CheckIcon className={isActive ? "opacity-100" : "opacity-0"} />
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void navigate({ to: "/app/$orgSlug/projects/new", params: { orgSlug } })}>
            <PlusIcon />
            Create Project
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function getProjectBranchName(project: { defaultBranchName: string | null; selectedBranchName: string | null }) {
  return project.selectedBranchName ?? project.defaultBranchName
}
