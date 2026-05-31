import { useNavigate, useRouter } from "@tanstack/react-router"
import { LogOutIcon } from "lucide-react"

import type { Locale } from "better-translation/messages"
import { useT } from "better-translation/react"

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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { authClient } from "@/lib/auth/client"
import { getLocale, setLocale } from "@/routes/-locale"
import type { User } from "@/server/db/schema"

function createInitials(user: Pick<User, "name">) {
  return (
    user.name
      ?.split(" ")
      .map((name) => name[0])
      .join("") || ""
  )
}

const languageOptions = [
  { label: "English", value: "en" },
  { label: "Nederlands", value: "nl" },
] satisfies { label: string; value: Locale }[]

export function NavUser() {
  const navigate = useNavigate()
  const router = useRouter()
  const t = useT()
  const { data: session, isPending } = authClient.useSession()
  const user = session?.user
  const locale = getLocale()

  if (isPending || !user) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar className="border hover:opacity-75">
          <AvatarImage src={user.image || undefined} alt={user.name || user.email || ""} />
          <AvatarFallback>{createInitials(user)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-data-[slot=dropdown-menu-trigger]-width min-w-56 rounded-lg" align="end" sideOffset={4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar>
                <AvatarImage src={user.image || undefined} alt={user.name || user.email || ""} />
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
        <div className="px-1 py-1.5" onClick={(e) => e.stopPropagation()}>
          <Select
            aria-label={t("Select locale")}
            value={locale}
            items={languageOptions}
            onValueChange={(nextLocale) => {
              setLocale(nextLocale as Locale)
              void router.invalidate()
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
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
            void authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  void navigate({ to: "/sign-in" })
                },
              },
            })
          }}
        >
          <LogOutIcon />
          {t("Log out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
