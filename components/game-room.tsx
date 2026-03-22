"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Heart,
  MessageCircle,
  Star,
  RotateCw,
  Beer,
  X,
  Coins,
  Send,
  Zap,
  ArrowRight,
  Sparkles,
  User,
  Gift,
  Camera,
  Music,
  Target,
  Trophy,
  Flower2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGame, generateLogId, sortPair, pairsMatch, getPairGenderCombo, generateBots, randomAvatarFrame } from "@/lib/game-context"
import { assetUrl, BOTTLE_IMAGES, EMOJI_BANYA, EMOTION_SOUNDS } from "@/lib/assets"
import { Bottle } from "@/components/bottle"
import { PlayerAvatar } from "@/components/player-avatar"
import { TableDecorations } from "@/components/decorations"
import { RatingModal } from "@/components/rating-screen"
import { WelcomeGiftDialog } from "@/components/welcome-gift-dialog"
import { InlineToast } from "@/components/ui/inline-toast"
import { useInlineToast } from "@/hooks/use-inline-toast"
import { composeTablePlayers } from "@/lib/table-composition"
import {
  PAIR_ACTIONS,
  type PairAction,
  type Player,
  type GameLogEntry,
  type PairGenderCombo,
  type InventoryItem,
} from "@/lib/game-types"
import { useTheme } from "next-themes"
import { useIsMobile, useIsTablet } from "@/lib/use-media-query"

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

const DAILY_EMOTION_LIMIT = 50
const EMOTION_PACK_COST = 5
const EMOTION_PACK_EXTRA_PER_TYPE = 50

function getTodayDateKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function shouldShowActionCostBadge(actionId: string, actionCost: number): boolean {
  if (actionId === "kiss" || actionId === "beer" || actionId === "cocktail") return false
  return actionCost > 0
}


/* ------------------------------------------------------------------ */
/*  Flying emoji animation                                            */
/* ------------------------------------------------------------------ */
interface FlyingEmoji {
  id: string
  emoji?: string
  imgSrc?: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

function FlyingEmojiContent({ fe }: { fe: FlyingEmoji }) {
  const [imgError, setImgError] = useState(false)
  useEffect(() => setImgError(false), [fe.imgSrc])
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
  x: number
  y: number
  delayMs: number
}

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


export function GameRoom() {
  const { state, dispatch } = useGame()
  useTheme()
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  const isMobileOrTablet = isMobile || isTablet
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
    generalChatMessages = [],
    emotionDailyBoost,
  } = state

  // Локальный лоадер при входе/смене стола, чтобы скрыть «скачки»
  const [tableLoading, setTableLoading] = useState(false)
  const lastTableIdRef = useRef<number | null>(null)

  const { toast, showToast } = useInlineToast(2000)
  const maxTableSize = isMobileOrTablet ? 6 : 10
  const targetMales = isMobileOrTablet ? 3 : 5
  const targetFemales = isMobileOrTablet ? 3 : 5

  const composePlayersFromLive = useCallback(
    (livePlayers: Player[]) => {
      if (!currentUser) return players
      const bots = generateBots(220, currentUser.gender)
      return composeTablePlayers({
        currentUser: { ...currentUser, isBot: false },
        livePlayers: livePlayers.map((p) => ({ ...p, isBot: false })),
        existingPlayers: players,
        maxTableSize,
        targetMales,
        targetFemales,
        botPool: bots,
      })
    },
    [currentUser, players, maxTableSize, targetMales, targetFemales],
  )

  const syncLiveTable = useCallback(
    async (mode: "join" | "sync", forceNew = false) => {
      if (!currentUser) return null
      try {
        const res = await fetch("/api/table/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            mode,
            forceNew,
            user: currentUser,
            tableId,
            maxTableSize,
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok || !Array.isArray(data.livePlayers)) return null
        const livePlayers = data.livePlayers.map((p: Player) => ({ ...p, isBot: false }))
        const nextPlayers = composePlayersFromLive(livePlayers)
        const nextTableId = typeof data.tableId === "number" ? data.tableId : tableId
        if (mode === "join" || nextTableId !== tableId) {
          dispatch({ type: "SET_TABLE", players: nextPlayers, tableId: nextTableId })
        } else {
          dispatch({ type: "SET_PLAYERS", players: nextPlayers })
        }
        if (typeof data.tablesCount === "number") {
          dispatch({ type: "SET_TABLES_COUNT", tablesCount: data.tablesCount })
        }
        return { tableId: nextTableId, liveCount: livePlayers.length }
      } catch {
        return null
      }
    },
    [currentUser, tableId, maxTableSize, composePlayersFromLive, dispatch],
  )

  useEffect(() => {
    // При первом входе просто запоминаем стол
    if (lastTableIdRef.current === null) {
      lastTableIdRef.current = tableId
      return
    }
    // При смене tableId включаем короткий лоадер
    if (lastTableIdRef.current !== tableId) {
      lastTableIdRef.current = tableId
      setTableLoading(true)
      const t = setTimeout(() => setTableLoading(false), 1200)
      return () => clearTimeout(t)
    }
  }, [tableId])

  // Синхронизация живых игроков за столом: если кто-то подключился,
  // добавляем его в список и убираем лишнего бота.
  useEffect(() => {
    if (!currentUser) return
    let cancelled = false

    const tick = async () => {
      const result = await syncLiveTable("sync")
      if (!result || cancelled) return
    }

    void tick()
    const interval = setInterval(() => {
      void tick()
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [currentUser, tableId, syncLiveTable])

  // Освобождаем место за столом при выходе из комнаты/приложения.
  useEffect(() => {
    if (!currentUser) return
    const payload = JSON.stringify({ mode: "leave", userId: currentUser.id })
    const leave = () => {
      void fetch("/api/table/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: payload,
      }).catch(() => {})
    }

    const onBeforeUnload = () => leave()
    window.addEventListener("beforeunload", onBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      leave()
    }
  }, [currentUser])

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
  }, [])

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

    startMusic()

