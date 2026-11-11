import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@better-translation/ui/components/table"
import { cn } from "@better-translation/ui/lib/utils"
import { type ColumnDef, type RowData, tableFeatures, useTable } from "@tanstack/react-table"

const dataTableFeatures = tableFeatures({})
// A stable empty input keeps the table from rebuilding its row model on every render while data loads.
const emptyRows: never[] = []

export type DataTableColumnDef<TData extends RowData> = ColumnDef<typeof dataTableFeatures, TData>

interface DataTableProps<TData extends RowData> {
  columns: DataTableColumnDef<TData>[]
  data: TData[] | undefined
  isLoading?: boolean
}

export function DataTable<TData extends RowData>({ columns, data, isLoading = false }: DataTableProps<TData>) {
  const table = useTable({ features: dataTableFeatures, columns, data: data ?? emptyRows })

  return (
    <Table className={cn(isLoading && "animate-pulse")}>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return <TableHead key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</TableHead>
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : isLoading ? (
          <TableRow>
            <TableCell className="h-56" />
          </TableRow>
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length} className="h-56 text-center">
              No results.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
