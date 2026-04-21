import "@tanstack/react-start/server-only"
import type { ReactNode } from "react"
import { Resend } from "resend"

import { env } from "@/env"

const resend = new Resend(env.RESEND_API_KEY)
const appEmailFrom = "Better Translation <better-translation@updates.noquarter.co>"

export async function sendAppEmail({ to, subject, react }: { to: string; subject: string; react: ReactNode }) {
  try {
    const { error } = await resend.emails.send({ from: appEmailFrom, to, subject, react })
    if (error) throw new Error(`Failed to send email: ${error.message}`)
  } catch (error) {
    console.log(error)
  }
}
