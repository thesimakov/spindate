"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch } from "@/lib/api-fetch"

export type TickerEditorial = {
  text: string
  published: boolean
  deleted: boolean
  updatedAt: number
} | null

export type TickerPlayerSegment = {
  id: number
  text: string
  linkUrl: string
} | null

export function useTickerFeed(pollMs = 12_000) {
  const [editorial, setEditorial] = useState<TickerEditorial>(null)
  const [player, setPlayer] = useState<TickerPlayerSegment>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/catalog/ticker-feed", { cache: "no-store", credentials: "include" })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setEditorial(null)
        setPlayer(null)
        return
      }

      const ed = data.editorial
      if (ed && typeof ed.text === "string" && ed.text.trim()) {
        setEditorial({
          text: ed.text.trim(),
          published: ed.published === true,
          deleted: ed.deleted === true,
          updatedAt: Number(ed.updatedAt) || 0,
        })
      } else {
        setEditorial(null)
      }

      const pl = data.player
      if (
        pl &&
        typeof pl.text === "string" &&
        pl.text.trim() &&
        typeof pl.linkUrl === "string" &&
        pl.linkUrl.trim()
      ) {
        setPlayer({
          id: Number(pl.id),
          text: pl.text.trim(),
          linkUrl: pl.linkUrl.trim(),
        })
      } else {
        setPlayer(null)
      }
    } catch {
      setEditorial(null)
      setPlayer(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, pollMs)
    return () => window.clearInterval(id)
  }, [refresh, pollMs])

  return { editorial, player, loading, refresh }
}
