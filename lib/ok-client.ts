"use client"

/** Параметры из query и из hash (#...?a=b) — как часто во встроенных iframe ОК. */
export function collectOkLaunchParamsFromLocation(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const out: Record<string, string> = {}
  const search = new URLSearchParams(window.location.search)
  search.forEach((v, k) => {
    out[k] = v
  })
  const hash = window.location.hash || ""
  const qIdx = hash.indexOf("?")
  if (qIdx >= 0) {
    const hp = new URLSearchParams(hash.slice(qIdx + 1))
    hp.forEach((v, k) => {
      if (!(k in out)) out[k] = v
    })
  }
  return out
}

const FAPI_SCRIPT = "https://api.ok.ru/js/fapi5.js"

/** Подгрузка FAPI5; без app id в кабинете ОК всё равно можно авторизоваться по параметрам в URL. */
export function initOkSdkResilient(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve()
      return
    }
    const w = window as unknown as { FAPI?: unknown }
    if (w.FAPI) {
      resolve()
      return
    }
    const appId = process.env.NEXT_PUBLIC_OK_APP_ID?.trim()
    if (!appId) {
      resolve()
      return
    }
    const sel = `script[data-spindate-ok-fapi="1"]`
    const existing = document.querySelector(sel)
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => resolve(), { once: true })
      return
    }
    const s = document.createElement("script")
    s.src = FAPI_SCRIPT
    s.async = true
    s.dataset.spindateOkFapi = "1"
    s.onload = () => resolve()
    s.onerror = () => resolve()
    document.head.appendChild(s)
  })
}

export async function mergeOkLaunchParamsFromFapi(base: Record<string, string>): Promise<Record<string, string>> {
  const w = window as unknown as {
    FAPI?: { Util?: { getRequestParameters?: () => Record<string, string | number | boolean | undefined> } }
  }
  try {
    const extra = w.FAPI?.Util?.getRequestParameters?.()
    if (extra && typeof extra === "object") {
      const merged = { ...base }
      for (const [k, v] of Object.entries(extra)) {
        if (merged[k] === undefined || merged[k] === "") merged[k] = String(v ?? "")
      }
      return merged
    }
  } catch {
    /* FAPI может быть недоступен до init */
  }
  return base
}
