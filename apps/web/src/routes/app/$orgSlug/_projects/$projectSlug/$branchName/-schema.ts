import * as z from "zod"

export const messageViewSchema = z.enum(["all", "needs-value", "manual", "ai"]).catch("all")
export type MessageView = z.infer<typeof messageViewSchema>
