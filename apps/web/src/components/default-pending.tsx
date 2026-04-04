import { Spinner } from "@/components/ui/spinner"

export function DefaultPending() {
  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <Spinner />
    </div>
  )
}
