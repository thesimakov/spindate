import { AdminLemnityClient } from "./admin-lemnity-client"

/** Чтобы HTML не кэшировался годами со старыми путями к /_next/static (иначе после деплоя — 404 на чанках). */
export const dynamic = "force-dynamic"

export default function AdminLemnityPage() {
  return (
    <main className="min-h-dvh overflow-y-auto bg-background">
      <AdminLemnityClient />
    </main>
  )
}
