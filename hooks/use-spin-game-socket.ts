"use client"

import { useEffect, useMemo, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { getSpinGameBaseUrl } from "@/lib/spin-game-config"
import { getSpinGameSessionToken } from "@/lib/spin-game-session"

export type SpinGameSocketState = {
  socket: Socket | null
  connected: boolean
  error: string | null
}

/**
 * Подключение к эталонному сервису spin-game (Socket.io).
 * Токен: `setSpinGameSessionToken` после успешного `POST {baseUrl}/api/auth/vk`.
 *
 * Если `NEXT_PUBLIC_SPIN_GAME_URL` не задан — сокет не создаётся.
 */
export function useSpinGameSocket(sessionTokenOverride?: string | null): SpinGameSocketState {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const token =
    sessionTokenOverride !== undefined ? sessionTokenOverride : getSpinGameSessionToken()

  const baseUrl = useMemo(() => getSpinGameBaseUrl(), [])

  useEffect(() => {
    if (!baseUrl || !token) {
      setSocket(null)
      setConnected(false)
      setError(null)
      return
    }

    const s = io(baseUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
    })

    const onConnect = () => {
      setConnected(true)
      setError(null)
    }
    const onDisconnect = () => setConnected(false)
    const onConnectError = (e: Error) => setError(e.message)

    s.on("connect", onConnect)
    s.on("disconnect", onDisconnect)
    s.io.on("error", onConnectError)

    setSocket(s)

    return () => {
      s.off("connect", onConnect)
      s.off("disconnect", onDisconnect)
      s.io.off("error", onConnectError)
      s.removeAllListeners()
      s.close()
      setSocket(null)
      setConnected(false)
    }
  }, [baseUrl, token])

  return { socket, connected, error }
}
