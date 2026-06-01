import { ChevronsUpDownIcon, PlusIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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
  const [open, setOpen] = useState(false)
  const selectedInstallation = installations.find((installation) => installation.installationId === selectedInstallationId)

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" className="max-w-full min-w-56 justify-between gap-3 px-2.5 font-normal" />
          }
        >
          {selectedInstallation ? (
            <span className="flex min-w-0 items-center gap-2">
              <ResourceMark
                label={selectedInstallation.accountLogin}
                imageUrl={selectedInstallation.accountAvatarUrl}
                className="size-5 rounded-md"
              />
              <span className="truncate">{selectedInstallation.accountLogin}</span>
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <PlusIcon />
              Add GitHub Account
            </span>
          )}
          <ChevronsUpDownIcon data-icon="inline-end" className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) min-w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandList>
              {installations.length > 0 && (
                <>
                  <CommandGroup>
                    {installations.map((installation) => {
                      const selected = installation.installationId === selectedInstallationId

                      return (
                        <CommandItem
                          key={installation.id}
                          value={installation.accountLogin}
                          data-checked={selected || undefined}
                          data-selected={selected || undefined}
                          onSelect={() => {
                            onSelectInstallation(installation.installationId)
                            setOpen(false)
                          }}
                        >
                          <ResourceMark
                            label={installation.accountLogin}
                            imageUrl={installation.accountAvatarUrl}
                            className="size-5 rounded-md"
                          />
                          <span className="truncate">{installation.accountLogin}</span>
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}
              <CommandGroup>
                <CommandItem
                  value="add-github-account"
                  disabled={!githubInstallUrl}
                  onSelect={() => {
                    setOpen(false)
                    openGitHubSetup(githubInstallUrl, onAddAccountComplete)
                  }}
                >
                  <PlusIcon />
                  Add GitHub Account
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function openGitHubSetup(url: string | null, onClose?: () => void) {
  if (!url) return
  const width = 1040
  const height = 760
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2)
  const popup = window.open(url, "better-translation-github", `width=${width},height=${height},left=${left},top=${top}`)
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
