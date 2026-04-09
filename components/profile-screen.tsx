"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Bell, Flower2, Heart, Sparkles, Trash2, Trophy, Users, Volume2, VolumeX, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InlineToast } from "@/components/ui/inline-toast"
import { GameSidePanelShell } from "@/components/game-side-panel-shell"
import { PlayerAvatar } from "@/components/player-avatar"
import { useGame } from "@/lib/game-context"
import { PAIR_ACTIONS } from "@/lib/game-types"
import type { GameLogEntry } from "@/lib/game-types"
import { effectiveOpenToChatInvites, effectiveShowVkAfterCare } from "@/lib/player-profile-prefs"
import { generateLogId } from "@/lib/ids"
import { resolveFrameCatalogAssetUrl } from "@/lib/assets"
import { useInlineToast } from "@/hooks/use-inline-toast"
import { cn } from "@/lib/utils"
import { vkBridge } from "@/lib/vk-bridge"
import { apiFetch } from "@/lib/api-fetch"
import { DEFAULT_FRAME_CATALOG_ROWS } from "@/lib/frame-catalog"
import { useFrameCatalog } from "@/lib/use-frame-catalog"
import { getTableSyncDispatch } from "@/lib/table-sync-registry"
import {
  ACHIEVEMENT_POST_CATALOG,
  ACHIEVEMENT_POST_CATALOG_BY_KEY,
} from "@/lib/achievement-posts-catalog"
import { formatAchievementPostText } from "@/lib/achievement-posts-format"

function genderLabel(g: string) {
  return g === "male" ? "Мужчина" : g === "female" ? "Женщина" : "—"
}

const GIFT_IDS = new Set(["flowers", "diamond", "song", "rose", "gift_voice", "tools", "lipstick"])
const PROFILE_LEVEL_MAX = 30
type AchievementPostTemplateRow = {
  achievementKey: string
  title: string
  imageUrl: string
  postTextTemplate: string
  vkEnabled: boolean
  published: boolean
}

function getAchievementStatusByKey(key: string, fallbackTitle: string): string {
  const fromCatalog = ACHIEVEMENT_POST_CATALOG_BY_KEY.get(key)
  const text = fromCatalog?.defaultStatus || fallbackTitle
  return text.trim().slice(0, 15)
}

function getDailyLevelByPoints(points: number): number {
  let spent = 0
  let level = 1
  while (level < PROFILE_LEVEL_MAX) {
    const need = 2 + Math.floor((level - 1) / 2)
    if (points < spent + need) break
    spent += need
    level += 1
  }
  return level
}

type ProfileScreenProps = {
  /** `panel` — боковая панель поверх стола; `page` — полноэкранный режим (не используется в маршрутизации). */
  variant?: "page" | "panel"
  onClose?: () => void
}

