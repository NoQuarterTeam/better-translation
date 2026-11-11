import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import browserCollections from "collections/browser"
import { useFumadocsLoader } from "fumadocs-core/source/client"
import { DocsLayout } from "fumadocs-ui/layouts/docs"
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page"
import type { MDXProps } from "mdx/types"
import { type FC, Suspense } from "react"

import { getMDXComponents } from "@/components/mdx"
import { baseOptions } from "@/lib/layout.shared"
import { source } from "@/lib/source"

const serverLoader = createServerFn({ method: "GET" })
  .validator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs)
    if (!page) throw notFound()

    return {
      path: page.path,
      pageTree: await source.serializePageTree(source.getPageTree()),
    }
  })

const clientLoader = browserCollections.docs.createClientLoader({
  component(page, _props: undefined) {
    // fumadocs-mdx 15.6 widens compiled page exports to unknown when it merges page outputs, so restore the shapes this
    // page renders.
    const frontmatter = page.frontmatter as { title: string; description?: string }
    const MDX = page.default as FC<MDXProps>
    return (
      <DocsPage toc={page.toc} tableOfContent={{ style: "clerk" }}>
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
