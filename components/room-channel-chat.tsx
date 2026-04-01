"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { MessageCircle, Send, X } from "lucide-react"
import { apiFetch } from "@/lib/api-fetch"
import type { GeneralChatMessage, Player } from "@/lib/game-types"
import { roomNameForDisplay } from "@/lib/rooms/room-names"
import { cn } from "@/lib/utils"

type Props = {
  tableId: number
  currentUser: Player
}

const POLL_MS = 4000

export function RoomChannelChat({ tableId, currentUser }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<GeneralChatMessage[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(0)
  const lastSeenCountRef = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/rooms/chat?roomId=${encodeURIComponent(String(tableId))}`,
        { credentials: "include" },
      )
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && Array.isArray(data.messages)) {
        setMessages(data.messages)
        if (!open) {
          const newCount = data.messages.length - lastSeenCountRef.current
          if (newCount > 0) setUnread(newCount)
        }
      }
    } catch {
      // ignore
    }
  }, [tableId, open])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    if (open) {
      lastSeenCountRef.current = messages.length
      setUnread(0)
      setTimeout(() => inputRef.current?.focus(), 120)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      lastSeenCountRef.current = messages.length
    }
  }, [messages, open])

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    try {
      const res = await apiFetch("/api/rooms/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roomId: tableId, user: currentUser, text: t }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && data.message) {
        setMessages((prev) => [...prev, data.message as GeneralChatMessage])
        setText("")
      }
    } catch {
      // ignore
    }
    setSending(false)
  }

  const roomName = roomNameForDisplay("", tableId)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-4 left-4 z-[50] flex h-12 w-12 items-center justify-center rounded-full",
          "border border-violet-400/50 bg-slate-900/90 text-violet-200",
          "shadow-[0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-all",
          "hover:bg-slate-800 hover:scale-105 active:scale-95",
          open && "pointer-events-none opacity-0",
        )}
        aria-label="Чат комнаты"
      >
        <MessageCircle className="h-5 w-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-md">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-[52] flex w-[min(100vw,360px)] flex-col",
          "border-r border-white/[0.08] bg-[rgba(8,12,22,0.96)] backdrop-blur-xl",
          "shadow-[4px_0_40px_rgba(0,0,0,0.6)]",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-white">{roomName}</h2>
            <p className="text-[11px] text-slate-400">
              Сообщения хранятся 24 ч
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Закрыть чат"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <MessageCircle className="h-8 w-8 text-slate-600" aria-hidden />
              <p className="text-sm text-slate-500">Пока нет сообщений</p>
              <p className="text-[11px] text-slate-600">Напишите первым!</p>
            </div>
          ) : (
            messages.map((m) => {
              const isOwn = m.senderId === currentUser.id
              return (
                <div
                  key={m.id}
                  className={cn(
                    "mb-2 rounded-xl px-3 py-2 text-[13px] leading-snug",
                    isOwn
                      ? "ml-auto max-w-[85%] bg-violet-600/25 text-violet-100"
                      : "mr-auto max-w-[85%] bg-slate-800/60 text-slate-200",
                  )}
                >
                  {!isOwn && (
                    <p className="mb-0.5 text-[11px] font-semibold text-violet-300">
                      {m.senderName}
                    </p>
                  )}
                  <p className="break-words">{m.text}</p>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-white/[0.06] bg-slate-950/50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="Написать…"
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
              maxLength={2000}
            />
            <button
              type="button"
              disabled={sending || !text.trim()}
              onClick={() => void send()}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all",
                text.trim()
                  ? "bg-violet-600 text-white shadow-md hover:bg-violet-500 active:scale-95"
                  : "bg-slate-800 text-slate-500",
              )}
              aria-label="Отправить"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[51] bg-black/40 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
    </>
  )
}
