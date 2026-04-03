"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

export type StatusLine = {
  text: string
  published: boolean
  deleted: boolean
  updatedAt: number
}

export function useStatusLine() {
  const [row, setRow] = useState<StatusLine | null>(null)
  const [loading, setLoading] = useState(true)
  const initialRef = { current: true }

  const refresh = useCallback(async () => {
    try {
      if (initialRef.current) { setLoading(true); initialRef.current = false }
      const res = await apiFetch("/api/catalog/status-line", { cache: "no-store", credentials: "include" })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok || !data?.row || typeof data.row.text !== "string") {
        setRow(null)
        return
      }
      const text = data.row.text.trim()
      if (!text) {
        setRow(null)
        return
      }
      setRow({
        text,
        published: data.row.published === true,
        deleted: data.row.deleted === true,
        updatedAt: Number(data.row.updatedAt) || Date.now(),
      })
    } catch {
      setRow(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, 15000)
    return () => window.clearInterval(id)
  }, [refresh])

  return { row, loading, refresh }
}

