import * as z from "zod"

export const tablePaginationSearchParams = z.object({
  page: z.coerce.number().int().min(1).optional().default(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(10).catch(10),
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .catch(""),
})
