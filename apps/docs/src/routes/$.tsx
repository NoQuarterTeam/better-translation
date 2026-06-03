import { createFileRoute } from "@tanstack/react-router"

import { DocsRoutePage, loadDocsPage } from "@/lib/docs-page"

export const Route = createFileRoute("/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/").filter(Boolean) ?? []
    return await loadDocsPage(slugs)
  },
})

function Page() {
  return <DocsRoutePage data={Route.useLoaderData()} />
}
