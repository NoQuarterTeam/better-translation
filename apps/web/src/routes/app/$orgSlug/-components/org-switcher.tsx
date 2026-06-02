import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, useParams, useRouteContext } from "@tanstack/react-router"
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { Suspense, useState } from "react"

import { ResourceMark } from "@/components/resource-mark"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import { currentOrganizationQueryOptions } from "../-data"
import { setSelectedOrganizationFn, userOrganizationsQueryOptions } from "../../-data"

export function OrgSwitcherSlot() {
  return (
    <Suspense fallback={<SwitcherFallback />}>
      <OrgSwitcher />
    </Suspense>
  )
}

function OrgSwitcher() {
  const { orgSlug } = useParams({ from: "/app/$orgSlug" })
  const queryClient = useRouteContext({ from: "/app" }).queryClient
  const { organization } = useSuspenseQuery(currentOrganizationQueryOptions(orgSlug)).data
  const [open, setOpen] = useState(false)
  const organizationsQueryOptions = userOrganizationsQueryOptions()
  const { data: organizations = [], isLoading } = useQuery({ ...organizationsQueryOptions, enabled: open })
  const setSelectedOrganization = useMutation({ mutationFn: setSelectedOrganizationFn })
  const prefetchOrganizations = () => {
    void queryClient.prefetchQuery(organizationsQueryOptions)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <div className="flex max-w-64 min-w-0 items-center">
        <Button
          variant="ghost"
          nativeButton={false}
          className="pl-1 max-sm:pr-1"
          render={<Link to="/app/$orgSlug" params={{ orgSlug: organization.slug }} />}
        >
          <ResourceMark label={organization.name} imageUrl={organization.logoUrl} className="size-6 rounded-md" />
          <span className="hidden truncate sm:inline">{organization.name}</span>
        </Button>
        <DropdownMenuTrigger
          onFocus={prefetchOrganizations}
          onMouseEnter={prefetchOrganizations}
          render={<Button variant="ghost" className="max-sm:w-6" size="icon-sm" />}
        >
          <ChevronsUpDownIcon data-icon="inline-end" className="text-muted-foreground" />
          <span className="sr-only">Switch organization</span>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent className="min-w-72" align="start" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          {isLoading && <SwitcherLoadingItem />}
          {organizations.map((item) => {
            const isActive = item.id === organization.id

            return (
              <DropdownMenuItem
                key={item.id}
                disabled={isActive}
                nativeButton={false}
                render={<Link to="/app/$orgSlug" params={{ orgSlug: item.slug }} />}
                onClick={() => {
                  setSelectedOrganization.mutate({ data: { organizationId: item.id } })
                }}
                className="gap-3"
              >
                <ResourceMark label={item.name} imageUrl={item.logoUrl} className="size-7 rounded-md" />
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
          <DropdownMenuItem nativeButton={false} render={<Link to="/app/create-org" />}>
            <PlusIcon />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SwitcherFallback() {
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