export function ProfileScreen({ variant = "page", onClose }: ProfileScreenProps = {}) {
  const { state, dispatch } = useGame()
  const { rows: frameCatalogRows } = useFrameCatalog()
  const {
    currentUser,
    players,
    tablePaused,
    voiceBalance,
    bonusBalance,
    inventory,
    rosesGiven,
    courtshipProfileAllowed,
    allowChatInvite,
    gameLog,
    avatarFrames,
    soundsEnabled,
    admirers,
    ugadaikaRoundsWon,
  } = state

  /** Рамка на столе: через sync-dispatch из game-room (сервер + остальные игроки), иначе только локально. */
  const dispatchAvatarFrameSynced = (frameId: string) => {
    if (!currentUser || tablePaused) return
    const action = { type: "SET_AVATAR_FRAME" as const, playerId: currentUser.id, frameId }
    const sync = getTableSyncDispatch()
    if (sync) sync(action)
    else dispatch(action)
  }

  const currentFrameId = (avatarFrames ?? {})[currentUser?.id ?? 0] ?? "none"
  const PROFILE_FRAMES = useMemo(() => {
    const source = frameCatalogRows.length > 0 ? frameCatalogRows : DEFAULT_FRAME_CATALOG_ROWS
    return source
      .filter((row) => row.published && !row.deleted)
      .map((row) => ({
        id: row.id,
        label: row.name,
        border: row.border,
        shadow: row.shadow,
        animationClass: row.animationClass || undefined,
        svgPath: row.svgPath || undefined,
        cost: row.cost,
        section: row.section,
      }))
  }, [frameCatalogRows])
  const FREE_FRAMES = PROFILE_FRAMES.filter((row) => row.section === "free")
  const PREMIUM_FRAMES = PROFILE_FRAMES.filter((row) => row.section !== "free")

  const rosesBalance = useMemo(
    () => inventory.filter((i) => i.type === "rose").length,
    [inventory],
  )

  const admirersResolved = useMemo(
    () => admirers.map((a) => players.find((p) => p.id === a.id) ?? a),
    [admirers, players],
  )

  const heartbreakerCount = useMemo(
    () =>
      currentUser
        ? gameLog.filter(
            (e) =>
              e.type === "kiss" &&
              (e.fromPlayer?.id === currentUser.id || e.toPlayer?.id === currentUser.id),
          ).length
        : 0,
    [currentUser, gameLog],
  )
  const spinCount = useMemo(
    () =>
      currentUser
        ? gameLog.filter(
            (e) =>
              e.fromPlayer?.id === currentUser.id && e.text.startsWith("Выпала пара:"),
          ).length
        : 0,
    [currentUser, gameLog],
  )
  const giftSpent = useMemo(
    () =>
      currentUser
        ? gameLog.reduce((sum, entry) => {
            if (entry.fromPlayer?.id !== currentUser.id) return sum
            if (!GIFT_IDS.has(entry.type)) return sum
            const action = PAIR_ACTIONS.find((a) => a.id === entry.type)
            return sum + (action?.cost ?? 0)
          }, 0)
        : 0,
    [currentUser, gameLog],
  )

  const rosesReceived = useMemo(
    () => (currentUser && rosesGiven ? rosesGiven.filter((r) => r.toPlayerId === currentUser.id).length : 0),
    [currentUser, rosesGiven],
  )
  const hasTrueFeelingsAchievement = useMemo(() => {
    if (!currentUser || !rosesGiven) return false
    const byTarget: Record<number, number> = {}
    for (const r of rosesGiven) {
      if (r.fromPlayerId !== currentUser.id) continue
      byTarget[r.toPlayerId] = (byTarget[r.toPlayerId] ?? 0) + 1
    }
    return Object.values(byTarget).some((n) => n >= 10)
  }, [currentUser, rosesGiven])

  const achievementStats = useMemo(() => {
    const uid = currentUser?.id
    if (!uid) return {} as Record<string, { current: number; target: number; known: boolean }>

    const sentLogs = gameLog.filter((e) => e.fromPlayer?.id === uid)
    const recvLogs = gameLog.filter((e) => e.toPlayer?.id === uid)
    const countSent = (type: string) => sentLogs.filter((e) => e.type === type).length
    const countRecv = (type: string) => recvLogs.filter((e) => e.type === type).length
    const maxStreakForTypes = (types: ReadonlySet<string>) => {
      let max = 0
      let cur = 0
      for (const e of gameLog) {
        if (e.fromPlayer?.id !== uid) continue
        if (types.has(e.type)) {
          cur += 1
          if (cur > max) max = cur
        } else if (e.type !== "system") {
          cur = 0
        }
      }
      return max
    }
    const sentToys = sentLogs.filter((e) => e.type === "toy_bear" || e.type === "toy_car" || e.type === "toy_ball").length
    const sentSeasonal = sentLogs.filter((e) => e.type === "plush_heart" || e.type === "souvenir_keychain" || e.type === "souvenir_magnet").length
    const sentGiftCount = sentLogs.filter((e) => GIFT_IDS.has(e.type)).length
    const recvSoft = inventory.filter(
      (i) => i.type === "toy_bear" || i.type === "toy_car" || i.type === "toy_ball" || i.type === "plush_heart",
    ).length
    const recvFlowers = inventory.filter((i) => i.type === "flowers").length
    const recvSweets = inventory.filter((i) => i.type === "chocolate_box").length
    const rosesSent = (rosesGiven ?? []).filter((r) => r.fromPlayerId === uid).length
    const maleFriends = admirersResolved.filter((p) => p.gender === "male").length
    const femaleFriends = admirersResolved.filter((p) => p.gender === "female").length
    const helloCount = sentLogs.filter((e) => e.type === "chat" && /привет/i.test(e.text)).length
    const roseOnValentine = (rosesGiven ?? []).filter((r) => {
      if (r.fromPlayerId !== uid) return false
      const d = new Date(r.timestamp)
      return d.getMonth() === 1 && d.getDate() === 14
    }).length
    const sentKissByFairy = currentFrameId === "fairy" ? countSent("kiss") : 0

    const mk = (current: number, target: number, known = true) => ({ current, target, known })
    return {
      "Любитель кваса": mk(countSent("beer"), 1),
      "Заквасочник": mk(countSent("tools"), 1),
      "Мастер закваски": mk(maxStreakForTypes(new Set(["beer", "cocktail"])), 40),
      "Душа стола": mk(maxStreakForTypes(new Set(["beer"])), 20),
      "Любитель отдыха": mk(countSent("banya"), 10),
      "Транжира": mk(countSent("diamond"), 20),
      "Бонжур": mk(countSent("song"), 1),
      "Пушистость": mk(recvSoft, 10),
      "Чайная церемония": mk(countSent("gift_voice"), 1),
      "Утренник": mk(sentToys, 6),
      "Фермер": mk(currentFrameId === "vesna" ? 1 : 0, 1),
      "Душа компании": mk(countRecv("beer"), 100, currentUser.gender === "male"),
      "Подручная": mk(countRecv("cocktail"), 100, currentUser.gender === "female"),
      "8 марта": mk(recvFlowers, 100, currentUser.gender === "female"),
      "Одиночка": mk(countRecv("kiss") === 0 ? 1 : 0, 1),
      "Ювелир": mk(countSent("diamond"), 300),
      "Мужская дружба": mk(maleFriends, 20),
      "Женская дружба": mk(femaleFriends, 20),
      "Новый год": mk(sentSeasonal, 1),
      "Пират": mk(0, 30, false),
      "Принц": mk(0, 50, false),
      "Принцесса": mk(0, 200, false),
      "Закваска": mk(0, 10, false),
      "Снежный бой": mk(0, 300, false),
      "Сладкоежка": mk(recvSweets, 20),
      "Сердцеед (ка)": mk(voiceBalance, 500),
      "Купидон (ка)": mk(rosesSent, 100),
      "Маг": mk(currentFrameId === "mag" ? 1 : 0, 10),
      "Помощь новичкам": mk(sentGiftCount, 50),
      "Дедушка Мороз": mk(sentSeasonal, 300),
      "Турист": mk(0, 3, false),
      "Фея": mk(sentKissByFairy, 300),
      "Первый парень": mk(0, 3, false),
      "Первая леди": mk(0, 3, false),
      "Дружбанио": mk(countSent("invite"), 10),
      "Экстрасенс": mk(ugadaikaRoundsWon ?? 0, 10),
      "Культурный игрок": mk(helloCount, 20),
      "Ведьмак (Ведьма)": mk(0, 5, false),
      "Валентин": mk(roseOnValentine, 100),
      "Дачник": mk(0, 20, false),
      "Снегурочка": mk(0, 2, false),
    } as Record<string, { current: number; target: number; known: boolean }>
  }, [currentUser?.id, currentUser?.gender, gameLog, inventory, rosesGiven, admirersResolved, ugadaikaRoundsWon, voiceBalance, currentFrameId])

  const achievementStatusDelta = useMemo(() => {
    const baseDone =
      (heartbreakerCount >= 100 ? 1 : 0) +
      (giftSpent >= 1000 ? 1 : 0) +
      (spinCount >= 50 ? 1 : 0)
    const eventsDone = [
      "Любитель кваса",
      "Заквасочник",
      "Мастер закваски",
      "Душа стола",
      "Любитель отдыха",
      "Транжира",
      "Бонжур",
      "Пушистость",
      "Чайная церемония",
      "Утренник",
      "Фермер",
      "Душа компании",
      "Подручная",
      "8 марта",
      "Одиночка",
      "Ювелир",
      "Мужская дружба",
      "Женская дружба",
      "Новый год",
      "Пират",
      "Принц",
      "Принцесса",
      "Закваска",
      "Снежный бой",
      "Сладкоежка",
      "Сердцеед (ка)",
      "Купидон (ка)",
      "Маг",
      "Помощь новичкам",
      "Дедушка Мороз",
      "Турист",
      "Фея",
      "Первый парень",
      "Первая леди",
      "Дружбанио",
      "Экстрасенс",
      "Культурный игрок",
      "Ведьмак (Ведьма)",
      "Валентин",
      "Дачник",
      "Снегурочка",
    ].reduce((sum, key) => {
      const stat = achievementStats[key]
      if (!stat || !stat.known) return sum
      return sum + (stat.current >= stat.target ? 1 : 0)
    }, 0)
    return baseDone + eventsDone
  }, [achievementStats, heartbreakerCount, giftSpent, spinCount])

  if (!currentUser) return null

  const myPlayer = players.find((p) => p.id === currentUser.id)
  const isVip = !!myPlayer?.isVip && (myPlayer.vipUntilTs == null || myPlayer.vipUntilTs > Date.now())
  const initialName = useMemo(() => currentUser.name ?? "", [currentUser.name])
  const initialStatus = useMemo(() => (currentUser.status ?? "").slice(0, 15), [currentUser.status])
  const [name, setName] = useState(initialName)
  const [status, setStatus] = useState(initialStatus)
  const [avatarInput, setAvatarInput] = useState(currentUser.avatar ?? "")
  const [showGiveRoseModal, setShowGiveRoseModal] = useState(false)
  const [showFramesModal, setShowFramesModal] = useState(false)
  const [profileDailyLevel, setProfileDailyLevel] = useState(1)
  const [profileTab, setProfileTab] = useState<"profile" | "achievements">("profile")
  const [showReceivedOnly, setShowReceivedOnly] = useState(false)
  const [achievementPostTemplates, setAchievementPostTemplates] = useState<AchievementPostTemplateRow[]>([])
  const [manualPublishKeys, setManualPublishKeys] = useState<Record<string, true>>({})
  /** В модалке рамок: наведение на карточку — крупное превью; иначе показываем текущую рамку */
  const [frameHoverPreviewId, setFrameHoverPreviewId] = useState<string | null>(null)
  /** Анимация «как за столом» после успешной отправки розы */
  const [roseGiftFx, setRoseGiftFx] = useState(false)
  const [vkNotifyBusy, setVkNotifyBusy] = useState(false)
  const roseGiftFxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toast, showToast } = useInlineToast(1700)
  const nameTrimmed = name.trim()
  const statusTrimmed = status.trim().slice(0, 15)
  const canSaveName = nameTrimmed.length >= 2 && nameTrimmed.length <= 16 && nameTrimmed !== currentUser.name
  const canSaveStatus = statusTrimmed !== (currentUser.status ?? "")
  const canChangeAvatar = currentUser.authProvider === "login" && avatarInput.trim().length > 0 && avatarInput !== currentUser.avatar
  const sectionCardClass =
    "rounded-3xl border border-slate-200/85 bg-gradient-to-b from-white to-slate-50 px-4 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.85)]"
  const secondaryBtnClass =
    "rounded-2xl border border-slate-200 bg-white text-[15px] font-extrabold text-slate-900 shadow-[0_6px_14px_rgba(15,23,42,0.10),inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:bg-slate-50 active:translate-y-px active:shadow-[0_3px_8px_rgba(15,23,42,0.10)] disabled:opacity-55"
  const valueTextClass = "text-[15px] font-black text-slate-900"
  const templateByKey = useMemo(() => {
    const map = new Map<string, AchievementPostTemplateRow>()
    for (const row of achievementPostTemplates) map.set(row.achievementKey, row)
    return map
  }, [achievementPostTemplates])

  useEffect(() => {
    setName(initialName)
  }, [initialName])

  useEffect(() => {
    setStatus(initialStatus)
  }, [initialStatus])

  useEffect(() => {
    if (showFramesModal) setFrameHoverPreviewId(null)
  }, [showFramesModal])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch("/api/catalog/achievement-posts", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; rows?: unknown } | null
        if (!res.ok || data?.ok !== true || !Array.isArray(data.rows) || cancelled) return
        const rows = data.rows
          .map((row) => {
            if (!row || typeof row !== "object") return null
            const x = row as Partial<AchievementPostTemplateRow>
            if (typeof x.achievementKey !== "string" || !x.achievementKey) return null
            if (typeof x.title !== "string") return null
            return {
              achievementKey: x.achievementKey,
              title: x.title,
              imageUrl: typeof x.imageUrl === "string" ? x.imageUrl : "",
              postTextTemplate: typeof x.postTextTemplate === "string" ? x.postTextTemplate : "",
              vkEnabled: x.vkEnabled === true,
              published: x.published === true,
            } satisfies AchievementPostTemplateRow
          })
          .filter((x): x is AchievementPostTemplateRow => x != null)
        setAchievementPostTemplates(rows)
      } catch {
        // optional content
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!currentUser) {
      setProfileDailyLevel(1)
      return
    }
    try {
      const key = `botl_daily_level_v1_${currentUser.id}`
      const raw = localStorage.getItem(key)
      const parsed = raw ? (JSON.parse(raw) as { points?: number }) : null
      const points = typeof parsed?.points === "number" ? Math.max(0, parsed.points) : 0
      setProfileDailyLevel(getDailyLevelByPoints(points))
    } catch {
      setProfileDailyLevel(1)
    }
  }, [currentUser])

  useEffect(() => {
    return () => {
      if (roseGiftFxTimeoutRef.current) clearTimeout(roseGiftFxTimeoutRef.current)
    }
  }, [])

  const triggerRoseGiftFx = () => {
    if (roseGiftFxTimeoutRef.current) clearTimeout(roseGiftFxTimeoutRef.current)
    setRoseGiftFx(true)
    roseGiftFxTimeoutRef.current = setTimeout(() => {
      setRoseGiftFx(false)
      roseGiftFxTimeoutRef.current = null
    }, 2600)
  }

  const displayFrameId = frameHoverPreviewId ?? currentFrameId
  const previewFrameMeta =
    PROFILE_FRAMES.find((x) => x.id === displayFrameId) ??
    PROFILE_FRAMES[0] ?? {
      id: "none",
      label: "Без рамки",
      border: "2px solid #475569",
      shadow: "none",
      animationClass: undefined,
      svgPath: undefined,
      cost: 0,
      section: "free" as const,
    }

  const handleSaveName = () => {
    if (!canSaveName) return
    dispatch({ type: "UPDATE_USER_NAME", playerId: currentUser.id, name: nameTrimmed })
    showToast("Имя сохранено", "success")
  }

  const saveStatus = async (nextStatus: string, successMessage = "Статус обновлен") => {
    const normalized = nextStatus.trim().slice(0, 15)
    dispatch({ type: "UPDATE_USER_STATUS", playerId: currentUser.id, status: normalized })
    setStatus(normalized)
    try {
      await apiFetch("/api/user/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: normalized }),
      })
      showToast(successMessage, "success")
    } catch {
      showToast("Статус обновлен локально", "info")
    }
  }

  const handleSaveStatus = async () => {
    if (!canSaveStatus) return
    await saveStatus(statusTrimmed)
  }

  const handlePublishAchievementPost = async (achievementKey: string, title: string) => {
    const template = templateByKey.get(achievementKey)
    if (!template || !template.vkEnabled || !template.published) {
      showToast("Шаблон VK для этого достижения отключён", "info")
      return false
    }
    const gameUrl = typeof window !== "undefined" ? window.location.origin : "https://vk.com/app54511363"
    const message = formatAchievementPostText({
      template: template.postTextTemplate,
      playerName: currentUser.name,
      achievementTitle: title,
      gameUrl,
    })
    const posted = await vkBridge.showVkWallPostConfirm({
      message,
      imageUrl: template.imageUrl || undefined,
      gameUrl,
    })
    if (posted.ok) {
      setManualPublishKeys((prev) => {
        const next = { ...prev }
        delete next[achievementKey]
        return next
      })
      showToast("Открыт пост на стену VK", "info")
      return true
    }
    setManualPublishKeys((prev) => ({ ...prev, [achievementKey]: true }))
    showToast("Автопубликация недоступна — используйте кнопку «Публикация»", "info")
    return false
  }

  const handleClaimAchievementStatus = async (achievementKey: string, title: string) => {
    const claimedStatus = getAchievementStatusByKey(achievementKey, title)
    await saveStatus(claimedStatus, "Статус получен")
    void handlePublishAchievementPost(achievementKey, title)
  }

  const handleClearStatus = async () => {
    if (!currentUser.status && !statusTrimmed) return
    setStatus("")
    dispatch({ type: "UPDATE_USER_STATUS", playerId: currentUser.id, status: "" })
    try {
      await apiFetch("/api/user/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "" }),
      })
    } catch {
      // ignore network failure: local state already cleared
    }
    showToast("Статус удален", "success")
  }

  const isPanel = variant === "panel"

  const handleInviteFriends = async () => {
    if (!vkBridge.isVkMiniApp()) {
      showToast("Доступно только в VK", "error")
      return
    }
    const ok = await vkBridge.inviteFriends()
    if (ok) {
      showToast("Приглашение отправлено", "info")
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "invite" as GameLogEntry["type"],
          fromPlayer: currentUser ?? undefined,
          text: `${currentUser?.name ?? "Игрок"} пригласил друзей`,
          timestamp: Date.now(),
        },
      })
    } else {
      showToast("Не удалось отправить приглашение", "error")
    }
  }

  const handleSelectFriends = async () => {
    if (!vkBridge.isVkMiniApp()) {
      showToast("Доступно только в VK", "error")
      return
    }
    const friends = await vkBridge.getFriends()
    if (friends.length > 0) {
      showToast(`Выбрано ${friends.length} друзей`, "info")
    }
  }

  const handleRecommend = async () => {
    if (!vkBridge.isVkMiniApp()) {
      showToast("Доступно только в VK", "error")
      return
    }
    const outcome = await vkBridge.shareGameInvite()
    if (outcome === "fail") {
      showToast("Не удалось поделиться", "error")
      return
    }
    if (outcome === "ok_recommend") {
      showToast("Открыто окно ВК", "info")
      return
    }
    showToast("Текст скопирован — вставьте в сообщение при отправке", "info")
  }

  const renderProfileFields = () => (
    <>
        <div className={`${sectionCardClass} p-2`}>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200">
            <button
              type="button"
              onClick={() => setProfileTab("profile")}
              className={`rounded-xl px-3 py-2 text-[15px] font-black transition ${
                profileTab === "profile" ? "bg-white text-slate-900 shadow" : "text-slate-600 hover:bg-white/70"
              }`}
              aria-pressed={profileTab === "profile"}
            >
              Профиль
            </button>
            <button
              type="button"
              onClick={() => setProfileTab("achievements")}
              className={`relative rounded-xl px-3 py-2 text-[15px] font-black transition ${
                profileTab === "achievements" ? "bg-white text-slate-900 shadow" : "text-slate-600 hover:bg-white/70"
              }`}
              aria-pressed={profileTab === "achievements"}
            >
              {achievementStatusDelta > 0 && (
                <span
                  className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-black leading-none text-emerald-700 shadow-[0_4px_10px_rgba(16,185,129,0.2)]"
                  aria-hidden
                >
                  +{achievementStatusDelta}
                </span>
              )}
              Достижения
            </button>
          </div>
        </div>

      {profileTab === "profile" && (
      <>
        {/* Карточка профиля: аватар + имя + фото (login) */}
        <div className={`${sectionCardClass} space-y-4`}>
          <p className="text-[15px] font-black tracking-tight text-slate-900">Ваш профиль</p>
          <div className="flex flex-col items-stretch gap-6 sm:flex-row sm:items-start">
            {/* Слева: аватар + возраст / пол */}
            <div className="flex shrink-0 flex-col items-center gap-2.5 sm:items-start">
              <div className="relative h-[5.5rem] w-[5.5rem] overflow-visible sm:h-24 sm:w-24">
                {roseGiftFx && (
                  <>
                    <div
                      className="profile-rose-gift-target-ring pointer-events-none absolute inset-[-6px] z-[14] rounded-full"
                      aria-hidden
                    />
                    <span
                      className="profile-rose-gift-fly-emoji pointer-events-none absolute left-1/2 top-1/2 z-[24] text-[2.75rem] drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)] sm:text-[3rem]"
                      aria-hidden
                    >
                      {"\uD83C\uDF39"}
                    </span>
                    <div
                      className="pointer-events-none absolute left-1/2 top-1/2 z-[13] -translate-x-1/2 -translate-y-1/2"
                      style={{ width: 0, height: 0 }}
                      aria-hidden
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                        const angleDeg = i * 45
                        const roseSize = 8
                        const radius = 34
                        return (
                          <div
                            key={i}
                            className="absolute left-0 top-0 inline-flex items-center justify-center"
                            style={{
                              width: roseSize * 2,
                              height: roseSize * 2,
                              marginLeft: -roseSize,
                              marginTop: -roseSize,
                              transform: `rotate(${angleDeg}deg) translateY(-${radius}px)`,
                            }}
                          >
                            <span
                              className="profile-rose-gift-burst-petal inline-block text-sm leading-none"
                              style={{ animationDelay: `${i * 0.07}s` }}
                            >
                              {"\uD83C\uDF39"}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
                <PlayerAvatar player={currentUser} frameId={currentFrameId} size={88} hideNameLabel />
                {isVip && (
                  <div
                    className="absolute z-[26] flex items-center justify-center rounded-full"
                    style={{
                      width: 24,
                      height: 24,
                      background: "linear-gradient(135deg,#facc15,#f97316)",
                      color: "#111827",
                      border: "2px solid #a15c10",
                      top: -2,
                      right: -2,
                      boxShadow: "0 0 10px rgba(250,204,21,0.9)",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 18h16l-1.5-7.5-3.5 3-3-6.5-3 6.5-3.5-3L4 18z" fill="#111827" />
                    </svg>
                  </div>
                )}
                <div
                  className="absolute z-[25] flex items-center justify-center rounded-full"
                  style={{
                    width: 28,
                    height: 28,
                    background: "linear-gradient(135deg, rgba(14,116,144,0.95) 0%, rgba(67,56,202,0.95) 100%)",
                    border: "1px solid rgba(125,211,252,0.65)",
                    boxShadow: "0 4px 14px rgba(14,116,144,0.25), inset 0 1px 0 rgba(255,255,255,0.12)",
                    right: -6,
                    bottom: -6,
                  }}
                  aria-label={`Уровень: ${profileDailyLevel}`}
                >
                  <span className="text-[15px] font-black tabular-nums leading-none text-white">{profileDailyLevel}</span>
                </div>
              </div>
              <p className="max-w-[9rem] text-center text-[15px] font-semibold leading-snug text-slate-700 sm:max-w-none sm:text-left">
                {currentUser.age} лет <span className="text-slate-600">·</span> {genderLabel(currentUser.gender)}
              </p>
            </div>

            {/* Справа: заголовок → поле → кнопка (вертикально) */}
            <div className="min-w-0 w-full flex-1 space-y-3">
              <div className="flex flex-col gap-2">
                <label htmlFor="profile-name" className="text-[15px] font-extrabold tracking-tight text-slate-800">
                  Имя в игре
                </label>
                <input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={16}
                  className="h-11 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3.5 text-[15px] font-semibold text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] outline-none ring-0 transition-colors focus:border-sky-400/70 focus:ring-2 focus:ring-sky-300/30"
                  placeholder="Как вас видят за столом"
                  autoComplete="nickname"
                />
                <Button
                  onClick={handleSaveName}
                  disabled={!canSaveName}
                  className="h-11 w-full shrink-0 rounded-2xl px-4 text-[15px] font-black disabled:!opacity-100 sm:w-auto sm:self-start"
                  style={
                    canSaveName
                      ? {
                          background: "linear-gradient(135deg,#38bdf8,#a78bfa)",
                          color: "#0b1220",
                          border: "1px solid rgba(56,189,248,0.45)",
                          boxShadow: "0 0 0 1px rgba(255,255,255,0.08) inset",
                        }
                      : {
                          background: "linear-gradient(180deg, rgba(71,85,105,0.95) 0%, rgba(51,65,85,0.98) 100%)",
                          color: "#e2e8f0",
                          border: "1px solid rgba(148,163,184,0.55)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
                        }
                  }
                >
                  Сохранить имя
                </Button>
              </div>

              {currentUser.authProvider === "login" && (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <label htmlFor="profile-avatar-url" className="text-[15px] font-extrabold tracking-tight text-slate-800">
                    Фото (URL)
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      id="profile-avatar-url"
                      type="text"
                      value={avatarInput}
                      onChange={(e) => setAvatarInput(e.target.value)}
                      placeholder="https://…"
                      className="h-10 min-h-0 w-full flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-[15px] text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-300/30"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!canChangeAvatar) return
                        dispatch({ type: "UPDATE_USER_AVATAR", playerId: currentUser.id, avatar: avatarInput.trim() })
                        showToast("Фото обновлено", "success")
                      }}
                      disabled={!canChangeAvatar}
                      className="h-10 w-full shrink-0 rounded-2xl px-4 text-[15px] font-black disabled:opacity-45 sm:w-auto"
                      style={{
                        background: canChangeAvatar ? "linear-gradient(135deg,#38bdf8,#a78bfa)" : "rgba(51,65,85,0.6)",
                        color: "#0b1220",
                        border: "1px solid rgba(148,163,184,0.35)",
                      }}
                    >
                      Обновить фото
                    </Button>
                  </div>
                  <p className="text-[15px] font-medium leading-relaxed text-slate-700">
                    Аватар по ссылке; позже загрузка на сервер.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`${sectionCardClass} space-y-3`}>
          <p className="text-[15px] font-black tracking-tight text-slate-900">Статус</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id="profile-status"
              value={status}
              onChange={(e) => setStatus(e.target.value.slice(0, 15))}
              maxLength={15}
              className="h-14 w-full min-w-0 rounded-[1.85rem] border border-slate-200 bg-white px-7 text-[15px] font-semibold text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] outline-none ring-0 transition-colors focus:border-slate-300 focus:ring-0"
              placeholder="Ищу тебя"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={handleSaveStatus}
              disabled={!canSaveStatus}
              title={canSaveStatus ? "Сохранить статус" : "Нет изменений для сохранения"}
              className={cn(
                "h-14 w-full shrink-0 rounded-[1.85rem] px-8 text-[15px] font-black transition-[transform,filter,box-shadow,opacity,background-color] sm:min-w-[5.5rem] sm:w-auto",
                canSaveStatus
                  ? "cursor-pointer border-2 border-sky-700/90 bg-gradient-to-b from-sky-400 via-sky-500 to-blue-700 text-white shadow-[0_5px_0_rgba(15,23,42,0.42),inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-110 hover:shadow-[0_6px_0_rgba(15,23,42,0.42)] active:translate-y-[3px] active:shadow-[0_2px_0_rgba(15,23,42,0.38)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/45"
                  : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 shadow-none opacity-75",
              )}
            >
              ОК
            </button>
            <button
              type="button"
              onClick={handleClearStatus}
              aria-label="Удалить статус"
              className="inline-flex h-14 w-full items-center justify-center rounded-[1.85rem] border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 sm:w-14"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Поклонники — наполняется кнопкой «Стать поклонником» в профиле игрока за столом */}
        <div className={`${sectionCardClass} space-y-3`}>
          <p className="text-[15px] font-black tracking-tight text-slate-900">Твои поклонники</p>
          {admirersResolved.length === 0 ? (
            <p className="text-[15px] font-medium leading-relaxed text-slate-700">
              Пока никого. Когда кто-то за вами поухаживает — он появится здесь.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {admirersResolved.map((p) => (
                <li key={p.id} className="relative flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "OPEN_SIDE_CHAT", player: p })}
                    className="group flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-[0_6px_14px_rgba(15,23,42,0.10)] transition hover:bg-slate-50"
                  >
                    {p.avatar ? (
                      <img
                        src={p.avatar}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[15px] font-black text-slate-800 ring-1 ring-slate-200">
                        {(p.name || "?").slice(0, 1)}
                      </span>
                    )}
                    <span className="max-w-[56px] truncate text-[15px] font-bold text-slate-900">{p.name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Убрать ${p.name} из поклонников`}
                    onClick={() => dispatch({ type: "REMOVE_ADMIRER", playerId: p.id })}
                    className="absolute -right-1 -top-1 rounded-full bg-white p-0.5 text-slate-500 shadow-[0_6px_14px_rgba(15,23,42,0.12)] transition-colors hover:bg-slate-50 hover:text-slate-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Приглашение друзей в игру (VK) */}
        <div className={`${sectionCardClass} space-y-3`}>
          <p className="text-[15px] font-black tracking-tight text-slate-900">Сообщество</p>
          <div className="flex flex-col gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-[0_10px_18px_rgba(37,99,235,0.22),inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/70"
                aria-hidden
              >
                <Users className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-slate-900">Добавить друзей</p>
                <p className="text-[15px] font-medium leading-relaxed text-slate-700">Пригласите в игру — веселее вместе</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className={`w-full px-3 ${secondaryBtnClass}`}
                onClick={handleInviteFriends}
              >
                Пригласить
              </Button>
              <Button
                type="button"
                variant="outline"
                className={`w-full px-3 ${secondaryBtnClass}`}
                onClick={handleSelectFriends}
              >
                Найти друзей
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className={`w-full px-5 text-xs ${secondaryBtnClass}`}
              onClick={handleRecommend}
            >
              Рассказать про игру
            </Button>
          </div>
        </div>

        {/* Быстрые настройки */}
        <div className={`${sectionCardClass} space-y-2`}>
          <p className="text-[15px] font-black tracking-tight text-slate-900">Настройки</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowFramesModal(true)}
              className={`flex w-full items-center justify-center gap-2 px-4 py-3 ${secondaryBtnClass}`}
            >
              <Sparkles className="h-4 w-4 text-amber-400/90" aria-hidden />
              Рамки аватара
            </button>
            <button
              type="button"
              onClick={() => {
                const nextEnabled = soundsEnabled === false
                dispatch({ type: "SET_SOUNDS_ENABLED", enabled: nextEnabled })
                showToast(nextEnabled ? "Звуки включены" : "Звуки отключены", "success")
              }}
              className={`flex w-full items-center justify-center gap-2 px-4 py-3 ${secondaryBtnClass}`}
            >
              {soundsEnabled === false ? (
                <>
                  <VolumeX className="h-4 w-4 text-slate-300" />
                  Включить звуки
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 text-slate-300" />
                  Отключить звуки
                </>
              )}
            </button>
            {currentUser.authProvider === "vk" && vkBridge.isVkMiniApp() && (
              <>
                <button
                  type="button"
                  disabled={vkNotifyBusy}
                  onClick={async () => {
                    setVkNotifyBusy(true)
                    try {
                      const { ok } = await vkBridge.requestVkAllowNotifications()
                      showToast(
                        ok
                          ? "Если вы согласились в окне ВК, уведомления от игры включены"
                          : "Не удалось открыть запрос разрешения (попробуйте позже)",
                        ok ? "success" : "info",
                      )
                    } finally {
                      setVkNotifyBusy(false)
                    }
                  }}
                  className={`flex w-full items-center justify-center gap-2 px-4 py-3 ${secondaryBtnClass}`}
                >
                  <Bell className="h-4 w-4 text-amber-500" aria-hidden />
                  Уведомления ВКонтакте
                </button>
                <p className="px-0.5 text-center text-[13px] font-medium leading-snug text-slate-600">
                  Push от ВК (приглашения в чат и др.). Нужен сервисный ключ на сервере и согласие в диалоге.
                </p>
              </>
            )}
          </div>
        </div>
      </>
      )}

        {profileTab === "achievements" && (
        <>
        {/* Достижения — отдельный акцентный блок: цель → счётчик → полоса */}
        <section
          className={`${sectionCardClass}`}
          aria-labelledby="achievements-heading"
        >
          <div className="mb-4 flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-200 to-orange-300 shadow-[0_10px_18px_rgba(217,119,6,0.18),inset_0_1px_0_rgba(255,255,255,0.55)]"
              aria-hidden
            >
              <Sparkles className="h-5 w-5 text-amber-900" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="achievements-heading" className="text-lg font-black tracking-tight text-slate-900">
                Достижения
              </h2>
              <p className="mt-1 text-[15px] font-medium leading-snug text-slate-700">
                Накопительный прогресс по игре: поцелуи, траты на подарки и кручения бутылочки.
              </p>
            </div>
          </div>
          <ul className="flex flex-col gap-3">
            {(
              [
                {
                  achievementKey: "base_heartbreaker",
                  key: "heartbreaker",
                  label: "Сердцеед",
                  hint: "поцелуи в игре",
                  current: heartbreakerCount,
                  target: 100,
                  fillClass: "bg-gradient-to-r from-rose-500 to-pink-400",
                  done: heartbreakerCount >= 100,
                },
                {
                  achievementKey: "base_generous",
                  key: "generous",
                  label: "Щедрый",
                  hint: "потрачено ❤ на подарки",
                  current: giftSpent,
                  target: 1000,
                  fillClass: "bg-gradient-to-r from-amber-500 to-yellow-400",
                  done: giftSpent >= 1000,
                },
                {
                  achievementKey: "base_soul",
                  key: "soul",
                  label: "Душа компании",
                  hint: "раз крутили бутылочку",
                  current: spinCount,
                  target: 50,
                  fillClass: "bg-gradient-to-r from-emerald-500 to-teal-400",
                  done: spinCount >= 50,
                },
              ] as const
            ).map((row) => {
              const shown = Math.min(row.current, row.target)
              const pct = row.target > 0 ? Math.min(100, (shown / row.target) * 100) : 0
              return (
                <li
                  key={row.key}
                  className={
                    "rounded-xl border px-3.5 py-3 transition-colors " +
                    (row.done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-white")
                  }
                >
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-base font-black text-slate-900">{row.label}</span>
                      <span className="mt-1 block text-[15px] font-medium text-slate-700">{row.hint}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={
                          "tabular-nums text-[15px] font-bold " +
                          (row.done ? "text-emerald-700" : "text-slate-600")
                        }
                        title={`${shown} из ${row.target}`}
                      >
                        {shown}/{row.target}
                      </span>
                      {row.done && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleClaimAchievementStatus(row.achievementKey, row.label)}
                            className="rounded-lg border border-cyan-300 bg-cyan-50 px-2 py-1 text-xs font-black text-cyan-700 transition hover:bg-cyan-100"
                          >
                            Получить статус
                          </button>
                          <button
                            type="button"
                            onClick={() => void handlePublishAchievementPost(row.achievementKey, row.label)}
                            className="rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700 transition hover:bg-indigo-100"
                          >
                            Публикация
                          </button>
                          {manualPublishKeys[row.achievementKey] && (
                            <button
                              type="button"
                              onClick={() => setManualPublishKeys((prev) => {
                                const next = { ...prev }
                                delete next[row.achievementKey]
                                return next
                              })}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                            >
                              Удалить
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-200"
                    role="progressbar"
                    aria-valuenow={shown}
                    aria-valuemin={0}
                    aria-valuemax={row.target}
                    aria-label={`${row.label}: ${shown} из ${row.target}`}
                  >
                    <div
                      className={
                        "h-full rounded-full transition-[width] duration-500 ease-out " +
                        (pct > 0 ? row.fillClass : "bg-transparent")
                      }
                      style={{ width: `${pct}%`, minWidth: pct > 0 ? "2px" : undefined }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-lg font-black tracking-tight text-slate-900">Рейтинги и ивенты</p>
              <button
                type="button"
                onClick={() => setShowReceivedOnly((v) => !v)}
                className={`rounded-xl border px-3 py-1.5 text-[15px] font-black transition ${
                  showReceivedOnly
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                aria-pressed={showReceivedOnly}
              >
                Получено
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {(
                ACHIEVEMENT_POST_CATALOG.filter((x) => x.group === "events")
              )
                .map(({ key, title, hint }) => {
                  const stat = achievementStats[title]
                  const current = stat?.current ?? 0
                  const target = stat?.target ?? 1
                  const known = stat?.known ?? false
                  const progressPct = Math.max(0, Math.min(100, Math.round((current / Math.max(1, target)) * 100)))
                  return { key, title, hint, progressPct, done: progressPct >= 100, known, current, target }
                })
                .filter((row) => (showReceivedOnly ? row.done : true))
                .map(({ key, title, hint, progressPct, known, current, target, done }) => {
                return (
                  <li key={key} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                        {/* Placeholder: сюда можно подставить картинку достижения */}
                        <div className="flex h-full w-full items-center justify-center text-[15px] font-black text-slate-500">+</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[15px] font-black text-slate-900">{title}</p>
                          {done && (
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handleClaimAchievementStatus(key, title)}
                                className="rounded-lg border border-cyan-300 bg-cyan-50 px-2 py-1 text-xs font-black text-cyan-700 transition hover:bg-cyan-100"
                              >
                                Получить статус
                              </button>
                              <button
                                type="button"
                                onClick={() => void handlePublishAchievementPost(key, title)}
                                className="rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700 transition hover:bg-indigo-100"
                              >
                                Публикация
                              </button>
                              {manualPublishKeys[key] && (
                                <button
                                  type="button"
                                  onClick={() => setManualPublishKeys((prev) => {
                                    const next = { ...prev }
                                    delete next[key]
                                    return next
                                  })}
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                                >
                                  Удалить
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="mt-0.5 text-[15px] font-medium text-slate-700">{hint}</p>
                        <p className="mt-1 text-[13px] font-semibold text-slate-500">
                          {known ? `${current}/${target}` : "нет данных"}
                        </p>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-200">
                          <div
                            className={`h-full rounded-full transition-[width] duration-300 ${
                              known ? "bg-gradient-to-r from-cyan-500 to-blue-500" : "bg-slate-300"
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                  )
                })}
            </ul>
            {showReceivedOnly && (
              <p className="text-[15px] font-medium text-slate-600">Здесь будут только полученные достижения.</p>
            )}
          </div>
        </section>
        </>
        )}

      {profileTab === "profile" && (
      <>
        <div className={`${sectionCardClass} overflow-hidden p-0`}>
          <p className="border-b border-slate-200 px-4 py-3 text-[15px] font-black tracking-tight text-slate-900">
            Баланс
          </p>
          <div className="grid grid-cols-3 divide-x divide-slate-200">
            <div className="flex flex-col items-center justify-center gap-2 px-2 py-4 text-center sm:py-5">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl sm:h-12 sm:w-12"
                style={{
                  background: "rgba(249, 115, 22, 0.12)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
                }}
              >
                <Heart className="h-5 w-5 text-orange-400 sm:h-6 sm:w-6" fill="currentColor" strokeWidth={0} aria-hidden />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-slate-700">
                Сердца
              </span>
              <span className="text-[1.35rem] font-black tabular-nums leading-none text-slate-900 tracking-tight sm:text-2xl">
                {voiceBalance}
              </span>
              <span className="text-[9px] leading-tight text-slate-600">основная валюта</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 px-2 py-4 text-center sm:py-5">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl sm:h-12 sm:w-12"
                style={{
                  background: "rgba(52, 211, 153, 0.1)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
                }}
              >
                <Trophy className="h-5 w-5 text-emerald-400 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-slate-700">
                Бонусы
              </span>
              <span className="text-[1.35rem] font-black tabular-nums leading-none text-slate-900 tracking-tight sm:text-2xl">
                {bonusBalance}
              </span>
              <span className="text-[9px] leading-tight text-slate-600">награды</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 px-2 py-4 text-center sm:py-5">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl sm:h-12 sm:w-12"
                style={{
                  background: "rgba(244, 63, 94, 0.1)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)",
                }}
              >
                <Flower2 className="h-5 w-5 text-rose-400 sm:h-6 sm:w-6" strokeWidth={2} aria-hidden />
              </div>
              <span className="text-[15px] font-bold tracking-tight text-slate-700">
                Розы
              </span>
              <span className="text-[1.35rem] font-black tabular-nums leading-none text-slate-900 tracking-tight sm:text-2xl">
                {rosesBalance}
              </span>
              <span className="text-[9px] leading-tight text-slate-600">в инвентаре</span>
            </div>
          </div>
        </div>

        <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${sectionCardClass}`}>
          <div>
            <div className="text-[15px] font-bold text-slate-700">{"Получено роз"}</div>
            <div className={valueTextClass}>{rosesReceived}</div>
          </div>
          <Button
            size="sm"
            className="shrink-0 rounded-2xl text-[15px] font-black"
            style={{
              background: voiceBalance >= 50 ? "linear-gradient(180deg, #e11d48 0%, #be123c 100%)" : undefined,
              border: "1px solid rgba(225,29,72,0.5)",
              color: "#fff",
            }}
            variant={voiceBalance < 50 ? "outline" : "default"}
            disabled={voiceBalance < 50}
            onClick={() => setShowGiveRoseModal(true)}
          >
            Подарить розу — <span className="heart-price heart-price--compact text-amber-100">50 ❤</span>
          </Button>
        </div>
        {hasTrueFeelingsAchievement && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2">
            <span className="text-lg">🌹</span>
            <span className="text-[15px] font-black text-rose-700">{"Настоящие чувства"}</span>
            <span className="text-[15px] font-medium text-slate-700">— подарили 10 роз одному игроку</span>
          </div>
        )}

        <label className={`flex cursor-pointer items-center gap-3 ${sectionCardClass}`}>
          <input
            type="checkbox"
            checked={effectiveShowVkAfterCare(currentUser, courtshipProfileAllowed)}
            onChange={(e) =>
              dispatch({
                type: "SET_COURTSHIP_PROFILE_ALLOWED",
                playerId: currentUser.id,
                allowed: e.target.checked,
              })
            }
            className="h-4 w-4 rounded border-slate-300 accent-amber-500 transition-transform duration-200 checked:scale-110"
          />
          <span className="text-[15px] font-bold text-slate-900">
            {"Разрешаю ухаживание"}
          </span>
        </label>
        <p className="-mt-2 text-[15px] font-medium text-slate-700">
          {effectiveShowVkAfterCare(currentUser, courtshipProfileAllowed)
            ? "Кто нажал «Ухаживание» — увидит ссылку на ваш профиль ВК."
            : "Кто нажал «Ухаживание» — сможет написать вам личное сообщение в игре."}
        </p>

        <label className={`flex cursor-pointer items-center gap-3 ${sectionCardClass}`}>
          <input
            type="checkbox"
            checked={effectiveOpenToChatInvites(currentUser, allowChatInvite)}
            onChange={(e) =>
              dispatch({
                type: "SET_ALLOW_CHAT_INVITE",
                playerId: currentUser.id,
                allowed: e.target.checked,
              })
            }
            className="h-4 w-4 rounded border-slate-300 accent-amber-500 transition-transform duration-200 checked:scale-110"
          />
          <span className="text-[15px] font-bold text-slate-900">
            {"Общение"}
          </span>
        </label>
        <p className="-mt-2 text-[15px] font-medium text-slate-700">
          {effectiveOpenToChatInvites(currentUser, allowChatInvite)
            ? "У вас включена кнопка «Пригласить общаться» — другие могут пригласить вас в личный чат."
            : "Включите, если хотите, чтобы другие могли пригласить вас в личный чат за столом (5 сердец)."}
        </p>

      <button
        type="button"
        onClick={() => {
          if (isPanel && onClose) onClose()
          dispatch({ type: "SET_SCREEN", screen: "registration" })
        }}
        className={cn(
          "mt-4 text-[15px] font-semibold text-slate-600 transition-colors hover:text-slate-800",
          isPanel && "px-1",
        )}
      >
        {"Выйти из профиля"}
      </button>
      </>
      )}
    </>
  )

  return (
    <>
      {isPanel ? (
        <>
          {toast && <InlineToast toast={toast} />}
          <GameSidePanelShell
            title="Профиль"
            subtitle="Имя, рамка, баланс и приватность"
            onClose={onClose!}
            variant="material"
            headerRight={<span className="text-[15px] font-semibold text-slate-300 tabular-nums">ID {currentUser.id}</span>}
          >
            <div
              className={cn(
                "w-full max-w-full space-y-4 px-0 py-0",
              )}
            >
              {renderProfileFields()}
            </div>
          </GameSidePanelShell>
        </>
      ) : (
        <div className="flex h-app max-h-app flex-col items-center bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {toast && <InlineToast toast={toast} />}
          <div className="flex h-full min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden rounded-3xl border border-slate-200/85 bg-gradient-to-b from-white to-slate-50 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 px-4 py-5 sm:px-6 sm:py-7">
              <div className="sticky top-0 z-10 -mx-4 mb-1 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <h1 id="profile-page-title" className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                    Профиль
                  </h1>
                  <span className="text-[15px] font-semibold text-slate-700">ID: {currentUser.id}</span>
                </div>
              </div>
              {renderProfileFields()}
            </div>
          </div>
        </div>
      )}

      {showFramesModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          style={{ background: "rgba(2,6,23,0.76)", backdropFilter: "blur(10px)" }}
          onClick={() => setShowFramesModal(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[90dvh] min-h-0 overflow-y-auto rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-300 overscroll-contain"
            style={{
              background: "linear-gradient(165deg, rgba(15, 23, 42, 0.98) 0%, rgba(2, 6, 23, 0.98) 55%, rgba(15, 23, 42, 0.98) 100%)",
              border: "1px solid rgba(56, 189, 248, 0.28)",
              boxShadow: "0 0 0 1px rgba(56, 189, 248, 0.08), 0 25px 50px -12px rgba(0,0,0,0.55), 0 0 45px -12px rgba(56, 189, 248, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(56,189,248,0.08)_0%,transparent_50%)] pointer-events-none" aria-hidden />
            <h3 className="relative mb-4 text-xl font-black tracking-tight" style={{ color: "#e2e8f0", textShadow: "0 0 18px rgba(56, 189, 248, 0.25)" }}>
              Рамка аватарки
            </h3>

            <div
              className="relative mb-5 rounded-2xl border border-slate-600/45 bg-slate-950/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              onPointerLeave={(e) => {
                const next = e.relatedTarget as Node | null
                if (next && (e.currentTarget as HTMLElement).contains(next)) return
                setFrameHoverPreviewId(null)
              }}
            >
              <p className="mb-3 text-center text-[15px] font-black tracking-tight text-slate-200">
                Предпросмотр
              </p>
              <div className="mb-2 flex justify-center">
                <PlayerAvatar player={currentUser} frameId={displayFrameId} size={120} hideNameLabel />
              </div>
              <p className="mb-5 text-center text-[15px] font-black text-slate-100">{previewFrameMeta.label}</p>

            <p className="relative mb-3 text-[15px] font-black tracking-tight text-slate-300">
              Бесплатные
            </p>
            <div className="relative grid grid-cols-4 gap-3 mb-6">
              {FREE_FRAMES.map((f) => {
                const isSelected = currentFrameId === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onPointerEnter={() => setFrameHoverPreviewId(f.id)}
                    onClick={() => {
                      if (currentUser) dispatchAvatarFrameSynced(f.id)
                      setShowFramesModal(false)
                      showToast("Рамка применена", "success")
                    }}
                    className={`flex flex-col items-center gap-2 rounded-2xl py-3 px-2 transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:opacity-50 ${
                      isSelected ? "frame-pick-card-free--active" : "frame-pick-card-free--idle"
                    }`}
                  >
                    <div
                      className={`relative h-14 w-14 flex-shrink-0 rounded-full overflow-hidden ring-2 ring-slate-600/50 ${
                        isSelected ? "frame-pick-preview--pulse" : ""
                      }`}
                    >
                      <div
                        className={`h-full w-full rounded-full bg-slate-800 ${f.animationClass ?? ""}`}
                        style={{ border: f.border, boxShadow: f.shadow, padding: 2 }}
                      />
                      {f.svgPath && (
                        <img
                          src={resolveFrameCatalogAssetUrl(f.svgPath)}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                          aria-hidden
                        />
                      )}
                    </div>
                    <span className="text-[15px] font-semibold text-slate-200 leading-tight text-center">{f.label}</span>
                  </button>
                )
              })}
            </div>

            <p className="relative mb-3 flex items-center gap-2 text-[15px] font-black tracking-tight text-amber-300">
              <span>Премиум</span>
              <span className="text-[15px] font-black text-rose-200/95">
                {PREMIUM_FRAMES.length > 0
                  ? `${Math.min(...PREMIUM_FRAMES.map((f) => f.cost))} ❤ и выше`
                  : "цены из каталога"}
              </span>
            </p>
            <div className="relative grid grid-cols-3 gap-3">
              {PREMIUM_FRAMES.map((f) => {
                const canAfford = (voiceBalance ?? 0) >= f.cost
                const isSelected = currentFrameId === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-disabled={!canAfford}
                    onPointerEnter={() => setFrameHoverPreviewId(f.id)}
                    onClick={() => {
                      if (!currentUser) return
                      if (f.cost > 0 && (voiceBalance ?? 0) < f.cost) {
                        showToast("Недостаточно сердец для рамки", "error")
                        return
                      }
                      if (f.cost > 0) dispatch({ type: "PAY_VOICES", amount: f.cost })
                      dispatchAvatarFrameSynced(f.id)
                      setShowFramesModal(false)
                      showToast("Рамка применена", "success")
                    }}
                    className={`flex flex-col items-center gap-2 rounded-2xl py-3 px-2 transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                      !canAfford ? "cursor-not-allowed opacity-45 hover:scale-100" : ""
                    } ${isSelected ? "frame-pick-card-premium--active" : "frame-pick-card-premium--idle"}`}
                  >
                    <div
                      className={`relative h-14 w-14 flex-shrink-0 rounded-full overflow-hidden ring-2 ring-amber-500/30 ${
                        isSelected ? "frame-pick-preview--pulse" : ""
                      }`}
                    >
                      <div
                        className="h-full w-full rounded-full bg-slate-800"
                        style={{ border: f.border, boxShadow: f.shadow, padding: 2 }}
                      />
                      {f.svgPath && (
                        <img
                          src={resolveFrameCatalogAssetUrl(f.svgPath)}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                          aria-hidden
                        />
                      )}
                    </div>
                    <span className="text-[15px] font-semibold text-slate-200 leading-tight text-center">{f.label}</span>
                    <span className="heart-price heart-price--compact text-amber-200">{f.cost} ❤</span>
                  </button>
                )
              })}
            </div>
            </div>

            <Button
              variant="outline"
              className="relative mt-2 w-full rounded-2xl border text-[15px] font-black transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ borderColor: "rgba(56,189,248,0.45)", color: "#e2e8f0" }}
              onClick={() => setShowFramesModal(false)}
            >
              Закрыть
            </Button>
          </div>
        </div>
      )}

      {showGiveRoseModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(2,6,23,0.76)", backdropFilter: "blur(10px)" }}
          onClick={() => setShowGiveRoseModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-4 shadow-xl"
            style={{
              borderColor: "rgba(56,189,248,0.28)",
              background: "linear-gradient(165deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.98) 55%, rgba(15,23,42,0.98) 100%)",
              boxShadow: "0 0 0 1px rgba(56, 189, 248, 0.08), 0 16px 32px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-black text-slate-100">
              Подарить розу (<span className="heart-price heart-price--compact text-rose-200">50 ❤</span>)
            </h3>
            <p className="mb-3 text-[15px] font-medium text-slate-200">Повышает рейтинг симпатии. За 10 роз одному игроку — ачивка «Настоящие чувства».</p>
            <ul className="max-h-48 overflow-y-auto space-y-1">
              {players
                .filter((p) => p.id !== currentUser.id)
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-700/80 bg-slate-900/70 px-3 py-2">
                    <span className="text-[15px] font-semibold text-slate-100 truncate">{p.name}</span>
                    <Button
                      size="sm"
                      className="shrink-0 rounded-xl text-[15px] font-black disabled:opacity-50"
                      style={{
                        background: voiceBalance >= 50 ? "linear-gradient(180deg, #e11d48 0%, #be123c 100%)" : undefined,
                        color: "#fff",
                      }}
                      variant={voiceBalance >= 50 ? "default" : "outline"}
                      disabled={voiceBalance < 50}
                      onClick={() => {
                        if (voiceBalance < 50) {
                          showToast("Недостаточно сердец для розы", "error")
                          return
                        }
                        dispatch({ type: "GIVE_ROSE", fromPlayerId: currentUser.id, toPlayerId: p.id })
                        setShowGiveRoseModal(false)
                        triggerRoseGiftFx()
                        showToast("Роза подарена", "success")
                      }}
                    >
                      Подарить
                    </Button>
                  </li>
                ))}
            </ul>
            <Button
              variant="outline"
              className="mt-3 w-full rounded-2xl text-[15px] font-black"
              onClick={() => setShowGiveRoseModal(false)}
            >
              Закрыть
            </Button>
          </div>
        </div>
      )}

    </>
  )
}

