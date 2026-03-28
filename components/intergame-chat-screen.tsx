"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGame, generateMessageId } from "@/lib/game-context"

export function IntergameChatScreen() {
  const { state, dispatch } = useGame()
  const { currentUser, intergameChatMessages = [] } = state
  const [text, setText] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const messages = useMemo(() => intergameChatMessages.slice(-150), [intergameChatMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  if (!currentUser) return null

  const handleBack = () => {
    dispatch({ type: "SET_SCREEN", screen: "game" })
  }

  const handleSend = () => {
    const t = text.trim()
    if (!t) return
    dispatch({
      type: "SEND_INTERGAME_CHAT",
      message: {
        id: generateMessageId(),
        senderId: currentUser.id,
        senderName: currentUser.name,
        text: t,
        timestamp: Date.now(),
      },
    })
    setText("")
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  return (
    <div className="flex min-h-app flex-col bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3 shrink-0">
        <button
          onClick={handleBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
          <span className="sr-only">{"Назад"}</span>
        </button>
        <div>
          <p className="text-sm font-semibold text-foreground">{"Межигровой чат"}</p>
          <p className="text-xs text-muted-foreground">{"Общение между столами"}</p>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              {"Пока пусто. Напишите первое сообщение в межигровой чат."}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUser.id
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-secondary-foreground rounded-bl-sm"
                  }`}
                >
                  <p className="mb-0.5 text-[11px] opacity-80">{msg.senderName}</p>
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

      <div className="border-t border-border bg-card px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Написать в межигровой чат..."
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

