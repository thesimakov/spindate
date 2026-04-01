"use client"

import { appPath } from "@/lib/app-path"

const STORAGE_KEY = "spindate_session"

/** Дублирует httpOnly-cookie: нужен во встроенном VK, если браузер не хранит cookie. */
export function setClientSessionToken(token: string | null) {
  if (typeof window === "undefined") return
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* приватный режим / запрет storage */
  }
}

function resolveFetchInput(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === "string") return appPath(input)
  return input
}

/** fetch с credentials и заголовком X-Session-Token при наличии токена в sessionStorage. */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? undefined)
  if (typeof window !== "undefined") {
    try {
      const t = sessionStorage.getItem(STORAGE_KEY)
      if (t) headers.set("X-Session-Token", t)
    } catch {
      /* ignore */
    }
  }
  return fetch(resolveFetchInput(input), {
    ...init,
    credentials: init?.credentials ?? "include",
    headers,
  })
}
