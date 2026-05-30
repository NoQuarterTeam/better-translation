import { createFileRoute } from "@tanstack/react-router"

import { AppShell } from "../-components/app-shell"
import { OrgSidebar } from "../-components/org-sidebar"

export const Route = createFileRoute("/app/$orgSlug/_org")({
  component: OrgLayout,
})

function OrgLayout() {
  return <AppShell sidebar={<OrgSidebar />} />
}
