import { createFormHook, createFormHookContexts } from "@tanstack/react-form"
import { AlertCircleIcon } from "lucide-react"
import * as React from "react"
import { Suspense } from "react"

import type { AsyncSelectComponent, AsyncSelectPrimitive, AsyncSelectProps } from "@/components/async-select"
import type { MultiSelectComponent, MultiSelectPrimitive, MultiSelectProps } from "@/components/multi-select"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, type NativeSelectProps } from "@/components/ui/native-select"
import type { Select as BaseSelect } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { SerializedZodIssues } from "@/lib/functions/middleware"
import { cn } from "@/lib/utils"

const AsyncSelect = React.lazy(async () => {
  const mod = await import("./async-select.tsx")
  return { default: mod.AsyncSelect }
}) as AsyncSelectComponent

const MultiSelect = React.lazy(async () => {
  const mod = await import("./multi-select.tsx")
  return { default: mod.MultiSelect }
}) as MultiSelectComponent

type SelectInputProps = {
  children: React.ReactNode
  id?: string
  isInvalid?: boolean
  onBlur?: () => void
  onChange: (value: string) => void
  placeholder?: string
  value: string
} & React.ComponentProps<typeof BaseSelect>

const AppSelect = React.lazy(async () => {
  const mod = await import("@/components/ui/select")

  function LazySelect({ children, id, isInvalid = false, onBlur, onChange, placeholder, value, ...rest }: SelectInputProps) {
    return (
      <mod.Select
        {...rest}
        highlightItemOnHover
        id={id}
        value={value}
        onValueChange={(nextValue) => onChange((nextValue as string) ?? "")}
      >
        <mod.SelectTrigger
          aria-invalid={isInvalid}
          aria-describedby={isInvalid && id ? `${id}-error` : undefined}
          className="w-full overflow-hidden"
          onBlur={onBlur}
        >
          <mod.SelectValue placeholder={placeholder} />
        </mod.SelectTrigger>
        <mod.SelectContent>{children}</mod.SelectContent>
      </mod.Select>
    )
  }

  return { default: LazySelect }
}) as React.ComponentType<SelectInputProps>

const { fieldContext, formContext, useFormContext, useFieldContext } = createFormHookContexts()

function TextField({
  label,
  placeholder,
  description,
  fieldProps,
  ...rest
}: {
  label: string
  placeholder?: string
  description?: React.ReactNode
  fieldProps?: React.ComponentProps<typeof Field>
} & React.ComponentProps<"input">) {
  const field = useFieldContext<string>()
  const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0
  return (
    <Field {...fieldProps} data-invalid={isInvalid || undefined} className={cn("gap-1", fieldProps?.className)}>
      <FieldContent className="gap-0">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      <FieldContent>
        <Input
          id={field.name}
          placeholder={placeholder}
          aria-invalid={isInvalid}
          aria-describedby={isInvalid ? `${field.name}-error` : undefined}
          value={field.state.value ?? ""}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          {...rest}
        />
        {isInvalid && <FieldError errors={field.state.meta.errors} />}
      </FieldContent>
    </Field>
  )
}

function TextareaField({
  label,
  placeholder,
  description,
  fieldProps,
  ...rest
}: {
  label: string
  placeholder: string
  description?: React.ReactNode
  fieldProps?: React.ComponentProps<typeof Field>
} & React.ComponentProps<"textarea">) {
  const field = useFieldContext<string>()
  const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0
  return (
    <Field {...fieldProps} data-invalid={isInvalid || undefined} className={cn("gap-1", fieldProps?.className)}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Textarea
        id={field.name}
        placeholder={placeholder}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? `${field.name}-error` : undefined}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        {...rest}
      />
      <FieldContent className="gap-0">
        {description && <FieldDescription>{description}</FieldDescription>}
        {isInvalid && <FieldError errors={field.state.meta.errors} />}
      </FieldContent>
    </Field>
  )
}

function NativeSelectField({
  label,
  description,
  children,
  fieldProps,
  ...rest
}: {
  label: string
  description?: React.ReactNode
  children: React.ReactNode
  fieldProps?: React.ComponentProps<typeof Field>
} & NativeSelectProps) {
  const field = useFieldContext<string>()
  const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0
  return (
    <Field {...fieldProps} data-invalid={isInvalid || undefined} className={cn("gap-1", fieldProps?.className)}>
      <FieldContent className="gap-0">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      <FieldContent>
        <NativeSelect
          id={field.name}
          aria-invalid={isInvalid}
          aria-describedby={isInvalid ? `${field.name}-error` : undefined}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          className="w-full"
          {...rest}
        >
          {children}
        </NativeSelect>
        {isInvalid && <FieldError errors={field.state.meta.errors} />}
      </FieldContent>
    </Field>
  )
}

function CheckboxField({
  label,
  description,
  fieldProps,
  ...rest
}: { label: string; description?: React.ReactNode; fieldProps?: React.ComponentProps<typeof Field> } & Omit<
  React.ComponentProps<typeof Checkbox>,
  "checked" | "onCheckedChange"
>) {
  const field = useFieldContext<boolean>()
  const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0
  return (
    <Field orientation="horizontal" {...fieldProps} data-invalid={isInvalid || undefined}>
      <Checkbox
        id={field.name}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? `${field.name}-error` : undefined}
        checked={field.state.value}
        onCheckedChange={(checked) => field.handleChange(checked === true)}
        {...rest}
      />
      <FieldContent>
        <FieldLabel htmlFor={field.name} className="cursor-pointer">
          {label}
        </FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
        {isInvalid && <FieldError errors={field.state.meta.errors} />}
      </FieldContent>
    </Field>
  )
}

