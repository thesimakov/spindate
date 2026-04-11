"use client"

import { apiFetch } from "@/lib/api-fetch"

export type GameClientErrorSource = "manual_diagnostics" | "window_error" | "unhandledrejection"

export type ReportGameClientErrorInput = {
  source: GameClientErrorSource
  message: string
  stack?: string | null
  payload?: Record<string, unknown>
}

/** Отправка отчёта на POST /api/game-client-errors (без админ-токена). */
export async function reportGameClientError(input: ReportGameClientErrorInput): Promise<boolean> {
  try {
    const res = await apiFetch("/api/game-client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        source: input.source,
        message: input.message,
        stack: input.stack ?? null,
        payload: input.payload ?? {},
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
