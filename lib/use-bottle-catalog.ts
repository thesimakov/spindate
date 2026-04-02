"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import {
  DEFAULT_BOTTLE_CATALOG_ROWS,
  normalizeBottleCatalogRows,
  type BottleCatalogSkinRow,
} from "@/lib/bottle-catalog"

export function useBottleCatalog() {
  const [rows, setRows] = useState<BottleCatalogSkinRow[]>(DEFAULT_BOTTLE_CATALOG_ROWS.filter((r) => r.published))
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch("/api/catalog/bottles", { cache: "no-store", credentials: "include" })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        const parsed = normalizeBottleCatalogRows(data.rows, { onlyPublished: true })
        if (parsed.length > 0) {
          setRows(parsed)
          return
        }
      }
      setRows(DEFAULT_BOTTLE_CATALOG_ROWS.filter((r) => r.published))
    } catch {
      setRows(DEFAULT_BOTTLE_CATALOG_ROWS.filter((r) => r.published))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { rows, loading, refresh }
}
