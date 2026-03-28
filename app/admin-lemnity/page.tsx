import { AdminLemnityClient } from "./admin-lemnity-client"

/** Не добавляйте `export const dynamic = "force-dynamic"` — при `output: "export"` (GitHub Pages) сборка упадёт. */

export default function AdminLemnityPage() {
  return (
    <main className="min-h-app overflow-y-auto bg-background">
      <AdminLemnityClient />
    </main>
  )
}
