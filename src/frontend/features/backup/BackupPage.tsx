import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DatabaseBackup, Download } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import { supabase } from '@/backend/lib/supabase/client'
import { getErrorMessage } from '@/backend/lib/errors'

const appName = (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'BISU FIMS'

// Order matters only for readability of the export file.
const TABLES = [
	'departments',
	'categories',
	'suppliers',
	'facilities',
	'equipment',
	'borrow_records',
	'maintenance_requests',
	'notifications',
	'audit_logs',
	'profiles',
] as const

type TableName = (typeof TABLES)[number]
type Row = Record<string, unknown>

const stamp = () => new Date().toISOString().slice(0, 10)

function downloadBlob(filename: string, content: string, mime: string) {
	const blob = new Blob([content], { type: mime })
	const url = URL.createObjectURL(blob)
	const anchor = document.createElement('a')
	anchor.href = url
	anchor.download = filename
	anchor.click()
	URL.revokeObjectURL(url)
}

function toCsv(rows: Row[]): string {
	if (rows.length === 0) return ''
	const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))]
	const cell = (value: unknown) => {
		if (value == null) return ''
		const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
		return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
	}
	return [headers.join(','), ...rows.map((row) => headers.map((header) => cell(row[header])).join(','))].join('\r\n')
}

async function fetchTable(table: TableName): Promise<Row[]> {
	const { data, error } = await supabase.from(table).select('*')
	if (error) throw new Error(`${table}: ${error.message}`)
	return (data ?? []) as Row[]
}

