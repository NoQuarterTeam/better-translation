import { Button } from "@better-translation/ui/components/button"
import { useCanGoBack, useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"

import { T } from "better-translation/react"

export function AccountBackSlot() {
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()

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
