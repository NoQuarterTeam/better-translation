import * as z from "zod"

export const tablePaginationSchema = z.object({
  page: z.number().int().min(1, { error: "Page must be at least 1" }).optional().default(1),
  pageSize: z
    .number()
    .int()
    .min(1, { error: "Page size must be at least 1" })
    .max(50, { error: "Page size must be at most 50" })
    .optional()
    .default(10),
  search: z.string().trim().max(100, { error: "Search must be at most 100 characters" }).optional(),
})
