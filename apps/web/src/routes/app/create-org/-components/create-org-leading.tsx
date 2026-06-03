import { Button } from "@better-translation/ui/components/button"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useCanGoBack, useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"
import { Suspense } from "react"

import { T } from "better-translation/react"

import { userOrganizationsQueryOptions } from "../-data"

export function CreateOrgLeadingSlot() {
  return (
    <Suspense fallback={null}>
      <CreateOrgLeading />
    </Suspense>
  )
}

function CreateOrgLeading() {
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  const organizations = useSuspenseQuery(userOrganizationsQueryOptions()).data

  if (organizations.length === 0) return null

  return (
    <Button
      variant="ghost"
      onClick={() => {
        if (canGoBack) {
          window.history.back()
          return
        }

        void navigate({ to: "/app" })
      }}
    >
      <ArrowLeftIcon data-icon="inline-start" />
      <span className="hidden sm:inline">
        <T>Back</T>
      </span>
    </Button>
  )
}
