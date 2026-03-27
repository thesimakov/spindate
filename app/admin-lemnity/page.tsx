import { AdminLemnityClient } from "./admin-lemnity-client"

/** Без `force-dynamic`: иначе `output: "export"` (GitHub Pages) не собирается. Пре-рендер с клиентским блоком ок; чанки обновляются при каждой сборке. Кэш HTML — через headers в next.config на своём сервере. */

export default function AdminLemnityPage() {
  return (
    <main className="min-h-dvh overflow-y-auto bg-background">
      <AdminLemnityClient />
    </main>
  )
}
