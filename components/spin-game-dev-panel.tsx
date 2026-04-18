"use client"

import { useCallback, useState } from "react"
import { getSpinGameBaseUrl } from "@/lib/spin-game-config"
import { loginSpinGameWithVk } from "@/lib/spin-game-auth-client"
import { useSpinGameSocket } from "@/hooks/use-spin-game-socket"

/**
 * Блок в панели разработчика: логин в эталонный spin-game API и статус Socket.io.
 * Рендерится только при заданном `NEXT_PUBLIC_SPIN_GAME_URL`.
 */
export function SpinGameDevPanel() {
  const base = getSpinGameBaseUrl()
  const [vkUserId, setVkUserId] = useState("")
  const [username, setUsername] = useState("Dev user")
  const [busy, setBusy] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const { connected, error: socketError } = useSpinGameSocket()

  const connect = useCallback(async () => {
    const id = vkUserId.trim()
    if (!id) {
      setLastError("Укажите VK user id")
      return
    }
    setBusy(true)
    setLastError(null)
    try {
      const ok = await loginSpinGameWithVk({
        vkUserId: id,
        username: username.trim() || "Player",
      })
      if (!ok) setLastError("Не удалось выполнить POST /api/auth/vk")
    } finally {
      setBusy(false)
    }
  }, [vkUserId, username])

  if (!base) return null

  return (
    <div className="mb-4 rounded-xl border border-cyan-500/25 bg-slate-800/50 px-4 py-3 text-sm text-slate-200">
      <h2 className="mb-1 font-semibold text-cyan-200">Spin-game (Socket.io)</h2>
      <p className="mb-3 break-all text-xs text-slate-400">{base}</p>
      <div className="mb-2 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <span className="text-xs text-slate-400">vk_user_id</span>
          <input
            value={vkUserId}
            onChange={(e) => setVkUserId(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900/80 px-2 py-1.5 text-slate-100"
            placeholder="напр. 123456789"
            inputMode="numeric"
          />
        </label>
        <label className="flex min-w-[8rem] flex-1 flex-col gap-1">
          <span className="text-xs text-slate-400">Имя</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900/80 px-2 py-1.5 text-slate-100"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void connect()}
          className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-600 disabled:opacity-50"
        >
          {busy ? "…" : "Войти в API"}
        </button>
      </div>
      <p className="text-xs">
        <span className="text-slate-400">Socket:</span>{" "}
        <span className={connected ? "text-emerald-400" : "text-slate-500"}>
          {connected ? "подключено" : "нет соединения"}
        </span>
        {socketError ? <span className="text-rose-300"> — {socketError}</span> : null}
      </p>
      {lastError ? <p className="mt-1 text-xs text-rose-300">{lastError}</p> : null}
    </div>
  )
}
