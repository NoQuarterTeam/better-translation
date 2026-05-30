import type * as z from "zod"
import type { $ZodError, $ZodIssue } from "zod/v4/core"

export class SerializedZodIssues<T extends $ZodIssue[]> extends Error {
  public readonly issues: $ZodError<T>["issues"]

  constructor(issues: T) {
    super("There are some invalid fields")
    this.issues = issues
  }
}

export function parseZod<Schema extends z.ZodSchema>(schema: Schema): (input: z.input<Schema>) => z.output<Schema> {
  return (input: z.input<Schema>) => {
    const res = schema.safeParse(input)
    if (res.success) return res.data
    throw new SerializedZodIssues(res.error.issues)
  }
}
