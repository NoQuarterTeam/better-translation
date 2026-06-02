import * as z from "zod"

const nullableTrimmedString = (min: number, max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .pipe(z.string().trim().min(min).max(max).nullable())

export const glossaryTermFields = z.object({
  action: z.enum(["preserve", "translate_as", "avoid"]),
  enabled: z.boolean(),
  note: nullableTrimmedString(1, 1000),
  sourceTerm: z.string().trim().min(1).max(160),
  targetLocale: nullableTrimmedString(2, 20).transform((locale) => locale?.toLowerCase() ?? null),
  targetTerm: nullableTrimmedString(1, 160),
})

export function validateGlossaryTargetTerm(term: z.infer<typeof glossaryTermFields>, ctx: z.RefinementCtx) {
  if (term.action !== "preserve" && !term.targetTerm) {
    ctx.addIssue({
      code: "custom",
      message: "Target term is required for this action.",
      path: ["targetTerm"],
    })
  }
}

export const glossaryTermInputSchema = glossaryTermFields.superRefine(validateGlossaryTargetTerm)
