"use client"

import { useEffect, useRef } from "react"
import { MessageCircle, X } from "lucide-react"
import type { PmNotification } from "@/lib/use-pm-notifications"

type Props = {
  notifications: PmNotification[]
  onOpen: (peerId: number) => void
  onDismiss: (peerId: number) => void
}

export function PmNotificationToasts({ notifications, onOpen, onDismiss }: Props) {
  const shownIds = useRef(new Set<number>())

  useEffect(() => {
    for (const n of notifications) {
      if (!shownIds.current.has(n.peerId)) {
        shownIds.current.add(n.peerId)
      }
    }
    const current = new Set(notifications.map((n) => n.peerId))
    for (const id of shownIds.current) {
      if (!current.has(id)) shownIds.current.delete(id)
    }
  }, [notifications])

  if (notifications.length === 0) return null

  return (
    <div className="fixed right-4 top-4 z-[70] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {notifications.slice(0, 3).map((n) => (
        <div
          key={n.peerId}
          className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-cyan-500/25 bg-[rgba(2,6,23,0.95)] px-3 py-2.5 shadow-lg shadow-black/40 backdrop-blur-sm animate-in slide-in-from-right-5 duration-300"
        >
          <button
            type="button"
            onClick={() => onOpen(n.peerId)}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <div className="relative shrink-0">
              {n.peerAvatar ? (
                <img src={n.peerAvatar} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-cyan-500/40" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-200 ring-1 ring-cyan-500/40">
                  {(n.peerName || "?").slice(0, 1)}
                </span>
              )}
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {n.count}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-100">{n.peerName}</p>
              <p className="truncate text-[11px] text-slate-400">{n.lastText}</p>
            </div>
            <MessageCircle className="h-4 w-4 shrink-0 text-cyan-400" />
          </button>
          <button
            type="button"
            onClick={() => onDismiss(n.peerId)}
            className="shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:text-slate-200"
            aria-label="Скрыть"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