export default function BackupPage() {
	const queryClient = useQueryClient()

	const { data: counts, isLoading: countsLoading } = useQuery({
		queryKey: ['backup-counts'],
		queryFn: async () => {
			const entries = await Promise.all(
				TABLES.map(async (table) => {
					const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
					return [table, count ?? 0] as const
				}),
			)
			return Object.fromEntries(entries) as Record<TableName, number>
		},
	})

	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleFullBackup = async () => {
		setBusy(true)
		setError(null)
		try {
			const tables: Record<string, Row[]> = {}
			for (const table of TABLES) {
				tables[table] = await fetchTable(table)
			}
			const payload = { app: appName, generatedAt: new Date().toISOString(), tables }
			downloadBlob(`bisu-fims-backup-${stamp()}.json`, JSON.stringify(payload, null, 2), 'application/json')
		} catch (backupError) {
			setError(getErrorMessage(backupError, 'Backup failed.'))
		} finally {
			setBusy(false)
		}
	}

	const handleTableDownload = async (table: TableName, format: 'json' | 'csv') => {
		setError(null)
		try {
			const rows = await fetchTable(table)
			if (format === 'json') {
				downloadBlob(`${table}-${stamp()}.json`, JSON.stringify(rows, null, 2), 'application/json')
			} else {
				downloadBlob(`${table}-${stamp()}.csv`, '﻿' + toCsv(rows), 'text/csv;charset=utf-8;')
			}
		} catch (downloadError) {
			setError(getErrorMessage(downloadError, 'Download failed.'))
		}
	}

	// ----- Restore (catalog tables only) -----
	const [parsed, setParsed] = useState<{ categories: Row[]; suppliers: Row[] } | null>(null)
	const [fileName, setFileName] = useState<string | null>(null)
	const [restoreError, setRestoreError] = useState<string | null>(null)
	const [restoreResult, setRestoreResult] = useState<string | null>(null)
	const [restoring, setRestoring] = useState(false)

	const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
		setRestoreError(null)
		setRestoreResult(null)
		setParsed(null)
		const file = event.target.files?.[0]
		if (!file) return
		setFileName(file.name)
		try {
			const json = JSON.parse(await file.text())
			const tables = json?.tables ?? json
			const categories = Array.isArray(tables?.categories) ? tables.categories : []
			const suppliers = Array.isArray(tables?.suppliers) ? tables.suppliers : []
			if (categories.length === 0 && suppliers.length === 0) {
				setRestoreError('No categories or suppliers found in this file.')
				return
			}
			setParsed({ categories, suppliers })
		} catch {
			setRestoreError('Could not read that file — expected a JSON backup exported here.')
		}
	}

	const handleRestore = async () => {
		if (!parsed) return
		setRestoring(true)
		setRestoreError(null)
		setRestoreResult(null)
		try {
			if (parsed.categories.length > 0) {
				const { error: catError } = await supabase
					.from('categories')
					.upsert(parsed.categories.map((row) => ({ name: String(row.name) })), { onConflict: 'name', ignoreDuplicates: true })
				if (catError) throw new Error(catError.message)
			}
			if (parsed.suppliers.length > 0) {
				const { error: supError } = await supabase.from('suppliers').upsert(
					parsed.suppliers.map((row) => ({
						name: String(row.name),
						contact_person: (row.contact_person as string | null) ?? null,
						phone: (row.phone as string | null) ?? null,
						email: (row.email as string | null) ?? null,
					})),
					{ onConflict: 'name' },
				)
				if (supError) throw new Error(supError.message)
			}
			setRestoreResult(`Restored ${parsed.categories.length} categories and ${parsed.suppliers.length} suppliers.`)
			queryClient.invalidateQueries({ queryKey: ['categories'] })
			queryClient.invalidateQueries({ queryKey: ['suppliers'] })
			queryClient.invalidateQueries({ queryKey: ['backup-counts'] })
		} catch (mutationError) {
			setRestoreError(getErrorMessage(mutationError, 'Restore failed.'))
		} finally {
			setRestoring(false)
		}
	}

	return (
		<div className="space-y-6">
			<Card
				title="Backup &amp; Restore"
				subtitle="Data safety"
				action={
					<Button onClick={handleFullBackup} disabled={busy}>
						<Download className="h-4 w-4" />
						{busy ? 'Preparing…' : 'Download Full Backup'}
					</Button>
				}
			>
				<p className="flex items-start gap-2 text-sm text-text-muted">
					<DatabaseBackup className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
					Export a complete JSON snapshot of every table, or download individual tables as JSON or CSV. Keep a backup before making bulk
					changes.
				</p>
				{error ? <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div> : null}
			</Card>

			<Card title="Tables" subtitle="Per-table export">
				{countsLoading ? (
					<div className="space-y-2">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				) : (
					<div className="divide-y divide-border rounded-xl border border-border">
						{TABLES.map((table) => (
							<div key={table} className="flex items-center justify-between gap-3 px-4 py-3">
								<div className="min-w-0">
									<p className="truncate font-medium text-text-primary">{table.replace(/_/g, ' ')}</p>
									<p className="text-xs text-text-muted">{counts?.[table]?.toLocaleString() ?? 0} rows</p>
								</div>
								<div className="flex shrink-0 gap-2">
									<Button size="sm" variant="secondary" onClick={() => handleTableDownload(table, 'json')}>
										JSON
									</Button>
									<Button size="sm" variant="secondary" onClick={() => handleTableDownload(table, 'csv')}>
										CSV
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</Card>

			<Card title="Restore Catalog Data" subtitle="From a backup file">
				<p className="text-sm text-text-muted">
					Upload a backup exported here to re-import <span className="font-medium text-text-primary">categories and suppliers</span>. Existing
					rows are matched by name and left intact — this never deletes data. Transactional and account data are not restored.
				</p>
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<label className="cursor-pointer rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary transition hover:border-primary hover:text-primary">
						<input type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
						{fileName ?? 'Choose backup file…'}
					</label>
					<Button onClick={handleRestore} disabled={!parsed || restoring}>
						{restoring ? 'Restoring…' : 'Restore Catalog'}
					</Button>
				</div>
				{parsed ? (
					<p className="mt-3 text-sm text-text-muted">
						Ready to restore <span className="font-medium text-text-primary">{parsed.categories.length}</span> categories and{' '}
						<span className="font-medium text-text-primary">{parsed.suppliers.length}</span> suppliers.
					</p>
				) : null}
				{restoreError ? <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{restoreError}</div> : null}
				{restoreResult ? <div className="mt-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{restoreResult}</div> : null}
			</Card>
		</div>
	)
}
