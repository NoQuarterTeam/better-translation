import { useMemo } from "react"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface TablePaginationProps {
  currentPage: number
  totalPages: number | undefined
  totalCount?: number
  onPageChange: (page: number) => void
  maxVisiblePages?: number
}

export function TablePagination({
  currentPage,
  totalPages,
  totalCount,
  onPageChange,
  maxVisiblePages = 7,
}: TablePaginationProps) {
  const pages = useMemo(() => {
    const pageNumbers: (number | "ellipsis")[] = []
    const tempPages = totalPages ?? 10

    if (tempPages <= maxVisiblePages) {
      for (let i = 1; i <= tempPages; i++) {
        pageNumbers.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pageNumbers.push(i)
        }
        pageNumbers.push("ellipsis")
        pageNumbers.push(tempPages)
      } else if (currentPage >= tempPages - 2) {
        pageNumbers.push(1)
        pageNumbers.push("ellipsis")
        for (let i = tempPages - 3; i <= tempPages; i++) {
          pageNumbers.push(i)
        }
      } else {
        pageNumbers.push(1)
        pageNumbers.push("ellipsis")
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pageNumbers.push(i)
        }
        pageNumbers.push("ellipsis")
        pageNumbers.push(tempPages)
      }
    }

    return pageNumbers
  }, [currentPage, totalPages, maxVisiblePages])

  return (
    <div className="flex w-full items-center justify-between">
      {totalCount !== undefined ? (
        <p className="text-sm whitespace-nowrap text-muted-foreground">{totalCount.toLocaleString()} results</p>
      ) : (
        <div />
      )}
      <Pagination className="m-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault()
                if (currentPage > 1) {
                  onPageChange(currentPage - 1)
                }
              }}
              className={currentPage <= 1 || !totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
          {pages.map((pageNum, index) => {
            if (pageNum === "ellipsis") {
              return (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              )
            }
            return (
              <PaginationItem key={pageNum}>
                <PaginationLink
                  href="#"
                  isActive={pageNum === currentPage}
                  className={!totalPages ? "pointer-events-none opacity-50" : ""}
                  onClick={(e) => {
                    e.preventDefault()
                    onPageChange(pageNum)
                  }}
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            )
          })}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault()
                if (!totalPages) return
                if (currentPage < totalPages) {
                  onPageChange(currentPage + 1)
                }
              }}
              className={!totalPages || currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
