'use client'

import type { Table } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type DataTablePaginationLabels = {
  summary: (start: number, end: number, total: number) => string
  page: (page: number, totalPages: number) => string
  previous: string
  next: string
  rowsPerPage: string
  pageSize: (size: number) => string
}

interface DataTablePaginationProps<TData> {
  table: Table<TData>
  labels: DataTablePaginationLabels
  pageSizeOptions?: number[]
  totalRows?: number
}

export function DataTablePagination<TData>({
  table,
  labels,
  pageSizeOptions = [10, 20, 50],
  totalRows,
}: DataTablePaginationProps<TData>) {
  const rowCount = totalRows ?? table.getPrePaginationRowModel().rows.length
  const pageSize = table.getState().pagination.pageSize
  const pageIndex = table.getState().pagination.pageIndex
  const totalPages = Math.max(table.getPageCount(), 1)
  const start = rowCount === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, rowCount)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t bg-muted/50">
      <div className="text-sm text-muted-foreground">
        {labels.summary(start, end, rowCount)}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{labels.rowsPerPage}</span>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {labels.pageSize(size)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm">
          {labels.page(pageIndex + 1, totalPages)}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {labels.previous}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {labels.next}
          </Button>
        </div>
      </div>
    </div>
  )
}
