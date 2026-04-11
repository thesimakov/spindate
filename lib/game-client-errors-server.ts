import { getDb } from "@/lib/db"

export type GameClientErrorSource = "manual_diagnostics" | "window_error" | "unhandledrejection"

export type GameClientErrorRow = {
  id: number
  created_at: number
  source: string
  message: string
  stack: string | null
  payload_json: string
}

const MAX_MESSAGE = 4000
const MAX_STACK = 16000
const MAX_PAYLOAD_CHARS = 120_000

export function insertGameClientError(input: {
  source: GameClientErrorSource
  message: string
  stack?: string | null
  payload: Record<string, unknown>
}): { ok: true; id: number } | { ok: false; error: string } {
  const db = getDb()
  const now = Date.now()
  let payloadJson: string
  try {
    payloadJson = JSON.stringify(input.payload ?? {})
  } catch {
    payloadJson = "{}"
  }
  if (payloadJson.length > MAX_PAYLOAD_CHARS) {
    payloadJson = JSON.stringify({
      truncated: true,
      note: "payload превышал лимит",
      preview: payloadJson.slice(0, 8000),
    })
  }
  const msg = (input.message || "").slice(0, MAX_MESSAGE)
  const stack = input.stack != null ? String(input.stack).slice(0, MAX_STACK) : null
  const r = db
    .prepare(
      `INSERT INTO game_client_errors (created_at, source, message, stack, payload_json)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(now, input.source, msg, stack, payloadJson)
  return { ok: true, id: Number(r.lastInsertRowid) }
}

export function listGameClientErrors(opts: { limit: number; offset: number }): GameClientErrorRow[] {
  const db = getDb()
  const lim = Math.min(Math.max(1, Math.floor(opts.limit)), 200)
  const off = Math.max(0, Math.floor(opts.offset))
  return db
    .prepare(
      `SELECT id, created_at, source, message, stack, payload_json
       FROM game_client_errors
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(lim, off) as GameClientErrorRow[]
}
