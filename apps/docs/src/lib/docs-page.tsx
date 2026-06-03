import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import browserCollections from "collections/browser"
import { useFumadocsLoader } from "fumadocs-core/source/client"
import { DocsLayout } from "fumadocs-ui/layouts/docs"
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page"
import { Suspense } from "react"

import { getMDXComponents } from "@/components/mdx"
import { baseOptions } from "@/lib/layout.shared"
import { source } from "@/lib/source"

const serverLoader = createServerFn({ method: "GET" })
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs)
    if (!page) throw notFound()

    return {
      path: page.path,
      pageTree: await source.serializePageTree(source.getPageTree()),
    }
  })

const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: MDX }, _props: undefined) {
    return (
      <DocsPage toc={toc} tableOfContent={{ style: "clerk" }}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <DocsBody>
          <MDX components={getMDXComponents()} />
        </DocsBody>
      </DocsPage>
    )
  },
})

export async function loadDocsPage(slugs: string[]) {
  const data = await serverLoader({ data: slugs })
  await clientLoader.preload(data.path)
  return data
}

export function DocsRoutePage({ data }: { data: Awaited<ReturnType<typeof loadDocsPage>> }) {
  const loaded = useFumadocsLoader(data)

  return (
    <DocsLayout {...baseOptions()} tree={loaded.pageTree}>
      <Suspense>{clientLoader.useContent(loaded.path)}</Suspense>
    </DocsLayout>
  )
}
