"use client"

import { useState, useRef, useEffect } from "react"
import { ArrowLeft, Send, Gift, Flower2, Heart, Frown, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGame, getBotResponse, generateMessageId } from "@/lib/game-context"
import { vkBridge } from "@/lib/vk-bridge"
import type { ChatMessage, GameLogEntry, Player } from "@/lib/game-types"

const GIFTS = [
  { name: "Цветок", icon: Flower2, price: 5, emoji: "flower" },
  { name: "Сердце", icon: Heart, price: 10, emoji: "heart" },
  { name: "Помидор", icon: Frown, price: 0, emoji: "tomato" },
]

export function ChatScreen() {
  const { state, dispatch } = useGame()
  const { chatWith, chatMessages, currentUser, voiceBalance, gameLog } = state
  const [text, setText] = useState("")
  const [showGifts, setShowGifts] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const messages = chatWith ? chatMessages[chatWith.id] || [] : []

  const friends: Player[] = []
  if (currentUser) {
    const seenIds = new Set<number>()
    gameLog.forEach((e: GameLogEntry) => {
      if (e.type === "invite" && e.toPlayer?.id === currentUser.id && e.fromPlayer && !e.fromPlayer.isBot) {
        if (!seenIds.has(e.fromPlayer.id)) {
          seenIds.add(e.fromPlayer.id)
          friends.push(e.fromPlayer)
        }
      }
    })
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (!chatWith || !currentUser) return null

  const handleSend = () => {
    if (!text.trim()) return

    const msg: ChatMessage = {
      id: generateMessageId(),
      senderId: currentUser.id,
      text: text.trim(),
      timestamp: Date.now(),
    }
    dispatch({ type: "SEND_MESSAGE", toId: chatWith.id, message: msg })
    setText("")

    // Bot auto-reply
    if (chatWith.isBot) {
      setTimeout(() => {
        const botMsg: ChatMessage = {
          id: generateMessageId(),
          senderId: chatWith.id,
          text: getBotResponse(),
          timestamp: Date.now(),
        }
        dispatch({ type: "SEND_MESSAGE", toId: chatWith.id, message: botMsg })
      }, 800 + Math.random() * 1500)
    }
  }

  const handleSendGift = async (giftName: string, giftPrice: number, giftEmoji: string) => {
    if (giftPrice > 0 && voiceBalance < giftPrice) return

    if (giftPrice > 0) {
      const success = await vkBridge.showPaymentWall(giftPrice)
      if (!success) return
      dispatch({ type: "PAY_VOICES", amount: giftPrice })
    }

    const msg: ChatMessage = {
      id: generateMessageId(),
      senderId: currentUser.id,
      text: `подарил(а) ${giftName}`,
      timestamp: Date.now(),
      gift: giftEmoji,
    }
    dispatch({ type: "SEND_MESSAGE", toId: chatWith.id, message: msg })
    setShowGifts(false)

    // Bot reaction
    if (chatWith.isBot) {
      setTimeout(() => {
        const botMsg: ChatMessage = {
          id: generateMessageId(),
          senderId: chatWith.id,
          text: giftEmoji === "tomato" ? "Эй! За что?!" : "Спасибо за подарок!",
          timestamp: Date.now(),
        }
        dispatch({ type: "SEND_MESSAGE", toId: chatWith.id, message: botMsg })
      }, 1000)
    }
  }

  const handleBack = () => {
    dispatch({ type: "SET_SCREEN", screen: "game" })
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <header className="flex items-center gap-2 sm:gap-3 border-b border-border px-3 py-3 shrink-0">
        <button onClick={handleBack} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary transition-colors">
          <ArrowLeft className="h-5 w-5 text-foreground" />
          <span className="sr-only">{"Назад"}</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-primary/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chatWith.avatar} alt={chatWith.name} className="h-full w-full object-cover bg-muted" crossOrigin="anonymous" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{chatWith.name.split(" ")[0]}</p>
            <p className="text-xs text-muted-foreground">{chatWith.age}{" лет, "}{chatWith.gender === "female" ? "Ж" : "М"}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-secondary px-3 py-1">
          <Coins className="h-3 w-3 text-accent" />
          <span className="text-xs font-semibold text-secondary-foreground">{voiceBalance}</span>
        </div>
      </header>

      {/* Messages (only chat between participants) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">{"Начните общение! Напишите первое сообщение."}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUser.id
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 ${
                    msg.gift
                      ? "bg-primary/10 text-center"
                      : isMine
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-secondary-foreground rounded-bl-sm"
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
                  <p className={`mt-1 text-[10px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Gifts panel */}
      {showGifts && (
        <div className="border-t border-border bg-card px-4 py-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-center gap-4">
            {GIFTS.map((g) => (
              <button
                key={g.emoji}
                onClick={() => handleSendGift(g.name, g.price, g.emoji)}
                disabled={g.price > voiceBalance}
                className="flex flex-col items-center gap-1 rounded-xl p-3 hover:bg-secondary transition-colors disabled:opacity-40"
              >
                <g.icon className={`h-7 w-7 ${g.emoji === "tomato" ? "text-destructive" : "text-primary"}`} />
                <span className="text-[10px] font-medium text-foreground">{g.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {g.price > 0 ? `${g.price}` : "Бесплатно"}
                  {g.price > 0 && <Coins className="ml-0.5 inline h-2.5 w-2.5" />}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGifts(!showGifts)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${showGifts ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            <Gift className="h-5 w-5" />
            <span className="sr-only">{"Подарки"}</span>
          </button>
          <input
            type="text"
            placeholder="Сообщение..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
          />
          <Button
            onClick={handleSend}
            disabled={!text.trim()}
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">{"Отправить"}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
