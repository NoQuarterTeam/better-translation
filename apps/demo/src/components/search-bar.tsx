import { useNavigate } from "@tanstack/react-router"
import { SearchIcon } from "lucide-react"
import { useState } from "react"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

export function SearchBar({ placeholder, className }: { placeholder: string; className?: string }) {
  const navigate = useNavigate()
  // const { search } = useSearch<any>({ strict: false })
  const [value, setValue] = useState("")

  return (
    <form
      className={cn("w-full", className)}
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const searchValue = formData.get("search")
        const nextSearchValue = typeof searchValue === "string" ? searchValue.trim() : ""
        void navigate({
          to: ".",
          search: (prev: any) => ({
            ...prev,
            page: 1,
            search: nextSearchValue || undefined,
          }),
        })
      }}
    >
      <InputGroup>
        <InputGroupInput name="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
        <InputGroupAddon align="inline-start">
          <SearchIcon className="text-muted-foreground" />
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
