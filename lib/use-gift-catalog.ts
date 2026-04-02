"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"
import { DEFAULT_GIFT_CATALOG_ROWS, normalizeGiftCatalogRows, type GiftCatalogRow } from "@/lib/gift-catalog"

export function useGiftCatalog() {
  const [rows, setRows] = useState<GiftCatalogRow[]>(DEFAULT_GIFT_CATALOG_ROWS.filter((row) => row.published))
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch("/api/catalog/gifts", { cache: "no-store", credentials: "include" })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        const parsed = normalizeGiftCatalogRows(data.rows, { onlyPublished: true })
        if (parsed.length > 0) {
          setRows(parsed)
          return
        }
      }
      setRows(DEFAULT_GIFT_CATALOG_ROWS.filter((row) => row.published))
    } catch {
      setRows(DEFAULT_GIFT_CATALOG_ROWS.filter((row) => row.published))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { rows, loading, refresh }
}
