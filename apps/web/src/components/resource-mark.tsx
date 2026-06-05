import { cn } from "@better-translation/ui/lib/utils"

export function ResourceMark({ className, label, imageUrl }: { className?: string; imageUrl?: string | null; label: string }) {
  const initials = label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xs font-semibold text-muted-foreground ring-1 ring-border",
        className,
      )}
    >
      {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : initials}
    </span>
  )
}
