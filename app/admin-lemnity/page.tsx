import { AdminLemnityClient } from "./admin-lemnity-client"

/**
 * Явно статическая страница: `output: "export"` (GitHub Pages) не поддерживает `force-dynamic`.
 * Не возвращайте сюда `force-dynamic` — сборка Pages упадёт.
 */
export const dynamic = "force-static"

export default function AdminLemnityPage() {
  return (
    <main className="min-h-dvh overflow-y-auto bg-background">
      <AdminLemnityClient />
    </main>
  )
}
