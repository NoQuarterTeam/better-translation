import { redirect } from "@tanstack/react-router"
import { getRequestHeaders } from "@tanstack/react-start/server"

import { auth } from "@/server/auth"

export const getSession = async () => {
  const data = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!data) return null

  return data
}

export const ensureSession = async () => {
  const session = await getSession()
  if (!session?.user) throw redirect({ to: "/sign-in" })
  return session
}

export const signOut = async () => {
  await auth.api.signOut({ headers: getRequestHeaders() })
}
