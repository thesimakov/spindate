"use client"

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useId,
  type CSSProperties,
  type RefObject,
  type SetStateAction,
} from "react"
import {
  Heart,
  MessageCircle,
  Star,
  RotateCw,
  Beer,
  X,
  Coins,
  Send,
  ArrowRight,
  Sparkles,
  User,
  Gift,
  Camera,
  Music,
  Target,
  Trophy,
  Flower2,
  ChevronLeft,
  ChevronRight,
  Menu,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGame, generateLogId, sortPair, pairsMatch, getPairGenderCombo, generateBots, randomAvatarFrame } from "@/lib/game-context"
import { apiFetch } from "@/lib/api-fetch"
import { assetUrl, EMOJI_BANYA, EMOTION_SOUNDS } from "@/lib/assets"
import { Bottle } from "@/components/bottle"
import { PlayerAvatar } from "@/components/player-avatar"
import { TableDecorations } from "@/components/decorations"
import { GameSidePanelShell } from "@/components/game-side-panel-shell"
import { TableChatEmojiPicker } from "@/components/table-chat-emoji-picker"
import { BottleCatalogModal } from "@/components/bottle-catalog-modal"
import { WelcomeGiftDialog } from "@/components/welcome-gift-dialog"
import { InlineToast } from "@/components/ui/inline-toast"
import { useInlineToast } from "@/hooks/use-inline-toast"
import { composeTablePlayers } from "@/lib/table-composition"
import { useSyncEngine } from "@/hooks/use-sync-engine"
import { useGameTimers } from "@/hooks/use-game-timers"
import { TableLoaderOverlay } from "@/components/table-loader-overlay"
import { FlyingEmojisLayer } from "@/components/flying-emojis-layer"
import { BottleCenter } from "@/components/bottle-center"
import { TurnTimerDisplay } from "@/components/turn-timer-display"
import { GameBoardPlayers } from "@/components/game-board-players"
import {
  PAIR_ACTIONS,
  type PairAction,
  type Player,
  type GameAction,
  type GameLogEntry,
  type PairGenderCombo,
  type InventoryItem,
} from "@/lib/game-types"
import { useTheme } from "next-themes"
import { useGameLayoutMode } from "@/lib/use-media-query"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function circlePositions(count: number, radiusX: number, radiusY: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / count
    return {
      x: 50 + radiusX * Math.cos(angle),
      y: 50 + radiusY * Math.sin(angle),
      angleDeg: (-90 + (360 * i) / count + 360) % 360,
    }
  })
}

/** Ширина/высота стола (как в CSS aspect-ratio). Для окружности в пикселях при не-квадратном столе: radiusY = radiusX * TABLE_ASPECT_WH. */
const TABLE_ASPECT_WH = 60 / 50

const DAILY_EMOTION_LIMIT = 50
/** Покупка доп. лимита по выбранным типам: +50 использований за 10 ❤ на тип. */
const EMOTION_QUOTA_PURCHASE_AMOUNT = 50
const EMOTION_QUOTA_COST_PER_TYPE_HEARTS = 10

function getTodayDateKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function getDailyEmotionLimitForActionId(
  actionId: string,
  boost:
    | {
        dateKey: string
        extraPerType?: number
        extraByType?: Partial<Record<"kiss" | "beer" | "cocktail", number>>
      }
    | undefined,
): number {
  if (actionId !== "kiss" && actionId !== "beer" && actionId !== "cocktail") {
    return DAILY_EMOTION_LIMIT
  }
  const todayKey = getTodayDateKey()
  if (!boost || boost.dateKey !== todayKey) return DAILY_EMOTION_LIMIT
  const legacy = boost.extraPerType ?? 0
  const typed = boost.extraByType?.[actionId as "kiss" | "beer" | "cocktail"] ?? 0
  return DAILY_EMOTION_LIMIT + legacy + typed
}

function shouldShowActionCostBadge(actionId: string, actionCost: number): boolean {
  if (actionId === "kiss" || actionId === "beer" || actionId === "cocktail") return false
  return actionCost > 0
}

/** Каталог подарков у аватара: бесплатные (0 ❤) и премиум */
type GiftCatalogDef = {
  id: InventoryItem["type"]
  name: string
  emoji: string
  cost: number
}

/** Бесплатные — добавляйте записи; новые `id` согласуйте с `InventoryItem` в game-types */
const GIFT_CATALOG_FREE: GiftCatalogDef[] = []

// Table loader constants moved to components/table-loader-overlay.tsx

const GIFT_CATALOG_PREMIUM: GiftCatalogDef[] = [
  { id: "toy_bear", name: "Плюшевый мишка", emoji: "🧸", cost: 10 },
  { id: "plush_heart", name: "Подушка-сердце", emoji: "❤️", cost: 8 },
  { id: "toy_car", name: "Игрушечная машинка", emoji: "🚗", cost: 7 },
  { id: "toy_ball", name: "Футбольный мяч", emoji: "⚽️", cost: 6 },
  { id: "souvenir_magnet", name: "Магнитик на холодильник", emoji: "🧲", cost: 3 },
  { id: "souvenir_keychain", name: "Брелок-сувенир", emoji: "🔑", cost: 5 },
  { id: "chocolate_box", name: "Коробка конфет", emoji: "🍫", cost: 4 },
]

const BG_PARTICLE_EASE = [
  "cubic-bezier(0.45, 0.02, 0.29, 0.98)",
  "cubic-bezier(0.33, 0.12, 0.53, 0.94)",
  "cubic-bezier(0.52, 0.01, 0.19, 0.99)",
  "cubic-bezier(0.4, 0.18, 0.32, 0.92)",
  "cubic-bezier(0.28, 0.09, 0.46, 1)",
  "cubic-bezier(0.55, 0.05, 0.15, 0.95)",
] as const

/** Случайные пылинки стола (позиции снизу + траектории particleChaos*) */
function buildGameRoomDustParticles(count: number, seed: number) {
  let s = seed % 233280
  const list: {
    left: string
    bottom: string
    delay: string
    dur: string
    chaos: number
    rev: boolean
    pink?: boolean
    yellow?: boolean
    dustOpacity: number
    dustSize: string
  }[] = []
  for (let i = 0; i < count; i++) {
    s = (s * 9301 + 49297) % 233280
    const left = `${2 + (s / 233280) * 92}%`
    s = (s * 9301 + 49297) % 233280
    const bottom = `${-(11 + (s / 233280) * 42)}%`
    s = (s * 9301 + 49297) % 233280
    const delay = `${((s % 22) * 0.72).toFixed(2)}s`
    s = (s * 9301 + 49297) % 233280
    const dur = `${15 + (s % 16)}s`
    const chaos = s % 6
    const rev = (s + i * 3) % 2 === 1
    const dustSize = `${(2.1 + (s / 233280) * 2.75).toFixed(2)}px`
    const dustOpacity = 0.4 + (s / 233280) * 0.5
    list.push({
      left,
      bottom,
      delay,
      dur,
      chaos,
      rev,
      pink: i % 4 === 1,
      yellow: i % 4 === 2,
      dustOpacity,
      dustSize,
    })
  }
  return list
}

/* ------------------------------------------------------------------ */
/*  Flying emoji animation                                            */
/* ------------------------------------------------------------------ */
interface FlyingEmoji {
  id: string
  emoji?: string
  imgSrc?: string
  /** Облачко с текстом «Спасибо» вместо эмодзи (благодарность за бутылочку) */
  thanksCloud?: boolean
  fromX: number
  fromY: number
  toX: number
  toY: number
}