type AsyncPrimitive = AsyncSelectPrimitive

function AsyncSelectField<Item, StoredValue extends AsyncPrimitive = Extract<Item, AsyncPrimitive>>({
  label,
  description,
  fieldProps,
  placeholder = "Select an option",
  ...rest
}: {
  label: string
  description?: React.ReactNode
  fieldProps?: React.ComponentProps<typeof Field>
} & Omit<AsyncSelectProps<Item, StoredValue>, "id" | "isInvalid" | "onBlur" | "onChange" | "value">) {
  const field = useFieldContext<StoredValue | undefined>()
  const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0

  return (
    <Field {...fieldProps} data-invalid={isInvalid || undefined} className={cn("gap-1", fieldProps?.className)}>
      <FieldContent className="gap-0">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      <FieldContent>
        <Suspense
          fallback={
            <Button
              variant="outline"
              className="w-full justify-between border-input bg-transparent px-2.5 font-normal shadow-xs dark:bg-input/30 dark:hover:bg-input/50"
              disabled
            >
              <span className="truncate text-muted-foreground">{placeholder}</span>
            </Button>
          }
        >
          <AsyncSelect
            id={field.name}
            isInvalid={isInvalid}
            onBlur={field.handleBlur}
            onChange={(value) => field.handleChange(value)}
            placeholder={placeholder}
            value={field.state.value}
            {...rest}
          />
        </Suspense>
        {isInvalid && <FieldError errors={field.state.meta.errors} />}
      </FieldContent>
    </Field>
  )
}

type MultiPrimitive = MultiSelectPrimitive

function MultiSelectField<Item, StoredValue extends MultiPrimitive = Extract<Item, MultiPrimitive>>({
  label,
  description,
  fieldProps,
  placeholder,
  ...rest
}: {
  label: string
  description?: React.ReactNode
  fieldProps?: React.ComponentProps<typeof Field>
  placeholder?: string
} & Omit<MultiSelectProps<Item, StoredValue>, "id" | "isInvalid" | "onChange" | "value">) {
  const field = useFieldContext<StoredValue[]>()
  const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0

  return (
    <Field {...fieldProps} data-invalid={isInvalid || undefined} className={cn("gap-1", fieldProps?.className)}>
      <FieldContent className="gap-0">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      <FieldContent>
        <Suspense fallback={<Input placeholder={placeholder} disabled />}>
          <MultiSelect
            id={field.name}
            isInvalid={isInvalid}
            onChange={(value) => field.handleChange(value)}
            placeholder={placeholder}
            value={field.state.value}
            {...rest}
          />
        </Suspense>
        {isInvalid && <FieldError errors={field.state.meta.errors} />}
      </FieldContent>
    </Field>
  )
}

function SelectField({
  label,
  description,
  placeholder,
  children,
  fieldProps,
  ...rest
}: {
  label: string
  placeholder?: string
  description?: React.ReactNode
  children: React.ReactNode
  fieldProps?: React.ComponentProps<typeof Field>
} & Omit<React.ComponentProps<typeof AppSelect>, "id" | "isInvalid" | "onBlur" | "onChange" | "value">) {
  const field = useFieldContext<string>()
  const isInvalid = field.state.meta.isTouched && field.state.meta.errors.length > 0

  return (
    <Field {...fieldProps} data-invalid={isInvalid || undefined} className={cn("gap-1", fieldProps?.className)}>
      <FieldContent className="gap-0">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      <FieldContent>
        <Suspense fallback={<Input placeholder={placeholder} disabled />}>
          <AppSelect
            id={field.name}
            isInvalid={isInvalid}
            onBlur={field.handleBlur}
            onChange={(value) => field.handleChange(value)}
            placeholder={placeholder}
            value={field.state.value}
            {...rest}
          >
            {children}
          </AppSelect>
        </Suspense>
        {isInvalid && <FieldError errors={field.state.meta.errors} />}
      </FieldContent>
    </Field>
  )
}

function SubmitButton({
  children,
  ...rest
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
  children: React.ReactNode | ((isSubmitting: boolean) => React.ReactNode)
}) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button type="submit" {...rest} disabled={!canSubmit || isSubmitting || rest.disabled}>
          {typeof children === "function" ? children(isSubmitting ?? false) : children}
        </Button>
      )}
    </form.Subscribe>
  )
}

function FormError({ children }: { children: Error | string | undefined | null }) {
  if (!children) return null
  if (typeof children === "string") {
    return (
      <Alert>
        <AlertCircleIcon />
        <AlertTitle className="whitespace-pre-wrap">{children}</AlertTitle>
      </Alert>
    )
  }

  return (
    <Alert>
      <AlertCircleIcon />
      <AlertTitle className="whitespace-pre-wrap">{children.message}</AlertTitle>
      {children instanceof SerializedZodIssues && <FormFieldErrors error={children} />}
    </Alert>
  )
}

function FormFieldErrors({ error }: { error: Error | null }) {
  if (!error || !(error instanceof SerializedZodIssues)) return null
  if (error.issues.length === 0) return null
  return (
    <ul className="list-disc pl-4 text-muted-foreground">
      {error.issues.map((issue, i) => (
        <li key={issue.path.join(".") + i}>
          {issue.message} for {issue.path.join(".")}
        </li>
      ))}
    </ul>
  )
}

export const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    TextareaField,
    NativeSelectField,
    CheckboxField,
    SelectField,
    AsyncSelectField,
    MultiSelectField,
  },
  formComponents: {
    SubmitButton,
    FormError,
    FormFieldErrors,
  },
})
