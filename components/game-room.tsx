"use client"

import {
  Fragment,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useId,
  type CSSProperties,
  type RefObject,
  type SetStateAction,
  type SyntheticEvent,
} from "react"
import {
  Heart,
  MessageCircle,
  Star,
  RotateCw,
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
  Headphones,
  Bell,
  Hand,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useGameState, generateLogId, sortPair, pairsMatch, getPairGenderCombo, randomAvatarFrame } from "@/lib/game-context"
import { filterOppositeGenderOthers } from "@/lib/pair-utils"
import { apiFetch } from "@/lib/api-fetch"
import { appPath } from "@/lib/app-path"
import { getRoundDriverPlayerId } from "@/lib/round-driver-id"
import {
  assetUrl,
  catalogMediaUrl,
  EMOJI_BANYA,
  EMOTION_SOUNDS,
  emotionSoundUrl,
  publicUrl,
  resolveFrameCatalogAssetUrl,
} from "@/lib/assets"
import { PlayerAvatar } from "@/components/player-avatar"
import { TableDecorations } from "@/components/decorations"
import { GameSidePanelShell } from "@/components/game-side-panel-shell"
import { ProfileReceivedGiftsSection } from "@/components/profile-received-gifts-section"
import { computePlayerMenuProfileStats } from "@/lib/profile-received-gifts"
import { TableChatEmojiPicker } from "@/components/table-chat-emoji-picker"
import { BottleCatalogModal } from "@/components/bottle-catalog-modal"
import { BankPassiveBurstOverlay } from "@/components/bank-passive-burst"
import { SpaceRocketsLayer } from "@/components/space-rockets-layer"
import { NebulaMockupSkinLayer } from "@/components/nebula-mockup-skin-layer"
import { BankHeartBalanceTooltip } from "@/components/bank-heart-balance-tooltip"
import { GiftAchievementModal } from "@/components/gift-achievement-modal"
import { useBankPassive } from "@/hooks/use-bank-passive"
import { InlineToast } from "@/components/ui/inline-toast"
import { useInlineToast } from "@/hooks/use-inline-toast"
import { useSyncEngine } from "@/hooks/use-sync-engine"
import { useGameTimers } from "@/hooks/use-game-timers"
import { useClientTabAwayPresence } from "@/hooks/use-client-tab-away"
import { TableLoaderOverlay } from "@/components/table-loader-overlay"
import { FortuneWheelSidePanel } from "@/components/fortune-wheel-side-panel"
import { GameStatusTicker } from "@/components/game-status-ticker"
import { TickerAnnouncementModal } from "@/components/ticker-announcement-modal"
import { ContactUsModal } from "@/components/contact-us-modal"
import { VkGroupNewsModal } from "@/components/vk-group-news-modal"
import { VkExtraHeartsGateModal } from "@/components/vk-extra-hearts-gate-modal"
import { isVkGroupBellAnimationOff, VK_GROUP_BELL_STORAGE_EVENT } from "@/lib/vk-group-news-bell"
import { VkBankRewardVideoButton } from "@/components/vk-bank-reward-video-button"
import { useFortuneWheel } from "@/hooks/use-fortune-wheel"
import { FORTUNE_WHEEL_ENABLED } from "@/lib/fortune-wheel"
import {
  PAIR_ACTIONS,
  type PairAction,
  type Player,
  type GameLogEntry,
  type PairGenderCombo,
} from "@/lib/game-types"
import { effectiveOpenToChatInvites, effectiveShowVkAfterCare } from "@/lib/player-profile-prefs"
import { useTheme } from "next-themes"
import { useGameLayoutMode } from "@/lib/use-media-query"
import { cn } from "@/lib/utils"
import { roomNameForDisplay } from "@/lib/rooms/room-names"
import { formatAchievementPostText } from "@/lib/achievement-posts-format"
import { DEFAULT_BOTTLE_CATALOG_ROWS, type BottleCatalogSkinRow } from "@/lib/bottle-catalog"
import { DEFAULT_FRAME_CATALOG_ROWS } from "@/lib/frame-catalog"
import { DEFAULT_GIFT_CATALOG_ROWS } from "@/lib/gift-catalog"
import { useBottleCatalog } from "@/lib/use-bottle-catalog"
import { useFrameCatalog } from "@/lib/use-frame-catalog"
import { useGiftCatalog } from "@/lib/use-gift-catalog"
import { isVkRuntimeEnvironment, showVkStoryBox } from "@/lib/vk-bridge"
import { GameBoardPlayers } from "@/components/game-board-players"
import { BottleCenter } from "@/components/bottle-center"
import {
  GIFT_ACHIEVEMENT_IMAGE_PATH,
  GIFT_ACHIEVEMENT_TITLE,
  isGiftRatingType,
  type GiftProgressStats,
} from "@/lib/gift-progress-shared"
import { recordGiftProgress } from "@/lib/gift-progress-client"
import { getVkMiniAppPageUrl } from "@/lib/game-invite-copy"
import {
  SPIN_HANG_FAILSAFE_MS,
  SPIN_RESOLVE_AFTER_MS,
  SPIN_RESOLVE_GRACE_MS,
} from "@/lib/spin-timing"

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

function sortedPairIds(a: Player, b: Player): [number, number] {
  return a.id < b.id ? [a.id, b.id] : [b.id, a.id]
}

function nextKissForms(gender: string | undefined): {
  nextWord: string
  youWord: string
} {
  if (gender === "female") {
    return { nextWord: "Следующая", youWord: "следующей" }
  }
  if (gender === "male") {
    return { nextWord: "Следующий", youWord: "следующим" }
  }
  return { nextWord: "Следующий игрок", youWord: "следующим" }
}

/** Лента чата: не ставим crossOrigin на аватары (ломает загрузку с CDN ВК/ОК без CORS). */
function tableChatPlayerAvatarOnError(e: SyntheticEvent<HTMLImageElement>, player: Player) {
  const img = e.currentTarget
  if (img.dataset.fell) return
  img.dataset.fell = "1"
  const n = (player.name || "?").slice(0, 1).toUpperCase()
  const h = ((player.id * 137) % 360)
  img.src = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="hsl(${h},55%,45%)"/><text x="40" y="40" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="36" font-weight="700" fill="#fff">${n}</text></svg>`,
  )}`
}

/** Детерминированное [0,1) от строки — одинаковые позиции приветов на всех клиентах для одного id лога. */
function hashUnit01(seed: string, salt: number): number {
  let h = salt | 0
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i)
  }
  h = Math.imul(h ^ (h >>> 15), 0x45d9f3b | 0)
  return (Math.abs(h) % 10000) / 10000
}

/** Левый = инициатор (from), правый — второй участник пары. */
function resolvePairAvatarsForLog(entry: GameLogEntry, players: Player[]): { left: Player; right: Player } | null {
  const fp = entry.fromPlayer
  const tp = entry.toPlayer
  const tp2 = entry.toPlayer2
  const pairIds = entry.pairIds

  const embedForId = (id: number): Player | undefined => {
    const live = players.find((p) => p.id === id)
    if (live) return live
    if (fp?.id === id) return fp
    if (tp?.id === id) return tp
    if (tp2?.id === id) return tp2
    return undefined
  }

  if (pairIds && fp) {
    const [idA, idB] = pairIds
    const inPair = fp.id === idA || fp.id === idB
    const otherId = inPair ? (fp.id === idA ? idB : idA) : idA
    const left = embedForId(fp.id) ?? fp
    const right = embedForId(otherId)
    if (right) return { left, right }
  }
  if (pairIds) {
    const a = embedForId(pairIds[0])
    const b = embedForId(pairIds[1])
    if (a && b) return { left: a, right: b }
  }
  if (fp && tp) {
    const left = embedForId(fp.id) ?? fp
    const right = embedForId(tp.id) ?? tp
    return { left, right }
  }
  return null
}

/** Подписи в ленте чата: про «подарок», не инфинитивы с кнопки. */
const CHAT_PAIR_ACTION_PHRASE: Partial<Record<GameLogEntry["type"], string>> = {
  kiss: "Подарил(а) поцелуй",
  flowers: "Подарил(а) цветы",
  rose: "Подарил(а) розы",
  hello: "Поприветствовал(а)",
  cocktail: "Подарил(а) коктейль",
  diamond: "Подарил(а) бриллианты",
  beer: "Подарил(а) по квасику",
  banya: "Подарил(а) баньку",
  tools: "Подарил(а) инструменты",
  lipstick: "Подарил(а) помаду",
  skip: "Пропустил(а) ход",
}

/** Поцелуй после взаимного «Да» в голосовании пары (в логе раньше был «крепкий поцелуй»). */
function isMutualKissPairLogText(text: unknown): boolean {
  const t = typeof text === "string" ? text.toLowerCase() : ""
  return t.includes("взаимный поцелуй") || t.includes("крепкий поцелуй")
}

/** Эмодзи для строки чата «аватар — аватар — эмоция — число». */
function logEventEmotionEmoji(entry: GameLogEntry, giftById?: ReadonlyMap<string, GiftChatDisplayMeta>): string | null {
  const isStrongKissStatus = entry.type === "kiss" && isMutualKissPairLogText(entry.text)
  if (isStrongKissStatus) return null
  if (entry.frameGift) return "\uD83D\uDDBC\uFE0F"
  const dyn = giftById?.get(String(entry.type))
  if (dyn?.emoji?.trim()) return dyn.emoji.trim()
  const giftRow = DEFAULT_GIFT_CATALOG_ROWS.find((r) => r.id === entry.type && r.published)
  if (giftRow?.emoji) return giftRow.emoji
  const map: Partial<Record<GameLogEntry["type"], string>> = {
    kiss: "💋",
    flowers: "💐",
    diamond: "💎",
    cocktail: "🍬",
    beer: "🍺",
    banya: "🧹",
    tools: "🛠️",
    lipstick: "💄",
    skip: "⏭️",
    hug: "🤗",
    selfie: "📸",
    song: "🎵",
    rose: "🌹",
    laugh: "😄",
    chat: "💬",
    invite: "💌",
    care: "💝",
    prediction: "🎯",
    join: "🚪",
    hello: "👋",
    gift_voice: "🎙️",
  }
  if (entry.type === "system") return null
  return map[entry.type] ?? null
}

/** Подсказка на центральный объект в строке «аватар » эмодзи ×N аватар». */
/** Мета подарка для чата: дефолтный каталог + строки из API (админка). */
type GiftChatDisplayMeta = { emoji: string; img: string; name: string; music?: string }

function pairChatCentralObjectHint(
  entry: GameLogEntry,
  giftById?: ReadonlyMap<string, GiftChatDisplayMeta>,
): "Подарил подарок" | "Подарил эмоцию" | "Подарил рамку" | "Спасибо за бутылочку" | "Поприветствовал за столом" {
  if (entry.type === "bottle_thanks") return "Спасибо за бутылочку"
  if (entry.type === "hello") return "Поприветствовал за столом"
  if (entry.frameGift) return "Подарил рамку"
  const id = String(entry.type)
  if (giftById?.has(id)) return "Подарил подарок"
  const gift = DEFAULT_GIFT_CATALOG_ROWS.find((r) => r.id === entry.type && r.published)
  if (gift) return "Подарил подарок"
  return "Подарил эмоцию"
}

function logEventActionShortLabel(entry: GameLogEntry, giftById?: ReadonlyMap<string, GiftChatDisplayMeta>): string | null {
  const isStrongKissStatus = entry.type === "kiss" && isMutualKissPairLogText(entry.text)
  if (isStrongKissStatus) return "Взаимный поцелуй"
  if (entry.frameGift?.frameName?.trim()) {
    return `Подарил(а) рамку «${entry.frameGift.frameName.trim()}»`
  }
  const phrase = CHAT_PAIR_ACTION_PHRASE[entry.type]
  if (phrase) return phrase
  const pa = PAIR_ACTIONS.find((x) => x.id === entry.type)
  if (pa) return pa.label
  const dynName = giftById?.get(String(entry.type))?.name?.trim()
  if (dynName) return dynName
  const giftRow = DEFAULT_GIFT_CATALOG_ROWS.find((r) => r.id === entry.type && r.published)
  if (giftRow) return giftRow.name
  const extra: Partial<Record<GameLogEntry["type"], string>> = {
    care: "Поклонник",
    invite: "Приглашение",
    bottle_thanks: "Спасибо",
    prediction: "Прогноз",
    join: "Зашёл за стол",
    gift_voice: "Голос",
    hug: "Объятия",
    selfie: "Селфи",
    song: "Песня",
    laugh: "Смех",
  }
  const t = extra[entry.type]
  if (t) return t
  return null
}

/** Подряд идущие одинаковые события (не чат) от одного автора с тем же текстом — одна строка с множителем. */
/** Единый вид компактных строк событий (пара, бутылочки) в чате комнаты — без рамки, плотнее. */
const TABLE_CHAT_ROOM_EVENT_CHIP =
  "inline-flex min-w-0 max-w-[min(100%,20rem)] flex-nowrap items-center gap-0 rounded-full border border-white/[0.06] bg-white/[0.05] px-0.5 py-0 pl-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm"

/** Оболочка полоски «несколько эмоций подряд»: края с аватарами фиксированы, скроллится только центр. */
const TABLE_CHAT_ROOM_PAIR_STRIP_OUTER =
  "rounded-full border border-white/[0.08] bg-gradient-to-b from-white/[0.09] to-white/[0.04] py-1 pl-1 pr-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.12)] backdrop-blur-md"

/** Множитель ×N в ленте пар — мягче, чем яркий emerald. */
const PAIR_FEED_REPEAT_COUNT_CLASS =
  "shrink-0 text-[0.68rem] font-medium tabular-nums tracking-tight text-slate-400/95 sm:text-[0.7rem]"

/** Без кольца/тяжёлой тени — только лёгкая глубина у кругов. */
const TABLE_CHAT_ROOM_AVATAR_RING = "shadow-[0_1px_2px_rgba(0,0,0,0.2)]"

/** Не показывать в «Чат комнаты» (шум: пропуск хода, ежедневные бонусы и т.п.). */
function hideTableLogEntryFromRoomChatText(text: string): boolean {
  const t = text
  if (t.includes("пропускает ход")) return true
  if (t.includes("ежедневный бонус")) return true
  if (t.includes("ежедневный подарок в магазине")) return true
  return false
}

function sameTableLogPairIds(a?: [number, number], b?: [number, number]): boolean {
  if (!a || !b || a.length < 2 || b.length < 2) return false
  return a[0] === b[0] && a[1] === b[1]
}

/** Нормализованный ключ пары для дедупа «Выпала пара» vs эмоция (pairIds или from/to). */
function pairKeyFromLogEntryForChat(entry: GameLogEntry): string | null {
  if (entry.pairIds && entry.pairIds.length >= 2) {
    const [x, y] = entry.pairIds
    return x < y ? `${x}:${y}` : `${y}:${x}`
  }
  const fp = entry.fromPlayer
  const tp = entry.toPlayer
  if (fp && tp) {
    return fp.id < tp.id ? `${fp.id}:${tp.id}` : `${tp.id}:${fp.id}`
  }
  return null
}

function sameAuthorAndPairForVipalaChatDedupe(a: GameLogEntry, b: GameLogEntry): boolean {
  if (a.fromPlayer?.id !== b.fromPlayer?.id) return false
  const ka = pairKeyFromLogEntryForChat(a)
  const kb = pairKeyFromLogEntryForChat(b)
  if (ka && kb) return ka === kb
  return sameTableLogPairIds(a.pairIds, b.pairIds)
}

/** Стабильный порядок: при одном timestamp «Выпала пара» идёт перед строками эмоций (иначе id ломал соседнюю дедуп-проверку). */
function compareTableChatFeedOrder(a: GameLogEntry, b: GameLogEntry): number {
  if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
  const av = String(a.text ?? "").startsWith("Выпала пара:") ? 0 : 1
  const bv = String(b.text ?? "").startsWith("Выпала пара:") ? 0 : 1
  if (av !== bv) return av - bv
  return a.id.localeCompare(b.id)
}

const VIPALA_CHAT_DEDUPE_WINDOW_MS = 90_000

/**
 * «Выпала пара» скрываем только если для той же пары и автора есть отдельная строка с эмоцией
 * (не обязательно сразу следующая — между ними может быть чужой чат и т.д.).
 * pairIds на клиенте/после синка иногда отличается — сравниваем ещё по from/to.
 */
function isRedundantVipalaParaChatRow(sorted: GameLogEntry[], index: number): boolean {
  const e = sorted[index]
  const t = String(e.text ?? "")
  if (!t.startsWith("Выпала пара:")) return false
  const t0 = e.timestamp
  for (let j = index + 1; j < sorted.length; j++) {
    const n = sorted[j]
    if (n.timestamp - t0 > VIPALA_CHAT_DEDUPE_WINDOW_MS) break
    if (String(n.text ?? "").startsWith("Выпала пара:")) continue
    if (sameAuthorAndPairForVipalaChatDedupe(e, n)) return true
  }
  return false
}

function bottleSkinChangeSig(e: GameLogEntry): string {
  const b = e.bottleSkinChange
  if (!b) return ""
  return `${b.fromSkinId}\t${b.toSkinId}`
}

function frameGiftSig(e: GameLogEntry): string {
  const f = e.frameGift
  if (!f) return ""
  return `${f.frameId}\t${f.frameName}`
}

/** Миниатюра бутылочки в ленте чата (каталог API + дефолт; колесо фортуны — эмодзи, если нет картинки). */
function resolveBottleSkinChatVisual(
  rows: { id: string; img: string }[],
  skinId: string,
): { kind: "img"; src: string } | { kind: "emoji"; emoji: string } {
  const id = skinId || "classic"
  if (id === "fortune_wheel") {
    const url =
      rows.find((r) => r.id === id)?.img?.trim() ??
      DEFAULT_BOTTLE_CATALOG_ROWS.find((r) => r.id === id)?.img?.trim()
    if (url) return { kind: "img", src: url }
    return { kind: "emoji", emoji: "🎡" }
  }
  const fromRows = rows.find((r) => r.id === id)?.img?.trim()
  if (fromRows) return { kind: "img", src: fromRows }
  const def = DEFAULT_BOTTLE_CATALOG_ROWS.find((r) => r.id === id)
  if (def?.img?.trim()) return { kind: "img", src: def.img }
  const classic = DEFAULT_BOTTLE_CATALOG_ROWS.find((r) => r.id === "classic")!
  return { kind: "img", src: classic.img }
}

function bottleSkinDisplayName(rows: { id: string; name: string }[], skinId: string): string {
  return (
    rows.find((r) => r.id === skinId)?.name ??
    DEFAULT_BOTTLE_CATALOG_ROWS.find((r) => r.id === skinId)?.name ??
    skinId
  )
}

function aggregateConsecutiveTableLogRows(sorted: GameLogEntry[]): { entry: GameLogEntry; count: number }[] {
  const out: { entry: GameLogEntry; count: number }[] = []
  for (const e of sorted) {
    const prev = out[out.length - 1]
    const sameFrom = e.fromPlayer?.id === prev?.entry.fromPlayer?.id
    const mergeable =
      e.type !== "chat" &&
      prev != null &&
      e.type === prev.entry.type &&
      sameFrom &&
      e.text === prev.entry.text &&
      bottleSkinChangeSig(e) === bottleSkinChangeSig(prev.entry) &&
      frameGiftSig(e) === frameGiftSig(prev.entry)
    if (mergeable) {
      prev.count += 1
    } else {
      out.push({ entry: e, count: 1 })
    }
  }
  return out
}

/** Строка ленты чата с парой (эмодзи/подарок), не чат и не смена бутылочки. */
function isPairFeedDisplayRow(
  entry: GameLogEntry,
  players: Player[],
  giftById?: ReadonlyMap<string, GiftChatDisplayMeta>,
): boolean {
  if (entry.type === "chat") return false
  if (entry.type === "system" && entry.bottleSkinChange) return false
  if (entry.type === "system" && !entry.frameGift) return false
  const pairAvatars = resolvePairAvatarsForLog(entry, players)
  const emotionEmoji = logEventEmotionEmoji(entry, giftById)
  const actionShort = logEventActionShortLabel(entry, giftById)
  return Boolean(pairAvatars && (emotionEmoji || actionShort))
}

/** Одна и та же пара в любом направлении (A→B и B→A) — одна полоска в ленте. */
function pairStripIdentityKey(leftId: number, rightId: number): string {
  return leftId <= rightId ? `${leftId}:${rightId}` : `${rightId}:${leftId}`
}

type MergedTableChatFeedRow =
  | {
      kind: "pairStrip"
      left: Player
      right: Player
      segments: { entry: GameLogEntry; count: number }[]
    }
  | { kind: "item"; entry: GameLogEntry; count: number }

/** Подряд идущие события одной и той же пары (инициатор слева) — одна строка с несколькими эмоциями. */
function mergeConsecutivePairFeedRows(
  rows: { entry: GameLogEntry; count: number }[],
  players: Player[],
  giftById?: ReadonlyMap<string, GiftChatDisplayMeta>,
): MergedTableChatFeedRow[] {
  const out: MergedTableChatFeedRow[] = []
  for (const row of rows) {
    const { entry, count } = row
    if (!isPairFeedDisplayRow(entry, players, giftById)) {
      out.push({ kind: "item", entry, count })
      continue
    }
    const pairAvatars = resolvePairAvatarsForLog(entry, players)
    if (!pairAvatars) {
      out.push({ kind: "item", entry, count })
      continue
    }
    const { left, right } = pairAvatars
    const key = pairStripIdentityKey(left.id, right.id)
    const last = out[out.length - 1]
    if (last?.kind === "pairStrip" && pairStripIdentityKey(last.left.id, last.right.id) === key) {
      last.segments.push({ entry, count })
    } else {
      out.push({ kind: "pairStrip", left, right, segments: [{ entry, count }] })
    }
  }
  return out
}

/** Ширина/высота стола (как в CSS aspect-ratio). Для окружности в пикселях при не-квадратном столе: radiusY = radiusX * TABLE_ASPECT_WH. */
const TABLE_ASPECT_WH = 60 / 50

const DAILY_EMOTION_LIMIT = 50
/** Покупка доп. лимита по выбранным типам: +50 использований; первый набор за сутки — 5 ❤/тип, далее — 15 ❤/тип. */
const EMOTION_QUOTA_PURCHASE_AMOUNT = 50
const EMOTION_QUOTA_FIRST_COST_PER_TYPE = 5
const EMOTION_QUOTA_NEXT_COST_PER_TYPE = 15
const EMOTION_GIFT_IMAGE_FRAMES = 16
const EXTRA_SPIN_COST = 2

function nextEmotionGiftFrameNum(current: number): number {
  return (current % EMOTION_GIFT_IMAGE_FRAMES) + 1
}

function emotionGiftFrameSrc(frameNum: number): string {
  return publicUrl(`/${String(frameNum).padStart(3, "0")}.webp`)
}

function getTodayDateKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Цена за тип при следующей покупке квоты сегодня (первый раз в сутки дешевле). */
function getNextQuotaCostPerTypeHearts(
  boost:
    | {
        dateKey: string
        quotaBoostPurchasesCount?: number
      }
    | undefined,
): number {
  const todayKey = getTodayDateKey()
  if (!boost || boost.dateKey !== todayKey) return EMOTION_QUOTA_FIRST_COST_PER_TYPE
  return (boost.quotaBoostPurchasesCount ?? 0) === 0
    ? EMOTION_QUOTA_FIRST_COST_PER_TYPE
    : EMOTION_QUOTA_NEXT_COST_PER_TYPE
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

// Table loader constants moved to components/table-loader-overlay.tsx

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

/** Длительность плавного полёта подарка по дуге Безье (мс). */
// "Вау"-анимация: медленнее и заметнее
const GIFT_FLY_DURATION_MS = 3200
/** Длительность CSS `gift-arrival-burst` — иконка подарка на аватаре после этого. */
const GIFT_ARRIVAL_PARTICLE_DURATION_MS = 1400

/** Полёт подарка из каталога к центру аватарки получателя (плавная квадратичная кривая). */
interface GiftCatalogFlyFx {
  id: string
  recipientPlayerId: number
  giftTypeId: string
  emoji?: string
  imgSrc?: string
  startX: number
  startY: number
  endX: number
  endY: number
}

interface GiftArrivalBurst {
  id: string
  x: number
  y: number
  burstKey: string
}

function hashStringToSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function GiftArrivalParticleBurst({ x, y, burstKey }: { x: number; y: number; burstKey: string }) {
  const particles = useMemo(() => {
    const rnd = mulberry32(hashStringToSeed(burstKey))
    return Array.from({ length: 32 }, () => ({
      angle: rnd() * Math.PI * 2,
      dist: 64 + rnd() * 136,
      size: 4 + rnd() * 14,
      delay: rnd() * 190,
      hue: 36 + rnd() * 28,
    }))
  }, [burstKey])
  return (
    <div className="pointer-events-none fixed z-[204]" style={{ left: x, top: y }} aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className="gift-arrival-particle absolute rounded-full"
          style={
            {
              width: p.size,
              height: p.size,
              left: -p.size / 2,
              top: -p.size / 2,
              animationDelay: `${p.delay}ms`,
              "--gift-px": `${Math.cos(p.angle) * p.dist}px`,
              "--gift-py": `${Math.sin(p.angle) * p.dist}px`,
              background: `radial-gradient(circle, hsla(${p.hue}, 96%, 74%, 0.98) 0%, hsla(${Math.round(p.hue + 14)}, 88%, 52%, 0.4) 52%, transparent 72%)`,
              boxShadow: `0 0 ${5 + p.size}px hsla(${p.hue}, 100%, 68%, 0.55)`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

function GiftCatalogBezierFly({
  startX,
  startY,
  endX,
  endY,
  emoji,
  imgSrc,
  durationMs,
  onFinished,
}: {
  startX: number
  startY: number
  endX: number
  endY: number
  emoji?: string
  imgSrc?: string
  durationMs: number
  onFinished: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onFin = useRef(onFinished)
  onFin.current = onFinished

  useEffect(() => {
    let raf = 0
    let cancelled = false
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const dur = reduced ? Math.min(durationMs, 520) : durationMs

    const dx = endX - startX
    const dy = endY - startY
    const len = Math.hypot(dx, dy)
    const midX = (startX + endX) / 2
    const midY = (startY + endY) / 2
    let perpX = 0
    let perpY = 1
    if (len > 0.01) {
      perpX = -dy / len
      perpY = dx / len
    }
    const arcLift = Math.min(120, Math.max(28, len * 0.16))
    const cpX = midX + perpX * arcLift
    const cpY = midY + perpY * arcLift

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    const t0 = performance.now()
    const tick = (now: number) => {
      if (cancelled) return
      const rawT = Math.min(1, (now - t0) / dur)
      const t = easeInOutCubic(rawT)
      const oneMt = 1 - t
      const x = oneMt * oneMt * startX + 2 * oneMt * t * cpX + t * t * endX
      const y = oneMt * oneMt * startY + 2 * oneMt * t * cpY + t * t * endY
      const el = ref.current
      if (el) {
        el.style.left = `${x}px`
        el.style.top = `${y}px`
        // Старт крупнее и с лёгким "кручением" для эффекта вау
        const scale = 1.35 - 0.38 * rawT
        const rot = -8 + 16 * rawT
        el.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`
        el.style.opacity = `${1 - 0.82 * rawT * rawT}`
      }
      if (rawT < 1) {
        raf = requestAnimationFrame(tick)
      } else if (!cancelled) {
        onFin.current()
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [startX, startY, endX, endY, durationMs])

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed z-[205] will-change-[left,top,transform,opacity]"
      style={{
        left: startX,
        top: startY,
        transform: "translate(-50%, -50%) scale(1.35)",
        opacity: 1,
      }}
      aria-hidden
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt=""
          className="h-14 w-14 rounded-2xl object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)]"
          draggable={false}
        />
      ) : (
        <span className="block text-[2.8rem] leading-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)]">
          {emoji || "🎁"}
        </span>
      )}
    </div>
  )
}

function ThanksCloudBubble({ variant = "fly" }: { variant?: "fly" | "chat" }) {
  const uid = useId().replace(/:/g, "")
  const gid = `tcg-${variant}-${uid}`
  const isChat = variant === "chat"

  return (
    <div
      className={cn(
        "thanks-cloud-bubble__inner relative inline-flex select-none items-center justify-center",
        isChat ? "h-7 w-[4.75rem] max-w-[min(100%,5.75rem)]" : "h-14 w-[132px]",
      )}
      style={{
        filter: isChat
          ? "drop-shadow(0 2px 5px rgba(59, 130, 246, 0.38))"
          : "drop-shadow(0 10px 22px rgba(59, 130, 246, 0.42)) drop-shadow(0 3px 6px rgba(15, 23, 42, 0.18))",
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
        className={cn(
          "relative z-10 text-center font-extrabold tracking-[0.04em]",
          isChat ? "text-[9px] leading-none sm:text-[10px]" : "text-[13px] tracking-[0.06em]",
        )}
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
      return (
        <span className="inline-block text-base brightness-0 invert" aria-hidden>
          {"💋"}
        </span>
      )
    case "flowers":
      return <Flower2 className="h-4 w-4" />
    case "diamond":
      return <span className="text-base">{"💎"}</span>
    case "beer":
      return (
        <img
          src={assetUrl("kvas-big.svg")}
          alt=""
          className="h-4 w-4 object-contain"
          draggable={false}
        />
      )
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
      return <span className="text-base">{"🍬"}</span>
    case "skip":
      return <ArrowRight className="h-4 w-4" />
    default:
      return <Sparkles className="h-4 w-4" />
  }
}

// В казуальном режиме оставляем только простое кручение бутылочки,
// а прогнозы и ставки скрываем, чтобы не перегружать игрока.
const CASUAL_MODE = true

/** Временно: виджет «музыка» (пластинка + бегущая строка) над столом на ПК. */
const GAME_ROOM_MUSIC_WIDGET_ENABLED = false

/** Длительность таймера «Поцелуются?» (голосование Да/Нет). */
const PAIR_KISS_VOTE_DURATION_MS = 10_000

/** После завершения таймера / фиксации исхода держим карточку ещё 3 секунды. */
const PAIR_KISS_EXIT_PAUSE_AFTER_RESOLVED_MS = 3000
/** После завершения таймера пары переходим к следующему ходу без дополнительной паузы. */
const PAIR_KISS_NEXT_TURN_AFTER_RESOLVED_MS = 0
const NEXT_KISS_ANNOUNCE_MS = 5_000
// В этом SVG “носик” направлен примерно вниз-влево (≈135° от оси X вправо).
const TURN_ARROW_BASE_DIRECTION_DEG = 135
const TURN_ARROW_START_IS_CURRENT_TURN = true
const TURN_ARROW_OUTSIDE_GAP_PX = 12
const TURN_ARROW_EXTRA_ROTATE_DEG = 180
const TURN_ARROW_LAUNCH_EXTRA_PX = 22
const TURN_ARROW_LAUNCH_MS = 220
const TURN_ARROW_TO_AVATAR_MS = 420

const ACTION_BUTTON_STYLES: Record<string, { bg: string; border: string; shadow: string; text: string }> = {
  kiss:      { bg: "linear-gradient(180deg, #e74c3c 0%, #c0392b 100%)", border: "#a93226", shadow: "#7b241c", text: "#ffffff" },
  flowers:   { bg: "linear-gradient(180deg, #ffb347 0%, #ff7e00 100%)", border: "#e67e22", shadow: "#a04000", text: "#111827" },
  diamond:   { bg: "linear-gradient(180deg, #78d6ff 0%, #1ea5ff 100%)", border: "#0a6bd1", shadow: "#063f7a", text: "#0b1120" },
  beer:      { bg: "linear-gradient(180deg, #5d4037 0%, #3e2723 100%)", border: "#4e342e", shadow: "#2d1b0e", text: "#efebe9" },
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
  "flex w-full max-w-full items-center justify-center gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain py-1 [-webkit-overflow-scrolling:touch]"
const MOBILE_EMOTION_STRIP_BTN =
  "flex min-h-[2.75rem] shrink-0 flex-row items-center gap-2 rounded-full px-3 py-1.5 pr-3.5 text-left text-xs font-extrabold leading-tight sm:text-sm transition-[transform,filter] hover:brightness-105 active:scale-[0.98] disabled:opacity-40"

/** Подсказка у блока эмоций — только для участника пары, который отвечает взаимностью (не крутивший бутылку). */
// isTableSyncedAction moved to hooks/use-sync-engine.ts


const GAME_ROOM_DUST_SEED = 0x51ab1e
const TABLE_STYLE_BACKGROUNDS: Record<
  | "classic_night"
  | "sunset_lounge"
  | "ocean_breeze"
  | "violet_dream"
  | "cosmic_rockets"
  | "light_day"
  | "nebula_mockup",
  string
> = {
  classic_night: "linear-gradient(180deg, rgba(3,8,18,0.58) 0%, rgba(15,23,42,0.42) 40%, rgba(2,6,23,0.58) 100%)",
  sunset_lounge: "linear-gradient(180deg, rgba(120,53,15,0.42) 0%, rgba(190,24,93,0.32) 40%, rgba(30,41,59,0.56) 100%)",
  ocean_breeze: "linear-gradient(180deg, rgba(8,145,178,0.36) 0%, rgba(29,78,216,0.28) 45%, rgba(15,23,42,0.58) 100%)",
  violet_dream: "linear-gradient(180deg, rgba(91,33,182,0.40) 0%, rgba(147,51,234,0.28) 44%, rgba(15,23,42,0.58) 100%)",
  cosmic_rockets:
    "linear-gradient(180deg, rgba(2,6,23,0.62) 0%, rgba(15,23,42,0.34) 45%, rgba(2,6,23,0.62) 100%)",
  light_day:
    "linear-gradient(180deg, rgba(236,253,245,0.58) 0%, rgba(224,242,254,0.36) 45%, rgba(248,250,252,0.60) 100%)",
  nebula_mockup:
    "linear-gradient(168deg, rgba(15, 23, 42, 0.70) 0%, rgba(30, 27, 75, 0.54) 32%, rgba(49, 46, 129, 0.40) 52%, rgba(15, 23, 42, 0.64) 78%, rgba(9, 9, 26, 0.74) 100%)",
}

/** Фон столешницы: дерево + брендинг (public/assets/game-table-surface.png). */
const GAME_TABLE_SURFACE_URL = publicUrl("/assets/game-table-surface.png")
/**
 * Режим nebula: лёгкий фиолетовый скрим поверх той же текстуры.
 * Базовый режим — только исходная композиция (без второго тёмного слоя поверх).
 */
const GAME_TABLE_OVER_WOOD_SCRIM_NEBULA =
  "radial-gradient(circle at 50% 42%, rgba(79,70,229,0.09) 0%, rgba(30,27,75,0.26) 48%, rgba(15,23,42,0.4) 100%)"

function gameTableSurfaceBackground(isNebula: boolean): string {
  const base = `url(${GAME_TABLE_SURFACE_URL}) center center / cover no-repeat`
  if (isNebula) return `${GAME_TABLE_OVER_WOOD_SCRIM_NEBULA}, ${base}`
  return base
}

const GAME_TABLE_INNER_VIGNETTE_BG =
  "radial-gradient(circle at center, rgba(15,23,42,0.52) 0%, rgba(15,23,42,0.72) 68%, rgba(2,6,23,0.82) 100%)"
const GAME_TABLE_INNER_VIGNETTE_BG_NEBULA =
  "radial-gradient(circle at center, rgba(15,23,42,0.28) 0%, rgba(15,23,42,0.38) 62%, rgba(9,9,26,0.44) 100%)"

type GameRoomProps = {
  /** Число диалогов с непрочитанным (поклонники + избранные), для бейджа «Чат». */
  pmUnreadCount?: number
}

export function GameRoom({ pmUnreadCount = 0 }: GameRoomProps = {}) {
  const state = useGameState()
  const { rows: bottleCatalogRows, mainBottleId } = useBottleCatalog()
  const { rows: frameCatalogRows } = useFrameCatalog()
  const { rows: giftCatalogRows, refresh: refreshGiftCatalog } = useGiftCatalog()
  useTheme()
  const { layoutMobile: isMobile } = useGameLayoutMode()
  /** Только два режима: телефон (`isMobile`) и ПК (`isPcLayout`), без отдельного «планшетного» слоя по max-md/md/lg. */
  const isPcLayout = !isMobile
  const {
    players,
    currentTurnIndex,
    turnStartedAtMs,
    isSpinning,
    countdown,
    bottleAngle,
    bottleSkin,
    tableStyle,
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
    roomCreatorPlayerId,
    tablesCount: _tablesCount,
    gameLog,
    predictions,
    bets,
    pot,
    predictionPhase,
    roundNumber,
    inventory,
    playerMenuTarget,
    courtshipProfileAllowed,
    allowChatInvite,
    favorites,
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
    clientTabAway,
    gameSidePanel,
    admirers,
    pairKissPhase,
  } = state
  const [pairKissClock, setPairKissClock] = useState(() => Date.now())
  const [nextKissAnnouncementUntilMs, setNextKissAnnouncementUntilMs] = useState<number | null>(null)
  const [nextKissAnnouncementPlayerId, setNextKissAnnouncementPlayerId] = useState<number | null>(null)
  const [nextKissAnnouncementClock, setNextKissAnnouncementClock] = useState(() => Date.now())
  /** После FINALIZE фиксируем полоску для анимации ухода; секунды до этого идут с live-отсчётом до дедлайна. */
  const pairKissDisplayedProgressRef = useRef(0)
  /** Сброс прогресса только при смене roundKey. */
  const pairKissLockResetRoundKeyRef = useRef<string | null>(null)
  const pairKissModalPlayers = useMemo(() => {
    if (!pairKissPhase) return null
    const pa = players.find((p) => p.id === pairKissPhase.idA)
    const pb = players.find((p) => p.id === pairKissPhase.idB)
    if (!pa || !pb) return null
    return { pa, pb }
  }, [pairKissPhase, players])
  /** Центральная модалка «Поцелуются?» реально на экране (есть оба игрока в списке). */
  const pairKissCenterUi = pairKissPhase != null && pairKissModalPlayers != null
  /** Бутылка всегда остаётся на столе, даже когда поверх открыта карточка pair-kiss. */
  const bottleShouldRender = true
  const tablePlayerIdsKey = useMemo(
    () =>
      players.length === 0 ? "" : [...players].map((p) => p.id).sort((a, b) => a - b).join(","),
    [players],
  )
  /** Только вход/выход текущего игрока за стол; без смены при ответах в pair-kiss (иначе лишние сбросы FINALIZE). */
  const currentUserSeatedAtTable = Boolean(currentUser && players.some((p) => p.id === currentUser.id))
  const pairKissMsLeft = pairKissPhase
    ? Math.max(0, pairKissPhase.deadlineMs - pairKissClock)
    : 0
  const pairKissSecondsLeft = pairKissPhase ? Math.max(0, pairKissMsLeft / 1000) : 0
  const liveSec = pairKissPhase ? Math.max(0, Math.ceil(pairKissSecondsLeft)) : 1
  const liveProgress = pairKissPhase ? Math.min(1, pairKissMsLeft / PAIR_KISS_VOTE_DURATION_MS) : 0
  const pairKissMyPlayerId =
    currentUser && pairKissPhase && (currentUser.id === pairKissPhase.idA || currentUser.id === pairKissPhase.idB)
      ? currentUser.id
      : null
  const pairKissMyChoice =
    pairKissPhase && pairKissMyPlayerId != null
      ? pairKissMyPlayerId === pairKissPhase.idA
        ? pairKissPhase.choiceA
        : pairKissPhase.choiceB
      : null
  const pairKissCanPick = !!(pairKissPhase && pairKissMyPlayerId != null && !pairKissPhase.resolved && pairKissMyChoice === null)
  const pairKissBothAnswered =
    !!(pairKissPhase && pairKissPhase.choiceA !== null && pairKissPhase.choiceB !== null)
  const pairKissBothYes = !!(pairKissPhase?.choiceA === true && pairKissPhase?.choiceB === true)

  if (pairKissPhase && !pairKissPhase.resolved) {
    pairKissDisplayedProgressRef.current = liveProgress
  } else if (!pairKissPhase) {
    pairKissDisplayedProgressRef.current = 0
  }

  /** Ширина полоски: до resolved — живой отсчёт; после — снимок для exit-анимации. */
  const pairKissBarProgress = pairKissPhase
    ? pairKissPhase.resolved
      ? Math.min(1, Math.max(0, pairKissDisplayedProgressRef.current))
      : liveProgress
    : 0
  const nextKissAnnouncementSeconds = nextKissAnnouncementUntilMs
    ? Math.max(0, Math.ceil((nextKissAnnouncementUntilMs - nextKissAnnouncementClock) / 1000))
    : 0
  const nextKissAnnouncementPlayer = useMemo(
    () => (nextKissAnnouncementPlayerId == null ? null : players.find((p) => p.id === nextKissAnnouncementPlayerId) ?? null),
    [nextKissAnnouncementPlayerId, players],
  )
  const nextKissAnnouncementActive =
    !pairKissCenterUi &&
    !isSpinning &&
    !showResult &&
    countdown === null &&
    nextKissAnnouncementUntilMs != null &&
    nextKissAnnouncementSeconds > 0 &&
    nextKissAnnouncementPlayer != null

  useEffect(() => {
    if (nextKissAnnouncementUntilMs == null) return
    const id = window.setInterval(() => setNextKissAnnouncementClock(Date.now()), 150)
    return () => window.clearInterval(id)
  }, [nextKissAnnouncementUntilMs])

  const currentRoomName = roomNameForDisplay("", tableId)
  const frameCatalogSource = useMemo(
    () => (frameCatalogRows.length > 0 ? frameCatalogRows : DEFAULT_FRAME_CATALOG_ROWS),
    [frameCatalogRows],
  )
  const frameMetaById = useMemo(() => {
    const m = new Map<string, { border: string; shadow: string; svgPath?: string }>()
    for (const row of DEFAULT_FRAME_CATALOG_ROWS) {
      m.set(row.id, { border: row.border, shadow: row.shadow, svgPath: row.svgPath || undefined })
    }
    for (const row of frameCatalogRows) {
      m.set(row.id, { border: row.border, shadow: row.shadow, svgPath: row.svgPath || undefined })
    }
    return m
  }, [frameCatalogRows])
  const avatarFrameMetaByPlayerId = useMemo(() => {
    const out: Record<number, { border?: string; shadow?: string; svgPath?: string }> = {}
    for (const player of players) {
      const playerFrameId = avatarFrames?.[player.id]
      if (!playerFrameId) continue
      const meta = frameMetaById.get(playerFrameId)
        ?? (() => {
          const row = frameCatalogRows.find((candidate) => candidate.id === playerFrameId)
          return row ? { border: row.border, shadow: row.shadow, svgPath: row.svgPath || undefined } : undefined
        })()
      if (meta) {
        out[player.id] = meta
      }
    }
    return out
  }, [players, avatarFrames, frameMetaById, frameCatalogRows])
  const giftableFramesFree = useMemo(
    () =>
      frameCatalogSource
        .filter((row) => row.section === "free" && row.published && !row.deleted)
        .map((row) => ({
          id: row.id,
          label: row.name,
          border: row.border,
          shadow: row.shadow,
          svgPath: row.svgPath || null,
          cost: row.cost,
        })),
    [frameCatalogSource],
  )
  const giftableFramesPremium = useMemo(
    () =>
      frameCatalogSource
        .filter((row) => row.section !== "free" && row.published && !row.deleted)
        .map((row) => ({
          id: row.id,
          label: row.name,
          border: row.border,
          shadow: row.shadow,
          svgPath: row.svgPath || null,
          cost: row.cost,
        })),
    [frameCatalogSource],
  )
  const giftableFrameById = useMemo(() => {
    const m = new Map<string, { cost: number }>()
    ;[...giftableFramesFree, ...giftableFramesPremium].forEach((row) => {
      m.set(row.id, { cost: row.cost })
    })
    return m
  }, [giftableFramesFree, giftableFramesPremium])
  const giftCatalogSource = useMemo(
    () => (giftCatalogRows.length > 0 ? giftCatalogRows : DEFAULT_GIFT_CATALOG_ROWS),
    [giftCatalogRows],
  )
  const giftCatalogFree = useMemo(
    () => giftCatalogSource.filter((row) => row.section === "free" && row.published && !row.deleted),
    [giftCatalogSource],
  )
  const giftCatalogHearts = useMemo(
    () =>
      giftCatalogSource.filter(
        (row) => row.section !== "free" && row.published && !row.deleted && row.payCurrency !== "roses",
      ),
    [giftCatalogSource],
  )
  const giftCatalogPremiumRoses = useMemo(
    () =>
      giftCatalogSource.filter(
        (row) => row.section !== "free" && row.published && !row.deleted && row.payCurrency === "roses",
      ),
    [giftCatalogSource],
  )
  const giftCatalogTabSections = useMemo(
    () =>
      [
        {
          id: "free" as const,
          key: "free" as const,
          label: "Бесплатные",
          gifts: giftCatalogFree,
          emptyHint: "Скоро добавим подарки",
          accent: "sky" as const,
        },
        {
          id: "vip" as const,
          key: "hearts" as const,
          label: "Вип",
          gifts: giftCatalogHearts,
          accent: "amber" as const,
        },
        {
          id: "deluxe" as const,
          key: "premium_roses" as const,
          label: "Делюкс",
          gifts: giftCatalogPremiumRoses,
          emptyHint: "Скоро добавим подарки за розы",
          accent: "rose" as const,
        },
      ] as const,
    [giftCatalogFree, giftCatalogHearts, giftCatalogPremiumRoses],
  )
  const roseInventoryCount = useMemo(
    () => inventory.filter((i) => i.type === "rose").length,
    [inventory],
  )
  const giftDisplayById = useMemo(() => {
    const m = new Map<string, GiftChatDisplayMeta>()
    for (const row of DEFAULT_GIFT_CATALOG_ROWS) {
      m.set(row.id, {
        emoji: row.emoji,
        img: (row.img ?? "").trim(),
        name: row.name,
        music: (row.music ?? "").trim() || undefined,
      })
    }
    for (const row of giftCatalogRows) {
      m.set(row.id, {
        emoji: row.emoji,
        img: (row.img ?? "").trim(),
        name: row.name,
        music: (row.music ?? "").trim() || undefined,
      })
    }
    return m
  }, [giftCatalogRows])
  const giftCatalogLogTypeIds = useMemo(
    () => {
      const s = new Set<string>(DEFAULT_GIFT_CATALOG_ROWS.map((r) => String(r.id)))
      for (const r of giftCatalogRows) s.add(String(r.id))
      return s
    },
    [giftCatalogRows],
  )
  const bottleCatalogSource = useMemo(
    () => (bottleCatalogRows.length > 0 ? bottleCatalogRows : DEFAULT_BOTTLE_CATALOG_ROWS),
    [bottleCatalogRows],
  )
  const effectiveBottleSkin = useMemo(() => {
    const skinId = bottleSkin ?? "classic"
    if (skinId === "classic" && mainBottleId) return mainBottleId
    return skinId
  }, [bottleSkin, mainBottleId])

  const bottleImageOnTable = useMemo(() => {
    const fromCatalog = bottleCatalogSource.find((row) => row.id === effectiveBottleSkin)?.img
    if (fromCatalog) return fromCatalog
    const fromApi = bottleCatalogRows.find((row) => row.id === effectiveBottleSkin)?.img
    if (fromApi) return fromApi
    return ""
  }, [bottleCatalogSource, bottleCatalogRows, effectiveBottleSkin])

  const gameRoomDustParticles = useMemo(
    () => buildGameRoomDustParticles(8 + (GAME_ROOM_DUST_SEED % 19), GAME_ROOM_DUST_SEED),
    [],
  )

  const {
    dispatch,
    syncLiveTable,
    fetchTableAuthority,
    tableLiveReady,
    tableAuthorityReady,
    seatConfirmed,
    liveHumanCount,
  } = useSyncEngine()

  const tableChatEmojiVipActive = useMemo(
    () =>
      !!currentUser?.isVip && (currentUser.vipUntilTs == null || currentUser.vipUntilTs > Date.now()),
    [currentUser?.isVip, currentUser?.vipUntilTs],
  )

  const openShopForVipFromChat = useCallback(() => {
    dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })
  }, [dispatch])

  const playersRef = useRef(players)
  useEffect(() => { playersRef.current = players }, [players])
  const isSpinningRef = useRef(isSpinning)
  useEffect(() => {
    isSpinningRef.current = isSpinning
  }, [isSpinning])

  const spinResolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spinSessionRef = useRef<string>("")
  const spinStartedTurnKeyRef = useRef<string>("")
  const spinResolveDeadlineRef = useRef<number | null>(null)
  const spinResolveMetaRef = useRef<{
    spinSessionKey: string
    spinner: Player
    target: Player
    roundNumber: number
    currentTurnIndex: number
    predictions: typeof predictions
    bets: typeof bets
    pot: number
    tableId: number
  } | null>(null)
  const resetSpinResolveState = useCallback((reason: string) => {
    if (process.env.NODE_ENV === "development" && spinSessionRef.current) {
      console.debug("[spin] reset resolve state", {
        reason,
        spinSession: spinSessionRef.current,
      })
    }
    spinSessionRef.current = ""
    spinResolveDeadlineRef.current = null
    spinResolveMetaRef.current = null
    if (spinResolveTimeoutRef.current) {
      clearTimeout(spinResolveTimeoutRef.current)
      spinResolveTimeoutRef.current = null
    }
  }, [])
  const pendingNextKissAnnouncementRoundKeyRef = useRef<string | null>(null)
  const playedNextKissAnnouncementRoundKeyRef = useRef<string | null>(null)

  const [tableLoading, setTableLoading] = useState(true)
  const [tickerAnnouncementOpen, setTickerAnnouncementOpen] = useState(false)
  const [contactUsOpen, setContactUsOpen] = useState(false)
  const [vkGroupNewsOpen, setVkGroupNewsOpen] = useState(false)
  const [vkExtraHeartsOpen, setVkExtraHeartsOpen] = useState(false)
  const [vkBellIdle, setVkBellIdle] = useState(false)
  const [bankHeartPulseActive, setBankHeartPulseActive] = useState(false)
  const prevVoiceBalanceRef = useRef<number | null>(null)
  const bankHeartPulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickerAuthQuery = useMemo(() => {
    if (!currentUser) return ""
    if (currentUser.authProvider === "vk") {
      return `?vk_user_id=${encodeURIComponent(String(currentUser.id))}`
    }
    return ""
  }, [currentUser])

  useEffect(() => {
    setVkBellIdle(isVkGroupBellAnimationOff())
    const sync = () => setVkBellIdle(isVkGroupBellAnimationOff())
    window.addEventListener(VK_GROUP_BELL_STORAGE_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(VK_GROUP_BELL_STORAGE_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  /** Окно «Дополнительные сердечки» при каждом завершении загрузки стола (вход за стол). */
  useEffect(() => {
    if (!currentUser || tableLoading) return
    setVkExtraHeartsOpen(true)
  }, [currentUser?.id, tableLoading])

  /** Админский запрос: открыть VK окно подписки у конкретного игрока. */
  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    let timerId: number | null = null

    const pullPlayerRequest = async () => {
      if (cancelled) return
      try {
        const vkId = currentUser.vkUserId ?? (typeof currentUser.id === "number" ? currentUser.id : null)
        const qs = vkId != null ? `?vk_user_id=${encodeURIComponent(String(vkId))}` : ""
        const res = await apiFetch(`/api/player-requests${qs}`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ mode: "pull" }),
        })
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; request?: { kind?: string } | null }
          | null
        if (res.ok && data?.ok === true && data.request?.kind === "open_vk_group_news_modal") {
          setVkGroupNewsOpen(true)
        }
      } catch {
        // ignore transient poll errors
      } finally {
        if (!cancelled) timerId = window.setTimeout(pullPlayerRequest, 5000)
      }
    }

    void pullPlayerRequest()
    const onFocus = () => void pullPlayerRequest()
    const onVisibility = () => {
      if (document.visibilityState === "visible") void pullPlayerRequest()
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      cancelled = true
      if (timerId != null) window.clearTimeout(timerId)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [currentUser?.id])

  const isRoundDriver = useMemo(() => {
    if (!currentUser) return false
    const id = getRoundDriverPlayerId(players)
    return id != null && id === currentUser.id
  }, [players, currentUser?.id])

  const isClientTabAway =
    currentUser != null && clientTabAway?.[currentUser.id] === true
  const { returnFromAway } = useClientTabAwayPresence({
    enabled: true,
    userId: currentUser?.id,
    isAway: isClientTabAway,
    tablePaused,
    tableLoading,
    dispatch,
  })

  const { toast, showToast } = useInlineToast(2000)
  const [_giftProgressStats, setGiftProgressStats] = useState<GiftProgressStats | null>(null)
  const [giftAchievementOpen, setGiftAchievementOpen] = useState(false)
  const [giftAchievementShareBusy, setGiftAchievementShareBusy] = useState(false)

  const applyGiftProgressResult = useCallback(
    async (promise: Promise<{ stats: GiftProgressStats | null; achievementUnlockedNow: boolean }>) => {
      const result = await promise
      if (result.stats) setGiftProgressStats(result.stats)
      if (result.achievementUnlockedNow) setGiftAchievementOpen(true)
    },
    [],
  )

  const handleShareGiftAchievement = useCallback(async () => {
    if (!currentUser) return
    const vkOk = await isVkRuntimeEnvironment()
    if (!vkOk) {
      showToast("Публикация достижения доступна в приложении VK", "info")
      return
    }
    const gameUrl =
      getVkMiniAppPageUrl() ||
      (typeof window !== "undefined" && window.location.origin ? window.location.origin : "") ||
      "https://vk.com/app54511363"
    const _message = formatAchievementPostText({
      template: "",
      playerName: currentUser.name,
      achievementTitle: GIFT_ACHIEVEMENT_TITLE,
      gameUrl,
    })
    setGiftAchievementShareBusy(true)
    try {
      const ok = await showVkStoryBox({
        imageUrl: publicUrl(GIFT_ACHIEVEMENT_IMAGE_PATH),
        attachmentText: "Играть",
        attachmentUrl: gameUrl,
        locked: true,
      })
      showToast(ok ? "VK Stories открыты" : "Не удалось открыть VK Stories", ok ? "success" : "error")
      if (ok) setGiftAchievementOpen(false)
    } finally {
      setGiftAchievementShareBusy(false)
    }
  }, [currentUser, showToast])

  useEffect(() => {
    if (bankHeartPulseTimeoutRef.current) {
      clearTimeout(bankHeartPulseTimeoutRef.current)
      bankHeartPulseTimeoutRef.current = null
    }
    prevVoiceBalanceRef.current = voiceBalance
    setBankHeartPulseActive(false)
  }, [currentUser?.id])

  useEffect(() => {
    const prev = prevVoiceBalanceRef.current
    prevVoiceBalanceRef.current = voiceBalance
    if (prev == null) return
    if (voiceBalance <= prev) return
    setBankHeartPulseActive(true)
    if (bankHeartPulseTimeoutRef.current) {
      clearTimeout(bankHeartPulseTimeoutRef.current)
    }
    bankHeartPulseTimeoutRef.current = setTimeout(() => {
      bankHeartPulseTimeoutRef.current = null
      setBankHeartPulseActive(false)
    }, 1400)
  }, [voiceBalance])

  useEffect(() => {
    return () => {
      if (bankHeartPulseTimeoutRef.current) clearTimeout(bankHeartPulseTimeoutRef.current)
      if (spinResolveTimeoutRef.current) clearTimeout(spinResolveTimeoutRef.current)
    }
  }, [])

  const {
    wheelRotationDeg,
    wheelSpinning,
    wheelLastRewardText,
    adSpinUsedToday,
    canAffordSpin,
    spinCostHearts,
    handleSpinWithHearts,
    handleSpinWithAd,
  } = useFortuneWheel({
    currentUser,
    dispatch,
    voiceBalance,
    showToast,
  })

  useEffect(() => {
    if (!FORTUNE_WHEEL_ENABLED && gameSidePanel === "fortune-wheel") {
      dispatch({ type: "SET_GAME_SIDE_PANEL", panel: null })
    }
  }, [gameSidePanel, dispatch])

  // Рандомный бот периодически меняет себе рамку; в authority пушит только ведущий раунда (см. live-table-events-server).
  useEffect(() => {
    const bots = players.filter((p): p is Player => !!p.isBot)
    if (bots.length === 0 || !currentUser) return
    const roundDriverId = getRoundDriverPlayerId(players)
    if (roundDriverId == null || roundDriverId !== currentUser.id) return
    const interval = setInterval(() => {
      const bot = bots[Math.floor(Math.random() * bots.length)]
      if (bot) dispatch({ type: "SET_AVATAR_FRAME", playerId: bot.id, frameId: randomAvatarFrame() })
    }, 20000)
    return () => clearInterval(interval)
  }, [players, dispatch, currentUser])

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
      setSelectedFrameForGift(null)
    } else {
      setPlayerMenuTab("profile")
      setGiftCatalogDrawerPlayer(null)
    }
  }, [playerMenuTarget])

  // Result UI state (for center overlay)

  const [showBottleCatalog, setShowBottleCatalog] = useState(false)
  /** Вкладки карточки «Профиль игрока» (как в основном профиле) */
  const [playerMenuTab, setPlayerMenuTab] = useState<"profile" | "gifts" | "frame">("profile")
  const [selectedFrameForGift, setSelectedFrameForGift] = useState<string | null>(null)
  const [chatPanelCollapsed, setChatPanelCollapsed] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false)
  /** Планшет (md–lg): узкая колонка иконок; по нажатию — полная панель */
  const [leftSideMenuExpanded, setLeftSideMenuExpanded] = useState(true)
  const [sidebarTargetPlayer, setSidebarTargetPlayer] = useState<Player | null>(null)
  const [sidebarGiftMode, setSidebarGiftMode] = useState(false)
  const [giftCatalogDrawerPlayer, setGiftCatalogDrawerPlayer] = useState<Player | null>(null)
  const [giftPurchaseBusyKey, setGiftPurchaseBusyKey] = useState<string | null>(null)
  const [giftBatchPickerOpen, setGiftBatchPickerOpen] = useState(false)
  /** Массовый выбор: мужчины и женщины включаются независимо (можно оба сразу). */
  const [giftBatchMaleOn, setGiftBatchMaleOn] = useState(false)
  const [giftBatchFemaleOn, setGiftBatchFemaleOn] = useState(false)
  const [giftCatalogSectionTab, setGiftCatalogSectionTab] = useState<"free" | "vip" | "deluxe">("free")
  const [giftCatalogRecipientIds, setGiftCatalogRecipientIds] = useState<number[]>([])
  const giftCatalogActiveSection = useMemo(
    () =>
      giftCatalogTabSections.find((s) => s.id === giftCatalogSectionTab) ?? giftCatalogTabSections[0],
    [giftCatalogTabSections, giftCatalogSectionTab],
  )
  const [careOfferOpen, setCareOfferOpen] = useState(false)
  const [lastSidebarCombo, setLastSidebarCombo] = useState<PairGenderCombo | null>(null)
  const [emotionPurchaseOpen, setEmotionPurchaseOpen] = useState(false)
  const [emotionPurchasePick, setEmotionPurchasePick] = useState({
    kiss: true,
    beer: true,
    cocktail: true,
  })
  const [flyingEmojis, setFlyingEmojis] = useState<FlyingEmoji[]>([])
  const [steamPuffs, setSteamPuffs] = useState<SteamPuff[]>([])
  /** Полноэкранные 👋 по записи hello в gameLog (одинаковый seed id на всех клиентах). */
  const [tableHelloBurst, setTableHelloBurst] = useState<{ seed: string; key: number } | null>(null)
  const [chatRequestPrompt, setChatRequestPrompt] = useState<{ id: string; fromName: string } | null>(null)
  const [giftCatalogFlyFx, setGiftCatalogFlyFx] = useState<GiftCatalogFlyFx[]>([])
  const [giftArrivalBursts, setGiftArrivalBursts] = useState<GiftArrivalBurst[]>([])
  /** Скрыть последний подарок каталога на аватаре до конца частиц после полёта */
  const [catalogGiftAvatarHold, setCatalogGiftAvatarHold] = useState<{
    playerId: number
    giftTypeId: string
  } | null>(null)
  const tableHelloLogSeenRef = useRef(new Set<string>())
  const chatRequestSeenRef = useRef(new Set<string>())
  const playerMenuAvatarRef = useRef<HTMLDivElement | null>(null)
  const giftDrawerAvatarRef = useRef<HTMLDivElement | null>(null)
  const giftCatalogButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const giftCatalogFlyTimersRef = useRef<ReturnType<typeof globalThis.setTimeout>[]>([])
  const tableHelloBurstKeyRef = useRef(0)
  const emotionGiftFrameRef = useRef(0)
  const [chatInput, setChatInput] = useState("")
  const logEndRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  // Prediction state
  const [predictionTarget, setPredictionTarget] = useState<Player | null>(null)
  const [predictionTarget2, setPredictionTarget2] = useState<Player | null>(null)
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

  const giftDrawerEligibleRecipients = useMemo(
    () => players.filter((p) => p.id !== currentUser?.id),
    [players, currentUser?.id],
  )

  const selectedGiftRecipients = useMemo(() => {
    if (giftBatchMaleOn || giftBatchFemaleOn) {
      const idSet = new Set<number>()
      if (giftBatchMaleOn) {
        for (const p of giftDrawerEligibleRecipients) {
          if (p.gender === "male") idSet.add(p.id)
        }
      }
      if (giftBatchFemaleOn) {
        for (const p of giftDrawerEligibleRecipients) {
          if (p.gender === "female") idSet.add(p.id)
        }
      }
      const resolved = giftDrawerEligibleRecipients.filter((p) => idSet.has(p.id))
      if (resolved.length > 0) return resolved
    }
    // Когда массовые флаги выключены, список получателей управляется вручную `giftCatalogRecipientIds`.
    // Если он пустой — значит, пользователь удалил всех выбранных, и подарок никому не уйдет.
    const baseIds = giftCatalogRecipientIds
    const idSet = new Set(baseIds)
    const resolved = giftDrawerEligibleRecipients.filter((p) => idSet.has(p.id))
    if (resolved.length > 0) return resolved
    return baseIds.length === 0 ? [] : giftCatalogDrawerPlayer ? [giftCatalogDrawerPlayer] : []
  }, [
    giftBatchMaleOn,
    giftBatchFemaleOn,
    giftCatalogDrawerPlayer,
    giftCatalogRecipientIds,
    giftDrawerEligibleRecipients,
  ])

  useEffect(() => {
    if (!giftCatalogDrawerPlayer) {
      setGiftBatchPickerOpen(false)
      setGiftBatchMaleOn(false)
      setGiftBatchFemaleOn(false)
      setGiftCatalogRecipientIds([])
      setGiftCatalogSectionTab("free")
      return
    }
    setGiftBatchPickerOpen(false)
    setGiftBatchMaleOn(false)
    setGiftBatchFemaleOn(false)
    setGiftCatalogRecipientIds([giftCatalogDrawerPlayer.id])
  }, [giftCatalogDrawerPlayer])

  const removeGiftRecipient = useCallback(
    (recipientId: number) => {
      // Удаление отменяет массовый режим и переводит выбор в ручной список оставшихся.
      setGiftBatchMaleOn(false)
      setGiftBatchFemaleOn(false)
      const remaining = selectedGiftRecipients.filter((p) => p.id !== recipientId)
      setGiftCatalogRecipientIds(remaining.map((p) => p.id))
    },
    [selectedGiftRecipients],
  )

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
  const turnArrowAssetUrl = useMemo(() => publicUrl("/turn-current-arrow.svg"), [])
  const tableSurfaceRef = useRef<HTMLDivElement | null>(null)
  const bottleMeasureRef = useRef<HTMLDivElement | null>(null)
  const [bottleDiameterPx, setBottleDiameterPx] = useState<number>(0)
  const [turnArrowAngleDegPx, setTurnArrowAngleDegPx] = useState<number | null>(null)
  const [turnArrowPosPx, setTurnArrowPosPx] = useState<{ x: number; y: number } | null>(null)
  const [turnArrowTargetPx, setTurnArrowTargetPx] = useState<{ x: number; y: number } | null>(null)
  const [turnArrowVisible, setTurnArrowVisible] = useState(true)
  const [turnArrowTransitionMs, setTurnArrowTransitionMs] = useState(0)
  const turnArrowAnimTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    const el = bottleMeasureRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r) return
      const next = Math.round(Math.max(r.width, r.height))
      if (next > 0) setBottleDiameterPx(next)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Позицию и угол стрелки вычисляем по реальному DOM-вектору (см. effect ниже)

  const turnArrowSizePx = useMemo(() => {
    if (isMobile) return manyPlayersOnMobile ? 28 : 34
    return 40
  }, [isMobile, manyPlayersOnMobile])

  // distance теперь считается в effect по реальному DOM-вектору (turnArrowPosPx)
  const turnArrowAngleDeg = useMemo(() => {
    const pos = positions[currentTurnIndex]
    if (!pos) return null
    // Важно: pos.x / pos.y — проценты, но оси имеют разный масштаб (aspect).
    // Нормализуем по радиусам, чтобы угол совпадал с реальным расположением игрока.
    const dxN = (pos.x - 50) / Math.max(0.0001, radiusX)
    const dyN = (pos.y - 50) / Math.max(0.0001, radiusY)
    if (Math.abs(dxN) < 0.0001 && Math.abs(dyN) < 0.0001) return null
    const playerAngleDeg = (Math.atan2(dyN, dxN) * 180) / Math.PI
    // playerAngleDeg — направление от центра стола к центру аватарки текущего игрока.
    // По требованию: «начало стрелочки» указывает на центр аватарки (т.е. стрелка ориентируется вдоль радиуса наружу).
    const desiredArrowDirection = TURN_ARROW_START_IS_CURRENT_TURN ? playerAngleDeg : playerAngleDeg + 180
    return desiredArrowDirection - TURN_ARROW_BASE_DIRECTION_DEG
  }, [positions, currentTurnIndex, radiusX, radiusY])

  // Берём реальный вектор (px) от центра бутылки к центру аватарки текущего хода —
  // так стрелка всегда совпадает со статусом “чей ход”, даже если DOM чуть сместился.
  useEffect(() => {
    const bottleEl = bottleMeasureRef.current
    const pid = currentTurnPlayer?.id
    if (!bottleEl || pid == null) {
      setTurnArrowAngleDegPx(null)
      setTurnArrowPosPx(null)
      return
    }

    const compute = () => {
      const surface = tableSurfaceRef.current
      if (!surface) {
        setTurnArrowPosPx(null)
        setTurnArrowTargetPx(null)
        setTurnArrowAngleDegPx(null)
        return
      }
      const b = bottleEl.getBoundingClientRect()
      const a = surface.querySelector<HTMLElement>(`[data-turn-arrow-player-id="${pid}"]`)
      if (!a) {
        setTurnArrowPosPx(null)
        setTurnArrowTargetPx(null)
        setTurnArrowAngleDegPx(null)
        return
      }
      const ar = a.getBoundingClientRect()
      const sr = surface.getBoundingClientRect()

      const bx = b.left + b.width / 2
      const by = b.top + b.height / 2
      const ax = ar.left + ar.width / 2
      const ay = ar.top + ar.height / 2
      const dx = ax - bx
      const dy = ay - by
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return

      const len = Math.hypot(dx, dy)
      if (len < 0.5) return
      const ux = dx / len
      const uy = dy / len
      const bottleRadius = b.width > 0 ? b.width / 2 : bottleDiameterPx > 0 ? bottleDiameterPx / 2 : 0

      // Центр стрелки ставим СНАРУЖИ круга бутылки по тому же лучу:
      // center = bottleCenter + unit * (radius + gap + halfSize)
      const half = turnArrowSizePx / 2
      const offset = bottleRadius + TURN_ARROW_OUTSIDE_GAP_PX + half
      setTurnArrowPosPx({
        x: bx - sr.left + ux * offset,
        y: by - sr.top + uy * offset,
      })
      setTurnArrowTargetPx({
        x: ax - sr.left,
        y: ay - sr.top,
      })

      const playerAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI
      const desiredArrowDirection = TURN_ARROW_START_IS_CURRENT_TURN ? playerAngleDeg : playerAngleDeg + 180
      const finalDeg = desiredArrowDirection - TURN_ARROW_BASE_DIRECTION_DEG + TURN_ARROW_EXTRA_ROTATE_DEG
      setTurnArrowAngleDegPx(finalDeg)
    }

    const r1 = window.requestAnimationFrame(() => {
      compute()
      window.requestAnimationFrame(compute)
    })
    window.addEventListener("resize", compute)
    window.addEventListener("scroll", compute, true)
    const delayed = window.setTimeout(compute, 120)
    return () => {
      window.cancelAnimationFrame(r1)
      window.removeEventListener("resize", compute)
      window.removeEventListener("scroll", compute, true)
      window.clearTimeout(delayed)
    }
  }, [
    currentTurnPlayer?.id,
    currentTurnIndex,
    tablePlayerIdsKey,
    bottleDiameterPx,
    playerSlots,
    isMobile,
    showResult,
    isSpinning,
    countdown,
    pairKissCenterUi,
    turnArrowSizePx,
  ])

  useEffect(() => {
    if (pairKissCenterUi || isSpinning) return
    setTurnArrowVisible(true)
  }, [pairKissCenterUi, isSpinning, roundNumber, currentTurnIndex, currentTurnPlayer?.id])

  const clearTurnArrowAnimTimers = useCallback(() => {
    for (const t of turnArrowAnimTimersRef.current) clearTimeout(t)
    turnArrowAnimTimersRef.current = []
  }, [])

  useEffect(() => clearTurnArrowAnimTimers, [clearTurnArrowAnimTimers])

  // Игровая логика (эмоции, подписи «Пара: ...») опирается
  // на targetPlayer / targetPlayer2 из состояния — это именно
  // те двое, на кого указывает бутылка (горлышко и дно).
  const resolvedTargetPlayer = targetPlayer
  const resolvedTargetPlayer2 = targetPlayer2

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

  useEffect(() => {
    if (!bottleCooldownUntil) return
    const remaining = bottleCooldownUntil - Date.now()
    if (remaining <= 0) {
      dispatch({ type: "SET_BOTTLE_SKIN", skin: "classic" })
      dispatch({ type: "SET_BOTTLE_COOLDOWN_UNTIL", ts: undefined })
      dispatch({ type: "SET_BOTTLE_DONOR", playerId: undefined, playerName: undefined })
      return
    }
    const timer = setTimeout(() => {
      dispatch({ type: "SET_BOTTLE_SKIN", skin: "classic" })
      dispatch({ type: "SET_BOTTLE_COOLDOWN_UNTIL", ts: undefined })
      dispatch({ type: "SET_BOTTLE_DONOR", playerId: undefined, playerName: undefined })
    }, remaining)
    return () => clearTimeout(timer)
  }, [bottleCooldownUntil, dispatch])

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
      { id: "beer" as const, label: "По квасику", emoji: "🍺" },
      { id: "cocktail" as const, label: "Сладкое", emoji: "🍬" },
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

  const getBigGiftSequenceForPlayer = useCallback(
    (playerId: number): string[] => {
      return gameLog
        .filter((e) => giftCatalogLogTypeIds.has(e.type as string) && e.toPlayer?.id === playerId)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((e) => e.type as string)
    },
    [gameLog, giftCatalogLogTypeIds],
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
    if (isSpinning || countdown !== null) return
    const canSpin = currentTurnPlayer?.isBot ? isRoundDriver : isMyTurn
    if (!canSpin) return
    // Анимация “вылет” перед стартом кручения
    if (turnArrowPosPx && turnArrowTargetPx) {
      clearTurnArrowAnimTimers()
      setTurnArrowVisible(true)
      setTurnArrowTransitionMs(TURN_ARROW_LAUNCH_MS)

      const dx = turnArrowTargetPx.x - turnArrowPosPx.x
      const dy = turnArrowTargetPx.y - turnArrowPosPx.y
      const len = Math.hypot(dx, dy)
      if (len > 0.5) {
        const ux = dx / len
        const uy = dy / len
        setTurnArrowPosPx({
          x: turnArrowPosPx.x + ux * TURN_ARROW_LAUNCH_EXTRA_PX,
          y: turnArrowPosPx.y + uy * TURN_ARROW_LAUNCH_EXTRA_PX,
        })
      }

      const t = setTimeout(() => setTurnArrowTransitionMs(0), TURN_ARROW_LAUNCH_MS + 40)
      turnArrowAnimTimersRef.current.push(t)
    }
    if (!CASUAL_MODE) {
      dispatch({ type: "END_PREDICTION_PHASE" })
    }
    dispatch({ type: "START_COUNTDOWN" })
  }, [
    dispatch,
    isRoundDriver,
    isMyTurn,
    currentTurnPlayer?.isBot,
    isSpinning,
    countdown,
    turnArrowPosPx,
    turnArrowTargetPx,
    clearTurnArrowAnimTimers,
    roundNumber,
    currentTurnIndex,
  ])

  const wasSpinningRef = useRef(false)
  useEffect(() => {
    const prev = wasSpinningRef.current
    wasSpinningRef.current = isSpinning
    if (prev || !isSpinning) return
    if (!turnArrowTargetPx) return
    clearTurnArrowAnimTimers()
    setTurnArrowTransitionMs(TURN_ARROW_TO_AVATAR_MS)
    setTurnArrowPosPx(turnArrowTargetPx)
    /* Стрелка хода остаётся видимой на всём протяжении вращения бутылки */
  }, [isSpinning, turnArrowTargetPx, clearTurnArrowAnimTimers, roundNumber, currentTurnIndex])

  const finalizeSpinFromMeta = useCallback((meta: NonNullable<typeof spinResolveMetaRef.current>) => {
    if (spinSessionRef.current !== meta.spinSessionKey) {
      return
    }
    if (!CASUAL_MODE) {
      const aliveIds = new Set(meta.predictions.map((pred) => pred.playerId))
      meta.bets.forEach((b) => aliveIds.add(b.playerId))
      for (const pl of playersRef.current) aliveIds.add(pl.id)
      const safePredictions = meta.predictions.filter(
        (pred) =>
          aliveIds.has(pred.playerId) &&
          aliveIds.has(pred.targetPair[0]) &&
          aliveIds.has(pred.targetPair[1]),
      )
      const safeBets = meta.bets.filter(
        (b) =>
          aliveIds.has(b.playerId) &&
          aliveIds.has(b.targetPair[0]) &&
          aliveIds.has(b.targetPair[1]),
      )

      const actualPair = sortPair(meta.target.id, meta.spinner.id)

      safePredictions.forEach((pred) => {
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

      const predMap = new Map<string, number[]>()
      safePredictions.forEach((pred) => {
        const key = `${pred.targetPair[0]}_${pred.targetPair[1]}`
        const arr = predMap.get(key) || []
        arr.push(pred.playerId)
        predMap.set(key, arr)
      })
      predMap.forEach((playerIds) => {
        if (playerIds.length >= 2) {
          playerIds.forEach((pid) => {
            if (pid === currentUser?.id && currentUser) {
              dispatch({ type: "ADD_BONUS", amount: 5 })
              dispatch({
                type: "ADD_LOG",
                entry: {
                  id: generateLogId(),
                  type: "prediction",
                  fromPlayer: currentUser,
                  text: "Совпадение прогнозов! +5 бонусов",
                  timestamp: Date.now(),
                },
              })
            }
          })
        }
      })

      const correctPredictors = safePredictions.filter((pred) => pairsMatch(pred.targetPair, actualPair))
      correctPredictors.forEach((pred) => {
        if (pred.playerId === currentUser?.id && currentUser) {
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
              fromPlayer: currentUser,
              text: `${currentUser.name} угадал(а) пару и получает розу!`,
              timestamp: Date.now(),
            },
          })
        }
      })

      const winningBets = safeBets.filter((b) => pairsMatch(b.targetPair, actualPair))
      const totalWinningStakes = winningBets.reduce((sum, b) => sum + b.amount, 0)

      if (totalWinningStakes > 0 && meta.pot > 0) {
        winningBets.forEach((b) => {
          const winAmount = Math.floor((b.amount / totalWinningStakes) * meta.pot)
          if (b.playerId === currentUser?.id && currentUser) {
            dispatch({ type: "PAY_VOICES", amount: -winAmount })
            setBetWinnings(winAmount)
            dispatch({
              type: "ADD_LOG",
              entry: {
                id: generateLogId(),
                type: "system",
                fromPlayer: currentUser,
                text: `${currentUser.name} выиграл(а) ${winAmount} сердец из банка!`,
                timestamp: Date.now(),
              },
            })
          }
        })
      }
    }

    dispatch({ type: "STOP_SPIN", action: "skip" })
    const rk = `${meta.tableId}:${meta.roundNumber}:${meta.currentTurnIndex}:${meta.spinner.id}:${meta.target.id}`
    dispatch({
      type: "BEGIN_PAIR_KISS_PHASE",
      roundKey: rk,
      deadlineMs: Date.now() + PAIR_KISS_VOTE_DURATION_MS,
      idA: meta.spinner.id,
      idB: meta.target.id,
    })
    resetSpinResolveState("finalized")
  }, [currentUser, dispatch, resetSpinResolveState])

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
    turnStartedAtMs,
    currentTurnPlayer,
    currentUser,
    isSpinning,
    showResult,
    pairKissCenterUi,
    countdown,
    predictionPhase,
    dispatch,
    handleSpin,
    playersRef: playersRef as React.RefObject<Player[]>,
    casualMode: CASUAL_MODE,
    tableLoading,
    seatConfirmed,
  })

  /* ---- auto-scroll чата: в TableChatPanel (только у низа списка) ---- */

  /* ---- Start prediction phase when it's a new turn and nobody is spinning ---- */
  useEffect(() => {
    if (CASUAL_MODE) return
    if (tableLoading) return
    if (!isSpinning && !showResult && countdown === null && !predictionPhase && currentTurnPlayer && !predictionMade) {
      dispatch({ type: "START_PREDICTION_PHASE" })
    }
   
  }, [currentTurnIndex, isSpinning, showResult, countdown, tableLoading])

  /* ---- bot auto-spin (delayed to let prediction phase happen) ---- */
  const handleSpinRef = useRef(handleSpin)
  handleSpinRef.current = handleSpin

  useEffect(() => {
    if (tableLoading) return
    if (!isRoundDriver) return
    if (!currentTurnPlayer?.isBot || isSpinning || countdown !== null || showResult) return
    const timer = setTimeout(() => handleSpinRef.current(), 2500)
    return () => clearTimeout(timer)
  }, [currentTurnIndex, currentTurnPlayer?.isBot, isSpinning, countdown, showResult, tableLoading, isRoundDriver])

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
  const isRoundDriverRef = useRef(isRoundDriver)
  isRoundDriverRef.current = isRoundDriver
  const isMyTurnRef = useRef(isMyTurn)
  isMyTurnRef.current = isMyTurn
  const currentTurnPlayerBotRef = useRef(currentTurnPlayer?.isBot)
  currentTurnPlayerBotRef.current = currentTurnPlayer?.isBot

  useEffect(() => {
    if (tableLoading) return
    if (countdown === null || countdown <= 0) return
    const timer = setTimeout(() => {
      const shouldTick = currentTurnPlayerBotRef.current
        ? isRoundDriverRef.current
        : (isMyTurnRef.current || isRoundDriverRef.current)
      if (!shouldTick) return
      dispatch({ type: "TICK_COUNTDOWN" })
      if (countdown <= 1) startSpinRef.current()
    }, 800)
    return () => clearTimeout(timer)
  }, [countdown, dispatch, tableLoading])

  /* ---- звук при эмоции (учитываем настройку из профиля) ---- */
  const playEmotionSound = useCallback(
    (actionId: string) => {
      if (state.soundsEnabled === false || tableLoading) return
      const meta = giftDisplayById.get(String(actionId))
      const customMusic = meta?.music?.trim()
      if (customMusic) {
        if (typeof window === "undefined") return
        try {
          const url = catalogMediaUrl(customMusic)
          if (!url) return
          const a = new Audio(url)
          a.volume = 0.7
          a.play().catch(() => {})
        } catch {
          // ignore
        }
        return
      }
      const path =
        EMOTION_SOUNDS[actionId] ??
        (giftCatalogLogTypeIds.has(String(actionId)) ? EMOTION_SOUNDS.gift_catalog : undefined)
      if (!path || typeof window === "undefined") return
      try {
        const url = emotionSoundUrl(path)
        const a = new Audio(url)
        a.volume = 0.7
        a.play().catch(() => {})
      } catch {
        // ignore
      }
    },
    [state.soundsEnabled, tableLoading, giftCatalogLogTypeIds, giftDisplayById],
  )

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

  const launchEmotionGiftImage = useCallback(
    (fromIdx: number, toIdx: number) => {
      const next = nextEmotionGiftFrameNum(emotionGiftFrameRef.current)
      emotionGiftFrameRef.current = next
      launchEmoji(fromIdx, toIdx, undefined, emotionGiftFrameSrc(next))
      return next
    },
    [launchEmoji],
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
      gift_voice: "\uD83E\uDE99",
      tools: "\uD83D\uDEE0",
      lipstick: "\uD83D\uDC84",
      chat: "\uD83D\uDCAC",
      hug: "\uD83E\uDD17",
      selfie: "\uD83D\uDCF8",
      song: "\uD83C\uDFB5",
      rose: "\uD83C\uDF39",
    }
    const EMOTION_TYPES = new Set([...Object.keys(EMOTION_EMOJI_MAP), "banya", "cocktail", "beer"])

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

      if (giftCatalogLogTypeIds.has(entry.type as string)) {
        if (!entry.fromPlayer || !entry.toPlayer) continue
        if (entry.fromPlayer.id === currentUser.id) continue
        const fromIdx = players.findIndex((p) => p.id === entry.fromPlayer!.id)
        const toIdx = players.findIndex((p) => p.id === entry.toPlayer!.id)
        if (fromIdx === -1 || toIdx === -1) continue
        const gr = giftDisplayById.get(entry.type as string)
        const gImg = gr?.img?.trim()
        if (gImg) queue.push({ fromIdx, toIdx, type: entry.type, imgSrc: gImg })
        else queue.push({ fromIdx, toIdx, type: entry.type, emoji: gr?.emoji ?? "🎁" })
        continue
      }

      if (!EMOTION_TYPES.has(entry.type)) continue
      if (entry.type === "kiss" && isMutualKissPairLogText(entry.text)) continue
      if (entry.fromPlayer?.id === currentUser.id) continue
      if (!entry.fromPlayer || !entry.toPlayer) continue

      const fromIdx = players.findIndex((p) => p.id === entry.fromPlayer!.id)
      const toIdx = players.findIndex((p) => p.id === entry.toPlayer!.id)
      if (fromIdx === -1 || toIdx === -1) continue

      if (entry.type === "banya") {
        queue.push({ fromIdx, toIdx, type: entry.type, emoji: "\uD83E\uDDF9", imgSrc: assetUrl(EMOJI_BANYA) })
      } else if (entry.type === "cocktail") {
        const frame = nextEmotionGiftFrameNum(emotionGiftFrameRef.current)
        emotionGiftFrameRef.current = frame
        queue.push({ fromIdx, toIdx, type: entry.type, imgSrc: emotionGiftFrameSrc(frame) })
      } else if (entry.type === "beer") {
        queue.push({ fromIdx, toIdx, type: entry.type, imgSrc: assetUrl("kvas-big.svg") })
      } else if (EMOTION_EMOJI_MAP[entry.type]) {
        queue.push({ fromIdx, toIdx, type: entry.type, emoji: EMOTION_EMOJI_MAP[entry.type] })
      }
    }

    // Stagger animations; keep old timers running to avoid losing
    // queued animations when the effect re-fires on the next poll cycle.
    const STAGGER_MS = 350
    if (queue.length > 0) {
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
    }

    if (seen.size > 500) {
      const ids = Array.from(seen)
      const toRemove = ids.slice(0, ids.length - 200)
      for (const id of toRemove) seen.delete(id)
    }
  }, [gameLog, currentUser, players, launchEmoji, launchSteam, playEmotionSound, giftCatalogLogTypeIds, giftDisplayById])

  useEffect(() => {
    for (const e of gameLog) {
      if (e.type !== "hello") continue
      if (tableHelloLogSeenRef.current.has(e.id)) continue
      tableHelloLogSeenRef.current.add(e.id)
      tableHelloBurstKeyRef.current += 1
      setTableHelloBurst({ seed: e.id, key: tableHelloBurstKeyRef.current })
    }
    if (tableHelloLogSeenRef.current.size > 400) {
      const ids = Array.from(tableHelloLogSeenRef.current)
      for (const id of ids.slice(0, ids.length - 200)) tableHelloLogSeenRef.current.delete(id)
    }
  }, [gameLog])

  useEffect(() => {
    if (!currentUser) return
    for (const e of gameLog) {
      if (e.type !== "chat_request") continue
      if (chatRequestSeenRef.current.has(e.id)) continue
      chatRequestSeenRef.current.add(e.id)
      if (e.toPlayer?.id !== currentUser.id) continue
      const fromName = e.fromPlayer?.name?.trim() || "Игрок"
      setChatRequestPrompt({ id: e.id, fromName })
    }
    if (chatRequestSeenRef.current.size > 400) {
      const ids = Array.from(chatRequestSeenRef.current)
      for (const id of ids.slice(0, ids.length - 200)) chatRequestSeenRef.current.delete(id)
    }
  }, [gameLog, currentUser])

  useEffect(() => {
    if (tableHelloBurst == null) return
    const t = window.setTimeout(() => setTableHelloBurst(null), 2800)
    return () => window.clearTimeout(t)
  }, [tableHelloBurst])

  useEffect(() => {
    return () => {
      giftCatalogFlyTimersRef.current.forEach(clearTimeout)
      giftCatalogFlyTimersRef.current = []
    }
  }, [])

  /* ---- start the actual spin ---- */
  const startSpin = useCallback(() => {
    if (isSpinning) return
    const spinner = currentTurnPlayer
    if (!spinner) return
    const turnKey = `${tableId}:${roundNumber}:${currentTurnIndex}`
    if (spinStartedTurnKeyRef.current === turnKey) {
      return
    }
    const spinStillActiveForTurn =
      spinStartedTurnKeyRef.current === turnKey &&
      (spinResolveTimeoutRef.current != null || spinSessionRef.current !== "")
    if (spinStillActiveForTurn) return

    // Крутящий + один случайный из оставшихся только противоположного пола.
    const others = filterOppositeGenderOthers(players, spinner)
    if (others.length === 0) {
      showToast("Нет игроков противоположного пола за столом", "error")
      return
    }

    const idx = Math.floor(Math.random() * others.length)
    const target = others[idx]

    // Горлышко бутылки указывает на «цель» (target),
    // дно — на крутящего игрока (spinner).
    const targetIdx = players.findIndex((p) => p.id === target.id)
    if (targetIdx === -1) return
    const segmentDeg = 360 / players.length
    const targetDeg = -90 + segmentDeg * targetIdx
    const desiredAngle = ((targetDeg + 90) % 360 + 360) % 360
    const currentAngle = ((bottleAngle % 360) + 360) % 360
    const deltaToTarget = (desiredAngle - currentAngle + 360) % 360
    const totalAngle = bottleAngle + 360 * 5 + deltaToTarget
    const spinSessionKey = `${tableId}:${roundNumber}:${currentTurnIndex}:${spinner.id}`
    spinStartedTurnKeyRef.current = turnKey
    spinSessionRef.current = spinSessionKey
    if (process.env.NODE_ENV === "development") {
      console.debug("[spin] start", {
        spinSessionKey,
        spinnerId: spinner.id,
        targetId: target.id,
        tableId,
        roundNumber,
        currentTurnIndex,
      })
    }

    dispatch({ type: "END_PREDICTION_PHASE" })
    dispatch({ type: "START_SPIN", angle: totalAngle, target: target, target2: spinner })

    if (spinResolveTimeoutRef.current) {
      clearTimeout(spinResolveTimeoutRef.current)
      spinResolveTimeoutRef.current = null
    }
    spinResolveMetaRef.current = {
      spinSessionKey,
      spinner,
      target,
      roundNumber,
      currentTurnIndex,
      predictions,
      bets,
      pot,
      tableId,
    }
    spinResolveDeadlineRef.current = Date.now() + SPIN_RESOLVE_AFTER_MS
    spinResolveTimeoutRef.current = setTimeout(() => {
      const meta = spinResolveMetaRef.current
      if (!meta || meta.spinSessionKey !== spinSessionKey) return
      finalizeSpinFromMeta(meta)
    }, SPIN_RESOLVE_AFTER_MS)
     
  }, [players, currentTurnPlayer, dispatch, predictions, bets, pot, bottleAngle, tableId, roundNumber, currentTurnIndex, isSpinning, showToast, finalizeSpinFromMeta])

  useEffect(() => {
    if (isSpinning) return

    const meta = spinResolveMetaRef.current
    const deadline = spinResolveDeadlineRef.current

    /** Кратковременный isSpinning=false от sync: не сбрасываем meta, по окончании окна — finalize. */
    if (
      !showResult &&
      countdown === null &&
      meta != null &&
      deadline != null &&
      Date.now() <= deadline + SPIN_RESOLVE_GRACE_MS
    ) {
      const ms = Math.max(0, deadline + SPIN_RESOLVE_GRACE_MS - Date.now() + 20)
      const t = window.setTimeout(() => {
        if (isSpinningRef.current) return
        const m = spinResolveMetaRef.current
        const d = spinResolveDeadlineRef.current
        if (!m || d == null) return
        if (Date.now() < d) return
        if (spinSessionRef.current === m.spinSessionKey) {
          finalizeSpinFromMeta(m)
        }
      }, ms)
      return () => window.clearTimeout(t)
    }

    /** Дедлайн прошёл, а таймер не отработал — добиваем finalize один раз. */
    if (
      meta != null &&
      deadline != null &&
      Date.now() >= deadline &&
      spinSessionRef.current === meta.spinSessionKey
    ) {
      finalizeSpinFromMeta(meta)
      return
    }

    resetSpinResolveState("spin_stopped_without_meta")
  }, [isSpinning, roundNumber, currentTurnIndex, showResult, countdown, finalizeSpinFromMeta, resetSpinResolveState])

  useEffect(() => {
    spinStartedTurnKeyRef.current = ""
  }, [tableId, roundNumber, currentTurnIndex])

  useEffect(() => {
    if (!isSpinning) return
    const tryFinalize = () => {
      const deadline = spinResolveDeadlineRef.current
      const meta = spinResolveMetaRef.current
      if (deadline == null || meta == null) return
      if (Date.now() < deadline) return
      if (spinResolveTimeoutRef.current) {
        clearTimeout(spinResolveTimeoutRef.current)
        spinResolveTimeoutRef.current = null
      }
      finalizeSpinFromMeta(meta)
    }
    tryFinalize()
    const onVisibility = () => tryFinalize()
    window.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("focus", onVisibility)
    const interval = window.setInterval(tryFinalize, 350)
    return () => {
      window.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("focus", onVisibility)
      window.clearInterval(interval)
    }
  }, [isSpinning, finalizeSpinFromMeta])

  /** Любой клиент: если meta так и не отработала (например не координатор), добить finalize после долгого спина. */
  useEffect(() => {
    if (!isSpinning) return
    const id = window.setTimeout(() => {
      if (!isSpinningRef.current) return
      const meta = spinResolveMetaRef.current
      if (!meta || spinSessionRef.current !== meta.spinSessionKey) return
      if (process.env.NODE_ENV === "development") {
        console.debug("[spin] failsafe finalize", {
          spinSessionKey: meta.spinSessionKey,
          tableId: meta.tableId,
        })
      }
      finalizeSpinFromMeta(meta)
    }, SPIN_HANG_FAILSAFE_MS)
    return () => clearTimeout(id)
  }, [isSpinning, tableId, roundNumber, currentTurnIndex, finalizeSpinFromMeta])

  // Watchdog: если крутилка зависла >14 с — один координатор завершает спин и переводит в pair-kiss (fallback — NEXT_TURN).
  useEffect(() => {
    if (!isSpinning) return
    if (!currentUser || players.length === 0) return
    const humanIds = players.filter((p) => !p.isBot).map((p) => p.id)
    if (humanIds.length === 0) return
    const coordinatorId = Math.min(...humanIds)
    if (currentUser.id !== coordinatorId) return
    const watchdog = setTimeout(() => {
      if (process.env.NODE_ENV === "development") {
        console.debug("[spin] coordinator watchdog fired", {
          coordinatorId,
          tableId,
          roundNumber,
          currentTurnIndex,
        })
      }
      dispatch({ type: "STOP_SPIN", action: "skip" })
      if (currentTurnPlayer && targetPlayer) {
        dispatch({
          type: "BEGIN_PAIR_KISS_PHASE",
          roundKey: `${tableId}:${roundNumber}:${currentTurnIndex}:${currentTurnPlayer.id}:${targetPlayer.id}:watchdog`,
          deadlineMs: Date.now() + PAIR_KISS_VOTE_DURATION_MS,
          idA: currentTurnPlayer.id,
          idB: targetPlayer.id,
        })
        return
      }
      dispatch({ type: "NEXT_TURN" })
    }, 14_000)
    return () => clearTimeout(watchdog)
  }, [isSpinning, dispatch, currentUser?.id, tablePlayerIdsKey, currentTurnPlayer, targetPlayer, tableId, roundNumber, currentTurnIndex])

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
    const costPer = getNextQuotaCostPerTypeHearts(emotionDailyBoost)
    const totalCost = types.length * costPer
    if (voiceBalance < totalCost) {
      showToast("Недостаточно сердец", "error")
      return
    }
    dispatch({
      type: "BUY_EMOTION_QUOTA_SELECTION",
      dateKey: getTodayDateKey(),
      selectedTypes: [...types],
      extraPerPurchase: EMOTION_QUOTA_PURCHASE_AMOUNT,
    })
    showToast("Лимит эмоций увеличен до конца суток", "success")
    setEmotionPurchaseOpen(false)
  }, [currentUser, dispatch, emotionDailyBoost, emotionPurchasePick, showToast, voiceBalance])

  /* ---- perform gender-based action ---- */
  const handlePerformAction = (actionId: string) => {
    // Звук сразу по клику, пока контекст жеста пользователя активен (требование браузера)
    playEmotionSound(actionId)

    const tp = resolvedTargetPlayer
    const tp2 = resolvedTargetPlayer2
    if (!currentTurnPlayer || !tp || !tp2) return

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
      cocktail: "",
      gift_voice: "\uD83E\uDE99",
      tools: "\uD83D\uDEE0",
      lipstick: "\uD83D\uDC84",
      chat: "\uD83D\uDCAC",
      hug: "\uD83E\uDD17",
      selfie: "\uD83D\uDCF8",
      song: "\uD83C\uDFB5",
      rose: "\uD83C\uDF39",
    }
    if (actionId === "cocktail") {
      launchEmotionGiftImage(spinnerIdx, targetIdx)
    } else if (actionId === "beer") {
      launchEmoji(spinnerIdx, targetIdx, undefined, assetUrl("kvas-big.svg"))
    } else if (emojiMap[actionId]) {
      launchEmoji(spinnerIdx, targetIdx, emojiMap[actionId])
    }

    if (actionId === "banya") {
      launchEmoji(spinnerIdx, targetIdx, "🧹", assetUrl(EMOJI_BANYA))
      launchSteam(targetIdx)
    }
    if (actionId === "beer") {
      dispatch({ type: "ADD_DRUNK_TIME", playerId: currentTurnPlayer.id, ms: 60_000 })
    }

    const pairText = `${tp.name} & ${tp2.name}`
    const pairIdsForLog = actionId === "skip" ? undefined : sortedPairIds(tp, tp2)
    const logId = generateLogId()
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: logId,
        type: actionId as GameLogEntry["type"],
        fromPlayer: currentTurnPlayer,
        toPlayer: tp,
        ...(pairIdsForLog ? { pairIds: pairIdsForLog, toPlayer2: tp2 } : {}),
        text: `${currentTurnPlayer.name}: ${actionDef.label} (${pairText})`,
        timestamp: Date.now(),
      },
    })
    if (!currentTurnPlayer.isBot && isGiftRatingType(actionId)) {
      void applyGiftProgressResult(
        recordGiftProgress({
          dedupeId: logId,
          fromPlayer: currentTurnPlayer,
          toPlayer: tp,
          giftId: actionId,
          heartsCost: actionCost,
        }),
      )
    }

    if (actionId === "skip") {
      handleSkipTurn()
    }
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
      cocktail: "",
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
    } else if (actionId === "cocktail") {
      launchEmotionGiftImage(fromIdx, toIdx)
    } else if (actionId === "beer") {
      launchEmoji(fromIdx, toIdx, undefined, assetUrl("kvas-big.svg"))
    } else if (emojiMap[actionId]) {
      launchEmoji(fromIdx, toIdx, emojiMap[actionId])
    }
    if (actionId === "beer") {
      dispatch({ type: "ADD_DRUNK_TIME", playerId: currentUser.id, ms: 60_000 })
    }

    const pairIdsSidebar = sortedPairIds(currentUser, sidebarTargetPlayer)
    const logId = generateLogId()

    dispatch({
      type: "ADD_LOG",
      entry: {
        id: logId,
        type: actionId as GameLogEntry["type"],
        fromPlayer: currentUser,
        toPlayer: sidebarTargetPlayer,
        pairIds: pairIdsSidebar,
        text: `${currentUser.name} дарит: ${actionDef.label} ${sidebarTargetPlayer.name}`,
        timestamp: Date.now(),
      },
    })
    if (isGiftRatingType(actionId)) {
      void applyGiftProgressResult(
        recordGiftProgress({
          dedupeId: logId,
          fromPlayer: currentUser,
          toPlayer: sidebarTargetPlayer,
          giftId: actionId,
          heartsCost: actionCost,
        }),
      )
    }
  }

  /* ---- skip / advance turn ---- */
  const handleSkipTurn = () => {
    clearResultTimers()
    dispatch({ type: "NEXT_TURN" })
  }

  const pairKissAdvanceRef = useRef<string | null>(null)
  const pairKissStatusLogRef = useRef<string | null>(null)
  const pairKissBotPickScheduledRef = useRef<Set<string>>(new Set())
  const pairKissSoundStateRef = useRef<{
    roundKey: string
    choiceA: boolean | null
    choiceB: boolean | null
  } | null>(null)

  useEffect(() => {
    if (!pairKissPhase || pairKissPhase.resolved) return
    const id = window.setInterval(() => setPairKissClock(Date.now()), 100)
    return () => clearInterval(id)
  }, [pairKissPhase?.roundKey, pairKissPhase?.resolved])

  useEffect(() => {
    if (!pairKissPhase) {
      pairKissLockResetRoundKeyRef.current = null
      return
    }
    const k = pairKissPhase.roundKey
    if (pairKissLockResetRoundKeyRef.current === k) return
    pairKissLockResetRoundKeyRef.current = k
    pairKissDisplayedProgressRef.current = 0
  }, [pairKissPhase?.roundKey])
  useEffect(() => {
    if (!pairKissPhase) {
      pairKissBotPickScheduledRef.current.clear()
      pairKissSoundStateRef.current = null
      return
    }
    for (const key of pairKissBotPickScheduledRef.current) {
      if (!key.startsWith(`${pairKissPhase.roundKey}:`)) {
        pairKissBotPickScheduledRef.current.delete(key)
      }
    }
  }, [pairKissPhase?.roundKey])

  useEffect(() => {
    if (!pairKissPhase) return
    const prev = pairKissSoundStateRef.current
    if (!prev || prev.roundKey !== pairKissPhase.roundKey) {
      // На старте новой фазы просто запоминаем снэпшот, чтобы не проигрывать звук ретроспективно.
      pairKissSoundStateRef.current = {
        roundKey: pairKissPhase.roundKey,
        choiceA: pairKissPhase.choiceA,
        choiceB: pairKissPhase.choiceB,
      }
      return
    }

    const playCount =
      (prev.choiceA !== true && pairKissPhase.choiceA === true ? 1 : 0) +
      (prev.choiceB !== true && pairKissPhase.choiceB === true ? 1 : 0)

    if (playCount > 0) {
      playEmotionSound("kiss")
      if (playCount > 1) {
        window.setTimeout(() => playEmotionSound("kiss"), 130)
      }
    }

    pairKissSoundStateRef.current = {
      roundKey: pairKissPhase.roundKey,
      choiceA: pairKissPhase.choiceA,
      choiceB: pairKissPhase.choiceB,
    }
  }, [pairKissPhase, playEmotionSound])

  const onPairKissPick = useCallback(
    (playerId: number, yes: boolean) => {
      dispatch({ type: "SET_PAIR_KISS_CHOICE", playerId, yes })
    },
    [dispatch],
  )

  useEffect(() => {
    if (!isRoundDriver || !pairKissPhase || pairKissPhase.resolved) return
    const a = players.find((p) => p.id === pairKissPhase.idA)
    const b = players.find((p) => p.id === pairKissPhase.idB)
    const now = Date.now()
    const latestPickAt = pairKissPhase.deadlineMs - 450

    if (a?.isBot && pairKissPhase.choiceA == null) {
      const keyA = `${pairKissPhase.roundKey}:A`
      if (!pairKissBotPickScheduledRef.current.has(keyA)) {
        pairKissBotPickScheduledRef.current.add(keyA)
        const desiredDelay = 1200 + Math.floor(Math.random() * 1800)
        const dueAt = Math.min(latestPickAt, now + desiredDelay)
        const delay = Math.max(120, dueAt - now)
        window.setTimeout(() => {
          dispatch({ type: "SET_PAIR_KISS_CHOICE", playerId: pairKissPhase.idA, yes: Math.random() >= 0.5 })
        }, delay)
      }
    }
    if (b?.isBot && pairKissPhase.choiceB == null) {
      const keyB = `${pairKissPhase.roundKey}:B`
      if (!pairKissBotPickScheduledRef.current.has(keyB)) {
        pairKissBotPickScheduledRef.current.add(keyB)
        const desiredDelay = 1200 + Math.floor(Math.random() * 1800)
        const dueAt = Math.min(latestPickAt, now + desiredDelay)
        const delay = Math.max(120, dueAt - now)
        window.setTimeout(() => {
          dispatch({ type: "SET_PAIR_KISS_CHOICE", playerId: pairKissPhase.idB, yes: Math.random() >= 0.5 })
        }, delay)
      }
    }
  }, [isRoundDriver, pairKissPhase, players, dispatch])

  useEffect(() => {
    /* Любой игрок за столом может финализировать по правилам сервера; только round driver — если драйвер в AFK, иначе фаза висит и бутылка/ход не возвращаются. */
    if (!pairKissPhase || pairKissPhase.resolved) return
    if (!currentUser || !players.some((p) => p.id === currentUser.id)) return
    const ph = pairKissPhase
    /** Всегда до deadlineMs: раньше min(..., 1.2 с) после двух ответов обрывал отсчёт 10→0 и сразу ставил resolved. */
    const ms = Math.max(0, ph.deadlineMs - Date.now())
    const t = window.setTimeout(() => {
      dispatch({ type: "FINALIZE_PAIR_KISS" })
    }, ms)
    return () => clearTimeout(t)
  }, [
    currentUser?.id,
    currentUserSeatedAtTable,
    pairKissPhase?.roundKey,
    pairKissPhase?.deadlineMs,
    pairKissPhase?.resolved,
    dispatch,
  ])

  const pairKissHumanCoordinatorId = getRoundDriverPlayerId(players)

  useEffect(() => {
    if (!pairKissPhase?.resolved) return
    if (!currentUser) return
    const coordinatorId = pairKissHumanCoordinatorId
    const key = pairKissPhase.roundKey
    if (coordinatorId == null || currentUser.id !== coordinatorId) return
    if (pairKissAdvanceRef.current === key) return
    const t = window.setTimeout(() => {
      if (pairKissAdvanceRef.current === key) return
      pairKissAdvanceRef.current = key
      dispatch({ type: "NEXT_TURN" })
    }, PAIR_KISS_NEXT_TURN_AFTER_RESOLVED_MS)
    return () => clearTimeout(t)
  }, [currentUser?.id, pairKissHumanCoordinatorId, pairKissPhase?.resolved, pairKissPhase?.roundKey, dispatch])

  useEffect(() => {
    if (!pairKissPhase?.resolved) return
    pendingNextKissAnnouncementRoundKeyRef.current = pairKissPhase.roundKey
  }, [pairKissPhase?.resolved, pairKissPhase?.roundKey])

  useEffect(() => {
    const roundKey = pendingNextKissAnnouncementRoundKeyRef.current
    if (!roundKey || pairKissPhase != null) return
    if (playedNextKissAnnouncementRoundKeyRef.current === roundKey) return
    if (!currentTurnPlayer) return
    setNextKissAnnouncementPlayerId(currentTurnPlayer.id)
    setNextKissAnnouncementUntilMs(Date.now() + NEXT_KISS_ANNOUNCE_MS)
    playedNextKissAnnouncementRoundKeyRef.current = roundKey
    pendingNextKissAnnouncementRoundKeyRef.current = null
  }, [pairKissPhase, currentTurnPlayer?.id, roundNumber])

  useEffect(() => {
    if (nextKissAnnouncementUntilMs == null) return
    const left = nextKissAnnouncementUntilMs - Date.now()
    if (left <= 0) {
      setNextKissAnnouncementUntilMs(null)
      setNextKissAnnouncementPlayerId(null)
      return
    }
    const t = window.setTimeout(() => {
      setNextKissAnnouncementUntilMs(null)
      setNextKissAnnouncementPlayerId(null)
    }, left)
    return () => window.clearTimeout(t)
  }, [nextKissAnnouncementUntilMs])

  useEffect(() => {
    if (!pairKissPhase?.resolved) return
    const key = pairKissPhase.roundKey
    const t = window.setTimeout(() => {
      if (!pairKissPhase || !pairKissPhase.resolved || pairKissPhase.roundKey !== key) return
    }, 4000)
    return () => clearTimeout(t)
  }, [pairKissPhase])

  useEffect(() => {
    if (!pairKissPhase?.resolved || pairKissPhase.outcome !== "both_yes") return
    if (!currentUser) return
    const key = pairKissPhase.roundKey
    if (pairKissStatusLogRef.current === key) return
    const a = players.find((p) => p.id === pairKissPhase.idA)
    const b = players.find((p) => p.id === pairKissPhase.idB)
    if (!a || !b) return
    /** Раньше только idA слал ADD_LOG: если инициатор — бот, у живого игрока id !== idA → строка не попадала в лог/синк. */
    const coordinatorId = getRoundDriverPlayerId(players)
    const initiatorIsBot = a.isBot
    const isCoordinator = coordinatorId != null && currentUser.id === coordinatorId
    const isHumanInitiator = !initiatorIsBot && currentUser.id === pairKissPhase.idA
    if (initiatorIsBot) {
      if (!isCoordinator) return
    } else if (!isHumanInitiator) {
      return
    }
    pairKissStatusLogRef.current = key
    // Чтобы рейтинг «Любвеобильные» засчитывал поцелуй обоим участникам окна,
    // добавляем два лог-ивента `kiss`: по одному на каждого игрока.
    const ts = Date.now()
    const pairIds = sortedPairIds(a, b)
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "kiss",
        fromPlayer: a,
        toPlayer: b,
        toPlayer2: b,
        pairIds,
        text: `${a.name} — взаимный поцелуй — ${b.name}`,
        timestamp: ts,
      },
    })
    dispatch({
      type: "ADD_LOG",
      entry: {
        id: generateLogId(),
        type: "kiss",
        fromPlayer: b,
        toPlayer: a,
        toPlayer2: a,
        pairIds,
        text: `${b.name} — взаимный поцелуй — ${a.name}`,
        timestamp: ts,
      },
    })
  }, [currentUser?.id, players, pairKissPhase, dispatch])

  const thankDonorFromPlayer = useCallback(
    (fromPlayerId: number) => {
      if (!bottleDonorId) return
      const donorIdx = players.findIndex((p) => p.id === bottleDonorId)
      const fromIdx = players.findIndex((p) => p.id === fromPlayerId)
      if (donorIdx === -1 || fromIdx === -1 || bottleDonorId === fromPlayerId) return

      for (let i = 0; i < 3; i++) {
        setTimeout(() => launchEmoji(fromIdx, donorIdx, undefined, undefined, true), i * 120)
      }
    },
    [bottleDonorId, players, launchEmoji],
  )

  /* ---- боты рандомно нажимают «Спасибо» донору бутылочки ---- */
  useEffect(() => {
    if (!bottleDonorId || players.length === 0) return
    if (!isRoundDriver) return
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
  }, [bottleDonorId, players, currentUser?.id, thankDonorFromPlayer, isRoundDriver])

  /* ---- bot auto-actions on result (random, 1–3 actions) ---- */
  useEffect(() => {
    if (!showResult || !currentTurnPlayer || !currentTurnPlayer.isBot) return
    if (pairKissPhase) return
    if (!isRoundDriver) return
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
  }, [showResult, currentTurnPlayer, targetPlayer, targetPlayer2, roundNumber, isRoundDriver, pairKissPhase])

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
  const invitePlayerToChat = useCallback(
    (tp: Player) => {
      if (!currentUser) return
      if (voiceBalance < 5) {
        showToast("Недостаточно сердец для приглашения", "error")
        return
      }
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)
      if (resultTimerRef.current) clearInterval(resultTimerRef.current)
      dispatch({ type: "PAY_VOICES", amount: 5 })
      dispatch({ type: "ADD_FAVORITE", player: tp })
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "invite",
          fromPlayer: currentUser,
          toPlayer: tp,
          text: `${currentUser.name} приглашает ${tp.name} общаться`,
          timestamp: Date.now(),
        },
      })
      showToast("Приглашение отправлено", "success")
    },
    [currentUser, voiceBalance, dispatch, showToast],
  )

  const triggerGiftCatalogFlyToAvatar = useCallback(
    (
      buttonKey: string,
      recipientPlayerId: number,
      giftTypeId: string,
      emoji?: string,
      imgSrcRaw?: string,
    ) => {
      const buttonEl = giftCatalogButtonRefs.current[buttonKey]
      const surface = tableSurfaceRef.current
      if (!buttonEl || !surface) {
        return
      }
      const avatarWrap = surface.querySelector<HTMLElement>(`[data-turn-arrow-player-id="${recipientPlayerId}"]`)
      const from = buttonEl.getBoundingClientRect()
      const to = avatarWrap?.getBoundingClientRect()
      if (!to || from.width <= 0 || from.height <= 0 || to.width <= 0 || to.height <= 0) {
        return
      }
      const id = `gift_fly_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const startX = from.left + from.width / 2
      const startY = from.top + from.height / 2
      const endX = to.left + to.width / 2
      const endY = to.top + to.height / 2
      const imgSrc = typeof imgSrcRaw === "string" && imgSrcRaw.trim() ? imgSrcRaw.trim() : undefined
      setCatalogGiftAvatarHold({ playerId: recipientPlayerId, giftTypeId })
      setGiftCatalogFlyFx((prev) => [
        ...prev.slice(-7),
        { id, recipientPlayerId, giftTypeId, emoji, imgSrc, startX, startY, endX, endY },
      ])
    },
    [],
  )

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

  const handleChatAvatarMenuAction = useCallback(
    (
      action: "profile" | "reply" | "report",
      ctx: { player: Player; text: string },
    ) => {
      const { player } = ctx
      switch (action) {
        case "profile":
          dispatch({ type: "OPEN_PLAYER_MENU", player })
          break
        case "reply":
          setChatInput((prev) => {
            const mention = `@${player.name} `
            if (!prev.trim()) return mention
            return `${prev.trimEnd()} ${mention}`
          })
          showToast("Ник добавлен в поле ввода", "info")
          break
        case "report":
          setContactUsOpen(true)
          showToast("Опишите нарушение в форме обращения", "info")
          break
        default:
          break
      }
    },
    [dispatch, showToast, setContactUsOpen],
  )

  const handleJoinPlayerHello = useCallback(
    (joinedPlayer: Player) => {
      if (!currentUser || tablePaused) return
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "hello",
          fromPlayer: currentUser,
          toPlayer: joinedPlayer,
          text: `${currentUser.name} поприветствовал(а) ${joinedPlayer.name}`,
          timestamp: Date.now(),
        },
      })
      void fetchTableAuthority(tableId)
    },
    [currentUser, tablePaused, dispatch, fetchTableAuthority, tableId],
  )

  const handlePlayerProfileCareOffer = useCallback(
    (payWith: "hearts" | "roses") => {
      if (!currentUser || !playerMenuTarget) return
      if (currentUser.id === playerMenuTarget.id) return
      if (payWith === "hearts") {
        if (voiceBalance < 50) {
          showToast("Нужно 50 сердец", "error")
          return
        }
        dispatch({ type: "PAY_VOICES", amount: 50 })
      } else {
        if (roseInventoryCount < 10) {
          showToast("Нужно 10 роз", "error")
          return
        }
        dispatch({ type: "REMOVE_INVENTORY_ROSES", amount: 10 })
      }
      dispatch({
        type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "care",
          fromPlayer: currentUser,
          toPlayer: playerMenuTarget,
          text:
            payWith === "hearts"
              ? `${currentUser.name} начал(а) ухаживать за ${playerMenuTarget.name} (50 ❤ в банк игрока)`
              : `${currentUser.name} начал(а) ухаживать за ${playerMenuTarget.name} (10 🌹)`,
          timestamp: Date.now(),
        },
      })
      setCareOfferOpen(false)
      showToast("Ухаживание отправлено", "success")
    },
    [currentUser, playerMenuTarget, voiceBalance, roseInventoryCount, dispatch, showToast],
  )

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

    // Обычный клик по аватарке: сразу открыть каталог подарков
    // и одновременно активировать панель эмоций для выбранного игрока.
    setSidebarTargetPlayer(player)
    setSidebarGiftMode(true)
    setGiftCatalogDrawerPlayer(player)
    dispatch({ type: "CLOSE_PLAYER_MENU" })
  }

  /* ---- extra spin (pay voices) ---- */
  const handleExtraSpin = () => {
    if (voiceBalance < EXTRA_SPIN_COST) {
      showToast(`Нужно минимум ${EXTRA_SPIN_COST} сердца`, "error")
      return
    }
    dispatch({ type: "PAY_VOICES", amount: EXTRA_SPIN_COST })
    dispatch({
      type: "ADD_LOG",
        entry: {
          id: generateLogId(),
          type: "system",
          fromPlayer: currentUser!,
          text: `${currentUser!.name} заплатил(а) ${EXTRA_SPIN_COST} сердца за внеочередное кручение бутылки`,
          timestamp: Date.now(),
        },
    })
    if (currentUser) {
      dispatch({ type: "REQUEST_EXTRA_TURN", playerId: currentUser.id })
    }
    showToast("Внеочередное кручение оплачено", "success")
  }

  const canRespondInResult = !!(
    showResult &&
    !pairKissPhase &&
    resolvedTargetPlayer &&
    resolvedTargetPlayer2 &&
    currentUser &&
    !currentUser.isBot &&
    (currentUser.id === resolvedTargetPlayer.id || currentUser.id === resolvedTargetPlayer2.id)
  )

  /** Подсказка у блока эмоций: результат, ты в паре — и «свой» ход эмоциями, и ответный. */
  const showPairEmotionHint = canRespondInResult

  const sidebarActionCombo: PairGenderCombo | null = useMemo(() => {
    if (sidebarGiftMode && currentUser && sidebarTargetPlayer) {
      return getPairGenderCombo(currentUser, sidebarTargetPlayer)
    }
    // Во время модалки «Поцеловать?» набор по паре бутылки не показываем; подарок по аватарке — выше.
    return null
  }, [sidebarGiftMode, currentUser, sidebarTargetPlayer])

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
    !!currentUser && !currentUser.isBot && sidebarGiftMode && !!sidebarTargetPlayer

  const showMobileEmotionStrip =
    isMobile && Boolean(sidebarGiftMode && sidebarTargetPlayer)

  const pairKissDebugPrevRef = useRef<{
    roundKey: string | null
    resolved: boolean
    dropCandidateRoundKey: string | null
    uiHiddenLoggedForRoundKey: string | null
    stripOverlapLoggedForRoundKey: string | null
  }>({
    roundKey: null,
    resolved: false,
    dropCandidateRoundKey: null,
    uiHiddenLoggedForRoundKey: null,
    stripOverlapLoggedForRoundKey: null,
  })

  useEffect(() => {
    const prev = pairKissDebugPrevRef.current
    if (pairKissPhase) {
      if (!pairKissCenterUi && prev.uiHiddenLoggedForRoundKey !== pairKissPhase.roundKey) {
        prev.uiHiddenLoggedForRoundKey = pairKissPhase.roundKey
      }
      if (showMobileEmotionStrip && prev.stripOverlapLoggedForRoundKey !== pairKissPhase.roundKey) {
        prev.stripOverlapLoggedForRoundKey = pairKissPhase.roundKey
      }
      prev.roundKey = pairKissPhase.roundKey
      prev.resolved = pairKissPhase.resolved
      prev.dropCandidateRoundKey = pairKissPhase.roundKey
      return
    }
    if (showResult && prev.dropCandidateRoundKey) {
      prev.dropCandidateRoundKey = null
    }
    if (!showResult) {
      prev.roundKey = null
      prev.resolved = false
      prev.dropCandidateRoundKey = null
      prev.uiHiddenLoggedForRoundKey = null
      prev.stripOverlapLoggedForRoundKey = null
    }
  }, [
    pairKissPhase,
    players,
    roundNumber,
    currentTurnIndex,
    showResult,
    pairKissCenterUi,
    showMobileEmotionStrip,
    sidebarGiftMode,
    sidebarTargetPlayer?.id,
    currentUser?.id,
  ])

  const todayStart = useMemo(() => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }, [now])
  const todayKey = useMemo(() => new Date(todayStart).toISOString().slice(0, 10), [todayStart])

  // ---- DAILY QUESTS (computed from today's gameLog) ----

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
            (GIFT_LOG_TYPES.has(e.type) ||
              giftCatalogLogTypeIds.has(String(e.type)) ||
              (e.type === "system" && e.text.includes("дарит подарок"))),
        ).length
      : 0

  /** Эмоции/действия: поцелуй, квас, закваска, цветы, бриллиант, баня, инструменты, помада */
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

  /* ---- смена стола → лобби выбора комнаты ---- */
  const handleChangeTable = async () => {
    if (!currentUser) return
    try {
      await apiFetch("/api/rooms/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: currentUser.id }),
      })
    } catch {
      // при размонтировании GameRoom всё равно уйдёт leave через sync-engine
    }
    dispatch({ type: "SET_SCREEN", screen: "lobby" })
    showToast("Выберите другой стол", "info")
  }

  /* Активный бонус банка: +3 ❤ / 30 мин за столом с бутылочкой, если ≥2 живых игроков; лимит/сутки — см. TABLE_ACTIVE_BONUS_DAILY_CAP */
  const [bankPassiveBurstKey, setBankPassiveBurstKey] = useState(0)
  const [bankPassiveBurstOrigin, setBankPassiveBurstOrigin] = useState<{ x: number; y: number } | null>(null)
  const bankPlusButtonRef = useRef<HTMLButtonElement | null>(null)
  const triggerBankPassiveBurst = useCallback(() => {
    const el = bankPlusButtonRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      setBankPassiveBurstOrigin({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    }
    setBankPassiveBurstKey((k) => k + 1)
  }, [])
  const bankPassiveEnabled =
    Boolean(currentUser && !currentUser.isBot) &&
    !tablePaused &&
    !isClientTabAway &&
    !tableLoading &&
    seatConfirmed &&
    liveHumanCount >= 2

  const bankBonusIdleHint = useMemo(() => {
    if (!currentUser || currentUser.isBot) return "Войдите за стол как живой игрок."
    if (tablePaused) return "Пауза — активный бонус не копится."
    if (isClientTabAway) return "Вкладка в фоне — бонус на паузе."
    if (tableLoading || !seatConfirmed) return "Подождите подключения к столу."
    return undefined
  }, [currentUser, tablePaused, isClientTabAway, tableLoading, seatConfirmed])

  const { msUntilNext: msUntilNextBank, earnedToday: bankActiveBonusEarned, dailyCap: bankActiveBonusCap } =
    useBankPassive(currentUser?.id, dispatch, triggerBankPassiveBurst, bankPassiveEnabled)

  const bankActiveBonusTooltip = useMemo(
    () => ({
      earnedToday: bankActiveBonusEarned,
      dailyCap: bankActiveBonusCap,
      isAccruing: bankPassiveEnabled,
      idleHint: bankBonusIdleHint,
    }),
    [bankActiveBonusEarned, bankActiveBonusCap, bankPassiveEnabled, bankBonusIdleHint],
  )
  const handlePauseGame = useCallback(() => {
    if (!currentUser) return
    // Явно освобождаем место за live-столом и отключаем синхронизацию, пока пользователь не возобновит.
    const payload = JSON.stringify({ mode: "leave", userId: currentUser.id })
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(appPath("/api/table/live"), new Blob([payload], { type: "application/json" }))
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
  }, [currentUser, dispatch, showToast])

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */
  const tableStyleOverlay = TABLE_STYLE_BACKGROUNDS[tableStyle ?? "classic_night"]
  return (
    <div
      className="cinematic-desktop relative flex h-app w-full min-h-0 flex-row items-stretch overflow-hidden game-bg-animated"
      data-table-style={tableStyle ?? "classic_night"}
    >
      <div className="pointer-events-none absolute inset-0 z-0" style={{ background: tableStyleOverlay }} />
      {tableStyle === "cosmic_rockets" && <SpaceRocketsLayer />}
      {tableStyle === "nebula_mockup" && <NebulaMockupSkinLayer />}
      {toast && <InlineToast toast={toast} />}
      <GiftAchievementModal
        open={giftAchievementOpen}
        imageUrl={publicUrl(GIFT_ACHIEVEMENT_IMAGE_PATH)}
        achievementTitle={GIFT_ACHIEVEMENT_TITLE}
        recipientGender={currentUser?.gender === "female" ? "female" : "male"}
        description="Ура! Ты выполнил(а) достижение за подарки и получил(а) награду."
        shareBusy={giftAchievementShareBusy}
        onClose={() => {
          setGiftAchievementOpen(false)
        }}
        onShare={() => void handleShareGiftAchievement()}
      />
      {currentUser && (
        <TickerAnnouncementModal
          open={tickerAnnouncementOpen}
          onClose={() => setTickerAnnouncementOpen(false)}
          authorDisplayName={currentUser.name?.trim() || "Игрок"}
          authQuery={tickerAuthQuery}
          voiceBalance={voiceBalance}
          onSuccess={(newBalance) => {
            const paid = voiceBalance - newBalance
            if (paid > 0) dispatch({ type: "PAY_VOICES", amount: paid })
            else if (paid < 0) dispatch({ type: "ADD_VOICES", amount: -paid })
          }}
          showToast={showToast}
        />
      )}
      <ContactUsModal
        open={contactUsOpen}
        onOpenChange={setContactUsOpen}
        onNotify={showToast}
        diagnosticsExtra={{
          tableId,
          voiceBalance,
          currentUserId: currentUser?.id,
          authProvider: currentUser?.authProvider,
        }}
      />
      <VkGroupNewsModal open={vkGroupNewsOpen} onOpenChange={setVkGroupNewsOpen} onNotify={showToast} />
      <VkExtraHeartsGateModal open={vkExtraHeartsOpen} onOpenChange={setVkExtraHeartsOpen} />
      <BankPassiveBurstOverlay burstKey={bankPassiveBurstKey} origin={bankPassiveBurstOrigin ?? undefined} />
      {tableHelloBurst != null && (
        <TableHelloScreenBurstLayer seed={tableHelloBurst.seed} burstKey={tableHelloBurst.key} />
      )}

      <TableLoaderOverlay
        visible={tableLoading}
        liveReady={tableLiveReady}
        authorityReady={tableAuthorityReady}
        seatConfirmed={seatConfirmed}
        liveHumanCount={liveHumanCount}
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

      {/* Временный уход со вкладки: стол и синхронизация не останавливаются */}
      {currentUser && isClientTabAway && !tablePaused && (
        <div className="fixed inset-0 z-[46] flex items-center justify-center bg-black/25 p-5 backdrop-blur-[10px]">
          <div
            className="w-full max-w-md rounded-2xl border px-5 py-5 text-center shadow-2xl"
            style={{
              background: "linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.96) 100%)",
              borderColor: "rgba(148,163,184,0.28)",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-tab-away-title"
          >
            <p id="client-tab-away-title" className="text-lg font-extrabold text-slate-100">
              Вы временно вышли из игры
            </p>
            <p className="mt-2 text-sm text-slate-400">
              За столом вы отображаетесь как отошедший. Игра продолжается — после возврата вы увидите актуальное состояние.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => returnFromAway()}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold text-slate-950 transition-all hover:brightness-110 active:scale-[0.99] sm:w-auto sm:min-w-[10rem]"
                style={{
                  background: "linear-gradient(135deg, #22d3ee 0%, #6366f1 100%)",
                  border: "1px solid rgba(125,211,252,0.6)",
                  boxShadow: "0 2px 0 rgba(15,23,42,0.85)",
                }}
              >
                Вернуться
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Покупка доп. лимита эмоций (+50 к типу; 5 или 15 ❤ за тип) */}
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
              +{EMOTION_QUOTA_PURCHASE_AMOUNT} использований к каждому выбранному типу до конца суток. Следующая покупка сегодня:{" "}
              <span className="heart-price heart-price--compact text-rose-200">
                {getNextQuotaCostPerTypeHearts(emotionDailyBoost)} ❤
              </span>{" "}
              за тип (первый набор за день — {EMOTION_QUOTA_FIRST_COST_PER_TYPE} ❤/тип, далее — {EMOTION_QUOTA_NEXT_COST_PER_TYPE} ❤/тип).
            </p>
            <div className="mt-4 space-y-2">
              {(
                [
                  { id: "kiss" as const, label: "Поцелуй", emoji: "💋" },
                  { id: "beer" as const, label: "По квасику", emoji: "🍺" },
                  { id: "cocktail" as const, label: "Сладкое", emoji: "🍬" },
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
                  <span className="flex h-7 w-7 items-center justify-center text-lg" aria-hidden>
                    {row.id === "beer" ? (
                      <img src={assetUrl("kvas-big.svg")} alt="" className="h-7 w-7 object-contain" draggable={false} />
                    ) : (
                      row.emoji
                    )}
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
                ) * getNextQuotaCostPerTypeHearts(emotionDailyBoost)}{" "}
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
                      getNextQuotaCostPerTypeHearts(emotionDailyBoost) ||
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

      {/* Top-left controls: на ПК управление вынесено в боковую панель иконок */}
      <div
        className={`fixed z-40 flex max-w-[calc(100vw-1rem)] gap-1.5 overflow-x-auto ${
          isMobile
            ? "left-2 max-md:top-[calc(env(safe-area-inset-top)+4.35rem)] md:top-2 flex-row items-center"
            : "left-1 top-1 flex-col items-start"
        }`}
      >
        {!isPcLayout && (
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
        )}
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
            ? "relative flex min-h-0 min-w-0 flex-[4] basis-0 flex-row overflow-hidden"
            : "contents",
        )}
      >
      {/* ---- LEFT БОКОВОЕ МЕНЮ (скрыто на мобильных); фикс. ширина, не сжимается при резине центра ---- */}
      <div
        className={cn(
          "relative flex flex-col gap-2 transition-[width] duration-200 ease-out",
          isPcLayout
            ? "absolute left-0 top-1/2 z-[80] max-h-[calc(100%-1rem)] -translate-y-1/2 overflow-x-visible overflow-y-auto p-2 py-2 pb-14"
            : "relative z-20 max-h-app overflow-y-auto p-2 pt-20 lg:pt-24",
          isPcLayout ? "flex" : "hidden md:flex",
          leftSideMenuExpanded ? "w-[min(82vw,200px)]" : "w-14 lg:w-[min(82vw,200px)]",
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
        <div className={cn("flex flex-col gap-2", isPcLayout ? "min-h-0 flex-1 items-start justify-center" : "mt-auto")}>
          {/** Единый стиль для аккуратных кнопок бокового меню */}
          {(() => {
            const sideBtnClass =
              isPcLayout
                ? "group relative flex h-14 w-14 items-center justify-center rounded-full border transition-all hover:-translate-y-[1px] hover:brightness-110 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:shrink-0 [&_svg]:drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
                : "flex items-center gap-2 rounded-[999px] px-3 py-2 transition-all hover:brightness-110 hover:-translate-y-[1px] min-h-[40px]" +
                  (!leftSideMenuExpanded
                    ? " max-lg:min-h-[44px] max-lg:w-11 max-lg:min-w-[44px] max-lg:justify-center max-lg:rounded-full max-lg:px-2 max-lg:gap-0"
                    : "")
            const sideBtnTextClass =
              isPcLayout
                ? "pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-[120] -translate-y-1/2 rounded-full border border-cyan-300/35 bg-slate-950/95 px-3 py-1.5 text-[12px] font-semibold leading-none whitespace-nowrap text-slate-100 opacity-0 shadow-[0_8px_18px_rgba(2,6,23,0.45)] transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 translate-x-[-6px]"
                : "text-[13px] font-semibold leading-none" + (!leftSideMenuExpanded ? " max-lg:hidden" : "")
            const darkSideBtnStyle: CSSProperties = {
              background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
              border: "1px solid rgba(56,189,248,0.45)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 22px rgba(2,6,23,0.5), 0 0 0 1px rgba(56,189,248,0.12)",
            }
            const sideBtnPairWrap =
              "flex w-full gap-1.5 " +
              (isPcLayout ? "flex-col items-start" : leftSideMenuExpanded ? "flex-row" : "flex-row max-lg:flex-col max-lg:items-stretch")
            const sideBtnCompactClass =
              isPcLayout
                ? "group relative flex h-14 w-14 items-center justify-center rounded-full border transition-all hover:-translate-y-[1px] hover:brightness-110 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:shrink-0 [&_svg]:drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]"
                : "relative flex items-center gap-1.5 rounded-[999px] px-2.5 py-1.5 transition-all hover:brightness-110 hover:-translate-y-[1px] min-h-[36px] " +
                  (leftSideMenuExpanded
                    ? "flex-1 min-w-0 justify-center"
                    : " flex-1 min-w-0 justify-center max-lg:h-9 max-lg:w-full max-lg:min-h-9 max-lg:flex-none max-lg:justify-center max-lg:rounded-full max-lg:px-0 max-lg:gap-0")
            const sideBtnCompactTextClass =
              isPcLayout
                ? "pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-[120] -translate-y-1/2 rounded-full border border-cyan-300/35 bg-slate-950/95 px-3 py-1.5 text-[12px] font-semibold leading-none whitespace-nowrap text-slate-100 opacity-0 shadow-[0_8px_18px_rgba(2,6,23,0.45)] transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 translate-x-[-6px]"
                : "text-[12px] font-semibold leading-none truncate " + (!leftSideMenuExpanded ? " max-lg:hidden" : "")
            const profileMenuAvatarSrc =
              currentUser != null
                ? players.find((p) => p.id === currentUser.id)?.avatar ?? currentUser.avatar
                : null
            return (
              <>
          {/* Крутить вне очереди — только на мобильной (на ПК убрано из бокового меню) */}
          {!isMyTurn && !isSpinning && !showResult && countdown === null && (
            <div className={isPcLayout ? "hidden" : "md:hidden"}>
              <button
                onClick={handleExtraSpin}
                disabled={voiceBalance < EXTRA_SPIN_COST}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                style={{
                  background: "linear-gradient(180deg, #9b59b6 0%, #8e44ad 100%)",
                  color: "#fff",
                  border: "2px solid #7d3c98",
                  boxShadow: "0 2px 0 #5b2c6f",
                }}
              >
                <RotateCw className="h-3.5 w-3.5" />
                {`Крутить вне очереди (${EXTRA_SPIN_COST})`}
              </button>
            </div>
          )}

          {/* Ваш банк (сердца) */}
          {isPcLayout ? (
            <button
              type="button"
              ref={bankPlusButtonRef}
              onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })}
              className="group relative flex h-auto min-h-[4.5rem] w-12 flex-col items-center justify-center gap-1 rounded-full border px-1.5 py-2 transition-all hover:-translate-y-[1px] hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
                borderColor: "rgba(56,189,248,0.5)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 22px rgba(2,6,23,0.5), 0 0 0 1px rgba(56,189,248,0.14)",
              }}
              aria-label={`Ваш банк: ${voiceBalance}`}
            >
              <Heart
                className={`bank-heart-beat ${bankHeartPulseActive ? "scale-110" : ""} h-7 w-7 shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]`}
                style={{ color: "#fde047" }}
                fill="currentColor"
                aria-hidden
              />
              <span className="text-[15px] font-black tabular-nums leading-none tracking-tight text-white">
                {voiceBalance}
              </span>
              <span className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-20 -translate-y-1/2 rounded-full border border-cyan-300/35 bg-slate-950/95 px-3 py-1.5 text-[12px] font-semibold whitespace-nowrap text-slate-100 opacity-0 shadow-[0_8px_18px_rgba(2,6,23,0.45)] transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0 translate-x-[-6px]">
                Ваш банк
              </span>
            </button>
          ) : (
            <div
              className={
                "flex w-full min-w-0 items-center gap-2 rounded-[999px] px-2 py-2 min-h-[40px] sm:px-3" +
                (!leftSideMenuExpanded ? " max-lg:justify-center max-lg:px-2 max-lg:gap-2" : "")
              }
              style={{
                background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
                border: "1px solid rgba(56,189,248,0.45)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 22px rgba(2,6,23,0.5), 0 0 0 1px rgba(56,189,248,0.12)",
              }}
            >
              <div
                className={
                  "flex min-w-0 flex-1 items-center gap-2" +
                  (!leftSideMenuExpanded ? " max-lg:justify-center max-lg:flex-none" : "")
                }
              >
                <Heart
                  className={`bank-heart-beat ${bankHeartPulseActive ? "scale-110" : ""} h-6 w-6 shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]`}
                  style={{ color: "#fde047" }}
                  fill="currentColor"
                />
                <BankHeartBalanceTooltip
                  voiceBalance={voiceBalance}
                  msUntilNext={msUntilNextBank}
                  activeBonus={bankActiveBonusTooltip}
                  onOpenShop={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })}
                  className="inline-flex shrink-0 items-baseline"
                  tabularClassName="text-[15px] font-black tabular-nums leading-none text-white sm:text-base"
                />
                <span
                  className={"text-[11px] leading-none truncate " + (!leftSideMenuExpanded ? "max-lg:hidden" : "")}
                  style={{ color: "#cbd5e1" }}
                >
                  {"Ваш банк"}
                </span>
              </div>
              <div className={"flex shrink-0 items-center gap-1" + (!leftSideMenuExpanded ? " max-lg:flex" : "")}>
                <VkBankRewardVideoButton onNotify={showToast} />
                <button
                  type="button"
                  ref={bankPlusButtonRef}
                  onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })}
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
            </div>
          )}

          {/* Спонсорское видео в боковой панели (ПК) */}
          {isPcLayout && (
            <VkBankRewardVideoButton
              onNotify={showToast}
              className="h-14 w-14 rounded-full transition-all hover:-translate-y-[1px] hover:brightness-110"
            />
          )}

          {/* Магазин */}
          <button
            onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })}
            className={sideBtnClass}
            style={{
              background: "linear-gradient(135deg, #facc15 0%, #fb923c 100%)",
              border: "1px solid rgba(245, 158, 11, 0.95)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.35), 0 10px 24px rgba(251,146,60,0.45), 0 0 0 1px rgba(251,191,36,0.25)",
            }}
          >
            <Gift
              className={cn("shrink-0", isPcLayout ? "h-6 w-6" : "h-4 w-4")}
              style={{ color: "#0f172a", filter: isPcLayout ? "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" : undefined }}
              strokeWidth={isPcLayout ? 2.5 : 2.25}
              aria-hidden
            />
            <span className={sideBtnTextClass} style={{ color: isPcLayout ? "#f8fafc" : "#1f2937" }}>{"Магазин"}</span>
          </button>

          {/* Профиль + личный чат (избранные / поклонники) */}
          <div className={sideBtnPairWrap}>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "profile" })}
              className={sideBtnCompactClass}
              style={darkSideBtnStyle}
              title="Профиль"
              aria-label="Профиль"
            >
              {profileMenuAvatarSrc ? (
                <span
                  className={cn(
                    "relative shrink-0 overflow-hidden rounded-full border border-white/35 bg-slate-800 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)]",
                    isPcLayout ? "h-11 w-11" : "h-9 w-9",
                  )}
                >
                  <img
                    src={profileMenuAvatarSrc}
                    alt=""
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </span>
              ) : (
                <User
                  className={cn("shrink-0", isPcLayout ? "h-6 w-6" : "h-3.5 w-3.5")}
                  style={{ color: "#fde047" }}
                  strokeWidth={2.5}
                  aria-hidden
                />
              )}
              <span className={sideBtnCompactTextClass} style={{ color: "#f0e0c8" }}>
                {"Профиль"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "private-inbox" })}
              className={sideBtnCompactClass}
              style={darkSideBtnStyle}
              title="Личные сообщения"
              aria-label="Открыть личные сообщения"
            >
              <span
                className={cn(
                  "relative z-[1] flex shrink-0 items-center justify-center overflow-visible",
                  isPcLayout ? "h-6 w-6" : "h-3.5 w-3.5",
                )}
              >
                <MessageCircle
                  className={cn(isPcLayout ? "h-6 w-6" : "h-3.5 w-3.5")}
                  style={{ color: "#fde047" }}
                  strokeWidth={2.5}
                  aria-hidden
                />
                {(pmUnreadCount > 0 || chatRequestPrompt != null) && (
                  <div className="music-lure-layer--icon" aria-hidden>
                    <span className="music-lure-note music-lure-note--1">💬</span>
                    <span className="music-lure-note music-lure-note--2">🗨️</span>
                    <span className="music-lure-note music-lure-note--3">💬</span>
                  </div>
                )}
              </span>
              <span className={sideBtnCompactTextClass} style={{ color: "#f0e0c8" }}>
                {"Чат"}
              </span>
              {pmUnreadCount > 0 ? (
                <span
                  className={
                    "absolute flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-sm " +
                    (leftSideMenuExpanded
                      ? "-right-0.5 -top-1"
                      : " -right-0.5 -top-1 max-lg:right-0.5 max-lg:top-0.5")
                  }
                  aria-label={`Непрочитанных диалогов: ${pmUnreadCount}`}
                >
                  {pmUnreadCount > 9 ? "9+" : pmUnreadCount}
                </span>
              ) : null}
            </button>
          </div>

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
            className={cn(
              sideBtnClass,
              isPcLayout &&
                cooldownLeftMs > 0 &&
                "h-[4.35rem] w-14 flex-col items-center justify-center gap-0.5 rounded-[999px]",
            )}
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
              border: "1px solid rgba(56,189,248,0.45)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 22px rgba(2,6,23,0.5), 0 0 0 1px rgba(56,189,248,0.12)",
            }}
          >
            <span
              className={cn(
                "animate-game-room-bottle-icon select-none leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]",
                isPcLayout && cooldownLeftMs > 0 ? "text-[1.35rem]" : "text-[1.65rem] sm:text-[1.75rem]",
              )}
              style={{ lineHeight: 1 }}
              aria-hidden
            >
              {"🍾"}
            </span>
            <span className={sideBtnTextClass} style={{ color: isPcLayout ? "#f8fafc" : "#f0e0c8" }}>
              {"Бутылочка"}
            </span>
            {cooldownLeftMs > 0 && (
              <span
                className={cn(
                  isPcLayout ? "mt-[1px] text-[10px] font-medium leading-none" : "ml-auto text-xs font-semibold",
                  !leftSideMenuExpanded ? "max-lg:hidden" : "",
                )}
                style={{ color: "#e8c06a" }}
              >
                {formatCooldown(cooldownLeftMs)}
              </span>
            )}
          </button>

          {isPcLayout && (
            <div className="relative z-0 h-14 w-14 shrink-0 overflow-visible">
              <button
                type="button"
                onClick={() => setMusicEnabled((v) => !v)}
                className={`${sideBtnClass} relative z-[1]`}
                style={{
                  background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
                  border: "1px solid rgba(56,189,248,0.45)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 22px rgba(2,6,23,0.5), 0 0 0 1px rgba(56,189,248,0.12)",
                }}
                title={musicEnabled ? "Музыка: вкл" : "Музыка: выкл"}
                aria-label={musicEnabled ? "Выключить музыку" : "Включить музыку"}
              >
                <span className="relative z-[1] flex h-6 w-6 items-center justify-center overflow-visible">
                  <Music
                    className="relative z-0 h-6 w-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
                    style={{ color: musicEnabled ? "#fde047" : "#cbd5e1" }}
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  {!musicEnabled && (
                    <span
                      className="pointer-events-none absolute z-[1] h-[2px] w-[18px] -rotate-45 rounded-full"
                      style={{ background: "#f87171", boxShadow: "0 0 6px rgba(248,113,113,0.5)" }}
                      aria-hidden
                    />
                  )}
                  {!musicEnabled && (
                    <div className="music-lure-layer--icon" aria-hidden>
                      <span className="music-lure-note music-lure-note--1">♪</span>
                      <span className="music-lure-note music-lure-note--2">♫</span>
                      <span className="music-lure-note music-lure-note--3">♪</span>
                    </div>
                  )}
                </span>
                <span className={sideBtnTextClass} style={{ color: "#f8fafc" }}>
                  {musicEnabled ? "Музыка: вкл" : "Музыка: выкл"}
                </span>
              </button>
            </div>
          )}

          {isPcLayout && (
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_SOUNDS_ENABLED", enabled: soundsEnabled === false })}
              className={sideBtnClass}
              style={{
                background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
                border: "1px solid rgba(56,189,248,0.45)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 22px rgba(2,6,23,0.5), 0 0 0 1px rgba(56,189,248,0.12)",
              }}
              title={soundsEnabled === false ? "Звуки: выкл" : "Звуки: вкл"}
              aria-label={soundsEnabled === false ? "Включить звуки" : "Выключить звуки"}
            >
              <span className="relative flex h-6 w-6 items-center justify-center">
                <Headphones
                  className="h-6 w-6 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
                  style={{ color: soundsEnabled === false ? "#cbd5e1" : "#fde047" }}
                  strokeWidth={2.5}
                  aria-hidden
                />
                {soundsEnabled === false && (
                  <span
                    className="pointer-events-none absolute h-[2px] w-[18px] -rotate-45 rounded-full"
                    style={{ background: "#f87171", boxShadow: "0 0 6px rgba(248,113,113,0.5)" }}
                    aria-hidden
                  />
                )}
              </span>
              <span className={sideBtnTextClass} style={{ color: "#f8fafc" }}>
                {soundsEnabled === false ? "Звуки: выкл" : "Звуки: вкл"}
              </span>
            </button>
          )}

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={sideBtnClass}
                style={{
                  background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
                  border: "1px solid rgba(56,189,248,0.45)",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 22px rgba(2,6,23,0.5), 0 0 0 1px rgba(56,189,248,0.12)",
                }}
              >
                <Menu
                  className={cn("shrink-0", isPcLayout ? "h-6 w-6" : "h-4 w-4")}
                  style={{ color: "#fde047" }}
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span className={sideBtnTextClass} style={{ color: isPcLayout ? "#f8fafc" : "#f0e0c8" }}>{"Меню"}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              sideOffset={8}
              className="z-[200] min-w-[13rem] border-slate-600 bg-slate-950/98 p-1 text-slate-100 shadow-xl"
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 focus:bg-slate-800 focus:text-slate-100"
                onSelect={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "rating" })}
              >
                <Trophy className="h-4 w-4 shrink-0 text-amber-300" />
                Рейтинг
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer gap-2 focus:bg-slate-800 focus:text-slate-100"
                onSelect={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "favorites" })}
              >
                <Star className="h-4 w-4 shrink-0 text-amber-300" />
                Избранное
              </DropdownMenuItem>
              {currentUser && (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 focus:bg-slate-800 focus:text-slate-100"
                  onSelect={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "daily" })}
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
                  Ежедневные задачи
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="cursor-pointer gap-2 focus:bg-slate-800 focus:text-slate-100"
                onSelect={() => setContactUsOpen(true)}
              >
                <Headphones className="h-4 w-4 shrink-0 text-cyan-300" />
                Связаться с нами
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {!isPcLayout && (
            <div
              className={
                "flex items-center gap-2 rounded-[999px] px-3 py-2 min-h-[40px]" +
                (!leftSideMenuExpanded ? " max-lg:justify-center max-lg:px-2" : "")
              }
              style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(56,189,248,0.18)" }}
              title={!leftSideMenuExpanded ? `${currentRoomName} — ${liveHumanCount}/10` : undefined}
            >
              <RotateCw className="h-3 w-3 shrink-0" style={{ color: "#94a3b8" }} />
              <span
                className={"text-[11px] leading-none " + (!leftSideMenuExpanded ? "max-lg:hidden" : "")}
                style={{ color: "#94a3b8" }}
              >
                {currentRoomName}{" "}
                <span className="tabular-nums text-cyan-300/70">{liveHumanCount}/10</span>
              </span>
            </div>
          )}
              </>
            )
          })()}
        </div>
      </div>

      {FORTUNE_WHEEL_ENABLED && (
        <FortuneWheelSidePanel
          open={gameSidePanel === "fortune-wheel"}
          wheelSpinning={wheelSpinning}
          wheelRotationDeg={wheelRotationDeg}
          wheelLastRewardText={wheelLastRewardText}
          voiceBalance={voiceBalance}
          spinCostHearts={spinCostHearts}
          canAffordSpin={canAffordSpin}
          adSpinUsedToday={adSpinUsedToday}
          onClose={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: null })}
          onSpinHearts={handleSpinWithHearts}
          onSpinAd={handleSpinWithAd}
        />
      )}
      {showBottleCatalog && (
        <BottleCatalogModal
          onClose={() => setShowBottleCatalog(false)}
          isPcLayout={isPcLayout}
          players={players}
          ownedBottleSkins={ownedBottleSkins}
          bottleSkin={bottleSkin}
          effectiveBottleSkin={effectiveBottleSkin}
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
          "relative flex min-h-0 min-w-0 flex-1 flex-col items-center",
          isPcLayout ? "gap-0" : "gap-2 lg:gap-3",
          /* ПК: без overflow-y на колонке — иначе flex-центрирование растягивается по контенту и стол «прилипает» к верху */
          isPcLayout ? "z-30 max-h-full min-w-0 flex-1 overflow-hidden" : "z-10 overflow-y-auto",
          !isPcLayout && "pb-14 px-0.5 sm:px-1",
          isPcLayout
            ? "h-full w-full max-w-none min-h-0 self-stretch"
            : "max-md:items-stretch max-md:pt-[calc(env(safe-area-inset-top)+4.25rem)] md:pt-1 md:px-2 lg:px-3 lg:pb-2",
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
        {/* Инфо-статусы: таймер хода (без статуса доната бутылки) */}
        <div
          className="z-30 flex w-full shrink-0 flex-col items-center justify-center gap-1"
          style={{ minHeight: isPcLayout ? 0 : 28 }}
        >
          {!isMobile &&
            currentUser &&
            currentTurnPlayer?.id === currentUser.id &&
            turnTimer !== null &&
            !(isMyTurn && !pairKissCenterUi && !isSpinning && !showResult && countdown === null) && (
            <div
              className="flex min-w-[8.75rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1"
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
        {/* Блок стола: по центру колонки по вертикали и горизонтали; при переполнении — прокрутка */}
        <div
          className={cn(
            "flex min-h-0 w-full min-w-0 flex-1 flex-col justify-center",
            isMobile ? "items-stretch gap-1.5" : "items-center",
            isPcLayout &&
              "mx-auto max-h-full justify-between overflow-y-auto overflow-x-visible px-2 pt-0 lg:px-3",
          )}
        >
        {/* max-md: полоса 70px под навбаром — эмоции по центру; стол начинается сразу под полосой */}
        <div
          className={cn(
            "h-[70px] w-full shrink-0 flex-col items-center justify-center gap-0.5 px-0.5",
            showPairEmotionHint ? "overflow-visible" : "overflow-hidden",
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
                disabled={voiceBalance < EMOTION_QUOTA_FIRST_COST_PER_TYPE}
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
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center [&>img]:h-7 [&>img]:w-7 [&>svg]:h-6 [&>svg]:w-6 [&>span]:text-xl">
                      {renderActionIcon(action)}
                    </span>
                    <span className="min-w-0 max-w-[11rem] truncate sm:max-w-[13rem]">{action.label}</span>
                    {shouldShowActionCostBadge(action.id, actionCost) && (
                      <span
                        className="heart-price heart-price--badge flex shrink-0 items-center rounded-full px-2 py-0.5 opacity-95"
                        style={{ background: "rgba(0,0,0,0.18)", color: style.text }}
                      >
                        {actionCost}
                        <Heart className="heart-price__icon h-4 w-4" fill="currentColor" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            </div>
          )}
        </div>
        {/* Широкая панель эмоций над столом (ПК): z ниже блока стола (см. z-[40] на столе), чтобы карточка «Поцелуются?» не уезжала под панель. */}
        {isPcLayout && (
          <div className="sticky top-0 z-[45] mb-2 w-full shrink-0 self-stretch">
            <div className="w-full rounded-2xl border border-cyan-300/35 bg-slate-950/80 p-1 backdrop-blur-[2px] shadow-[0_12px_30px_rgba(2,6,23,0.52),inset_0_1px_0_rgba(255,255,255,0.1)]">
              <div className="flex w-full items-center justify-center gap-2 px-1 py-1">
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-slate-600/70 bg-slate-900/80 px-3">
                    <Sparkles className="h-4 w-4 shrink-0" style={{ color: "#e8c06a" }} />
                    <span className="text-[11px] font-extrabold text-amber-200">Банк эмоций</span>
                    {limitedEmotionCounters.map((row) => (
                      <span key={row.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/65 bg-slate-900/75 px-2 py-0.5">
                        {row.id === "beer" ? (
                          <img src={assetUrl("kvas-big.svg")} alt="" className="h-4.5 w-4.5 object-contain" draggable={false} />
                        ) : (
                          <span className="text-sm leading-none" style={{ color: "#e2e8f0" }}>{row.emoji}</span>
                        )}
                        <span
                          className="text-[11px] font-black tabular-nums"
                          style={{ color: row.left > 0 ? "#67e8f9" : "#fda4af" }}
                        >
                          {row.used}/{row.limit}
                        </span>
                      </span>
                    ))}
                  </div>

                  {isEmotionLimitReached && (
                    <button
                      type="button"
                      onClick={openEmotionPurchaseModal}
                      className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-extrabold transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
                      disabled={voiceBalance < EMOTION_QUOTA_FIRST_COST_PER_TYPE}
                      style={{
                        background: "linear-gradient(180deg, #22d3ee 0%, #6366f1 100%)",
                        color: "#0f172a",
                        border: "1px solid rgba(103, 232, 249, 0.9)",
                        boxShadow: "0 1px 0 rgba(30, 64, 175, 0.9)",
                      }}
                    >
                      {`Купить +${EMOTION_QUOTA_PURCHASE_AMOUNT}`}
                    </button>
                  )}
                </div>

                <div className="min-w-0 max-w-[min(100%,58rem)] overflow-x-auto overflow-y-hidden overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                  <div className="flex w-max items-center justify-center gap-2">
                    {sidebarAvailableActions.filter((action) => action.id !== "skip").map((action) => {
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
                            }
                          }}
                          disabled={isDisabled}
                          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 py-0 pr-3.5 text-left text-[11px] font-extrabold leading-none transition-[transform,filter] hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
                          style={{
                            background: style.bg,
                            color: style.text,
                            border: `1px solid ${style.border}`,
                            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 0 ${style.shadow}`,
                          }}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center [&_img]:h-6 [&_img]:w-6 [&_svg]:h-4.5 [&_svg]:w-4.5 [&>span]:text-base">
                            {renderActionIcon(action)}
                          </span>
                          <span className="min-w-0 max-w-[8rem] truncate">{action.label}</span>
                          {shouldShowActionCostBadge(action.id, actionCost) && (
                            <span className="heart-price heart-price--badge ml-1 flex shrink-0 items-center rounded-full px-1.5 py-0.5 opacity-95">
                              {actionCost}
                              <Heart className="heart-price__icon h-3.5 w-3.5" fill="currentColor" />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Стол ~60:50 (ширина/высота): моб — 90% / max 420px; ПК — вписать в min(72vh,78dvh) по высоте */}
        <div
          ref={tableSurfaceRef}
          className={
            isMobile
              ? `relative flex w-[90%] max-w-[min(90vw,420px)] shrink-0 items-center justify-center sm:max-w-[720px] md:max-h-[40vh] lg:max-h-none min-h-0 mx-auto rounded-2xl`
              : `relative z-[40] my-auto flex aspect-[60/50] min-w-0 shrink-0 items-center justify-center mx-auto rounded-2xl sm:rounded-3xl`
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
            background: gameTableSurfaceBackground(tableStyle === "nebula_mockup"),
            boxShadow:
              tableStyle === "nebula_mockup"
                ? isMobile
                  ? "0 10px 32px rgba(0,0,0,0.4), 0 0 44px rgba(99,102,241,0.14)"
                  : "0 22px 48px rgba(0,0,0,0.58), 0 0 52px rgba(99,102,241,0.12)"
                : isMobile
                  ? "0 10px 36px rgba(0,0,0,0.52), 0 0 40px rgba(56,189,248,0.12)"
                  : "0 24px 50px rgba(0,0,0,0.88), 0 0 55px rgba(56,189,248,0.1)",
          }}
        >
          {GAME_ROOM_MUSIC_WIDGET_ENABLED && isPcLayout && (
            <div
              className="pointer-events-none absolute left-2 top-2 z-[39] flex flex-col items-center gap-1 rounded-2xl border border-cyan-400/40 bg-slate-950/82 px-2 py-1.5 shadow-[0_8px_26px_rgba(0,0,0,0.48)] backdrop-blur-[3px] sm:left-3 sm:top-3"
              aria-hidden
            >
              <img
                src="/assets/sound.svg"
                alt=""
                className="h-11 w-11 animate-spin rounded-full opacity-95 shadow-[0_4px_14px_rgba(0,0,0,0.45)] [animation-duration:8s] sm:h-12 sm:w-12"
                draggable={false}
              />
              <div className="tech-maintenance-marquee tech-maintenance-marquee--compact w-[6.25rem]">
                <div className="tech-maintenance-marquee__track">Скоро тут будет музыка</div>
              </div>
            </div>
          )}
          {/* Лёгкое внутреннее затемнение по краям, чтобы игроки читались поверх стола */}
          <div
            className={`pointer-events-none absolute rounded-[20px] sm:rounded-[26px] ${isMobile ? "inset-2" : "inset-3"}`}
            style={{
              boxShadow:
                tableStyle === "nebula_mockup"
                  ? "inset 0 0 52px rgba(0,0,0,0.28)"
                  : "inset 0 0 56px rgba(0,0,0,0.52)",
              background:
                tableStyle === "nebula_mockup"
                  ? GAME_TABLE_INNER_VIGNETTE_BG_NEBULA
                  : GAME_TABLE_INNER_VIGNETTE_BG,
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
          {currentUser && !tablePaused && (
            <>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handlePauseGame}
                    className="absolute top-2 right-2 z-[37] inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-300/40 bg-slate-900/85 text-slate-100 shadow-[0_10px_22px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm transition hover:brightness-110 active:scale-95 sm:top-3 sm:right-3 sm:h-10 sm:w-10"
                    aria-label="Поставить игру на паузу"
                  >
                    <span className="text-sm leading-none sm:text-base" aria-hidden>
                      ⏸
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={8}
                  className="border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-100 shadow-xl"
                >
                  Пауза игры
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => void handleChangeTable()}
                    className="absolute bottom-2 right-2 z-[34] inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/45 bg-slate-900/85 text-slate-100 shadow-[0_10px_22px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm transition hover:brightness-110 active:scale-95 sm:bottom-3 sm:right-3 sm:h-10 sm:w-10"
                    aria-label="Сменить стол"
                  >
                    <RotateCw className="h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem]" style={{ color: "#7dd3fc" }} aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  sideOffset={8}
                  className="border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-100 shadow-xl"
                >
                  Сменить стол
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {isPcLayout && (
            <p
              className="pointer-events-none absolute bottom-2 left-2 z-[36] max-w-[min(100%-5rem,20rem)] truncate text-left text-[11px] font-medium leading-tight sm:bottom-3 sm:left-3 sm:text-xs"
              style={{
                color: "rgba(148, 163, 184, 0.98)",
                textShadow: "0 1px 3px rgba(2,6,23,0.95), 0 0 10px rgba(2,6,23,0.7)",
              }}
              title={`${currentRoomName} — ${liveHumanCount}/10`}
            >
              {currentRoomName}{" "}
              <span className="tabular-nums text-cyan-300/85">{liveHumanCount}/10</span>
            </p>
          )}

          {/* ---- PLAYERS around the circle ---- */}
          <GameBoardPlayers
            players={players}
            positions={positions}
            currentUser={currentUser}
            currentTurnPlayer={currentTurnPlayer}
            targetPlayer={targetPlayer}
            targetPlayer2={targetPlayer2}
            predictionTarget={predictionTarget}
            predictionTarget2={predictionTarget2}
            predictionPhase={predictionPhase}
            predictionMade={predictionMade}
            isSpinning={isSpinning}
            showResult={showResult}
            isMobile={isMobile}
            manyPlayersOnMobile={manyPlayersOnMobile}
            avatarFrames={avatarFrames as Record<string, string> | undefined}
            avatarFrameMetaByPlayerId={avatarFrameMetaByPlayerId}
            rosesGiven={rosesGiven}
            spinSkips={spinSkips as Record<string, number> | undefined}
            clientTabAway={clientTabAway}
            playerInUgadaika={playerInUgadaika}
            steamFogTick={steamFogTick}
            avatarSteamFog={avatarSteamFog}
            steamPuffs={steamPuffs}
            onPlayerClick={handlePlayerClick}
            getKissCountForPlayer={getKissCountForPlayer}
            getGiftsForPlayer={getGiftsForPlayer}
            getBigGiftSequenceForPlayer={getBigGiftSequenceForPlayer}
            giftDisplayById={giftDisplayById}
            roomCreatorPlayerId={roomCreatorPlayerId}
            catalogGiftAvatarHold={catalogGiftAvatarHold}
          />

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

          {/* ---- BOTTLE in the centre / pair-kiss choice card ---- */}
          {bottleShouldRender ? (
            <div className="pointer-events-none absolute inset-0 z-20">
              <BottleCenter
                measureRef={bottleMeasureRef}
                bottleAngle={bottleAngle}
                isSpinning={isSpinning}
                bottleSkin={effectiveBottleSkin as any}
                bottleImageUrl={bottleImageOnTable}
                isDrunk={isCurrentTurnDrunk}
                playerCount={players.length}
                isMobile={isMobile}
                isMyTurn={isMyTurn}
                showResult={showResult}
                pairKissCenterUi={pairKissCenterUi}
                countdown={countdown}
                turnTimer={turnTimer}
                predictionPhase={predictionPhase}
                predictionTimer={predictionTimer}
                predictionMade={predictionMade}
                predictionTarget={predictionTarget}
                predictionTarget2={predictionTarget2}
                casualMode={CASUAL_MODE}
                onSpin={handleSpin}
              />
            </div>
          ) : null}
          {!pairKissCenterUi && turnArrowVisible && turnArrowPosPx && (turnArrowAngleDegPx ?? turnArrowAngleDeg) != null && (
            <div
              className="pointer-events-none absolute z-[33]"
              style={{
                left: turnArrowPosPx.x,
                top: turnArrowPosPx.y,
                transform: `translate(-50%, -50%) rotate(${(turnArrowAngleDegPx ?? turnArrowAngleDeg)!}deg)`,
                transformOrigin: "center center",
                transition:
                  turnArrowTransitionMs > 0
                    ? `left ${turnArrowTransitionMs}ms ease-out, top ${turnArrowTransitionMs}ms ease-out`
                    : "none",
              }}
              aria-hidden
            >
              <img
                src={turnArrowAssetUrl}
                alt=""
                className={cn(
                  "opacity-95 drop-shadow-[0_0_8px_rgba(255,255,255,0.45)]",
                  isMyTurn && "drop-shadow-[0_0_14px_rgba(34,211,238,0.7)]",
                )}
                style={{ width: turnArrowSizePx, height: turnArrowSizePx }}
                draggable={false}
              />
            </div>
          )}
          {pairKissPhase && pairKissModalPlayers ? (
            <div
              className={cn(
                "pointer-events-none absolute left-1/2 top-1/2 z-[42] flex max-h-[min(92dvh,100%)] w-[min(280px,calc(100%-2rem))] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 items-center justify-center md:w-[min(300px,calc(100%-3rem))] md:max-w-[calc(100%-3rem)]",
              )}
            >
              {/* Круг + свечение: общая анимация появления / ухода */}
              <div
                className={cn(
                  "relative isolate flex w-full max-w-full min-h-0 shrink-0 flex-col items-center justify-center overflow-visible rounded-full border border-cyan-200/20 bg-gradient-to-b from-slate-900/65 via-slate-900/55 to-slate-950/65 px-2 py-3 shadow-[0_0_20px_rgba(34,211,238,0.45),0_0_44px_rgba(56,189,248,0.22)] backdrop-blur-md aspect-square",
                  pairKissPhase.resolved ? "pointer-events-none pair-kiss-card-exit" : "pointer-events-auto pair-kiss-card-enter",
                )}
                style={
                  pairKissPhase.resolved
                    ? ({
                        "--pair-kiss-exit-delay": `${PAIR_KISS_EXIT_PAUSE_AFTER_RESOLVED_MS}ms`,
                      } as React.CSSProperties)
                    : undefined
                }
              >
              <div className="w-full px-1.5 py-0.5 md:px-2 md:py-1">
                <div className="mb-1.5 flex items-center justify-center">
                  <h3
                    className="text-[1.15rem] font-extrabold leading-none text-white md:text-[1.3rem]"
                    style={{ textShadow: "0 2px 10px rgba(0,0,0,0.55)" }}
                  >
                    Поцелуются?
                  </h3>
                </div>
                <div className="mb-2 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-white md:text-sm" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.45)" }}>
                    {`${pairKissPhase.resolved ? 0 : liveSec} сек`}
                  </span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/45 md:w-28">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-lime-300 to-emerald-400 transition-[width] duration-100 ease-linear"
                      style={{ width: `${pairKissBarProgress * 100}%` }}
                    />
                  </div>
                </div>

                <div className="relative grid grid-cols-2 gap-2 md:gap-2.5">
                  <div
                    className={cn(
                      "pointer-events-none absolute left-1/2 top-4.5 z-20 flex -translate-x-1/2 items-center -space-x-1 md:top-5 md:-space-x-1.5",
                      pairKissBothYes && "pair-kiss-heart-pulse-3s",
                    )}
                    aria-hidden
                  >
                    {pairKissBothYes && (
                      <>
                        <span className="pair-kiss-wave pair-kiss-wave-a" />
                        <span className="pair-kiss-wave pair-kiss-wave-b" />
                        <span className="pair-kiss-firework-heart pair-kiss-firework-heart-1">💖</span>
                        <span className="pair-kiss-firework-heart pair-kiss-firework-heart-2">💗</span>
                        <span className="pair-kiss-firework-heart pair-kiss-firework-heart-3">💘</span>
                        <span className="pair-kiss-firework-heart pair-kiss-firework-heart-4">💕</span>
                        <span className="pair-kiss-firework-heart pair-kiss-firework-heart-5">💞</span>
                        <span className="pair-kiss-firework-heart pair-kiss-firework-heart-6">💓</span>
                        <span className="pair-kiss-firework-heart pair-kiss-firework-heart-7">💝</span>
                        <span className="pair-kiss-firework-heart pair-kiss-firework-heart-8">💟</span>
                      </>
                    )}
                    <div style={{ width: 24, height: 36, color: pairKissPhase.choiceA === false ? "#0b0b0b" : "#FF223C" }}>
                      <svg viewBox="0 0 193 311" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M153.75 200.738L192.188 136.675L147.344 79.0191L165.538 24.4379C86.8047 -29.759 0 10.216 0 104.644C0 187.093 119.989 277.677 167.075 310.028L192.188 264.8L153.75 200.738Z" fill="currentColor"/>
                      </svg>
                    </div>
                    <div style={{ width: 24, height: 36, color: pairKissPhase.choiceB === false ? "#0b0b0b" : "#FF223C" }}>
                      <svg viewBox="0 0 199 323" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.8125 40.6167L0 79.0542L44.8438 136.71L6.40625 200.773L44.8438 264.835L12.8125 322.492C12.8125 322.492 198.594 207.307 198.594 104.679C198.594 2.05109 96.0938 -36.2583 12.8125 40.6167Z" fill="currentColor"/>
                      </svg>
                    </div>
                  </div>
                  {[pairKissModalPlayers.pa, pairKissModalPlayers.pb].map((player) => {
                    const isA = player.id === pairKissPhase.idA
                    const choice = isA ? pairKissPhase.choiceA : pairKissPhase.choiceB
                    const choiceText =
                      choice === null && !pairKissPhase.resolved
                        ? "Ожидаем..."
                        : choice === true
                          ? "Да"
                          : choice === false
                            ? "Нет"
                            : "—"
                    const choiceColor =
                      choice === true
                        ? "text-lime-300"
                        : choice === false
                          ? "text-rose-300"
                          : "text-slate-300"
                    return (
                      <div key={player.id} className="flex flex-col items-center">
                        <div className="relative h-[3.25rem] w-[3.25rem] md:h-[3.75rem] md:w-[3.75rem]">
                          <div className="h-full w-full overflow-hidden rounded-2xl border border-white/35 bg-slate-100 shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
                            <img src={player.avatar} alt={player.name} className="h-full w-full object-cover" />
                          </div>
                        </div>
                        <p
                          className="mt-1 max-w-[5.75rem] truncate text-center text-[0.78rem] font-extrabold leading-none text-white md:max-w-[6.25rem] md:text-[0.85rem]"
                          style={{ textShadow: "0 2px 10px rgba(0,0,0,0.55)" }}
                        >
                          {player.name}
                        </p>
                        <p className={`mt-0.5 text-[11px] font-bold md:text-xs ${choiceColor}`}>{choiceText}</p>
                      </div>
                    )
                  })}
                </div>

                {pairKissCanPick ? (
                  <div className="mt-2.5 grid grid-cols-2 gap-1.5 md:gap-2">
                    <button
                      type="button"
                      onClick={() => onPairKissPick(pairKissMyPlayerId!, false)}
                      className="h-8 rounded-lg bg-[#ff2b0a] text-base font-extrabold text-white shadow-[0_2px_0_#a61b08] transition-transform hover:brightness-110 active:scale-[0.98] md:h-9 md:text-lg"
                    >
                      Нет
                    </button>
                    <button
                      type="button"
                      onClick={() => onPairKissPick(pairKissMyPlayerId!, true)}
                      className="h-8 rounded-lg bg-[#8ad400] text-base font-extrabold text-white shadow-[0_2px_0_#4d7c0f] transition-transform hover:brightness-110 active:scale-[0.98] md:h-9 md:text-lg"
                    >
                      Да
                    </button>
                  </div>
                ) : null}
                <div
                  className="mt-2.5 flex min-h-[2.75rem] flex-col items-center justify-center px-0.5"
                  aria-live="polite"
                >
                  <p
                    className="text-center text-[11px] font-semibold leading-snug text-slate-100 md:text-xs"
                    style={{ textShadow: "0 1px 7px rgba(0,0,0,0.45)" }}
                  >
                    {pairKissBothAnswered ? "Игроки сделали свой выбор" : "Выбор"}
                  </p>
                </div>
                {pairKissPhase.resolved && (
                  <div className="pair-kiss-exit-particles" aria-hidden>
                    <span className="pair-kiss-exit-particle pair-kiss-exit-particle-1" />
                    <span className="pair-kiss-exit-particle pair-kiss-exit-particle-2" />
                    <span className="pair-kiss-exit-particle pair-kiss-exit-particle-3" />
                    <span className="pair-kiss-exit-particle pair-kiss-exit-particle-4" />
                    <span className="pair-kiss-exit-particle pair-kiss-exit-particle-5" />
                    <span className="pair-kiss-exit-particle pair-kiss-exit-particle-6" />
                    <span className="pair-kiss-exit-particle pair-kiss-exit-particle-7" />
                    <span className="pair-kiss-exit-particle pair-kiss-exit-particle-8" />
                  </div>
                )}
              </div>
              </div>
            </div>
          ) : null}
          {nextKissAnnouncementActive && nextKissAnnouncementPlayer ? (
            <div className="absolute left-1/2 top-1/2 z-[42] flex w-[min(320px,calc(100%-2rem))] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-2xl border border-cyan-300/45 bg-slate-950/92 px-4 py-4 text-center shadow-[0_0_28px_rgba(34,211,238,0.25)] backdrop-blur-sm">
              <p className="text-base font-extrabold leading-tight text-slate-50">
                {currentUser?.id === nextKissAnnouncementPlayer.id
                  ? `Вы целуетесь ${nextKissForms(nextKissAnnouncementPlayer.gender).youWord}`
                  : `${nextKissForms(nextKissAnnouncementPlayer.gender).nextWord} целуется — ${nextKissAnnouncementPlayer.name}`}
              </p>
              <p className="text-sm font-bold text-cyan-200">
                {nextKissAnnouncementSeconds} сек
              </p>
              {currentUser && (
                <button
                  type="button"
                  onClick={handleExtraSpin}
                  disabled={voiceBalance < EXTRA_SPIN_COST}
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                  style={{
                    background: "linear-gradient(180deg, #9b59b6 0%, #8e44ad 100%)",
                    color: "#fff",
                    border: "2px solid #7d3c98",
                    boxShadow: "0 2px 0 #5b2c6f",
                  }}
                >
                  <RotateCw className="h-4 w-4 shrink-0" />
                  {`Крутить вне очереди (${EXTRA_SPIN_COST})`}
                </button>
              )}
            </div>
          ) : null}

        </div>

        </div>
        {/* Закрыли flex-1 justify-center обёртку стола — тикер и чат ниже, стол по центру */}

        <div
          className="sticky bottom-0 z-40 mx-auto w-full shrink-0 px-1 pb-1"
          style={
            isMobile
              ? {
                  width: "min(90vw, 420px)",
                  maxWidth: "min(90vw, 420px)",
                }
              : {
                  width: "min(90%, min(100%, calc(min(72vh, 78dvh) * 60 / 50)))",
                  maxWidth: "100%",
                }
          }
        >
          <GameStatusTicker
            showAnnouncementCta={!!currentUser}
            onOpenAnnouncement={currentUser ? () => setTickerAnnouncementOpen(true) : undefined}
          />
        </div>

        {!isPcLayout && (
          <div
            className="mx-auto mt-[56px] mb-1 flex min-h-0 w-full max-w-[min(95vw,720px)] shrink-0 flex-col overflow-hidden rounded-xl"
            style={{
              height: "min(52vh, 480px)",
              maxHeight: "min(52vh, 480px)",
              minHeight: "190px",
            }}
          >
            <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
              <TableChatPanel
                gameLog={gameLog}
                players={players}
                bottleCatalogRows={bottleCatalogRows}
                giftDisplayById={giftDisplayById}
                chatInput={chatInput}
                setChatInput={setChatInput}
                onSend={handleSendChat}
                logEndRef={logEndRef}
                currentUserId={currentUser?.id}
                currentUserIsVip={tableChatEmojiVipActive}
                chatDisabled={tablePaused}
                onBecomeVip={openShopForVipFromChat}
                onJoinPlayerHello={handleJoinPlayerHello}
                onChatMenuAction={handleChatAvatarMenuAction}
                className="flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden"
              />
            </div>
          </div>
        )}

      </div>

      </div>

      {/* ---- RIGHT PANEL: резиновая ширина (чем шире экран, тем шире чат) ---- */}
      <div
        className={cn(
          "relative z-20 flex min-h-0 flex-row border-l border-cyan-400/20 bg-gradient-to-b from-slate-900/55 to-slate-950/65",
          isPcLayout ? "" : "hidden md:flex",
          isPcLayout
            ? chatPanelCollapsed
              ? "w-auto shrink-0 flex-none"
              : "w-[402px] shrink-0 flex-none"
            : chatPanelCollapsed
              ? "w-auto shrink-0 flex-none"
              : "w-[clamp(200px,30vw,380px)] shrink-0 flex-none",
        )}
      >
        {chatPanelCollapsed ? (
          <button
            type="button"
            onClick={() => setChatPanelCollapsed(false)}
            className="flex w-14 shrink-0 flex-col items-center justify-start gap-2 self-stretch rounded-l-xl px-2 pt-1.5 pb-2 transition-colors hover:bg-slate-800/60"
            style={{ borderRight: "1px solid rgba(71, 85, 105, 0.5)" }}
            aria-label="Развернуть чат"
          >
            <MessageCircle className="h-5 w-5 shrink-0" style={{ color: "#e8c06a" }} />
            <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        ) : (
          <div className="flex min-h-0 min-w-0 w-[350px] shrink-0 flex-none flex-col overflow-hidden px-2 pb-2 pt-1.5">
            <button
              type="button"
              onClick={() => setChatPanelCollapsed(true)}
              className="mb-1.5 mt-[65px] flex shrink-0 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
              aria-label="Свернуть панель"
            >
              <span className="text-left text-[11px] font-semibold tracking-wide text-slate-400">
                Свернуть панель
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            </button>
            <div className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <TableChatPanel
                gameLog={gameLog}
                players={players}
                bottleCatalogRows={bottleCatalogRows}
                giftDisplayById={giftDisplayById}
                chatInput={chatInput}
                setChatInput={setChatInput}
                onSend={handleSendChat}
                logEndRef={logEndRef}
                currentUserId={currentUser?.id}
                currentUserIsVip={tableChatEmojiVipActive}
                chatDisabled={tablePaused}
                onBecomeVip={openShopForVipFromChat}
                onJoinPlayerHello={handleJoinPlayerHello}
                onChatMenuAction={handleChatAvatarMenuAction}
                className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
              />
            </div>
          </div>
        )}

        {/* Статичная полоса мини-игр на всю высоту (не сворачивается вместе с чатом) */}
        <aside
          className="flex w-[52px] shrink-0 flex-col items-stretch self-stretch border-l border-cyan-400/20 bg-slate-950/50 py-2"
          style={{ boxShadow: "inset 1px 0 0 rgba(255,255,255,0.04)" }}
          aria-label="Мини-игры"
        >
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-contain px-1.5">
            <p className="pointer-events-none shrink-0 px-1 pb-2 text-center text-[8px] font-bold uppercase leading-tight tracking-wide text-slate-500">
              Игры
            </p>
            <div className="flex shrink-0 flex-col items-center gap-2">
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "SET_SCREEN", screen: "ugadaika" })}
                    className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-fuchsia-400/45 bg-fuchsia-900/25 transition-all hover:scale-105 hover:border-fuchsia-300/55 active:scale-95"
                    aria-label="Открыть мини-игру Угадай-ка"
                  >
                    <img src={assetUrl("Frame 1171276192.webp")} alt="" className="size-[1.85rem] object-contain" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  sideOffset={8}
                  className="max-w-[14rem] border border-fuchsia-500/35 bg-slate-950 px-3 py-2 text-left text-xs font-medium leading-snug text-slate-100 shadow-xl"
                >
                  <span className="font-semibold text-fuchsia-200">Угадай-ка</span>
                  {" — "}
                  мини-игра со слотами: угадывайте пары и крутите барабан за столом.
                </TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span className="inline-flex shrink-0">
                    <button
                      type="button"
                      disabled={!FORTUNE_WHEEL_ENABLED}
                      onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "fortune-wheel" })}
                      className="flex size-10 items-center justify-center rounded-md border border-cyan-400/45 bg-cyan-900/20 text-lg transition-all hover:scale-105 hover:border-cyan-300/55 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                      aria-label="Открыть мини-игру Колесо фортуны"
                    >
                      <span aria-hidden>{"🎡"}</span>
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  sideOffset={8}
                  className="max-w-[14rem] border border-cyan-500/35 bg-slate-950 px-3 py-2 text-left text-xs font-medium leading-snug text-slate-100 shadow-xl"
                >
                  {FORTUNE_WHEEL_ENABLED ? (
                    <>
                      <span className="font-semibold text-cyan-200">Колесо фортуны</span>
                      {" — "}
                      крутите колесо и выигрывайте призы за столом.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-cyan-200/80">Колесо фортуны</span>
                      {" — "}
                      скоро появится в комнате.
                    </>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="min-h-2 shrink-0" aria-hidden />
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setVkGroupNewsOpen(true)}
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-md border-2 border-amber-400/55 bg-amber-950/50 text-amber-100 transition-all hover:scale-110 hover:border-amber-300/75 hover:bg-amber-900/40 active:scale-95",
                    !vkBellIdle && "animate-game-room-bell",
                  )}
                  aria-label="Новости: группа ВК — нажмите"
                >
                  <span className={cn("text-amber-200", !vkBellIdle && "animate-game-room-bell-icon")}>
                    <Bell className="size-[1.35rem]" strokeWidth={2.5} aria-hidden />
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                sideOffset={8}
                className="max-w-[14rem] border border-amber-500/35 bg-slate-950 px-3 py-2 text-left text-xs font-medium leading-snug text-slate-100 shadow-xl"
              >
                Нажми на меня — откроется группа ВК с новостями.
              </TooltipContent>
            </Tooltip>
          </div>
        </aside>
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
                    <Heart className="bank-heart-beat h-5 w-5 shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]" style={{ color: "#fde68a" }} fill="currentColor" />
                    <BankHeartBalanceTooltip
                      voiceBalance={voiceBalance}
                      msUntilNext={msUntilNextBank}
                      activeBonus={bankActiveBonusTooltip}
                      onOpenShop={() => {
                        dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })
                        setShowMobileMoreMenu(false)
                      }}
                      className="inline-flex shrink-0 items-baseline"
                      tabularClassName="text-base font-black tabular-nums text-white"
                    />
                    <span className="min-w-0 truncate text-xs" style={{ color: "#cbd5e1" }}>
                      Ваш банк
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <VkBankRewardVideoButton onNotify={showToast} />
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
                </div>
                <button
                  type="button"
                  onClick={() => { setShowBottleCatalog(true); setShowMobileMoreMenu(false) }}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="animate-game-room-bottle-icon select-none text-xl leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
                      style={{ lineHeight: 1 }}
                      aria-hidden
                    >
                      🍾
                    </span>
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
                  onClick={() => { dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "favorites" }); setShowMobileMoreMenu(false) }}
                  className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: "#f0e0c8" }}
                >
                  <Star className="h-4 w-4 shrink-0" />
                  Избранное
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
                  {currentRoomName}{" "}
                  <span className="tabular-nums text-cyan-300/70">{liveHumanCount}/10</span>
                </div>
                {!isMyTurn && !isSpinning && !showResult && countdown === null && (
                  <button
                    type="button"
                    onClick={() => {
                      handleExtraSpin()
                      setShowMobileMoreMenu(false)
                    }}
                    disabled={voiceBalance < EXTRA_SPIN_COST}
                    className="mx-2 mb-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
                    style={{
                      background: "linear-gradient(180deg, #9b59b6 0%, #8e44ad 100%)",
                      color: "#fff",
                      border: "2px solid #7d3c98",
                      boxShadow: "0 2px 0 #5b2c6f",
                    }}
                  >
                    <RotateCw className="h-4 w-4 shrink-0" />
                    {`Крутить вне очереди (${EXTRA_SPIN_COST} ❤)`}
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
                    <div className="h-6 w-6 rounded-full overflow-hidden" style={{ border: "1.5px solid #475569", background: "#1e293b" }}>
                      <img
                        src={p.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => tableChatPlayerAvatarOnError(e, p)}
                      />
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
        const ZODIAC_SYMBOLS = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"]
        const zodiacIdxFromName =
          typeof playerMenuTarget.zodiac === "string" ? Math.max(0, ZODIAC_SIGNS.indexOf(playerMenuTarget.zodiac)) : -1
        const zodiacIdx = zodiacIdxFromName >= 0 ? zodiacIdxFromName : playerMenuTarget.id % 12
        const zodiacDisplay = ZODIAC_SIGNS[zodiacIdx]
        const zodiacSymbol = ZODIAC_SYMBOLS[zodiacIdx]
        const targetAcceptsInvitesInProfile = effectiveOpenToChatInvites(playerMenuTarget, allowChatInvite)
        const profileMenuStats = computePlayerMenuProfileStats({
          inventory,
          rosesGiven,
          gameLog,
          userId: playerMenuTarget.id,
        })
        return (
        <GameSidePanelShell
          title="Профиль игрока"
          onClose={() => dispatch({ type: "CLOSE_PLAYER_MENU" })}
          variant="material"
          overlayClassName="bg-black/65"
          contentClassName="relative min-h-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-[15px] sm:px-4 sm:pb-5 sm:pt-3"
        >
          <>
            <div className="relative min-h-0">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(56,189,248,0.12)_0%,transparent_55%)]"
                aria-hidden
              />
              <div className="relative z-[1] flex min-w-0 flex-col gap-5">
              {/* Профиль и действия — одна вертикальная колонка (боковая панель справа) */}
              <div
                className="player-menu-left w-full shrink-0 overflow-hidden rounded-3xl border border-slate-200/85 bg-gradient-to-b from-white to-slate-50 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.85)]"
              >
                <div className="relative flex flex-col items-center">
                  <div
                    className="pointer-events-none absolute left-1/2 top-[52px] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80"
                    style={{
                      background: "radial-gradient(circle, rgba(56, 189, 248, 0.18) 0%, rgba(167, 139, 250, 0.08) 48%, transparent 72%)",
                    }}
                    aria-hidden
                  />
                  {(() => {
                    const menuFrameId = avatarFrames?.[playerMenuTarget.id] || "none"
                    const menuFrameMeta = frameMetaById.get(menuFrameId)
                      ?? (() => {
                        const row = frameCatalogRows.find((r) => r.id === menuFrameId)
                        return row ? { border: row.border, shadow: row.shadow, svgPath: row.svgPath || undefined } : undefined
                      })()
                    return (
                  <div
                    ref={playerMenuAvatarRef}
                    className="relative z-[1] rounded-full"
                  >
                    <PlayerAvatar
                      player={playerMenuTarget}
                      frameId={menuFrameId}
                      frameBorder={menuFrameMeta?.border}
                      frameShadow={menuFrameMeta?.shadow}
                      frameSvgPath={menuFrameMeta?.svgPath}
                      size={isMobile ? 100 : 128}
                    />
                  </div>
                    )
                  })()}
                  <h2 className="relative z-[1] mt-3 max-w-full px-1 text-center text-xl font-black leading-tight tracking-tight text-slate-900 sm:text-2xl">
                    {playerMenuTarget.name}
                  </h2>
                  <div className="relative z-[1] mt-3 w-full min-w-0 px-0">
                    <div className="rounded-3xl border border-slate-200/85 bg-gradient-to-b from-white to-slate-50 p-2 shadow-[0_10px_26px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.85)]">
                    <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setPlayerMenuTab("profile")}
                        className={`rounded-xl px-2 py-2 text-[13px] font-black transition sm:px-3 sm:text-[15px] ${
                          playerMenuTab === "profile" ? "bg-white text-slate-900 shadow" : "text-slate-600 hover:bg-white/70"
                        }`}
                        aria-pressed={playerMenuTab === "profile"}
                      >
                        Профиль
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlayerMenuTab("gifts")}
                        className={`rounded-xl px-2 py-2 text-[13px] font-black transition sm:px-3 sm:text-[15px] ${
                          playerMenuTab === "gifts" ? "bg-white text-slate-900 shadow" : "text-slate-600 hover:bg-white/70"
                        }`}
                        aria-pressed={playerMenuTab === "gifts"}
                      >
                        Подарки
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlayerMenuTab("frame")}
                        className={`rounded-xl px-2 py-2 text-[13px] font-black transition sm:px-3 sm:text-[15px] ${
                          playerMenuTab === "frame" ? "bg-white text-slate-900 shadow" : "text-slate-600 hover:bg-white/70"
                        }`}
                        aria-pressed={playerMenuTab === "frame"}
                      >
                        Рамка
                      </button>
                    </div>
                    </div>
                  </div>
                  <div
                    className="relative z-[1] mt-3 w-full min-w-0 overflow-hidden rounded-2xl border border-sky-400/30 px-2 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_20px_rgba(14,165,233,0.2)] sm:px-3 sm:py-3.5"
                    style={{
                      background:
                        "linear-gradient(155deg, rgba(125, 211, 252, 0.98) 0%, rgba(56, 189, 248, 0.88) 42%, rgba(14, 165, 233, 0.82) 100%)",
                    }}
                    aria-label="Статистика игрока за столом"
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.4]"
                      aria-hidden
                      style={{
                        backgroundImage: `radial-gradient(circle at 18% 28%, rgba(255,255,255,0.5) 0%, transparent 42%),
                          radial-gradient(circle at 82% 72%, rgba(255,255,255,0.22) 0%, transparent 38%),
                          radial-gradient(circle at 50% 55%, rgba(255,255,255,0.12) 0%, transparent 55%)`,
                      }}
                    />
                    <div className="relative grid grid-cols-3 gap-1.5 text-center sm:gap-2">
                      <div className="flex min-w-0 flex-col items-center gap-1">
                        <span className="text-[1.65rem] leading-none drop-shadow-sm sm:text-[1.85rem]" aria-hidden>
                          💋
                        </span>
                        <span className="text-[15px] font-black tabular-nums leading-none text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.35)]">
                          {profileMenuStats.kisses}
                        </span>
                        <span className="text-[14px] font-semibold leading-tight text-sky-950/85">Поцелуи</span>
                      </div>
                      <div className="flex min-w-0 flex-col items-center gap-1">
                        <span className="text-[1.65rem] leading-none drop-shadow-sm sm:text-[1.85rem]" aria-hidden>
                          🎁
                        </span>
                        <span className="text-[15px] font-black tabular-nums leading-none text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.35)]">
                          {profileMenuStats.gifts}
                        </span>
                        <span className="text-[14px] font-semibold leading-tight text-sky-950/85">Подарки</span>
                      </div>
                      <div className="flex min-w-0 flex-col items-center gap-1">
                        <span className="text-[1.65rem] leading-none drop-shadow-sm sm:text-[1.85rem]" aria-hidden>
                          🌹
                        </span>
                        <span className="text-[15px] font-black tabular-nums leading-none text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.35)]">
                          {profileMenuStats.roses}
                        </span>
                        <span className="text-[14px] font-semibold leading-tight text-sky-950/85">Розы</span>
                      </div>
                    </div>
                  </div>
                  {playerMenuTab === "profile" && (
                    <>
                      {currentUser && currentUser.id !== playerMenuTarget.id && !playerMenuTarget.isBot && (
                        <div className="relative z-[1] mt-3 grid w-full min-w-0 grid-cols-[1fr_auto] gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!currentUser) return
                              if (!targetAcceptsInvitesInProfile) {
                                dispatch({
                                  type: "ADD_LOG",
                                  entry: {
                                    id: generateLogId(),
                                    type: "chat_request",
                                    fromPlayer: currentUser,
                                    toPlayer: playerMenuTarget,
                                    text: `С тобой хочет общаться ${currentUser.name}`,
                                    timestamp: Date.now(),
                                  },
                                })
                                showToast("Запрос на общение отправлен", "success")
                                dispatch({ type: "CLOSE_PLAYER_MENU" })
                                return
                              }
                              dispatch({ type: "OPEN_SIDE_CHAT", player: playerMenuTarget })
                              dispatch({ type: "CLOSE_PLAYER_MENU" })
                            }}
                            className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-2xl border border-cyan-300/60 bg-gradient-to-b from-cyan-100 to-cyan-50 px-3 text-[15px] font-black text-cyan-950 shadow-[0_6px_14px_rgba(15,23,42,0.10)] transition-all hover:brightness-[1.02]"
                          >
                            Написать
                          </button>
                          <button
                            type="button"
                            onClick={() => setCareOfferOpen(true)}
                            className="inline-flex h-11 w-12 items-center justify-center rounded-2xl border border-fuchsia-300/65 bg-gradient-to-b from-fuchsia-100 to-violet-50 text-xl shadow-[0_6px_14px_rgba(15,23,42,0.10)] transition-all hover:brightness-[1.02]"
                            aria-label="Начать ухаживать"
                          >
                            💍
                          </button>
                        </div>
                      )}
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
                                if (!currentUser) return
                                dispatch({
                                  type: "ADD_LOG",
                                  entry: {
                                    id: generateLogId(),
                                    type: "care",
                                    fromPlayer: currentUser,
                                    toPlayer: playerMenuTarget,
                                    text: `${currentUser.name} стал(а) поклонником игрока ${playerMenuTarget.name}`,
                                    timestamp: Date.now(),
                                  } as GameLogEntry,
                                })
                                showToast("Отправлено — игрок увидит вас в списке поклонников", "success")
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
                    </>
                  )}
                </div>
                {playerMenuTab === "profile" && (
                  <div className="mt-4 border-t border-slate-200 pt-3">
                    <p className="mb-2.5 text-[15px] font-black tracking-tight text-slate-900">Анкета</p>
                    <ul className="space-y-2.5 text-left text-[15px] font-medium text-slate-700">
                      <li className="flex items-baseline gap-2.5 border-b border-slate-200 pb-2.5">
                        <User className="mt-0.5 h-6 w-6 shrink-0 text-slate-500" strokeWidth={2.25} aria-hidden />
                        <span className="min-w-0 font-semibold text-slate-900">
                          {playerMenuTarget.gender === "male" ? "М" : "Ж"}, {playerMenuTarget.age} лет
                        </span>
                      </li>
                      {playerMenuTarget.city && (
                        <li className="flex items-start gap-2.5 border-b border-slate-200 pb-2.5">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-slate-500" aria-hidden>
                            <span className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-200" />
                          </span>
                          <span className="min-w-0 leading-snug">{playerMenuTarget.city}</span>
                        </li>
                      )}
                      {playerMenuTarget.interests && (
                        <li className="flex items-start gap-2.5 border-b border-slate-200 pb-2.5">
                          <Target className="mt-0.5 h-6 w-6 shrink-0 text-slate-500" strokeWidth={2.25} aria-hidden />
                          <span className="min-w-0 leading-snug">{playerMenuTarget.interests}</span>
                        </li>
                      )}
                      <li className="flex items-center gap-2.5 pt-0.5 text-fuchsia-700">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-100 to-violet-100 text-[18px] font-black text-fuchsia-700 shadow-[0_10px_18px_rgba(236,72,153,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
                          aria-hidden
                        >
                          {zodiacSymbol}
                        </span>
                        <span className="font-semibold">{zodiacDisplay}</span>
                      </li>
                    </ul>
                  </div>
                )}
                {playerMenuTab === "gifts" && (
                  <div className="mt-4 min-h-0 w-full min-w-0 border-t border-slate-200 pt-3">
                    <ProfileReceivedGiftsSection
                      targetUserId={playerMenuTarget.id}
                      inventory={inventory}
                      rosesGiven={rosesGiven}
                      catalogRows={giftCatalogSource}
                      perspective="other"
                      className="rounded-2xl border border-slate-200/85 bg-gradient-to-b from-white to-slate-50 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:px-4 sm:py-4"
                    />
                  </div>
                )}
                {playerMenuTab === "frame" && (
                  <div className="mt-4 flex max-h-[min(60vh,28rem)] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-600/40 shadow-xl">
                    <div
                      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4"
                      style={{ background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)" }}
                    >
                      <p className="shrink-0 text-center text-[16px] font-bold text-slate-100">Подарить рамку</p>
                      <p className="text-[13px] font-semibold text-slate-300">Бесплатные</p>
                      <div className="grid grid-cols-4 gap-2 sm:gap-3">
                        {giftableFramesFree.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setSelectedFrameForGift(f.id)}
                            className={`flex flex-col items-center gap-1.5 rounded-xl py-2 transition-colors hover:bg-slate-600/50 ${selectedFrameForGift === f.id ? "bg-slate-600/50 ring-2 ring-sky-400" : ""}`}
                          >
                            <div className="relative h-12 w-12 flex-shrink-0 sm:h-14 sm:w-14">
                              <div className="h-full w-full overflow-hidden rounded-full bg-slate-700" style={{ border: f.border, boxShadow: f.shadow, padding: 2 }} />
                              {f.svgPath && (
                                <img src={resolveFrameCatalogAssetUrl(f.svgPath)} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" aria-hidden />
                              )}
                            </div>
                            <span className="text-[10px] leading-tight text-slate-300 text-center">{f.label}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[13px] font-semibold text-amber-200">Доступно / VIP — цены из каталога</p>
                      <div className="grid grid-cols-4 gap-2 sm:gap-3">
                        {giftableFramesPremium.map((f) => {
                          const canAfford = voiceBalance >= f.cost
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setSelectedFrameForGift(f.id)}
                              disabled={!canAfford}
                              className={`flex flex-col items-center gap-1.5 rounded-xl py-2 transition-colors hover:bg-slate-600/50 disabled:cursor-not-allowed disabled:opacity-50 ${selectedFrameForGift === f.id ? "bg-slate-600/50 ring-2 ring-amber-400" : ""}`}
                            >
                              <div className="relative h-12 w-12 flex-shrink-0 sm:h-14 sm:w-14">
                                <div className="h-full w-full overflow-hidden rounded-full bg-slate-700" style={{ border: f.border, boxShadow: f.shadow, padding: 2 }} />
                                {f.svgPath && (
                                  <img src={resolveFrameCatalogAssetUrl(f.svgPath)} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" aria-hidden />
                                )}
                              </div>
                              <span className="text-[10px] leading-tight text-slate-300 text-center">{f.label}</span>
                              <span className="text-[10px] font-medium text-amber-400">{f.cost} ❤</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="shrink-0 border-t border-slate-600/50 bg-slate-900/95 p-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentUser) return
                          if (selectedFrameForGift == null) {
                            showToast("Выберите рамку", "info")
                            return
                          }
                          const frameId = selectedFrameForGift
                          const cost = giftableFrameById.get(frameId)?.cost ?? 0
                          if (cost > 0 && voiceBalance < cost) {
                            showToast("Недостаточно сердец для рамки", "error")
                            return
                          }
                          if (cost > 0) dispatch({ type: "PAY_VOICES", amount: cost })
                          dispatch({ type: "SET_AVATAR_FRAME", playerId: playerMenuTarget.id, frameId })
                          const frameName =
                            frameCatalogSource.find((r) => r.id === frameId)?.name?.trim() || frameId
                          dispatch({
                            type: "ADD_LOG",
                            entry: {
                              id: generateLogId(),
                              type: "system",
                              fromPlayer: currentUser,
                              toPlayer: playerMenuTarget,
                              frameGift: { frameId, frameName },
                              text: `${currentUser.name} подарил(а) рамку «${frameName}» игроку ${playerMenuTarget.name}`,
                              timestamp: Date.now(),
                            },
                          })
                          setSelectedFrameForGift(null)
                          setPlayerMenuTab("profile")
                          showToast("Рамка подарена", "success")
                        }}
                        disabled={
                          selectedFrameForGift == null ||
                          (selectedFrameForGift != null &&
                            (giftableFrameById.get(selectedFrameForGift)?.cost ?? 0) > voiceBalance)
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-bold transition-all disabled:opacity-40"
                        style={{
                          background: "linear-gradient(180deg, #e8c06a 0%, #c4943a 100%)",
                          color: "#0f172a",
                          border: "2px solid #475569",
                        }}
                      >
                        <Heart className="h-4 w-4" fill="currentColor" />
                        {selectedFrameForGift != null
                          ? `Подарить рамку${(giftableFrameById.get(selectedFrameForGift)?.cost ?? 0) > 0 ? ` — ${giftableFrameById.get(selectedFrameForGift)?.cost ?? 0} ❤` : ""}`
                          : "Подарить рамку"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Действия */}
              <div className="player-menu-actions flex min-h-0 min-w-0 w-full flex-1 flex-col gap-5">
                <div>
                  <p className="mb-2.5 text-[15px] font-black tracking-tight text-slate-900">Действия</p>
                  {/* Избранное и ухаживание — верхний ряд; розы и «от вас» — ниже; ВК + магазин */}
                  {(() => {
                    const showVkRow = effectiveShowVkAfterCare(playerMenuTarget, courtshipProfileAllowed)
                    const targetAcceptsInvites = effectiveOpenToChatInvites(playerMenuTarget, allowChatInvite)
                    const isTargetFavorite = !!currentUser && favorites.some((f) => f.id === playerMenuTarget.id)
                    const canOpenVk = !!currentUser && showVkRow && voiceBalance >= 200
                    const myRosesToThem = (rosesGiven ?? []).filter(
                      (r) => r.fromPlayerId === currentUser?.id && r.toPlayerId === playerMenuTarget.id,
                    ).length
                    const roseHandler = () => {
                      if (!currentUser) return
                      if (voiceBalance < 50) {
                        showToast("Нужно 50 сердец для роз", "error")
                        return
                      }
                      dispatch({ type: "GIVE_ROSE", fromPlayerId: currentUser.id, toPlayerId: playerMenuTarget.id })
                      dispatch({
                        type: "ADD_LOG",
                        entry: {
                          id: generateLogId(),
                          type: "rose",
                          fromPlayer: currentUser,
                          toPlayer: playerMenuTarget,
                          text: `${currentUser.name} подарил(а) розы игроку ${playerMenuTarget.name}`,
                          timestamp: Date.now(),
                        },
                      })
                      showToast("Розы подарены", "success")
                    }
                    const baseTile =
                      "flex min-h-[5.75rem] min-w-0 flex-col items-center justify-between gap-2 rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 py-2 text-center font-black shadow-[0_10px_26px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:bg-slate-50/80 active:translate-y-px active:shadow-[0_6px_16px_rgba(15,23,42,0.12)] sm:min-h-[6.25rem] sm:py-2.5"
                    const baseTileNarrow =
                      "px-1.5 sm:px-2"
                    const baseTileWide =
                      "px-2 sm:px-2.5"
                    const titleCls =
                      "px-0.5 text-center text-[15px] font-black leading-snug tracking-tight"
                    const priceCellLight =
                      "flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white/75 px-2 py-2 text-[15px] font-black tabular-nums text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)]"
                    const priceCellGold =
                      "flex w-full items-center justify-center rounded-xl border border-slate-900/10 bg-white/65 px-2 py-2 text-[15px] font-black text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)]"
                    const buyHeartsBtnCls =
                      "flex min-h-[3rem] w-full min-w-0 items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-center text-[15px] font-black leading-tight transition-all hover:brightness-105 active:scale-[0.99] sm:min-h-[3.25rem]"
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
                            <Star className="h-7 w-7 shrink-0 text-amber-600" strokeWidth={2.25} />
                            <span className={`${titleCls} text-slate-900`}>В избранное</span>
                            <div className={priceCellGold}>бесплатно</div>
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
                            <Flower2 className="h-7 w-7 shrink-0 text-white" strokeWidth={2.25} aria-hidden />
                            <span className={`${titleCls} text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.28)]`}>Подарить розы</span>
                            <div className={priceCellLight}>
                              <span>50</span>
                              <Heart className="h-4 w-4 text-rose-600" fill="currentColor" />
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
                              <Flower2 className="h-7 w-7 shrink-0 text-white" strokeWidth={2.25} aria-hidden />
                              <span className={`${titleCls} text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.28)]`}>От вас</span>
                              <div className={priceCellLight}>
                                <span className="tabular-nums">{myRosesToThem}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {showVkRow ? (
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
                              <User className="h-6 w-6 shrink-0" strokeWidth={2.25} />
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
                              <Heart className="h-6 w-6 shrink-0 text-rose-600" fill="currentColor" />
                              Купить сердца
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <p
                              className="rounded-xl px-3 py-2.5 text-center text-[13px] font-medium sm:text-[15px]"
                              style={{ color: "#94a3b8", background: "rgba(15,23,42,0.6)", border: "1px solid #334155" }}
                            >
                              {
                                "Игрок не показывает ВК после «Ухаживать» — общение в личных сообщениях игры. Если у него в профиле включено «Общение», можно пригласить в чат (5 сердец)."
                              }
                            </p>
                            {currentUser && (
                              <div className="grid w-full min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
                                {isTargetFavorite && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      dispatch({ type: "OPEN_SIDE_CHAT", player: playerMenuTarget })
                                      dispatch({ type: "CLOSE_PLAYER_MENU" })
                                    }}
                                    className="flex min-h-[3rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[12px] font-bold transition-all hover:brightness-110 active:scale-[0.99] sm:min-h-[3.25rem] sm:text-[13px]"
                                    style={{
                                      background: "linear-gradient(180deg, #0d9488 0%, #0f766e 100%)",
                                      color: "#fff",
                                      border: "2px solid #115e59",
                                      boxShadow: "0 2px 0 #134e4a",
                                    }}
                                  >
                                    <MessageCircle className="h-6 w-6 shrink-0" strokeWidth={2.25} />
                                    <span className="text-center leading-snug">Написать</span>
                                  </button>
                                )}
                                {targetAcceptsInvites && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      invitePlayerToChat(playerMenuTarget)
                                      dispatch({ type: "CLOSE_PLAYER_MENU" })
                                    }}
                                    disabled={voiceBalance < 5}
                                    className="flex min-h-[3rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[12px] font-bold transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40 sm:min-h-[3.25rem] sm:text-[13px]"
                                    style={{
                                      background: "linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)",
                                      color: "#fff",
                                      border: "2px solid #4338ca",
                                      boxShadow: "0 2px 0 #3730a3",
                                    }}
                                  >
                                    <Send className="h-6 w-6 shrink-0" strokeWidth={2.25} />
                                    <span className="text-center leading-snug">Пригласить общаться — 5 ❤</span>
                                  </button>
                                )}
                              </div>
                            )}
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

          </>
        </GameSidePanelShell>
        );
      })()}

      {/* Каталог подарков — та же оболочка, что у магазина (GameSidePanelShell) */}
      {giftCatalogDrawerPlayer && currentUser && (
        <GameSidePanelShell
          title={
            selectedGiftRecipients.length > 1
              ? `Подарки для ${selectedGiftRecipients.length} игроков`
              : `Подарки для ${giftCatalogDrawerPlayer.name}`
          }
          subtitle="оплата сердечками или розами — по каталогу"
          onClose={() => {
            setGiftCatalogDrawerPlayer(null)
            setSidebarTargetPlayer(null)
            setSidebarGiftMode(false)
            setGiftBatchPickerOpen(false)
            setGiftBatchMaleOn(false)
            setGiftBatchFemaleOn(false)
            setGiftCatalogRecipientIds([])
            setGiftCatalogSectionTab("free")
          }}
          variant="material"
          allowBackgroundInteraction
          overlayClassName="bg-transparent backdrop-blur-none"
          panelClassName="!border-amber-500/25 !bg-[linear-gradient(165deg,rgba(30,41,59,0.98)_0%,rgba(15,23,42,0.98)_50%,rgba(30,41,59,0.98)_100%)] !shadow-[-24px_0_60px_rgba(0,0,0,0.55)]"
          headerRight={
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500/25 to-amber-500/20 ring-1 ring-rose-400/20">
              <Gift className="h-[18px] w-[18px] text-rose-300/90" strokeWidth={2} aria-hidden />
            </span>
          }
          headerClassName="!border-slate-600/25 !bg-slate-900/95"
          contentClassName="relative flex min-h-0 w-full flex-col !overflow-hidden !bg-gradient-to-b !from-slate-900 !via-[#0f172a] !to-slate-950 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-[14px] sm:px-4 sm:pb-5 sm:pt-3"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(251,191,36,0.06)_0%,transparent_50%)]" aria-hidden />
          <div className="relative z-[1] flex min-h-0 min-w-0 w-full flex-1 flex-col">
                <div className="mb-3 flex min-w-0 items-center gap-3 rounded-2xl border border-amber-500/20 bg-slate-900/65 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="shrink-0 overflow-hidden rounded-full ring-1 ring-white/12">
                    <PlayerAvatar player={giftCatalogDrawerPlayer} size={44} hideNameLabel />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight text-slate-100">
                    {giftCatalogDrawerPlayer.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: "OPEN_PLAYER_MENU", player: giftCatalogDrawerPlayer })
                      setGiftCatalogDrawerPlayer(null)
                      setSidebarTargetPlayer(null)
                      setSidebarGiftMode(false)
                      setGiftBatchPickerOpen(false)
                      setGiftBatchMaleOn(false)
                      setGiftBatchFemaleOn(false)
                      setGiftCatalogRecipientIds([])
                      setGiftCatalogSectionTab("free")
                    }}
                    className="shrink-0 rounded-xl border border-slate-500/55 bg-slate-800/90 px-3 py-1.5 text-[12px] font-extrabold text-slate-100 transition hover:border-amber-400/40 hover:bg-slate-800"
                  >
                    Профиль
                  </button>
                </div>
                <div
                  className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[1.35rem] border border-amber-500/15"
                  style={{
                    background:
                      "linear-gradient(165deg, rgba(30,41,59,0.55) 0%, rgba(15,23,42,0.92) 45%, rgba(15,23,42,0.98) 100%)",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(251,191,36,0.06)",
                  }}
                >
                  <div className="shrink-0 space-y-2.5 px-3 pt-3 sm:px-4 sm:pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Выбери получателей</p>
                      <p className="mt-1 text-[13px] font-medium leading-snug text-slate-300/95">
                        {giftBatchMaleOn && giftBatchFemaleOn
                          ? "Выбраны все мужчины и все женщины за столом"
                          : giftBatchMaleOn
                            ? "Выбраны все мужчины за столом"
                            : giftBatchFemaleOn
                              ? "Выбраны все женщины за столом"
                              : "Сейчас выбран один игрок"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {giftBatchPickerOpen && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const maleIds = giftDrawerEligibleRecipients.filter((p) => p.gender === "male").map((p) => p.id)
                              if (!giftBatchMaleOn && maleIds.length === 0) {
                                showToast("За столом нет мужчин для выбора", "info")
                                return
                              }
                              setGiftBatchMaleOn((prev) => !prev)
                            }}
                            className={`flex h-9 min-w-[2.5rem] items-center justify-center rounded-full border px-3 text-sm font-bold transition-all ${
                              giftBatchMaleOn
                                ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                : "border-slate-600/50 bg-slate-800/60 text-slate-300 hover:border-slate-500/60 hover:bg-slate-800/90"
                            }`}
                            aria-label="Выбрать всех мужчин"
                            title="Выбрать всех мужчин"
                          >
                            М
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const femaleIds = giftDrawerEligibleRecipients.filter((p) => p.gender === "female").map((p) => p.id)
                              if (!giftBatchFemaleOn && femaleIds.length === 0) {
                                showToast("За столом нет женщин для выбора", "info")
                                return
                              }
                              setGiftBatchFemaleOn((prev) => !prev)
                            }}
                            className={`flex h-9 min-w-[2.5rem] items-center justify-center rounded-full border px-3 text-sm font-bold transition-all ${
                              giftBatchFemaleOn
                                ? "border-rose-400/35 bg-rose-500/10 text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                : "border-slate-600/50 bg-slate-800/60 text-slate-300 hover:border-slate-500/60 hover:bg-slate-800/90"
                            }`}
                            aria-label="Выбрать всех женщин"
                            title="Выбрать всех женщин"
                          >
                            Ж
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setGiftBatchPickerOpen((prev) => !prev)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-600/55 bg-slate-800/70 text-slate-200 transition-all hover:border-slate-500/70 hover:bg-slate-800"
                        aria-label="Массовый выбор получателей"
                        title="Массовый выбор получателей"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                  <div className="-mx-0.5 overflow-x-auto pb-0.5">
                    <div className="flex min-w-max items-center gap-1.5 px-0.5">
                      {selectedGiftRecipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          onClick={() => {
                            setGiftBatchMaleOn(false)
                            setGiftBatchFemaleOn(false)
                            setGiftCatalogRecipientIds([recipient.id])
                          }}
                          role="button"
                          tabIndex={0}
                          className="relative flex max-w-[11rem] overflow-visible items-center gap-2 rounded-2xl border border-slate-600/45 bg-slate-900/35 py-1 pl-1 pr-2.5 text-left text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all hover:border-slate-500/55 hover:bg-slate-800/45 active:scale-[0.99]"
                          title={`Выбран: ${recipient.name}`}
                        >
                          <button
                            type="button"
                            aria-label={`Удалить ${recipient.name} из получателей`}
                            title="Удалить"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeGiftRecipient(recipient.id)
                            }}
                            className="absolute -right-1.5 -top-1.5 z-[2] flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                          >
                            <X className="h-3 w-3" strokeWidth={2.25} />
                          </button>
                          <div
                            ref={recipient.id === giftCatalogDrawerPlayer.id ? giftDrawerAvatarRef : undefined}
                            className="shrink-0 overflow-hidden rounded-full ring-1 ring-white/10"
                          >
                            <PlayerAvatar player={recipient} size={34} hideNameLabel />
                          </div>
                          <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-200/95">{recipient.name}</span>
                        </div>
                      ))}
                      {(giftBatchMaleOn || giftBatchFemaleOn) && (
                        <button
                          type="button"
                          onClick={() => {
                            setGiftBatchMaleOn(false)
                            setGiftBatchFemaleOn(false)
                            setGiftCatalogRecipientIds([giftCatalogDrawerPlayer.id])
                          }}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-slate-600/50 bg-slate-900/40 text-slate-400 transition-all hover:border-slate-500/60 hover:bg-slate-800/50 hover:text-slate-200"
                          aria-label="Сбросить массовый выбор"
                          title="Сбросить массовый выбор"
                        >
                          <X className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                  <div className="shrink-0 border-t border-white/[0.06] px-3 pb-2 pt-2 sm:px-4">
                    <div
                      className="flex w-full gap-1 rounded-2xl border border-white/10 bg-slate-950/35 p-1 ring-1 ring-white/[0.06]"
                      role="tablist"
                      aria-label="Категории подарков"
                    >
                      {giftCatalogTabSections.map((tab) => {
                        const selected = giftCatalogSectionTab === tab.id
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setGiftCatalogSectionTab(tab.id)}
                            className={`min-w-0 flex-1 rounded-xl px-2 py-2 text-center text-[12px] font-extrabold leading-tight transition ${
                              selected
                                ? "bg-gradient-to-b from-amber-500/25 to-slate-900/80 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-amber-400/25"
                                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                            }`}
                          >
                            {tab.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="player-menu-gifts-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
                    {(() => {
                      const section = giftCatalogActiveSection
                      return section.gifts.length === 0 ? (
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
                              const busyKey = `${section.key}-${gift.id}`
                              const pendingRecipients = selectedGiftRecipients.filter(
                                (recipient) =>
                                  !inventory.some(
                                    (item) =>
                                      item.fromPlayerId === currentUser.id &&
                                      item.toPlayerId === recipient.id &&
                                      item.type === gift.id,
                                  ),
                              )
                              const recipientCount = pendingRecipients.length
                              const needPay = gift.cost > 0
                              const paysWithRoses = gift.payCurrency === "roses"
                              const stock = typeof gift.stock === "number" ? gift.stock : -1
                              const limitedStock = stock >= 0
                              const outOfStock = limitedStock && stock < recipientCount
                              const totalCost = gift.cost * recipientCount
                              const canAfford = needPay
                                ? paysWithRoses
                                  ? roseInventoryCount >= totalCost
                                  : voiceBalance >= totalCost
                                : true
                              const disabled =
                                recipientCount === 0 ||
                                (needPay && !canAfford) ||
                                outOfStock ||
                                giftPurchaseBusyKey === busyKey
                              const handleGiftClick = async () => {
                                if (disabled) return
                                setGiftPurchaseBusyKey(busyKey)
                                const recipients = [...pendingRecipients]
                                try {
                                  if (limitedStock) {
                                    const res = await apiFetch("/api/catalog/gifts/consume", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ giftId: gift.id, amount: recipientCount }),
                                    })
                                    const data = await res.json().catch(() => null)
                                    if (!res.ok || !data?.ok) {
                                      showToast(
                                        data?.error === "out_of_stock"
                                          ? "Этот подарок закончился"
                                          : "Не удалось оформить подарок",
                                        "error",
                                      )
                                      void refreshGiftCatalog()
                                      return
                                    }
                                  }
                                  if (needPay) {
                                    if (paysWithRoses) {
                                      dispatch({ type: "REMOVE_INVENTORY_ROSES", amount: totalCost })
                                    } else {
                                      dispatch({ type: "PAY_VOICES", amount: totalCost })
                                    }
                                  }
                                  recipients.forEach((recipient, index) => {
                                    const eventTs = Date.now() + index
                                    dispatch({
                                      type: "ADD_INVENTORY_ITEM",
                                      item: {
                                        type: gift.id,
                                        fromPlayerId: currentUser.id,
                                        fromPlayerName: currentUser.name,
                                        timestamp: eventTs,
                                        toPlayerId: recipient.id,
                                      },
                                    })
                                    const logId = generateLogId()
                                    dispatch({
                                      type: "ADD_LOG",
                                      entry: {
                                        id: logId,
                                        type: gift.id as GameLogEntry["type"],
                                        fromPlayer: currentUser,
                                        toPlayer: recipient,
                                        text: `${currentUser.name} дарит подарок «${gift.name}» игроку ${recipient.name}`,
                                        timestamp: eventTs,
                                      } as GameLogEntry,
                                    })
                                    void applyGiftProgressResult(
                                      recordGiftProgress({
                                        dedupeId: logId,
                                        fromPlayer: currentUser,
                                        toPlayer: recipient,
                                        giftId: gift.id,
                                        heartsCost: gift.payCurrency === "hearts" ? gift.cost : 0,
                                        rosesCost: gift.payCurrency === "roses" ? gift.cost : 0,
                                      }),
                                    )
                                    triggerGiftCatalogFlyToAvatar(
                                      busyKey,
                                      recipient.id,
                                      gift.id,
                                      gift.emoji,
                                      gift.img,
                                    )
                                  })
                                  playEmotionSound(gift.id)
                                  showToast(
                                    recipients.length > 1
                                      ? `Подарок отправлен ${recipients.length} игрокам`
                                      : `Подарок отправлен ${recipients[0]?.name ?? "игроку"}`,
                                    "success",
                                  )
                                  if (limitedStock) void refreshGiftCatalog()
                                } finally {
                                  setGiftPurchaseBusyKey(null)
                                }
                              }
                              const isHeartPaidSection = section.key === "hearts"
                              const isRosePremiumSection = section.key === "premium_roses"
                              return (
                                <button
                                  key={`${section.key}-${gift.id}`}
                                  type="button"
                                  ref={(el) => {
                                    giftCatalogButtonRefs.current[busyKey] = el
                                  }}
                                  onClick={handleGiftClick}
                                  aria-label={gift.name}
                                  title={gift.name}
                                  className="player-menu-gift-item group relative flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-gradient-to-b from-slate-700/35 to-slate-950/50 p-2 pb-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/20 hover:shadow-[0_14px_28px_-10px_rgba(0,0,0,0.55),0_0_24px_-6px_rgba(251,191,36,0.12)] disabled:translate-y-0 disabled:opacity-45 disabled:hover:border-white/[0.06] disabled:hover:shadow-none sm:gap-2.5 sm:p-2.5"
                                  disabled={disabled}
                                >
                                  <div
                                    className={`relative flex h-[2.65rem] w-[2.65rem] shrink-0 items-center justify-center rounded-2xl ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-[1.06] sm:h-12 sm:w-12 ${
                                      isHeartPaidSection && !disabled
                                        ? "bg-gradient-to-br from-amber-500/20 via-slate-700/40 to-slate-900/80 group-hover:ring-amber-400/25"
                                        : isRosePremiumSection && !disabled
                                          ? "bg-gradient-to-br from-rose-500/25 via-fuchsia-900/30 to-slate-900/80 group-hover:ring-rose-400/30"
                                          : "bg-gradient-to-br from-slate-600/45 to-slate-900/75 group-hover:ring-sky-400/20"
                                    } ${disabled ? "opacity-50 grayscale-[0.35]" : ""}`}
                                  >
                                    <span className="flex select-none items-center justify-center text-[1.35rem] leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] sm:text-2xl">
                                      {gift.img?.trim() ? (
                                        <img
                                          src={gift.img}
                                          alt=""
                                          className="h-9 w-9 object-contain sm:h-10 sm:w-10"
                                          draggable={false}
                                        />
                                      ) : (
                                        gift.emoji
                                      )}
                                    </span>
                                  </div>
                                  <span className="line-clamp-2 min-h-[2rem] w-full px-0.5 text-center text-[9px] font-medium leading-tight text-slate-400 group-hover:text-slate-300 sm:min-h-[2.25rem] sm:text-[10px]">
                                    {gift.name}
                                  </span>
                                  {recipientCount === 0 ? (
                                    <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300/90 sm:text-[10px]">
                                      ✓ Уже есть
                                    </span>
                                  ) : outOfStock ? (
                                    <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-full border border-slate-500/40 bg-slate-800/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400 sm:text-[10px]">
                                      закончилось
                                    </span>
                                  ) : gift.cost === 0 ? (
                                    <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-full border border-sky-400/35 bg-gradient-to-b from-sky-500/25 to-sky-600/10 px-2 py-0.5 text-[9px] font-extrabold tabular-nums text-sky-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:text-[10px]">
                                      0 ❤
                                    </span>
                                  ) : paysWithRoses ? (
                                    <span className="inline-flex min-w-[2.75rem] items-center justify-center gap-0.5 rounded-full border border-fuchsia-500/35 bg-gradient-to-b from-fuchsia-500/20 to-slate-900/60 px-2 py-0.5 text-[9px] font-extrabold tabular-nums text-fuchsia-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] sm:text-[10px]">
                                      <span className="text-[10px] leading-none sm:text-[11px]" aria-hidden>
                                        🌹
                                      </span>
                                      {totalCost}
                                    </span>
                                  ) : (
                                    <span className="inline-flex min-w-[2.75rem] items-center justify-center gap-0.5 rounded-full border border-rose-500/30 bg-gradient-to-b from-rose-500/20 to-slate-900/60 px-2 py-0.5 text-[9px] font-extrabold tabular-nums text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] sm:text-[10px]">
                                      <span className="text-[10px] leading-none text-rose-400 sm:text-[11px]" aria-hidden>
                                        ❤
                                      </span>
                                      {totalCost}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )
                    })()}
                  </div>
                </div>
              </div>
        </GameSidePanelShell>
      )}

      {giftCatalogFlyFx.map((fx) => (
        <GiftCatalogBezierFly
          key={fx.id}
          startX={fx.startX}
          startY={fx.startY}
          endX={fx.endX}
          endY={fx.endY}
          emoji={fx.emoji}
          imgSrc={fx.imgSrc}
          durationMs={GIFT_FLY_DURATION_MS}
          onFinished={() => {
            const burstId = `burst_${fx.id}`
            setGiftCatalogFlyFx((prev) => prev.filter((x) => x.id !== fx.id))
            setGiftArrivalBursts((prev) => [...prev.slice(-6), { id: burstId, x: fx.endX, y: fx.endY, burstKey: fx.id }])
            const particleClearMs =
              typeof window !== "undefined" &&
              window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? 400
                : GIFT_ARRIVAL_PARTICLE_DURATION_MS
            const tid = globalThis.setTimeout(() => {
              setGiftArrivalBursts((prev) => prev.filter((b) => b.id !== burstId))
              setCatalogGiftAvatarHold((h) =>
                h?.playerId === fx.recipientPlayerId && h?.giftTypeId === fx.giftTypeId ? null : h,
              )
              giftCatalogFlyTimersRef.current = giftCatalogFlyTimersRef.current.filter((t) => t !== tid)
            }, particleClearMs)
            giftCatalogFlyTimersRef.current.push(tid)
          }}
        />
      ))}
      {giftArrivalBursts.map((b) => (
        <GiftArrivalParticleBurst key={b.id} x={b.x} y={b.y} burstKey={b.burstKey} />
      ))}

      {/* магазин теперь отдельным экраном (ShopScreen) */}
      {chatRequestPrompt && (
        <div className="fixed inset-0 z-[186] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-300/45 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-2xl">
            <p className="text-center text-[19px] font-black text-slate-100">Запрос на общение</p>
            <p className="mt-2 text-center text-[15px] text-slate-200">
              С тобой хочет общаться <span className="font-black text-cyan-200">{chatRequestPrompt.fromName}</span>
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setChatRequestPrompt(null)
                  try {
                    if (typeof window !== "undefined") {
                      window.sessionStorage.setItem("spindate_focus_chat_invite_setting_v1", "1")
                    }
                  } catch {
                    // ignore storage errors
                  }
                  dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "profile" })
                }}
                className="rounded-2xl border border-cyan-300/55 bg-gradient-to-b from-cyan-200 to-cyan-100 px-4 py-3 text-[15px] font-black text-slate-900 transition hover:brightness-105"
              >
                Настройка
              </button>
              <button
                type="button"
                onClick={() => setChatRequestPrompt(null)}
                className="rounded-2xl border border-slate-500/70 bg-slate-800 px-4 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                Позже
              </button>
            </div>
          </div>
        </div>
      )}

      {careOfferOpen && playerMenuTarget && currentUser && currentUser.id !== playerMenuTarget.id && (
        <div className="fixed inset-0 z-[185] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-fuchsia-300/45 bg-gradient-to-b from-slate-900 to-slate-950 p-4 shadow-2xl">
            <p className="text-center text-[19px] font-black text-slate-100">Начать ухаживать</p>
            <p className="mt-1 text-center text-[14px] text-slate-300">
              Выберите способ подарка для <span className="font-bold text-white">{playerMenuTarget.name}</span>
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handlePlayerProfileCareOffer("hearts")}
                disabled={voiceBalance < 50}
                className="rounded-2xl border border-amber-300/55 bg-gradient-to-b from-amber-200 to-amber-100 px-4 py-3 text-[15px] font-black text-slate-900 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Подарить игроку — 50 ❤
              </button>
              <button
                type="button"
                onClick={() => handlePlayerProfileCareOffer("roses")}
                disabled={roseInventoryCount < 10}
                className="rounded-2xl border border-fuchsia-300/55 bg-gradient-to-b from-fuchsia-200 to-fuchsia-100 px-4 py-3 text-[15px] font-black text-slate-900 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Подарить игроку — 10 🌹
              </button>
              <button
                type="button"
                onClick={() => setCareOfferOpen(false)}
                className="rounded-2xl border border-slate-500/70 bg-slate-800 px-4 py-2.5 text-[14px] font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Полноэкранные 👋 при синхронной записи hello в gameLog                            */
/* ------------------------------------------------------------------ */
function TableHelloScreenBurstLayer({ seed, burstKey }: { seed: string; burstKey: number }) {
  const items = useMemo(() => {
    const n = 44
    return Array.from({ length: n }, (_, i) => ({
      id: `${burstKey}-${i}`,
      left: 3 + hashUnit01(seed, i * 3 + 1) * 94,
      top: 2 + hashUnit01(seed, i * 3 + 2) * 93,
      delay: Math.floor(hashUnit01(seed, i * 3 + 3) * 480),
      size: 1.25 + hashUnit01(seed, i * 3 + 4) * 2.1,
      rot: -28 + hashUnit01(seed, i * 3 + 5) * 56,
    }))
  }, [seed, burstKey])

  return (
    <div className="pointer-events-none fixed inset-0 z-[175] overflow-hidden" aria-hidden key={burstKey}>
      {items.map((it) => (
        <span
          key={it.id}
          className="absolute will-change-[opacity,transform]"
          style={{
            left: `${it.left}%`,
            top: `${it.top}%`,
            fontSize: `${it.size}rem`,
            transform: `translate(-50%, -50%) rotate(${it.rot}deg)`,
            animation: "tableHelloEmojiPop 2.35s cubic-bezier(0.22, 0.85, 0.36, 1) forwards",
            animationDelay: `${it.delay}ms`,
          }}
        >
          👋
        </span>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Table chat (общий чат за столом; один экземпляр на мобиле или в правой панели) */
/* ------------------------------------------------------------------ */
function TableChatPanel({
  gameLog,
  players,
  bottleCatalogRows,
  giftDisplayById,
  chatInput,
  setChatInput,
  onSend,
  logEndRef,
  currentUserId,
  currentUserIsVip,
  chatDisabled,
  onBecomeVip,
  className,
  onJoinPlayerHello,
  onChatMenuAction,
}: {
  gameLog: GameLogEntry[]
  players: Player[]
  /** Один раз с родителя — не вызывать useBottleCatalog в каждом пузырьке (иначе лавина запросов / зависание). */
  bottleCatalogRows: BottleCatalogSkinRow[]
  /** Каталог подарков (в т.ч. из админки) — для полоски «пара + эмодзи», не только текстом. */
  giftDisplayById: ReadonlyMap<string, GiftChatDisplayMeta>
  chatInput: string
  setChatInput: (v: SetStateAction<string>) => void
  onSend: () => void
  logEndRef: RefObject<HTMLDivElement | null>
  currentUserId?: number
  currentUserIsVip?: boolean
  chatDisabled?: boolean
  /** Открыть магазин для оформления VIP (смайлики в чате только у VIP). */
  onBecomeVip?: () => void
  className?: string
  onJoinPlayerHello?: (joinedPlayer: Player) => void
  onChatMenuAction?: (
    action: "profile" | "reply" | "report",
    ctx: { player: Player; text: string },
  ) => void
}) {
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const prevFeedLenRef = useRef(0)

  const feedEntries = useMemo(() => {
    const sorted = [...gameLog]
      .filter((e) => !hideTableLogEntryFromRoomChatText(String(e.text ?? "")))
      .sort(compareTableChatFeedOrder)
    return sorted.filter((_, i) => !isRedundantVipalaParaChatRow(sorted, i))
  }, [gameLog])

  const feedDisplayRows = useMemo(
    () => aggregateConsecutiveTableLogRows(feedEntries),
    [feedEntries],
  )

  const mergedFeedRows = useMemo(
    () => mergeConsecutivePairFeedRows(feedDisplayRows, players, giftDisplayById),
    [feedDisplayRows, players, giftDisplayById],
  )

  useEffect(() => {
    const container = chatScrollRef.current
    const end = logEndRef.current
    if (!container || !end) return

    if (mergedFeedRows.length === 0) {
      prevFeedLenRef.current = 0
      return
    }

    const firstContent = prevFeedLenRef.current === 0
    prevFeedLenRef.current = mergedFeedRows.length

    const thresholdPx = 120
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <= thresholdPx

    if (firstContent || nearBottom) {
      end.scrollIntoView({ behavior: firstContent ? "auto" : "smooth" })
    }
  }, [gameLog, mergedFeedRows.length, logEndRef])

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_6px_28px_rgba(0,0,0,0.32)] backdrop-blur-md",
        className,
      )}
      style={{
        background: "linear-gradient(165deg, rgba(15,23,42,0.78) 0%, rgba(2,6,23,0.92) 55%, rgba(2,6,23,0.96) 100%)",
      }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 bg-slate-950/15 px-2.5 py-1.5 backdrop-blur-sm">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10">
          <MessageCircle className="h-3.5 w-3.5 text-cyan-300/90 md:h-[0.95rem] md:w-[0.95rem]" />
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-slate-100 md:text-sm">Чат комнаты</span>
        <span className="ml-auto rounded-md bg-slate-900/80 px-1.5 py-px text-[0.62rem] font-semibold tabular-nums text-slate-500">
          {mergedFeedRows.length}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={chatScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5 pl-1.5 pr-2.5 [scrollbar-color:rgba(71,85,105,0.55)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/45 [&::-webkit-scrollbar-track]:bg-transparent"
      >
        {mergedFeedRows.length === 0 && (
          <p className="py-8 text-center text-[13px] leading-relaxed text-slate-500">
            Событий за столом пока нет
          </p>
        )}
        <div className="flex flex-col gap-1 py-0.5">
          {mergedFeedRows.map((row) =>
            row.kind === "pairStrip" ? (
              <PairFeedStripRow
                key={row.segments.map((s) => s.entry.id).join("-")}
                left={row.left}
                right={row.right}
                segments={row.segments}
                giftDisplayById={giftDisplayById}
              />
            ) : (
              <ChatBubble
                key={row.entry.id}
                entry={row.entry}
                players={players}
                bottleCatalogRows={bottleCatalogRows}
                giftDisplayById={giftDisplayById}
                currentUserId={currentUserId}
                repeatCount={row.count}
                chatDisabled={chatDisabled}
                onJoinPlayerHello={onJoinPlayerHello}
                onChatMenuAction={onChatMenuAction}
              />
            ),
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 bg-slate-950/20 px-2.5 pb-2 pt-1 backdrop-blur-sm">
        <div
          className="flex min-h-[2.125rem] items-center gap-1.5 rounded-lg bg-slate-900/75 px-2 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35),inset_0_1px_0_rgba(255,255,255,0.07)]"
          role="group"
          aria-label="Поле ввода сообщения"
        >
          <TableChatEmojiPicker
            disabled={chatDisabled || !currentUserIsVip}
            title={
              chatDisabled ? "Чат на паузе" : currentUserIsVip ? "Смайлики" : "Смайлики доступны только для VIP"
            }
            onEmojiSelect={(emoji) => setChatInput((prev) => prev + emoji)}
            onBecomeVip={
              currentUserId != null && onBecomeVip && !chatDisabled && !currentUserIsVip
                ? onBecomeVip
                : undefined
            }
          />
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder={chatDisabled ? "Чат на паузе" : "Введите текст сообщения…"}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSend() }}
            disabled={chatDisabled}
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm leading-snug text-slate-100 placeholder:text-slate-500/90 placeholder:italic focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Введите сообщение для чата комнаты"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={chatDisabled}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-cyan-500 to-cyan-600 text-white shadow-[0_2px_10px_rgba(6,182,212,0.4)] transition-all hover:from-cyan-400 hover:to-cyan-500 hover:brightness-105 active:scale-[0.97] disabled:opacity-30"
            aria-label="Отправить сообщение в чат"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Цвет текста/ярлыка для событий пары в ленте чата. */
const PAIR_LOG_ACCENT_MAP: Record<string, string> = {
  kiss: "#fb7185",
  beer: "#fbbf24",
  skip: "#cbd5e1",
  invite: "#fcd34d",
  join: "#4ade80",
  hello: "#22d3ee",
  system: "#7dd3fc",
  hug: "#4ade80",
  selfie: "#7dd3fc",
  flowers: "#fb7185",
  song: "#c084fc",
  rose: "#fb7185",
  prediction: "#fcd34d",
  bottle_thanks: "#fde047",
  cocktail: "#f472b6",
  diamond: "#c4b5fd",
  care: "#f9a8d4",
  laugh: "#fcd34d",
  gift_voice: "#67e8f9",
  toy_bear: "#d8b4fe",
  toy_car: "#cbd5e1",
  toy_ball: "#fdba74",
  souvenir_magnet: "#7dd3fc",
  souvenir_keychain: "#a5f3fc",
  plush_heart: "#fda4af",
  chocolate_box: "#d6b088",
  banya: "#bae6fd",
  tools: "#cbd5e1",
  lipstick: "#f9a8d4",
}

/**
 * Два события подряд: эмоция A→B и ответ B→A (текст «отвечает»), один тип действия.
 * Раскладка: аватар A — эмоция — аватар B — эмоция — аватар A.
 */
function tryMutualReciprocalPairStrip(
  segments: { entry: GameLogEntry; count: number }[],
): {
  playerA: Player
  playerB: Player
  first: { entry: GameLogEntry; count: number }
  second: { entry: GameLogEntry; count: number }
} | null {
  if (segments.length !== 2) return null
  const first = segments[0]
  const second = segments[1]
  const e1 = first.entry
  const e2 = second.entry
  if (!String(e2.text ?? "").includes("отвечает")) return null
  if (e1.type !== e2.type) return null
  const p1a = e1.fromPlayer
  const p1b = e1.toPlayer
  const p2a = e2.fromPlayer
  const p2b = e2.toPlayer
  if (!p1a || !p1b || !p2a || !p2b) return null
  if (p2a.id !== p1b.id || p2b.id !== p1a.id) return null
  return { playerA: p1a, playerB: p1b, first, second }
}

function PairStripEmotionBlock({
  entry,
  count,
  giftDisplayById,
}: {
  entry: GameLogEntry
  count: number
  giftDisplayById: ReadonlyMap<string, GiftChatDisplayMeta>
}) {
  const emotionEmoji = logEventEmotionEmoji(entry, giftDisplayById)
  const actionShort = logEventActionShortLabel(entry, giftDisplayById)
  const giftImg = giftDisplayById.get(String(entry.type))?.img?.trim()
  const centralHint = pairChatCentralObjectHint(entry, giftDisplayById)
  const accentColor = PAIR_LOG_ACCENT_MAP[entry.type] ?? "#cbd5e1"
  const fullPairActionLabel = entry.type === "kiss" && isMutualKissPairLogText(entry.text)
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex max-h-8 min-h-7 min-w-0 cursor-default items-center justify-center rounded-md outline-none ring-0 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/40",
              fullPairActionLabel ? "max-w-[min(100%,12rem)]" : "max-w-[min(100%,7rem)]",
            )}
            aria-label={centralHint}
            tabIndex={0}
          >
            {entry.type === "bottle_thanks" ? (
              <span className="inline-flex h-7 max-h-7 shrink-0 items-center overflow-visible" aria-hidden>
                <ThanksCloudBubble variant="chat" />
              </span>
            ) : emotionEmoji ? (
              <span
                className="flex h-7 w-7 shrink-0 select-none items-center justify-center text-[1.2rem] leading-none"
                aria-hidden
              >
                {emotionEmoji}
              </span>
            ) : giftImg ? (
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden>
                <img
                  src={giftImg}
                  alt=""
                  className="h-6 w-6 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                />
              </span>
            ) : (
              actionShort && (
                <span
                  className={cn(
                    "shrink text-[10px] font-semibold leading-tight sm:text-[11px]",
                    fullPairActionLabel
                      ? "max-w-[min(100%,11rem)] whitespace-nowrap sm:max-w-[12rem]"
                      : "max-w-[5rem] truncate sm:max-w-[6.5rem]",
                  )}
                  style={{ color: accentColor }}
                >
                  {actionShort}
                </span>
              )
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          className="border-0 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-100 shadow-xl"
        >
          {centralHint}
        </TooltipContent>
      </Tooltip>
      <span className={PAIR_FEED_REPEAT_COUNT_CLASS} aria-label={`Количество: ${count}`}>
        ×{count}
      </span>
    </span>
  )
}

function PairFeedStripTinyAvatar({ player }: { player: Player }) {
  return (
    <div
      className={cn(
        "h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10",
        TABLE_CHAT_ROOM_AVATAR_RING,
      )}
    >
      <img
        src={player.avatar}
        alt=""
        className="h-full w-full object-cover"
        onError={(e) => tableChatPlayerAvatarOnError(e, player)}
      />
    </div>
  )
}

/** Несколько эмоций/подарков подряд между одной и той же парой — одна строка, горизонтальный скролл при переполнении. */
function PairFeedStripRow({
  left,
  right,
  segments,
  giftDisplayById,
}: {
  left: Player
  right: Player
  segments: { entry: GameLogEntry; count: number }[]
  giftDisplayById: ReadonlyMap<string, GiftChatDisplayMeta>
}) {
  const mutual = tryMutualReciprocalPairStrip(segments)
  const visualSegments = useMemo(() => {
    if (segments.length <= 1) return segments
    const out: { entry: GameLogEntry; count: number }[] = []
    for (const segment of segments) {
      const prev = out[out.length - 1]
      if (!prev) {
        out.push(segment)
        continue
      }
      const prevHint = pairChatCentralObjectHint(prev.entry, giftDisplayById)
      const currentHint = pairChatCentralObjectHint(segment.entry, giftDisplayById)
      const prevImg = giftDisplayById.get(String(prev.entry.type))?.img?.trim() ?? ""
      const currentImg = giftDisplayById.get(String(segment.entry.type))?.img?.trim() ?? ""
      const sameVisualToken =
        prev.entry.type === segment.entry.type &&
        prevHint === currentHint &&
        prevImg === currentImg
      if (sameVisualToken) {
        prev.count += segment.count
      } else {
        out.push(segment)
      }
    }
    return out
  }, [segments, giftDisplayById])

  const labelForA11y = mutual
    ? [
        `${mutual.playerA.name} и ${mutual.playerB.name}, взаимно`,
        ...visualSegments.map(({ entry, count }) => {
          const label =
            logEventActionShortLabel(entry, giftDisplayById) ??
            logEventEmotionEmoji(entry, giftDisplayById) ??
            String(entry.type)
          return `${label} ×${count}`
        }),
      ].join(", ")
    : [
        left.name,
        right.name,
        ...visualSegments.map(({ entry, count }) => {
          const label =
            logEventActionShortLabel(entry, giftDisplayById) ??
            logEventEmotionEmoji(entry, giftDisplayById) ??
            String(entry.type)
          return `${label} ×${count}`
        }),
      ].join(", ")

  if (mutual) {
    const { playerA, playerB, first, second } = mutual
    return (
      <div className="flex w-full min-w-0 justify-start">
        <div
          className={cn(
            "flex w-max min-w-0 max-w-full flex-nowrap items-center gap-0.5 overflow-x-auto overflow-y-hidden py-0.5 pl-0.5 pr-0.5 [-webkit-overflow-scrolling:touch]",
            "[scrollbar-color:rgba(71,85,105,0.5)_transparent] [scrollbar-width:thin]",
            "[&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/35 [&::-webkit-scrollbar-track]:bg-transparent",
            TABLE_CHAT_ROOM_PAIR_STRIP_OUTER,
          )}
          aria-label={labelForA11y}
        >
          <PairFeedStripTinyAvatar player={playerA} />
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-500/50" strokeWidth={2.25} aria-hidden />
          <PairStripEmotionBlock entry={first.entry} count={first.count} giftDisplayById={giftDisplayById} />
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-500/50" strokeWidth={2.25} aria-hidden />
          <PairFeedStripTinyAvatar player={playerB} />
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-500/50" strokeWidth={2.25} aria-hidden />
          <PairStripEmotionBlock entry={second.entry} count={second.count} giftDisplayById={giftDisplayById} />
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-500/50" strokeWidth={2.25} aria-hidden />
          <PairFeedStripTinyAvatar player={playerA} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 justify-start">
      <div
        className={cn("flex w-max min-w-0 max-w-full items-stretch", TABLE_CHAT_ROOM_PAIR_STRIP_OUTER)}
        aria-label={labelForA11y}
      >
        <div className="flex shrink-0 items-center gap-0.5 pl-0.5">
          <PairFeedStripTinyAvatar player={left} />
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-500/50" strokeWidth={2.25} aria-hidden />
        </div>

        <div
          className={cn(
            "min-w-0 max-w-[min(100%,18rem)] shrink self-center overflow-x-auto overflow-y-hidden [-webkit-overflow-scrolling:touch]",
            "[scrollbar-color:rgba(71,85,105,0.5)_transparent] [scrollbar-width:thin]",
            "[&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-500/35 [&::-webkit-scrollbar-track]:bg-transparent",
          )}
        >
          <div className="inline-flex min-h-7 w-max min-w-0 flex-nowrap items-center gap-x-1.5 px-1.5">
            {visualSegments.map(({ entry, count }, i) => (
              <Fragment key={entry.id}>
                {i > 0 ? (
                  <span
                    className="inline-block h-3 w-px shrink-0 rounded-full bg-slate-500/35"
                    aria-hidden
                  />
                ) : null}
                <PairStripEmotionBlock entry={entry} count={count} giftDisplayById={giftDisplayById} />
              </Fragment>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 pr-0.5">
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-500/50" strokeWidth={2.25} aria-hidden />
          <PairFeedStripTinyAvatar player={right} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Chat bubble component                                              */
/* ------------------------------------------------------------------ */
function ChatBubble({
  entry,
  players,
  bottleCatalogRows,
  giftDisplayById,
  currentUserId,
  repeatCount = 1,
  chatDisabled = false,
  onJoinPlayerHello,
  onChatMenuAction,
}: {
  entry: GameLogEntry
  players: Player[]
  bottleCatalogRows: BottleCatalogSkinRow[]
  giftDisplayById: ReadonlyMap<string, GiftChatDisplayMeta>
  currentUserId?: number
  /** Сколько одинаковых подряд событий свернуто в этот пузырёк (только для не-chat). */
  repeatCount?: number
  chatDisabled?: boolean
  onJoinPlayerHello?: (joinedPlayer: Player) => void
  onChatMenuAction?: (
    action: "profile" | "reply" | "report",
    ctx: { player: Player; text: string },
  ) => void
}) {
  const isOwn = entry.fromPlayer?.id === currentUserId
  const isChat = entry.type === "chat"
  const showRepeat = repeatCount > 1 && !isChat

  if (isChat) {
    const chatMenuCtx = entry.fromPlayer
      ? { player: entry.fromPlayer, text: entry.text }
      : null
    const chatMenuItemClass =
      "cursor-pointer rounded-none border-b border-slate-200/90 px-3 py-2.5 text-left text-[14px] font-medium text-slate-900 focus:bg-slate-100 data-[highlighted]:bg-slate-100 dark:border-slate-600/80 dark:text-slate-100 dark:focus:bg-slate-800 dark:data-[highlighted]:bg-slate-800"

    return (
      <div className={cn("flex w-full items-end gap-2.5", isOwn ? "flex-row-reverse" : "flex-row")}>
        {entry.fromPlayer && !isOwn && onChatMenuAction && chatMenuCtx && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "mb-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-full outline-none ring-offset-2 transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-cyan-400/55",
                  TABLE_CHAT_ROOM_AVATAR_RING,
                )}
                aria-label={`Меню сообщения от ${entry.fromPlayer.name}`}
              >
                <img
                  src={entry.fromPlayer.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => tableChatPlayerAvatarOnError(e, entry.fromPlayer!)}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="bottom"
              sideOffset={6}
              className="z-[80] w-[min(100vw-1.5rem,13.5rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white/[0.97] p-0 shadow-[0_8px_32px_rgba(15,23,42,0.18)] backdrop-blur-md dark:border-slate-600/80 dark:bg-slate-900/[0.97]"
            >
              <DropdownMenuItem
                className={chatMenuItemClass}
                onSelect={() => onChatMenuAction("profile", chatMenuCtx)}
              >
                Профиль
              </DropdownMenuItem>
              <DropdownMenuItem
                className={chatMenuItemClass}
                onSelect={() => onChatMenuAction("reply", chatMenuCtx)}
              >
                Ответить
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer rounded-none px-3 py-2.5 text-left text-[14px] font-medium focus:bg-red-500/10 data-[highlighted]:bg-red-500/10"
                onSelect={() => onChatMenuAction("report", chatMenuCtx)}
              >
                Пожаловаться
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {entry.fromPlayer && !isOwn && !onChatMenuAction && (
          <div
            className={cn(
              "mb-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-full",
              TABLE_CHAT_ROOM_AVATAR_RING,
            )}
          >
            <img
              src={entry.fromPlayer.avatar}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => tableChatPlayerAvatarOnError(e, entry.fromPlayer!)}
            />
          </div>
        )}
        <div className={cn("max-w-[85%] min-w-0", isOwn ? "items-end" : "items-start")}>
          <div
            className={cn(
              "rounded-2xl px-3 py-2 shadow-[0_3px_14px_rgba(0,0,0,0.28)]",
              isOwn
                ? "rounded-br-md bg-gradient-to-br from-emerald-600/95 to-emerald-800/90 text-emerald-50"
                : "rounded-bl-md bg-gradient-to-br from-slate-600/90 to-slate-800/90 text-slate-50",
            )}
          >
            <p className="text-sm leading-relaxed [text-wrap:pretty]" style={{ wordBreak: "break-word" }}>
              {entry.text}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const bottleChange = entry.bottleSkinChange
  if (entry.type === "system" && bottleChange && entry.fromPlayer) {
    const fromVis = resolveBottleSkinChatVisual(bottleCatalogRows, bottleChange.fromSkinId)
    const toVis = resolveBottleSkinChatVisual(bottleCatalogRows, bottleChange.toSkinId)
    const fromName = bottleSkinDisplayName(bottleCatalogRows, bottleChange.fromSkinId)
    const toName = bottleSkinDisplayName(bottleCatalogRows, bottleChange.toSkinId)
    const labelForA11y = `${entry.fromPlayer.name}: ${fromName} — ${toName}`

    const renderBottleMini = (
      vis: ReturnType<typeof resolveBottleSkinChatVisual>,
      title: string,
    ) => {
      if (vis.kind === "emoji") {
        return (
          <span
            className="flex h-7 w-7 shrink-0 select-none items-center justify-center text-[1.2rem] leading-none"
            title={title}
            aria-hidden
          >
            {vis.emoji}
          </span>
        )
      }
      return (
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center" title={title}>
          <img
            src={vis.src}
            alt=""
            className="h-6 w-6 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] [transform:rotate(-28deg)]"
          />
        </span>
      )
    }

    return (
      <div className="flex w-full justify-start">
        <div className={TABLE_CHAT_ROOM_EVENT_CHIP} aria-label={labelForA11y}>
          <div
            className={cn(
              "h-7 w-7 shrink-0 overflow-hidden rounded-full",
              TABLE_CHAT_ROOM_AVATAR_RING,
            )}
          >
            <img
              src={entry.fromPlayer.avatar}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => tableChatPlayerAvatarOnError(e, entry.fromPlayer!)}
            />
          </div>
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-500/50" strokeWidth={2.25} aria-hidden />
          {renderBottleMini(fromVis, fromName)}
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-500/50" strokeWidth={2.25} aria-hidden />
          {renderBottleMini(toVis, toName)}
          {showRepeat && (
            <span
              className="shrink-0 rounded-md bg-emerald-500/12 px-1 py-px text-[0.62rem] font-bold tabular-nums text-emerald-200/90"
              aria-label={`Повторено ${repeatCount} раз`}
            >
              ×{repeatCount}
            </span>
          )}
        </div>
      </div>
    )
  }

  const pairAvatars = resolvePairAvatarsForLog(entry, players)
  const actionShort = logEventActionShortLabel(entry, giftDisplayById)
  const emotionEmoji = logEventEmotionEmoji(entry, giftDisplayById)
  const giftImg = giftDisplayById.get(String(entry.type))?.img?.trim()
  const allowSystemPairStrip = entry.type !== "system" || Boolean(entry.frameGift)
  const showPairRow = Boolean(
    pairAvatars && (emotionEmoji || actionShort || giftImg) && allowSystemPairStrip,
  )

  const accentColor = PAIR_LOG_ACCENT_MAP[entry.type] ?? "#cbd5e1"

  if (showPairRow && pairAvatars) {
    const { left, right } = pairAvatars
    const centralHint = pairChatCentralObjectHint(entry, giftDisplayById)
    const fullPairActionLabel = entry.type === "kiss" && isMutualKissPairLogText(entry.text)
    const labelForA11y = [left.name, right.name, actionShort ?? emotionEmoji ?? "событие", repeatCount].join(", ")
    return (
      <div className="flex w-full justify-start">
        <div className={TABLE_CHAT_ROOM_EVENT_CHIP} aria-label={labelForA11y}>
          <div
            className={cn(
              "h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10",
              TABLE_CHAT_ROOM_AVATAR_RING,
            )}
          >
            <img
              src={left.avatar}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => tableChatPlayerAvatarOnError(e, left)}
            />
          </div>
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-500/50" strokeWidth={2.25} aria-hidden />
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex max-h-8 min-h-7 min-w-0 cursor-default items-center justify-center rounded outline-none focus-visible:outline-none",
                  fullPairActionLabel ? "max-w-[min(100%,12rem)]" : "max-w-[min(100%,7rem)]",
                )}
                aria-label={centralHint}
                tabIndex={0}
              >
                {entry.type === "bottle_thanks" ? (
                  <span className="inline-flex h-7 max-h-7 shrink-0 items-center overflow-visible" aria-hidden>
                    <ThanksCloudBubble variant="chat" />
                  </span>
                ) : emotionEmoji ? (
                  <span
                    className="flex h-7 w-7 shrink-0 select-none items-center justify-center text-[1.2rem] leading-none"
                    aria-hidden
                  >
                    {emotionEmoji}
                  </span>
                ) : giftImg ? (
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center" aria-hidden>
                    <img
                      src={giftImg}
                      alt=""
                      className="h-6 w-6 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
                    />
                  </span>
                ) : (
                  actionShort && (
                    <span
                      className={cn(
                        "shrink text-[10px] font-semibold leading-tight sm:text-[11px]",
                        fullPairActionLabel
                          ? "max-w-[min(100%,11rem)] whitespace-nowrap sm:max-w-[12rem]"
                          : "max-w-[5rem] truncate sm:max-w-[6.5rem]",
                      )}
                      style={{ color: accentColor }}
                    >
                      {actionShort}
                    </span>
                  )
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={6}
              className="border-0 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-100 shadow-xl"
            >
              {centralHint}
            </TooltipContent>
          </Tooltip>
          <span className={PAIR_FEED_REPEAT_COUNT_CLASS} aria-label={`Количество: ${repeatCount}`}>
            ×{repeatCount}
          </span>
          <ChevronRight className="h-3 w-3 shrink-0 text-slate-500/50" strokeWidth={2.25} aria-hidden />
          <div
            className={cn(
              "h-7 w-7 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10",
              TABLE_CHAT_ROOM_AVATAR_RING,
            )}
          >
            <img
              src={right.avatar}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => tableChatPlayerAvatarOnError(e, right)}
            />
          </div>
        </div>
      </div>
    )
  }

  const showJoinHello =
    entry.type === "join" &&
    entry.fromPlayer &&
    onJoinPlayerHello &&
    currentUserId != null &&
    entry.fromPlayer.id !== currentUserId &&
    !chatDisabled

  return (
    <div className={cn("flex w-full justify-start", showJoinHello ? "items-center gap-1" : "")}>
      <div className="inline-flex min-w-0 max-w-full flex-1 items-start gap-1.5 rounded-lg bg-white/[0.05] px-2 py-1 backdrop-blur-sm">
        {entry.fromPlayer && (
          <div
            className={cn(
              "h-8 w-8 shrink-0 overflow-hidden rounded-full",
              TABLE_CHAT_ROOM_AVATAR_RING,
            )}
          >
            <img
              src={entry.fromPlayer.avatar}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => tableChatPlayerAvatarOnError(e, entry.fromPlayer!)}
            />
          </div>
        )}
        <p
          className="min-w-0 flex flex-1 flex-wrap items-baseline gap-x-1.5 text-xs leading-snug sm:text-[13px] sm:leading-snug"
          style={{ color: accentColor }}
        >
          <span className="[text-wrap:pretty] [overflow-wrap:anywhere]">{entry.text}</span>
          {showRepeat && (
            <span
              className="shrink-0 rounded-md bg-white/10 px-1 py-px text-[0.62rem] font-bold tabular-nums text-white/90"
              aria-label={`Повторено ${repeatCount} раз`}
            >
              ×{repeatCount}
            </span>
          )}
        </p>
      </div>
      {showJoinHello ? (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onJoinPlayerHello(entry.fromPlayer!)}
              className="flex h-8 shrink-0 items-center gap-0.5 rounded-lg border border-cyan-500/35 bg-slate-900/80 px-1.5 text-[11px] font-extrabold text-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:bg-slate-800/90 hover:brightness-110 active:scale-[0.98]"
              aria-label="Поздороваться: привет всем за столом"
            >
              <Hand className="h-3.5 w-3.5 shrink-0 text-amber-300" strokeWidth={2.5} aria-hidden />
              <span className="hidden min-[360px]:inline">Привет</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="border-0 bg-slate-950 text-xs text-slate-100">
            Поприветствовать за столом (увидят все)
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}
