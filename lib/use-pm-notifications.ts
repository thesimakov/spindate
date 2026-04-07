"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { Player } from "@/lib/game-types"
import { apiFetch } from "@/lib/api-fetch"

const POLL_INTERVAL = 4000
const LS_PREFIX = "spindate_pm_read_"

export interface PmNotification {
  peerId: number
  peerName: string
  peerAvatar: string
  count: number
  lastText: string
  timestamp: number
}

function getLastReadTs(userId: number, peerId: number): number {
  if (typeof window === "undefined") return 0
  const raw = window.localStorage.getItem(`${LS_PREFIX}${userId}_${peerId}`)
  return raw ? Number(raw) || 0 : 0
}

export function markChatRead(userId: number, peerId: number) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(`${LS_PREFIX}${userId}_${peerId}`, String(Date.now()))
}

export function usePmNotifications(
  userId: number | undefined,
  peers: Player[],
): {
  notifications: PmNotification[]
  totalUnread: number
  dismiss: (peerId: number) => void
} {
  const [notifications, setNotifications] = useState<PmNotification[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const dismiss = useCallback(
    (peerId: number) => {
      if (userId) markChatRead(userId, peerId)
      setNotifications((prev) => prev.filter((n) => n.peerId !== peerId))
    },
    [userId],
  )

  const poll = useCallback(async () => {
    if (!userId || peers.length === 0) {
      setNotifications([])
      return
    }

    const peerIds = peers.map((a) => a.id)
    const sinceMap = Object.fromEntries(peerIds.map((pid) => [pid, getLastReadTs(userId, pid)]))
    const minSince = Math.min(...Object.values(sinceMap), Date.now())

    try {
      const params = new URLSearchParams({
        userId: String(userId),
        peers: peerIds.join(","),
        since: String(minSince),
      })
      const res = await apiFetch(`/api/chat/unread?${params}`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      if (!data.ok) return

      const unread = data.unread as Record<
        number,
        { count: number; lastMessage: { text: string; timestamp: number; senderId: number } | null; senderId: number }
      >

      const next: PmNotification[] = []
      for (const [pidStr, info] of Object.entries(unread)) {
        const pid = Number(pidStr)
        const readTs = getLastReadTs(userId, pid)
        if (!info.lastMessage || info.lastMessage.timestamp <= readTs) continue
        const peer = peers.find((a) => a.id === pid)
        if (!peer) continue
        next.push({
          peerId: pid,
          peerName: peer.name,
          peerAvatar: peer.avatar,
          count: info.count,
          lastText: info.lastMessage.text,
          timestamp: info.lastMessage.timestamp,
        })
      }

      setNotifications(next)
    } catch { /* ignore */ }
  }, [userId, peers])

  useEffect(() => {
    poll()
    timer.current = setInterval(poll, POLL_INTERVAL)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [poll])

  return { notifications, totalUnread: notifications.length, dismiss }
}
