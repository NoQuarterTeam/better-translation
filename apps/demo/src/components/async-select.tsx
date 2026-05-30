import { ChevronDownIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type AsyncSelectPrimitive = string | number

export type AsyncSelectProps<Item, Value extends AsyncSelectPrimitive = Extract<Item, AsyncSelectPrimitive>> = {
  disabled?: boolean
  id?: string
  isInvalid?: boolean
  isPending?: boolean
  items: readonly Item[]
  onBlur?: () => void
  onChange: (value: Value) => void
  onItemSelect?: (item: Item) => void
  onSearchChange: (search: string) => void
  placeholder?: string
  search: string
  value: Value | undefined
  getItemKey?: (item: Item) => number | string
  getItemValue?: (item: Item) => Value
  itemToStringValue?: (item: Item) => string
  renderItem?: (item: Item) => React.ReactNode
  selectedItem?: Item | null
}

export function AsyncSelect<Item, Value extends AsyncSelectPrimitive = Extract<Item, AsyncSelectPrimitive>>({
  disabled = false,
  id,
  isInvalid = false,
  isPending = false,
  items,
  onBlur,
  onChange,
  onItemSelect,
  onSearchChange,
  placeholder = "Select an option",
  search,
  value,
  renderItem,
  selectedItem,
  ...rest
}: AsyncSelectProps<Item, Value>) {
  const { getItemKey, getItemValue, itemToStringValue } = rest
  const resolvedGetItemValue = getItemValue ?? getDefaultItemValue<Item, Value>
  const resolvedItemToStringValue = itemToStringValue ?? getDefaultStringValue<Item>
  const resolvedGetItemKey = getItemKey ?? ((item: Item) => String(resolvedGetItemValue(item)))
  const resolvedRenderItem = renderItem ?? ((item: Item) => resolvedItemToStringValue(item))
  const resolvedSelectedItem = selectedItem ?? items.find((item) => resolvedGetItemValue(item) === value) ?? null

  const [open, setOpen] = React.useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) onBlur?.()
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="w-full justify-between border-input bg-transparent px-2.5 font-normal shadow-xs dark:bg-input/30 dark:hover:bg-input/50"
          />
        }
        id={id}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid && id ? `${id}-error` : undefined}
        aria-expanded={open}
        disabled={disabled}
      >
        <span className={cn("truncate", !resolvedSelectedItem && "text-muted-foreground")}>
          {resolvedSelectedItem ? resolvedItemToStringValue(resolvedSelectedItem) : placeholder}
        </span>
        <ChevronDownIcon className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput autoFocus placeholder="Search..." value={search} onValueChange={onSearchChange} />
          <CommandList>
            <CommandEmpty>{isPending ? "Loading..." : search ? "No results found." : "Type to search..."}</CommandEmpty>
            {items.length > 0 && (
              <CommandGroup>
                {items.map((item) => {
                  const itemValue = resolvedGetItemValue(item)
                  const isSelected = itemValue === value

                  return (
                    <CommandItem
                      key={resolvedGetItemKey(item)}
                      value={String(itemValue)}
                      data-checked={isSelected || undefined}
                      data-selected={isSelected || undefined}
                      onSelect={() => {
                        onChange(itemValue)
                        onItemSelect?.(item)
                        setOpen(false)
                      }}
                    >
                      {resolvedRenderItem(item)}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export type AsyncSelectComponent = typeof AsyncSelect

function isPrimitive(value: unknown): value is AsyncSelectPrimitive {
  return typeof value === "string" || typeof value === "number"
}

function getDefaultItemValue<Item, Value extends AsyncSelectPrimitive>(item: Item) {
  if (isPrimitive(item)) return item as unknown as Value
  throw new Error("AsyncSelect requires getItemValue when items are objects")
}

function getDefaultStringValue<Item>(item: Item) {
  if (isPrimitive(item)) return String(item)
  throw new Error("AsyncSelect requires itemToStringValue when items are objects")
}
