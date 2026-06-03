import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { LanguagesIcon } from "lucide-react"

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <span className="bg-fd-primary text-fd-primary-foreground flex size-6 items-center justify-center rounded-md">
            <LanguagesIcon className="size-3.5" />
          </span>
          Better Translation
        </>
      ),
      url: "/",
    },
    githubUrl: "https://github.com/NoQuarterTeam/better-translation",
  }
}
