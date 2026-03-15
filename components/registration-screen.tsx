"use client"

import { useState, useMemo } from "react"
import { Heart, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGame, generateBots } from "@/lib/game-context"
import { addToDevRegistry } from "@/lib/dev-registry"
import { vkBridge } from "@/lib/vk-bridge"
import { useIsMobile } from "@/lib/use-media-query"
import type { Gender, Player, Purpose } from "@/lib/game-types"

export function RegistrationScreen() {
  const { dispatch } = useGame()
  const isMobile = useIsMobile()
  const [gender, setGender] = useState<Gender>("male")
  const [age, setAge] = useState("25")
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [isRegistered, setIsRegistered] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginModalMode, setLoginModalMode] = useState<"login" | "register">("login")
  const defaultPurpose: Purpose = "communication"

  const buildTableAndEnter = (user: {
    id: number
    name: string
    avatar: string
    gender: Gender
    age: number
    purpose: Purpose
  }) => {
    dispatch({ type: "SET_USER", user })

    // На ПК — 10 участников, на мобильной — 6
    const maxTableSize = isMobile ? 6 : 10
    const targetMales = isMobile ? 3 : 5
    const targetFemales = isMobile ? 3 : 5

    const liveCount = 1
    const neededBots = Math.max(0, maxTableSize - liveCount)

    const allBots = generateBots(170, user.gender)

    const userIsMale = user.gender === "male"
    let needMalesFromBots = targetMales - (userIsMale ? 1 : 0)
    let needFemalesFromBots = targetFemales - (!userIsMale ? 1 : 0)
    if (needMalesFromBots < 0) needMalesFromBots = 0
    if (needFemalesFromBots < 0) needFemalesFromBots = 0

    const maleBots = allBots.filter((b) => b.gender === "male")
    const femaleBots = allBots.filter((b) => b.gender === "female")

    const selectedMales = maleBots.slice(0, needMalesFromBots)
    const selectedFemales = femaleBots.slice(0, needFemalesFromBots)

    let selectedBots = [...selectedMales, ...selectedFemales]
    // если по какой-то причине не хватило полов, добираем случайных оставшихся
    if (selectedBots.length < neededBots) {
      const remaining = neededBots - selectedBots.length
      const extraPool = allBots.filter((b) => !selectedBots.includes(b))
      selectedBots = selectedBots.concat(extraPool.slice(0, remaining))
    }

    const finalPlayersAtTableBase = [user, ...selectedBots].slice(0, maxTableSize)
    // Перемешиваем порядок за столом, чтобы мужчины/женщины
    // не сидели всегда по разным сторонам.
    const finalPlayersAtTable = [...finalPlayersAtTableBase].sort(() => Math.random() - 0.5)
    const tablesCount = 80 + Math.floor(Math.random() * 40)

    dispatch({ type: "SET_TABLE", players: finalPlayersAtTable, tableId: 7000 + Math.floor(Math.random() * 1000) })
    dispatch({ type: "SET_TABLES_COUNT", tablesCount })
    dispatch({ type: "SET_SCREEN", screen: "game" })
  }

  const ensureAgeValid = () => {
    const ageNum = parseInt(age)
    if (!age || isNaN(ageNum) || ageNum < 18) {
      setError("Укажите возраст (18+)")
      return null
    }
    return ageNum
  }

  const handleContinueVk = async () => {
    const ageNum = ensureAgeValid()
    if (!ageNum) return

    setLoading(true)
    setError("")

    try {
      // Simulate VK Bridge auth
      const vkUser = await vkBridge.getUserInfo()

      // Определяем пол: сначала из VK, если есть, иначе из локального состояния
      const genderValue: Gender =
        vkUser.sex === 2 ? "male" : vkUser.sex === 1 ? "female" : gender

      const user = {
        id: vkUser.id,
        name: `${vkUser.first_name} ${vkUser.last_name}`,
        avatar: vkUser.photo_200,
        gender: genderValue,
        age: ageNum,
        purpose: defaultPurpose,
        authProvider: "vk" as const,
      }
      addToDevRegistry(user)
      buildTableAndEnter(user)
    } catch {
      setError("Ошибка авторизации. Попробуйте снова.")
    } finally {
      setLoading(false)
    }
  }

  /** Преобразует строковый id пользователя (UUID) в число для Player.id */
  const userIdToNumber = (id: string): number => {
    let h = 0
    for (let i = 0; i < id.length; i++) {
      h = (h << 5) - h + id.charCodeAt(i)
      h = h | 0
    }
    return Math.abs(h) || 1
  }

  const handleLogin = async () => {
    if (!login.trim() || !password) {
      setError("Введите логин и пароль")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: login.trim(), password }),
        credentials: "include",
      })
      const data = res.ok ? await res.json() : null
      if (!res.ok) {
        setError((data?.error as string) || "Неверный логин или пароль")
        return
      }
      if (data?.user) {
        const u = data.user
        const user = {
          id: userIdToNumber(u.id),
          name: u.displayName ?? u.username,
          avatar: u.avatarUrl ?? `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(login)}`,
          gender: (u.gender === "female" ? "female" : "male") as Gender,
          age: u.age ?? 25,
          purpose: (u.purpose && ["relationships", "communication", "love"].includes(u.purpose) ? u.purpose : defaultPurpose) as Purpose,
          authProvider: "login" as const,
        }
        const voiceBalance = typeof data.voiceBalance === "number" ? data.voiceBalance : 0
        const inventory = Array.isArray(data.inventory) ? data.inventory : []
        dispatch({ type: "RESTORE_GAME_STATE", voiceBalance, inventory })
        addToDevRegistry(user, login.trim())
        buildTableAndEnter(user)
        setShowLoginModal(false)
      }
    } catch {
      setError("Ошибка сети. Попробуйте снова.")
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    const ageNum = ensureAgeValid()
    if (!ageNum) return
    if (!login.trim() || !password) {
      setError("Введите логин и пароль")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: login.trim(),
          password,
          displayName: displayName.trim() || undefined,
          age: ageNum,
          gender,
          purpose: defaultPurpose,
        }),
        credentials: "include",
      })
      const data = res.ok ? await res.json() : null
      if (res.status === 409) {
        setError("Логин уже занят. Выберите другой логин.")
        return
      }
      if (!res.ok) {
        setError((data?.error as string) || "Ошибка регистрации")
        return
      }
      if (data?.user) {
        const u = data.user
        const user = {
          id: userIdToNumber(u.id),
          name: (u.displayName ?? displayName.trim()) || u.username,
          avatar: u.avatarUrl ?? `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(login)}`,
          gender: (u.gender === "female" ? "female" : "male") as Gender,
          age: u.age ?? ageNum,
          purpose: (u.purpose && ["relationships", "communication", "love"].includes(u.purpose) ? u.purpose : defaultPurpose) as Purpose,
          authProvider: "login" as const,
        }
        const voiceBalance = typeof data.voiceBalance === "number" ? data.voiceBalance : 0
        const inventory = Array.isArray(data.inventory) ? data.inventory : []
        dispatch({ type: "RESTORE_GAME_STATE", voiceBalance, inventory })
        addToDevRegistry(user, login.trim())
        buildTableAndEnter(user)
        setShowLoginModal(false)
      }
    } catch {
      setError("Ошибка сети. Попробуйте снова.")
    } finally {
      setLoading(false)
    }
  }

  const entryParticles = useMemo(() => {
    const count = 18
    const list: { x: number; y: number; duration: number; delay: number; isPink: boolean; isYellow: boolean; reverse: boolean }[] = []
    let s = 12345
    for (let i = 0; i < count; i++) {
      s = (s * 9301 + 49297) % 233280
      const x = 5 + (s / 233280) * 90
      s = (s * 9301 + 49297) % 233280
      const y = 10 + (s / 233280) * 80
      s = (s * 9301 + 49297) % 233280
      list.push({
        x,
        y,
        duration: 18 + (s % 12),
        delay: (s % 20) / 2,
        isPink: i % 3 === 1,
        isYellow: i % 3 === 2,
        reverse: i % 2 === 1,
      })
    }
    return list
  }, [])

  return (
    <div className="relative flex min-h-dvh min-h-[100vh] flex-col items-center justify-center overflow-y-auto entry-bg-animated px-4 py-6 sm:py-8 pb-[env(safe-area-inset-bottom)]">
      <div className="game-particles" aria-hidden="true">
        {entryParticles.map((d, idx) => (
          <span
            key={idx}
            className={`game-particles__dot ${d.isPink ? "game-particles__dot--pink" : ""} ${d.isYellow ? "game-particles__dot--yellow" : ""} ${d.reverse ? "game-particles__dot--reverse" : ""}`}
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 w-full flex flex-col items-center">
      <div className="w-full max-w-sm rounded-2xl border border-slate-600/80 bg-slate-900/95 px-5 py-6 shadow-[0_20px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Heart className="h-8 w-8 text-primary-foreground" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 text-balance text-center">
            {"Крути и знакомься"}
          </h1>
          <p className="text-sm text-slate-400 text-center text-pretty">
            {"Крути бутылочку, знакомься и общайся с новыми людьми"}
          </p>
        </div>

        {/* Основные способы входа */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={handleContinueVk}
            disabled={loading}
            className="w-full rounded-xl py-4 text-base font-semibold flex items-center justify-center gap-2"
            size="lg"
            style={{
              background: "#2787F5",
            }}
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
              style={{ backgroundColor: "#ffffff", color: "#2787F5" }}
            >
              {"VK"}
            </span>
            <span>{loading ? "Авторизация..." : "Войти через VK"}</span>
          </Button>

          <Button
            onClick={() => { setError(""); setLoginModalMode("login"); setShowLoginModal(true) }}
            disabled={loading}
            variant="outline"
            className="w-full rounded-xl py-4 text-base font-semibold border-slate-500 text-slate-200 hover:bg-slate-700/50"
          >
            {"Войти по логину"}
          </Button>

          <p className="mt-3 text-center text-xs text-slate-400 leading-relaxed max-w-[85%] mx-auto">
            Нажимая кнопку, вы соглашаетесь с{" "}
            <a
              href="https://dev.vk.com/ru/mini-apps-rules"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-300 underline underline-offset-1 hover:text-sky-200"
            >
              правилами размещения мини-приложений VK
            </a>
            . В игре используется только виртуальная валюта (сердечки), не обмениваемая на реальные деньги и не являющаяся азартной игрой.
          </p>
        </div>
      </div>
      </div>

      {/* Модалка: Вход по логину / Регистрация */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-600/80 bg-slate-900/98 px-5 py-6 shadow-[0_24px_50px_rgba(0,0,0,0.8)]"
          >
            {loginModalMode === "login" ? (
              <>
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-slate-100">Вход</h2>
                  <p className="text-xs text-slate-400">Введите логин и пароль</p>
                </div>
                <div className="mb-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Логин"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-card-foreground placeholder:text-card-foreground/60 focus:border-primary focus:outline-none transition-colors"
                  />
                  <input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-card-foreground placeholder:text-card-foreground/60 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
                {error && <p className="mb-3 text-center text-sm text-destructive">{error}</p>}
                <div className="mb-3 flex gap-2">
                  <Button
                    className="flex-1 rounded-xl py-3 text-sm font-semibold"
                    disabled={loading}
                    onClick={handleLogin}
                  >
                    Войти
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-xl py-3 text-sm font-semibold border-slate-500 text-slate-200 hover:bg-slate-700/50"
                    onClick={() => { setShowLoginModal(false); setError(""); }}
                  >
                    Отмена
                  </Button>
                </div>
                <div className="flex flex-col items-center gap-2 border-t border-slate-600/80 pt-3">
                  <span className="text-sm text-slate-400">Нет логина?</span>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl py-2.5 text-sm font-semibold border-amber-500/50 text-amber-200 hover:bg-amber-500/20"
                    onClick={() => { setLoginModalMode("register"); setError(""); }}
                  >
                    Регистрация
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-slate-100">Регистрация</h2>
                  <p className="text-xs text-slate-400">Логин, пароль, имя, возраст, пол</p>
                </div>
                <div className="mb-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Логин"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-card-foreground placeholder:text-card-foreground/60 focus:border-primary focus:outline-none transition-colors"
                  />
                  <input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-card-foreground placeholder:text-card-foreground/60 focus:border-primary focus:outline-none transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Имя"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-xl border-2 border-border bg-card px-4 py-3 text-card-foreground placeholder:text-card-foreground/60 focus:border-primary focus:outline-none transition-colors"
                  />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-200">Возраст (18+)</label>
                    <input
                      type="number"
                      min={18}
                      max={99}
                      placeholder="25"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full rounded-xl border-2 border-border bg-card px-3 py-2 text-card-foreground text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-200">Пол</label>
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => setGender("male")}
                        className={`rounded-full px-3 py-1 text-xs font-medium border ${
                          gender === "male" ? "border-primary text-primary bg-primary/10" : "border-slate-500 text-slate-300"
                        }`}
                      >
                        Мужской
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender("female")}
                        className={`rounded-full px-3 py-1 text-xs font-medium border ${
                          gender === "female" ? "border-primary text-primary bg-primary/10" : "border-slate-500 text-slate-300"
                        }`}
                      >
                        Женский
                      </button>
                    </div>
                  </div>
                </div>
                {error && <p className="mb-3 text-center text-sm text-destructive">{error}</p>}
                <div className="mb-3 flex gap-2">
                  <Button
                    className="flex-1 rounded-xl py-3 text-sm font-semibold"
                    disabled={loading}
                    onClick={handleRegister}
                  >
                    Зарегистрироваться
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-xl py-3 text-sm font-semibold border-slate-500 text-slate-200 hover:bg-slate-700/50"
                    onClick={() => { setShowLoginModal(false); setError(""); }}
                  >
                    Отмена
                  </Button>
                </div>
                <div className="flex flex-col items-center gap-2 border-t border-slate-600/80 pt-3">
                  <span className="text-sm text-slate-400">Уже есть логин?</span>
                  <button
                    type="button"
                    className="text-sm font-medium text-amber-200 hover:underline"
                    onClick={() => { setLoginModalMode("login"); setError(""); }}
                  >
                    Войти
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
