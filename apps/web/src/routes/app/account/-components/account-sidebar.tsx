import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@better-translation/ui/components/sidebar"
import { Link } from "@tanstack/react-router"
import { ShieldCheckIcon, UserIcon } from "lucide-react"

import { T } from "better-translation/react"

export function AccountSidebarSlot() {
  return <AccountSidebarContent />
}

function AccountSidebarContent() {
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>
          <T>Account</T>
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    to="/app/account"
                    onClick={closeMobile}
                    className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                    activeOptions={{ exact: true, includeSearch: false }}
                  />
                }
              >
                <UserIcon />
                <span>
                  <T>Profile</T>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={
                  <Link
                    to="/app/account/authentication"
                    onClick={closeMobile}
                    className="opacity-50 data-[status=active]:bg-muted data-[status=active]:opacity-100"
                  />
                }
              >
                <ShieldCheckIcon />
                <span>
                  <T>Authentication</T>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
