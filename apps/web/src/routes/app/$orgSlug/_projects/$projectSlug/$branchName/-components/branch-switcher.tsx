import { Button } from "@better-translation/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@better-translation/ui/components/dropdown-menu"
import { Skeleton } from "@better-translation/ui/components/skeleton"
import { Spinner } from "@better-translation/ui/components/spinner"
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { Link, useParams, useRouteContext } from "@tanstack/react-router"
import { CheckIcon, ChevronsUpDownIcon, GitBranchIcon, StarIcon } from "lucide-react"
import { Suspense, useState } from "react"

import { T } from "better-translation/react"

import {
  branchSwitcherBranchesQueryOptions,
  currentBranchSwitcherQueryOptions,
  invalidateSelectedBranchChromeQueries,
  setSelectedBranchChromeQueryData,
  setSelectedBranchFn,
} from "../-data"

export function BranchSwitcherSlot() {
  return (
    <Suspense fallback={<BranchSwitcherFallback />}>
      <BranchSwitcher />
    </Suspense>
  )
}

function BranchSwitcher() {
  const { branchName, orgSlug, projectSlug } = useParams({ from: "/app/$orgSlug/_projects/$projectSlug/$branchName/" })
  const queryClient = useRouteContext({ from: "/app" }).queryClient
  const activeBranch = useSuspenseQuery(currentBranchSwitcherQueryOptions(orgSlug, projectSlug, branchName)).data
  const [open, setOpen] = useState(false)
  const branchesQueryOptions = branchSwitcherBranchesQueryOptions(orgSlug, projectSlug)
  const branchesQuery = useQuery({ ...branchesQueryOptions, enabled: open })
  const branches = branchesQuery.data ?? []
  const setSelectedBranch = useMutation({
    mutationFn: setSelectedBranchFn,
    onMutate: ({ data }) => {
      setSelectedBranchChromeQueryData(queryClient, orgSlug, projectSlug, data.branchName)
    },
    onSuccess: () => {
      invalidateSelectedBranchChromeQueries(queryClient, orgSlug, projectSlug)
    },
    onError: () => {
      invalidateSelectedBranchChromeQueries(queryClient, orgSlug, projectSlug)
    },
  })

  const prefetchBranches = () => {
    void queryClient.prefetchQuery(branchesQueryOptions)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger onFocus={prefetchBranches} onMouseEnter={prefetchBranches} render={<Button variant="ghost" />}>
        <BranchRoleIcon isProduction={activeBranch.isDefault} />
        <span className="truncate">{activeBranch.name}</span>
        <ChevronsUpDownIcon data-icon="inline-end" className="ml-auto text-muted-foreground" />
        <span className="sr-only">Switch Branch</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-72" align="start" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Branches</DropdownMenuLabel>
          {branchesQuery.isLoading && <SwitcherLoadingItem />}
          {branches.map((branch) => {
            const isActive = branch.id === activeBranch.id

            return (
              <DropdownMenuItem
                key={branch.id}
                disabled={isActive}
                nativeButton={false}
                render={
                  <Link
                    onClick={() => setSelectedBranch.mutate({ data: { orgSlug, projectSlug, branchName: branch.name } })}
                    to="/app/$orgSlug/$projectSlug/$branchName"
                    params={{ orgSlug, projectSlug, branchName: branch.name }}
                  />
                }
              >
                <BranchRoleIcon isProduction={branch.isDefault} />
                <div className="min-w-0 flex-1">
                  <span className="truncate font-medium">{branch.name}</span>
                </div>
                <CheckIcon className={isActive ? "opacity-100" : "opacity-0"} />
              </DropdownMenuItem>
            )
          })}
          {!branchesQuery.isLoading && branches.length === 0 && (
            <DropdownMenuItem disabled>
              <T>No Branches</T>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BranchSwitcherFallback() {
  return (
    <Button variant="ghost">
      <GitBranchIcon />
      <Skeleton className="h-5 w-20 flex-1" />
    </Button>
  )
}

function BranchRoleIcon({ isProduction }: { isProduction: boolean }) {
  return isProduction ? (
    <span className="text-muted-foreground">
      <StarIcon />
      <span className="sr-only">
        <T>Production</T>
      </span>
    </span>
  ) : (
    <span className="text-muted-foreground">
      <GitBranchIcon />
      <span className="sr-only">
        <T>Feature</T>
      </span>
    </span>
  )
}

function SwitcherLoadingItem() {
  return (
    <DropdownMenuItem disabled className="justify-center py-3">
      <Spinner className="text-muted-foreground" />
    </DropdownMenuItem>
  )
}
