import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

import { getBaseUrl } from "@/lib/config"

export const authClient = createAuthClient({
  baseURL: `${getBaseUrl()}/api/auth`,
  plugins: [organizationClient()],
})
