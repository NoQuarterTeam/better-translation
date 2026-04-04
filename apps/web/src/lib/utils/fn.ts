import type * as z from "zod"

export function fn<Schema extends z.ZodSchema, Output>(schema: Schema, handler: (data: z.infer<Schema>) => Promise<Output>) {
  return (data: z.infer<Schema>) => {
    const validatedData = schema.parse(data)
    return handler(validatedData)
  }
}
