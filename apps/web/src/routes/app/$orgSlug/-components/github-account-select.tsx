import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { ResourceMark } from "./resource-mark"

export type GitHubAccountOption = {
  accountAvatarUrl: string | null
  accountLogin: string
  id: string
  installationId: string
}

export function GitHubAccountSelect({
  className,
  githubInstallUrl,
  installations,
  onAddAccountComplete,
  onSelectInstallation,
  selectedInstallationId,
}: {
  className?: string
  githubInstallUrl: string | null
  installations: GitHubAccountOption[]
  onAddAccountComplete?: () => void
  onSelectInstallation: (installationId: string) => void
  selectedInstallationId: string
}) {
  return (
    <div className={className}>
      <Select
        value={selectedInstallationId}
        onValueChange={(value) => {
          if (value) onSelectInstallation(value)
        }}
        disabled={installations.length === 0}
      >
        <SelectTrigger className="max-w-full min-w-56">
          <SelectValue placeholder="No GitHub accounts connected" />
        </SelectTrigger>
        <SelectContent align="start">
          {installations.map((installation) => (
            <SelectItem key={installation.id} value={installation.installationId}>
              <ResourceMark
                label={installation.accountLogin}
                imageUrl={installation.accountAvatarUrl}
                className="size-5 rounded-md"
              />
              <span className="truncate">{installation.accountLogin}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={!githubInstallUrl}
        onClick={() => openGitHubSetup(githubInstallUrl, onAddAccountComplete)}
      >
        <PlusIcon />
        <span className="sr-only">Add GitHub Account</span>
      </Button>
    </div>
  )
}

function openGitHubSetup(url: string | null, onClose?: () => void) {
  if (!url) return
  const popup = window.open(url, "better-translation-github", "width=1040,height=760")
  if (!popup) {
    window.location.href = url
    return
  }

  const interval = window.setInterval(() => {
    if (!popup.closed) return
    window.clearInterval(interval)
    onClose?.()
  }, 500)
}
