"use client"

import { useState } from "react"

type AdminContentPagePlaceholderProps = {
  title: string
  description: string
}

export function AdminContentPagePlaceholder({ title, description }: AdminContentPagePlaceholderProps) {
  const [showAdd, setShowAdd] = useState(false)
  return (
    <section className="rounded-xl border border-slate-600 bg-slate-800/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-amber-200">{title}</h2>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-500/25"
        >
          Добавить
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
      {showAdd && (
        <div className="mt-3 rounded-lg border border-violet-500/35 bg-violet-950/20 px-3 py-3 text-xs text-violet-100">
          Блок добавления открыт. В этом разделе ещё не подключен серверный каталог.
        </div>
      )}
      <div className="mt-4 rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-3 text-xs text-slate-500">
        Раздел подготовлен как отдельная страница. Могу сразу подключить серверный каталог и CRUD в следующем шаге.
      </div>
    </section>
  )
}
