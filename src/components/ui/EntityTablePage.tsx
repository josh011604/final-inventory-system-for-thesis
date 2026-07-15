import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'

type Column<T> = {
	header: string
	render: (row: T) => ReactNode
}

type EntityTablePageProps<T> = {
	title: string
	subtitle: string
	rows: T[] | undefined
	isLoading: boolean
	columns: Column<T>[]
	searchKeys: (keyof T)[]
	action?: ReactNode
	emptyMessage?: string
	emptyAction?: ReactNode
	pageSize?: number
	onRowClick?: (row: T) => void
}

export default function EntityTablePage<T extends object>({
	title,
	subtitle,
	rows,
	isLoading,
	columns,
	searchKeys,
	action,
	emptyMessage = 'No records found yet.',
	emptyAction,
	pageSize = 8,
	onRowClick,
}: EntityTablePageProps<T>) {
	const [query, setQuery] = useState('')
	const [page, setPage] = useState(1)

	const filteredRows = useMemo(() => {
		const source = rows ?? []
		const normalized = query.toLowerCase().trim()
		if (!normalized) return source
		return source.filter((row) =>
			searchKeys.some((key) => String((row as Record<string, unknown>)[String(key)] ?? '').toLowerCase().includes(normalized)),
		)
	}, [rows, query, searchKeys])

	const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1)
	const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize)
	const isEmpty = !isLoading && filteredRows.length === 0 && !query

	return (
		<Card
			title={title}
			subtitle={subtitle}
			action={
				<div className="flex flex-wrap items-center gap-2">
					<label className="relative">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
						<input
							value={query}
							onChange={(event) => {
								setQuery(event.target.value)
								setPage(1)
							}}
							placeholder="Search..."
							className="rounded-lg border border-border bg-bg py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
						/>
					</label>
					{action}
				</div>
			}
		>
			{isEmpty ? (
				<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-bg/50 py-12 text-center">
					<p className="text-sm text-text-muted">{emptyMessage}</p>
					{emptyAction}
				</div>
			) : (
				<>
					<div className="overflow-x-auto rounded-xl border border-border">
						<table className="min-w-full divide-y divide-border">
							<thead className="bg-gradient-to-r from-primary-light via-primary-light/60 to-transparent">
								<tr>
									{columns.map((column) => (
										<th key={column.header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-primary">
											{column.header}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{isLoading ? (
									Array.from({ length: 4 }).map((_, index) => (
										<tr key={index}>
											{columns.map((column) => (
												<td key={column.header} className="px-4 py-3">
													<Skeleton className="h-4 w-full" />
												</td>
											))}
										</tr>
									))
								) : pageRows.length > 0 ? (
									pageRows.map((row, rowIndex) => (
										<tr
											key={rowIndex}
											onClick={onRowClick ? () => onRowClick(row) : undefined}
											onKeyDown={
												onRowClick
													? (event) => {
															if (event.key === 'Enter' || event.key === ' ') {
																event.preventDefault()
																onRowClick(row)
															}
														}
													: undefined
											}
											tabIndex={onRowClick ? 0 : undefined}
											role={onRowClick ? 'button' : undefined}
											className={`group border-l-2 border-l-transparent transition hover:border-l-accent hover:bg-primary-light/40 ${
												onRowClick ? 'cursor-pointer focus:bg-primary-light/40 focus:outline-none' : ''
											}`}
										>
											{columns.map((column) => (
												<td key={column.header} className="px-4 py-3 text-sm text-text-primary">
													{column.render(row)}
												</td>
											))}
										</tr>
									))
								) : (
									<tr>
										<td className="px-4 py-10 text-center text-sm text-text-muted" colSpan={columns.length}>
											No matching records found.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					{!isLoading && filteredRows.length > 0 ? (
						<div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-text-muted">
							<span>
								Showing <span className="font-semibold text-text-primary">{(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredRows.length)}</span> of{' '}
								<span className="font-semibold text-text-primary">{filteredRows.length}</span>
							</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setPage((current) => Math.max(current - 1, 1))}
									disabled={page === 1}
									className="rounded-lg border border-border px-3 py-1.5 font-medium transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
								>
									Previous
								</button>
								<span className="rounded-lg bg-gradient-to-r from-primary to-primary-hover px-3 py-1.5 font-semibold text-white shadow-sm">
									{page} / {totalPages}
								</span>
								<button
									type="button"
									onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
									disabled={page === totalPages}
									className="rounded-lg border border-border px-3 py-1.5 font-medium transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
								>
									Next
								</button>
							</div>
						</div>
					) : null}
				</>
			)}
		</Card>
	)
}
