"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import type { RoomTableStyle } from "@/lib/rooms/room-appearance"

export type TableStyleCatalogRow = {
  id: RoomTableStyle
  name: string
  published: boolean
  updatedAt: number
  sortOrder: number
}

export function useTableStyleCatalog() {
  const [rows, setRows] = useState<TableStyleCatalogRow[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch("/api/catalog/table-styles", { cache: "no-store", credentials: "include" })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Array.isArray(data.rows)) {
        const parsed: TableStyleCatalogRow[] = []
        for (const item of data.rows as unknown[]) {
          if (!item || typeof item !== "object") continue
          const rec = item as Partial<TableStyleCatalogRow> & { id?: string; updatedAt?: unknown; sortOrder?: unknown }
          if (typeof rec.id !== "string") continue
          parsed.push({
            id: rec.id as RoomTableStyle,
            name: typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : rec.id,
            published: rec.published === true,
            updatedAt: Number(rec.updatedAt) || 0,
            sortOrder: Number(rec.sortOrder) || 0,
          })
        }
        setRows(parsed)
        return
      }
      setRows([])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { rows, loading, refresh }
}
