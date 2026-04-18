"use client"

import { useEffect, useMemo, useState } from "react"
import { io, type Socket } from "socket.io-client"

/**
 * Пример клиента Socket.io для Next.js / React.
 * Установка: `npm i socket.io-client` в корне фронтенда.
 */
export function useSpinGameSocket(apiBaseUrl: string, sessionToken: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!sessionToken) {
      setSocket(null)
      setConnected(false)
      return
    }
    const s = io(apiBaseUrl, {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token: sessionToken },
    })
    s.on("connect", () => setConnected(true))
    s.on("disconnect", () => setConnected(false))
    setSocket(s)
    return () => {
      s.removeAllListeners()
      s.close()
    }
  }, [apiBaseUrl, sessionToken])

  return useMemo(() => ({ socket, connected }), [socket, connected])
}