function ThanksCloudBubble() {
  const uid = useId().replace(/:/g, "")
  const gid = `tcg-${uid}`

  return (
    <div
      className="thanks-cloud-bubble__inner relative inline-flex h-14 w-[132px] select-none items-center justify-center"
      style={{
        filter:
          "drop-shadow(0 10px 22px rgba(59, 130, 246, 0.42)) drop-shadow(0 3px 6px rgba(15, 23, 42, 0.18))",
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 132 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id={gid} x1="66" y1="6" x2="66" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="0.35" stopColor="#f8fafc" />
            <stop offset="0.72" stopColor="#e0f2fe" />
            <stop offset="1" stopColor="#bfdbfe" />
          </linearGradient>
        </defs>
        <circle cx="28" cy="38" r="17" fill={`url(#${gid})`} />
        <circle cx="50" cy="32" r="20" fill={`url(#${gid})`} />
        <circle cx="78" cy="30" r="22" fill={`url(#${gid})`} />
        <circle cx="104" cy="36" r="16" fill={`url(#${gid})`} />
        <ellipse cx="66" cy="40" rx="52" ry="14" fill={`url(#${gid})`} />
      </svg>
      <span
        className="relative z-10 text-center text-[13px] font-extrabold tracking-[0.06em]"
        style={{
          color: "#0c1e3d",
          textShadow:
            "0 1px 0 rgba(255,255,255,0.95), 0 -1px 8px rgba(255,255,255,0.35), 0 2px 4px rgba(59,130,246,0.12)",
        }}
      >
        Спасибо
      </span>
    </div>
  )
}

function FlyingEmojiContent({ fe }: { fe: FlyingEmoji }) {
  const [imgError, setImgError] = useState(false)
  useEffect(() => setImgError(false), [fe.imgSrc])
  if (fe.thanksCloud) {
    return <ThanksCloudBubble />
  }
  if (fe.imgSrc && !imgError) {
    return (
       
      <img
        src={fe.imgSrc}
        alt=""
        className="drop-shadow-lg"
        style={{ width: "56px", height: "56px", objectFit: "contain" }}
        draggable={false}
        loading="eager"
        onLoad={(e) => {
          const img = e.currentTarget
          if (img.naturalWidth === 0 || img.naturalHeight === 0) setImgError(true)
          else setImgError(false)
        }}
        onError={() => setImgError(true)}
      />
    )
  }
  return (
    <span className="drop-shadow-lg" style={{ fontSize: "3.5rem" }}>
      {fe.emoji ?? "✨"}
    </span>
  )
}

interface SteamPuff {
  id: string
  targetIdx: number
  delayMs: number
  /** −1…1 — умножается на радиус аватарки при отрисовке (пар по всей фотке) */
  spreadX: number
  spreadY: number
}

/** Запотевание аватарки после бани: до 1 мин с момента последнего пара, сила растёт с объёмом пара */
interface AvatarSteamFog {
  until: number
  /** 0…1 накопленная «влажность» (чем больше пуфов / чаще баня — тем выше) */
  level: number
}

const BANYA_STEAM_PUFF_COUNT = 10
/** Вклад одного «облачка» в запотевание (суммарно с одной бани ≈ 0.55) */
const BANYA_STEAM_LEVEL_PER_PUFF = 0.055

type LevelReward = {
  level: number
  hearts: number
  title: string
}

/* ------------------------------------------------------------------ */
/*  Pair actions (single source of truth in lib/game-types.ts)         */
/* ------------------------------------------------------------------ */
function getActionsForPair(combo: PairGenderCombo): PairAction[] {
  return PAIR_ACTIONS.filter((a) => a.combo.includes(combo))
}

function renderActionIcon(action: PairAction): React.ReactNode {
  switch (action.icon) {
    case "kiss":
      return <span className="text-base">{"💋"}</span>
    case "flowers":
      return <Flower2 className="h-4 w-4" />
    case "diamond":
      return <span className="text-base">{"💎"}</span>
    case "beer":
      return <Beer className="h-4 w-4" />
    case "banya":
       
      return (
        <img
          src={assetUrl(EMOJI_BANYA)}
          alt="Веник"
          className="h-4 w-4 object-contain"
          draggable={false}
        />
      )
    case "tools":
      return <span className="text-base">{"🛠️"}</span>
    case "coins":
      return <Coins className="h-4 w-4" />
    case "hug":
      return <span className="text-base">{"🤗"}</span>
    case "selfie":
      return <Camera className="h-4 w-4" />
    case "song":
      return <Music className="h-4 w-4" />
    case "rose":
      return <span className="text-base">{"🌹"}</span>
    case "lipstick":
      return <span className="text-base">{"💄"}</span>
    case "chat":
      return <MessageCircle className="h-4 w-4" />
    case "laugh":
      return <span className="text-base">{"😂"}</span>
    case "cocktail":
      return <span className="text-base">{"🍹"}</span>
    case "skip":
      return <ArrowRight className="h-4 w-4" />
    default:
      return <Sparkles className="h-4 w-4" />
  }
}

// В казуальном режиме оставляем только простое кручение бутылочки,
// а прогнозы и ставки скрываем, чтобы не перегружать игрока.
const CASUAL_MODE = true

const ACTION_BUTTON_STYLES: Record<string, { bg: string; border: string; shadow: string; text: string }> = {
  kiss:      { bg: "linear-gradient(180deg, #e74c3c 0%, #c0392b 100%)", border: "#a93226", shadow: "#7b241c", text: "#ffffff" },
  flowers:   { bg: "linear-gradient(180deg, #ffb347 0%, #ff7e00 100%)", border: "#e67e22", shadow: "#a04000", text: "#111827" },
  diamond:   { bg: "linear-gradient(180deg, #78d6ff 0%, #1ea5ff 100%)", border: "#0a6bd1", shadow: "#063f7a", text: "#0b1120" },
  beer:      { bg: "linear-gradient(180deg, #f39c12 0%, #e67e22 100%)", border: "#d35400", shadow: "#a04000", text: "#111827" },
  banya:     { bg: "linear-gradient(180deg, #34d399 0%, #16a34a 100%)", border: "#166534", shadow: "#0f3d22", text: "#052e16" },
  tools:     { bg: "linear-gradient(180deg, #bdc3c7 0%, #7f8c8d 100%)", border: "#4e5c5f", shadow: "#2c3e50", text: "#111827" },
  gift_voice:{ bg: "linear-gradient(180deg, #f1c40f 0%, #f39c12 100%)", border: "#d68910", shadow: "#9a6408", text: "#111827" },
  lipstick:  { bg: "linear-gradient(180deg, #ff6b81 0%, #c0392b 100%)", border: "#a93226", shadow: "#7b241c", text: "#ffffff" },
  chat:      { bg: "linear-gradient(180deg, #9b59b6 0%, #8e44ad 100%)", border: "#7d3c98", shadow: "#5b2c6f", text: "#f9fafb" },
  cocktail:  { bg: "linear-gradient(180deg, #f39c12 0%, #e67e22 100%)", border: "#d35400", shadow: "#a04000", text: "#111827" },
  song:      { bg: "linear-gradient(180deg, #5dade2 0%, #2e86c1 100%)", border: "#21618c", shadow: "#154360", text: "#f9fafb" },
  rose:      { bg: "linear-gradient(180deg, #ff5a7a 0%, #c2185b 100%)", border: "#880e4f", shadow: "#4a0a2a", text: "#ffffff" },
  hug:       { bg: "linear-gradient(180deg, #2ecc71 0%, #27ae60 100%)", border: "#1e8449", shadow: "#145a32", text: "#ecfdf5" },
  selfie:    { bg: "linear-gradient(180deg, #95a5a6 0%, #7f8c8d 100%)", border: "#566573", shadow: "#2c3e50", text: "#111827" },
  skip:      { bg: "linear-gradient(180deg, #7f8c8d 0%, #636e72 100%)", border: "#535c5e", shadow: "#3d4648", text: "#f9fafb" },
}

/** Мобильная полоса эмоций: один ряд, кнопка = иконка + подпись в одну линию, без панели-обёртки */
const MOBILE_EMOTION_STRIP_SCROLL =
  "flex w-full max-w-full items-center justify-center gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain py-0.5 [-webkit-overflow-scrolling:touch]"
const MOBILE_EMOTION_STRIP_BTN =
  "flex h-8 shrink-0 flex-row items-center gap-1 rounded-full px-2 py-0 pr-2.5 text-left text-[10px] font-bold leading-none transition-[transform,filter] hover:brightness-105 active:scale-[0.98] disabled:opacity-40"

// isTableSyncedAction moved to hooks/use-sync-engine.ts


const GAME_ROOM_DUST_SEED = 0x51ab1e

export function GameRoom() {
  const { state } = useGame()
  useTheme()
  const { layoutMobile: isMobile } = useGameLayoutMode()
  /** Только два режима: телефон (`isMobile`) и ПК (`isPcLayout`), без отдельного «планшетного» слоя по max-md/md/lg. */
  const isPcLayout = !isMobile
  const {
    players,
    currentTurnIndex,
    isSpinning,
    countdown,
    bottleAngle,
    bottleSkin,
    ownedBottleSkins,
    bottleCooldownUntil,
    targetPlayer,
    targetPlayer2,
    showResult,
    resultAction: _resultAction,
    voiceBalance,
    bonusBalance: _bonusBalance,
    currentUser,
    tableId,
    tablesCount,
    gameLog,
    predictions,
    bets,
    pot,
    predictionPhase,
    roundNumber,
    inventory,
    playerMenuTarget,
    courtshipProfileAllowed,
    allowChatInvite: _allowChatInvite,
    bottleDonorName,
    drunkUntil,
    bottleDonorId,
    dailyQuests,
    rosesGiven,
    avatarFrames,
    ugadaikaFriendUnlocked,
    playerInUgadaika,
    showReturnedFromUgadaika,
    spinSkips,
    soundsEnabled,
    emotionDailyBoost,
    emotionUseTodayByPlayer,
    tablePaused,
    gameSidePanel,
    admirers,
  } = state

  const gameRoomDustParticles = useMemo(
    () => buildGameRoomDustParticles(8 + (GAME_ROOM_DUST_SEED % 19), GAME_ROOM_DUST_SEED),
    [],
  )

  const { dispatch, syncLiveTable, fetchTableAuthority, tableLiveReady, tableAuthorityReady } = useSyncEngine()
  const playersRef = useRef(players)
  useEffect(() => { playersRef.current = players }, [players])

  const [tableLoading, setTableLoading] = useState(true)

  const { toast, showToast } = useInlineToast(2000)

  // Рандомный бот периодически меняет себе рамку
  useEffect(() => {
    const bots = players.filter((p): p is Player => !!p.isBot)
    if (bots.length === 0) return
    const interval = setInterval(() => {
      const bot = bots[Math.floor(Math.random() * bots.length)]
      if (bot) dispatch({ type: "SET_AVATAR_FRAME", playerId: bot.id, frameId: randomAvatarFrame() })
    }, 20000)
    return () => clearInterval(interval)
  }, [players, dispatch])

  // Background music
  const MUSIC_SRC = "/music/you-know-why.mp3"
  const [musicEnabled, setMusicEnabled] = useState(false)
  const [showMusicTooltip, setShowMusicTooltip] = useState(false)
  const [musicVolume, setMusicVolume] = useState(35) // 0–100
  const musicTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const stopMusic = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    a.pause()
    a.currentTime = 0
  }, [])

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current
    const a = new Audio(MUSIC_SRC)
    a.loop = true
    a.preload = "auto"
    a.volume = musicVolume / 100
    audioRef.current = a
    return a
  }, [musicVolume])

  useEffect(() => {
    const a = audioRef.current
    if (a) a.volume = musicVolume / 100
  }, [musicVolume])

  const startMusic = useCallback(async () => {
    const a = ensureAudio()
    try {
      await a.play()
    } catch {
      // autoplay policies: will require user gesture; the toggle is a gesture.
    }
  }, [ensureAudio])

  useEffect(() => {
    if (!musicEnabled) {
      stopMusic()
      return
    }
    if (tableLoading) {
      audioRef.current?.pause()
      return
    }

    void startMusic()

    const onVisibility = () => {
      if (document.hidden) {
        audioRef.current?.pause()
      } else if (musicEnabled && !tableLoading) {
        void startMusic()
      }
    }
    window.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("blur", onVisibility)
    window.addEventListener("focus", onVisibility)
    return () => {
      window.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("blur", onVisibility)
      window.removeEventListener("focus", onVisibility)
    }
  }, [musicEnabled, startMusic, stopMusic, tableLoading])

  useEffect(() => {
    return () => {
      stopMusic()
      audioRef.current = null
    }
  }, [stopMusic])

  useEffect(() => {
    if (!playerMenuTarget) {
      setShowRosesReceivedPopover(false)
      setShowFramePicker(false)
      setSelectedFrameForGift(null)
    } else {
      setGiftCatalogDrawerPlayer(null)
    }
  }, [playerMenuTarget])

  // Приветственный подарок при первом заходе (по пользователю в localStorage)
  const WELCOME_GIFT_KEY = "spindate_welcome_gift_v1"
  const [showWelcomeGift, setShowWelcomeGift] = useState(false)
  const [welcomeClaimedForSession, setWelcomeClaimedForSession] = useState(false)

  useEffect(() => {
    if (!currentUser || tableLoading) return
    try {
      const raw = localStorage.getItem(WELCOME_GIFT_KEY)
      const stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
      // Пользователи по логину получают стартовые 150 сердец сразу при входе.
      if (currentUser.authProvider === "login" && voiceBalance >= 150) {
        if (!stored[String(currentUser.id)]) {
          stored[String(currentUser.id)] = true
          localStorage.setItem(WELCOME_GIFT_KEY, JSON.stringify(stored))
        }
        return
      }
      if (!stored[String(currentUser.id)]) {
        setShowWelcomeGift(true)
      }
    } catch {
      setShowWelcomeGift(true)
    }
  }, [currentUser?.id, currentUser?.authProvider, voiceBalance, tableLoading])

  const handleClaimWelcomeGift = useCallback(() => {
    dispatch({ type: "CLAIM_WELCOME_GIFT" })
    if (currentUser) {
      try {
        const raw = localStorage.getItem(WELCOME_GIFT_KEY)
        const stored = raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
        stored[String(currentUser.id)] = true
        localStorage.setItem(WELCOME_GIFT_KEY, JSON.stringify(stored))
      } catch {
        // ignore
      }
    }
    setShowWelcomeGift(false)
    setWelcomeClaimedForSession(true)
  }, [dispatch, currentUser])

  // Daily bonus (client-only, saved in localStorage)
  const [, setDailyOpen] = useState(false)
  const [dailyDay, setDailyDay] = useState(1)
  const [dailyClaimedToday, setDailyClaimedToday] = useState(false)

  const dailyBonusTodayKey = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }, [])

  const dailyBonusYesterdayKey = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  }, [])

  useEffect(() => {
    if (!currentUser || tableLoading) return
    try {
      // Сначала показываем приветственный подарок при первом заходе
      const welcomeRaw = localStorage.getItem(WELCOME_GIFT_KEY)
      const welcomeStored = welcomeRaw ? (JSON.parse(welcomeRaw) as Record<string, boolean>) : {}
      if (!welcomeStored[String(currentUser.id)]) {
        setDailyOpen(false)
        return
      }

      const raw = localStorage.getItem("botl_daily_bonus_v1")
      const parsed = raw ? (JSON.parse(raw) as { lastClaimDate?: string; streakDay?: number }) : {}
      const last = parsed.lastClaimDate
      const streak = typeof parsed.streakDay === "number" ? parsed.streakDay : 0

      if (last === dailyBonusTodayKey) {
        setDailyDay(Math.min(5, Math.max(1, streak || 1)))
        setDailyClaimedToday(true)
        setDailyOpen(false)
        return
      }

      const nextDay = last === dailyBonusYesterdayKey ? Math.min(5, (streak || 0) + 1) : 1
      setDailyDay(nextDay)
      setDailyClaimedToday(false)
      setDailyOpen(false)
    } catch {
      setDailyDay(1)
      setDailyClaimedToday(false)
      setDailyOpen(false)
    }
  }, [currentUser, dailyBonusTodayKey, dailyBonusYesterdayKey, welcomeClaimedForSession, tableLoading])

  const _handleClaimDaily = useCallback(() => {
    if (dailyClaimedToday) return
    const reward = dailyDay // 1..5 как на макете
    dispatch({ type: "PAY_VOICES", amount: -reward })
    if (currentUser) {
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "system",
          fromPlayer: currentUser,
          text: `${currentUser.name} получил(а) ежедневный бонус: +${reward} сердец`,
          timestamp: Date.now(),
        },
      })
    }
    try {
      localStorage.setItem("botl_daily_bonus_v1", JSON.stringify({ lastClaimDate: dailyBonusTodayKey, streakDay: dailyDay }))
    } catch {
      // ignore
    }
    setDailyClaimedToday(true)
    setDailyOpen(false)
  }, [dailyClaimedToday, dailyDay, dispatch, currentUser, dailyBonusTodayKey])

  // Result UI state (for center overlay)
  const [, setResultChosenAction] = useState<string | null>(null)
  const [, setResultSwap] = useState(false)

  useEffect(() => {
    if (!showResult) {
      setResultChosenAction(null)
      setResultSwap(false)
      return
    }
    setResultChosenAction(null)
    setResultSwap(Math.random() < 0.5)
  }, [showResult, roundNumber])

  const [showBottleCatalog, setShowBottleCatalog] = useState(false)
  const [showRosesReceivedPopover, setShowRosesReceivedPopover] = useState(false)
  const [showFramePicker, setShowFramePicker] = useState(false)
  const [selectedFrameForGift, setSelectedFrameForGift] = useState<string | null>(null)
  const [showChatListModal, setShowChatListModal] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false)
  /** Планшет (md–lg): узкая колонка иконок; по нажатию — полная панель */
  const [leftSideMenuExpanded, setLeftSideMenuExpanded] = useState(true)
  const [sidebarTargetPlayer, setSidebarTargetPlayer] = useState<Player | null>(null)
  const [sidebarGiftMode, setSidebarGiftMode] = useState(false)
  const [giftCatalogDrawerPlayer, setGiftCatalogDrawerPlayer] = useState<Player | null>(null)
  const [lastSidebarCombo, setLastSidebarCombo] = useState<PairGenderCombo | null>(null)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [emotionPurchaseOpen, setEmotionPurchaseOpen] = useState(false)
  const [emotionPurchasePick, setEmotionPurchasePick] = useState({
    kiss: true,
    beer: true,
    cocktail: true,
  })
  const [flyingEmojis, setFlyingEmojis] = useState<FlyingEmoji[]>([])
  const [steamPuffs, setSteamPuffs] = useState<SteamPuff[]>([])
  const [chatInput, setChatInput] = useState("")
  const logEndRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const underBoardStatusRef = useRef<HTMLDivElement>(null)

  // Prediction state
  const [predictionTarget, setPredictionTarget] = useState<Player | null>(null)
  const [predictionTarget2, setPredictionTarget2] = useState<Player | null>(null)
  const [showPredictionPicker, setShowPredictionPicker] = useState(false)
  const [predictionMade, setPredictionMade] = useState(false)
  const [predictionResult, setPredictionResult] = useState<"correct" | "wrong" | null>(null)

  // Bet state
  const [betAmount, setBetAmount] = useState(10)
  const [betTarget1, setBetTarget1] = useState<Player | null>(null)
  const [betTarget2, setBetTarget2] = useState<Player | null>(null)
  const [showBetPicker, setShowBetPicker] = useState(false)
  const [betPlaced, setBetPlaced] = useState(false)
  const [betWinnings, setBetWinnings] = useState<number | null>(null)
  const botActionRoundRef = useRef<number | null>(null)

  const currentTurnPlayer = players[currentTurnIndex]
  const isMyTurn = currentUser?.id === currentTurnPlayer?.id
  const nowTs = Date.now()
  const isCurrentTurnDrunk =
    !!currentTurnPlayer &&
    !!drunkUntil &&
    typeof drunkUntil[currentTurnPlayer.id] === "number" &&
    drunkUntil[currentTurnPlayer.id] > nowTs

  // Игровой круг: при 10 игроках на мобильном viewport — больший базовый радиус (manyPlayersOnMobile).
  // Стол 60:50: одинаковый r в % по x и y даёт эллипс в пикселях; для окружности — radiusY = radiusX * (W/H).
  const playerSlots = Math.min(players.length, 10)
  const manyPlayersOnMobile = isMobile && playerSlots > 6
  const crowdedRing = playerSlots >= 7
  const desktopRadiusByCount =
    playerSlots >= 10 ? 30 :
    playerSlots === 9 ? 28 :
    playerSlots === 8 ? 26 :
    playerSlots === 7 ? 24 : 22
  const radius = manyPlayersOnMobile ? 26 : isMobile ? (crowdedRing ? 22 : 20) : desktopRadiusByCount
  const radiusX = radius
  const radiusY = radius * TABLE_ASPECT_WH
  const positions = circlePositions(playerSlots, radiusX, radiusY)

  // Игровая логика (эмоции, подписи «Пара: ...») опирается
  // на targetPlayer / targetPlayer2 из состояния — это именно
  // те двое, на кого указывает бутылка (горлышко и дно).
  const resolvedTargetPlayer = targetPlayer
  const resolvedTargetPlayer2 = targetPlayer2

  const _userPrediction = predictions.find(p => p.playerId === currentUser?.id)

  const cooldownLeftMs = useMemo(() => {
    if (!bottleCooldownUntil) return 0
    return Math.max(0, bottleCooldownUntil - now)
  }, [bottleCooldownUntil, now])

  useEffect(() => {
    const cooldownRunning =
      bottleCooldownUntil != null && bottleCooldownUntil > Date.now()
    if (!cooldownRunning) return
    if (showBottleCatalog) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [showBottleCatalog, bottleCooldownUntil])

  const formatCooldown = (ms: number) => {
    const totalSec = Math.ceil(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return `${m}:${String(s).padStart(2, "0")}`
  }

  const getEffectiveActionCost = useCallback(
    (actionId: string, combo: PairGenderCombo | null): number => {
      // Эти эмоции должны быть бесплатными (без списания банка сердец).
      if (actionId === "kiss" || actionId === "beer" || actionId === "cocktail") return 0
      const actionDef = PAIR_ACTIONS.find((a) => a.id === actionId)
      if (!actionDef) return 0
      // Цветы: для М/Ж — 2, для Ж/Ж — 1
      if (actionId === "flowers" && combo === "MF") return 2
      return actionDef.cost
    },
    [],
  )

  const getTodayActionCount = useCallback(
    (playerId: number, actionId: string): number => {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      const start = d.getTime()
      return gameLog.filter(
        (e) =>
          e.fromPlayer?.id === playerId &&
          e.type === actionId &&
          e.timestamp >= start &&
          !e.text.startsWith("Выпала пара:"),
      ).length
    },
    [gameLog],
  )

  const getLimitedEmotionUseCount = useCallback(
    (playerId: number, actionId: "kiss" | "beer" | "cocktail"): number => {
      const todayKey = getTodayDateKey()
      const fromLog = getTodayActionCount(playerId, actionId)
      const bucket = emotionUseTodayByPlayer?.[playerId]
      if (bucket && bucket.dateKey === todayKey) {
        // max: бакет не теряет использования при обрезке лога; лог подстраховывает сбой бакета
        return Math.max(bucket[actionId], fromLog)
      }
      return fromLog
    },
    [emotionUseTodayByPlayer, getTodayActionCount],
  )

  const limitedEmotionCounters = useMemo(() => {
    const uid = currentUser?.id
    const rows = [
      { id: "kiss" as const, label: "Поцелуй", emoji: "💋" },
      { id: "beer" as const, label: "Пиво", emoji: "🍺" },
      { id: "cocktail" as const, label: "Коктейль", emoji: "🍹" },
    ]
    return rows.map((row) => {
      const used = uid ? getLimitedEmotionUseCount(uid, row.id) : 0
      const limit = getDailyEmotionLimitForActionId(row.id, emotionDailyBoost)
      return { ...row, used, left: Math.max(0, limit - used), limit }
    })
  }, [currentUser?.id, emotionDailyBoost, getLimitedEmotionUseCount])
  const isEmotionLimitReached = useMemo(
    () => limitedEmotionCounters.some((row) => row.left <= 0),
    [limitedEmotionCounters],
  )

  const getKissCountForPlayer = useCallback(
    (playerId: number) =>
      gameLog.filter(
        (e) =>
          e.type === "kiss" &&
          (e.fromPlayer?.id === playerId || e.toPlayer?.id === playerId),
      ).length,
    [gameLog],
  )

  const getGiftsForPlayer = useCallback(
    (playerId: number): Array<"rose" | "flowers" | "song" | "diamond" | "kiss"> => {
      const giftTypes: Array<"rose" | "flowers" | "song" | "diamond" | "kiss"> = ["rose", "flowers", "song", "diamond", "kiss"]
      const events = gameLog.filter(
        (e) =>
          giftTypes.includes(e.type as any) &&
          e.toPlayer?.id === playerId,
      )
      return events
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-5)
        .map((e) => e.type as "rose" | "flowers" | "song" | "diamond" | "kiss")
    },
    [gameLog],
  )

  type BigGiftType =
    | "toy_bear"
    | "toy_car"
    | "toy_ball"
    | "souvenir_magnet"
    | "souvenir_keychain"
    | "plush_heart"
    | "chocolate_box"

  const getBigGiftSequenceForPlayer = useCallback(
    (playerId: number): BigGiftType[] => {
      const bigTypes: BigGiftType[] = [
        "toy_bear",
        "toy_car",
        "toy_ball",
        "souvenir_magnet",
        "souvenir_keychain",
        "plush_heart",
        "chocolate_box",
      ]
      return inventory
        .filter(
          (item) =>
            item.toPlayerId === playerId && bigTypes.includes(item.type as BigGiftType),
        )
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((item) => item.type as BigGiftType)
    },
    [inventory],
  )

  // Сколько сердечек игрок потратил на платные подарки (по логам и PAIR_ACTIONS)
  const _getGiftSpentForPlayer = useCallback(
    (playerId: number) => {
      const giftIds = new Set(["flowers", "diamond", "song", "rose", "gift_voice", "tools", "lipstick"])
      return gameLog.reduce((sum, entry) => {
        if (entry.fromPlayer?.id !== playerId) return sum
        if (!giftIds.has(entry.type)) return sum
        const action = PAIR_ACTIONS.find((a) => a.id === entry.type)
        return sum + (action?.cost ?? 0)
      }, 0)
    },
    [gameLog],
  )

  /* ---- Reset prediction/bet state on new round ---- */
  useEffect(() => {
    if (CASUAL_MODE) return
    setPredictionMade(false)
    setPredictionResult(null)
    setPredictionTarget(null)
    setPredictionTarget2(null)
    setBetPlaced(false)
    setBetWinnings(null)
    setBetTarget1(null)
    setBetTarget2(null)
  }, [roundNumber])

  const handleSpin = useCallback(() => {
    if (!CASUAL_MODE) {
      dispatch({ type: "END_PREDICTION_PHASE" })
    }
    dispatch({ type: "START_COUNTDOWN" })
  }, [dispatch])

  const {
    turnTimer,
    predictionTimer,
    steamFogTick,
    avatarSteamFog,
    setAvatarSteamFog,
    resultTimerRef,
    autoAdvanceRef,
    clearResultTimers,
  } = useGameTimers({
    tableId,
    roundNumber,
    currentTurnIndex,
    currentTurnPlayer,
    currentUser,
    isSpinning,
    showResult,
    countdown,
    predictionPhase,
    dispatch,
    handleSpin,
    playersRef: playersRef as React.RefObject<Player[]>,
    casualMode: CASUAL_MODE,
    tableLoading,
  })

  /* ---- auto-scroll log ---- */
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [gameLog])

  /* ---- Start prediction phase when it's a new turn and nobody is spinning ---- */
  useEffect(() => {
    if (CASUAL_MODE) return
    if (tableLoading) return
    if (!isSpinning && !showResult && countdown === null && !predictionPhase && currentTurnPlayer && !predictionMade) {
      dispatch({ type: "START_PREDICTION_PHASE" })
    }
   
  }, [currentTurnIndex, isSpinning, showResult, countdown, tableLoading])

  /* ---- bot auto-spin (delayed to let prediction phase happen) ---- */
  useEffect(() => {
    if (tableLoading) return
    if (!currentTurnPlayer?.isBot || isSpinning || countdown !== null || showResult) return
    const timer = setTimeout(() => handleSpin(), 2500)
    return () => clearTimeout(timer)
     
  }, [currentTurnIndex, currentTurnPlayer, isSpinning, countdown, showResult, handleSpin, tableLoading])

  /* ---- при возврате из мини-игры: анимация «вернулся к нам», пропуск хода если ход был у вернувшегося ---- */
  /* Важно: ждём tableLoading=false и перезапускаемся при его смене — иначе при возврате во время
     оверлея загрузки стола таймер не ставился, showReturnedFromUgadaika зависал навсегда. */
  useEffect(() => {
    if (!showReturnedFromUgadaika) return
    if (tableLoading) return
    const t = setTimeout(() => {
      if (currentTurnPlayer?.id === currentUser?.id) {
        dispatch({
          type: "ADD_LOG",
          entry: {
            id: generateLogId(),
            type: "system",
            fromPlayer: currentTurnPlayer,
            text: `${currentTurnPlayer.name} пропускает ход (вернулся из мини-игры)`,
            timestamp: Date.now(),
          },
        })
        dispatch({ type: "NEXT_TURN" })
      }
      dispatch({ type: "CLEAR_RETURNED_FROM_UGADAIKA" })
    }, 3200)
    return () => clearTimeout(t)
  }, [showReturnedFromUgadaika, tableLoading, currentTurnPlayer?.id, currentUser?.id, dispatch])

  // Turn timer, AFK skip, result timer, prediction timer, steam fog — all managed by useGameTimers hook

  /* ---- countdown tick ---- */
  useEffect(() => {
    if (tableLoading) return
    if (countdown === null || countdown <= 0) return
    const timer = setTimeout(() => {
      if (countdown > 1) {
        dispatch({ type: "TICK_COUNTDOWN" })
      } else {
        dispatch({ type: "TICK_COUNTDOWN" })
        startSpinRef.current()
      }
    }, 800)
    return () => clearTimeout(timer)
     
  }, [countdown, dispatch, tableLoading])

  /* ---- звук при эмоции (учитываем настройку из профиля) ---- */
  const playEmotionSound = useCallback((actionId: string) => {
    if (state.soundsEnabled === false || tableLoading) return
    const path = EMOTION_SOUNDS[actionId]
    if (!path || typeof window === "undefined") return
    try {
      const url = assetUrl(path)
      const a = new Audio(url)
      a.volume = 0.7
      a.play().catch(() => {})
    } catch {
      // ignore
    }
  }, [state.soundsEnabled, tableLoading])

  /* ---- launch flying emoji ---- */
  const launchEmoji = useCallback(
    (
      spinnerIdx: number,
      targetIdx: number,
      emoji?: string,
      imgSrc?: string,
      thanksCloud?: boolean,
    ) => {
      const fromPos = positions[spinnerIdx]
      const toPos = positions[targetIdx]
      if (!fromPos || !toPos) return

      const id = `fly_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
      const newEmoji: FlyingEmoji = {
        id,
        emoji,
        imgSrc,
        thanksCloud: thanksCloud === true,
        fromX: fromPos.x,
        fromY: fromPos.y,
        toX: toPos.x,
        toY: toPos.y,
      }
      setFlyingEmojis((prev) => [...prev, newEmoji])
      const duration = thanksCloud === true ? 2500 : 1900
      setTimeout(() => {
        setFlyingEmojis((prev) => prev.filter((e) => e.id !== id))
      }, duration)
    },
    [positions]
  )

  const launchSteam = useCallback(
    (targetIdx: number) => {
      if (!positions[targetIdx]) return
      const pid = players[targetIdx]?.id

      if (pid) {
        setAvatarSteamFog((prev) => {
          const now = Date.now()
          const cur = prev[pid]
          const base = cur && cur.until > now ? cur.level : 0
          const gain = BANYA_STEAM_PUFF_COUNT * BANYA_STEAM_LEVEL_PER_PUFF
          return { ...prev, [pid]: { until: now + 60_000, level: Math.min(1, base + gain) } }
        })
      }

      const puffs: SteamPuff[] = Array.from({ length: BANYA_STEAM_PUFF_COUNT }).map((_, i) => {
        const angle = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random())
        return {
          id: `steam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${i}`,
          targetIdx,
          delayMs: i * 95,
          spreadX: Math.cos(angle) * r,
          spreadY: Math.sin(angle) * r,
        }
      })

      setSteamPuffs((prev) => [...prev, ...puffs])
      setTimeout(() => {
        setSteamPuffs((prev) => prev.filter((p) => !puffs.some((x) => x.id === p.id)))
      }, 2400)
    },
    [positions, players],
  )

  // Steam fog tick managed by useGameTimers hook

  /* ---- replay remote emotions as flying emojis ---- */
  const processedLogIdsRef = useRef<Set<string>>(new Set())
  const remoteEmotionInitRef = useRef(false)
  const remoteEmotionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const prevTableLoadingRef = useRef(tableLoading)

  useEffect(() => {
    if (prevTableLoadingRef.current && !tableLoading) {
      remoteEmotionInitRef.current = false
      remoteEmotionTimersRef.current.forEach(clearTimeout)
      remoteEmotionTimersRef.current = []
      setFlyingEmojis([])
      setSteamPuffs([])
    }
    prevTableLoadingRef.current = tableLoading
  }, [tableLoading])

  useEffect(() => {
    if (tableLoading || !currentUser || players.length === 0) return

    const seen = processedLogIdsRef.current

    if (!remoteEmotionInitRef.current) {
      remoteEmotionInitRef.current = true
      for (const entry of gameLog) seen.add(entry.id)
      return
    }

    const EMOTION_EMOJI_MAP: Record<string, string> = {
      kiss: "\uD83D\uDC8B",
      flowers: "\uD83C\uDF37",
      diamond: "\uD83D\uDC8E",
      beer: "\uD83C\uDF7A",
      cocktail: "\uD83C\uDF79",
      gift_voice: "\uD83E\uDE99",
      tools: "\uD83D\uDEE0",
      lipstick: "\uD83D\uDC84",
      chat: "\uD83D\uDCAC",
      hug: "\uD83E\uDD17",
      selfie: "\uD83D\uDCF8",
      song: "\uD83C\uDFB5",
      rose: "\uD83C\uDF39",
    }
    const EMOTION_TYPES = new Set([...Object.keys(EMOTION_EMOJI_MAP), "banya"])

    type QueuedEmotion = {
      fromIdx: number
      toIdx: number
      type: string
      emoji?: string
      imgSrc?: string
      thanksTriple?: boolean
      thanksCloud?: boolean
    }
    const queue: QueuedEmotion[] = []

    for (const entry of gameLog) {
      if (seen.has(entry.id)) continue

      if (entry.type === "bottle_thanks" && entry.fromPlayer && entry.toPlayer) {
        seen.add(entry.id)
        if (entry.fromPlayer.id === currentUser.id) continue
        const fromIdx = players.findIndex((p) => p.id === entry.fromPlayer!.id)
        const toIdx = players.findIndex((p) => p.id === entry.toPlayer!.id)
        if (fromIdx === -1 || toIdx === -1) continue
        queue.push({ fromIdx, toIdx, type: entry.type, thanksTriple: true, thanksCloud: true })
        continue
      }

      seen.add(entry.id)

      if (!EMOTION_TYPES.has(entry.type)) continue
      if (entry.fromPlayer?.id === currentUser.id) continue
      if (!entry.fromPlayer || !entry.toPlayer) continue

      const fromIdx = players.findIndex((p) => p.id === entry.fromPlayer!.id)
      const toIdx = players.findIndex((p) => p.id === entry.toPlayer!.id)
      if (fromIdx === -1 || toIdx === -1) continue

      if (entry.type === "banya") {
        queue.push({ fromIdx, toIdx, type: entry.type, emoji: "\uD83E\uDDF9", imgSrc: assetUrl(EMOJI_BANYA) })
      } else if (EMOTION_EMOJI_MAP[entry.type]) {
        queue.push({ fromIdx, toIdx, type: entry.type, emoji: EMOTION_EMOJI_MAP[entry.type] })
      }
    }

    // Stagger animations so multiple emotions don't overlap into one blob
    const STAGGER_MS = 350
    for (const prev of remoteEmotionTimersRef.current) clearTimeout(prev)
    remoteEmotionTimersRef.current = []

    queue.forEach((item, i) => {
      const t = setTimeout(() => {
        if (item.thanksTriple) {
          for (let j = 0; j < 3; j++) {
            setTimeout(
              () =>
                launchEmoji(
                  item.fromIdx,
                  item.toIdx,
                  item.emoji,
                  item.imgSrc,
                  item.thanksCloud === true,
                ),
              j * 120,
            )
          }
        } else {
          launchEmoji(item.fromIdx, item.toIdx, item.emoji, item.imgSrc)
          if (item.type === "banya") launchSteam(item.toIdx)
          playEmotionSound(item.type)
        }
      }, i * STAGGER_MS)
      remoteEmotionTimersRef.current.push(t)
    })

    if (seen.size > 500) {
      const ids = Array.from(seen)
      const toRemove = ids.slice(0, ids.length - 200)
      for (const id of toRemove) seen.delete(id)
    }
  }, [gameLog, currentUser, players, launchEmoji, launchSteam, playEmotionSound])

  /* ---- start the actual spin ---- */
  const startSpin = useCallback(() => {
    const spinner = currentTurnPlayer
    if (!spinner) return

    // Пара ВСЕГДА включает крутящего игрока + одного случайного.
    const others = players.filter((p) => p.id !== spinner.id)
    if (others.length === 0) return

    const idx = Math.floor(Math.random() * others.length)
    const target = others[idx]

    // Горлышко бутылки указывает на «цель» (target),
    // дно — на крутящего игрока (spinner).
    const targetIdx = players.findIndex((p) => p.id === target.id)
    if (targetIdx === -1) return
    const segmentDeg = 360 / players.length
    const targetDeg = -90 + segmentDeg * targetIdx
    const totalAngle = 360 * 5 + targetDeg + 90

    dispatch({ type: "END_PREDICTION_PHASE" })
    dispatch({ type: "START_SPIN", angle: totalAngle, target: target, target2: spinner })

    setTimeout(() => {
      if (!currentTurnPlayer) return

      if (!CASUAL_MODE) {
        const aliveIds = new Set(players.map((p) => p.id))
        const safePredictions = predictions.filter(
          (pred) =>
            aliveIds.has(pred.playerId) &&
            aliveIds.has(pred.targetPair[0]) &&
            aliveIds.has(pred.targetPair[1]),
        )
        const safeBets = bets.filter(
          (b) =>
            aliveIds.has(b.playerId) &&
            aliveIds.has(b.targetPair[0]) &&
            aliveIds.has(b.targetPair[1]),
        )

        // --- Оценка прогнозов ---
        const actualPair = sortPair(target.id, spinner.id)

        // Check each prediction
        safePredictions.forEach(pred => {
          const isCorrect = pairsMatch(pred.targetPair, actualPair)
          if (pred.playerId === currentUser?.id) {
            if (isCorrect) {
              dispatch({ type: "ADD_BONUS", amount: 10 })
              setPredictionResult("correct")
            } else {
              dispatch({ type: "ADD_BONUS", amount: -10 })
              setPredictionResult("wrong")
            }
          }
        })

        // Check matching predictions between players - bonus for same prediction
        const predMap = new Map<string, number[]>()
        safePredictions.forEach(pred => {
          const key = `${pred.targetPair[0]}_${pred.targetPair[1]}`
          const arr = predMap.get(key) || []
          arr.push(pred.playerId)
          predMap.set(key, arr)
        })
        predMap.forEach((playerIds) => {
          if (playerIds.length >= 2) {
            playerIds.forEach(pid => {
              if (pid === currentUser?.id) {
                dispatch({ type: "ADD_BONUS", amount: 5 })
                dispatch({
                  type: "ADD_LOG",
                  entry: {
                    id: generateLogId(),
                    type: "prediction",
                    fromPlayer: currentUser!,
                    text: `Совпадение прогнозов! +5 бонусов`,
                    timestamp: Date.now(),
                  },
                })
              }
            })
          }
        })

        // Correct prediction = rose
        const correctPredictors = safePredictions.filter(pred => pairsMatch(pred.targetPair, actualPair))
        correctPredictors.forEach(pred => {
          if (pred.playerId === currentUser?.id) {
            dispatch({
              type: "ADD_INVENTORY_ITEM",
              item: {
                type: "rose",
                fromPlayerId: 0,
                fromPlayerName: "Система",
                timestamp: Date.now(),
              },
            })
            dispatch({
              type: "ADD_LOG",
              entry: {
                id: generateLogId(),
                type: "rose",
                fromPlayer: currentUser!,
                text: `${currentUser!.name} угадал(а) пару и получает розу!`,
                timestamp: Date.now(),
              },
            })
          }
        })

        // --- Evaluate bets ---
        const winningBets = safeBets.filter(b => pairsMatch(b.targetPair, actualPair))
        const totalWinningStakes = winningBets.reduce((sum, b) => sum + b.amount, 0)

        if (totalWinningStakes > 0 && pot > 0) {
          winningBets.forEach(b => {
            const winAmount = Math.floor((b.amount / totalWinningStakes) * pot)
            if (b.playerId === currentUser?.id) {
              dispatch({ type: "PAY_VOICES", amount: -winAmount }) // negative = add voices
              setBetWinnings(winAmount)
              dispatch({
                type: "ADD_LOG",
                entry: {
                  id: generateLogId(),
                  type: "system",
                  fromPlayer: currentUser!,
                  text: `${currentUser!.name} выиграл(а) ${winAmount} сердец из банка!`,
                  timestamp: Date.now(),
                },
              })
            }
          })
        }
      }

      // Determine the default action based on gender combo (spinner + target)
      const combo = getPairGenderCombo(spinner, target)
      let defaultAction: GameLogEntry["type"] | "skip" = "skip"
      if (combo === "MF") defaultAction = "kiss"
      else if (combo === "MM") defaultAction = "beer"
      else if (combo === "FF") defaultAction = "cocktail"

      const spinnerIsBot = !!currentTurnPlayer.isBot

      if (spinnerIsBot) {
        // Для ботов всё происходит автоматически
        dispatch({ type: "STOP_SPIN", action: defaultAction })

        const spinnerIdx = players.findIndex((p) => p.id === currentTurnPlayer.id)
        const emojiMap: Record<string, string> = {
          kiss: "\uD83D\uDC8B",
          beer: "\uD83C\uDF7A",
          cocktail: "\uD83C\uDF79",
          skip: "",
        }
        if (emojiMap[defaultAction]) {
          launchEmoji(spinnerIdx, targetIdx, emojiMap[defaultAction])
          playEmotionSound(defaultAction)
        }

        const pairText = `${spinner.name} & ${target.name}`
        dispatch({
          type: "ADD_LOG",
          entry: {
            id: generateLogId(),
            type: defaultAction as GameLogEntry["type"],
            fromPlayer: currentTurnPlayer,
            toPlayer: target,
            text: `Выпала пара: ${pairText}`,
            timestamp: Date.now(),
          },
        })
      } else {
        // Для живых игроков: только останавливаем спин и показываем результат,
        // эмоция/действие будут выбраны вручную через handlePerformAction.
        dispatch({ type: "STOP_SPIN", action: "skip" })
      }
    }, 6000)
     
  }, [players, currentTurnPlayer, dispatch, launchEmoji, playEmotionSound, predictions, bets, pot, currentUser])

  const startSpinRef = useRef(startSpin)
  useEffect(() => { startSpinRef.current = startSpin }, [startSpin])

  const openEmotionPurchaseModal = useCallback(() => {
    const next = { kiss: false, beer: false, cocktail: false }
    for (const row of limitedEmotionCounters) {
      if (row.id === "kiss" || row.id === "beer" || row.id === "cocktail") {
        next[row.id] = row.left <= 0
      }
    }
    if (!next.kiss && !next.beer && !next.cocktail) {
      next.kiss = true
      next.beer = true
      next.cocktail = true
    }
    setEmotionPurchasePick(next)
    setEmotionPurchaseOpen(true)
  }, [limitedEmotionCounters])

  const confirmEmotionQuotaPurchase = useCallback(() => {
    if (!currentUser) return
    const types = (["kiss", "beer", "cocktail"] as const).filter((t) => emotionPurchasePick[t])
    if (types.length === 0) {
      showToast("Выберите хотя бы один тип эмоций", "info")
      return
    }
    const totalCost = types.length * EMOTION_QUOTA_COST_PER_TYPE_HEARTS
    if (voiceBalance < totalCost) {
      showToast("Недостаточно сердец", "error")
      return
    }
    dispatch({
      type: "BUY_EMOTION_QUOTA_SELECTION",
      dateKey: getTodayDateKey(),
      selectedTypes: [...types],
      extraPerPurchase: EMOTION_QUOTA_PURCHASE_AMOUNT,
      costPerType: EMOTION_QUOTA_COST_PER_TYPE_HEARTS,
    })
    const labelMap: Record<string, string> = { kiss: "поцелуи", beer: "пиво", cocktail: "коктейль" }
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "system",
        fromPlayer: currentUser,
        text: `${currentUser.name} купил(а) +${EMOTION_QUOTA_PURCHASE_AMOUNT} к: ${types.map((t) => labelMap[t]).join(", ")}`,
        timestamp: Date.now(),
      },
    })
    showToast("Лимит эмоций увеличен до конца суток", "success")
    setEmotionPurchaseOpen(false)
  }, [currentUser, dispatch, emotionPurchasePick, showToast, voiceBalance])

  /* ---- perform gender-based action ---- */
  const handlePerformAction = (actionId: string) => {
    // Звук сразу по клику, пока контекст жеста пользователя активен (требование браузера)
    playEmotionSound(actionId)

    const tp = resolvedTargetPlayer
    const tp2 = resolvedTargetPlayer2
    if (!currentTurnPlayer || !tp || !tp2) return

    setResultChosenAction(actionId)

    const actionDef = PAIR_ACTIONS.find((a) => a.id === actionId)
    if (!actionDef) return

    const pairCombo = getPairGenderCombo(tp, tp2)
    const actionCost = getEffectiveActionCost(actionId, pairCombo)
    const hasDailyLimit = actionId === "kiss" || actionId === "beer" || actionId === "cocktail"
    const dailyLimit = getDailyEmotionLimitForActionId(actionId, emotionDailyBoost)

    // Стоимость списываем только, если действие делает живой игрок.
    // Боты (isBot) играют «за счёт системы» и не трогают баланс пользователя.
    if (!currentTurnPlayer.isBot && hasDailyLimit) {
      const todayCount = getLimitedEmotionUseCount(
        currentTurnPlayer.id,
        actionId as "kiss" | "beer" | "cocktail",
      )
      if (todayCount >= dailyLimit) {
        showToast(`Лимит на сегодня: ${dailyLimit}`, "info")
        return
      }
    }
    if (!currentTurnPlayer.isBot && actionCost > 0) {
      if (voiceBalance < actionCost) {
        showToast("Недостаточно сердец", "error")
        return
      }
      dispatch({ type: "PAY_VOICES", amount: actionCost })
    }

    const spinnerIdx = players.findIndex((p) => p.id === currentTurnPlayer.id)
    const targetIdx = players.findIndex((p) => p.id === tp.id)
    const emojiMap: Record<string, string> = {
      kiss: "\uD83D\uDC8B",
      flowers: "\uD83C\uDF37",
      diamond: "\uD83D\uDC8E",
      beer: "\uD83C\uDF7A",
      cocktail: "\uD83C\uDF79",
      gift_voice: "\uD83E\uDE99",
      tools: "\uD83D\uDEE0",
      lipstick: "\uD83D\uDC84",
      chat: "\uD83D\uDCAC",
      hug: "\uD83E\uDD17",
      selfie: "\uD83D\uDCF8",
      song: "\uD83C\uDFB5",
      rose: "\uD83C\uDF39",
    }
    if (emojiMap[actionId]) {
      launchEmoji(spinnerIdx, targetIdx, emojiMap[actionId])
    }

    if (actionId === "banya") {
      launchEmoji(spinnerIdx, targetIdx, "🧹", assetUrl(EMOJI_BANYA))
      launchSteam(targetIdx)
    }

    if (actionId === "beer" || actionId === "cocktail") {
      dispatch({ type: "ADD_DRUNK_TIME", playerId: currentTurnPlayer.id, ms: 60_000 })
    }

    const pairText = `${tp.name} & ${tp2.name}`
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: actionId as GameLogEntry["type"],
        fromPlayer: currentTurnPlayer,
        toPlayer: tp,
        text: `${currentTurnPlayer.name}: ${actionDef.label} (${pairText})`,
        timestamp: Date.now(),
      },
    })

    if (actionId === "skip") {
      handleSkipTurn()
    }
  }

  /* ---- response emotions from target player ---- */
  const handleResponseEmotion = (actionId: string) => {
    if (!currentUser || !resolvedTargetPlayer || !resolvedTargetPlayer2) return
    const from = currentUser
    if (from.id !== resolvedTargetPlayer.id && from.id !== resolvedTargetPlayer2.id) return

    // Кому летит ответная эмоция:
    // если крутил другой игрок/бот — отвечаем ему;
    // если крутил сам пользователь — отвечаем второму участнику пары.
    let to: Player
    if (currentTurnPlayer && currentTurnPlayer.id !== from.id) {
      to = currentTurnPlayer
    } else {
      to = from.id === resolvedTargetPlayer.id ? resolvedTargetPlayer2 : resolvedTargetPlayer
    }

    const fromIdx = players.findIndex((p) => p.id === from.id)
    const toIdx = players.findIndex((p) => p.id === to.id)
    if (fromIdx === -1 || toIdx === -1) return

    const pairCombo = getPairGenderCombo(resolvedTargetPlayer, resolvedTargetPlayer2)
    const actionCost = getEffectiveActionCost(actionId, pairCombo)
    const hasDailyLimit = actionId === "kiss" || actionId === "beer" || actionId === "cocktail"
    const dailyLimit = getDailyEmotionLimitForActionId(actionId, emotionDailyBoost)

    // Оплата за ответную эмоцию (та же цена, что и за основное действие)
    const actionDef = PAIR_ACTIONS.find((a) => a.id === actionId)
    if (actionDef && hasDailyLimit) {
      const todayCount = getLimitedEmotionUseCount(from.id, actionId as "kiss" | "beer" | "cocktail")
      if (todayCount >= dailyLimit) {
        showToast(`Лимит на сегодня: ${dailyLimit}`, "info")
        return
      }
    }
    if (actionDef && actionCost > 0) {
      if (voiceBalance < actionCost) {
        showToast("Недостаточно сердец", "error")
        return
      }
      dispatch({ type: "PAY_VOICES", amount: actionCost })
    }

    const emojiMap: Record<string, string> = {
      kiss: "💋",
      flowers: "💐",
      diamond: "💎",
      beer: "🍺",
      cocktail: "🍹",
      tools: "🛠️",
      lipstick: "💄",
      chat: "💬",
      song: "🎵",
      rose: "🌹",
      hug: "🤗",
      selfie: "📸",
    }

    // Звук сразу по клику (контекст жеста пользователя)
    playEmotionSound(actionId)
    if (actionId === "banya") {
      launchEmoji(fromIdx, toIdx, "🧹", assetUrl(EMOJI_BANYA))
      launchSteam(toIdx)
    } else if (emojiMap[actionId]) {
      launchEmoji(fromIdx, toIdx, emojiMap[actionId])
    }

    const label = actionDef?.label ?? actionId

    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: actionId as GameLogEntry["type"],
        fromPlayer: from,
        toPlayer: to,
        text: `${from.name} отвечает: ${label} ${to.name}`,
        timestamp: Date.now(),
      },
    })
  }

  const handleSidebarGiftEmotion = (actionId: string) => {
    if (!currentUser || currentUser.isBot || !sidebarTargetPlayer) return

    const combo = getPairGenderCombo(currentUser, sidebarTargetPlayer)
    const actionDef = getActionsForPair(combo).find((a) => a.id === actionId)
    if (!actionDef || actionId === "skip") return

    const actionCost = getEffectiveActionCost(actionId, combo)
    const hasDailyLimit = actionId === "kiss" || actionId === "beer" || actionId === "cocktail"
    const dailyLimit = getDailyEmotionLimitForActionId(actionId, emotionDailyBoost)
    if (hasDailyLimit) {
      const todayCount = getLimitedEmotionUseCount(currentUser.id, actionId as "kiss" | "beer" | "cocktail")
      if (todayCount >= dailyLimit) {
        showToast(`Лимит на сегодня: ${dailyLimit}`, "info")
        return
      }
    }
    if (actionCost > 0) {
      if (voiceBalance < actionCost) {
        showToast("Недостаточно сердец", "error")
        return
      }
      dispatch({ type: "PAY_VOICES", amount: actionCost })
    }

    const fromIdx = players.findIndex((p) => p.id === currentUser.id)
    const toIdx = players.findIndex((p) => p.id === sidebarTargetPlayer.id)
    if (fromIdx === -1 || toIdx === -1) return

    const emojiMap: Record<string, string> = {
      kiss: "💋",
      flowers: "💐",
      diamond: "💎",
      beer: "🍺",
      cocktail: "🍹",
      tools: "🛠️",
      lipstick: "💄",
      chat: "💬",
      song: "🎵",
      rose: "🌹",
      hug: "🤗",
      selfie: "📸",
    }

    playEmotionSound(actionId)
    if (actionId === "banya") {
      launchEmoji(fromIdx, toIdx, "🧹", assetUrl(EMOJI_BANYA))
      launchSteam(toIdx)
    } else if (emojiMap[actionId]) {
      launchEmoji(fromIdx, toIdx, emojiMap[actionId])
    }

    if (actionId === "beer" || actionId === "cocktail") {
      dispatch({ type: "ADD_DRUNK_TIME", playerId: currentUser.id, ms: 60_000 })
    }

    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: actionId as GameLogEntry["type"],
        fromPlayer: currentUser,
        toPlayer: sidebarTargetPlayer,
        text: `${currentUser.name} дарит: ${actionDef.label} ${sidebarTargetPlayer.name}`,
        timestamp: Date.now(),
      },
    })
  }

  /* ---- skip / advance turn ---- */
  const handleSkipTurn = () => {
    clearResultTimers()
    dispatch({ type: "NEXT_TURN" })
  }

  const thankDonorFromPlayer = useCallback(
    (fromPlayerId: number) => {
      if (!bottleDonorId) return
      const donorIdx = players.findIndex((p) => p.id === bottleDonorId)
      const fromIdx = players.findIndex((p) => p.id === fromPlayerId)
      if (donorIdx === -1 || fromIdx === -1 || bottleDonorId === fromPlayerId) return

      const fromPlayer = players.find((p) => p.id === fromPlayerId)
      const donor = players.find((p) => p.id === bottleDonorId)
      if (!fromPlayer || !donor) return

      for (let i = 0; i < 3; i++) {
        setTimeout(() => launchEmoji(fromIdx, donorIdx, undefined, undefined, true), i * 120)
      }
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "bottle_thanks",
          fromPlayer,
          toPlayer: donor,
          text: `${fromPlayer.name} благодарит ${donor.name} за бутылочку`,
          timestamp: Date.now(),
        },
      })
    },
    [bottleDonorId, players, launchEmoji, dispatch],
  )

  const handleThankDonor = useCallback(() => {
    if (!currentUser) return
    thankDonorFromPlayer(currentUser.id)
  }, [currentUser, thankDonorFromPlayer])

  /* ---- боты рандомно нажимают «Спасибо» донору бутылочки ---- */
  useEffect(() => {
    if (!bottleDonorId || players.length === 0) return
    const donorId = bottleDonorId
    const botsWhoCanThank = players.filter(
      (p) => p.isBot && p.id !== donorId && p.id !== currentUser?.id,
    )
    if (botsWhoCanThank.length === 0) return

    const interval = setInterval(() => {
      if (Math.random() > 0.35) return
      const bot = botsWhoCanThank[Math.floor(Math.random() * botsWhoCanThank.length)]
      if (bot) thankDonorFromPlayer(bot.id)
    }, 12000)

    return () => clearInterval(interval)
  }, [bottleDonorId, players, currentUser?.id, thankDonorFromPlayer])

  /* ---- bot auto-actions on result (random, 1–3 actions) ---- */
  useEffect(() => {
    if (!showResult || !currentTurnPlayer || !currentTurnPlayer.isBot) return
    if (!targetPlayer || !targetPlayer2) return
    if (botActionRoundRef.current === roundNumber) return

    botActionRoundRef.current = roundNumber

    // Вероятность, что бот сделает несколько действий (иначе — как сейчас, ничего)
    if (Math.random() < 0.4) return

    const combo = getPairGenderCombo(targetPlayer, targetPlayer2)
    const actionsForPair = getActionsForPair(combo)
      .filter((a) => a.id !== "skip")
    if (!actionsForPair.length) return

    const actionsShuffled = [...actionsForPair].sort(() => Math.random() - 0.5)
    const count = 1 + Math.floor(Math.random() * Math.min(3, actionsShuffled.length))
    const chosen = actionsShuffled.slice(0, count)

    chosen.forEach((a, index) => {
      setTimeout(() => {
        handlePerformAction(a.id)
      }, 500 + index * 700)
    })
  }, [showResult, currentTurnPlayer, targetPlayer, targetPlayer2, roundNumber])

  /* ---- prediction submit ---- */
  const _handleSubmitPrediction = () => {
    if (CASUAL_MODE) return
    if (!predictionTarget || !predictionTarget2 || !currentUser) return
    if (predictionTarget.id === predictionTarget2.id) return

    const pair = sortPair(predictionTarget.id, predictionTarget2.id)
    dispatch({
      type: "ADD_PREDICTION",
      prediction: {
        playerId: currentUser.id,
        playerName: currentUser.name,
        targetPair: pair,
      },
    })
    setPredictionMade(true)
    setShowPredictionPicker(false)

    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "prediction",
        fromPlayer: currentUser,
        text: `${currentUser.name} сделал(а) прогноз`,
        timestamp: Date.now(),
      },
    })
  }

  /* ---- bet submit ---- */
  const handleSubmitBet = () => {
    if (CASUAL_MODE) return
    if (!betTarget1 || !betTarget2 || !currentUser) return
    if (betTarget1.id === betTarget2.id) return
    if (betAmount <= 0 || betAmount > voiceBalance) return

    const pair = sortPair(betTarget1.id, betTarget2.id)
    dispatch({
      type: "PLACE_BET",
      bet: {
        playerId: currentUser.id,
        playerName: currentUser.name,
        targetPair: pair,
        amount: betAmount,
      },
    })
    setBetPlaced(true)
    setShowBetPicker(false)

    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "system",
        fromPlayer: currentUser,
        text: `${currentUser.name} поставил(а) ${betAmount} сердец`,
        timestamp: Date.now(),
      },
    })
  }

  /* ---- invite / pay ---- */
  const handleInvite = async () => {
    const tp = resolvedTargetPlayer
    if (!tp) return
    if (voiceBalance < 5) {
      showToast("Недостаточно сердец для приглашения", "error")
      return
    }
    setPaymentLoading(true)
    try {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)
      if (resultTimerRef.current) clearInterval(resultTimerRef.current)
      dispatch({ type: "PAY_VOICES", amount: 5 })
      dispatch({ type: "ADD_FAVORITE", player: tp })
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "invite",
          fromPlayer: currentUser!,
          toPlayer: tp,
          text: `${currentUser!.name} приглашает ${tp.name} общаться`,
          timestamp: Date.now(),
        },
      })
      setShowPaymentDialog(false)
      dispatch({ type: "OPEN_CHAT", player: tp })
      showToast("Приглашение отправлено", "success")
    } finally {
      setPaymentLoading(false)
    }
  }

  const _handleMutualInvite = () => {
    const tp = resolvedTargetPlayer
    const tp2 = resolvedTargetPlayer2
    if (!currentUser || !tp || !tp2) return
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)
    if (resultTimerRef.current) clearInterval(resultTimerRef.current)

    const combo = getPairGenderCombo(tp, tp2)
    const mutualActionId = combo === "MF" ? "kiss" : combo === "MM" ? "beer" : "cocktail"

    const otherPlayer =
      currentUser.id === tp.id ? tp2
      : currentUser.id === tp2.id ? tp
      : tp

    const fromIdx = players.findIndex((p) => p.id === currentUser.id)
    const toIdx = players.findIndex((p) => p.id === otherPlayer.id)
    const mutualEmoji: Record<string, string> = {
      kiss: "\uD83D\uDC8B",
      beer: "\uD83C\uDF7A",
      cocktail: "\uD83C\uDF79",
      lipstick: "\uD83D\uDC84",
    }
    if (fromIdx !== -1 && toIdx !== -1 && mutualEmoji[mutualActionId]) {
      launchEmoji(fromIdx, toIdx, mutualEmoji[mutualActionId])
      playEmotionSound(mutualActionId)
    }

    if (mutualActionId === "beer" || mutualActionId === "cocktail") {
      dispatch({ type: "ADD_DRUNK_TIME", playerId: currentUser.id, ms: 60_000 })
    }

    dispatch({ type: "ADD_FAVORITE", player: otherPlayer })
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: mutualActionId as GameLogEntry["type"],
        fromPlayer: currentUser,
        toPlayer: otherPlayer,
        text:
          mutualActionId === "kiss"
            ? `${currentUser.name} поцеловал(а) в ответ ${otherPlayer.name}`
            : mutualActionId === "beer"
              ? `${currentUser.name} выпил(а) пива вместе с ${otherPlayer.name}`
              : mutualActionId === "cocktail"
                ? `${currentUser.name} выпил(а) коктейль вместе с ${otherPlayer.name}`
                : `${currentUser.name} подарил(а) помаду ${otherPlayer.name}`,
        timestamp: Date.now(),
      },
    })
    setShowPaymentDialog(false)
    dispatch({ type: "OPEN_CHAT", player: otherPlayer })
  }

  /* ---- send chat message ---- */
  const handleSendChat = useCallback(() => {
    const msg = chatInput.trim()
    if (!msg || !currentUser || tablePaused) return
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "chat",
        fromPlayer: currentUser,
        text: msg,
        timestamp: Date.now(),
      },
    })
    setChatInput("")
    void fetchTableAuthority(tableId)
  }, [chatInput, currentUser, tablePaused, dispatch, fetchTableAuthority, tableId])

  /* ---- player avatar click ---- */
  const handlePlayerClick = (player: Player) => {
    if (player.id === currentUser?.id) return

    // During prediction phase - select player directly on the board
    if (predictionPhase && !predictionMade && !isSpinning && !showResult) {
      if (!predictionTarget) {
        setPredictionTarget(player)
        return
      }
      if (predictionTarget.id === player.id) {
        // Deselect
        setPredictionTarget(null)
        setPredictionTarget2(null)
        return
      }
      if (!predictionTarget2) {
        setPredictionTarget2(player)
        // Auto-submit prediction when both selected
        const pair = sortPair(predictionTarget.id, player.id)
        dispatch({
          type: "ADD_PREDICTION",
          prediction: {
            playerId: currentUser!.id,
            playerName: currentUser!.name,
            targetPair: pair,
          },
        })
        setPredictionMade(true)
        dispatch({
          type: "ADD_LOG",
          entry: {
            id: generateLogId(),
            type: "prediction",
            fromPlayer: currentUser!,
            text: `${currentUser!.name} сделал(а) прогноз: ${predictionTarget.name} & ${player.name}`,
            timestamp: Date.now(),
          },
        })
        return
      }
      if (predictionTarget2.id === player.id) {
        // Deselect second
        setPredictionTarget2(null)
        return
      }
      return
    }

    // Обычный клик по аватарке на столе:
    // открываем мини-меню под выбранной аватаркой.
    const nextTarget = sidebarTargetPlayer?.id === player.id ? null : player
    setSidebarTargetPlayer(nextTarget)
    setSidebarGiftMode(false)
    setGiftCatalogDrawerPlayer(null)
  }

  /* ---- extra spin (pay 50 voices) ---- */
  const handleExtraSpin = () => {
    if (voiceBalance < 10) {
      showToast("Нужно минимум 10 сердец", "error")
      return
    }
    dispatch({ type: "PAY_VOICES", amount: 10 })
    dispatch({
      type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "system",
          fromPlayer: currentUser!,
          text: `${currentUser!.name} оплатил(а) внеочередное кручение (10 сердец)`,
          timestamp: Date.now(),
        },
    })
    if (currentUser) {
      dispatch({ type: "REQUEST_EXTRA_TURN", playerId: currentUser.id })
    }
    showToast("Внеочередное кручение оплачено", "success")
  }

  /* ---- get pair combo for current result ---- */
  const currentPairCombo: PairGenderCombo | null =
    resolvedTargetPlayer && resolvedTargetPlayer2
      ? getPairGenderCombo(resolvedTargetPlayer, resolvedTargetPlayer2)
      : null

  const availableActions = useMemo(() => {
    if (!currentPairCombo) return []
    return getActionsForPair(currentPairCombo)
  }, [currentPairCombo])

  const canRespondInResult = !!(
    showResult &&
    resolvedTargetPlayer &&
    resolvedTargetPlayer2 &&
    currentUser &&
    !currentUser.isBot &&
    (currentUser.id === resolvedTargetPlayer.id || currentUser.id === resolvedTargetPlayer2.id)
  )

  const sidebarActionCombo: PairGenderCombo | null = useMemo(() => {
    if (sidebarGiftMode && currentUser && sidebarTargetPlayer) {
      return getPairGenderCombo(currentUser, sidebarTargetPlayer)
    }
    // В обычном режиме не раскрываем будущую пару во время вращения:
    // обновляем набор эмоций только когда результат уже показан.
    if (showResult) {
      return currentPairCombo
    }
    return null
  }, [sidebarGiftMode, currentUser, sidebarTargetPlayer, currentPairCombo, showResult])

  useEffect(() => {
    if (sidebarActionCombo) {
      setLastSidebarCombo(sidebarActionCombo)
    }
  }, [sidebarActionCombo])

  const effectiveSidebarCombo: PairGenderCombo = sidebarActionCombo ?? lastSidebarCombo ?? "MF"

  const sidebarAvailableActions = useMemo(() => {
    const actions = getActionsForPair(effectiveSidebarCombo)
    return sidebarGiftMode ? actions.filter((a) => a.id !== "skip") : actions
  }, [effectiveSidebarCombo, sidebarGiftMode])

  const isSidebarEmotionActionActive =
    (!!currentUser && !currentUser.isBot && sidebarGiftMode && !!sidebarTargetPlayer) ||
    (showResult && isMyTurn) ||
    canRespondInResult

  const sidebarEmotionTitle = sidebarGiftMode ? "Подарить эмоцию" : "Эмоции"
  const sidebarEmotionSubtitle =
    sidebarGiftMode && sidebarTargetPlayer
      ? `Выбрано: ${sidebarTargetPlayer.name}`
      : "Выбери аватар и нажми «Подарить эмоцию»"
  const shouldShowSidebarEmotionSubtitle =
    sidebarGiftMode && !!sidebarTargetPlayer

  const showMobileEmotionStrip =
    isMobile &&
    Boolean(
      (sidebarGiftMode && sidebarTargetPlayer) ||
        (showResult &&
          resolvedTargetPlayer &&
          resolvedTargetPlayer2 &&
          (isEmotionLimitReached ||
            isMyTurn ||
            (currentUser &&
              !currentUser.isBot &&
              (currentUser.id === resolvedTargetPlayer.id ||
                currentUser.id === resolvedTargetPlayer2.id)))),
    )

  const todayKey = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString().slice(0, 10)
  }, [])

  // ---- DAILY QUESTS (computed from today's gameLog) ----
  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [])

  const todayEntries = useMemo(
    () => gameLog.filter((e) => e.timestamp >= todayStart),
    [gameLog, todayStart],
  )

  /** Подарки из каталога: по типам (роза, цветы и т.д.) или запись «дарит подарок» из каталога игрока */
  const GIFT_LOG_TYPES = new Set([
    "rose", "flowers", "song", "diamond", "gift_voice", "tools", "lipstick",
  ])
  const giftsToday =
    currentUser
      ? todayEntries.filter(
          (e) =>
            e.fromPlayer?.id === currentUser.id &&
            (GIFT_LOG_TYPES.has(e.type) || (e.type === "system" && e.text.includes("дарит подарок"))),
        ).length
      : 0

  /** Эмоции/действия: поцелуй, пиво, коктейль, цветы, бриллиант, баня, инструменты, помада */
  const EMOTION_LOG_TYPES = new Set([
    "kiss", "beer", "cocktail", "flowers", "diamond", "banya", "tools", "lipstick",
  ])
  const emotionsToday =
    currentUser
      ? todayEntries.filter(
          (e) => e.fromPlayer?.id === currentUser.id && EMOTION_LOG_TYPES.has(e.type),
        ).length
      : 0

  const careToday =
    currentUser
      ? todayEntries.filter(
          (e) => e.fromPlayer?.id === currentUser.id && e.type === "care",
        ).length
      : 0

  const spinsToday =
    currentUser
      ? todayEntries.filter(
          (e) =>
            e.fromPlayer?.id === currentUser.id &&
            e.text.startsWith("Выпала пара:"),
        ).length
      : 0

  const predictionsToday =
    currentUser
      ? todayEntries.filter(
          (e) =>
            e.fromPlayer?.id === currentUser.id &&
            e.type === "prediction" &&
            e.text.includes("сделал(а) прогноз"),
        ).length
      : 0

  const chatMessagesToday =
    currentUser
      ? todayEntries.filter(
          (e) =>
            e.fromPlayer?.id === currentUser.id &&
            e.type === "chat",
        ).length
      : 0

  const purchasesToday =
    currentUser
      ? todayEntries.filter(
          (e) =>
            e.fromPlayer?.id === currentUser.id &&
            e.type === "system" &&
            e.text.toLowerCase().includes("купил"),
        ).length
      : 0

  /** Пул шаблонов заданий. По дате выбираются 5 рандомных (детерминированно на месяц). */
  const DAILY_QUEST_POOL = useMemo(
    () => [
      { type: "gifts" as const, target: 2, label: "Подарить 2 подарка из каталога" },
      { type: "gifts" as const, target: 3, label: "Подарить 3 подарка из каталога" },
      { type: "emotions" as const, target: 3, label: "Совершить 3 эмоции или действия" },
      { type: "emotions" as const, target: 5, label: "Совершить 5 эмоций или действий" },
      { type: "emotions" as const, target: 7, label: "Совершить 7 эмоций или действий" },
      { type: "care" as const, target: 1, label: "Ухаживать 1 раз" },
      { type: "spins" as const, target: 3, label: "Покрутить бутылку 3 раза" },
      { type: "spins" as const, target: 5, label: "Покрутить бутылку 5 раз" },
      { type: "gifts" as const, target: 4, label: "Отправить 4 подарка" },
      { type: "purchases" as const, target: 1, label: "Купить 1 товар" },
      { type: "purchases" as const, target: 2, label: "Купить 2 товара" },
    ],
    [],
  )

  /** Детерминированный «рандом» по ключу даты: один и тот же день месяца даёт одни и те же 5 заданий. */
  const getQuestsForDay = useCallback(
    (dateKey: string) => {
      const [y, m, d] = dateKey.split("-").map(Number)
      const seed = (y * 372 + m * 31 + d) % 2147483647
      const next = (s: number) => (s * 16807) % 2147483647
      const indices: number[] = []
      let s = seed
      for (let i = 0; i < 5; i++) {
        s = next(s)
        indices.push(s % DAILY_QUEST_POOL.length)
      }
      return indices.map((i) => DAILY_QUEST_POOL[i])
    },
    [DAILY_QUEST_POOL],
  )

  const todayQuests = useMemo(() => getQuestsForDay(todayKey), [getQuestsForDay, todayKey])

  const getProgressForType = useCallback(
    (type: string) => {
      switch (type) {
        case "gifts":
          return giftsToday
        case "emotions":
          return emotionsToday
        case "care":
          return careToday
        case "spins":
          return spinsToday
        case "predictions":
          return predictionsToday
        case "chat":
          return chatMessagesToday
        case "purchases":
          return purchasesToday
        default:
          return 0
      }
    },
    [giftsToday, emotionsToday, careToday, spinsToday, predictionsToday, chatMessagesToday, purchasesToday],
  )

  const [confettiQuestIndex, setConfettiQuestIndex] = useState<number | null>(null)
  const [dailyProgressPoints, setDailyProgressPoints] = useState(0)
  const [dailyRewardedLevels, setDailyRewardedLevels] = useState<number[]>([])

  const completedQuests = (dailyQuests?.dateKey === todayKey ? (dailyQuests.claimed.filter(Boolean).length) : 0)

  const DAILY_LEVEL_MAX = 30

  const LEVEL_REWARDS: LevelReward[] = useMemo(() => {
    const levelTitles = [
      "Первые шаги",
      "Тёплое знакомство",
      "Приятный собеседник",
      "Гость вечеринки",
      "Лёгкий флирт",
      "Уверенный участник",
      "Душа компании",
      "Мастер улыбок",
      "Звезда чата",
      "Любимчик стола",
      "Искра вечера",
      "Сердечный друг",
      "Магнит внимания",
      "Профи эмоций",
      "Ритм вечеринки",
      "Сияние стола",
      "Король харизмы",
      "Королева харизмы",
      "Чемпион улыбок",
      "Огонь общения",
      "Лидер флирта",
      "Серебряный уровень",
      "Золотой уровень",
      "Платиновый уровень",
      "Алмазный уровень",
      "Легенда эмоций",
      "Легенда чата",
      "Легенда флирта",
      "Легенда вечера",
      "Абсолютная легенда",
    ] as const
    return Array.from({ length: DAILY_LEVEL_MAX }, (_, idx) => {
      const level = idx + 1
      // Сильная прогрессия наград: с 100 монет и выше по уровню.
      const hearts = (100 + (level - 1) * 20) * 5
      const title = levelTitles[idx] ?? `Уровень ${level}`
      return { level, hearts, title }
    })
  }, [])

  const getDailyLevelByPoints = useCallback((points: number): number => {
    let spent = 0
    let level = 1
    while (level < DAILY_LEVEL_MAX) {
      const need = 2 + Math.floor((level - 1) / 2)
      if (points < spent + need) break
      spent += need
      level += 1
    }
    return level
  }, [])

  const getPointsIntoCurrentLevel = useCallback((points: number): { current: number; need: number } => {
    let spent = 0
    let level = 1
    while (level < DAILY_LEVEL_MAX) {
      const need = 2 + Math.floor((level - 1) / 2)
      if (points < spent + need) {
        return { current: Math.max(0, points - spent), need }
      }
      spent += need
      level += 1
    }
    return { current: 0, need: 1 }
  }, [])

  const dailyLevel = useMemo(
    () => getDailyLevelByPoints(dailyProgressPoints),
    [dailyProgressPoints, getDailyLevelByPoints],
  )
  const dailyLevelProgress = useMemo(
    () => getPointsIntoCurrentLevel(dailyProgressPoints),
    [dailyProgressPoints, getPointsIntoCurrentLevel],
  )
  const nextDailyLevel = Math.min(DAILY_LEVEL_MAX, dailyLevel + 1)

  useEffect(() => {
    if (!currentUser) return
    try {
      const key = `botl_daily_level_v1_${currentUser.id}`
      const raw = localStorage.getItem(key)
      if (!raw) {
        setDailyProgressPoints(0)
        setDailyRewardedLevels([])
        return
      }
      const parsed = JSON.parse(raw) as { points?: number; rewardedLevels?: number[] }
      setDailyProgressPoints(typeof parsed.points === "number" ? Math.max(0, parsed.points) : 0)
      const sanitizedLevels = Array.isArray(parsed.rewardedLevels)
        ? [...new Set(parsed.rewardedLevels)]
            .filter((x) => Number.isFinite(x) && x >= 1 && x <= DAILY_LEVEL_MAX)
            .sort((a, b) => a - b)
        : []
      setDailyRewardedLevels(sanitizedLevels)
    } catch {
      setDailyProgressPoints(0)
      setDailyRewardedLevels([])
    }
  }, [currentUser])

  const handleClaimDailyQuest = useCallback(
    (questIndex: number) => {
      if (!currentUser) return
      const dq = dailyQuests?.dateKey === todayKey ? dailyQuests : undefined
      const claimed = dq?.claimed ?? [false, false, false, false, false]
      if (claimed[questIndex]) {
        showToast("Награда уже получена", "info")
        return
      }
      const q = todayQuests[questIndex]
      const progress = getProgressForType(q.type)
      if (progress < q.target) {
        showToast("Задание ещё не выполнено", "info")
        return
      }
      dispatch({ type: "CLAIM_DAILY_QUEST", questIndex, dateKey: todayKey })
      dispatch({
        type: "ADD_INVENTORY_ITEM",
        item: {
          type: "rose",
          fromPlayerId: 0,
          fromPlayerName: "Система",
          timestamp: Date.now(),
        },
      })
      setConfettiQuestIndex(questIndex)
      setTimeout(() => setConfettiQuestIndex(null), 2200)
      showToast("Награда: роза в инвентаре", "success")

      const prevPoints = dailyProgressPoints
      const nextPoints = prevPoints + 1
      const prevLevel = getDailyLevelByPoints(prevPoints)
      const nextLevel = getDailyLevelByPoints(nextPoints)
      const alreadyRewarded = new Set(dailyRewardedLevels)
      const claimedNow: number[] = []

      for (let lvl = prevLevel + 1; lvl <= nextLevel; lvl++) {
        if (alreadyRewarded.has(lvl)) continue
        const reward = LEVEL_REWARDS.find((r) => r.level === lvl)
        if (!reward) continue
        if (reward.hearts > 0) {
          dispatch({ type: "PAY_VOICES", amount: -reward.hearts })
        }
        claimedNow.push(lvl)
      }

      setDailyProgressPoints(nextPoints)
      const nextRewardedLevels = [...new Set([...dailyRewardedLevels, ...claimedNow])].sort((a, b) => a - b)
      setDailyRewardedLevels(nextRewardedLevels)

      if (currentUser) {
        try {
          const key = `botl_daily_level_v1_${currentUser.id}`
          localStorage.setItem(
            key,
            JSON.stringify({ points: nextPoints, rewardedLevels: nextRewardedLevels }),
          )
        } catch {
          // ignore
        }
      }

      if (claimedNow.length > 0) {
        const lastLevel = claimedNow[claimedNow.length - 1]
        const reward = LEVEL_REWARDS.find((r) => r.level === lastLevel)
        if (reward) {
          showToast(`Уровень ${lastLevel}: +${reward.hearts} монет ❤`, "success")
        }
      }
    },
    [
      currentUser,
      dailyQuests,
      todayKey,
      todayQuests,
      getProgressForType,
      dispatch,
      showToast,
      dailyProgressPoints,
      dailyRewardedLevels,
      LEVEL_REWARDS,
      getDailyLevelByPoints,
    ],
  )

  /* ---- смена стола ---- */
  const handleChangeTable = async () => {
    if (!currentUser) return

    const changed = await syncLiveTable("join", true)
    if (changed) {
      showToast("Стол обновлён — живые игроки подключаются автоматически", "success")
      return
    }

    // Фолбэк на локальный режим, если API временно недоступно.
    const localBots = generateBots(220, currentUser.gender)
    const localPlayers = composeTablePlayers({
      currentUser: { ...currentUser, isBot: false },
      livePlayers: [{ ...currentUser, isBot: false }],
      existingPlayers: players,
      maxTableSize: 10,
      targetMales: 5,
      targetFemales: 5,
      botPool: localBots,
    }).sort(() => Math.random() - 0.5)
    dispatch({ type: "SET_TABLE", players: localPlayers, tableId: 7000 + Math.floor(Math.random() * 1000) })
    dispatch({ type: "SET_TABLES_COUNT", tablesCount: tablesCount ?? 1 })
    showToast("Сервер недоступен — включён локальный стол", "info")
  }

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  return (
    <div className="cinematic-desktop relative flex h-app w-full min-h-0 flex-row items-stretch overflow-hidden game-bg-animated">
      {toast && <InlineToast toast={toast} />}
      <WelcomeGiftDialog
        open={showWelcomeGift}
        onOpenChange={setShowWelcomeGift}
        userName={currentUser?.name ?? ""}
        onClaim={handleClaimWelcomeGift}
      />

      <TableLoaderOverlay
        visible={tableLoading}
        liveReady={tableLiveReady}
        authorityReady={tableAuthorityReady}
        hasPlayers={players.length > 0}
        hasCurrentUser={currentUser != null && players.some(p => p.id === currentUser.id)}
        isPcLayout={isPcLayout}
        onDone={() => setTableLoading(false)}
      />

      {/* Пауза: пользователь вышел из live-стола */}
      {tablePaused && currentUser && (
        <div className="fixed inset-0 z-[46] flex items-center justify-center bg-black/45 p-6 backdrop-blur-md">
          <div
            className="w-full max-w-md rounded-2xl border px-5 py-5 text-center shadow-2xl"
            style={{
              background: "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(2,6,23,0.98) 100%)",
              borderColor: "rgba(148,163,184,0.25)",
            }}
          >
            <p className="text-lg font-extrabold text-slate-100">Пауза</p>
            <p className="mt-2 text-sm text-slate-400">
              Вы вышли из стола и не участвуете в очереди. Нажмите «Возобновить», чтобы вернуться за стол.
            </p>
            <button
              type="button"
              onClick={async () => {
                dispatch({ type: "SET_TABLE_PAUSED", paused: false })
                await syncLiveTable("join", false)
                showToast("Вы вернулись за стол", "success")
              }}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold text-slate-950 transition-all hover:brightness-110 active:scale-[0.99]"
              style={{
                background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
                border: "1px solid rgba(125,211,252,0.6)",
                boxShadow: "0 2px 0 rgba(15,23,42,0.85)",
              }}
            >
              Возобновить
            </button>
          </div>
        </div>
      )}

      {/* Покупка доп. лимита эмоций (+50 к типу за 10 ❤) */}
      {emotionPurchaseOpen && currentUser && (
        <div className="fixed inset-0 z-[47] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border px-5 py-5 shadow-2xl"
            style={{
              background: "linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.99) 100%)",
              borderColor: "rgba(148,163,184,0.3)",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="emotion-purchase-title"
          >
            <h2 id="emotion-purchase-title" className="text-lg font-extrabold text-slate-100">
              Купить доп. эмоции
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              +{EMOTION_QUOTA_PURCHASE_AMOUNT} использований к каждому выбранному типу до конца суток. Цена —{" "}
              <span className="heart-price heart-price--compact text-rose-200">{EMOTION_QUOTA_COST_PER_TYPE_HEARTS} ❤</span> за тип.
            </p>
            <div className="mt-4 space-y-2">
              {(
                [
                  { id: "kiss" as const, label: "Поцелуй", emoji: "💋" },
                  { id: "beer" as const, label: "Пиво", emoji: "🍺" },
                  { id: "cocktail" as const, label: "Коктейль", emoji: "🍹" },
                ] as const
              ).map((row) => (
                <label
                  key={row.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-600/60 bg-slate-900/80 px-3 py-2.5 transition hover:bg-slate-800/90"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-500 accent-cyan-500"
                    checked={emotionPurchasePick[row.id]}
                    onChange={(e) =>
                      setEmotionPurchasePick((p) => ({ ...p, [row.id]: e.target.checked }))
                    }
                  />
                  <span className="text-lg" aria-hidden>
                    {row.emoji}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-slate-100">{row.label}</span>
                  <span className="text-xs tabular-nums text-cyan-300/90">+{EMOTION_QUOTA_PURCHASE_AMOUNT}</span>
                </label>
              ))}
            </div>
            <p className="mt-4 flex items-center justify-between border-t border-slate-700/80 pt-3 text-sm text-slate-300">
              <span>К оплате</span>
              <span className="heart-price heart-price--compact text-amber-200">
                {(
                  (emotionPurchasePick.kiss ? 1 : 0) +
                  (emotionPurchasePick.beer ? 1 : 0) +
                  (emotionPurchasePick.cocktail ? 1 : 0)
                ) * EMOTION_QUOTA_COST_PER_TYPE_HEARTS}{" "}
                ❤
              </span>
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEmotionPurchaseOpen(false)}
                className="order-2 h-11 rounded-xl border border-slate-600 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 sm:order-1"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmEmotionQuotaPurchase}
                disabled={
                  voiceBalance <
                    ((emotionPurchasePick.kiss ? 1 : 0) +
                      (emotionPurchasePick.beer ? 1 : 0) +
                      (emotionPurchasePick.cocktail ? 1 : 0)) *
                      EMOTION_QUOTA_COST_PER_TYPE_HEARTS ||
                  !(emotionPurchasePick.kiss || emotionPurchasePick.beer || emotionPurchasePick.cocktail)
                }
                className="order-1 h-11 rounded-xl px-4 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-40 sm:order-2"
                style={{
                  background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
                  border: "1px solid rgba(125,211,252,0.6)",
                }}
              >
                Купить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-left controls: музыка и звуки эмоций; на мобильной — в ряд, без общей оболочки */}
      <div
        className={`fixed z-40 flex max-w-[calc(100vw-1rem)] gap-1.5 overflow-x-auto ${
          isMobile
            ? "left-2 max-md:top-[calc(env(safe-area-inset-top)+4.35rem)] md:top-2 flex-row items-center"
            : "left-1 top-1 flex-col items-start"
        }`}
      >
        <div
          className={
            isMobile
              ? "max-md:hidden flex flex-row items-center gap-1.5 shrink-0"
              : "contents"
          }
        >
        <div
          className="flex shrink-0 items-center gap-2 rounded-xl border border-transparent py-0.5 pl-0.5 pr-1"
          onMouseEnter={() => {
            if (musicTooltipTimeoutRef.current) {
              clearTimeout(musicTooltipTimeoutRef.current)
              musicTooltipTimeoutRef.current = null
            }
            setShowMusicTooltip(true)
          }}
          onMouseLeave={() => {
            musicTooltipTimeoutRef.current = setTimeout(() => setShowMusicTooltip(false), 280)
          }}
        >
          <button
            type="button"
            onClick={() => setMusicEnabled((v) => !v)}
            className="flex items-center gap-1 rounded-xl border px-2.5 py-1.5 sm:py-1 text-[11px] sm:text-[11px] font-semibold shadow-sm min-h-[32px] sm:min-h-0"
            style={{
              borderColor: "rgba(148, 163, 184, 0.6)",
              background: "rgba(30, 41, 59, 0.6)",
              color: "#e5e7eb",
            }}
          >
            <span aria-hidden="true">{musicEnabled ? "🔊" : "🔇"}</span>
            <span className="hidden sm:inline">{musicEnabled ? "Музыка: вкл" : "Музыка: выкл"}</span>
            <span className="sm:hidden">{musicEnabled ? "Муз вкл" : "Муз выкл"}</span>
          </button>
          {showMusicTooltip && (
            <div className="flex min-w-0 items-center gap-2 bg-transparent px-0 py-0">
              <span
                className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-amber-300"
                aria-live="polite"
              >
                {musicVolume}%
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={musicVolume}
                onChange={(e) => setMusicVolume(Number(e.target.value))}
                className="h-2 w-[4.5rem] shrink-0 cursor-pointer sm:w-24"
                style={{ accentColor: "#fbbf24" }}
                aria-label="Громкость музыки"
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_SOUNDS_ENABLED", enabled: soundsEnabled === false })}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 sm:py-1 text-[11px] sm:text-[11px] font-semibold shadow-sm min-h-[32px] sm:min-h-0 select-none"
          style={{
            borderColor: "rgba(148, 163, 184, 0.6)",
            background: "rgba(30, 41, 59, 0.6)",
            color: "#e5e7eb",
          }}
        >
          <span aria-hidden="true">{soundsEnabled === false ? "🔇" : "🔊"}</span>
          <span className="hidden sm:inline">{soundsEnabled === false ? "Звуки: выкл" : "Звуки: вкл"}</span>
          <span className="sm:hidden">{soundsEnabled === false ? "Звук выкл" : "Звук вкл"}</span>
        </button>
        </div>
        {isMobile && currentUser && currentTurnPlayer?.id === currentUser.id && turnTimer !== null && (
          <div
            className="flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm min-h-[32px]"
            style={{
              borderColor: "rgba(148, 163, 184, 0.6)",
              background: "rgba(30, 41, 59, 0.6)",
              color: "#e5e7eb",
            }}
          >
            <span>{"ход"}</span>
            <span className="text-base font-bold" style={{ color: turnTimer <= 5 ? "#f97373" : "#facc15" }}>
              {turnTimer}
            </span>
            <span style={{ color: "#9ca3af" }}>{"сек"}</span>
          </div>
        )}
      </div>

      {/* Фоновые частицы (пылинки) */}
      <div className="game-particles game-particles--dust">
        {gameRoomDustParticles.map((p, idx) => {
          const anim = p.rev ? `particleChaosRev${p.chaos + 1}` : `particleChaos${p.chaos + 1}`
          return (
            <div
              key={idx}
              className="pointer-events-none absolute"
              style={{ left: p.left, bottom: p.bottom, opacity: p.dustOpacity }}
            >
              <div
                className={`game-particles__dot ${p.pink ? "game-particles__dot--pink" : ""} ${p.yellow ? "game-particles__dot--yellow" : ""}`}
                style={
                  {
                    position: "relative",
                    left: 0,
                    bottom: 0,
                    ["--particle-anim"]: anim,
                    ["--particle-dur"]: p.dur,
                    ["--particle-delay"]: p.delay,
                    ["--particle-ease"]: BG_PARTICLE_EASE[(idx + p.chaos) % BG_PARTICLE_EASE.length],
                    ["--dust-size"]: p.dustSize,
                  } as CSSProperties
                }
              />
            </div>
          )
        })}
      </div>

      {/* ПК: 80% игровой стол + меню / 20% инфо и чат; на телефоне — без обёртки (display:contents) */}
      <div
        className={cn(
          isPcLayout
            ? "flex min-h-0 min-w-0 flex-[4] basis-0 flex-row overflow-hidden"
            : "contents",
        )}
      >
      {/* ---- LEFT БОКОВОЕ МЕНЮ (скрыто на мобильных); фикс. ширина, не сжимается при резине центра ---- */}
      <div
        className={cn(
          "relative z-20 shrink-0 flex-none flex-col gap-1.5 overflow-y-auto max-h-app p-2 pt-20 lg:pt-24 transition-[width] duration-200 ease-out",
          isPcLayout ? "flex" : "hidden md:flex",
          leftSideMenuExpanded ? "w-[190px]" : "w-14 lg:w-[190px]",
        )}
      >
        <div className="mb-1 flex shrink-0 items-center justify-center lg:hidden">
          <button
            type="button"
            onClick={() => setLeftSideMenuExpanded((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-slate-700/50"
            style={{
              borderColor: "rgba(71, 85, 105, 0.8)",
              background: "rgba(15, 23, 42, 0.85)",
            }}
            aria-expanded={leftSideMenuExpanded}
            aria-label={leftSideMenuExpanded ? "Свернуть боковое меню" : "Развернуть боковое меню"}
          >
            {leftSideMenuExpanded ? (
              <ChevronLeft className="h-5 w-5" style={{ color: "#e8c06a" }} />
            ) : (
              <ChevronRight className="h-5 w-5" style={{ color: "#e8c06a" }} />
            )}
          </button>
        </div>

        <div className={!leftSideMenuExpanded ? "max-lg:hidden" : ""}>
        <div
          className="rounded-lg p-2"
          style={{
            background: "rgba(15, 23, 42, 0.88)",
            border: "1px solid #475569",
          }}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" style={{ color: "#e8c06a" }} />
            <span className="text-[11px] font-bold" style={{ color: "#e8c06a" }}>
              {sidebarEmotionTitle}
            </span>
          </div>
          {shouldShowSidebarEmotionSubtitle && (
            <p className="mb-2 text-[10px] leading-tight" style={{ color: "#94a3b8" }}>
              {sidebarEmotionSubtitle}
            </p>
          )}

          <div className="mb-2 grid grid-cols-3 gap-1">
            {limitedEmotionCounters.map((row) => (
              <div key={row.id} className="rounded-md px-1 py-0.5 text-center" style={{ background: "rgba(30, 41, 59, 0.7)" }}>
                <p className="text-[10px] font-semibold" style={{ color: "#e2e8f0" }}>{row.emoji}</p>
                <p className="text-[10px] font-bold" style={{ color: row.left > 0 ? "#67e8f9" : "#fda4af" }}>
                  {row.used}/{row.limit}
                </p>
              </div>
            ))}
          </div>

          {isEmotionLimitReached && (
            <button
              type="button"
              onClick={openEmotionPurchaseModal}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
              disabled={voiceBalance < EMOTION_QUOTA_COST_PER_TYPE_HEARTS}
              style={{
                background: "linear-gradient(180deg, #22d3ee 0%, #6366f1 100%)",
                color: "#0f172a",
                border: "1px solid rgba(103, 232, 249, 0.9)",
                boxShadow: "0 1px 0 rgba(30, 64, 175, 0.9), 0 2px 8px rgba(34, 211, 238, 0.28)",
              }}
            >
              {`Купить +${EMOTION_QUOTA_PURCHASE_AMOUNT} (от ${EMOTION_QUOTA_COST_PER_TYPE_HEARTS} ❤)`}
            </button>
          )}

          <div className="flex max-h-[32dvh] flex-col gap-1 overflow-y-auto pr-0.5">
            {sidebarAvailableActions.map((action) => {
              const style = ACTION_BUTTON_STYLES[action.id] || ACTION_BUTTON_STYLES.skip
              const actionCost = getEffectiveActionCost(action.id, effectiveSidebarCombo)
              const canAfford = actionCost === 0 || voiceBalance >= actionCost
              const isDisabled = !isSidebarEmotionActionActive || !canAfford
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    if (sidebarGiftMode && sidebarTargetPlayer) {
                      handleSidebarGiftEmotion(action.id)
                      return
                    }
                    if (showResult && isMyTurn) {
                      handlePerformAction(action.id)
                      return
                    }
                    if (canRespondInResult) {
                      handleResponseEmotion(action.id)
                    }
                  }}
                  disabled={isDisabled}
                  className="flex items-center justify-start gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                  style={{
                    background: style.bg,
                    color: style.text,
                    border: `1px solid ${style.border}`,
                    boxShadow: `0 1px 0 ${style.shadow}, 0 2px 4px rgba(0,0,0,0.25)`,
                  }}
                >
                  {renderActionIcon(action)}
                  <span className="flex-1 truncate text-left">{action.label}</span>
                  {shouldShowActionCostBadge(action.id, actionCost) && (
                    <span className="heart-price heart-price--badge flex shrink-0 items-center rounded-full px-1 py-px opacity-95">
                      {actionCost}
                      <Heart className="heart-price__icon h-2.5 w-2.5" fill="currentColor" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
        </div>

        {/* ---- PREDICTION SECTION ---- */}
        <div className={!leftSideMenuExpanded ? "max-lg:hidden" : ""}>
        {!CASUAL_MODE && predictionPhase && !isSpinning && !showResult && (
          <div
            className="mb-2 rounded-lg p-2.5"
            style={{
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid #334155",
            }}
          >
            {/* Timer bar */}
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-3.5 w-3.5" style={{ color: "#e8c06a" }} />
              <span className="text-[11px] font-bold" style={{ color: "#e8c06a" }}>
                {"Прогноз"}
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <div
                  className="relative h-4 w-4 flex items-center justify-center rounded-full"
                  style={{
                    background: predictionTimer <= 3 ? "#e74c3c" : "#e8c06a",
                    boxShadow: predictionTimer <= 3 ? "0 0 8px rgba(231, 76, 60, 0.6)" : "none",
                  }}
                >
                  <span className="text-[8px] font-black" style={{ color: "#0f172a" }}>
                    {predictionTimer}
                  </span>
                </div>
              </div>
            </div>

            {/* Timer progress bar */}
            <div
              className="w-full h-1.5 rounded-full mb-2 overflow-hidden"
              style={{ background: "rgba(60, 35, 20, 0.8)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{
                  width: `${(predictionTimer / 10) * 100}%`,
                  background: predictionTimer <= 3
                    ? "linear-gradient(90deg, #e74c3c 0%, #c0392b 100%)"
                    : "linear-gradient(90deg, #2ecc71 0%, #27ae60 100%)",
                  boxShadow: predictionTimer <= 3
                    ? "0 0 6px rgba(231, 76, 60, 0.5)"
                    : "0 0 6px rgba(46, 204, 113, 0.4)",
                }}
              />
            </div>

            {!predictionMade ? (
              <>
                <p className="text-[10px] mb-1.5" style={{ color: "#94a3b8" }}>
                  {"Нажми на двух игроков на поле:"}
                </p>

                {/* Show current selection status */}
                <div className="flex items-center gap-1 mb-2">
                  <div
                    className="flex-1 flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[10px]"
                    style={{
                      background: predictionTarget ? "rgba(46, 204, 113, 0.2)" : "rgba(30, 41, 59, 0.8)",
                      border: `1px solid ${predictionTarget ? "#2ecc71" : "#334155"}`,
                      color: predictionTarget ? "#2ecc71" : "#94a3b8",
                    }}
                  >
                    {predictionTarget ? predictionTarget.name : "Игрок 1"}
                  </div>
                  <span className="text-[10px]" style={{ color: "#94a3b8" }}>&</span>
                  <div
                    className="flex-1 flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[10px]"
                    style={{
                      background: predictionTarget2 ? "rgba(46, 204, 113, 0.2)" : "rgba(30, 41, 59, 0.8)",
                      border: `1px solid ${predictionTarget2 ? "#2ecc71" : "#334155"}`,
                      color: predictionTarget2 ? "#2ecc71" : "#94a3b8",
                    }}
                  >
                    {predictionTarget2 ? predictionTarget2.name : "Игрок 2"}
                  </div>
                </div>

                {/* Reset selection */}
                {predictionTarget && (
                  <button
                    onClick={() => { setPredictionTarget(null); setPredictionTarget2(null) }}
                    className="w-full flex items-center justify-center gap-1 rounded px-2 py-1 text-[9px] transition-all hover:brightness-110"
                    style={{ background: "transparent", color: "#94a3b8", border: "1px solid #334155" }}
                  >
                    <X className="h-3 w-3" />
                    {"Сбросить выбор"}
                  </button>
                )}

                <div className="mt-1.5 flex items-center gap-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "#2ecc71", color: "#fff" }}>
                    {"+10"}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "#e74c3c", color: "#fff" }}>
                    {"-10"}
                  </span>
                  <span className="text-[8px] ml-auto" style={{ color: "#475569" }}>
                    {"бонусов"}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: "rgba(46, 204, 113, 0.15)", border: "1px solid #2ecc71" }}>
                <Target className="h-3 w-3" style={{ color: "#2ecc71" }} />
                <span className="text-[10px] font-semibold" style={{ color: "#2ecc71" }}>
                  {"Прогноз принят!"}
                </span>
              </div>
            )}

            {/* Show prediction result */}
            {predictionResult && (
              <div
                className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 animate-in fade-in duration-300"
                style={{
                  background: predictionResult === "correct" ? "rgba(46, 204, 113, 0.2)" : "rgba(231, 76, 60, 0.2)",
                  border: `1px solid ${predictionResult === "correct" ? "#2ecc71" : "#e74c3c"}`,
                }}
              >
                <Trophy className="h-3.5 w-3.5" style={{ color: predictionResult === "correct" ? "#2ecc71" : "#e74c3c" }} />
                <span className="text-[10px] font-bold" style={{ color: predictionResult === "correct" ? "#2ecc71" : "#e74c3c" }}>
                  {predictionResult === "correct" ? "+10 бонусов!" : "-10 бонусов"}
                </span>
              </div>
            )}
          </div>
        )}
        </div>

        {/* ---- BET SECTION ---- */}
        <div className={!leftSideMenuExpanded ? "max-lg:hidden" : ""}>
        {!CASUAL_MODE && predictionPhase && !isSpinning && !showResult && (
          <div
            className="mb-2 rounded-lg p-2.5"
            style={{
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid #334155",
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Coins className="h-3.5 w-3.5" style={{ color: "#e8c06a" }} />
              <span className="text-[11px] font-bold" style={{ color: "#e8c06a" }}>
                {"Ставка"}
              </span>
              {pot > 0 && (
                <span className="text-[9px] ml-auto px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(232, 192, 106, 0.2)", color: "#e8c06a", border: "1px solid #475569" }}>
                  {"POT: "}{pot}
                </span>
              )}
            </div>

            {!betPlaced ? (
              <>
                <div className="flex items-center gap-1 mb-2">
                  <button
                    onClick={() => setShowBetPicker(true)}
                    className="flex-1 flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[10px] truncate"
                    style={{
                      background: betTarget1 ? "rgba(232, 192, 106, 0.2)" : "rgba(60, 35, 20, 0.8)",
                      border: `1px solid ${betTarget1 ? "#e8c06a" : "#334155"}`,
                      color: "#f0e0c8",
                    }}
                  >
                    {betTarget1 ? betTarget1.name : "Игрок 1"}
                  </button>
                  <span className="text-[10px]" style={{ color: "#94a3b8" }}>&</span>
                  <button
                    onClick={() => setShowBetPicker(true)}
                    className="flex-1 flex items-center justify-center gap-1 rounded px-2 py-1.5 text-[10px] truncate"
                    style={{
                      background: betTarget2 ? "rgba(232, 192, 106, 0.2)" : "rgba(60, 35, 20, 0.8)",
                      border: `1px solid ${betTarget2 ? "#e8c06a" : "#334155"}`,
                      color: "#f0e0c8",
                    }}
                  >
                    {betTarget2 ? betTarget2.name : "Игрок 2"}
                  </button>
                </div>
                {/* Bet amount */}
                <div className="flex items-center gap-1 mb-2">
                  {[5, 10, 20, 50].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setBetAmount(amt)}
                      className="flex-1 rounded px-1 py-1 text-[10px] font-bold transition-all"
                      style={{
                        background: betAmount === amt ? "rgba(232, 192, 106, 0.3)" : "rgba(60, 35, 20, 0.8)",
                        border: `1px solid ${betAmount === amt ? "#e8c06a" : "#334155"}`,
                        color: betAmount === amt ? "#e8c06a" : "#94a3b8",
                      }}
                    >
                      {amt}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSubmitBet}
                  disabled={!betTarget1 || !betTarget2 || betTarget1.id === betTarget2.id || betAmount > voiceBalance}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                  style={{
                    background: "linear-gradient(180deg, #e8c06a 0%, #c4943a 100%)",
                    color: "#0f172a",
                    border: "1px solid #94a3b8",
                    boxShadow: "0 2px 0 #475569",
                  }}
                >
                  <Coins className="h-3 w-3" />
                  {"Поставить "}{betAmount}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: "rgba(232, 192, 106, 0.15)", border: "1px solid #475569" }}>
                <Coins className="h-3 w-3" style={{ color: "#e8c06a" }} />
                <span className="text-[10px] font-semibold" style={{ color: "#e8c06a" }}>
                  {"Ставка принята: "}{betAmount}
                </span>
              </div>
            )}

            {betWinnings !== null && (
              <div
                className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 animate-in fade-in duration-300"
                style={{ background: "rgba(46, 204, 113, 0.2)", border: "1px solid #2ecc71" }}
              >
                <Trophy className="h-3.5 w-3.5" style={{ color: "#2ecc71" }} />
                <span className="text-[10px] font-bold" style={{ color: "#2ecc71" }}>
                  {"Выигрыш: +"}{betWinnings}{" сердец!"}
                </span>
              </div>
            )}
            <p className="mt-1.5 text-[9px] text-slate-500 leading-tight">
              Сердечки — игровая валюта. Не является азартной игрой на деньги (п. 2.3.8 правил VK Mini Apps).
            </p>
          </div>
        )}
        </div>

        {/* ---- BALANCES + КНОПКИ ---- */}
        <div className="mt-auto flex flex-col gap-2">
          {/** Единый стиль для аккуратных кнопок бокового меню */}
          {(() => {
            const sideBtnClass =
              "flex items-center gap-1.5 rounded-[999px] px-3 py-2 transition-all hover:brightness-110 hover:-translate-y-[1px] min-h-[40px]" +
              (!leftSideMenuExpanded
                ? " max-lg:min-h-[44px] max-lg:w-11 max-lg:min-w-[44px] max-lg:justify-center max-lg:rounded-full max-lg:px-2 max-lg:gap-0"
                : "")
            const sideBtnTextClass =
              "text-[13px] font-semibold leading-none" + (!leftSideMenuExpanded ? " max-lg:hidden" : "")
            return (
              <>
          {/* Крутить вне очереди — только на мобильной (на ПК убрано из бокового меню) */}
          {!isMyTurn && !isSpinning && !showResult && countdown === null && (
            <div className={isPcLayout ? "hidden" : "md:hidden"}>
              <button
                onClick={handleExtraSpin}
                disabled={voiceBalance < 10}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                style={{
                  background: "linear-gradient(180deg, #9b59b6 0%, #8e44ad 100%)",
                  color: "#fff",
                  border: "2px solid #7d3c98",
                  boxShadow: "0 2px 0 #5b2c6f",
                }}
              >
                <RotateCw className="h-3.5 w-3.5" />
                {"Крутить вне очереди (10)"}
              </button>
            </div>
          )}

          {/* Ваш банк (сердца) */}
          <div
            className={
              "flex w-full min-w-0 items-center gap-1.5 rounded-[999px] px-2 py-2 min-h-[40px] sm:px-3" +
              (!leftSideMenuExpanded ? " max-lg:justify-center max-lg:px-2 max-lg:gap-1" : "")
            }
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
              border: "1px solid rgba(56,189,248,0.28)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
            }}
          >
            <div
              className={
                "flex min-w-0 flex-1 items-center gap-1.5" +
                (!leftSideMenuExpanded ? " max-lg:justify-center max-lg:flex-none" : "")
              }
            >
              <Heart className="h-5 w-5 shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]" style={{ color: "#fde68a" }} fill="currentColor" />
              <span className="text-[15px] font-black tabular-nums leading-none shrink-0 sm:text-base" style={{ color: "#fff" }}>{voiceBalance}</span>
              <span
                className={"text-[11px] leading-none truncate " + (!leftSideMenuExpanded ? "max-lg:hidden" : "")}
                style={{ color: "#cbd5e1" }}
              >
                {"Ваш банк"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })}
              className={
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:brightness-110 active:scale-95" +
                (!leftSideMenuExpanded ? " max-lg:flex" : "")
              }
              style={{
                border: "1px solid rgba(56,189,248,0.5)",
                color: "#7dd3fc",
                background: "linear-gradient(180deg, rgba(56,189,248,0.22) 0%, rgba(14,116,144,0.2) 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
              }}
              title="Пополнить банк"
              aria-label="Открыть магазин сердец"
            >
              <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden />
            </button>
          </div>

          {/* Магазин */}
          <button
            onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })}
            className={sideBtnClass}
            style={{
              background: "linear-gradient(135deg, #facc15 0%, #fb923c 100%)",
              border: "1px solid rgba(245, 158, 11, 0.8)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 10px 20px rgba(251,146,60,0.35)",
            }}
          >
            <Gift className="h-4 w-4" style={{ color: "#1f2937" }} />
            <span className={sideBtnTextClass} style={{ color: "#1f2937" }}>{"Магазин"}</span>
          </button>

          {/* Профиль */}
          <button
            onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "profile" })}
            className={sideBtnClass}
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
              border: "1px solid rgba(56,189,248,0.28)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
            }}
          >
            <User className="h-4 w-4" style={{ color: "#e8c06a" }} />
            <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Профиль"}</span>
          </button>

          {/* Бутылочка */}
          <button
            type="button"
            onClick={() => setShowBottleCatalog(true)}
            title={
              !leftSideMenuExpanded && cooldownLeftMs > 0
                ? `Бутылочка · ${formatCooldown(cooldownLeftMs)}`
                : cooldownLeftMs > 0
                  ? formatCooldown(cooldownLeftMs)
                  : "Бутылочка"
            }
            className={sideBtnClass}
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
              border: "1px solid rgba(56,189,248,0.28)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
            }}
          >
            <span className="text-base">{"🍾"}</span>
            <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>
              {"Бутылочка"}
            </span>
            {cooldownLeftMs > 0 && (
              <span
                className={"ml-auto text-xs font-semibold " + (!leftSideMenuExpanded ? "max-lg:hidden" : "")}
                style={{ color: "#e8c06a" }}
              >
                {formatCooldown(cooldownLeftMs)}
              </span>
            )}
          </button>

          {/* Сменить стол */}
          <button
            onClick={handleChangeTable}
            className={sideBtnClass}
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
              border: "1px solid rgba(56,189,248,0.28)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
            }}
          >
            <RotateCw className="h-4 w-4" style={{ color: "#e8c06a" }} />
            <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Сменить стол"}</span>
          </button>

          {/* Пауза: выйти из live-стола (явно) */}
          {currentUser && (
            <button
              type="button"
              onClick={() => {
                // Явно освобождаем место за live-столом и отключаем синхронизацию, пока пользователь не возобновит.
                const payload = JSON.stringify({ mode: "leave", userId: currentUser.id })
                try {
                  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
                    navigator.sendBeacon("/api/table/live", new Blob([payload], { type: "application/json" }))
                  } else {
                    void apiFetch("/api/table/live", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      keepalive: true,
                      body: payload,
                    }).catch(() => {})
                  }
                } catch {
                  // ignore
                }
                dispatch({ type: "SET_TABLE_PAUSED", paused: true })
                showToast("Пауза включена — вы покинули стол", "info")
              }}
              className={sideBtnClass}
              style={{
                background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
                border: "1px solid rgba(239,68,68,0.28)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
              }}
            >
              <span className="text-base" aria-hidden>{"⏸"}</span>
              <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Пауза"}</span>
            </button>
          )}

          {/* Рейтинг */}
          <button
            onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "rating" })}
            className={sideBtnClass}
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
              border: "1px solid rgba(56,189,248,0.28)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
            }}
          >
            <Trophy className="h-4 w-4" style={{ color: "#e8c06a" }} />
            <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Рейтинг"}</span>
          </button>

          {/* Избранное */}
          <button
            onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "favorites" })}
            className={sideBtnClass}
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
              border: "1px solid rgba(56,189,248,0.28)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
            }}
          >
            <Star className="h-4 w-4" style={{ color: "#e8c06a" }} />
            <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Избранное"}</span>
          </button>

          {/* Сообщения — мини-чат (только мобильная/планшет; на ПК скрыто); на планшете — по ширине как остальные кнопки меню */}
          <div className="lg:hidden w-full">
            <button
              onClick={() => setShowChatListModal(true)}
              className={`${sideBtnClass} w-full justify-start`}
              style={{
                background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
                border: "1px solid rgba(56,189,248,0.28)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
              }}
            >
              <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "#e8c06a" }} />
              <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Сообщения"}</span>
            </button>
          </div>

          {/* Ежедневные задачи */}
          {currentUser && (
            <button
              onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "daily" })}
              className={sideBtnClass}
              style={{
                background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
                border: "1px solid rgba(56,189,248,0.28)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
              }}
            >
              <Sparkles className="h-4 w-4" style={{ color: "#e8c06a" }} />
              <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Ежедневные задачи"}</span>
            </button>
          )}

          {/* Количество столов */}
          <div
            className={
              "flex items-center gap-1.5 rounded-[999px] px-3 py-2 min-h-[40px]" +
              (!leftSideMenuExpanded ? " max-lg:justify-center max-lg:px-2" : "")
            }
            style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(56,189,248,0.18)" }}
            title={!leftSideMenuExpanded ? `Столов в игре: ${tablesCount ?? "—"}` : undefined}
          >
            <RotateCw className="h-3 w-3 shrink-0" style={{ color: "#94a3b8" }} />
            <span
              className={"text-[11px] leading-none " + (!leftSideMenuExpanded ? "max-lg:hidden" : "")}
              style={{ color: "#94a3b8" }}
            >
              {"Столов в игре: "}{tablesCount ?? "—"}
            </span>
          </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Модалка каталога бутылочек */}
      {/* Модалка: выбор собеседника для приватного чата */}
      {showChatListModal && currentUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={() => setShowChatListModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "linear-gradient(165deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)",
              border: "2px solid rgba(251, 191, 36, 0.25)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(71, 85, 105, 0.5)" }}>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" style={{ color: "#fcd34d" }} />
                <span className="font-bold text-slate-100">Сообщения</span>
              </div>
              <button
                type="button"
                onClick={() => setShowChatListModal(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-600/50 hover:text-slate-200"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="px-4 pt-2 pb-1 text-xs text-slate-400">Выберите, кому написать</p>
            <div className="max-h-72 overflow-y-auto px-2 pb-3">
              {players
                .filter((p) => p.id !== currentUser.id)
                .map((player) => {
                  const msgCount = (state.chatMessages[player.id] ?? []).length
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => {
                        dispatch({ type: "OPEN_CHAT", player })
                        setShowChatListModal(false)
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-600/50"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-slate-500">
                        { }
                        <img src={player.avatar} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">{player.name}</p>
                        <p className="text-xs text-slate-400">
                          {player.gender === "female" ? "Ж" : "М"}, {player.age} лет
                          {msgCount > 0 && ` · ${msgCount} сообщ.`}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium" style={{ background: "rgba(251, 191, 36, 0.2)", color: "#fcd34d" }}>
                        Написать
                      </span>
                    </button>
                  )
                })}
              {players.filter((p) => p.id !== currentUser.id).length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">Нет других игроков за столом</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showBottleCatalog && (
        <BottleCatalogModal
          onClose={() => setShowBottleCatalog(false)}
          isPcLayout={isPcLayout}
          players={players}
          ownedBottleSkins={ownedBottleSkins}
          bottleSkin={bottleSkin}
          voiceBalance={voiceBalance}
          bottleCooldownUntil={bottleCooldownUntil}
          currentUser={currentUser}
          dispatch={dispatch}
          showToast={showToast}
        />
      )}

      {/* ---- GAME BOARD CENTER ---- */}
      <div
        className={cn(
          "relative z-10 flex min-h-0 min-w-0 flex-1 flex-col items-center gap-1",
          /* ПК: без overflow-y на колонке — иначе сетка 1fr/auto/1fr растягивается по контенту и стол «прилипает» к верху */
          isPcLayout ? "max-h-full min-w-0 flex-1 overflow-hidden" : "overflow-y-auto",
          !isPcLayout && "pb-14 px-0.5 sm:px-1",
          isPcLayout
            ? "h-full w-full max-w-none min-h-0 self-stretch"
            : "max-md:items-stretch max-md:pt-[calc(env(safe-area-inset-top)+4.25rem)] md:pt-1 md:px-2 lg:px-3 lg:pb-2 lg:justify-center lg:pt-8",
        )}
        ref={boardRef}
      >
        {/* Анимация «вернулся к нам» после выхода из мини-игры Угадай-ка */}
        {showReturnedFromUgadaika && currentUser && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center rounded-[32px] pointer-events-none animate-in fade-in duration-500"
            aria-live="polite"
          >
            <div
              className="flex flex-col items-center gap-3 rounded-2xl px-8 py-6 shadow-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,58,95,0.95) 100%)",
                border: "2px solid rgba(14,165,233,0.6)",
                boxShadow: "0 0 40px rgba(14,165,233,0.25), inset 0 0 60px rgba(0,0,0,0.2)",
              }}
            >
              <span className="text-4xl" aria-hidden="true">🎮</span>
              <p className="text-xl font-bold text-center" style={{ color: "#e2e8f0" }}>
                Вернулся к нам!
              </p>
              <p className="text-sm text-center" style={{ color: "#94a3b8" }}>
                {currentUser.name} снова за столом
              </p>
            </div>
          </div>
        )}
        {/* Инфо-статусы сверху: донор бутылки + таймер (таймер ниже статуса, без наложений) */}
        {(bottleDonorName || (!isMobile && currentUser && currentTurnPlayer?.id === currentUser.id && turnTimer !== null)) && (
          <div
            className={`left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2 ${
              isMobile
                ? "fixed max-md:top-[calc(env(safe-area-inset-top)+4.25rem)] md:top-[max(0.5rem,env(safe-area-inset-top))]"
                : "absolute top-1 lg:top-5"
            }`}
          >
            {/* Статус подаренной бутылки */}
            {bottleDonorName && (
              <div
                className="flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold"
                style={{
                  background: "rgba(15,23,42,0.9)",
                  border: "1px solid #475569",
                  boxShadow: "0 3px 10px rgba(0,0,0,0.6)",
                  color: "#f0e0c8",
                }}
              >
                <span>
                  {"Бутылку нашему столу подарил(а): "}
                  <span style={{ color: "#e8c06a" }}>{bottleDonorName}</span>
                </span>
                <button
                  onClick={handleThankDonor}
                  className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all hover:brightness-110 active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
                    border: "1px solid #166534",
                    color: "#ecfdf5",
                  }}
                >
                  {"Спасибо"}
                </button>
              </div>
            )}

            {/* Таймер хода для текущего пользователя */}
            {!isMobile && currentUser && currentTurnPlayer?.id === currentUser.id && turnTimer !== null && (
              <div
                className="flex items-center gap-1.5 rounded-full px-3 py-1"
                style={{
                  background: "rgba(15,23,42,0.9)",
                  border: "1px solid rgba(248, 250, 252, 0.3)",
                  boxShadow: "0 0 12px rgba(148, 163, 184, 0.6)",
                }}
              >
                <span className="text-[11px]" style={{ color: "#e5e7eb" }}>{"Ваш ход"}</span>
                <span className="text-sm font-bold" style={{ color: turnTimer <= 5 ? "#f97373" : "#facc15" }}>
                  {turnTimer}
                </span>
                <span className="text-[11px]" style={{ color: "#9ca3af" }}>{"сек"}</span>
              </div>
            )}
          </div>
        )}
        {/* ПК: резина по высоте — равные «поля» сверху/снизу через grid 1fr / auto / 1fr */}
        <div
          className={cn(
            isPcLayout
              ? "grid h-full min-h-0 w-full min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] px-2 lg:px-3"
              : "contents",
          )}
        >
          {isPcLayout && <div className="min-h-0 min-w-0" aria-hidden />}
        {/* Обёртка: мобильная — слот эмоций сверху (поток), стол статично ниже; ПК — стол по центру колонки */}
        <div
          className={cn(
            "flex min-h-0 w-full min-w-0 flex-col",
            isMobile ? "shrink-0 items-stretch gap-1.5" : "items-center",
            isPcLayout && "mx-auto max-h-full w-full min-w-0 max-w-full overflow-y-auto overflow-x-hidden",
          )}
        >
        {/* max-md: полоса 70px под навбаром — эмоции по центру; стол начинается сразу под полосой */}
        <div
          className={cn(
            "h-[70px] w-full shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden px-0.5",
            isPcLayout ? "hidden" : "flex md:hidden",
          )}
        >
          {showMobileEmotionStrip && (
            <div className="relative z-[36] flex w-full max-w-full min-h-0 flex-col items-center justify-center gap-0.5">
            {isEmotionLimitReached && (
              <button
                type="button"
                onClick={openEmotionPurchaseModal}
                className="flex h-6 w-full max-w-[min(100%,20rem)] shrink-0 items-center justify-center gap-1 rounded-md px-2 text-[9px] font-bold leading-none transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
                disabled={voiceBalance < EMOTION_QUOTA_COST_PER_TYPE_HEARTS}
                style={{
                  background: "linear-gradient(180deg, #22d3ee 0%, #6366f1 100%)",
                  color: "#0f172a",
                  border: "1px solid rgba(103, 232, 249, 0.85)",
                  boxShadow: "0 1px 0 rgba(30, 64, 175, 0.85)",
                }}
              >
                {`Купить (+${EMOTION_QUOTA_PURCHASE_AMOUNT})`}
              </button>
            )}
            {sidebarGiftMode && sidebarTargetPlayer ? (
              <div className={MOBILE_EMOTION_STRIP_SCROLL}>
                {sidebarAvailableActions.filter((action) => action.id !== "skip").map((action) => {
                  const style = ACTION_BUTTON_STYLES[action.id] || ACTION_BUTTON_STYLES.skip
                  const actionCost = getEffectiveActionCost(action.id, effectiveSidebarCombo)
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleSidebarGiftEmotion(action.id)}
                      disabled={false}
                      className={MOBILE_EMOTION_STRIP_BTN}
                      style={{
                        background: style.bg,
                        color: style.text,
                        border: `1px solid ${style.border}`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 0 ${style.shadow}`,
                      }}
                    >
                      <span className="flex shrink-0 items-center justify-center text-sm [&>svg]:h-3.5 [&>svg]:w-3.5">
                        {renderActionIcon(action)}
                      </span>
                      <span className="min-w-0 max-w-[5.75rem] truncate">{action.label}</span>
                      {shouldShowActionCostBadge(action.id, actionCost) && (
                        <span
                          className="heart-price heart-price--badge flex shrink-0 items-center rounded-full px-1 py-px opacity-95"
                          style={{ background: "rgba(0,0,0,0.18)", color: style.text }}
                        >
                          {actionCost}
                          <Heart className="heart-price__icon h-2.5 w-2.5" fill="currentColor" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : isMyTurn ? (
              <div className={MOBILE_EMOTION_STRIP_SCROLL}>
                {availableActions.filter((action) => action.id !== "skip").map((action) => {
                  const style = ACTION_BUTTON_STYLES[action.id] || ACTION_BUTTON_STYLES.skip
                  const actionCost = getEffectiveActionCost(action.id, currentPairCombo)
                  const canAfford = actionCost === 0 || voiceBalance >= actionCost
                  return (
                    <button
                      key={action.id}
                      onClick={() => handlePerformAction(action.id)}
                      disabled={!canAfford}
                      className={MOBILE_EMOTION_STRIP_BTN}
                      style={{
                        background: style.bg,
                        color: style.text,
                        border: `1px solid ${style.border}`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 0 ${style.shadow}`,
                      }}
                    >
                      <span className="flex shrink-0 items-center justify-center text-sm [&>svg]:h-3.5 [&>svg]:w-3.5">
                        {renderActionIcon(action)}
                      </span>
                      <span className="min-w-0 max-w-[5.75rem] truncate">{action.label}</span>
                      {shouldShowActionCostBadge(action.id, actionCost) && (
                        <span
                          className="heart-price heart-price--badge flex shrink-0 items-center rounded-full px-1 py-px opacity-95"
                          style={{ background: "rgba(0,0,0,0.18)", color: style.text }}
                        >
                          {actionCost}
                          <Heart className="heart-price__icon h-2.5 w-2.5" fill="currentColor" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              currentUser &&
              !currentUser.isBot &&
              resolvedTargetPlayer &&
              resolvedTargetPlayer2 &&
              (currentUser.id === resolvedTargetPlayer.id || currentUser.id === resolvedTargetPlayer2.id) && (
                <div className={MOBILE_EMOTION_STRIP_SCROLL}>
                  {availableActions.filter((action) => action.id !== "skip").map((action) => {
                    const style = ACTION_BUTTON_STYLES[action.id] || ACTION_BUTTON_STYLES.skip
                    const actionCost = getEffectiveActionCost(action.id, currentPairCombo)
                    const canAfford = actionCost === 0 || voiceBalance >= actionCost
                    return (
                      <button
                        key={action.id}
                        type="button"
                        disabled={!canAfford}
                        onClick={() => handleResponseEmotion(action.id)}
                        className={MOBILE_EMOTION_STRIP_BTN}
                        style={{
                          background: style.bg,
                          color: style.text,
                          border: `1px solid ${style.border}`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 0 ${style.shadow}`,
                        }}
                      >
                        <span className="flex shrink-0 items-center justify-center text-sm [&>svg]:h-3.5 [&>svg]:w-3.5">
                          {renderActionIcon(action)}
                        </span>
                        <span className="min-w-0 max-w-[5.75rem] truncate">{action.label}</span>
                        {shouldShowActionCostBadge(action.id, actionCost) && (
                          <span
                            className="heart-price heart-price--badge flex shrink-0 items-center rounded-full px-1 py-px opacity-95"
                            style={{ background: "rgba(0,0,0,0.18)", color: style.text }}
                          >
                            {actionCost}
                            <Heart className="heart-price__icon h-2.5 w-2.5" fill="currentColor" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            )}
            </div>
          )}
        </div>
        {/* Стол ~60:50 (ширина/высота): моб — 90% / max 420px; ПК — вписать в min(72vh,78dvh) по высоте */}
        <div
          className={
            isMobile
              ? `relative flex w-[90%] max-w-[min(90vw,420px)] shrink-0 items-center justify-center sm:max-w-[720px] md:max-h-[40vh] lg:max-h-none min-h-0 mx-auto rounded-2xl`
              : `relative flex aspect-[60/50] min-w-0 shrink-0 items-center justify-center mx-auto mt-1 rounded-2xl sm:rounded-3xl`
          }
          style={{
            ...(isMobile
              ? {
                  aspectRatio: "60 / 50",
                  width: "min(90vw, 100%)",
                  maxWidth: "min(90vw, 420px)",
                  marginLeft: "auto",
                  marginRight: "auto",
                }
              : {
                  aspectRatio: "60 / 50",
                  width: "min(90%, min(100%, calc(min(72vh, 78dvh) * 60 / 50)))",
                  maxWidth: "100%",
                }),
            background:
              "radial-gradient(circle at 50% 45%, rgba(30,58,95,0.55) 0%, rgba(15,23,42,0.95) 60%, rgba(2,6,23,1) 100%)",
            boxShadow: isMobile
              ? "0 10px 36px rgba(0,0,0,0.52), 0 0 40px rgba(56,189,248,0.12)"
              : "0 24px 50px rgba(0,0,0,0.88), 0 0 55px rgba(56,189,248,0.1)",
          }}
        >
          {/* Лёгкое внутреннее затемнение по краям, чтобы игроки читались поверх стола */}
          <div
            className={`pointer-events-none absolute rounded-[20px] sm:rounded-[26px] ${isMobile ? "inset-2" : "inset-3"}`}
            style={{
              boxShadow: "inset 0 0 56px rgba(0,0,0,0.78)",
              background:
                "radial-gradient(circle at center, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.96) 68%, rgba(2,6,23,1) 100%)",
            }}
          />
          {/* Центральный софт-спот под бутылкой */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
            style={{
              width: isMobile ? 130 : 228,
              height: isMobile ? 130 : 190,
              background: "radial-gradient(ellipse at center, rgba(56,189,248,0.16) 0%, rgba(56,189,248,0.05) 45%, transparent 75%)",
              filter: "blur(1px)",
            }}
          />

          <TableDecorations />

          {/* ---- PLAYERS around the circle ---- */}
          {players.map((player, i) => {
            const pos = positions[i]
            const isAvatarMenuOpen = sidebarTargetPlayer?.id === player.id
            const isClickableForPrediction =
              predictionPhase && !predictionMade && !isSpinning && !showResult &&
              player.id !== currentUser?.id
            const bigGiftSequence = getBigGiftSequenceForPlayer(player.id)
            const hasRoseGiven = (rosesGiven ?? []).some((r) => r.toPlayerId === player.id)
            const giftIcons = hasRoseGiven
              ? [...getGiftsForPlayer(player.id), "rose" as const]
              : getGiftsForPlayer(player.id)
            const steamAvatarSize =
              manyPlayersOnMobile ? 42 : isMobile ? 52 : 70
            const steamBorder = steamAvatarSize <= 52 ? 3 : 4
            const steamOuterPx = steamAvatarSize + steamBorder * 2 + 4
            return (
              <div
                key={player.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 ${isAvatarMenuOpen ? "z-50" : "z-10"}`}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  cursor: isClickableForPrediction ? "pointer" : player.id !== currentUser?.id ? "pointer" : "default",
                  filter: isClickableForPrediction && !predictionTarget?.id && !predictionTarget2?.id
                    ? "drop-shadow(0 0 6px rgba(46, 204, 113, 0.4))"
                    : "none",
                  transition: "filter 0.3s ease",
                }}
                onClick={() => handlePlayerClick(player)}
              >
                <div className="relative inline-flex flex-col items-center">
                  <PlayerAvatar
                    player={player}
                    tableRingLayout
                    compact={isMobile || manyPlayersOnMobile}
                    size={manyPlayersOnMobile ? 42 : isMobile ? 52 : undefined}
                    // Во время результата подсвечиваем только пару, а не крутящего
                    isCurrentTurn={player.id === currentTurnPlayer?.id && !showResult}
                    isTarget={
                      showResult &&
                      (targetPlayer?.id === player.id || targetPlayer2?.id === player.id)
                    }
                    isPredictionTarget={
                      predictionPhase && !isSpinning && !showResult &&
                      (predictionTarget?.id === player.id || predictionTarget2?.id === player.id)
                    }
                    kissCount={getKissCountForPlayer(player.id)}
                    giftIcons={giftIcons}
                    bigGiftSequence={bigGiftSequence.length > 0 ? bigGiftSequence : undefined}
                    frameId={avatarFrames?.[player.id]}
                    inGame={playerInUgadaika != null && player.id === playerInUgadaika}
                    showAsleep={(spinSkips?.[player.id] ?? 0) >= 3}
                  />
                  {(() => {
                    void steamFogTick
                    const fog = avatarSteamFog[player.id]
                    const nowFog = Date.now()
                    if (!fog || fog.until <= nowFog) return null
                    const timeLeft01 = Math.max(0, Math.min(1, (fog.until - nowFog) / 60_000))
                    const wet = fog.level
                    const blurPx = 1.2 + wet * (5 + 9 * timeLeft01)
                    const gloss = 0.1 + wet * (0.22 + 0.2 * timeLeft01)
                    const frost = 0.12 + wet * (0.28 + 0.25 * timeLeft01)
                    return (
                      <div
                        className="pointer-events-none absolute z-[32] overflow-hidden rounded-full"
                        style={{
                          width: steamOuterPx,
                          height: steamOuterPx,
                          left: "50%",
                          top: 0,
                          transform: "translateX(-50%)",
                          WebkitBackdropFilter: `blur(${blurPx}px) saturate(${1.05 + wet * 0.12})`,
                          backdropFilter: `blur(${blurPx}px) saturate(${1.05 + wet * 0.12})`,
                          background: `linear-gradient(200deg, rgba(255,255,255,${gloss}) 0%, rgba(186,230,253,${frost * 0.55}) 38%, rgba(148,163,184,${frost * 0.45}) 100%)`,
                          opacity: Math.min(0.98, wet * (0.35 + 0.55 * timeLeft01)),
                          boxShadow: `inset 0 0 ${14 + wet * 28}px rgba(255,255,255,${0.12 + wet * 0.2 * timeLeft01})`,
                          mixBlendMode: "soft-light",
                        }}
                        aria-hidden
                      />
                    )
                  })()}
                  {steamPuffs
                    .filter((p) => p.targetIdx === i)
                    .map((p) => {
                      const spreadR = steamOuterPx * 0.42
                      const leftPx = p.spreadX * spreadR
                      const topPx = steamOuterPx / 2 + p.spreadY * spreadR
                      return (
                        <div
                          key={p.id}
                          className="pointer-events-none absolute z-[35]"
                          style={{
                            left: `calc(50% + ${leftPx}px)`,
                            top: topPx,
                            opacity: 0,
                            animation: `steamRise 1.4s ease-out forwards`,
                            animationDelay: `${p.delayMs}ms`,
                          }}
                        >
                          <span
                            style={{
                              fontSize: steamOuterPx <= 56 ? "22px" : steamOuterPx <= 70 ? "26px" : "30px",
                              color: "rgba(226, 232, 240, 0.9)",
                              textShadow: "0 0 12px rgba(226,232,240,0.55)",
                              filter: "blur(0.2px)",
                            }}
                          >
                            {"💨"}
                          </span>
                        </div>
                      )
                    })}
                </div>
                {isAvatarMenuOpen && (
                  <div
                    className="absolute left-1/2 top-full z-40 mt-2 w-[min(92vw,184px)] -translate-x-1/2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="relative rounded-2xl border p-2 pt-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.65),0_0_0_1px_rgba(56,189,248,0.12),0_0_28px_rgba(251,191,36,0.08)]"
                      style={{
                        background: "linear-gradient(165deg, rgba(22, 32, 52, 0.98) 0%, rgba(8, 15, 32, 0.99) 100%)",
                        borderColor: "rgba(251, 191, 36, 0.28)",
                        boxShadow:
                          "0 12px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(56,189,248,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
                      }}
                    >
                      <button
                        type="button"
                        aria-label="Закрыть мини-меню"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSidebarTargetPlayer(null)
                          setSidebarGiftMode(false)
                        }}
                        className="absolute -right-1 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] ring-2 ring-slate-900/80 transition-all hover:brightness-110 hover:scale-105"
                        style={{
                          background: "linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)",
                          color: "#ffffff",
                          border: "1px solid rgba(254, 202, 202, 0.95)",
                          boxShadow: "0 4px 14px rgba(127, 29, 29, 0.7), inset 0 1px 0 rgba(255,255,255,0.35)",
                        }}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                      <div className="flex flex-col gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSidebarGiftMode(true)
                          }}
                          className={`flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl border px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:brightness-110 active:scale-[0.98] ${
                            sidebarGiftMode
                              ? "border-cyan-400/45 bg-slate-950/90 ring-1 ring-cyan-400/25"
                              : "border-slate-500/30 bg-slate-950/70 hover:border-slate-400/35 hover:bg-slate-900/85"
                          }`}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.12)]">
                            <Sparkles className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1 text-[11px] font-extrabold leading-tight tracking-tight text-white antialiased [text-shadow:0_1px_3px_rgba(0,0,0,0.65)] sm:text-xs">
                            Подарить эмоцию
                          </span>
                        </button>
                        {currentUser && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSidebarGiftMode(false)
                              setSidebarTargetPlayer(null)
                              setGiftCatalogDrawerPlayer(player)
                            }}
                            className="flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl border border-slate-500/30 bg-slate-950/70 px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-slate-400/35 hover:bg-slate-900/85 hover:brightness-110 active:scale-[0.98]"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-500/10 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.1)]">
                              <Gift className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1 text-[11px] font-extrabold leading-tight tracking-tight text-white antialiased [text-shadow:0_1px_3px_rgba(0,0,0,0.65)] sm:text-xs">
                              Подарить подарок
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSidebarTargetPlayer(null)
                            setSidebarGiftMode(false)
                            dispatch({ type: "OPEN_PLAYER_MENU", player })
                          }}
                          className="flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl border border-amber-400/35 bg-slate-950/70 px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-400/15 transition-all hover:border-amber-400/50 hover:bg-slate-900/85 hover:ring-amber-400/25 active:scale-[0.98]"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/40 bg-gradient-to-b from-amber-400/25 to-amber-600/15 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.2)]">
                            <User className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1 text-[11px] font-extrabold leading-tight tracking-tight text-amber-50 antialiased [text-shadow:0_1px_3px_rgba(0,0,0,0.7),0_0_12px_rgba(251,191,36,0.15)] sm:text-xs">
                            Профиль
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* ---- FLYING EMOJIS ---- */}
          {flyingEmojis.map((fe) => {
            const midX = (fe.fromX + fe.toX) / 2
            const arcLift = fe.thanksCloud ? 14 : 5
            const midY = (fe.fromY + fe.toY) / 2 - arcLift
            return (
            <div
              key={fe.id}
              className="pointer-events-none absolute z-[90]"
              style={{
                left: `${fe.fromX}%`,
                top: `${fe.fromY}%`,
                animation: fe.thanksCloud
                  ? "flyThanksCloud 2.35s cubic-bezier(0.22, 1, 0.36, 1) forwards"
                  : "flyEmoji 1.8s ease-in-out forwards",
                // @ts-expect-error CSS custom properties
                "--fly-from-left": `${fe.fromX}%`,
                "--fly-from-top": `${fe.fromY}%`,
                "--fly-mid-left": `${midX}%`,
                "--fly-mid-top": `${midY}%`,
                "--fly-to-left": `${fe.toX}%`,
                "--fly-to-top": `${fe.toY}%`,
              }}
            >
              <FlyingEmojiContent fe={fe} />
            </div>
            )
          })}

          {/* ---- BOTTLE in the centre (на мобильной — крупнее) ---- */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div
              style={isMobile ? { transform: "scale(1.4)" } : undefined}
              className="drop-shadow-[0_0_22px_rgba(56,189,248,0.4)]"
            >
              <Bottle
                angle={bottleAngle}
                isSpinning={isSpinning}
                skin={bottleSkin ?? "classic"}
                isDrunk={isCurrentTurnDrunk}
                fortuneSegmentCount={players.length > 0 ? players.length : 8}
              />
            </div>
          </div>

          {/* ---- SPIN BUTTON in centre, over bottle ---- */}
          {isMyTurn && !isSpinning && !showResult && countdown === null && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-25 pointer-events-none">
              <button
                onClick={handleSpin}
                className="pointer-events-auto flex items-center justify-center gap-2 rounded-full font-bold transition-all hover:brightness-110 hover:scale-105 active:scale-95 whitespace-nowrap shadow-lg spin-btn-pulse"
                style={{
                  minWidth: 78,
                  minHeight: 78,
                  padding: "14px 26px",
                  fontSize: "18px",
                  background: "linear-gradient(180deg, #22c55e 0%, #16a34a 42%, #15803d 100%)",
                  backgroundColor: "#16a34a",
                  color: "#fff",
                  border: "3px solid #14532d",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 0 #14532d, 0 12px 28px rgba(0,0,0,0.55)",
                  opacity: 1,
                }}
              >
                <RotateCw className="h-6 w-6 shrink-0" strokeWidth={2.5} />
                {"Крутить"}
              </button>
            </div>
          )}

          {/* ---- COUNTDOWN overlay ---- */}
          {countdown !== null && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full shadow-xl animate-in zoom-in duration-300"
                style={{
                  background: "radial-gradient(circle, #e8c06a 0%, #c4943a 100%)",
                  boxShadow: "0 0 30px rgba(232, 192, 106, 0.5)",
                }}
              >
                <span className="text-4xl font-black" style={{ color: "#0f172a" }}>{countdown}</span>
              </div>
            </div>
          )}

          {/* ---- PREDICTION TIMER OVERLAY on the board ---- */}
          {!CASUAL_MODE && predictionPhase && !isSpinning && !showResult && countdown === null && (
            <div className="absolute left-1/2 top-[15%] -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 animate-in fade-in duration-300">
              <div
                className="flex items-center gap-2 rounded-full px-4 py-1.5 shadow-lg"
                style={{
                  background: predictionTimer <= 3 ? "rgba(231, 76, 60, 0.9)" : "rgba(15, 23, 42, 0.85)",
                  border: `1px solid ${predictionTimer <= 3 ? "#e74c3c" : "#2ecc71"}`,
                  boxShadow: predictionTimer <= 3
                    ? "0 0 16px rgba(231, 76, 60, 0.5)"
                    : "0 0 12px rgba(46, 204, 113, 0.3)",
                  transition: "all 0.3s ease",
                }}
              >
                <Target className="h-4 w-4" style={{ color: predictionTimer <= 3 ? "#fff" : "#2ecc71" }} />
                <span
                  className="text-sm font-bold"
                  style={{ color: predictionTimer <= 3 ? "#fff" : "#2ecc71" }}
                >
                  {"Угадай пару: "}{predictionTimer}{"с"}
                </span>
              </div>
              {!predictionMade && !predictionTarget && (
                <span
                  className="text-[10px] font-medium"
                  style={{ color: "#94a3b8", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
                >
                  {"Нажми на игрока"}
                </span>
              )}
              {!predictionMade && predictionTarget && !predictionTarget2 && (
                <span
                  className="text-[10px] font-medium animate-pulse"
                  style={{ color: "#2ecc71", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}
                >
                  {"Выбери второго игрока"}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ---- UNDER-BOARD CONTROLS (SPIN / STATUS / RESULT) + кнопка «Крутить вне очереди»; на мобильной — ниже и крупнее ---- */}
        <div
          ref={underBoardStatusRef}
          className="mt-2 md:mt-1.5 lg:mt-6 mb-0.5 flex min-h-[58px] md:min-h-[64px] lg:min-h-[80px] w-full flex-col items-center justify-center gap-1.5 md:gap-1.5 lg:gap-3 px-2 shrink-0"
        >
          <div className="flex flex-wrap items-center justify-center gap-2.5 md:gap-2 lg:gap-4">
            {/* Who's turn label */}
            {!isSpinning && !showResult && countdown === null && currentTurnPlayer && (
              <div
                className="rounded-full px-4 py-2.5 md:px-3 md:py-1.5 lg:px-5 lg:py-2.5 shadow-lg whitespace-nowrap"
                style={{
                  background: "rgba(15, 23, 42, 0.85)",
                  border: "1px solid #475569",
                }}
              >
                <span className="text-sm md:text-xs lg:text-base font-bold" style={{ color: "#e8c06a" }}>
                  {isMyTurn ? "Ваш ход!" : `Ход: ${currentTurnPlayer.name}`}
                </span>
              </div>
            )}

            {/* Pair status directly under the board when result is shown */}
            {showResult && resolvedTargetPlayer && resolvedTargetPlayer2 && currentTurnPlayer && (
              <div
                className="rounded-full px-5 py-2.5 md:px-4 md:py-1 lg:px-6 lg:py-2.5 text-sm md:text-[12px] lg:text-[15px] font-bold"
                style={{
                  background: "rgba(15,23,42,0.95)",
                  border: "1px solid rgba(248,250,252,0.35)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.85)",
                  color: "#e5e7eb",
                }}
              >
                <span>{currentTurnPlayer.name}</span>
                <span style={{ color: "#9ca3af" }}>{" → "}</span>
                <span>{resolvedTargetPlayer.name}</span>
              </div>
            )}

            {/* Spinning status */}
            {isSpinning && (
              <div
                className="rounded-full px-4 py-2.5 md:px-3 md:py-1.5 lg:px-5 lg:py-2.5 shadow-lg whitespace-nowrap"
                style={{
                  background: "rgba(15, 23, 42, 0.85)",
                  border: "1px solid #334155",
                }}
              >
                <p className="text-sm md:text-xs lg:text-base font-semibold animate-pulse" style={{ color: "#e8c06a" }}>
                  {"Крутится..."}
                </p>
              </div>
            )}

            {/* Крутить вне очереди — сбоку от статуса; на мобильной компактнее */}
            {!isMyTurn && !isSpinning && !showResult && countdown === null && currentUser && (
              <button
                type="button"
                onClick={handleExtraSpin}
                disabled={voiceBalance < 10}
                className="flex items-center gap-1.5 lg:gap-2.5 rounded-full px-3 py-1.5 lg:px-5 lg:py-2.5 text-[11px] lg:text-sm font-bold shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                style={{
                  background: "linear-gradient(180deg, #9b59b6 0%, #8e44ad 100%)",
                  color: "#fff",
                  border: "2px solid #7d3c98",
                  boxShadow: "0 2px 0 #5b2c6f",
                }}
              >
                <RotateCw className="h-3 w-3 lg:h-4 lg:w-4 shrink-0" />
                <span className="whitespace-nowrap">Крутить вне очереди (10)</span>
              </button>
            )}
          </div>
        </div>

        {!isPcLayout && (
          <TableChatPanel
            gameLog={gameLog}
            chatInput={chatInput}
            setChatInput={setChatInput}
            onSend={handleSendChat}
            logEndRef={logEndRef}
            currentUserId={currentUser?.id}
            chatDisabled={tablePaused}
            className="w-full max-w-[min(95vw,720px)] mx-auto mt-2 mb-1 shrink-0 max-h-[min(38vh,320px)] min-h-[140px]"
          />
        )}

        </div>
          {isPcLayout && <div className="min-h-0" aria-hidden />}
        </div>

      </div>

      </div>

      {/* ---- RIGHT PANEL: на ПК — ~20% ширины (инфо + чат); на планшете — прежняя колонка ---- */}
      <div
        className={cn(
          "relative z-20 min-h-0 flex-col border-l border-cyan-400/20 bg-gradient-to-b from-slate-900/55 to-slate-950/65",
          isPcLayout ? "flex" : "hidden md:flex",
          isPcLayout
            ? rightPanelCollapsed
              ? "w-14 shrink-0 flex-none"
              : "flex min-h-0 min-w-0 flex-1 basis-0"
            : rightPanelCollapsed
              ? "w-14 shrink-0 flex-none"
              : "w-[264px] shrink-0 flex-none",
        )}
      >
        {rightPanelCollapsed ? (
          <button
            type="button"
            onClick={() => setRightPanelCollapsed(false)}
            className="flex flex-col items-center justify-center gap-1.5 py-6 px-2 w-14 min-h-[100px] rounded-l-xl transition-colors hover:bg-slate-800/60"
            style={{ borderRight: "1px solid rgba(71, 85, 105, 0.5)" }}
            aria-label="Развернуть панель"
          >
            <MessageCircle className="h-5 w-5 shrink-0" style={{ color: "#e8c06a" }} />
            <span className="text-[9px] font-medium text-slate-300 text-center leading-tight">Развернуть</span>
            <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        ) : (
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 overflow-hidden pt-2 pb-3 pr-2 pl-1">
          {/* Заголовок панели с кнопкой свернуть */}
          <div className="mx-2 mb-0.5 flex items-center justify-between gap-2 rounded-t-lg px-2 py-1.5" style={{ background: "rgba(15, 23, 42, 0.9)", borderBottom: "1px solid rgba(56, 189, 248, 0.35)" }}>
            <span className="text-xs font-bold truncate" style={{ color: "#e8c06a" }}>Свернуть</span>
            <button
              type="button"
              onClick={() => setRightPanelCollapsed(true)}
              className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-700/60 hover:text-slate-200 transition-colors"
              aria-label="Свернуть панель"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        {/* Угадай-ка — кнопка мини-игры с лампочками по всему периметру (казино) */}
        <div className="relative mx-2 py-2 px-1">
          {/* Лампочки по всему периметру рамки */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none" aria-hidden>
            {/* Верх */}
            <div className="absolute top-0 left-0 right-0 flex justify-between px-1 pt-0.5">
              {Array.from({ length: 14 }).map((_, i) => (
                <span key={`t-${i}`} className="ugadaika-casino-bulb" />
              ))}
            </div>
            {/* Низ */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pb-0.5">
              {Array.from({ length: 14 }).map((_, i) => (
                <span key={`b-${i}`} className="ugadaika-casino-bulb" />
              ))}
            </div>
            {/* Лево */}
            <div className="absolute top-0 bottom-0 left-0 flex flex-col justify-between py-1.5 pl-0.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={`l-${i}`} className="ugadaika-casino-bulb" />
              ))}
            </div>
            {/* Право */}
            <div className="absolute top-0 bottom-0 right-0 flex flex-col justify-between py-1.5 pr-0.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={`r-${i}`} className="ugadaika-casino-bulb" />
              ))}
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "ugadaika" })}
            className="ugadaika-sidebar-btn ugadaika-block-pulse group relative w-full flex items-center justify-center overflow-hidden rounded-2xl px-2 py-2 min-h-[90px] transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, rgba(190, 24, 93, 0.35) 0%, rgba(136, 19, 55, 0.5) 50%, rgba(88, 28, 135, 0.4) 100%)",
              border: "1px solid rgba(251, 113, 133, 0.5)",
              boxShadow: "0 4px 24px rgba(190, 24, 93, 0.4), 0 0 16px rgba(251, 113, 133, 0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" aria-hidden="true" />
            { }
            <img src={assetUrl("Frame 1171276192.webp")} alt="Угадай-ка" className="relative w-full h-full max-h-[76px] object-contain" />
          </button>
        </div>

        {/* Лог и чат за столом */}
        <TableChatPanel
          gameLog={gameLog}
          chatInput={chatInput}
          setChatInput={setChatInput}
          onSend={handleSendChat}
          logEndRef={logEndRef}
          currentUserId={currentUser?.id}
          chatDisabled={tablePaused}
          className="mx-2 flex min-h-0 flex-1 flex-col"
        />
        </div>
        )}
      </div>

      {/* ---- МОБИЛЬНАЯ НИЖНЯЯ НАВИГАЦИЯ ---- */}
      <nav
        className={cn(
          "fixed inset-x-0 top-0 items-center justify-around border-b px-2 py-2",
          isPcLayout ? "hidden" : "flex md:hidden",
          showMobileMoreMenu ? "z-[100]" : "z-30",
        )}
        style={{
          background: "linear-gradient(180deg, rgba(15,8,3,0.98) 0%, rgba(10,5,2,0.99) 100%)",
          borderColor: "rgba(92,58,36,0.9)",
          paddingTop: "max(0.5rem, env(safe-area-inset-top))",
        }}
      >
        <button
          type="button"
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 min-w-[64px] touch-manipulation"
          style={{ color: "#e8c06a" }}
          aria-current="page"
        >
          <RotateCw className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Игра</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "favorites" })}
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 min-w-[64px] touch-manipulation transition-opacity active:opacity-80"
          style={{ color: "#f0e0c8" }}
        >
          <Star className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Избранные</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })}
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 min-w-[64px] touch-manipulation transition-opacity active:opacity-80"
          style={{ color: "#facc15" }}
        >
          <Gift className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Магазин</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "profile" })}
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 min-w-[64px] touch-manipulation transition-opacity active:opacity-80"
          style={{ color: "#f0e0c8" }}
        >
          <User className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Профиль</span>
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMobileMoreMenu((v) => !v)}
            className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 min-w-[56px] touch-manipulation transition-opacity active:opacity-80"
            style={{ color: "#f0e0c8" }}
            aria-expanded={showMobileMoreMenu}
            aria-label="Меню стола"
          >
            <Menu className="h-5 w-5" style={{ color: "#e8c06a" }} />
            <span className="text-[10px] font-semibold leading-tight text-center">Стол</span>
          </button>
          {showMobileMoreMenu && (
            <>
              <div
                className="fixed inset-0 bg-black/20 z-[1]"
                aria-hidden="true"
                onClick={() => setShowMobileMoreMenu(false)}
              />
              <div
                className="fixed right-2 left-auto z-[2] flex w-[min(17rem,calc(100vw-1rem))] max-h-[min(70vh,420px)] flex-col overflow-y-auto rounded-xl border py-2 shadow-xl"
                style={{
                  top: "calc(4.5rem + max(0.5rem, env(safe-area-inset-top)))",
                  background: "rgba(19,10,4,0.98)",
                  borderColor: "#334155",
                }}
                role="menu"
                aria-label="Меню стола"
              >
                <div
                  className="mx-2 mb-2 flex min-w-0 items-center gap-2 rounded-[999px] px-3 py-2"
                  style={{
                    background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
                    border: "1px solid rgba(56,189,248,0.28)",
                  }}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Heart className="h-5 w-5 shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]" style={{ color: "#fde68a" }} fill="currentColor" />
                    <span className="text-base font-black tabular-nums shrink-0 text-white">{voiceBalance}</span>
                    <span className="min-w-0 truncate text-xs" style={{ color: "#cbd5e1" }}>
                      Ваш банк
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })
                      setShowMobileMoreMenu(false)
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:brightness-110 active:scale-95"
                    style={{
                      border: "1px solid rgba(56,189,248,0.5)",
                      color: "#7dd3fc",
                      background: "linear-gradient(180deg, rgba(56,189,248,0.22) 0%, rgba(14,116,144,0.2) 100%)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
                    }}
                    title="Пополнить банк"
                    aria-label="Открыть магазин сердец"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowBottleCatalog(true); setShowMobileMoreMenu(false) }}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden>🍾</span>
                    Бутылочка
                  </span>
                  {cooldownLeftMs > 0 && (
                    <span className="text-xs font-semibold shrink-0" style={{ color: "#e8c06a" }}>
                      {formatCooldown(cooldownLeftMs)}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { handleChangeTable(); setShowMobileMoreMenu(false) }}
                  className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <RotateCw className="h-4 w-4 shrink-0" />
                  Сменить стол
                </button>
                <button
                  type="button"
                  onClick={() => { dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "rating" }); setShowMobileMoreMenu(false) }}
                  className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <Trophy className="h-4 w-4 shrink-0" />
                  Рейтинг
                </button>
                <button
                  type="button"
                  onClick={() => { dispatch({ type: "SET_SCREEN", screen: "ugadaika" }); setShowMobileMoreMenu(false) }}
                  className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <span aria-hidden>💕</span>
                  Угадай-ка
                </button>
                <button
                  type="button"
                  onClick={() => { setShowChatListModal(true); setShowMobileMoreMenu(false) }}
                  className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  Сообщения
                </button>
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => { dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "daily" }); setShowMobileMoreMenu(false) }}
                    className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                    style={{ color: "#f0e0c8" }}
                  >
                    <Sparkles className="h-4 w-4 shrink-0" />
                    Ежедневные задачи
                  </button>
                )}
                <div
                  className="mx-2 my-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(56,189,248,0.18)", color: "#94a3b8" }}
                >
                  <RotateCw className="h-3.5 w-3.5 shrink-0" />
                  Столов в игре: {tablesCount ?? "—"}
                </div>
                {!isMyTurn && !isSpinning && !showResult && countdown === null && (
                  <button
                    type="button"
                    onClick={() => {
                      handleExtraSpin()
                      setShowMobileMoreMenu(false)
                    }}
                    disabled={voiceBalance < 10}
                    className="mx-2 mb-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                    style={{
                      background: "linear-gradient(180deg, #9b59b6 0%, #8e44ad 100%)",
                      color: "#fff",
                      border: "2px solid #7d3c98",
                      boxShadow: "0 2px 0 #5b2c6f",
                    }}
                  >
                    <RotateCw className="h-4 w-4 shrink-0" />
                    Крутить вне очереди (10 ❤)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMusicEnabled((v) => !v); setShowMobileMoreMenu(false) }}
                  title="Громкость"
                  className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <span aria-hidden>{musicEnabled ? "🔊" : "🔇"}</span>
                  {musicEnabled ? "Музыка вкл" : "Музыка выкл"}
                </button>
                <button
                  type="button"
                  onClick={() => { dispatch({ type: "SET_SOUNDS_ENABLED", enabled: soundsEnabled === false }); setShowMobileMoreMenu(false) }}
                  className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <span aria-hidden>{soundsEnabled === false ? "🔇" : "🔊"}</span>
                  {soundsEnabled === false ? "Звуки выкл" : "Звуки вкл"}
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* ---- Ежедневные задачи — боковая панель (как профиль) ---- */}
      {currentUser && gameSidePanel === "daily" && (
        <GameSidePanelShell
          title="Ежедневные задачи"
          onClose={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: null })}
          headerRight={
            <div className="flex max-w-[min(12rem,42vw)] items-center gap-1.5 sm:gap-2">
              <div className="h-2 min-w-[3rem] flex-1 rounded-full overflow-hidden" style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(71, 85, 105, 0.6)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(completedQuests / 5) * 100}%`,
                    background: "linear-gradient(90deg, #22c55e 0%, #e8c06a 100%)",
                    boxShadow: "0 0 8px rgba(34, 197, 94, 0.5)",
                  }}
                />
              </div>
              <span className="text-[10px] font-bold tabular-nums sm:text-xs" style={{ color: completedQuests >= 5 ? "#86efac" : "#fcd34d" }}>
                {completedQuests}/5
              </span>
              <span className="hidden rounded-md px-1.5 py-0.5 text-[9px] font-bold sm:inline" style={{ color: "#7dd3fc", background: "rgba(2,132,199,0.15)", border: "1px solid rgba(56,189,248,0.35)" }}>
                Lvl {dailyLevel}/30
              </span>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="rounded-xl border px-3 py-2" style={{ borderColor: "rgba(71, 85, 105, 0.35)", background: "rgba(15,23,42,0.5)" }}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold" style={{ color: "#bae6fd" }}>
                  Уровень ежедневных задач: {dailyLevel}/30
                </span>
                <span className="text-[11px]" style={{ color: "#94a3b8" }}>
                  До {nextDailyLevel}: {dailyLevel >= DAILY_LEVEL_MAX ? "макс" : `${dailyLevelProgress.current}/${dailyLevelProgress.need}`}
                </span>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: "rgba(15, 23, 42, 0.85)", border: "1px solid rgba(71, 85, 105, 0.5)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${dailyLevel >= DAILY_LEVEL_MAX ? 100 : (dailyLevelProgress.current / Math.max(1, dailyLevelProgress.need)) * 100}%`,
                    background: "linear-gradient(90deg, #38bdf8 0%, #22c55e 100%)",
                    boxShadow: "0 0 8px rgba(56, 189, 248, 0.45)",
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              {todayQuests.map((q, i) => {
                  const progress = getProgressForType(q.type)
                  const claimed = dailyQuests?.dateKey === todayKey && dailyQuests.claimed[i]
                  const canClaim = !claimed && progress >= q.target
                  const showConfetti = claimed && confettiQuestIndex === i
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-all"
                      style={{
                        background: claimed ? "rgba(34, 197, 94, 0.08)" : "rgba(15, 23, 42, 0.6)",
                        border: claimed ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid rgba(71, 85, 105, 0.4)",
                        opacity: claimed ? 0.95 : 1,
                      }}
                    >
                      <span className="text-[12px] font-medium flex-1 min-w-0" style={{ color: claimed ? "#9ca3af" : "#e2e8f0" }}>
                        {q.label}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 relative min-w-[100px] justify-end">
                        {claimed ? (
                          <span className="daily-quest-confetti-cell flex items-center gap-1.5 relative">
                            {showConfetti && (
                              <span className="daily-quest-confetti-burst" aria-hidden>
                                {[0, 1, 2, 3, 4, 5, 6, 7].map((j) => (
                                  <span key={j} className="daily-quest-confetti-dot" style={{ ["--i" as string]: j }} />
                                ))}
                              </span>
                            )}
                            <span className="text-emerald-400 font-bold">✓</span>
                            <span className="text-[11px]" aria-hidden>🌹</span>
                          </span>
                        ) : canClaim ? (
                          <button
                            type="button"
                            onClick={() => handleClaimDailyQuest(i)}
                            className="rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all hover:scale-105 active:scale-95"
                            style={{
                              background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",
                              color: "#ecfdf5",
                              border: "1px solid rgba(34, 197, 94, 0.5)",
                              boxShadow: "0 2px 8px rgba(22, 163, 74, 0.3)",
                            }}
                          >
                            Забрать
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>
                            {Math.min(progress, q.target)}/{q.target}
                            <span className="ml-1 opacity-90">· 1 🌹</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              <div className="mt-2 rounded-xl border p-3" style={{ borderColor: "rgba(56,189,248,0.3)", background: "rgba(2, 6, 23, 0.45)" }}>
                <p className="mb-2 text-[12px] font-semibold" style={{ color: "#bae6fd" }}>
                  Бонусы уровней (1-30)
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  {LEVEL_REWARDS.map((reward) => {
                    const reached = dailyLevel >= reward.level
                    return (
                      <div
                        key={reward.level}
                        className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px]"
                        style={{
                          background: reached ? "rgba(34,197,94,0.12)" : "rgba(15,23,42,0.7)",
                          border: reached ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(71,85,105,0.45)",
                          color: reached ? "#bbf7d0" : "#cbd5e1",
                        }}
                      >
                        <span>Уровень {reward.level} · {reward.title}</span>
                        <span className="tabular-nums">
                          +{reward.hearts} монет ❤
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </GameSidePanelShell>
      )}

      {/* ---- PREDICTION PICKER MODAL ---- */}
      {!CASUAL_MODE && showPredictionPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-xs rounded-2xl p-4 shadow-2xl animate-in zoom-in-95 duration-300"
            style={{
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              border: "2px solid #475569",
            }}
          >
            <h3 className="mb-3 text-sm font-bold" style={{ color: "#f0e0c8" }}>
              {"Выбери пару для прогноза"}
            </h3>
            <p className="mb-2 text-[10px]" style={{ color: "#94a3b8" }}>
              {predictionTarget ? "Выбери второго игрока:" : "Выбери первого игрока:"}
            </p>
            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
              {players
                .filter(p => p.id !== currentUser?.id)
                .filter(p => !predictionTarget || p.id !== predictionTarget.id)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (!predictionTarget) {
                        setPredictionTarget(p)
                      } else {
                        setPredictionTarget2(p)
                        setShowPredictionPicker(false)
                      }
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-center transition-all hover:brightness-110"
                    style={{
                      background: "rgba(60, 35, 20, 0.8)",
                      border: "1px solid #334155",
                    }}
                  >
                    <div className="h-6 w-6 rounded-full overflow-hidden" style={{ border: "1.5px solid #475569" }}>
                      { }
                      <img src={p.avatar} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
                    </div>
                    <span className="text-[11px] font-semibold" style={{ color: "#f0e0c8" }}>{p.name}</span>
                    <span className="text-[9px] ml-auto" style={{ color: "#94a3b8" }}>
                      {p.gender === "male" ? "M" : "F"}{", "}{p.age}
                    </span>
                  </button>
                ))}
            </div>
            <button
              onClick={() => { setShowPredictionPicker(false); setPredictionTarget(null); setPredictionTarget2(null) }}
              className="mt-3 w-full rounded-lg px-3 py-2 text-[11px] font-bold transition-all hover:brightness-110"
              style={{
                background: "transparent",
                color: "#94a3b8",
                border: "1px solid #334155",
              }}
            >
              {"Отмена"}
            </button>
          </div>
        </div>
      )}

      {/* ---- BET PICKER MODAL ---- */}
      {!CASUAL_MODE && showBetPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-xs rounded-2xl p-4 shadow-2xl animate-in zoom-in-95 duration-300"
            style={{
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              border: "2px solid #475569",
            }}
          >
            <h3 className="mb-3 text-sm font-bold" style={{ color: "#f0e0c8" }}>
              {"Выбери пару для ставки"}
            </h3>
            <p className="mb-2 text-[10px]" style={{ color: "#94a3b8" }}>
              {betTarget1 ? "Выбери второго игрока:" : "Выбери первого игрока:"}
            </p>
            <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
              {players
                .filter(p => p.id !== currentUser?.id)
                .filter(p => !betTarget1 || p.id !== betTarget1.id)
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (!betTarget1) {
                        setBetTarget1(p)
                      } else {
                        setBetTarget2(p)
                        setShowBetPicker(false)
                      }
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-center transition-all hover:brightness-110"
                    style={{
                      background: "rgba(60, 35, 20, 0.8)",
                      border: "1px solid #334155",
                    }}
                  >
                    <div className="h-6 w-6 rounded-full overflow-hidden" style={{ border: "1.5px solid #475569" }}>
                      { }
                      <img src={p.avatar} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
                    </div>
                    <span className="text-[11px] font-semibold" style={{ color: "#f0e0c8" }}>{p.name}</span>
                    <span className="text-[9px] ml-auto" style={{ color: "#94a3b8" }}>
                      {p.gender === "male" ? "M" : "F"}{", "}{p.age}
                    </span>
                  </button>
                ))}
            </div>
            <button
              onClick={() => { setShowBetPicker(false); setBetTarget1(null); setBetTarget2(null) }}
              className="mt-3 w-full rounded-lg px-3 py-2 text-[11px] font-bold transition-all hover:brightness-110"
              style={{
                background: "transparent",
                color: "#94a3b8",
                border: "1px solid #334155",
              }}
            >
              {"Отмена"}
            </button>
          </div>
        </div>
      )}

      {/* ---- PLAYER INTERACTION MENU ---- */}
      {playerMenuTarget && (() => {
        const ZODIAC_SIGNS = ["Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева", "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"]
        const zodiacDisplay = playerMenuTarget.zodiac ?? ZODIAC_SIGNS[playerMenuTarget.id % 12]
        return (
        <div
          className="player-menu-backdrop fixed inset-0 z-50 flex items-stretch justify-end overflow-hidden bg-black/60 p-0"
          onClick={() => dispatch({ type: "CLOSE_PLAYER_MENU" })}
          role="presentation"
        >
          <div
            className="player-menu-modal player-menu-modal-drawer relative flex h-app max-h-app w-full max-w-[min(100vw,400px)] shrink-0 flex-col overflow-hidden rounded-none rounded-l-2xl border-y-0 border-r-0 sm:max-w-[380px]"
            style={{
              background: "linear-gradient(165deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 50%, rgba(30, 41, 59, 0.98) 100%)",
              border: "2px solid rgba(251, 191, 36, 0.25)",
              borderRightWidth: 0,
              fontSize: "14px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 rounded-l-2xl bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(251,191,36,0.06)_0%,transparent_50%)]" aria-hidden />
            {/* Шапка: закрытие всегда на месте при прокрутке контента */}
            <div className="relative z-20 flex shrink-0 justify-end border-b border-slate-600/20 bg-slate-900/75 px-3 py-2 backdrop-blur-md sm:px-4 sm:py-2.5">
              <button
                type="button"
                onClick={() => dispatch({ type: "CLOSE_PLAYER_MENU" })}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all duration-200 hover:scale-110 hover:bg-slate-600/60 hover:text-slate-100 sm:h-10 sm:w-10"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pb-5 sm:pt-3">
            <div className="relative flex min-w-0 flex-col gap-5">
              {/* Профиль и действия — одна вертикальная колонка (боковая панель справа) */}
              <div
                className="player-menu-left w-full shrink-0 overflow-hidden rounded-2xl border border-slate-500/35 bg-gradient-to-b from-slate-900/95 to-slate-950/98 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="relative flex flex-col items-center">
                  <div
                    className="pointer-events-none absolute left-1/2 top-[52px] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80"
                    style={{
                      background: "radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, rgba(56, 189, 248, 0.05) 50%, transparent 72%)",
                    }}
                    aria-hidden
                  />
                  <PlayerAvatar
                    player={playerMenuTarget}
                    frameId={avatarFrames?.[playerMenuTarget.id] || "none"}
                    size={isMobile ? 100 : 128}
                  />
                  <h2 className="relative z-[1] mt-3 max-w-full px-1 text-center text-[1.35rem] font-extrabold leading-tight tracking-tight text-white sm:text-2xl">
                    {playerMenuTarget.name}
                  </h2>
                  <div className="relative z-[1] mt-3 grid w-full min-w-0 grid-cols-[1fr_auto] items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRosesReceivedPopover((v) => !v)}
                      className="group flex h-11 min-w-0 flex-row flex-nowrap items-center justify-center gap-2 rounded-xl border border-sky-400/40 bg-[#0a1424] px-2.5 shadow-md ring-1 ring-amber-400/20 transition-all hover:border-sky-300/55 hover:ring-amber-300/35 sm:h-12 sm:gap-2.5 sm:px-4"
                      aria-label="Сколько роз получил игрок"
                    >
                      <span className="shrink-0 text-base leading-none sm:text-lg" aria-hidden>
                        🌹
                      </span>
                      <span className="shrink-0 text-base font-black tabular-nums text-white sm:text-lg">
                        {(rosesGiven ?? []).filter((r) => r.toPlayerId === playerMenuTarget.id).length}
                      </span>
                      <span className="min-w-0 truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400 group-hover:text-sky-200/90 sm:text-[10px]">
                        получено
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFramePicker(true)}
                      className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/45 bg-gradient-to-b from-amber-500/18 to-amber-800/15 px-3.5 text-[11px] font-bold text-amber-100 shadow-sm transition-all hover:brightness-110 active:scale-[0.98] sm:h-12 sm:px-4 sm:text-xs"
                    >
                      Рамка
                    </button>
                  </div>
                  {currentUser && currentUser.id !== playerMenuTarget.id && !playerMenuTarget.isBot && (
                    <div className="relative z-[1] mt-3 w-full max-w-sm px-0.5">
                      {admirers.some((a) => a.id === playerMenuTarget.id) ? (
                        <button
                          type="button"
                          onClick={() => {
                            dispatch({ type: "REMOVE_ADMIRER", playerId: playerMenuTarget.id })
                            showToast("Убрано из поклонников", "info")
                          }}
                          className="w-full rounded-xl border border-amber-500/50 bg-slate-900/80 px-3 py-2.5 text-center text-xs font-bold text-amber-100 transition-all hover:bg-slate-800/90 sm:text-sm"
                        >
                          В поклонниках — нажмите, чтобы убрать
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            dispatch({ type: "ADD_ADMIRER", player: playerMenuTarget })
                            showToast("Добавлено в «Твои поклонники» в профиле", "success")
                          }}
                          className="w-full rounded-xl px-3 py-2.5 text-center text-xs font-extrabold text-[#0f172a] shadow-md transition-all hover:brightness-110 active:scale-[0.99] sm:text-sm"
                          style={{
                            background: "linear-gradient(180deg, #fbbf24 0%, #d97706 100%)",
                            border: "2px solid rgba(250,204,21,0.6)",
                            boxShadow: "0 2px 0 #92400e",
                          }}
                        >
                          Стать поклонником
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-4 border-t border-slate-600/35 pt-3">
                  <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Анкета</p>
                  <ul className="space-y-2.5 text-left text-sm text-slate-300 sm:text-[15px]">
                    <li className="flex items-baseline gap-2.5 border-b border-slate-700/40 pb-2.5">
                      <span className="w-6 shrink-0 text-center text-base opacity-90" aria-hidden>
                        👤
                      </span>
                      <span className="min-w-0 font-semibold text-slate-100">
                        {playerMenuTarget.gender === "male" ? "М" : "Ж"}, {playerMenuTarget.age} лет
                      </span>
                    </li>
                    {playerMenuTarget.city && (
                      <li className="flex items-start gap-2.5 border-b border-slate-700/40 pb-2.5">
                        <span className="mt-0.5 w-6 shrink-0 text-center text-base" aria-hidden>
                          📍
                        </span>
                        <span className="min-w-0 leading-snug">{playerMenuTarget.city}</span>
                      </li>
                    )}
                    {playerMenuTarget.interests && (
                      <li className="flex items-start gap-2.5 border-b border-slate-700/40 pb-2.5">
                        <span className="mt-0.5 w-6 shrink-0 text-center text-base" aria-hidden>
                          🎯
                        </span>
                        <span className="min-w-0 leading-snug">{playerMenuTarget.interests}</span>
                      </li>
                    )}
                    <li className="flex items-center gap-2.5 pt-0.5 text-amber-200/95">
                      <span className="w-6 shrink-0 text-center text-base" aria-hidden>
                        ✨
                      </span>
                      <span className="font-medium">{zodiacDisplay}</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Действия */}
              <div className="player-menu-actions flex min-h-0 min-w-0 w-full flex-1 flex-col gap-5">
                <div>
                  <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Действия</p>
                  {/* Избранное и ухаживание — верхний ряд; розы и «от вас» — ниже; ВК + магазин */}
                  {(() => {
                    const todayKey = new Date().toISOString().slice(0, 10)
                    const careEntriesToday = gameLog.filter(
                      (e) =>
                        e.type === "care" &&
                        e.toPlayer?.id === playerMenuTarget.id &&
                        new Date(e.timestamp).toISOString().slice(0, 10) === todayKey,
                    )
                    const uniqueCarerIds = new Set(careEntriesToday.map((e) => e.fromPlayer?.id).filter(Boolean))
                    const carersCount = uniqueCarerIds.size
                    const currentUserAlreadyCared = currentUser && uniqueCarerIds.has(currentUser.id)
                    const canCare = carersCount < 5 && !currentUserAlreadyCared && voiceBalance >= 50
                    const canOpenVk = !!currentUser && (courtshipProfileAllowed?.[playerMenuTarget.id] !== false) && voiceBalance >= 200
                    const myRosesToThem = (rosesGiven ?? []).filter(
                      (r) => r.fromPlayerId === currentUser?.id && r.toPlayerId === playerMenuTarget.id,
                    ).length
                    const careHandler = () => {
                      if (!currentUser) return
                      if (currentUserAlreadyCared) {
                        showToast("Вы уже ухаживали сегодня", "info")
                        return
                      }
                      if (carersCount >= 5) {
                        showToast("Лимит ухаживаний за этим игроком на сегодня", "info")
                        return
                      }
                      if (voiceBalance < 50) {
                        showToast("Нужно 50 сердец", "error")
                        return
                      }
                      dispatch({ type: "PAY_VOICES", amount: 50 })
                      dispatch({
                        type: "ADD_LOG",
                        entry: {
                          id: generateLogId(),
                          type: "care",
                          fromPlayer: currentUser!,
                          toPlayer: playerMenuTarget,
                          text: `${currentUser!.name} ухаживает за ${playerMenuTarget.name}`,
                          timestamp: Date.now(),
                        },
                      })
                      dispatch({ type: "CLOSE_PLAYER_MENU" })
                      showToast("Ухаживание отправлено!", "success")
                    }
                    const roseHandler = () => {
                      if (!currentUser) return
                      if (voiceBalance < 50) {
                        showToast("Нужно 50 сердец для роз", "error")
                        return
                      }
                      dispatch({ type: "GIVE_ROSE", fromPlayerId: currentUser.id, toPlayerId: playerMenuTarget.id })
                      showToast("Розы подарены", "success")
                    }
                    const baseTile =
                      "flex min-h-[5.75rem] min-w-0 flex-col items-center justify-between gap-1 rounded-xl py-2 text-center font-bold transition-all hover:brightness-110 active:scale-[0.98] sm:min-h-[6.25rem] sm:gap-1.5 sm:py-2.5"
                    const baseTileNarrow =
                      "px-1.5 sm:px-2"
                    const baseTileWide =
                      "px-2 sm:px-2.5"
                    const titleCls =
                      "px-0.5 text-center text-xs font-extrabold leading-snug tracking-tight sm:text-sm"
                    const priceCellLight =
                      "flex w-full items-center justify-center gap-1 rounded-lg border border-white/35 bg-black/25 px-1.5 py-1.5 text-[11px] font-bold tabular-nums shadow-inner sm:py-2 sm:text-xs"
                    const priceCellGold =
                      "flex w-full items-center justify-center rounded-lg border border-slate-900/20 bg-slate-900/10 px-1.5 py-1.5 text-[11px] font-bold text-slate-900 shadow-inner sm:py-2 sm:text-xs"
                    const buyHeartsBtnCls =
                      "flex min-h-[3rem] w-full min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center text-[12px] font-extrabold leading-tight transition-all hover:brightness-110 active:scale-[0.99] sm:min-h-[3.25rem] sm:text-[13px]"
                    return (
                      <div className="flex flex-col gap-2 sm:gap-2.5">
                        <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              dispatch({ type: "ADD_FAVORITE", player: playerMenuTarget })
                              dispatch({ type: "CLOSE_PLAYER_MENU" })
                            }}
                            className={`${baseTile} ${baseTileNarrow} min-w-0`}
                            style={{
                              background: "linear-gradient(180deg, #e8c06a 0%, #c4943a 100%)",
                              color: "#0f172a",
                              border: "2px solid #94a3b8",
                              boxShadow: "0 2px 0 #475569",
                            }}
                          >
                            <Star className="h-5 w-5 shrink-0 text-slate-900 sm:h-6 sm:w-6" />
                            <span className={`${titleCls} text-slate-900`}>В избранное</span>
                            <div className={priceCellGold}>бесплатно</div>
                          </button>
                          <button
                            type="button"
                            onClick={careHandler}
                            disabled={!canCare}
                            className={`${baseTile} ${baseTileNarrow} min-w-0 disabled:opacity-40`}
                            style={{
                              background: "linear-gradient(180deg, #ec4899 0%, #be185d 100%)",
                              color: "#fff",
                              border: "2px solid #9d174d",
                              boxShadow: "0 2px 0 #831843",
                            }}
                          >
                            <Heart className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" fill="currentColor" />
                            <span className={`${titleCls} text-white`}>Ухаживать</span>
                            <div className={priceCellLight}>
                              <span>50</span>
                              <Heart className="h-3.5 w-3.5 opacity-95" fill="currentColor" />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={roseHandler}
                            disabled={!currentUser || voiceBalance < 50}
                            className={`min-w-0 ${baseTile} ${baseTileWide} disabled:opacity-40`}
                            style={{
                              background: "linear-gradient(180deg, #e11d48 0%, #be123c 100%)",
                              color: "#fff",
                              border: "2px solid #9f1239",
                              boxShadow: "0 2px 0 #881337",
                            }}
                          >
                            <span className="text-xl leading-none sm:text-2xl" aria-hidden>
                              🌹
                            </span>
                            <span className={`${titleCls} text-white`}>Подарить розы</span>
                            <div className={priceCellLight}>
                              <span>50</span>
                              <Heart className="h-3.5 w-3.5 opacity-95" fill="currentColor" />
                            </div>
                          </button>
                          {currentUser && (
                            <div
                              className={`min-w-0 ${baseTile} ${baseTileWide}`}
                              style={{
                                background: "linear-gradient(180deg, #e11d48 0%, #be123c 100%)",
                                color: "#fff",
                                border: "2px solid #9f1239",
                                boxShadow: "0 2px 0 #881337",
                              }}
                              title="Сколько роз вы подарили этому игроку"
                            >
                              <span className="text-xl leading-none sm:text-2xl" aria-hidden>
                                🌹
                              </span>
                              <span className={`${titleCls} text-white`}>От вас</span>
                              <div className={priceCellLight}>
                                <span className="tabular-nums">{myRosesToThem}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {courtshipProfileAllowed?.[playerMenuTarget.id] !== false ? (
                          <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 sm:gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (voiceBalance < 200) {
                                  showToast("Нужно 200 сердец для перехода в VK", "error")
                                  return
                                }
                                dispatch({ type: "PAY_VOICES", amount: 200 })
                                window.open(`https://vk.com/id${playerMenuTarget.id}`, "_blank", "noopener,noreferrer")
                                showToast("Открыт профиль VK", "success")
                              }}
                              disabled={!canOpenVk}
                              className="flex min-h-[3rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[12px] font-bold transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40 sm:min-h-[3.25rem] sm:text-[13px]"
                              style={{
                                background: "linear-gradient(180deg, #2787F5 0%, #1a6bd1 100%)",
                                color: "#fff",
                                border: "2px solid #1565c0",
                                boxShadow: "0 2px 0 #0d47a1",
                              }}
                            >
                              <User className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                              <span className="text-center leading-snug">Профиль ВК — 200 ❤</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })
                                dispatch({ type: "CLOSE_PLAYER_MENU" })
                              }}
                              className={`${buyHeartsBtnCls} text-amber-950`}
                              style={{
                                background: "linear-gradient(180deg, #fde68a 0%, #f59e0b 100%)",
                                border: "2px solid #d97706",
                                boxShadow: "0 2px 0 #b45309",
                              }}
                            >
                              <Heart className="h-4 w-4 shrink-0" fill="currentColor" />
                              Купить сердца
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <p
                              className="rounded-xl px-3 py-2.5 text-center text-[13px] font-medium sm:text-[15px]"
                              style={{ color: "#94a3b8", background: "rgba(15,23,42,0.6)", border: "1px solid #334155" }}
                            >
                              {"Если хотите пообщаться, но кнопка не работает — активируйте приват."}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })
                                dispatch({ type: "CLOSE_PLAYER_MENU" })
                              }}
                              className={`${buyHeartsBtnCls} w-full text-amber-950`}
                              style={{
                                background: "linear-gradient(180deg, #fde68a 0%, #f59e0b 100%)",
                                border: "2px solid #d97706",
                                boxShadow: "0 2px 0 #b45309",
                              }}
                            >
                              <Heart className="h-4 w-4 shrink-0" fill="currentColor" />
                              Купить сердца
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Угадай-ка: пара совпала 5 раз — возможность дружить профилями */}
                  {currentUser && (() => {
                    const pairKey = [currentUser.id, playerMenuTarget.id].sort((a, b) => a - b).join("_")
                    const canFriendProfiles = ugadaikaFriendUnlocked?.[pairKey]
                    if (!canFriendProfiles) return null
                    return (
                      <div
                        className="mt-2 rounded-lg border border-emerald-500/50 px-3 py-2.5 text-center text-[13px]"
                        style={{ background: "rgba(34, 197, 94, 0.12)" }}
                      >
                        <p className="font-semibold text-emerald-200">Дружить профилями</p>
                        <p className="mt-0.5 text-slate-400">Вы с этим игроком 5 раз совпали в паре в Угадай-ка — доступна связь профилей.</p>
                        <button
                          type="button"
                          className="mt-2 rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500/80"
                        >
                          Связать профили
                        </button>
                      </div>
                    )
                  })()}
                </div>

              </div>
            </div>
            </div>

            {/* Окно выбора рамки для подарка — поверх модалки игрока */}
            {showFramePicker && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 overflow-y-auto overscroll-contain"
                onClick={() => { setShowFramePicker(false); setSelectedFrameForGift(null) }}
              >
                <div
                  className="flex min-h-0 max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-hidden rounded-2xl p-5 shadow-xl"
                  style={{ background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)", border: "1px solid #334155" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="shrink-0 text-center text-[16px] font-bold text-slate-100">Подарить рамку</p>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4">
                  <p className="text-[13px] font-semibold text-slate-300">Бесплатные</p>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { id: "none", label: "Без рамки", border: "2px solid #475569", shadow: "none", svgPath: null as string | null, cost: 0 },
                      { id: "gold", label: "Золото", border: "3px solid #e8c06a", shadow: "0 0 10px rgba(232,192,106,0.8)", svgPath: null, cost: 0 },
                      { id: "silver", label: "Серебро", border: "3px solid #c0c0c0", shadow: "0 0 10px rgba(192,192,192,0.7)", svgPath: null, cost: 0 },
                      { id: "hearts", label: "Сердечки", border: "3px solid #e74c3c", shadow: "0 0 12px rgba(231,76,60,0.7)", svgPath: null, cost: 0 },
                      { id: "roses", label: "Розы", border: "3px solid #be123c", shadow: "0 0 12px rgba(190,18,60,0.6)", svgPath: null, cost: 0 },
                      { id: "gradient", label: "Градиент", border: "3px solid #8b5cf6", shadow: "0 0 14px rgba(139,92,246,0.6)", svgPath: null, cost: 0 },
                      { id: "neon", label: "Неон", border: "3px solid rgba(0, 255, 255, 0.95)", shadow: "none", svgPath: null, cost: 0 },
                      { id: "snow", label: "Снежная", border: "3px solid rgba(186, 230, 253, 0.95)", shadow: "0 0 12px rgba(186, 230, 253, 0.5)", svgPath: null, cost: 0 },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFrameForGift(f.id)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl py-2.5 transition-colors hover:bg-slate-600/50 ${selectedFrameForGift === f.id ? "ring-2 ring-sky-400 bg-slate-600/50" : ""}`}
                      >
                        <div className="relative h-14 w-14 flex-shrink-0">
                          <div className="h-full w-full overflow-hidden rounded-full bg-slate-700" style={{ border: f.border, boxShadow: f.shadow, padding: 2 }} />
                          {f.svgPath && (
                            <img src={assetUrl(f.svgPath)} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" aria-hidden />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-300 leading-tight text-center">{f.label}</span>
                      </button>
                    ))}
                  </div>

                  <p className="text-[13px] font-semibold text-amber-200">Премиум — 5 ❤ за рамку</p>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { id: "fox", label: "Лиса", border: "2px solid transparent", shadow: "none", svgPath: "ram-lis.svg", cost: 5 },
                      { id: "rabbit", label: "Кролик", border: "2px solid transparent", shadow: "none", svgPath: "ram-rabbit.svg", cost: 5 },
                      { id: "fairy", label: "Фея", border: "2px solid transparent", shadow: "none", svgPath: "ram-fea.svg", cost: 5 },
                      { id: "mag", label: "Маг сердца", border: "2px solid transparent", shadow: "none", svgPath: "ram-mag.svg", cost: 5 },
                      { id: "malif", label: "Милифисента", border: "2px solid transparent", shadow: "none", svgPath: "ram-malif.svg", cost: 5 },
                      { id: "mir", label: "Миру мир", border: "2px solid transparent", shadow: "none", svgPath: "ram-mir.svg", cost: 5 },
                      { id: "vesna", label: "Весна", border: "2px solid transparent", shadow: "none", svgPath: "ram-vesna.svg", cost: 5 },
                    ].map((f) => {
                      const canAfford = voiceBalance >= f.cost
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setSelectedFrameForGift(f.id)}
                          disabled={!canAfford}
                          className={`flex flex-col items-center gap-1.5 rounded-xl py-2.5 transition-colors hover:bg-slate-600/50 disabled:opacity-50 disabled:cursor-not-allowed ${selectedFrameForGift === f.id ? "ring-2 ring-amber-400 bg-slate-600/50" : ""}`}
                        >
                          <div className="relative h-14 w-14 flex-shrink-0">
                            <div className="h-full w-full overflow-hidden rounded-full bg-slate-700" style={{ border: f.border, boxShadow: f.shadow, padding: 2 }} />
                            {f.svgPath && (
                              <img src={assetUrl(f.svgPath)} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" aria-hidden />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-300 leading-tight text-center">{f.label}</span>
                          <span className="text-[10px] text-amber-400 font-medium">{f.cost} ❤</span>
                        </button>
                      )
                    })}
                  </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedFrameForGift == null) {
                          showToast("Выберите рамку", "info")
                          return
                        }
                        const isPremium = ["fox", "rabbit", "fairy", "mag", "malif", "mir", "vesna"].includes(selectedFrameForGift)
                        const cost = isPremium ? 5 : 0
                        if (cost > 0 && voiceBalance < cost) {
                          showToast("Недостаточно сердец для рамки", "error")
                          return
                        }
                        if (cost > 0) dispatch({ type: "PAY_VOICES", amount: cost })
                        dispatch({ type: "SET_AVATAR_FRAME", playerId: playerMenuTarget.id, frameId: selectedFrameForGift })
                        setShowFramePicker(false)
                        setSelectedFrameForGift(null)
                        showToast("Рамка подарена", "success")
                      }}
                      disabled={selectedFrameForGift == null || (["fox", "rabbit", "fairy", "mag", "malif", "mir", "vesna"].includes(selectedFrameForGift ?? "") && voiceBalance < 5)}
                      className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-bold transition-all disabled:opacity-40"
                      style={{
                        background: "linear-gradient(180deg, #e8c06a 0%, #c4943a 100%)",
                        color: "#0f172a",
                        border: "2px solid #475569",
                      }}
                    >
                      <Heart className="h-4 w-4" fill="currentColor" />
                      {selectedFrameForGift != null && ["fox", "rabbit", "fairy", "mag", "malif", "mir", "vesna"].includes(selectedFrameForGift) ? "Подарить рамку — 5 ❤" : "Подарить рамку"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowFramePicker(false); setSelectedFrameForGift(null) }}
                      className="rounded-xl bg-slate-600/80 px-4 py-2 text-[13px] text-slate-200 hover:bg-slate-500/80"
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* Каталог подарков — правая панель как у профиля (из мини-меню аватара) */}
      {giftCatalogDrawerPlayer && currentUser && (
        <div
          className="gift-catalog-backdrop fixed inset-0 z-[55] flex items-stretch justify-end overflow-visible bg-transparent p-0"
          role="presentation"
        >
          <div
            className="gift-catalog-panel gift-catalog-drawer relative flex h-app max-h-app w-full max-w-[min(100vw,400px)] shrink-0 flex-col overflow-hidden rounded-none rounded-l-2xl border-y-0 border-r-0 sm:max-w-[380px]"
            style={{
              background: "linear-gradient(165deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 50%, rgba(30, 41, 59, 0.98) 100%)",
              border: "2px solid rgba(251, 191, 36, 0.25)",
              borderRightWidth: 0,
              fontSize: "14px",
            }}
          >
            <div className="pointer-events-none absolute inset-0 rounded-l-2xl bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(251,191,36,0.06)_0%,transparent_50%)]" aria-hidden />
            <div className="relative z-20 flex shrink-0 justify-end border-b border-slate-600/25 bg-slate-900/95 px-3 py-2 sm:px-4 sm:py-2.5">
              <button
                type="button"
                onClick={() => setGiftCatalogDrawerPlayer(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition-all duration-200 hover:scale-110 hover:bg-slate-600/60 hover:text-slate-100 sm:h-10 sm:w-10"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4 sm:pb-5 sm:pt-4">
              <div className="player-menu-catalog flex min-h-0 w-full flex-1 flex-col gap-4">
                <div className="shrink-0 px-0.5">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/25 to-amber-500/20 ring-1 ring-rose-400/20">
                      <Gift className="h-[18px] w-[18px] text-rose-300/90" strokeWidth={2} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="bg-gradient-to-r from-slate-50 via-white to-slate-200 bg-clip-text text-[17px] font-extrabold leading-snug tracking-tight text-transparent sm:text-xl">
                        {`Подарки для ${giftCatalogDrawerPlayer.name}`}
                      </h2>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                        <Sparkles className="h-3 w-3 text-amber-400/70" aria-hidden />
                        <span>до 10</span>
                        <span className="text-rose-400" aria-hidden>
                          ❤
                        </span>
                        <span className="text-slate-500">за подарок</span>
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="flex min-h-0 flex-1 flex-col rounded-[1.35rem] border border-amber-500/15 p-3 sm:p-4"
                  style={{
                    background:
                      "linear-gradient(165deg, rgba(30,41,59,0.55) 0%, rgba(15,23,42,0.92) 45%, rgba(15,23,42,0.98) 100%)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(251,191,36,0.06)",
                  }}
                >
                  <div className="player-menu-gifts-scroll max-h-[min(62dvh,520px)] min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden py-1 sm:max-h-[min(68dvh,560px)]">
                    {(
                      [
                        {
                          key: "free",
                          title: "Бесплатные",
                          gifts: GIFT_CATALOG_FREE,
                          emptyHint: "Скоро добавим подарки",
                          accent: "sky" as const,
                        },
                        {
                          key: "premium",
                          title: "Премиум",
                          gifts: GIFT_CATALOG_PREMIUM,
                          accent: "amber" as const,
                        },
                      ] as const
                    ).map((section) => (
                      <div key={section.key}>
                        <div className="mb-3 flex items-center gap-2.5">
                          <span
                            className={`h-9 w-1 shrink-0 rounded-full shadow-lg ${
                              section.accent === "sky"
                                ? "bg-gradient-to-b from-sky-400 to-cyan-500 shadow-sky-500/25"
                                : "bg-gradient-to-b from-amber-300 to-amber-600 shadow-amber-500/30"
                            }`}
                            aria-hidden
                          />
                          <h3
                            className={`text-[11px] font-bold uppercase tracking-[0.22em] sm:text-xs ${
                              section.accent === "sky"
                                ? "text-sky-300/95"
                                : "text-amber-300/95"
                            }`}
                          >
                            {section.title}
                          </h3>
                          <span
                            className={`h-px min-w-[1.5rem] flex-1 bg-gradient-to-r opacity-60 ${
                              section.accent === "sky"
                                ? "from-sky-500/40 to-transparent"
                                : "from-amber-500/40 to-transparent"
                            }`}
                            aria-hidden
                          />
                        </div>
                        {section.gifts.length === 0 ? (
                          <div className="relative overflow-hidden rounded-2xl border border-dashed border-sky-500/20 bg-gradient-to-br from-slate-800/50 via-slate-900/30 to-slate-800/40 px-4 py-9 text-center">
                            <div
                              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(56,189,248,0.12),transparent_65%)]"
                              aria-hidden
                            />
                            <Gift
                              className="relative mx-auto mb-3 h-11 w-11 text-sky-400/45"
                              strokeWidth={1.15}
                              aria-hidden
                            />
                            <p className="relative text-sm font-semibold text-slate-200">
                              {"emptyHint" in section ? section.emptyHint : "—"}
                            </p>
                            <p className="relative mt-1.5 text-xs text-slate-500">Новые сюрпризы уже в пути</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 content-start gap-2 sm:gap-2.5">
                            {section.gifts.map((gift) => {
                              const toId = giftCatalogDrawerPlayer.id
                              const alreadyGifted = inventory.some(
                                (item) => item.toPlayerId === toId && item.type === gift.id,
                              )
                              const needPay = gift.cost > 0
                              const disabled =
                                alreadyGifted || (needPay && voiceBalance < gift.cost)
                              const handleGiftClick = () => {
                                if (disabled) return
                                if (needPay) dispatch({ type: "PAY_VOICES", amount: gift.cost })
                                dispatch({
                                  type: "ADD_INVENTORY_ITEM",
                                  item: {
                                    type: gift.id,
                                    fromPlayerId: currentUser.id,
                                    fromPlayerName: currentUser.name,
                                    timestamp: Date.now(),
                                    toPlayerId: toId,
                                  },
                                })
                                dispatch({
                                  type: "ADD_LOG",
                                  entry: {
                                    id: generateLogId(),
                                    type: "system",
                                    fromPlayer: currentUser,
                                    toPlayer: giftCatalogDrawerPlayer,
                                    text: `${currentUser.name} дарит подарок «${gift.name}» игроку ${giftCatalogDrawerPlayer.name}`,
                                    timestamp: Date.now(),
                                  } as GameLogEntry,
                                })
                              }
                              const isPremiumSection = section.key === "premium"
                              return (
                                <button
                                  key={`${section.key}-${gift.id}`}
                                  type="button"
                                  onClick={handleGiftClick}
                                  aria-label={gift.name}
                                  title={gift.name}
                                  className="player-menu-gift-item group relative flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-slate-700/35 to-slate-950/50 p-2 pb-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/20 hover:shadow-[0_14px_28px_-10px_rgba(0,0,0,0.55),0_0_24px_-6px_rgba(251,191,36,0.12)] disabled:translate-y-0 disabled:opacity-45 disabled:hover:border-white/[0.06] disabled:hover:shadow-none sm:gap-2.5 sm:p-2.5"
                                  disabled={disabled}
                                >
                                  <div
                                    className={`relative flex h-[2.65rem] w-[2.65rem] shrink-0 items-center justify-center rounded-2xl ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.06] sm:h-12 sm:w-12 ${
                                      isPremiumSection && !disabled
                                        ? "bg-gradient-to-br from-amber-500/20 via-slate-700/40 to-slate-900/80 group-hover:ring-amber-400/25"
                                        : "bg-gradient-to-br from-slate-600/45 to-slate-900/75 group-hover:ring-sky-400/20"
                                    } ${disabled ? "opacity-50 grayscale-[0.35]" : ""}`}
                                  >
                                    <span className="select-none text-[1.35rem] leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:text-2xl">
                                      {gift.emoji}
                                    </span>
                                  </div>
                                  <span className="line-clamp-2 min-h-[2rem] w-full px-0.5 text-center text-[9px] font-medium leading-tight text-slate-400 group-hover:text-slate-300 sm:min-h-[2.25rem] sm:text-[10px]">
                                    {gift.name}
                                  </span>
                                  {alreadyGifted ? (
                                    <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300/90 sm:text-[10px]">
                                      ✓ Дарено
                                    </span>
                                  ) : gift.cost === 0 ? (
                                    <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-full border border-sky-400/35 bg-gradient-to-b from-sky-500/25 to-sky-600/10 px-2 py-0.5 text-[9px] font-extrabold tabular-nums text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:text-[10px]">
                                      0 ❤
                                    </span>
                                  ) : (
                                    <span className="inline-flex min-w-[2.75rem] items-center justify-center gap-0.5 rounded-full border border-rose-500/30 bg-gradient-to-b from-rose-500/20 to-slate-900/60 px-2 py-0.5 text-[9px] font-extrabold tabular-nums text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] sm:text-[10px]">
                                      <span className="text-[10px] leading-none text-rose-400 sm:text-[11px]" aria-hidden>
                                        ❤
                                      </span>
                                      {gift.cost}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- PAYMENT DIALOG ---- */}
      {showPaymentDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-xs rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-300"
            style={{
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              border: "2px solid #475569",
            }}
          >
            <h3 className="mb-2 text-base font-bold" style={{ color: "#f0e0c8" }}>
              {"Пригласить общаться?"}
            </h3>
            <p className="mb-4 text-sm" style={{ color: "#94a3b8" }}>
              {"Списать 5 сердец для общения с "}
              <strong style={{ color: "#e8c06a" }}>{targetPlayer?.name}</strong>{"?"}
            </p>
            <div
              className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid #334155" }}
            >
              <Coins className="h-4 w-4" style={{ color: "#e8c06a" }} />
              <span className="text-sm" style={{ color: "#f0e0c8" }}>
                {"Баланс: "}{voiceBalance}{" сердец"}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleInvite}
                disabled={paymentLoading || voiceBalance < 5}
                className="flex-1 rounded-xl text-sm font-bold"
                style={{
                  background: "linear-gradient(180deg, #2ecc71 0%, #27ae60 100%)",
                  color: "#fff",
                  border: "2px solid #1e8449",
                }}
              >
                {paymentLoading ? "Оплата..." : "Пригласить"}
              </Button>
              <Button
                onClick={() => {
                  setShowPaymentDialog(false)
                  autoAdvanceRef.current = setTimeout(() => dispatch({ type: "NEXT_TURN" }), 3000)
                }}
                variant="outline"
                className="flex-1 rounded-xl text-sm"
                style={{
                  background: "transparent",
                  color: "#94a3b8",
                  border: "2px solid #334155",
                }}
              >
                {"Отмена"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* магазин теперь отдельным экраном (ShopScreen) */}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Table chat (общий чат за столом; один экземпляр на мобиле или в правой панели) */
/* ------------------------------------------------------------------ */
function TableChatPanel({
  gameLog,
  chatInput,
  setChatInput,
  onSend,
  logEndRef,
  currentUserId,
  chatDisabled,
  className,
}: {
  gameLog: GameLogEntry[]
  chatInput: string
  setChatInput: (v: SetStateAction<string>) => void
  onSend: () => void
  logEndRef: RefObject<HTMLDivElement | null>
  currentUserId?: number
  chatDisabled?: boolean
  className?: string
}) {
  const chatEntries = gameLog.filter((entry) => entry.type === "chat")
  return (
    <div
      className={cn("flex min-h-0 flex-col rounded-2xl overflow-hidden", className)}
      style={{
        border: "1px solid rgba(56, 189, 248, 0.24)",
        background: "linear-gradient(180deg, rgba(2,6,23,0.7) 0%, rgba(2,6,23,0.5) 100%)",
        boxShadow: "0 10px 24px rgba(2,6,23,0.6)",
      }}
    >
      <div
        className="flex shrink-0 flex-col gap-0.5 rounded-t-lg px-3 py-2"
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.9) 100%)",
          borderBottom: "1px solid rgba(56,189,248,0.35)",
        }}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "#e8c06a" }} />
          <span className="text-sm font-bold" style={{ color: "#f0e0c8" }}>
            Сообщения за столом
          </span>
        </div>
        <span className="text-[10px] leading-tight" style={{ color: "#64748b" }}>
          История ходов и реплик в этом раунде
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1 overscroll-contain">
        {chatEntries.length === 0 && (
          <p className="py-6 text-center text-[11px]" style={{ color: "#94a3b8" }}>
            {"Игра начинается..."}
          </p>
        )}
        <div className="flex flex-col gap-2.5 px-0.5 py-1">
          {chatEntries.map((entry) => (
            <ChatBubble key={entry.id} entry={entry} currentUserId={currentUserId} />
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      <div
        className="shrink-0 px-2 pb-2 pt-1.5"
        style={{ borderTop: "1px solid rgba(92,58,36,0.6)" }}
      >
        <div className="flex items-center gap-1.5">
          <TableChatEmojiPicker
            disabled={chatDisabled}
            onEmojiSelect={(emoji) => setChatInput((prev) => prev + emoji)}
          />
          <input
            type="text"
            placeholder={chatDisabled ? "Пауза — чат недоступен" : "Введите сообщение..."}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSend()
            }}
            disabled={chatDisabled}
            className="flex-1 min-w-0 px-1.5 py-1.5 text-[11px] focus:outline-none disabled:opacity-50"
            style={{
              backgroundColor: "transparent",
              border: "none",
              borderBottom: "1px solid rgba(92,58,36,0.8)",
              color: "#f0e0c8",
            }}
            aria-label="Поле чата стола"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={chatDisabled}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all hover:brightness-110 disabled:opacity-40"
            style={{
              background: "linear-gradient(180deg, #3498db 0%, #2980b9 100%)",
            }}
            aria-label="Отправить сообщение в чат"
          >
            <Send className="h-3.5 w-3.5" style={{ color: "#fff" }} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Chat bubble component                                              */
/* ------------------------------------------------------------------ */
function ChatBubble({ entry, currentUserId }: { entry: GameLogEntry; currentUserId?: number }) {
  const isOwn = entry.fromPlayer?.id === currentUserId
  const colorMap: Record<string, string> = {
    kiss: "#e74c3c",
    beer: "#f39c12",
    skip: "#94a3b8",
    invite: "#e8c06a",
    join: "#2ecc71",
    system: "#38bdf8",
    chat: "#38bdf8",
    hug: "#2ecc71",
    selfie: "#38bdf8",
    flowers: "#e74c3c",
    song: "#9b59b6",
    rose: "#e74c3c",
    prediction: "#e8c06a",
    bottle_thanks: "#facc15",
  }
  const accentColor = colorMap[entry.type] ?? "#94a3b8"
  const isChat = entry.type === "chat"

  if (isChat) {
    return (
      <div
        className={cn(
          "flex max-w-[95%] gap-2.5 rounded-2xl px-3 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.35)] transition-colors",
          isOwn
            ? "ml-auto flex-row-reverse border-r-[3px] border-sky-400 bg-[linear-gradient(135deg,rgba(28,32,42,0.95)_0%,rgba(18,22,30,0.98)_100%)]"
            : "mr-auto border-l-[3px] border-sky-500 bg-[linear-gradient(135deg,rgba(32,28,24,0.96)_0%,rgba(20,18,16,0.98)_100%)]",
        )}
      >
        {entry.fromPlayer && (
          <div
            className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-sky-500/45 ring-offset-1 ring-offset-[rgba(12,10,9,0.6)]"
            style={{ boxShadow: `0 0 0 1px ${accentColor}33` }}
          >
            <img src={entry.fromPlayer.avatar} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          {entry.fromPlayer && (
            <div className={cn("mb-0.5 text-xs font-semibold tracking-tight text-sky-300", isOwn && "text-sky-200")}>
              {entry.fromPlayer.name}
            </div>
          )}
          <p
            className="text-[13px] leading-snug text-[#d8c9a8]"
            style={{ wordBreak: "break-word" }}
          >
            {entry.text}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-lg px-2.5 py-1.5 transition-colors"
      style={{
        background: isOwn ? "rgba(196, 148, 58, 0.15)" : "rgba(60, 35, 20, 0.6)",
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      {entry.fromPlayer && (
        <div className="flex items-center gap-1.5 mb-0.5">
          <div
            className="h-4 w-4 shrink-0 overflow-hidden rounded-full"
            style={{ border: `1.5px solid ${accentColor}` }}
          >
            <img src={entry.fromPlayer.avatar} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
          </div>
          <span className="text-[10px] font-bold" style={{ color: accentColor }}>
            {entry.fromPlayer.name}
          </span>
        </div>
      )}
      <p className="text-[10px] leading-tight" style={{ color: "#c0a070" }}>
        {entry.text}
      </p>
    </div>
  )
}
