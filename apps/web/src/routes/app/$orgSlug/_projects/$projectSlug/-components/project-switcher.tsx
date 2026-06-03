import { Button } from "@better-translation/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@better-translation/ui/components/dropdown-menu"
import { Skeleton } from "@better-translation/ui/components/skeleton"
import { Spinner } from "@better-translation/ui/components/spinner"
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, useParams, useRouteContext } from "@tanstack/react-router"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { Suspense, useState } from "react"

import { ResourceMark } from "@/components/resource-mark"

import { currentProjectSwitcherQueryOptions, projectSwitcherProjectsQueryOptions, setSelectedProjectFn } from "../-data"

export function ProjectSwitcherSlot() {
  return (
    <Suspense fallback={<ProjectSwitcherFallback />}>
      <ProjectSwitcher />
    </Suspense>
  )
}

function ProjectSwitcher() {
  const { orgSlug, projectSlug } = useParams({ from: "/app/$orgSlug/_projects/$projectSlug" })
  const queryClient = useRouteContext({ from: "/app" }).queryClient
  const project = useSuspenseQuery(currentProjectSwitcherQueryOptions(orgSlug, projectSlug)).data
  const [open, setOpen] = useState(false)
  const projectsQueryOptions = projectSwitcherProjectsQueryOptions(orgSlug)
  const projectsQuery = useQuery({ ...projectsQueryOptions, enabled: open })
  const projects = projectsQuery.data ?? []

  const setSelectedProject = useMutation({ mutationFn: setSelectedProjectFn })
  const prefetchProjects = () => {
    void queryClient.prefetchQuery(projectsQueryOptions)
  }

  const branchName = project.branchName

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <div className="flex max-w-64 min-w-0 items-center">
        <Button
          variant="ghost"
          nativeButton={false}
          className="pl-1 max-sm:pr-1"
          render={
            branchName ? (
              <Link to="/app/$orgSlug/$projectSlug/$branchName" params={{ orgSlug, projectSlug, branchName }} />
            ) : (
              <Link to="/app/$orgSlug/$projectSlug" params={{ orgSlug, projectSlug }} />
            )
          }
        >
          <ResourceMark label={project.name} imageUrl={project.iconUrl} className="size-6 rounded-md" />
          <span className="hidden truncate sm:inline">{project.name}</span>
        </Button>
        <DropdownMenuTrigger
          onFocus={prefetchProjects}
          onMouseEnter={prefetchProjects}
          render={<Button variant="ghost" className="max-sm:w-6" size="icon-sm" />}
        >
          <ChevronsUpDownIcon data-icon="inline-end" className="text-muted-foreground" />
          <span className="sr-only">Switch Project</span>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent className="min-w-72" align="start" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          {projectsQuery.isLoading && <SwitcherLoadingItem />}
          {projects.map((item) => {
            const isActive = item.slug === projectSlug
            const itemBranchName = item.branchName

            return (
              <DropdownMenuItem
                key={item.id}
                disabled={isActive}
                nativeButton={false}
                render={
                  itemBranchName ? (
                    <Link
                      to="/app/$orgSlug/$projectSlug/$branchName"
                      params={{ orgSlug, projectSlug: item.slug, branchName: itemBranchName }}
                    />
                  ) : (
                    <Link to="/app/$orgSlug/$projectSlug" params={{ orgSlug, projectSlug: item.slug }} />
                  )
                }
                onClick={() => {
                  if (isActive) return
                  setSelectedProject.mutate({ data: { orgSlug, projectId: item.id } })
                }}
                className="gap-3"
              >
                <ResourceMark label={item.name} imageUrl={item.iconUrl} className="size-7 rounded-md" />
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
          <DropdownMenuItem nativeButton={false} render={<Link to="/app/$orgSlug/new" params={{ orgSlug }} />}>
            <PlusIcon />
            Create Project
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProjectSwitcherFallback() {
  return (
    <div className="flex h-9 w-36 items-center gap-3 px-2">
      <Skeleton className="size-6 rounded-md" />
      <Skeleton className="hidden h-4 min-w-0 flex-1 sm:block" />
    </div>
  )
}

function SwitcherLoadingItem() {
  return (
    <DropdownMenuItem disabled className="justify-center py-3">
      <Spinner className="text-muted-foreground" />
    </DropdownMenuItem>
  )
}
