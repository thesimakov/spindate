 "use client"

import dynamic from "next/dynamic"

const DevScreen = dynamic(() => import("@/components/dev-screen").then((m) => m.DevScreen), {
  ssr: false,
})

export default function AdminLemnityPage() {
  return (
    <main className="min-h-dvh overflow-y-auto bg-background">
      <DevScreen />
    </main>
  )
}
