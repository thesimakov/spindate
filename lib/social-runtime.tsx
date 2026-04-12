"use client"

import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from "react"
import { isVkMiniApp } from "@/lib/vk-bridge"

/** Среда встроенного приложения: ВК, ОК или обычный веб (логин/пароль). */
export type RuntimeHost = "vk" | "ok" | "web"

type SocialRuntimeValue = {
  host: RuntimeHost
  /** true после первого определения (чтобы не мигать UI). */
  ready: boolean
}

const SocialRuntimeContext = createContext<SocialRuntimeValue>({ host: "web", ready: false })

function detectOkFromWindow(): boolean {
  if (typeof window === "undefined") return false
  try {
    const r = document.referrer || ""
    if (/odnoklassniki\.ru|ok\.ru/i.test(r)) return true
  } catch {
    /* ignore */
  }
  const search = window.location.search
  const hash = window.location.hash || ""
  const full = `${search}${hash}`
  // Типичные параметры встроенного приложения ОК (см. FAPI / apiok.ru)
  if (/[?&#](logged_user_id|session_key|application_key)=/i.test(full)) return true
  const appId = process.env.NEXT_PUBLIC_OK_APP_ID?.trim()
  if (appId && new RegExp(`[?&#]application_key=${appId}`).test(full)) return true
  return false
}

/**
 * Определение среды на клиенте. ВК имеет приоритет, если оба эвристически возможны.
 */
export function detectRuntimeHost(): RuntimeHost {
  if (typeof window === "undefined") return "web"
  if (isVkMiniApp()) return "vk"
  if (detectOkFromWindow()) return "ok"
  return "web"
}

export function SocialRuntimeProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<RuntimeHost>(() =>
    typeof window !== "undefined" ? detectRuntimeHost() : "web",
  )
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setHost(detectRuntimeHost())
    setReady(true)
  }, [])

  const value = useMemo(() => ({ host, ready }), [host, ready])

  return <SocialRuntimeContext.Provider value={value}>{children}</SocialRuntimeContext.Provider>
}

export function useSocialRuntime(): SocialRuntimeValue {
  return useContext(SocialRuntimeContext)
}
