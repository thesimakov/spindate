"use client"

import { GameProvider } from "@/lib/game-context"
import { GameApp } from "@/components/game-app"

export default function Page() {
  return (
    <GameProvider>
      <main className="min-h-dvh bg-background">
        <GameApp />
      </main>
    </GameProvider>
  )
}
