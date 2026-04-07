"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

export type TickerPlayerQueueItem = {
  id: number
  text: string
  linkUrl: string
  queueStartMs: number
  queueEndMs: number
}

const CLOCK_MS = 1000

function parsePlayerQueue(raw: unknown): TickerPlayerQueueItem[] {
  if (!Array.isArray(raw)) return []
  const out: TickerPlayerQueueItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const o = row as Record<string, unknown>
    const id = Number(o.id)
    const text = typeof o.text === "string" ? o.text.trim() : ""
    const linkUrl = typeof o.linkUrl === "string" ? o.linkUrl.trim() : ""
    const queueStartMs = Number(o.queueStartMs)
    const queueEndMs = Number(o.queueEndMs)
    if (!Number.isFinite(id) || !text || !linkUrl || !Number.isFinite(queueStartMs) || !Number.isFinite(queueEndMs)) {
      continue
    }
    out.push({ id, text, linkUrl, queueStartMs, queueEndMs })
  }
  return out
}

function pickActivePlayer(queue: TickerPlayerQueueItem[], t: number): TickerPlayerSegment {
  for (const item of queue) {
    if (item.queueStartMs <= t && t < item.queueEndMs) {
      return { id: item.id, text: item.text, linkUrl: item.linkUrl }
    }
  }
  return null
}

function segmentsEqual(a: TickerPlayerSegment, b: TickerPlayerSegment): boolean {
  if (a == null && b == null) return true
  if (!a || !b) return false
  return a.id === b.id && a.text === b.text && a.linkUrl === b.linkUrl
}

/**
 * @param pollMs интервал refetch витрины (очередь + редакционная строка)
 */
export function useTickerFeed(pollMs = 12_000) {
  const [editorial, setEditorial] = useState<TickerEditorial>(null)
  const [player, setPlayer] = useState<TickerPlayerSegment>(null)
  const [loading, setLoading] = useState(true)
  const queueRef = useRef<TickerPlayerQueueItem[]>([])

  const applyTick = useCallback(() => {
    const next = pickActivePlayer(queueRef.current, Date.now())
    setPlayer((prev) => (segmentsEqual(prev, next) ? prev : next))
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/catalog/ticker-feed", { cache: "no-store", credentials: "include" })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setEditorial(null)
        queueRef.current = []
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

      queueRef.current = parsePlayerQueue(data.playerQueue)
      applyTick()
    } catch {
      setEditorial(null)
      queueRef.current = []
      setPlayer(null)
    } finally {
      setLoading(false)
    }
  }, [applyTick])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, pollMs)
    return () => window.clearInterval(id)
  }, [refresh, pollMs])

  useEffect(() => {
    applyTick()
    const id = window.setInterval(applyTick, CLOCK_MS)
    return () => window.clearInterval(id)
  }, [applyTick])

  return { editorial, player, loading, refresh }
}
