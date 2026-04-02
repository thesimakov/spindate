"use client"

type AdminContentPagePlaceholderProps = {
  title: string
  description: string
}

export function AdminContentPagePlaceholder({ title, description }: AdminContentPagePlaceholderProps) {
  return (
    <section className="rounded-xl border border-slate-600 bg-slate-800/40 p-4">
      <h2 className="text-lg font-semibold text-amber-200">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
      <div className="mt-4 rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-3 text-xs text-slate-500">
        Раздел подготовлен как отдельная страница. Могу сразу подключить серверный каталог и CRUD в следующем шаге.
      </div>
    </section>
  )
}
