"use client"

import { useState, useMemo, useEffect, useLayoutEffect, useCallback, type CSSProperties } from "react"
import { Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGame } from "@/lib/game-context"
import { addToDevRegistry } from "@/lib/dev-registry"
import {
  vkBridge,
  initVkResilient,
  isVkMiniApp,
  ensureVkLaunchSearchResilient,
  type VkUserInfo,
} from "@/lib/vk-bridge"
import { useGameLayoutMode } from "@/lib/use-media-query"
import type { Gender, Purpose, InventoryItem } from "@/lib/game-types"
import { buildRestoreGameStateAction } from "@/lib/user-visual-prefs"
import { AppLoader } from "@/components/app-loader"
import { Spinner } from "@/components/ui/spinner"
import { apiFetch, setClientSessionToken } from "@/lib/api-fetch"
import { parseAgeFromVkBdate, parseZodiacFromVkBdate } from "@/lib/vk-profile-fields"
import { detectRuntimeHost, useSocialRuntime } from "@/lib/social-runtime"
import {
  collectOkLaunchParamsFromLocation,
  initOkSdkResilient,
  mergeOkLaunchParamsFromFapi,
} from "@/lib/ok-client"

export function RegistrationScreen() {
  const { dispatch } = useGame()
  const { host: runtimeHost } = useSocialRuntime()
  const { layoutMobile: isMobile } = useGameLayoutMode()
  /** Узкая карточка по центру на всех размерах экрана */
  const entryCardMax = "w-full max-w-sm sm:max-w-md"
  const loginModalMax = !isMobile ? "max-w-xl" : "max-w-sm"
  const [gender, setGender] = useState<Gender>("male")
  const [age, setAge] = useState("25")
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginModalMode, setLoginModalMode] = useState<"login" | "register">("login")
  /** В VK Mini App: показываем только лоадер, пока идёт тихий вход (сессия или launch params). */
  const [vkGate, setVkGate] = useState(false)
  const defaultPurpose: Purpose = "communication"

  /** Преобразует строковый id пользователя (UUID) в число для Player.id.
   *  Гарантирует отсутствие конфликта с ID ботов (1000-1999). */
  const userIdToNumber = useCallback((id: string): number => {
    let h = 0
    for (let i = 0; i < id.length; i++) {
      h = (h << 5) - h + id.charCodeAt(i)
      h = h | 0
    }
    const n = Math.abs(h) || 1
    return n < 10000 ? n + 10000 : n
  }, [])

  const buildTableAndEnter = useCallback(
    async (user: {
      id: number
      name: string
      avatar: string
      gender: Gender
      age: number
      purpose: Purpose
      status?: string
      authProvider?: "vk" | "ok" | "login"
      authUserId?: string
      vkUserId?: number
      okUserId?: number
      city?: string
      zodiac?: string
      interests?: string
    }) => {
      dispatch({ type: "SET_USER", user })
      dispatch({ type: "SET_SCREEN", screen: "daily-streak" })
    },
    [dispatch],
  )

  /** Вход по данным bridge без подписанных launch params (как при нажатии «Войти через VK» в офлайне). */
  const enterVkWithoutSignedServerAuth = async (vkUser: VkUserInfo, ageNum: number) => {
    const genderValue: Gender =
      vkUser.sex === 2 ? "male" : vkUser.sex === 1 ? "female" : gender
    const ageFromVk =
      vkUser.bdate && vkUser.bdate.length > 0 ? parseAgeFromVkBdate(vkUser.bdate) : null
    const effectiveAge = ageFromVk != null && ageFromVk >= 18 ? ageFromVk : ageNum
    const zodiacFromVk =
      vkUser.bdate && vkUser.bdate.length > 0 ? parseZodiacFromVkBdate(vkUser.bdate) : undefined
    const user = {
      id: vkUser.id,
      name: `${vkUser.first_name} ${vkUser.last_name}`,
      avatar: vkUser.photo_200,
      gender: genderValue,
      age: effectiveAge,
      purpose: defaultPurpose,
      authProvider: "vk" as const,
      vkUserId: vkUser.id,
      ...(vkUser.city?.title ? { city: vkUser.city.title } : {}),
      ...(zodiacFromVk ? { zodiac: zodiacFromVk } : {}),
      ...(vkUser.interests ? { interests: vkUser.interests } : {}),
    }
    try {
      const res = await apiFetch(`/api/user/state?vk_user_id=${encodeURIComponent(String(vkUser.id))}`, {
        method: "GET",
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        const voiceBalance = typeof data.voiceBalance === "number" ? data.voiceBalance : 0
        const inventory = Array.isArray(data.inventory) ? data.inventory : []
        dispatch(buildRestoreGameStateAction(voiceBalance, inventory as InventoryItem[], vkUser.id, data.visualPrefs))
      }
    } catch {
      // если сервер недоступен, продолжаем без восстановления прогресса
    }
    addToDevRegistry(user)
    await buildTableAndEnter(user)
  }

  const tryEnterFromSession = useCallback(async (): Promise<boolean> => {
    const meRes = await apiFetch("/api/auth/me", { credentials: "include" })
    if (!meRes.ok) return false
    const meData = (await meRes.json().catch(() => null)) as {
      authProvider?: string
      user?: {
        id: string
        username?: string
        displayName?: string
        avatarUrl?: string
        status?: string
        gender?: string
        age?: number
        purpose?: string
        vkUserId?: number
        okUserId?: number
        city?: string
        zodiac?: string
        interests?: string
      }
    } | null
    const u = meData?.user
    if (!u) return false

    const apRaw = meData.authProvider
    const ap: "vk" | "ok" | "login" =
      apRaw === "ok" || typeof u.okUserId === "number"
        ? "ok"
        : apRaw === "vk" || typeof u.vkUserId === "number"
          ? "vk"
          : "login"

    const uid =
      ap === "vk" && typeof u.vkUserId === "number"
        ? u.vkUserId
        : ap === "ok" && typeof u.okUserId === "number"
          ? u.okUserId
          : userIdToNumber(u.id)

    const user = {
      id: uid,
      name: u.displayName ?? u.username ?? "Игрок",
      avatar:
        u.avatarUrl ??
        `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(u.username ?? "u")}`,
      gender: (u.gender === "female" ? "female" : "male") as Gender,
      age: typeof u.age === "number" ? u.age : 25,
      purpose: (u.purpose && ["relationships", "communication", "love"].includes(u.purpose)
        ? u.purpose
        : defaultPurpose) as Purpose,
      status: typeof u.status === "string" ? u.status.slice(0, 15) : "",
      authProvider: ap,
      authUserId: ap === "login" ? u.id : undefined,
      vkUserId: ap === "vk" ? u.vkUserId : undefined,
      okUserId: ap === "ok" ? u.okUserId : undefined,
      city: u.city,
      zodiac: u.zodiac,
      ...(u.interests ? { interests: u.interests } : {}),
    }
    const stRes = await apiFetch("/api/user/state", { credentials: "include" })
    const stData = await stRes.json().catch(() => null)
    if (stRes.ok && stData?.ok) {
      const voiceBalance = typeof stData.voiceBalance === "number" ? stData.voiceBalance : 0
      const inventory = (Array.isArray(stData.inventory) ? stData.inventory : []) as InventoryItem[]
      dispatch(buildRestoreGameStateAction(voiceBalance, inventory, uid, stData.visualPrefs))
    }
    addToDevRegistry(user)
    await buildTableAndEnter(user)
    return true
  }, [dispatch, userIdToNumber, buildTableAndEnter])

  useLayoutEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (isVkMiniApp() || window.self !== window.top || detectRuntimeHost() === "ok") setVkGate(true)
    } catch {
      setVkGate(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (detectRuntimeHost() === "ok") return

    let cancelled = false
    setLoading(true)
    setError("")

    ;(async () => {
      try {
        let inIframe = false
        try {
          inIframe = window.self !== window.top
        } catch {
          inIframe = true
        }
        const quickVkHint = isVkMiniApp() || (inIframe && detectRuntimeHost() !== "ok")
        if (!quickVkHint) {
          if (!cancelled) setLoading(false)
          return
        }

        if (!cancelled) setVkGate(true)

        // Сессия не зависит от bridge: запросы /api/auth/me до initVk (иначе зависший VKWebAppInit блокирует сеть)
        if (await tryEnterFromSession()) return
        if (cancelled) return

        await initVkResilient()
        if (cancelled) return

        const launchSearch = await ensureVkLaunchSearchResilient()
        if (!launchSearch.includes("vk_user_id=") || !launchSearch.includes("sign=")) {
          if (!cancelled) {
            const vkUserEarly = await vkBridge.getUserInfo()
            await enterVkWithoutSignedServerAuth(vkUserEarly, 25)
          }
          return
        }

        const vkUser = await vkBridge.getUserInfo()
        if (cancelled) return

        const res = await apiFetch("/api/auth/vk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            launchParams: launchSearch,
            profile: {
              firstName: vkUser.first_name,
              lastName: vkUser.last_name,
              photoUrl: vkUser.photo_200,
              sex: vkUser.sex,
              bdate: vkUser.bdate,
              city: vkUser.city?.title,
              interests: vkUser.interests,
            },
          }),
        })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          error?: string
          sessionToken?: string
          user?: {
            id: string
            username?: string
            displayName?: string
            avatarUrl?: string
            status?: string
            gender?: string
            age?: number
            purpose?: string
            vkUserId?: number
            city?: string
            zodiac?: string
            interests?: string
          }
          voiceBalance?: number
          inventory?: unknown[]
          visualPrefs?: unknown
        } | null
        if (cancelled) return
        if (!res.ok) {
          await enterVkWithoutSignedServerAuth(vkUser, 25)
          return
        }
        if (data?.user) {
          if (typeof data.sessionToken === "string") setClientSessionToken(data.sessionToken)
          const u = data.user
          const uid = typeof u.vkUserId === "number" ? u.vkUserId : userIdToNumber(u.id)
          const genderValue: Gender =
            vkUser.sex === 2 ? "male" : vkUser.sex === 1 ? "female" : u.gender === "female" ? "female" : "male"
          const user = {
            id: uid,
            name: u.displayName ?? u.username ?? `${vkUser.first_name} ${vkUser.last_name}`.trim(),
            avatar: u.avatarUrl ?? vkUser.photo_200,
            gender: genderValue,
            age: typeof u.age === "number" ? u.age : 25,
            purpose: (u.purpose && ["relationships", "communication", "love"].includes(u.purpose)
              ? u.purpose
              : defaultPurpose) as Purpose,
            status: typeof u.status === "string" ? u.status.slice(0, 15) : "",
            authProvider: "vk" as const,
            city: u.city,
            zodiac: u.zodiac,
            ...(u.interests ? { interests: u.interests } : {}),
          }
          const voiceBalance = typeof data.voiceBalance === "number" ? data.voiceBalance : 0
          const inventory = (Array.isArray(data.inventory) ? data.inventory : []) as InventoryItem[]
          dispatch(buildRestoreGameStateAction(voiceBalance, inventory, uid, data.visualPrefs))
          addToDevRegistry(user)
          await buildTableAndEnter(user)
        } else {
          await enterVkWithoutSignedServerAuth(vkUser, 25)
        }
      } catch {
        if (!cancelled) {
          setVkGate(false)
          setError("Ошибка входа. Нажмите «Войти через VK» или войдите по логину.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tryEnterFromSession])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (detectRuntimeHost() !== "ok") return

    let cancelled = false
    setVkGate(true)
    setLoading(true)
    setError("")

    ;(async () => {
      try {
        if (await tryEnterFromSession()) return
        if (cancelled) return

        await initOkSdkResilient()
        if (cancelled) return

        let params = collectOkLaunchParamsFromLocation()
        params = await mergeOkLaunchParamsFromFapi(params)
        if (!params.sig && !params.signature) {
          if (!cancelled) {
            setError("Параметры запуска ОК не найдены (sig). Откройте игру из приложения Одноклассников.")
            setVkGate(false)
            setLoading(false)
          }
          return
        }

        const res = await apiFetch("/api/auth/ok", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            launchParams: params,
            profile: {},
            purpose: defaultPurpose,
          }),
        })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
          error?: string
          sessionToken?: string
          user?: {
            id: string
            username?: string
            displayName?: string
            avatarUrl?: string
            status?: string
            gender?: string
            age?: number
            purpose?: string
            okUserId?: number
            city?: string
            zodiac?: string
            interests?: string
          }
          voiceBalance?: number
          inventory?: unknown[]
          visualPrefs?: unknown
        } | null
        if (cancelled) return
        if (!res.ok || !data?.ok || !data.user) {
          if (!cancelled) {
            setVkGate(false)
            setError(data?.error ?? "Не удалось войти через Одноклассники")
          }
          return
        }
        if (typeof data.sessionToken === "string") setClientSessionToken(data.sessionToken)
        const u = data.user
        const uid = typeof u.okUserId === "number" ? u.okUserId : userIdToNumber(u.id)
        const user = {
          id: uid,
          name: u.displayName ?? u.username ?? "Игрок",
          avatar:
            u.avatarUrl ??
            `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(u.username ?? "u")}`,
          gender: (u.gender === "female" ? "female" : "male") as Gender,
          age: typeof u.age === "number" ? u.age : 25,
          purpose: (u.purpose && ["relationships", "communication", "love"].includes(u.purpose)
            ? u.purpose
            : defaultPurpose) as Purpose,
          status: typeof u.status === "string" ? u.status.slice(0, 15) : "",
          authProvider: "ok" as const,
          okUserId: typeof u.okUserId === "number" ? u.okUserId : uid,
          city: u.city,
          zodiac: u.zodiac,
          ...(u.interests ? { interests: u.interests } : {}),
        }
        const voiceBalance = typeof data.voiceBalance === "number" ? data.voiceBalance : 0
        const inventory = (Array.isArray(data.inventory) ? data.inventory : []) as InventoryItem[]
        dispatch(buildRestoreGameStateAction(voiceBalance, inventory, uid, data.visualPrefs))
        addToDevRegistry(user)
        await buildTableAndEnter(user)
      } catch {
        if (!cancelled) {
          setVkGate(false)
          setError("Ошибка входа в Одноклассниках. Попробуйте обновить страницу.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tryEnterFromSession, dispatch, userIdToNumber, buildTableAndEnter])

  const ensureAgeValid = () => {
    const ageNum = parseInt(age)
    if (!age || isNaN(ageNum) || ageNum < 18) {
      setError("Укажите возраст (18+)")
      return null
    }
    return ageNum
  }

  const handleContinueVk = async () => {
    let ageNum = parseInt(age, 10)
    if (!Number.isFinite(ageNum) || ageNum < 18) {
      if (isVkMiniApp()) ageNum = 25
      else {
        setError("Укажите возраст (18+)")
        return
      }
    }

    setLoading(true)
    setError("")

    try {
      await initVkResilient()
      const vkUser = await vkBridge.getUserInfo()
      const launchSearch = await ensureVkLaunchSearchResilient()
      let inIframe = false
      try {
        inIframe = window.self !== window.top
      } catch {
        inIframe = true
      }
      const canServerVkAuth =
        launchSearch.includes("vk_user_id=") &&
        launchSearch.includes("sign=") &&
        (isVkMiniApp() || inIframe)

      if (canServerVkAuth) {
        const res = await apiFetch("/api/auth/vk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            launchParams: launchSearch,
            profile: {
              firstName: vkUser.first_name,
              lastName: vkUser.last_name,
              photoUrl: vkUser.photo_200,
              sex: vkUser.sex,
              bdate: vkUser.bdate,
              city: vkUser.city?.title,
              interests: vkUser.interests,
            },
          }),
        })
        const data = (await res.json().catch(() => null)) as {
          sessionToken?: string
          user?: {
            id: string
            username?: string
            displayName?: string
            avatarUrl?: string
            status?: string
            gender?: string
            age?: number
            purpose?: string
            vkUserId?: number
            city?: string
            zodiac?: string
            interests?: string
          }
          voiceBalance?: number
          inventory?: unknown[]
          visualPrefs?: unknown
        } | null
        if (res.ok && data?.user) {
          if (typeof data.sessionToken === "string") setClientSessionToken(data.sessionToken)
          const u = data.user
          const uid = typeof u.vkUserId === "number" ? u.vkUserId : userIdToNumber(u.id)
          const genderValue: Gender =
            vkUser.sex === 2 ? "male" : vkUser.sex === 1 ? "female" : gender
          const user = {
            id: uid,
            name: u.displayName ?? `${vkUser.first_name} ${vkUser.last_name}`.trim(),
            avatar: u.avatarUrl ?? vkUser.photo_200,
            gender: genderValue,
            age: typeof u.age === "number" ? u.age : ageNum,
            purpose: defaultPurpose,
            status: typeof u.status === "string" ? u.status.slice(0, 15) : "",
            authProvider: "vk" as const,
            city: u.city,
            zodiac: u.zodiac,
            ...(u.interests ? { interests: u.interests } : {}),
          }
          const voiceBalance = typeof data.voiceBalance === "number" ? data.voiceBalance : 0
          const inventory = (Array.isArray(data.inventory) ? data.inventory : []) as InventoryItem[]
          dispatch(buildRestoreGameStateAction(voiceBalance, inventory, uid, data.visualPrefs))
          addToDevRegistry(user)
          await buildTableAndEnter(user)
          return
        }
      }

      await enterVkWithoutSignedServerAuth(vkUser, ageNum)
    } catch {
      setError("Ошибка авторизации. Попробуйте снова.")
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!login.trim() || !password) {
      setError("Введите логин и пароль")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: login.trim(), password }),
        credentials: "include",
      })
      let data: any = null
      try {
        data = await res.json()
      } catch {
        // ignore JSON parse error
      }
      if (!res.ok) {
        setError((data?.error as string) || "Неверный логин или пароль")
        return
      }
      if (data?.user) {
        if (typeof data.sessionToken === "string") setClientSessionToken(data.sessionToken)
        const u = data.user
        const genderValue = (u.gender === "female" ? "female" : "male") as Gender
        const user = {
          id: userIdToNumber(u.id),
          name: u.displayName ?? u.username,
          avatar: u.avatarUrl ?? (genderValue === "female" ? "/assets/avatar-female.svg" : "/assets/avatar-male.svg"),
          gender: genderValue,
          age: u.age ?? 25,
          purpose: (u.purpose && ["relationships", "communication", "love"].includes(u.purpose) ? u.purpose : defaultPurpose) as Purpose,
          status: typeof u.status === "string" ? u.status.slice(0, 15) : "",
          authProvider: "login" as const,
          authUserId: u.id,
        }
        const voiceBalance = typeof data.voiceBalance === "number" ? data.voiceBalance : 0
        const inventory = Array.isArray(data.inventory) ? data.inventory : []
        dispatch(
          buildRestoreGameStateAction(
            voiceBalance,
            inventory as InventoryItem[],
            userIdToNumber(u.id),
            data.visualPrefs,
          ),
        )
        addToDevRegistry(user, login.trim())
        await buildTableAndEnter(user)
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
      const res = await apiFetch("/api/auth/register", {
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
      let data: any = null
      try {
        data = await res.json()
      } catch {
        // ignore JSON parse error
      }
      if (res.status === 409) {
        setError("Логин уже занят. Выберите другой логин.")
        return
      }
      if (!res.ok) {
        setError((data?.error as string) || "Ошибка регистрации")
        return
      }
      if (data?.user) {
        if (typeof data.sessionToken === "string") setClientSessionToken(data.sessionToken)
        const u = data.user
        const genderValue = (u.gender === "female" ? "female" : "male") as Gender
        const user = {
          id: userIdToNumber(u.id),
          name: (u.displayName ?? displayName.trim()) || u.username,
          avatar: u.avatarUrl ?? (genderValue === "female" ? "/assets/avatar-female.svg" : "/assets/avatar-male.svg"),
          gender: genderValue,
          age: u.age ?? ageNum,
          purpose: (u.purpose && ["relationships", "communication", "love"].includes(u.purpose) ? u.purpose : defaultPurpose) as Purpose,
          status: typeof u.status === "string" ? u.status.slice(0, 15) : "",
          authProvider: "login" as const,
          authUserId: u.id,
        }
        const voiceBalance = typeof data.voiceBalance === "number" ? data.voiceBalance : 0
        const inventory = Array.isArray(data.inventory) ? data.inventory : []
        dispatch(
          buildRestoreGameStateAction(
            voiceBalance,
            inventory as InventoryItem[],
            userIdToNumber(u.id),
            data.visualPrefs,
          ),
        )
        addToDevRegistry(user, login.trim())
        await buildTableAndEnter(user)
        setShowLoginModal(false)
      }
    } catch {
      setError("Ошибка сети. Попробуйте снова.")
    } finally {
      setLoading(false)
    }
  }

  const PARTICLE_EASE = [
    "cubic-bezier(0.45, 0.02, 0.29, 0.98)",
    "cubic-bezier(0.33, 0.12, 0.53, 0.94)",
    "cubic-bezier(0.52, 0.01, 0.19, 0.99)",
    "cubic-bezier(0.4, 0.18, 0.32, 0.92)",
    "cubic-bezier(0.28, 0.09, 0.46, 1)",
    "cubic-bezier(0.55, 0.05, 0.15, 0.95)",
  ] as const

  /** Детерминированно (без Math.random) — одинаково на SSR и клиенте, без пустого фона */
  const entryParticles = useMemo(() => {
    let s = 0xdecaf001 % 233280
    s = (s * 9301 + 49297) % 233280
    const count = 12 + (s % 34)
    const list: {
      x: number
      y: number
      duration: number
      delay: number
      isPink: boolean
      isYellow: boolean
      reverse: boolean
      chaos: number
      ease: string
      dustOpacity: number
      dustSize: string
    }[] = []
    for (let i = 0; i < count; i++) {
      s = (s * 9301 + 49297) % 233280
      const x = 2 + (s / 233280) * 96
      s = (s * 9301 + 49297) % 233280
      const y = 4 + (s / 233280) * 92
      s = (s * 9301 + 49297) % 233280
      const chaos = s % 6
      s = (s * 9301 + 49297) % 233280
      const dustSize = `${(2.1 + (s / 233280) * 2.85).toFixed(2)}px`
      const dustOpacity = 0.42 + (s / 233280) * 0.48
      list.push({
        x,
        y,
        duration: 16 + (s % 28),
        delay: (s % 38) * 0.32,
        isPink: i % 3 === 1,
        isYellow: i % 3 === 2,
        reverse: (s + i) % 2 === 1,
        chaos,
        ease: PARTICLE_EASE[(s + chaos) % PARTICLE_EASE.length],
        dustOpacity,
        dustSize,
      })
    }
    return list
  }, [])

  if (vkGate && (runtimeHost === "vk" || runtimeHost === "ok")) {
    return (
      <div className="relative flex min-h-app min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden entry-bg-animated">
        <AppLoader
          className="!min-h-0 min-h-0 flex-1 bg-slate-900/98"
          title="Вход…"
          subtitle={runtimeHost === "ok" ? "Подключаем профиль в Одноклассниках" : "Подключаем профиль ВКонтакте"}
          hint="Крути и знакомься"
          showDailyQuote
        />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-app min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden entry-bg-animated px-4 pt-8 sm:pt-10 pb-[max(0px,env(safe-area-inset-bottom))]">
      <div className="game-particles game-particles--dust" aria-hidden="true">
        {entryParticles.map((d, idx) => {
          const anim = d.reverse ? `particleChaosRev${d.chaos + 1}` : `particleChaos${d.chaos + 1}`
          return (
            <span
              key={idx}
              className="pointer-events-none absolute"
              style={{ left: `${d.x}%`, top: `${d.y}%`, opacity: d.dustOpacity }}
            >
              <span
                className={`game-particles__dot ${d.isPink ? "game-particles__dot--pink" : ""} ${d.isYellow ? "game-particles__dot--yellow" : ""}`}
                style={
                  {
                    position: "relative",
                    left: 0,
                    top: 0,
                    ["--particle-anim"]: anim,
                    ["--particle-dur"]: `${d.duration}s`,
                    ["--particle-delay"]: `${d.delay}s`,
                    ["--particle-ease"]: d.ease,
                    ["--dust-size"]: d.dustSize,
                  } as CSSProperties
                }
              />
            </span>
          )
        })}
      </div>
      <div className="relative z-10 flex w-full min-w-0 flex-1 flex-col items-center justify-center px-3 sm:px-6">
      <div
        className={`mx-auto min-w-0 ${entryCardMax} rounded-2xl border border-slate-600/80 bg-slate-900/95 px-5 py-6 sm:px-8 sm:py-8 shadow-[0_20px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm`}
      >
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

        <div className="flex flex-col gap-3">
          {runtimeHost === "ok" && error ? (
            <p className="text-center text-sm text-destructive">{error}</p>
          ) : null}
          <div className="flex w-full flex-col items-stretch gap-3">
            {runtimeHost !== "ok" ? (
            <Button
              onClick={handleContinueVk}
              disabled={loading}
              aria-busy={loading}
              className="w-full rounded-xl py-4 text-base font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-95"
              size="lg"
              style={{
                background: "#2787F5",
              }}
            >
              {loading ? (
                <Spinner className="size-5 shrink-0 text-white" aria-hidden />
              ) : (
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{ backgroundColor: "#ffffff", color: "#2787F5" }}
                >
                  {"VK"}
                </span>
              )}
              <span>{loading ? "Вход…" : "Войти через VK"}</span>
            </Button>
            ) : null}

            {runtimeHost !== "ok" ? (
            <Button
              onClick={() => { setError(""); setLoginModalMode("login"); setShowLoginModal(true) }}
              disabled={loading}
              variant="outline"
              className="w-full rounded-xl py-4 text-base font-semibold border-slate-500 text-slate-200 hover:bg-slate-700/50"
            >
              {"Войти по логину"}
            </Button>
            ) : null}
          </div>

          {runtimeHost !== "ok" ? (
          <p className="mt-1 text-center text-xs leading-relaxed text-slate-400">
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
          ) : null}
        </div>
      </div>
      </div>

      {/* Модалка: Вход по логину / Регистрация */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            className={`w-full ${loginModalMax} rounded-2xl border border-slate-600/80 bg-slate-900/98 px-5 py-6 shadow-[0_24px_50px_rgba(0,0,0,0.8)]`}
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
