import { useMutation, useQuery } from "@tanstack/react-query"
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

export function ProjectSwitcher({ project }: { project: { id: number; name: string; publicId: string } }) {
  const { orgSlug } = useParams({ from: "/app/$orgSlug" })
  const navigate = useNavigate()
  const router = useRouter()
  const { data: projects = [] } = useQuery(organizationProjectsQueryOptions(orgSlug))
  const setSelectedProject = useMutation({ mutationFn: setSelectedProjectFn })

  return (
    <DropdownMenu>
      <div className="flex h-9 max-w-64 min-w-0 items-center">
        <Button
          variant="ghost"
          className="h-9 min-w-0 justify-start gap-3 px-2 font-medium"
          render={<Link to="/app/$orgSlug/projects/$projectId" params={{ orgSlug, projectId: project.publicId }} />}
        >
          <ResourceMark label={project.name} className="size-6 rounded-md" />
          <span className="truncate">{project.name}</span>
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
            const isActive = item.publicId === project.publicId

            return (
              <DropdownMenuItem
                key={item.id}
                disabled={isActive}
                onMouseEnter={() => {
                  if (!isActive) {
                    void router.preloadRoute({
                      to: "/app/$orgSlug/projects/$projectId",
                      params: { orgSlug, projectId: item.publicId },
                    })
                  }
                }}
                onFocus={() => {
                  if (!isActive) {
                    void router.preloadRoute({
                      to: "/app/$orgSlug/projects/$projectId",
                      params: { orgSlug, projectId: item.publicId },
                    })
                  }
                }}
                onClick={() => {
                  if (isActive) return
                  setSelectedProject.mutate({ data: { orgSlug, projectId: item.id } })
                  void navigate({
                    to: "/app/$orgSlug/projects/$projectId",
                    params: { orgSlug, projectId: item.publicId },
                  })
                }}
                className="gap-3"
              >
                <ResourceMark label={item.name} className="size-7 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{item.name}</div>
                  <div className="truncate font-mono text-xs leading-3 text-muted-foreground">{item.publicId}</div>
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
