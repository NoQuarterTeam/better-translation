import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { LogOutIcon, UserIcon } from "lucide-react"

import { useT } from "better-translation/react"

import { LocaleSwitcher } from "@/components/locale-switcher"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth/client"
import type { User } from "@/server/db/schema"

import { userProfileQueryOptions } from "../account/-data"

function createInitials(user: Pick<User, "name">) {
  return (
    user.name
      ?.split(" ")
      .map((name) => name[0])
      .join("") || ""
  )
}

export function NavUser() {
  const navigate = useNavigate()
  const t = useT()
  const { data: user, isPending } = useQuery(userProfileQueryOptions())

  if (isPending || !user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar className="border hover:opacity-75">
          <AvatarImage src={user.imageUrl || undefined} alt={user.name || user.email || ""} />
          <AvatarFallback>{createInitials(user)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-data-[slot=dropdown-menu-trigger]-width min-w-56 rounded-lg" align="end" sideOffset={4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar>
                <AvatarImage src={user.imageUrl || undefined} alt={user.name || user.email || ""} />
                <AvatarFallback>{createInitials(user)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-foreground">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void navigate({ to: "/app/account" })}>
          <UserIcon />
          {t("Account")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-1 py-1.5" onClick={(e) => e.stopPropagation()}>
          <LocaleSwitcher className="w-full" />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            void authClient.signOut({ fetchOptions: { onSuccess: () => void navigate({ to: "/sign-in" }) } })
          }}
        >
          <LogOutIcon />
          {t("Log out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
