"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { DEFAULT_FRAME_CATALOG_ROWS, normalizeFrameCatalogRows, type FrameCatalogRow } from "@/lib/frame-catalog"

export function useFrameCatalog() {
  const [rows, setRows] = useState<FrameCatalogRow[]>(DEFAULT_FRAME_CATALOG_ROWS.filter((row) => row.published))
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch("/api/catalog/frames", { cache: "no-store", credentials: "include" })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        const parsed = normalizeFrameCatalogRows(data.rows, { onlyPublished: true })
        if (parsed.length > 0) {
          setRows(parsed)
          return
        }
      }
      setRows(DEFAULT_FRAME_CATALOG_ROWS.filter((row) => row.published))
    } catch {
      setRows(DEFAULT_FRAME_CATALOG_ROWS.filter((row) => row.published))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { rows, loading, refresh }
}
