import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"

export type MultiSelectPrimitive = string | number

export type MultiSelectProps<Item, Value extends MultiSelectPrimitive = Extract<Item, MultiSelectPrimitive>> = {
  id?: string
  isInvalid?: boolean
  items: readonly Item[]
  onChange: (value: Value[]) => void
  placeholder?: string
  value: Value[]
  getItemKey?: (item: Item) => string
  getItemValue?: (item: Item) => Value
  itemToStringValue?: (item: Item) => string
  renderChip?: (item: Item) => React.ReactNode
  renderItem?: (item: Item) => React.ReactNode
} & Omit<
  React.ComponentProps<typeof Combobox<Item, true>>,
  "children" | "items" | "itemToStringValue" | "multiple" | "value" | "onValueChange"
>

export function MultiSelect<Item, Value extends MultiSelectPrimitive = Extract<Item, MultiSelectPrimitive>>({
  id,
  isInvalid = false,
  items,
  onChange,
  placeholder,
  value,
  renderChip,
  renderItem,
  ...rest
}: MultiSelectProps<Item, Value>) {
  const { getItemKey, getItemValue, itemToStringValue } = rest as {
    getItemKey?: (item: Item) => string
    getItemValue?: (item: Item) => Value
    itemToStringValue?: (item: Item) => string
  }
  const resolvedGetItemValue = getItemValue ?? getDefaultItemValue<Item, Value>
  const resolvedItemToStringValue = itemToStringValue ?? getDefaultStringValue<Item>
  const resolvedGetItemKey = getItemKey ?? ((item: Item) => String(resolvedGetItemValue(item)))
  const resolvedRenderItem = renderItem ?? ((item: Item) => resolvedItemToStringValue(item))
  const selectedItems = items.filter((item) => value.includes(resolvedGetItemValue(item)))
  const anchor = useComboboxAnchor()

  return (
    <Combobox
      autoHighlight
      {...rest}
      items={items}
      itemToStringValue={resolvedItemToStringValue}
      multiple
      value={selectedItems}
      onValueChange={(nextValue) => onChange(nextValue.map((item) => resolvedGetItemValue(item)))}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(values: Item[] | undefined) => (
            <>
              {values?.map((item: Item) => (
                <ComboboxChip key={resolvedGetItemKey(item)}>{renderChip?.(item) ?? resolvedRenderItem(item)}</ComboboxChip>
              ))}
              <ComboboxChipsInput
                aria-invalid={isInvalid}
                aria-describedby={isInvalid && id ? `${id}-error` : undefined}
                placeholder={values?.length ? "" : placeholder}
              />
              <ComboboxTrigger className="ml-auto" />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={resolvedGetItemKey(item)} value={item}>
              {resolvedRenderItem(item)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export type MultiSelectComponent = typeof MultiSelect

function isPrimitive(value: unknown): value is MultiSelectPrimitive {
  return typeof value === "string" || typeof value === "number"
}

function getDefaultItemValue<Item, Value extends MultiSelectPrimitive>(item: Item) {
  if (isPrimitive(item)) return item as unknown as Value
  throw new Error("MultiSelect requires getItemValue when items are objects")
}

function getDefaultStringValue<Item>(item: Item) {
  if (isPrimitive(item)) return String(item)
  throw new Error("MultiSelect requires itemToStringValue when items are objects")
}
