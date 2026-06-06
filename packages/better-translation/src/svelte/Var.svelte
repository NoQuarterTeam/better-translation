<script lang="ts">
  const props = $props<Record<string, unknown>>()

  const entries = $derived(Object.entries(props).filter(([key]) => key !== "children" && key !== "name" && key !== "value"))
  const value = $derived(props.value ?? entries[0]?.[1] ?? props.name)
</script>

{value}
