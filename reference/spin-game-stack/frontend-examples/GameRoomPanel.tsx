"use client"

import { useEffect, useState } from "react"
import type { Socket } from "socket.io-client"

/** Пример UI: комната + чат (Tailwind). Подключите `socket` из useSpinGameSocket. */
export function GameRoomPanel(props: {
  socket: Socket | null
  roomId: string
  selfUserId: string
}) {
  const { socket, roomId, selfUserId } = props
  const [log, setLog] = useState<string[]>([])
  const [chat, setChat] = useState("")

  useEffect(() => {
    if (!socket) return
    const onState = (p: unknown) => setLog((l) => [`room_state ${JSON.stringify(p)}`, ...l].slice(0, 50))
    const onSpin = (p: unknown) => setLog((l) => [`spin ${JSON.stringify(p)}`, ...l].slice(0, 50))
    const onChat = (p: unknown) => setLog((l) => [`chat ${JSON.stringify(p)}`, ...l].slice(0, 50))
    const onSecret = (p: unknown) => setLog((l) => [`secret ${JSON.stringify(p)}`, ...l].slice(0, 50))
    socket.on("room_state", onState)
    socket.on("spin_result", onSpin)
    socket.on("chat_message", onChat)
    socket.on("secret_kiss_notification", onSecret)
    return () => {
      socket.off("room_state", onState)
      socket.off("spin_result", onSpin)
      socket.off("chat_message", onChat)
      socket.off("secret_kiss_notification", onSecret)
    }
  }, [socket])

  if (!socket) {
    return <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">Нет сокета</div>
  }

  return (
    <div className="flex max-w-lg flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100">
      <div className="text-sm font-medium">Комната {roomId}</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm hover:bg-violet-500"
          onClick={() => socket.emit("join_room", { roomId }, () => undefined)}
        >
          join_room
        </button>
        <button
          type="button"
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
          onClick={() => socket.emit("leave_room", { roomId }, () => undefined)}
        >
          leave_room
        </button>
        <button
          type="button"
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500"
          onClick={() => socket.emit("spin_bottle", { roomId }, () => undefined)}
        >
          spin_bottle
        </button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          socket.emit("chat_message", { roomId, text: chat })
          setChat("")
        }}
      >
        <input
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          placeholder="Сообщение…"
        />
        <button type="submit" className="rounded-lg bg-sky-600 px-3 py-2 text-sm hover:bg-sky-500">
          Чат
        </button>
      </form>
      <p className="text-xs text-zinc-500">self: {selfUserId}</p>
      <ul className="max-h-48 overflow-auto text-xs text-zinc-300">
        {log.map((line, i) => (
          <li key={i} className="border-b border-zinc-900 py-1">
            {line}
          </li>
        ))}
      </ul>
    </div>
  )
}