    const onVisibility = () => {
      if (document.hidden) {
        audioRef.current?.pause()
      } else if (musicEnabled) {
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
  }, [musicEnabled, startMusic, stopMusic])

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
    }
  }, [playerMenuTarget])

  // Приветственный подарок при первом заходе (по пользователю в localStorage)
  const WELCOME_GIFT_KEY = "spindate_welcome_gift_v1"
  const [showWelcomeGift, setShowWelcomeGift] = useState(false)
  const [welcomeClaimedForSession, setWelcomeClaimedForSession] = useState(false)

  useEffect(() => {
    if (!currentUser) return
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
  }, [currentUser?.id, currentUser?.authProvider, voiceBalance])

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
    if (!currentUser) return
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
  }, [currentUser, dailyBonusTodayKey, dailyBonusYesterdayKey, welcomeClaimedForSession])

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
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showRosesReceivedPopover, setShowRosesReceivedPopover] = useState(false)
  const [showFramePicker, setShowFramePicker] = useState(false)
  const [selectedFrameForGift, setSelectedFrameForGift] = useState<string | null>(null)
  const [showChatListModal, setShowChatListModal] = useState(false)
  const [followersBlockCollapsed, setFollowersBlockCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [generalChatInput, setGeneralChatInput] = useState("")
  const [now, setNow] = useState(() => Date.now())
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false)
  const [sidebarTargetPlayer, setSidebarTargetPlayer] = useState<Player | null>(null)
  const [sidebarGiftMode, setSidebarGiftMode] = useState(false)
  const [lastSidebarCombo, setLastSidebarCombo] = useState<PairGenderCombo | null>(null)
  const [mobileChatCollapsed, setMobileChatCollapsed] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [flyingEmojis, setFlyingEmojis] = useState<FlyingEmoji[]>([])
  const [steamPuffs, setSteamPuffs] = useState<SteamPuff[]>([])
  const [, setResultTimer] = useState<number | null>(null)
  const [turnTimer, setTurnTimer] = useState<number | null>(null)
  const [chatInput, setChatInput] = useState("")
  const resultTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const turnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  // Prediction state
  const [predictionTarget, setPredictionTarget] = useState<Player | null>(null)
  const [predictionTarget2, setPredictionTarget2] = useState<Player | null>(null)
  const [showPredictionPicker, setShowPredictionPicker] = useState(false)
  const [predictionMade, setPredictionMade] = useState(false)
  const [predictionResult, setPredictionResult] = useState<"correct" | "wrong" | null>(null)
  const [predictionTimer, setPredictionTimer] = useState<number>(10)
  const predictionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
  const myPlayer = players.find(p => p.id === currentUser?.id)
  const isVip = !!myPlayer?.isVip && (myPlayer.vipUntilTs == null || myPlayer.vipUntilTs > Date.now())
  const nowTs = Date.now()
  const isCurrentTurnDrunk =
    !!currentTurnPlayer &&
    !!drunkUntil &&
    typeof drunkUntil[currentTurnPlayer.id] === "number" &&
    drunkUntil[currentTurnPlayer.id] > nowTs

  // Игровой круг: радиус для мобильной и планшета (как мобильная), для ПК — больше.
  const radius = isMobile ? 26 : isTablet ? 27 : 28
  const radiusX = radius
  const radiusY = isMobile ? 28 : Math.round(radius * (6 / 5)) // на ПК/планшете стол 6:5 — Y для визуально округлого круга
  const positions = circlePositions(Math.min(players.length, 10), radiusX, radiusY)

  // Игровая логика (эмоции, подписи «Пара: ...») опирается
  // на targetPlayer / targetPlayer2 из состояния — это именно
  // те двое, на кого указывает бутылка (горлышко и дно).
  const resolvedTargetPlayer = targetPlayer
  const resolvedTargetPlayer2 = targetPlayer2

  const _userPrediction = predictions.find(p => p.playerId === currentUser?.id)

  /** Каталог бутылочек: id и пути из lib/assets.ts (BOTTLE_IMAGES), названия и стоимость в UI */
  const bottleSkins = [
    { id: "classic" as const, name: "Классическая", img: assetUrl(BOTTLE_IMAGES.classic), cost: 0 },
    { id: "ruby" as const, name: "Лимонад", img: assetUrl(BOTTLE_IMAGES.ruby), cost: 5 },
    { id: "neon" as const, name: "Виски", img: assetUrl(BOTTLE_IMAGES.neon), cost: 5 },
    { id: "frost" as const, name: "Шампанское", img: assetUrl(BOTTLE_IMAGES.frost), cost: 5 },
    { id: "baby" as const, name: "Детская", img: assetUrl(BOTTLE_IMAGES.baby), cost: 5 },
    { id: "vip" as const, name: "VIP-бутылка", img: assetUrl(BOTTLE_IMAGES.vip), cost: 5 },
    { id: "milk" as const, name: "Молочная", img: assetUrl(BOTTLE_IMAGES.milk), cost: 5 },
  ]

  const cooldownLeftMs = useMemo(() => {
    if (!bottleCooldownUntil) return 0
    return Math.max(0, bottleCooldownUntil - now)
  }, [bottleCooldownUntil, now])

  useEffect(() => {
    if (!showBottleCatalog) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [showBottleCatalog])

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

  const effectiveDailyEmotionLimit = useMemo(() => {
    const todayKey = getTodayDateKey()
    const extra = emotionDailyBoost?.dateKey === todayKey ? (emotionDailyBoost.extraPerType ?? 0) : 0
    return DAILY_EMOTION_LIMIT + Math.max(0, extra)
  }, [emotionDailyBoost])

  const limitedEmotionCounters = useMemo(() => {
    const uid = currentUser?.id
    const kissUsed = uid ? getTodayActionCount(uid, "kiss") : 0
    const beerUsed = uid ? getTodayActionCount(uid, "beer") : 0
    const cocktailUsed = uid ? getTodayActionCount(uid, "cocktail") : 0
    const limit = effectiveDailyEmotionLimit
    return [
      { id: "kiss", label: "Поцелуй", emoji: "💋", used: kissUsed, left: Math.max(0, limit - kissUsed), limit },
      { id: "beer", label: "Пиво", emoji: "🍺", used: beerUsed, left: Math.max(0, limit - beerUsed), limit },
      { id: "cocktail", label: "Коктейль", emoji: "🍹", used: cocktailUsed, left: Math.max(0, limit - cocktailUsed), limit },
    ] as const
  }, [currentUser?.id, effectiveDailyEmotionLimit, getTodayActionCount])
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

  const getBigGiftForPlayer = useCallback(
    (playerId: number): { type: BigGiftType | null; hasMany: boolean } => {
      const bigTypes: BigGiftType[] = [
        "toy_bear",
        "toy_car",
        "toy_ball",
        "souvenir_magnet",
        "souvenir_keychain",
        "plush_heart",
        "chocolate_box",
      ]
      const items = inventory.filter(
        (item) =>
          item.toPlayerId === playerId && bigTypes.includes(item.type as BigGiftType),
      )
      if (items.length === 0) return { type: null, hasMany: false }
      const latest = items.reduce((acc, item) =>
        item.timestamp > acc.timestamp ? item : acc,
      )
      return { type: latest.type as BigGiftType, hasMany: items.length > 1 }
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
    setPredictionTimer(10)
    if (predictionTimerRef.current) clearInterval(predictionTimerRef.current)
  }, [roundNumber])

  /* ---- auto-scroll log ---- */
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [gameLog])

  /* ---- Start prediction phase when it's a new turn and nobody is spinning ---- */
  useEffect(() => {
    if (CASUAL_MODE) return
    if (!isSpinning && !showResult && countdown === null && !predictionPhase && currentTurnPlayer && !predictionMade) {
      dispatch({ type: "START_PREDICTION_PHASE" })
    }
   
  }, [currentTurnIndex, isSpinning, showResult, countdown])

  /* ---- 10-second prediction countdown timer ---- */
  useEffect(() => {
    if (CASUAL_MODE) return
    if (!predictionPhase || isSpinning || showResult) {
      if (predictionTimerRef.current) clearInterval(predictionTimerRef.current)
      return
    }

    setPredictionTimer(10)
    predictionTimerRef.current = setInterval(() => {
      setPredictionTimer((prev) => {
        if (prev <= 1) {
          // Time is up - auto-spin
          if (predictionTimerRef.current) clearInterval(predictionTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (predictionTimerRef.current) clearInterval(predictionTimerRef.current)
    }
  }, [predictionPhase, isSpinning, showResult])

  /* ---- Auto-spin when prediction timer hits 0 ---- */
  useEffect(() => {
    if (CASUAL_MODE) return
    if (predictionTimer === 0 && predictionPhase && !isSpinning && !showResult && countdown === null) {
      handleSpin()
    }
   
  }, [predictionTimer, predictionPhase, isSpinning, showResult, countdown])

  /* ---- 8-second auto-advance timer when result is showing ---- */
  useEffect(() => {
    if (!showResult) {
      setResultTimer(null)
      if (resultTimerRef.current) clearInterval(resultTimerRef.current)
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)
      return
    }

    setResultTimer(8)
    resultTimerRef.current = setInterval(() => {
      setResultTimer((prev) => {
        if (prev !== null && prev > 1) return prev - 1
        return 0
      })
    }, 1000)

    autoAdvanceRef.current = setTimeout(() => {
      dispatch({ type: "NEXT_TURN" })
    }, 8000)

    return () => {
      if (resultTimerRef.current) clearInterval(resultTimerRef.current)
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)
    }
  }, [showResult, dispatch])

  /* ---- bot auto-spin (delayed to let prediction phase happen) ---- */
  useEffect(() => {
    if (!currentTurnPlayer?.isBot || isSpinning || countdown !== null || showResult) return
    const timer = setTimeout(() => handleSpin(), 2500)
    return () => clearTimeout(timer)
     
  }, [currentTurnIndex, currentTurnPlayer, isSpinning, countdown, showResult])

  /* ---- при возврате из мини-игры: анимация «вернулся к нам», пропуск хода если ход был у вернувшегося ---- */
  useEffect(() => {
    if (!showReturnedFromUgadaika) return
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
  }, [showReturnedFromUgadaika, currentTurnPlayer?.id, currentUser?.id, dispatch])

  /* ---- turn timer (визуальный счётчик 15с для живого игрока) ---- */
  useEffect(() => {
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current)
      turnTimerRef.current = null
    }
    setTurnTimer(null)

    if (!currentTurnPlayer || currentTurnPlayer.isBot) return
    if (currentUser?.id !== currentTurnPlayer.id) return
    if (isSpinning || showResult || countdown !== null) return

    setTurnTimer(15)
    turnTimerRef.current = setInterval(() => {
      setTurnTimer(prev => {
        if (prev === null) return prev
        if (prev <= 1) {
          if (turnTimerRef.current) {
            clearInterval(turnTimerRef.current)
            turnTimerRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current)
        turnTimerRef.current = null
      }
    }
  }, [currentTurnPlayer, currentUser?.id, isSpinning, showResult, countdown])

  /* ---- auto-skip turn for inactive user (15s) ---- */
  useEffect(() => {
    // Только если ход у живого пользователя, нет спина и результата
    if (!currentTurnPlayer || currentTurnPlayer.isBot) return
    if (currentUser?.id !== currentTurnPlayer.id) return
    if (isSpinning || showResult || countdown !== null) return

    const timeout = setTimeout(() => {
      // Если к моменту срабатывания условия уже изменились — ничего не делаем
      if (isSpinning || showResult || countdown !== null) return
      if (!currentTurnPlayer) return

      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "system",
          fromPlayer: currentTurnPlayer,
          text: `${currentTurnPlayer.name} пропускает ход`,
          timestamp: Date.now(),
        },
      })
      dispatch({ type: "NEXT_TURN" })
    }, 15000)

    return () => clearTimeout(timeout)
  }, [currentTurnPlayer, currentUser?.id, isSpinning, showResult, countdown, dispatch])

  /* ---- countdown tick ---- */
  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const timer = setTimeout(() => {
      if (countdown > 1) {
        dispatch({ type: "TICK_COUNTDOWN" })
      } else {
        dispatch({ type: "TICK_COUNTDOWN" })
        startSpin()
      }
    }, 800)
    return () => clearTimeout(timer)
     
  }, [countdown])

  /* ---- звук при эмоции (учитываем настройку из профиля) ---- */
  const playEmotionSound = useCallback((actionId: string) => {
    if (state.soundsEnabled === false) return
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
  }, [state.soundsEnabled])

  /* ---- launch flying emoji ---- */
  const launchEmoji = useCallback(
    (spinnerIdx: number, targetIdx: number, emoji?: string, imgSrc?: string) => {
      const fromPos = positions[spinnerIdx]
      const toPos = positions[targetIdx]
      if (!fromPos || !toPos) return

      const id = `fly_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`
      const newEmoji: FlyingEmoji = {
        id,
        emoji,
        imgSrc,
        fromX: fromPos.x,
        fromY: fromPos.y,
        toX: toPos.x,
        toY: toPos.y,
      }
      setFlyingEmojis((prev) => [...prev, newEmoji])
      setTimeout(() => {
        setFlyingEmojis((prev) => prev.filter((e) => e.id !== id))
      }, 1000)
    },
    [positions]
  )

  const launchSteam = useCallback((targetIdx: number) => {
    const toPos = positions[targetIdx]
    if (!toPos) return
    const baseX = toPos.x
    const baseY = toPos.y

    const puffs: SteamPuff[] = Array.from({ length: 5 }).map((_, i) => ({
      id: `steam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${i}`,
      x: baseX + (Math.random() * 6 - 3),
      y: baseY + (Math.random() * 4 - 2),
      delayMs: i * 140,
    }))

    setSteamPuffs((prev) => [...prev, ...puffs])
    setTimeout(() => {
      setSteamPuffs((prev) => prev.filter((p) => !puffs.some((x) => x.id === p.id)))
    }, 1700)
  }, [positions])

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

  const handleSpin = () => {
    if (predictionTimerRef.current) clearInterval(predictionTimerRef.current)
    if (!CASUAL_MODE) {
      dispatch({ type: "END_PREDICTION_PHASE" })
    }
    dispatch({ type: "START_COUNTDOWN" })
  }

  const handleBuyEmotionPackFromGame = useCallback(() => {
    if (!currentUser) return
    if (voiceBalance < EMOTION_PACK_COST) {
      showToast("Недостаточно сердец для покупки", "error")
      return
    }
    dispatch({
      type: "BUY_EMOTION_PACK",
      cost: EMOTION_PACK_COST,
      extraPerType: EMOTION_PACK_EXTRA_PER_TYPE,
      dateKey: getTodayDateKey(),
    })
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "system",
        fromPlayer: currentUser,
        text: `${currentUser.name} купил(а) пакет эмоций (+${EMOTION_PACK_EXTRA_PER_TYPE})`,
        timestamp: Date.now(),
      },
    })
    showToast("Лимит эмоций увеличен на сегодня", "success")
  }, [currentUser, dispatch, showToast, voiceBalance])

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
    const dailyLimit = effectiveDailyEmotionLimit

    // Стоимость списываем только, если действие делает живой игрок.
    // Боты (isBot) играют «за счёт системы» и не трогают баланс пользователя.
    if (!currentTurnPlayer.isBot && hasDailyLimit) {
      const todayCount = getTodayActionCount(currentTurnPlayer.id, actionId)
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
    const dailyLimit = effectiveDailyEmotionLimit

    // Оплата за ответную эмоцию (та же цена, что и за основное действие)
    const actionDef = PAIR_ACTIONS.find((a) => a.id === actionId)
    if (actionDef && hasDailyLimit) {
      const todayCount = getTodayActionCount(from.id, actionId)
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
    const dailyLimit = effectiveDailyEmotionLimit
    if (hasDailyLimit) {
      const todayCount = getTodayActionCount(currentUser.id, actionId)
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
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)
    if (resultTimerRef.current) clearInterval(resultTimerRef.current)
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
        setTimeout(() => launchEmoji(fromIdx, donorIdx, "⭐"), i * 120)
      }
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "system",
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
  const handleSendChat = () => {
    if (!chatInput.trim() || !currentUser) return
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "chat",
        fromPlayer: currentUser,
        text: `${currentUser.name}: ${chatInput.trim()}`,
        timestamp: Date.now(),
      },
    })
    setChatInput("")
  }

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
    setSidebarTargetPlayer((prev) => (prev?.id === player.id ? null : player))
    setSidebarGiftMode(false)
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

  const [showDailyTasksModal, setShowDailyTasksModal] = useState(false)
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
      maxTableSize,
      targetMales,
      targetFemales,
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
    <div className="cinematic-desktop relative flex h-dvh overflow-hidden game-bg-animated">
      {toast && <InlineToast toast={toast} />}
      <WelcomeGiftDialog
        open={showWelcomeGift}
        onOpenChange={setShowWelcomeGift}
        userName={currentUser?.name ?? ""}
        onClaim={handleClaimWelcomeGift}
      />

      {/* Top-left controls: музыка и звуки эмоций; на мобильной — компактная панель в ряд */}
      <div
        className={`fixed z-40 flex gap-1.5 rounded-2xl border px-2 py-1.5 sm:px-2.5 sm:py-1 shadow-lg ${isMobileOrTablet ? "left-2 top-2 flex-row items-center" : "left-1 top-1 flex-col"}`}
        style={{
          borderColor: "rgba(71, 85, 105, 0.8)",
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          className="relative flex items-center"
          onMouseEnter={() => {
            if (musicTooltipTimeoutRef.current) {
              clearTimeout(musicTooltipTimeoutRef.current)
              musicTooltipTimeoutRef.current = null
            }
            setShowMusicTooltip(true)
          }}
          onMouseLeave={() => {
            musicTooltipTimeoutRef.current = setTimeout(() => setShowMusicTooltip(false), 200)
          }}
        >
          {showMusicTooltip && (
            <div
              className="absolute left-full z-50 ml-2 flex items-center gap-2 rounded-lg border border-slate-500/80 bg-slate-800/95 px-3 py-2 shadow-lg"
              style={{ backdropFilter: "blur(8px)" }}
              onMouseEnter={() => {
                if (musicTooltipTimeoutRef.current) {
                  clearTimeout(musicTooltipTimeoutRef.current)
                  musicTooltipTimeoutRef.current = null
                }
                setShowMusicTooltip(true)
              }}
              onMouseLeave={() => setShowMusicTooltip(false)}
            >
              <input
                type="range"
                min={0}
                max={100}
                value={musicVolume}
                onChange={(e) => setMusicVolume(Number(e.target.value))}
                className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-slate-600 accent-amber-500"
                aria-label="Громкость музыки"
              />
            </div>
          )}
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
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_SOUNDS_ENABLED", enabled: soundsEnabled === false })}
          className="flex items-center gap-1 rounded-xl border px-2.5 py-1.5 sm:py-1 text-[11px] font-semibold shadow-sm min-h-[32px] sm:min-h-0"
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

      {/* Фоновые частицы */}
      <div className="game-particles">
        {/* Левая сторона */}
        <div className="game-particles__dot" style={{ left: "4%", bottom: "-25%", animationDelay: "0s", animationDuration: "19s" }} />
        <div className="game-particles__dot game-particles__dot--pink game-particles__dot--reverse" style={{ left: "10%", bottom: "-35%", animationDelay: "5s", animationDuration: "23s" }} />
        <div className="game-particles__dot game-particles__dot--yellow" style={{ left: "18%", bottom: "-30%", animationDelay: "2s", animationDuration: "21s" }} />
        <div className="game-particles__dot game-particles__dot--reverse" style={{ left: "22%", bottom: "-40%", animationDelay: "9s", animationDuration: "27s" }} />

        {/* Центр */}
        <div className="game-particles__dot" style={{ left: "34%", bottom: "-28%", animationDelay: "7s", animationDuration: "24s" }} />
        <div className="game-particles__dot game-particles__dot--pink" style={{ left: "40%", bottom: "-38%", animationDelay: "3s", animationDuration: "20s" }} />
        <div className="game-particles__dot game-particles__dot--yellow game-particles__dot--reverse" style={{ left: "46%", bottom: "-32%", animationDelay: "11s", animationDuration: "26s" }} />
        <div className="game-particles__dot" style={{ left: "52%", bottom: "-42%", animationDelay: "13s", animationDuration: "22s" }} />

        {/* Правая сторона */}
        <div className="game-particles__dot game-particles__dot--pink" style={{ left: "62%", bottom: "-30%", animationDelay: "4s", animationDuration: "21s" }} />
        <div className="game-particles__dot game-particles__dot--yellow game-particles__dot--reverse" style={{ left: "68%", bottom: "-38%", animationDelay: "10s", animationDuration: "28s" }} />
        <div className="game-particles__dot" style={{ left: "74%", bottom: "-34%", animationDelay: "6s", animationDuration: "23s" }} />
        <div className="game-particles__dot game-particles__dot--pink" style={{ left: "80%", bottom: "-40%", animationDelay: "15s", animationDuration: "25s" }} />
        <div className="game-particles__dot game-particles__dot--yellow" style={{ left: "86%", bottom: "-36%", animationDelay: "8s", animationDuration: "22s" }} />
        <div className="game-particles__dot game-particles__dot--reverse" style={{ left: "92%", bottom: "-32%", animationDelay: "17s", animationDuration: "24s" }} />
      </div>

      {/* ---- LEFT БОКОВОЕ МЕНЮ (скрыто на мобильных) ---- */}
      <div className="relative z-20 hidden md:flex w-[190px] shrink-0 flex-col gap-1.5 p-2 pt-20 lg:pt-24 overflow-y-auto max-h-[100dvh]">
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
              onClick={handleBuyEmotionPackFromGame}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
              disabled={voiceBalance < EMOTION_PACK_COST}
              style={{
                background: "linear-gradient(180deg, #22d3ee 0%, #6366f1 100%)",
                color: "#0f172a",
                border: "1px solid rgba(103, 232, 249, 0.9)",
                boxShadow: "0 1px 0 rgba(30, 64, 175, 0.9), 0 2px 8px rgba(34, 211, 238, 0.28)",
              }}
            >
              {"Лимит закончился — +50 за 5 ❤"}
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
                    <span className="flex shrink-0 items-center gap-0.5 text-[11px] opacity-90">
                      {actionCost}
                      <Heart className="h-3 w-3" fill="currentColor" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ---- PREDICTION SECTION ---- */}
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

        {/* ---- BET SECTION ---- */}
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

        {/* ---- BALANCES + КНОПКИ ---- */}
        <div className="mt-auto flex flex-col gap-2">
          {/** Единый стиль для аккуратных кнопок бокового меню */}
          {(() => {
            const sideBtnClass = "flex items-center gap-1.5 rounded-[999px] px-3 py-2 transition-all hover:brightness-110 hover:-translate-y-[1px] min-h-[40px]"
            const sideBtnTextClass = "text-[13px] font-semibold leading-none"
            return (
              <>
          {/* Крутить вне очереди — только на мобильной (на ПК убрано из бокового меню) */}
          {!isMyTurn && !isSpinning && !showResult && countdown === null && (
            <div className="md:hidden">
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

          {/* Банк сердец */}
          <div
            className="flex items-center gap-1.5 rounded-[999px] px-3 py-2 min-h-[40px]"
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
              border: "1px solid rgba(56,189,248,0.28)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
            }}
          >
            <Heart className="h-4 w-4" style={{ color: "#e8c06a" }} fill="currentColor" />
            <span className="text-[13px] font-bold leading-none" style={{ color: "#f0e0c8" }}>{voiceBalance}</span>
            <span className="text-[11px] leading-none" style={{ color: "#cbd5e1" }}>{"Банк сердец"}</span>
          </div>

          {/* Магазин */}
          <button
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "shop" })}
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
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "profile" })}
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
            onClick={() => setShowBottleCatalog(true)}
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
              <span className="ml-auto text-xs font-semibold" style={{ color: "#e8c06a" }}>
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

          {/* Рейтинг */}
          <button
            onClick={() => setShowRatingModal(true)}
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
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "favorites" })}
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
              onClick={() => setShowDailyTasksModal(true)}
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
          <div className="flex items-center gap-1.5 rounded-[999px] px-3 py-2 min-h-[40px]" style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(56,189,248,0.18)" }}>
            <RotateCw className="h-3 w-3" style={{ color: "#94a3b8" }} />
            <span className="text-[11px] leading-none" style={{ color: "#94a3b8" }}>
              {"Столов в игре: "}{tablesCount ?? "—"}
            </span>
          </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Модалка каталога бутылочек */}
      {showRatingModal && <RatingModal onClose={() => setShowRatingModal(false)} />}

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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setShowBottleCatalog(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-amber-900/70 p-5"
            style={{ background: "rgba(19,10,4,0.97)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-amber-100">{"Каталог бутылочек"}</span>
                <span className="text-amber-200/80" style={{ fontSize: "14px" }}>
                  {cooldownLeftMs > 0
                    ? `Покупки заблокированы: ${formatCooldown(cooldownLeftMs)}`
                    : "Выберите бутылочку для стола"}
                </span>
              </div>
              <button
                className="h-7 px-3 text-[11px] rounded-lg"
                style={{ border: "1px solid #334155", color: "#f0e0c8", background: "transparent" }}
                onClick={() => setShowBottleCatalog(false)}
              >
                {"Закрыть"}
              </button>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {bottleSkins.map((skin) => {
                const owned = (ownedBottleSkins ?? ["classic"]).includes(skin.id)
                const selected = bottleSkin === skin.id
                const isClassic = skin.id === "classic"
                const cooldownActive = cooldownLeftMs > 0
                const vipLocked = skin.id === "vip" && !isVip
                const purchaseLocked = (cooldownActive && !owned && !isClassic) || vipLocked

                const handleClick = () => {
                  if (owned) {
                    dispatch({ type: "SET_BOTTLE_SKIN", skin: skin.id })
                    return
                  }
                  if (isClassic) {
                    dispatch({ type: "SET_BOTTLE_SKIN", skin: skin.id })
                    return
                  }
                  if (vipLocked) {
                    showToast("Эта бутылочка только для VIP", "info")
                    return
                  }
                  if (cooldownActive && !owned && !isClassic) {
                    showToast(`Покупки через ${formatCooldown(cooldownLeftMs)}`, "info")
                    return
                  }
                  if (voiceBalance < skin.cost) {
                    showToast("Недостаточно сердец", "error")
                    return
                  }
                  dispatch({ type: "PAY_VOICES", amount: skin.cost })
                  dispatch({ type: "SET_BOTTLE_SKIN", skin: skin.id })
                  dispatch({ type: "SET_BOTTLE_COOLDOWN_UNTIL", ts: Date.now() + 30 * 60 * 1000 })
                  if (currentUser) {
                    dispatch({ type: "SET_BOTTLE_DONOR", playerId: currentUser.id, playerName: currentUser.name })
                    dispatch({
                      type: "ADD_LOG",
                      entry: {
                        id: generateLogId(),
                        type: "system",
                        fromPlayer: currentUser,
                        text: `${currentUser.name} купил(а) бутылочку «${skin.name}»`,
                        timestamp: Date.now(),
                      },
                    })
                  }
                  showToast("Бутылочка куплена", "success")
                }

                const disabled = purchaseLocked || (!owned && !isClassic && voiceBalance < skin.cost)

                return (
                  <button
                    key={skin.id}
                    onClick={handleClick}
                    className="group flex flex-col items-center gap-2"
                    disabled={disabled}
                  >
                    <div
                      className={`h-24 w-16 rounded-lg ${selected ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[rgba(19,10,4,0.97)]" : ""}`}
                      style={disabled && !owned ? { opacity: 0.5 } : undefined}
                    >
                      { }
                      <img
                        key={skin.img}
                        src={skin.img}
                        alt={skin.name}
                        className="h-full w-full object-contain"
                        loading="eager"
                      />
                    </div>
                    <span className="text-sm font-semibold text-amber-100">{skin.name}</span>
                    <div className="flex items-center gap-1 text-sm">
                      {owned ? (
                        <span className="font-semibold text-emerald-300">
                          {selected ? "Выбрано" : "Куплено"}
                        </span>
                      ) : isClassic ? (
                        <span className="font-semibold text-emerald-300">{"Бесплатно"}</span>
                      ) : vipLocked ? (
                        <span className="font-semibold text-amber-300/80">{"Только VIP"}</span>
                      ) : (
                        <>
                          <span className="text-sm" style={{ color: "#f97316" }}>{"❤"}</span>
                          <span className="font-semibold text-amber-100">{skin.cost}</span>
                        </>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---- GAME BOARD CENTER ---- */}
      <div
        className={`relative z-10 flex min-h-0 min-w-0 flex-1 flex-col items-center gap-2 overflow-y-auto pb-20 lg:pb-2 lg:justify-center lg:pt-8 px-0.5 sm:px-1 ${isMobileOrTablet && mobileChatCollapsed ? "pt-10" : "pt-1"}`}
        ref={boardRef}
      >
        {/* Лоадер при входе/смене стола, скрывает резкие перестановки игроков */}
        {tableLoading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center rounded-[32px] bg-black/70">
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <span className="text-xs font-semibold" style={{ color: "#e5e7eb" }}>
                {"Подбираем игроков за стол..."}
              </span>
            </div>
          </div>
        )}

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
        {/* Статус подаренной бутылки */}
        {bottleDonorName && (
          <div
            className="absolute top-1 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold lg:top-5"
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
        {currentUser && currentTurnPlayer?.id === currentUser.id && turnTimer !== null && (
          <div className="absolute top-4 left-1/2 z-30 -translate-x-1/2 flex items-center gap-1.5 rounded-full px-3 py-1"
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
        {/* Обёртка игрового поля + статуса: при свёрнутом чате — flex-1 и центрирование; при открытом — без flex-1, чтобы чат заполнил пространство до низа */}
        <div
          className={`flex min-h-0 flex-col ${isMobileOrTablet && mobileChatCollapsed ? "flex-1 min-h-0 justify-center" : ""} ${isMobileOrTablet && !mobileChatCollapsed ? "pt-8 shrink-0" : ""}`}
        >
        {/* Прямоугольный стол: на мобильном резиновый; на планшете ограничена высота */}
        <div
          className={`relative flex items-center justify-center w-full max-w-[95vw] sm:w-[min(90vw,720px)] sm:max-w-[720px] md:max-h-[40vh] lg:max-h-none min-h-0 shrink-0 border-2 sm:border-[3px] ${isMobileOrTablet ? "mt-3 mx-auto rounded-2xl" : "mt-1 rounded-2xl sm:rounded-[32px]"}`}
          style={{
            aspectRatio: isMobileOrTablet ? "1 / 1" : "6 / 5",
            ...(isMobileOrTablet
              ? {
                  width: "min(92vw, calc(100vh - 260px))",
                  height: "min(92vw, calc(100vh - 260px))",
                  maxHeight: "calc(100vh - 260px)",
                }
              : {}),
            borderColor: "rgba(56, 189, 248, 0.35)",
            background:
              "radial-gradient(circle at 50% 45%, rgba(30,58,95,0.55) 0%, rgba(15,23,42,0.95) 60%, rgba(2,6,23,1) 100%)",
            boxShadow: isMobileOrTablet
              ? "0 10px 36px rgba(0,0,0,0.52), 0 0 40px rgba(56,189,248,0.12), inset 0 1px 0 rgba(255,255,255,0.05)"
              : "0 24px 50px rgba(0,0,0,0.88), 0 0 55px rgba(56,189,248,0.1), inset 0 0 0 1px rgba(56,189,248,0.2), inset 0 0 60px rgba(0,0,0,0.65)",
          }}
        >
          {/* Холодное внешнее свечение по периметру */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              boxShadow: "inset 0 0 0 1px rgba(125, 211, 252, 0.22), 0 0 22px rgba(56,189,248,0.18)",
            }}
          />
          {/* Внутренняя теплая золотая рамка */}
          <div
            className={`pointer-events-none absolute rounded-xl sm:rounded-[24px] ${isMobileOrTablet ? "inset-2 sm:inset-4" : "inset-4"}`}
            style={{
              border: "3px solid rgba(250, 204, 21, 0.88)",
              boxShadow: "0 0 28px rgba(250,204,21,0.45), inset 0 0 34px rgba(0,0,0,0.78)",
            }}
          />
          {/* Лёгкое внутреннее затемнение по краям, чтобы игроки читались поверх стола */}
          <div
            className={`pointer-events-none absolute rounded-[20px] sm:rounded-[26px] ${isMobileOrTablet ? "inset-2" : "inset-3"}`}
            style={{
              boxShadow: "inset 0 0 56px rgba(0,0,0,0.78)",
              background:
                "radial-gradient(circle at center, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.96) 68%, rgba(2,6,23,1) 100%)",
            }}
          />
          {/* Центральный софт-спот под бутылкой */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: isMobile ? 130 : 190,
              height: isMobile ? 130 : 190,
              background: "radial-gradient(circle, rgba(56,189,248,0.16) 0%, rgba(56,189,248,0.05) 45%, transparent 75%)",
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
            const bigGift = getBigGiftForPlayer(player.id)
            const hasRoseGiven = (rosesGiven ?? []).some((r) => r.toPlayerId === player.id)
            const giftIcons = hasRoseGiven
              ? [...getGiftsForPlayer(player.id), "rose" as const]
              : getGiftsForPlayer(player.id)
            return (
              <div
                key={player.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
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
                <PlayerAvatar
                  player={player}
                  compact={isMobile}
                  size={isTablet ? 76 : undefined}
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
                  bigGiftIcon={bigGift.type ?? undefined}
                  bigGiftHasMany={bigGift.hasMany}
                  frameId={avatarFrames?.[player.id]}
                  inGame={playerInUgadaika != null && player.id === playerInUgadaika}
                  showAsleep={(spinSkips?.[player.id] ?? 0) >= 3}
                />
                {isAvatarMenuOpen && (
                  <div
                    className="absolute left-1/2 top-full z-40 mt-1.5 w-[128px] -translate-x-1/2 rounded-lg border p-1.5 shadow-2xl"
                    style={{
                      background: "linear-gradient(165deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 20, 40, 0.98) 100%)",
                      borderColor: "rgba(100,116,139,0.9)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      aria-label="Закрыть мини-меню"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSidebarTargetPlayer(null)
                        setSidebarGiftMode(false)
                      }}
                      className="absolute -top-2 right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] transition-all hover:brightness-110 hover:scale-105"
                      style={{
                        background: "linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)",
                        color: "#ffffff",
                        border: "1px solid rgba(254, 202, 202, 0.9)",
                        boxShadow: "0 4px 12px rgba(127, 29, 29, 0.65), inset 0 1px 0 rgba(255,255,255,0.35)",
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSidebarGiftMode(true)
                      }}
                      className="mb-1 w-full rounded-md px-2 py-1.5 text-[10px] font-semibold transition-all hover:brightness-110"
                      style={{
                        background: sidebarGiftMode ? "rgba(34,211,238,0.25)" : "rgba(30,41,59,0.7)",
                        color: sidebarGiftMode ? "#67e8f9" : "#e2e8f0",
                        border: "1px solid rgba(100,116,139,0.9)",
                      }}
                    >
                      Подарить эмоцию
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        dispatch({ type: "OPEN_PLAYER_MENU", player })
                      }}
                      className="w-full rounded-md px-2 py-1.5 text-[10px] font-semibold transition-all hover:brightness-110"
                      style={{
                        background: "rgba(30,41,59,0.7)",
                        color: "#e2e8f0",
                        border: "1px solid rgba(100,116,139,0.9)",
                      }}
                    >
                      Подробнее
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {/* ---- FLYING EMOJIS ---- */}
          {flyingEmojis.map((fe) => (
            <div
              key={fe.id}
              className="pointer-events-none absolute z-40"
              style={{
                left: `${fe.fromX}%`,
                top: `${fe.fromY}%`,
                animation: "flyEmoji 1.8s ease-in-out forwards",
                // @ts-expect-error CSS custom properties
                "--fly-to-x": `${fe.toX - fe.fromX}vw`,
                "--fly-to-y": `${fe.toY - fe.fromY}vh`,
              }}
            >
              <FlyingEmojiContent fe={fe} />
            </div>
          ))}

          {/* ---- STEAM (banya) ---- */}
          {steamPuffs.map((p) => (
            <div
              key={p.id}
              className="pointer-events-none absolute z-40"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: "translate(-50%, -50%)",
                opacity: 0,
                animation: `steamRise 1.4s ease-out forwards`,
                animationDelay: `${p.delayMs}ms`,
              }}
            >
              <span
                style={{
                  fontSize: "28px",
                  color: "rgba(226, 232, 240, 0.9)",
                  textShadow: "0 0 12px rgba(226,232,240,0.55)",
                  filter: "blur(0.2px)",
                }}
              >
                {"💨"}
              </span>
            </div>
          ))}

          {/* ---- BOTTLE in the centre (на мобильной — крупнее) ---- */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div
              style={isMobile ? { transform: "scale(1.4)" } : isTablet ? { transform: "scale(0.9)" } : undefined}
              className="drop-shadow-[0_0_22px_rgba(56,189,248,0.4)]"
            >
              <Bottle
                angle={bottleAngle}
                isSpinning={isSpinning}
                skin={bottleSkin ?? "classic"}
                isDrunk={isCurrentTurnDrunk}
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

          {/* ---- МОБИЛЬНАЯ ПАНЕЛЬ ЭМОЦИЙ поверх бутылочки ---- */}
          {showResult && resolvedTargetPlayer && resolvedTargetPlayer2 && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-35 flex md:hidden w-[90%] max-w-[280px] flex-col items-stretch gap-2 rounded-xl p-3 shadow-2xl"
              style={{
                background: "linear-gradient(165deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)",
                border: "2px solid #475569",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(71, 85, 105, 0.5)",
              }}
            >
              <p className="text-center text-[11px] font-semibold" style={{ color: "#e8c06a" }}>
                {"Пара: "}{resolvedTargetPlayer.name}{" & "}{resolvedTargetPlayer2.name}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {limitedEmotionCounters.map((row) => (
                  <div key={row.id} className="rounded-md px-1.5 py-1 text-center" style={{ background: "rgba(30, 41, 59, 0.7)" }}>
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
                  onClick={handleBuyEmotionPackFromGame}
                  className="flex items-center justify-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                  disabled={voiceBalance < EMOTION_PACK_COST}
                  style={{
                    background: "linear-gradient(180deg, #22d3ee 0%, #6366f1 100%)",
                    color: "#0f172a",
                    border: "2px solid rgba(103, 232, 249, 0.9)",
                    boxShadow: "0 2px 0 rgba(30, 64, 175, 0.9), 0 3px 10px rgba(34, 211, 238, 0.28)",
                  }}
                >
                  {"Лимит закончился — купить +50 за 5 ❤"}
                </button>
              )}
              {isMyTurn ? (
                <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
                  {availableActions.map(action => {
                    const style = ACTION_BUTTON_STYLES[action.id] || ACTION_BUTTON_STYLES.skip
                    const actionCost = getEffectiveActionCost(action.id, currentPairCombo)
                    const canAfford = actionCost === 0 || voiceBalance >= actionCost
                    return (
                      <button
                        key={action.id}
                        onClick={() => handlePerformAction(action.id)}
                        disabled={!canAfford}
                        className="flex items-center justify-start gap-2 rounded-lg px-2.5 py-2 font-bold text-[13px] transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                        style={{
                          background: style.bg,
                          color: style.text,
                          border: `2px solid ${style.border}`,
                          boxShadow: `0 2px 0 ${style.shadow}, 0 3px 6px rgba(0,0,0,0.3)`,
                        }}
                      >
                        {renderActionIcon(action)}
                        <span className="flex-1 text-left truncate">{action.label}</span>
                        {shouldShowActionCostBadge(action.id, actionCost) && (
                          <span className="flex items-center gap-0.5 text-[13px] opacity-90 shrink-0">
                            {actionCost}
                            <Heart className="h-3 w-3" fill="currentColor" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : currentUser && !currentUser.isBot &&
                (currentUser.id === resolvedTargetPlayer.id || currentUser.id === resolvedTargetPlayer2.id) && (
                <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
                  {availableActions.map(action => {
                    const style = ACTION_BUTTON_STYLES[action.id] || ACTION_BUTTON_STYLES.skip
                    const actionCost = getEffectiveActionCost(action.id, currentPairCombo)
                    const canAfford = actionCost === 0 || voiceBalance >= actionCost
                    return (
                      <button
                        key={action.id}
                        type="button"
                        disabled={!canAfford}
                        onClick={() => handleResponseEmotion(action.id)}
                        className="flex items-center justify-start gap-2 rounded-lg px-2.5 py-2 font-semibold text-[13px] transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                        style={{
                          background: style.bg,
                          color: style.text,
                          border: `1px solid ${style.border}`,
                          boxShadow: `0 1px 0 ${style.shadow}, 0 2px 4px rgba(0,0,0,0.25)`,
                        }}
                      >
                        {renderActionIcon(action)}
                        <span className="flex-1 text-left truncate">{action.label}</span>
                        {shouldShowActionCostBadge(action.id, actionCost) && (
                          <span className="flex items-center gap-0.5 text-[13px] opacity-90 shrink-0">
                            {actionCost}
                            <Heart className="h-3 w-3" fill="currentColor" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ---- UNDER-BOARD CONTROLS (SPIN / STATUS / RESULT) + кнопка «Крутить вне очереди»; на мобильной — ниже и крупнее ---- */}
        <div className="mt-6 md:mt-1.5 lg:mt-6 mb-0.5 flex min-h-[72px] md:min-h-[64px] lg:min-h-[80px] w-full flex-col items-center justify-center gap-2 md:gap-1.5 lg:gap-3 px-2 shrink-0">
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

        </div>

        {/* ---- Общий чат под столом (мобильная и планшет); на планшете — по ширине как игровое поле ---- */}
        <div
          className={`mt-2 sm:mt-1 w-full max-w-[95vw] sm:max-w-[min(90vw,720px)] px-1 sm:px-1 lg:hidden pb-0 ${isTablet ? "md:mx-auto" : ""} ${isMobileOrTablet ? (mobileChatCollapsed ? "mt-auto shrink-0" : "mt-4 flex-1 min-h-0 flex flex-col min-h-[140px]") : "shrink-0"}`}
          style={isTablet ? { width: "min(92vw, calc(100vh - 260px))", maxWidth: "720px", marginLeft: "auto", marginRight: "auto" } : undefined}
        >
          <div
            className={`overflow-hidden flex flex-col shrink-0 ${isMobileOrTablet ? "rounded-2xl" : "rounded-xl"} ${isMobileOrTablet && !mobileChatCollapsed ? "flex-1 min-h-0 flex flex-col max-h-full" : ""}`}
            style={{
              background: "linear-gradient(165deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)",
              border: "1px solid rgba(71, 85, 105, 0.6)",
              boxShadow: isMobileOrTablet ? "0 2px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)" : "0 4px 20px rgba(0,0,0,0.35)",
            }}
          >
            <button
              type="button"
              onClick={() => setMobileChatCollapsed((c) => !c)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 border-b text-left shrink-0"
              style={{ borderColor: "rgba(71, 85, 105, 0.4)" }}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "#e8c06a" }} />
                <span className="text-xs font-bold" style={{ color: "#fef3c7" }}>Общий чат</span>
                {generalChatMessages.length > 0 && (
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold min-w-[1.25rem] text-center" style={{ background: "rgba(251, 191, 36, 0.35)", color: "#fef3c7" }}>
                    +{generalChatMessages.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium" style={{ color: "#94a3b8" }}>
                  {mobileChatCollapsed ? "Развернуть" : "Свернуть"}
                </span>
                {mobileChatCollapsed ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: "#94a3b8" }} /> : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "#94a3b8" }} />}
              </div>
            </button>
            {!mobileChatCollapsed && (
            <>
            <div className="px-2 py-1 space-y-0.5 flex-1 min-h-0 overflow-y-auto max-h-[min(40vh,280px)] overscroll-contain" style={{ WebkitOverflowScrolling: "touch" }}>
              {generalChatMessages.slice(-4).map((msg) => (
                <div key={msg.id} className="text-[11px] leading-tight">
                  <span className="font-semibold" style={{ color: "#e8c06a" }}>{msg.senderName}:</span>
                  <span className="ml-1" style={{ color: "#e2e8f0" }}>{msg.text}</span>
                </div>
              ))}
              {generalChatMessages.length === 0 && (
                <p className="text-[11px]" style={{ color: "#64748b" }}>Пока нет сообщений</p>
              )}
            </div>
            <div className="flex gap-1 p-1 border-t shrink-0" style={{ borderColor: "rgba(71, 85, 105, 0.5)" }}>
              <input
                type="text"
                placeholder="Написать..."
                value={generalChatInput}
                onChange={(e) => setGeneralChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const t = generalChatInput.trim()
                    if (t && currentUser) {
                      dispatch({
                        type: "SEND_GENERAL_CHAT",
                        message: {
                          id: `gc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                          senderId: currentUser.id,
                          senderName: currentUser.name,
                          text: t,
                          timestamp: Date.now(),
                        },
                      })
                      setGeneralChatInput("")
                    }
                  }
                }}
                className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-[12px] bg-slate-800/80 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              />
              <button
                type="button"
                onClick={() => {
                  const t = generalChatInput.trim()
                  if (t && currentUser) {
                    dispatch({
                      type: "SEND_GENERAL_CHAT",
                      message: {
                        id: `gc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        senderId: currentUser.id,
                        senderName: currentUser.name,
                        text: t,
                        timestamp: Date.now(),
                      },
                    })
                    setGeneralChatInput("")
                  }
                }}
                disabled={!generalChatInput.trim()}
                className="shrink-0 rounded-lg p-1.5 transition-opacity disabled:opacity-40"
                style={{ background: "rgba(251, 191, 36, 0.25)", border: "1px solid rgba(251, 191, 36, 0.5)", color: "#fef3c7" }}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            </>
            )}
          </div>
        </div>

      </div>

      {/* ---- RIGHT PANEL: мини-игра + поклонники + чат — на ПК одно свёртываемое окно ---- */}
      <div className="relative z-20 hidden md:flex min-h-0 shrink-0 flex-col border-l border-cyan-400/20 bg-gradient-to-b from-slate-900/55 to-slate-950/65">
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
        <div className="flex min-h-0 w-[230px] flex-1 flex-col gap-3 pt-2 pb-3 pr-2 pl-1">
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

        {/* Followers / favorites strip — можно свернуть */}
        {currentUser && (
          <div
            className="mx-2 rounded-2xl px-2 py-1.5"
            style={{
              background: "rgba(0,0,0,0.45)",
              boxShadow: "0 6px 14px rgba(0,0,0,0.8)",
              border: "1px solid rgba(232,192,106,0.9)",
            }}
          >
            <button
              type="button"
              onClick={() => setFollowersBlockCollapsed((c) => !c)}
              className="mb-0 flex w-full items-center justify-between gap-2 rounded-lg py-0.5 text-left transition-opacity hover:opacity-90"
            >
              <span
                className="font-semibold tracking-wide"
                style={{ color: "#e8c06a", fontSize: "14px" }}
              >
                {"Твои поклонники"}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[9px]" style={{ color: "#64748b" }}>
                  {"онлайн"}
                </span>
                {followersBlockCollapsed ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: "#94a3b8" }} />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0" style={{ color: "#94a3b8" }} />
                )}
              </span>
            </button>
            {!followersBlockCollapsed && (
            <div className="mt-1 flex items-center gap-1.5 overflow-x-auto pb-1 pr-1">
              {gameLog
                .filter(
                  (e) =>
                    e.type === "invite" &&
                    e.toPlayer?.id === currentUser.id &&
                    e.fromPlayer &&
                    !e.fromPlayer.isBot,
                )
                .reduce<{ ids: Set<number>; players: Player[] }>(
                  (acc, e) => {
                    const id = e.fromPlayer!.id
                    if (!acc.ids.has(id)) {
                      acc.ids.add(id)
                      acc.players.push(e.fromPlayer as Player)
                    }
                    return acc
                  },
                  { ids: new Set<number>(), players: [] },
                )
                .players.map((p) => {
                  const initials = p.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                return (
                  <button
                    key={p.id}
                    onClick={() => dispatch({ type: "OPEN_CHAT", player: p })}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{
                      background: "radial-gradient(circle at 30% 0%, #111827 0%, #020617 60%)",
                      border: "1px solid #facc15",
                      boxShadow: "0 0 6px rgba(250,204,21,0.7)",
                      color: "#e5e7eb",
                    }}
                  >
                    {initials}
                  </button>
                )
              })}
              {gameLog.filter(
                (e) =>
                  e.type === "invite" &&
                  e.toPlayer?.id === currentUser.id &&
                  e.fromPlayer &&
                  !e.fromPlayer.isBot,
              ).length === 0 && (
                <span className="text-[10px]" style={{ color: "#64748b" }}>
                  {"Пока нет поклонников — пригласите игроков в чат."}
                </span>
              )}
            </div>
            )}
          </div>
        )}

        {/* Chat window: поле ввода внизу статично, сообщения скроллятся по вертикали */}
        <div
          className="mx-2 flex min-h-0 flex-1 flex-col rounded-2xl overflow-hidden"
          style={{
            border: "1px solid rgba(56, 189, 248, 0.24)",
            background: "linear-gradient(180deg, rgba(2,6,23,0.7) 0%, rgba(2,6,23,0.5) 100%)",
            boxShadow: "0 10px 24px rgba(2,6,23,0.6)",
          }}
        >
          <div
            className="flex shrink-0 items-center gap-2 rounded-t-lg px-3 py-2"
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.9) 100%)",
              borderBottom: "1px solid rgba(56,189,248,0.35)",
            }}
          >
            <MessageCircle className="h-4 w-4" style={{ color: "#e8c06a" }} />
            <span className="text-sm font-bold" style={{ color: "#f0e0c8" }}>{"Общение с игроками"}</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1 overscroll-contain">
            {gameLog.length === 0 && (
              <p className="py-6 text-center text-[11px]" style={{ color: "#94a3b8" }}>
                {"Игра начинается..."}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              {gameLog
                .filter((entry) => entry.type === "chat")
                .map((entry) => (
                <ChatBubble key={entry.id} entry={entry} currentUserId={currentUser?.id} />
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          <div
            className="shrink-0 px-2 pb-2 pt-1.5"
            style={{ borderTop: "1px solid rgba(92,58,36,0.6)" }}
          >
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Введите сообщение..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendChat()
                }}
                className="flex-1 px-1.5 py-1.5 text-[11px] focus:outline-none"
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  borderBottom: "1px solid rgba(92,58,36,0.8)",
                  color: "#f0e0c8",
                }}
              />
              <button
                onClick={handleSendChat}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all hover:brightness-110"
                style={{
                  background: "linear-gradient(180deg, #3498db 0%, #2980b9 100%)",
                }}
              >
                <Send className="h-3.5 w-3.5" style={{ color: "#fff" }} />
              </button>
            </div>
          </div>
        </div>
        </div>
        )}
      </div>

      {/* ---- МОБИЛЬНАЯ НИЖНЯЯ НАВИГАЦИЯ ---- */}
      <nav
        className={`fixed inset-x-0 bottom-0 flex md:hidden items-center justify-around border-t px-2 py-2 ${showMobileMoreMenu ? "z-[100]" : "z-30"}`}
        style={{
          background: "linear-gradient(180deg, rgba(15,8,3,0.98) 0%, rgba(10,5,2,0.99) 100%)",
          borderColor: "rgba(92,58,36,0.9)",
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
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
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "favorites" })}
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 min-w-[64px] touch-manipulation transition-opacity active:opacity-80"
          style={{ color: "#f0e0c8" }}
        >
          <Star className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Избранные</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "shop" })}
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 min-w-[64px] touch-manipulation transition-opacity active:opacity-80"
          style={{ color: "#facc15" }}
        >
          <Gift className="h-5 w-5" />
          <span className="text-[10px] font-semibold">Магазин</span>
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "profile" })}
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
            className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 min-w-[64px] touch-manipulation transition-opacity active:opacity-80"
            style={{ color: "#f0e0c8" }}
            aria-expanded={showMobileMoreMenu}
          >
            <Zap className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Ещё</span>
          </button>
          {showMobileMoreMenu && (
            <>
              <div
                className="fixed inset-0 bg-black/20 z-[1]"
                aria-hidden="true"
                onClick={() => setShowMobileMoreMenu(false)}
              />
              <div
                className="fixed right-4 left-auto z-[2] flex w-48 flex-col rounded-xl border py-2 shadow-xl"
                style={{
                  bottom: "calc(4.5rem + max(0.5rem, env(safe-area-inset-bottom)))",
                  background: "rgba(19,10,4,0.98)",
                  borderColor: "#334155",
                }}
              >
                <button
                  type="button"
                  onClick={() => { setShowBottleCatalog(true); setShowMobileMoreMenu(false) }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <span aria-hidden>🍾</span>
                  Бутылочка
                </button>
                <button
                  type="button"
                  onClick={() => { handleChangeTable(); setShowMobileMoreMenu(false) }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <RotateCw className="h-4 w-4" />
                  Сменить стол
                </button>
                <button
                  type="button"
                  onClick={() => { setMusicEnabled((v) => !v); setShowMobileMoreMenu(false) }}
                  title="Громкость"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <span aria-hidden>{musicEnabled ? "🔊" : "🔇"}</span>
                  {musicEnabled ? "Музыка вкл" : "Музыка выкл"}
                </button>
                <button
                  type="button"
                  onClick={() => { dispatch({ type: "SET_SOUNDS_ENABLED", enabled: soundsEnabled === false }); setShowMobileMoreMenu(false) }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <span aria-hidden>{soundsEnabled === false ? "🔇" : "🔊"}</span>
                  {soundsEnabled === false ? "Звуки выкл" : "Звуки вкл"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowRatingModal(true); setShowMobileMoreMenu(false) }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <Trophy className="h-4 w-4" />
                  Рейтинг
                </button>
                <button
                  type="button"
                  onClick={() => { dispatch({ type: "SET_SCREEN", screen: "ugadaika" }); setShowMobileMoreMenu(false) }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <span aria-hidden>💕</span>
                  Угадай-ка
                </button>
                <button
                  type="button"
                  onClick={() => { setShowChatListModal(true); setShowMobileMoreMenu(false) }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Сообщения
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDailyTasksModal(true); setShowMobileMoreMenu(false) }}
                  className="flex items-center justify-start gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <Sparkles className="h-4 w-4" />
                  Ежедневные задачи
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* ---- ЕЖЕДНЕВНЫЕ ЗАДАЧИ — модальное окно (открывается по кнопке «Ещё» или из сайдбара) ---- */}
      {currentUser && showDailyTasksModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 md:p-4"
          onClick={() => setShowDailyTasksModal(false)}
          aria-hidden
        >
          <div
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "linear-gradient(165deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)",
              border: "1px solid rgba(251, 191, 36, 0.25)",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(251, 191, 36, 0.08)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "rgba(71, 85, 105, 0.5)" }}>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(251, 191, 36, 0.15)", border: "1px solid rgba(251, 191, 36, 0.3)" }}>
                  <Sparkles className="h-4 w-4" style={{ color: "#fcd34d" }} />
                </div>
                <span className="text-sm font-bold" style={{ color: "#fef3c7", textShadow: "0 0 12px rgba(251, 191, 36, 0.2)" }}>
                  Ежедневные задачи
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-20 rounded-full overflow-hidden" style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(71, 85, 105, 0.6)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(completedQuests / 5) * 100}%`,
                      background: "linear-gradient(90deg, #22c55e 0%, #e8c06a 100%)",
                      boxShadow: "0 0 8px rgba(34, 197, 94, 0.5)",
                    }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums" style={{ color: completedQuests >= 5 ? "#86efac" : "#fcd34d" }}>
                  {completedQuests}/5
                </span>
                <span className="rounded-md px-2 py-1 text-[10px] font-bold" style={{ color: "#7dd3fc", background: "rgba(2,132,199,0.15)", border: "1px solid rgba(56,189,248,0.35)" }}>
                  Lvl {dailyLevel}/30
                </span>
                <button
                  type="button"
                  onClick={() => setShowDailyTasksModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-600/50 hover:text-slate-200"
                  aria-label="Закрыть"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(71, 85, 105, 0.35)" }}>
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
            <div className="overflow-y-auto flex-1 min-h-0 p-4 space-y-2">
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
        </div>
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
        const LOVE_QUOTES = [
          { text: "Любовь — единственная разумная и удовлетворительная цель жизни.", author: "Оскар Уайльд" },
          { text: "Любить — значит видеть человека таким, каким его задумал Бог.", author: "Ф. М. Достоевский" },
          { text: "Мы влюбляемся не в человека, а в наше представление о нём.", author: "Лев Толстой" },
          { text: "Любовь живёт не тем, что получает, а тем, что отдаёт.", author: "Антуан де Сент-Экзюпери" },
          { text: "Сердце имеет причины, которых разум не знает.", author: "Блез Паскаль" },
          { text: "Любовь — это когда счастье другого человека важнее твоего собственного.", author: "Х. Джексон Браун" },
          { text: "В любви нет ни дня, ни ночи — только сердце.", author: "Уильям Шекспир" },
          { text: "Любовь — это желание счастья другому.", author: "Лев Толстой" },
          { text: "Настоящая любовь приходит тихо, без стука и фанфар.", author: "Эрих Мария Ремарк" },
          { text: "Любовь — это когда хочешь переживать с кем-то все четыре времени года.", author: "Рэй Брэдбери" },
          { text: "Любить — значит смотреть не друг на друга, а в одну сторону.", author: "Антуан де Сент-Экзюпери" },
          { text: "Всякая любовь — счастье, даже неразделённая.", author: "И. А. Бунин" },
        ]
        const dateKey = new Date().toISOString().slice(0, 10)
        const quoteIndex = (playerMenuTarget.id + dateKey.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % LOVE_QUOTES.length
        const quoteOfDay = LOVE_QUOTES[quoteIndex]
        const ZODIAC_SIGNS = ["Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева", "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"]
        const zodiacDisplay = playerMenuTarget.zodiac ?? ZODIAC_SIGNS[playerMenuTarget.id % 12]
        return (
        <div className="player-menu-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto overflow-x-hidden">
          <div
            className="player-menu-modal player-menu-modal-glow relative w-full max-w-4xl max-h-[90dvh] rounded-2xl p-4 sm:p-5 pt-12 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto overflow-x-hidden"
            style={{
              background: "linear-gradient(165deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 50%, rgba(30, 41, 59, 0.98) 100%)",
              border: "2px solid rgba(251, 191, 36, 0.25)",
              fontSize: "15px",
            }}
          >
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(251,191,36,0.06)_0%,transparent_50%)]" aria-hidden />
            <button
              type="button"
              onClick={() => dispatch({ type: "CLOSE_PLAYER_MENU" })}
              className="absolute right-2 top-2 sm:right-3 sm:top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-all duration-200 hover:scale-110 hover:bg-slate-600/60 hover:text-slate-100"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="relative flex flex-col gap-4 sm:gap-5 sm:flex-row min-w-0">
              {/* Левый блок: фото, имя, пол/возраст, город, интересы, знак зодиака */}
              <div className="player-menu-left flex w-full sm:w-[180px] sm:shrink-0 flex-col items-center sm:items-start gap-3">
                <div className="flex flex-col items-center gap-2">
                  <PlayerAvatar
                    player={playerMenuTarget}
                    frameId={avatarFrames?.[playerMenuTarget.id] || "none"}
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => setShowRosesReceivedPopover((v) => !v)}
                    className="flex items-center justify-center gap-1 rounded-lg border border-slate-600 bg-slate-800/80 px-2.5 py-1 text-[12px] font-medium text-slate-200 transition-colors hover:bg-slate-700/80"
                    aria-label="Подаренные розы"
                  >
                    <span>🌹</span>
                    <span>Подарено роз: {(rosesGiven ?? []).filter((r) => r.toPlayerId === playerMenuTarget.id).length}</span>
                  </button>
                  {showRosesReceivedPopover && (
                    <div
                      className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white"
                      style={{ background: "rgba(30,41,59,0.98)", border: "1px solid #475569" }}
                    >
                      Подарено роз: {(rosesGiven ?? []).filter((r) => r.toPlayerId === playerMenuTarget.id).length}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowFramePicker(true)}
                    className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[12px] font-medium text-amber-200/95 transition-all duration-200 hover:scale-105 hover:bg-amber-500/20 hover:border-amber-500/50"
                  >
                    Рамка
                  </button>
                </div>
                <div className="w-full text-center sm:text-left text-[15px]">
                  <h3 className="font-bold text-slate-100">{playerMenuTarget.name}</h3>
                  <p className="text-slate-400 mt-0.5">
                    {playerMenuTarget.gender === "male" ? "М" : "Ж"}, {playerMenuTarget.age} лет
                  </p>
                  {playerMenuTarget.city && (
                    <p className="text-slate-400 mt-1">📍 {playerMenuTarget.city}</p>
                  )}
                  {playerMenuTarget.interests && (
                    <p className="text-slate-400 mt-1 line-clamp-2">🎯 {playerMenuTarget.interests}</p>
                  )}
                  <p className="text-amber-200/90 mt-1">✨ {zodiacDisplay}</p>
                </div>
              </div>

              {/* Центральный блок: цитата дня + кнопки действий */}
              <div className="player-menu-actions flex min-w-0 w-full sm:max-w-sm flex-1 flex-col gap-3">
                {/* Цитата дня */}
                <div
                  className="player-menu-quote rounded-xl px-3 py-2.5 text-[15px]"
                  style={{
                    background: "linear-gradient(135deg, rgba(51,65,85,0.6) 0%, rgba(30,41,59,0.7) 100%)",
                    border: "1px solid rgba(251, 191, 36, 0.2)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.2)",
                  }}
                >
                  <p className="font-semibold text-amber-400/95 uppercase tracking-wide mb-1">Цитата дня</p>
                  <p className="text-slate-300 italic">&quot;{quoteOfDay.text}&quot;</p>
                  <p className="text-slate-500 mt-1">— {quoteOfDay.author}</p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  {/* Ухаживание — приватный чат за 50 сердец; до 5 игроков в сутки за одним пользователем */}
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
                    const canOpenVk = !!currentUser && (courtshipProfileAllowed?.[playerMenuTarget.id] !== false) && voiceBalance >= 100
                    return (
                      <div className="mt-2 flex flex-col gap-2">
                        <button
                          onClick={() => {
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
                            dispatch({ type: "OPEN_CHAT", player: playerMenuTarget })
                            dispatch({ type: "CLOSE_PLAYER_MENU" })
                            showToast("Приватный чат открыт", "success")
                          }}
                          disabled={!canCare}
                          className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-bold text-[15px] transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                          style={{
                            background: "linear-gradient(180deg, #ec4899 0%, #be185d 100%)",
                            color: "#fff",
                            border: "2px solid #9d174d",
                            boxShadow: "0 2px 0 #831843",
                          }}
                        >
                          <Heart className="h-4 w-4" fill="currentColor" />
                          <span className="flex-1 text-center">{"Ухаживание"}</span>
                          <span className="text-[15px] opacity-90">{"50 ❤"}</span>
                        </button>
                        {courtshipProfileAllowed?.[playerMenuTarget.id] !== false ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (voiceBalance < 100) {
                                showToast("Нужно 100 сердец для перехода в VK", "error")
                                return
                              }
                              dispatch({ type: "PAY_VOICES", amount: 100 })
                              window.open(`https://vk.com/id${playerMenuTarget.id}`, "_blank", "noopener,noreferrer")
                              showToast("Открыт профиль VK", "success")
                            }}
                            disabled={!canOpenVk}
                            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[15px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                            style={{
                              background: "linear-gradient(180deg, #2787F5 0%, #1a6bd1 100%)",
                              color: "#fff",
                              border: "2px solid #1565c0",
                              boxShadow: "0 2px 0 #0d47a1",
                            }}
                          >
                            <User className="h-4 w-4" />
                            {"Профиль ВК — 100 ❤"}
                          </button>
                        ) : (
                          <p className="rounded-lg px-3 py-2.5 text-center text-[15px] font-medium" style={{ color: "#94a3b8", background: "rgba(15,23,42,0.6)", border: "1px solid #334155" }}>
                            {"Если хотите пообщаться, но кнопка не работает — активируйте приват."}
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  {/* Подарить розы: кнопка-таблетка слева, счётчик подаренных — отдельный блок справа */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (!currentUser) return
                        if (voiceBalance < 50) {
                          showToast("Нужно 50 сердец для роз", "error")
                          return
                        }
                        dispatch({ type: "GIVE_ROSE", fromPlayerId: currentUser.id, toPlayerId: playerMenuTarget.id })
                        showToast("Розы подарены", "success")
                      }}
                      disabled={!currentUser || voiceBalance < 50}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-full px-4 py-2.5 font-bold text-[15px] transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                      style={{
                        background: "linear-gradient(180deg, #e11d48 0%, #be123c 100%)",
                        color: "#fff",
                        border: "2px solid #9f1239",
                        boxShadow: "0 2px 0 #881337",
                      }}
                    >
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="text-lg">🌹</span>
                        <span className="truncate">{"Подарить розы"}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0 opacity-90">
                        50
                        <Heart className="h-4 w-4" fill="currentColor" />
                      </span>
                    </button>
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold text-white"
                      style={{
                        background: "linear-gradient(180deg, #e11d48 0%, #be123c 100%)",
                        border: "2px solid #9f1239",
                      }}
                    >
                      {(rosesGiven ?? []).filter(
                        (r) => r.fromPlayerId === currentUser?.id && r.toPlayerId === playerMenuTarget.id,
                      ).length}
                    </div>
                  </div>

                  {/* Add to favorites (free) */}
                  <button
                    onClick={() => {
                      dispatch({ type: "ADD_FAVORITE", player: playerMenuTarget })
                      dispatch({ type: "CLOSE_PLAYER_MENU" })
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-bold text-[15px] transition-all hover:brightness-110 active:scale-95"
                    style={{
                      background: "linear-gradient(180deg, #e8c06a 0%, #c4943a 100%)",
                      color: "#0f172a",
                      border: "2px solid #94a3b8",
                      boxShadow: "0 2px 0 #475569",
                    }}
                  >
                    <Star className="h-4 w-4" />
                    <span className="flex-1 text-center">{"В избранное"}</span>
                  </button>

                  {/* Угадай-ка: пара совпала 5 раз — возможность дружить профилями */}
                  {currentUser && (() => {
                    const pairKey = [currentUser.id, playerMenuTarget.id].sort((a, b) => a - b).join("_")
                    const canFriendProfiles = ugadaikaFriendUnlocked?.[pairKey]
                    if (!canFriendProfiles) return null
                    return (
                      <div
                        className="rounded-lg border border-emerald-500/50 px-3 py-2.5 text-center text-[13px]"
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

              {/* Правая колонка: каталог подарков */}
              {currentUser && (
                <div className="player-menu-catalog mt-2 sm:mt-4 flex w-full sm:w-[340px] min-w-0 min-h-0 shrink-0 flex-col self-stretch sm:mt-0">
                  <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-amber-500/20 p-3 transition-colors"
                    style={{ background: "rgba(15,23,42,0.95)", boxShadow: "inset 0 1px 0 rgba(251,191,36,0.05), 0 4px 16px rgba(0,0,0,0.2)" }}
                  >
                  <div className="mb-2 shrink-0 text-[15px]">
                    <span className="font-bold text-slate-200">{"Каталог подарков"}</span>
                    <span className="block text-slate-400">
                      {`Для: ${playerMenuTarget.name}. Цены до 10 сердец.`}
                    </span>
                  </div>

                  <div className="player-menu-gifts-scroll grid grid-cols-3 content-start gap-2 overflow-y-auto overflow-x-hidden py-1 max-h-[220px] sm:max-h-[270px] min-h-0">
                    {[
                      { id: "toy_bear" as InventoryItem["type"], name: "Плюшевый мишка", emoji: "🧸", cost: 10 },
                      { id: "plush_heart" as InventoryItem["type"], name: "Подушка-сердце", emoji: "❤️", cost: 8 },
                      { id: "toy_car" as InventoryItem["type"], name: "Игрушечная машинка", emoji: "🚗", cost: 7 },
                      { id: "toy_ball" as InventoryItem["type"], name: "Футбольный мяч", emoji: "⚽️", cost: 6 },
                      { id: "souvenir_magnet" as InventoryItem["type"], name: "Магнитик на холодильник", emoji: "🧲", cost: 3 },
                      { id: "souvenir_keychain" as InventoryItem["type"], name: "Брелок-сувенир", emoji: "🔑", cost: 5 },
                      { id: "chocolate_box" as InventoryItem["type"], name: "Коробка конфет", emoji: "🍫", cost: 4 },
                    ].map((gift) => {
                      const alreadyGifted = inventory.some(
                        (item) => item.toPlayerId === playerMenuTarget.id && item.type === gift.id,
                      )
                      const disabled = alreadyGifted || voiceBalance < gift.cost

                      const handleClick = () => {
                        if (disabled) return
                        dispatch({ type: "PAY_VOICES", amount: gift.cost })
                        dispatch({
                          type: "ADD_INVENTORY_ITEM",
                          item: {
                            type: gift.id,
                            fromPlayerId: currentUser.id,
                            fromPlayerName: currentUser.name,
                            timestamp: Date.now(),
                            toPlayerId: playerMenuTarget.id,
                          },
                        })
                        dispatch({
                          type: "ADD_LOG",
                          entry: {
                            id: generateLogId(),
                            type: "system",
                            fromPlayer: currentUser,
                            toPlayer: playerMenuTarget,
                            text: `${currentUser.name} дарит подарок «${gift.name}» игроку ${playerMenuTarget.name}`,
                            timestamp: Date.now(),
                          } as GameLogEntry,
                        })
                      }

                      return (
                        <button
                          key={gift.id}
                          type="button"
                          onClick={handleClick}
                          className="player-menu-gift-item group flex flex-col items-center gap-1 shrink-0 rounded-xl p-1.5 transition-colors hover:bg-slate-700/40"
                          disabled={disabled}
                        >
                          <div
                            className={`flex h-16 w-16 items-center justify-center rounded-xl ${
                              disabled ? "opacity-40" : "opacity-100"
                            }`}
                            style={!disabled ? { background: "rgba(51,65,85,0.4)", border: "1px solid rgba(71,85,105,0.5)" } : undefined}
                          >
                            <span className="text-3xl leading-none">{gift.emoji}</span>
                          </div>
                          <span className="text-center text-[15px] font-semibold text-slate-200 line-clamp-2">{gift.name}</span>
                          <div className="flex items-center gap-1 text-[15px]">
                            {alreadyGifted ? (
                              <span className="font-semibold text-slate-500">{"Подарено"}</span>
                            ) : (
                              <>
                                <span className="text-rose-400">{"❤"}</span>
                                <span className="text-[15px] font-semibold text-slate-200">{gift.cost}</span>
                              </>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  </div>
                </div>
              )}
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
    system: "#3498db",
    chat: "#3498db",
    hug: "#2ecc71",
    selfie: "#3498db",
    flowers: "#e74c3c",
    song: "#9b59b6",
    rose: "#e74c3c",
    prediction: "#e8c06a",
  }
  const accentColor = colorMap[entry.type] ?? "#94a3b8"

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
            { }
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
