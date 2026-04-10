"use client"

import { useCallback, useEffect, useState } from "react"
import { Trophy, X } from "lucide-react"
import { apiFetch } from "@/lib/api-fetch"
import type { RatingPeriod } from "@/lib/rating-periods"

type TabId = "love" | "gifts" | "kind"

const TABS: { id: TabId; label: string }[] = [
  { id: "love", label: "Любвеобильные" },
  { id: "gifts", label: "Щедрые" },
  { id: "kind", label: "Добрые" },
]

const PERIODS: { id: RatingPeriod; label: string }[] = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
]

type LeaderboardApiRow = {
  rank: number
  actorKey: string
  name: string
  avatar: string
  score: number
}

/** Табы, период и списки глобального рейтинга (все столы, SQLite) */
export function RatingLeaderboardBody() {
  const [period, setPeriod] = useState<RatingPeriod>("week")
  const [activeTab, setActiveTab] = useState<TabId>("love")
  const [rows, setRows] = useState<LeaderboardApiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch(
        `/api/rating/leaderboard?period=${encodeURIComponent(period)}&tab=${encodeURIComponent(activeTab)}`,
      )
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; rows?: LeaderboardApiRow[]; error?: string }
        | null
      if (!res.ok || !json?.ok || !Array.isArray(json.rows)) {
        setRows([])
        setError(json?.error ?? "Не удалось загрузить рейтинг")
        return
      }
      setRows(json.rows)
    } catch {
      setRows([])
      setError("Ошибка сети")
    } finally {
      setLoading(false)
    }
  }, [period, activeTab])

  useEffect(() => {
    void load()
  }, [load])

  const periodHint =
    period === "day"
      ? "Календарный день (МСК)"
      : period === "week"
        ? "Календарная неделя пн–вс (МСК)"
        : "Календарный месяц (МСК)"

  const avatarEl = (avatar: string, name: string) => (
    <span className="flex items-center gap-2 min-w-0">
      <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-600 bg-slate-700">
        {avatar ? (
          <img src={avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-slate-400">?</span>
        )}
      </span>
      <span className="text-amber-50 truncate">{name}</span>
    </span>
  )

  const subtitle =
    activeTab === "love"
      ? "Количество поцелуев (все столы)"
      : activeTab === "gifts"
        ? "Кто больше всего подарил подарков"
        : "Кто больше всего потратил на квас, парить, бриллианты, цветы"

  const emptyMessage =
    activeTab === "love"
      ? "Пока ни одного поцелуя за выбранный период"
      : activeTab === "gifts"
        ? "Пока нет подарков за выбранный период"
        : "Пока нет трат за выбранный период"

  return (
    <>
      <div className="mb-3 flex shrink-0 gap-1 rounded-lg border border-slate-600/80 bg-slate-900/40 p-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className="flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors sm:text-sm"
            style={{
              background: period === p.id ? "rgba(250, 204, 21, 0.15)" : "transparent",
              color: period === p.id ? "#facc15" : "#94a3b8",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[11px] text-slate-500">{periodHint}</p>
      <div className="flex shrink-0 border-b border-slate-600 px-0 -mx-0 mb-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 px-2 py-2.5 text-center text-sm font-medium transition-colors"
            style={{
              color: activeTab === tab.id ? "#facc15" : "#94a3b8",
              borderBottom: activeTab === tab.id ? "2px solid #facc15" : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-slate-400">{subtitle}</p>
      {loading ? (
        <p className="py-6 text-sm text-slate-400">Загрузка…</p>
      ) : error ? (
        <p className="py-4 text-sm text-rose-300/90">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-amber-300/70 py-4">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((item) => (
            <li key={item.actorKey} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-amber-400/90 font-medium w-6 shrink-0">{item.rank}.</span>
                {avatarEl(item.avatar, item.name)}
              </span>
              <span className="text-amber-200 font-semibold shrink-0 tabular-nums">
                {activeTab === "kind" ? `${item.score} ❤` : item.score}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export function RatingModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md max-h-[85vh] flex-col rounded-2xl border shadow-xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
          borderColor: "#334155",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: "#334155" }}>
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, #facc15 0%, #f97316 100%)",
                boxShadow: "0 0 10px rgba(250,204,21,0.35)",
              }}
            >
              <Trophy className="h-5 w-5 text-slate-900" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Рейтинг</h2>
              <p className="text-[11px] text-slate-400">Все столы · МСК</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <RatingLeaderboardBody />
        </div>
      </div>
    </div>
  )
}
