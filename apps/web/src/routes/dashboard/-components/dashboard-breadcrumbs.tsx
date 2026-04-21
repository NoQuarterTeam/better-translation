import { isMatch, Link, useMatches } from "@tanstack/react-router"
import { Fragment } from "react"

import { useT } from "@better-translate/react"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export function DashboardBreadcrumbs() {
  const t = useT()
  const matchesWithCrumbs = useMatches({
    select: (matches) => matches.filter((match) => isMatch(match, "loaderData.crumb")),
  })

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap sm:flex-wrap">
        <BreadcrumbItem className="hidden min-w-0 md:block">
          <BreadcrumbLink className="max-w-[100px] truncate sm:max-w-none" render={<Link to="/dashboard" />}>
            {t("Dashboard")}
          </BreadcrumbLink>
        </BreadcrumbItem>
        {matchesWithCrumbs.length > 0 ? <BreadcrumbSeparator className="hidden md:block" /> : null}
        {matchesWithCrumbs.map((match, i) => (
          <Fragment key={match.id}>
            <BreadcrumbItem className="min-w-0">
              {i === matchesWithCrumbs.length - 1 ? (
                <BreadcrumbPage className="max-w-[100px] truncate sm:max-w-none">
                  {match.loaderData?.crumb.label ? t(match.loaderData.crumb.label) : null}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  className="max-w-[100px] truncate sm:max-w-none"
                  render={<Link to={match.loaderData?.crumb.url} />}
                >
                  {match.loaderData?.crumb.label ? t(match.loaderData.crumb.label) : null}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {i < matchesWithCrumbs.length - 1 ? <BreadcrumbSeparator /> : null}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
