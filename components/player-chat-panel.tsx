"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Gift, X, User, Heart, Flower2, Frown } from "lucide-react"
import { useGame, getBotResponse, generateMessageId } from "@/lib/game-context"
import type { ChatMessage, Player } from "@/lib/game-types"
import { PlayerAvatar } from "@/components/player-avatar"
import { markChatRead } from "@/lib/use-pm-notifications"

const GIFTS = [
  { name: "Цветок", icon: Flower2, price: 5, emoji: "flower" },
  { name: "Сердце", icon: Heart, price: 10, emoji: "heart" },
  { name: "Помидор", icon: Frown, price: 0, emoji: "tomato" },
]

const POLL_INTERVAL = 2000

type Props = {
  player: Player
  onClose: () => void
  onOpenProfile?: () => void
}

export function PlayerChatPanel({ player, onClose, onOpenProfile }: Props) {
  const { state, dispatch } = useGame()
  const { currentUser, voiceBalance, avatarFrames } = state
  const [text, setText] = useState("")
  const [showGifts, setShowGifts] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastPollTs = useRef(0)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const scrollBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const fetchMessages = useCallback(
    async (since: number) => {
      if (!currentUser) return
      try {
        const params = new URLSearchParams({
          a: String(currentUser.id),
          b: String(player.id),
          since: String(since),
        })
        const res = await fetch(`/api/chat/private?${params}`, { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (!data.ok || !Array.isArray(data.messages)) return
        const newMsgs = data.messages as ChatMessage[]
        if (newMsgs.length === 0) return
        setMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id))
          const unique = newMsgs.filter((m) => !existing.has(m.id))
          if (unique.length === 0) return prev
          return [...prev, ...unique].sort((a, b) => a.timestamp - b.timestamp)
        })
        const maxTs = Math.max(...newMsgs.map((m) => m.timestamp))
        if (maxTs > lastPollTs.current) lastPollTs.current = maxTs
      } catch { /* ignore */ }
    },
    [currentUser, player.id],
  )

  useEffect(() => {
    if (currentUser) markChatRead(currentUser.id, player.id)
    fetchMessages(0)
    pollTimer.current = setInterval(() => {
      fetchMessages(lastPollTs.current)
    }, POLL_INTERVAL)
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
      if (currentUser) markChatRead(currentUser.id, player.id)
    }
  }, [fetchMessages, currentUser, player.id])

  useEffect(() => {
    scrollBottom()
  }, [messages.length, scrollBottom])

  if (!currentUser) return null

  const sendToServer = async (msg: ChatMessage) => {
    try {
      await fetch("/api/chat/private", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: msg.id,
          senderId: msg.senderId,
          toId: player.id,
          text: msg.text,
          timestamp: msg.timestamp,
          gift: msg.gift,
        }),
      })
    } catch { /* ignore */ }
  }

  const handleSend = () => {
    if (!text.trim()) return
    const msg: ChatMessage = {
      id: generateMessageId(),
      senderId: currentUser.id,
      text: text.trim(),
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, msg])
    sendToServer(msg)
    dispatch({ type: "SEND_MESSAGE", toId: player.id, message: msg })
    setText("")

    if (player.isBot) {
      setTimeout(() => {
        const botMsg: ChatMessage = {
          id: generateMessageId(),
          senderId: player.id,
          text: getBotResponse(),
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, botMsg])
        sendToServer(botMsg)
        dispatch({ type: "SEND_MESSAGE", toId: player.id, message: botMsg })
      }, 800 + Math.random() * 1500)
    }
  }

  const handleSendGift = (giftName: string, giftPrice: number, giftEmoji: string) => {
    if (giftPrice > 0 && voiceBalance < giftPrice) return
    if (giftPrice > 0) dispatch({ type: "PAY_VOICES", amount: giftPrice })
    const msg: ChatMessage = {
      id: generateMessageId(),
      senderId: currentUser.id,
      text: `подарил(а) ${giftName}`,
      timestamp: Date.now(),
      gift: giftEmoji,
    }
    setMessages((prev) => [...prev, msg])
    sendToServer(msg)
    dispatch({ type: "SEND_MESSAGE", toId: player.id, message: msg })
    setShowGifts(false)

    if (player.isBot) {
      setTimeout(() => {
        const botMsg: ChatMessage = {
          id: generateMessageId(),
          senderId: player.id,
          text: giftEmoji === "tomato" ? "Эй! За что?!" : "Спасибо за подарок!",
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, botMsg])
        sendToServer(botMsg)
        dispatch({ type: "SEND_MESSAGE", toId: player.id, message: botMsg })
      }, 1000)
    }
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
  }

  const frameId = (avatarFrames ?? {})[player.id] ?? "none"

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[55] bg-black/55 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div
        role="dialog"
        aria-modal
        className="fixed inset-y-0 right-0 z-[60] flex h-app max-h-app w-full max-w-md flex-col border-l border-cyan-500/20 bg-[rgba(2,6,23,0.98)] shadow-[-24px_0_60px_rgba(0,0,0,0.55)]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-cyan-500/15 px-4 py-3">
          <div className="shrink-0">
            <PlayerAvatar player={player} frameId={frameId} compact size={40} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-slate-100">{player.name}</h2>
            <p className="text-xs text-slate-400">
              {player.age} лет, {player.gender === "female" ? "Ж" : "М"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
                aria-label="Открыть профиль"
              >
                <User className="h-5 w-5" strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-500 text-center">
                Начните общение! Напишите первое сообщение.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {messages.map((msg) => {
              const isMine = msg.senderId === currentUser.id
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      msg.gift
                        ? "bg-slate-800/80 text-center"
                        : isMine
                          ? "bg-cyan-600/90 text-white rounded-br-sm"
                          : "bg-slate-800/80 text-slate-200 rounded-bl-sm"
                    }`}
                  >
                    {msg.gift && (
                      <div className="mb-1 text-2xl">
                        {msg.gift === "flower" && "🌹"}
                        {msg.gift === "heart" && "💕"}
                        {msg.gift === "tomato" && "🍅"}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <p className={`mt-1 text-[10px] ${isMine ? "text-white/60" : "text-slate-500"}`}>
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Gifts */}
        {showGifts && (
          <div className="border-t border-slate-700/50 bg-slate-900/80 px-4 py-3">
            <div className="flex items-center justify-center gap-4">
              {GIFTS.map((g) => (
                <button
                  key={g.emoji}
                  onClick={() => handleSendGift(g.name, g.price, g.emoji)}
                  disabled={g.price > voiceBalance}
                  className="flex flex-col items-center gap-1 rounded-xl p-3 transition-colors hover:bg-slate-800 disabled:opacity-40"
                >
                  <g.icon className={`h-7 w-7 ${g.emoji === "tomato" ? "text-red-400" : "text-cyan-400"}`} />
                  <span className="text-[10px] font-medium text-slate-200">{g.name}</span>
                  <span
                    className={
                      g.price > 0
                        ? "heart-price heart-price--compact text-rose-200"
                        : "text-[11px] font-semibold text-slate-400"
                    }
                  >
                    {g.price > 0 ? `${g.price} ❤` : "Бесплатно"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-slate-700/50 bg-slate-900/60 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGifts(!showGifts)}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                showGifts
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Gift className="h-5 w-5" />
            </button>
            <input
              type="text"
              placeholder="Сообщение..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 rounded-full border border-slate-600/80 bg-slate-950/80 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-500/20 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-white transition-all hover:bg-cyan-500 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
