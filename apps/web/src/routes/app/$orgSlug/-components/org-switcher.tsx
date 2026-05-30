import { useMutation, useQuery } from "@tanstack/react-query"
import { useNavigate, useRouter } from "@tanstack/react-router"
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

import { setSelectedOrganizationFn, useCurrentOrganization, userOrganizationsQueryOptions } from "../-data"
import { ResourceMark } from "./resource-mark"

export function OrgSwitcher() {
  const navigate = useNavigate()
  const router = useRouter()
  const { organization } = useCurrentOrganization()
  const { data: organizations = [] } = useQuery(userOrganizationsQueryOptions())
  const setSelectedOrganization = useMutation({ mutationFn: setSelectedOrganizationFn })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 max-w-64 min-w-0 justify-start px-2 font-medium" />}>
        <ResourceMark label={organization.name} imageUrl={organization.logo} className="size-6 rounded-md" />
        <span className="truncate">{organization.name}</span>
        <ChevronsUpDownIcon data-icon="inline-end" className="text-muted-foreground" />
        <span className="sr-only">Switch organization</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-72" align="start" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          {organizations.map((item) => {
            const isActive = item.id === organization.id

            return (
              <DropdownMenuItem
                key={item.id}
                disabled={isActive}
                onMouseEnter={() => {
                  if (!isActive) void router.preloadRoute({ to: "/app/$orgSlug", params: { orgSlug: item.slug } })
                }}
                onFocus={() => {
                  if (!isActive) void router.preloadRoute({ to: "/app/$orgSlug", params: { orgSlug: item.slug } })
                }}
                onClick={() => {
                  if (isActive) return
                  setSelectedOrganization.mutate({ data: { organizationId: item.id } })
                  void navigate({ to: "/app/$orgSlug", params: { orgSlug: item.slug } })
                }}
              >
                <ResourceMark label={item.name} imageUrl={item.logo} className="size-7 rounded-md" />
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
          <DropdownMenuItem onClick={() => void navigate({ to: "/app/create-org" })}>
            <PlusIcon />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
