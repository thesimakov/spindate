"use client"

import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react"
import {
  GAME_TABLE_LOG_MAX_ENTRIES,
  type GameState,
  type GameAction,
  type PairKissOutcome,
  type Player,
  type InventoryItem,
  type GameLogEntry,
  type EmotionUseTodayBucket,
  type PopularityStats,
} from "./game-types"
import {
  DEFAULT_GIFT_CATALOG_ROWS,
  getPublishedShopGiftHeartCost,
  heartsFromGiftSellback,
} from "@/lib/gift-catalog"
import { generateBots as generateBotsImpl, AVATAR_FRAME_IDS, randomAvatarFrame as randomAvatarFrameImpl } from "@/lib/bots"
import { generateLogId as generateLogIdImpl, generateMessageId as generateMessageIdImpl } from "@/lib/ids"
import { getPairGenderCombo as getPairGenderComboImpl } from "@/lib/pair-utils"
import { apiFetch } from "@/lib/api-fetch"
import { userStatePutUrl } from "@/lib/persist-user-game-state"
import { buildVisualPrefsPayload } from "@/lib/user-visual-prefs"
import { authoritySnapshotExpiredBottleLease } from "@/lib/bottle-lease-expiry"
import { trimRoomChatMessages } from "@/lib/room-chat-retention"
import { mergeGameLogsForSync } from "@/lib/table-authority-merge"
import { getTableSyncDispatch } from "@/lib/table-sync-registry"
import { VIP_AUTO_FRAME_ID } from "@/lib/vip-avatar-frame"
import { getRoundDriverPlayerId } from "@/lib/round-driver-id"

/** Идентификаторы рамок аватарки (для ботов и профиля) */
export { AVATAR_FRAME_IDS }
export const randomAvatarFrame = randomAvatarFrameImpl
export const generateBots = generateBotsImpl
export const generateMessageId = generateMessageIdImpl
export const generateLogId = generateLogIdImpl
export const getPairGenderCombo = getPairGenderComboImpl

const initialState: GameState = {
  screen: "registration",
  currentUser: null,
  players: [],
  currentTurnIndex: 0,
  turnStartedAtMs: null,
  isSpinning: false,
  countdown: null,
  bottleAngle: 0,
  bottleSkin: "classic",
  tableStyle: "classic_night",
  targetPlayer: null,
  targetPlayer2: null,
  showResult: false,
  resultAction: null,
  favorites: [],
  admirers: [],
  chatWith: null,
  chatMessages: {},
  voiceBalance: 0,
  bonusBalance: 0,
  tableId: (() => {
    if (typeof window !== "undefined") {
      const saved = window.sessionStorage.getItem("spindate_tableId")
      if (saved) { const n = Number(saved); if (Number.isFinite(n) && n > 0) return n }
    }
    return Math.floor(Math.random() * 9999) + 1
  })(),
  roomCreatorPlayerId: null,
  authorityRevision: 0,
  gameLog: [],
  // Prediction & Betting
  predictions: [],
  bets: [],
  pot: 0,
  predictionPhase: false,
  roundNumber: 1,
  // Inventory
  inventory: [],
  // Player menu
  playerMenuTarget: null,
  courtshipProfileAllowed: {},
  allowChatInvite: {},
  // Meta
  tablesCount: undefined,
  ownedBottleSkins: ["classic"],
  extraTurnPlayerId: undefined,
  bottleCooldownUntil: undefined,
  bottleDonorId: undefined,
  bottleDonorName: undefined,
  drunkUntil: {},
  dailyQuests: {
    dateKey: "",
    claimed: [false, false, false, false, false],
  },
  rosesGiven: [],
  avatarFrames: {},
  ugadaikaRoundsWon: 0,
  ugadaikaRoundsByPlayer: {},
  ugadaikaPairMatchCount: {},
  ugadaikaFriendUnlocked: {},
  playerInUgadaika: null,
  showReturnedFromUgadaika: false,
  spinSkips: {},
  currentTurnDidSpin: false,
  intergameChatMessages: [],
  emotionDailyBoost: {
    dateKey: "",
    extraPerType: 0,
    extraByType: {},
    quotaBoostPurchasesCount: 0,
  },
  emotionUseTodayByPlayer: {},
  tablePaused: false,
  clientTabAway: {},
  gameSidePanel: null,
  chatPanelPlayer: null,
  pairKissPhase: null,
  popularityStats: null,
}

const ADMIRERS_LS_KEY = (userId: number) => `spindate_admirers_v1_${userId}`
const FAVORITES_LS_KEY = (userId: number) => `spindate_favorites_v1_${userId}`
const AVATAR_FRAME_LS_KEY = (userId: number) => `spindate_avatar_frame_v1_${userId}`
const BOTTLE_SKIN_LS_KEY = (userId: number) => `spindate_bottle_skin_v1_${userId}`
const BOTTLE_COOLDOWN_LS_KEY = (userId: number) => `spindate_bottle_cooldown_v1_${userId}`
/** "0" — пользователь выключил показ ВК после ухаживания; отсутствие ключа — по умолчанию разрешено */
const PROFILE_SHOW_VK_LS_KEY = (userId: number) => `spindate_profile_show_vk_v1_${userId}`
/** "1" — включены приглашения в личный чат */
const PROFILE_CHAT_INVITE_LS_KEY = (userId: number) => `spindate_profile_chat_invite_v1_${userId}`
const SOUNDS_ENABLED_KEY = "spindate_sounds_enabled"

function mergePredictionsForSync(
  local: GameState["predictions"],
  remote: GameState["predictions"],
  keepLocalOptimistic: boolean,
): GameState["predictions"] {
  if (!keepLocalOptimistic) return [...remote]
  const byPlayerId = new Map<number, GameState["predictions"][number]>()
  for (const prediction of remote) byPlayerId.set(prediction.playerId, prediction)
  for (const prediction of local) {
    if (!byPlayerId.has(prediction.playerId)) {
      byPlayerId.set(prediction.playerId, prediction)
    }
  }
  return Array.from(byPlayerId.values())
}

function mergeBetsForSync(
  local: GameState["bets"],
  remote: GameState["bets"],
  keepLocalOptimistic: boolean,
): GameState["bets"] {
  if (!keepLocalOptimistic) return [...remote]
  const byPlayerId = new Map<number, GameState["bets"][number]>()
  for (const bet of remote) byPlayerId.set(bet.playerId, bet)
  for (const bet of local) {
    if (!byPlayerId.has(bet.playerId)) {
      byPlayerId.set(bet.playerId, bet)
    }
  }
  return Array.from(byPlayerId.values())
}

function parseAdmirersFromStorage(raw: string): Player[] {
  try {
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    const out: Player[] = []
    for (const item of data) {
      if (!item || typeof item !== "object") continue
      const o = item as Record<string, unknown>
      const id = Number(o.id)
      if (!Number.isFinite(id)) continue
      const name = typeof o.name === "string" ? o.name : ""
      const avatar = typeof o.avatar === "string" ? o.avatar : ""
      const gender = o.gender === "female" ? "female" : "male"
      const age = typeof o.age === "number" && o.age > 0 ? Math.min(120, o.age) : 25
      const purpose =
        o.purpose === "love" || o.purpose === "communication" || o.purpose === "relationships"
          ? o.purpose
          : "relationships"
      out.push({
        id,
        name: name || `Игрок ${id}`,
        avatar: avatar || "",
        gender,
        age,
        purpose,
        isBot: Boolean(o.isBot),
      })
    }
    return out
  } catch {
    return []
  }
}

function persistAdmirersList(userId: number, list: Player[]) {
  if (typeof window === "undefined") return
  const data = JSON.stringify(list)
  try {
    window.localStorage.setItem(ADMIRERS_LS_KEY(userId), data)
  } catch {
    void 0
  }
  try {
    window.sessionStorage.setItem(ADMIRERS_LS_KEY(userId), data)
  } catch {
    void 0
  }
}

function persistFavoritesList(userId: number, list: Player[]) {
  if (typeof window === "undefined") return
  const data = JSON.stringify(list)
  try {
    window.localStorage.setItem(FAVORITES_LS_KEY(userId), data)
  } catch {
    void 0
  }
  try {
    window.sessionStorage.setItem(FAVORITES_LS_KEY(userId), data)
  } catch {
    void 0
  }
}

function dateKeyFromTimestamp(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function rebuildTodayLimitedEmotionsFromLog(
  log: GameLogEntry[],
  todayKey: string,
): Record<number, EmotionUseTodayBucket> {
  const out: Record<number, EmotionUseTodayBucket> = {}
  for (const e of log) {
    if (!e.fromPlayer) continue
    if (e.type !== "kiss" && e.type !== "beer" && e.type !== "cocktail") continue
    if (e.text.startsWith("Выпала пара:")) continue
    if (dateKeyFromTimestamp(e.timestamp) !== todayKey) continue
    const id = e.fromPlayer.id
    if (!out[id]) {
      out[id] = { dateKey: todayKey, kiss: 0, beer: 0, cocktail: 0 }
    }
    if (e.type === "kiss") out[id].kiss++
    else if (e.type === "beer") out[id].beer++
    else out[id].cocktail++
  }
  return out
}

/** При синхроне стола сохраняем локальные счётчики (в т.ч. с другого стола) и подмешиваем max с логом сервера. */
function mergeEmotionBucketsForSync(
  local: GameState["emotionUseTodayByPlayer"],
  fromLog: Record<number, EmotionUseTodayBucket>,
  todayKey: string,
): Record<number, EmotionUseTodayBucket> {
  const allPids = new Set<number>([
    ...Object.keys(local ?? {}).map(Number),
    ...Object.keys(fromLog).map(Number),
  ])
  const out: Record<number, EmotionUseTodayBucket> = {}
  for (const pid of allPids) {
    const prev = local?.[pid]
    const logB = fromLog[pid]
    const prevToday = prev && prev.dateKey === todayKey ? prev : null
    if (!logB && !prevToday) continue
    if (!logB) {
      out[pid] = { ...prevToday! }
      continue
    }
    if (!prevToday) {
      out[pid] = { ...logB }
      continue
    }
    out[pid] = {
      dateKey: todayKey,
      kiss: Math.max(prevToday.kiss, logB.kiss),
      beer: Math.max(prevToday.beer, logB.beer),
      cocktail: Math.max(prevToday.cocktail, logB.cocktail),
    }
  }
  return out
}

function bumpEmotionUseForLogEntry(
  prevMap: GameState["emotionUseTodayByPlayer"],
  entry: GameLogEntry,
): GameState["emotionUseTodayByPlayer"] {
  if (!entry.fromPlayer) return prevMap ?? {}
  if (entry.type !== "kiss" && entry.type !== "beer" && entry.type !== "cocktail") return prevMap ?? {}
  if (entry.text.startsWith("Выпала пара:")) return prevMap ?? {}
  const pid = entry.fromPlayer.id
  const dk = dateKeyFromTimestamp(entry.timestamp)
  const prev = prevMap?.[pid]
  const base: EmotionUseTodayBucket =
    prev && prev.dateKey === dk ? { ...prev } : { dateKey: dk, kiss: 0, beer: 0, cocktail: 0 }
  if (entry.type === "kiss") base.kiss++
  else if (entry.type === "beer") base.beer++
  else base.cocktail++
  return { ...(prevMap ?? {}), [pid]: base }
}

const ECONOMY_MUTATION_ACTIONS = new Set<GameAction["type"]>([
  "PAY_VOICES",
  "ADD_VOICES",
  "RESTORE_GAME_STATE",
  "ADD_BONUS",
  "BUY_EMOTION_PACK",
  "BUY_EMOTION_QUOTA_SELECTION",
  "PLACE_BET",
  "ADD_INVENTORY_ITEM",
  "GIVE_ROSE",
  "EXCHANGE_ROSES_FOR_VOICES",
  "EXCHANGE_VOICES_FOR_ROSES",
  "EXCHANGE_INVENTORY_GIFT_FOR_VOICES",
  "REMOVE_INVENTORY_ROSES",
  "UGADAIKA_ADD_ROUND_WON",
])

function clampBalance(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.floor(v))
}

function inventoryEquals(a: InventoryItem[], b: InventoryItem[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.type !== y.type ||
      x.fromPlayerId !== y.fromPlayerId ||
      x.fromPlayerName !== y.fromPlayerName ||
      x.timestamp !== y.timestamp ||
      x.toPlayerId !== y.toPlayerId
    ) {
      return false
    }
  }
  return true
}

/**
 * Экономическая защита:
 * - неэкономические экшены (UI/дизайн/навигация/синк стола) не могут менять банк/инвентарь;
 * - баланс всегда неотрицательный и конечный.
 */
function protectEconomy(prev: GameState, next: GameState, action: GameAction): GameState {
  let protectedState = next

  const nextVoice = clampBalance(next.voiceBalance)
  const nextBonus = clampBalance(next.bonusBalance)
  if (nextVoice !== next.voiceBalance || nextBonus !== next.bonusBalance) {
    protectedState = { ...protectedState, voiceBalance: nextVoice, bonusBalance: nextBonus }
  }

  if (ECONOMY_MUTATION_ACTIONS.has(action.type)) return protectedState

  const voiceChanged = protectedState.voiceBalance !== prev.voiceBalance
  const bonusChanged = protectedState.bonusBalance !== prev.bonusBalance
  const inventoryChanged = !inventoryEquals(protectedState.inventory, prev.inventory)
  if (!voiceChanged && !bonusChanged && !inventoryChanged) return protectedState

  return {
    ...protectedState,
    voiceBalance: prev.voiceBalance,
    bonusBalance: prev.bonusBalance,
    inventory: prev.inventory,
  }
}

function gameReducerCore(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_GAME_SIDE_PANEL":
      return {
        ...state,
        gameSidePanel: action.panel,
        chatPanelPlayer: action.panel === "player-chat" ? state.chatPanelPlayer : null,
      }
    case "OPEN_SIDE_CHAT":
      return { ...state, gameSidePanel: "player-chat", chatPanelPlayer: action.player }
    case "SET_SCREEN": {
      if (action.screen === "profile") {
        return { ...state, screen: "game", gameSidePanel: "profile" }
      }
      if (action.screen === "shop") {
        return { ...state, screen: "game", gameSidePanel: "shop" }
      }
      if (action.screen === "favorites") {
        return { ...state, screen: "game", gameSidePanel: "favorites" }
      }
      if (action.screen === "ugadaika") {
        return {
          ...state,
          screen: action.screen,
          playerInUgadaika: state.currentUser?.id ?? null,
          gameSidePanel: null,
        }
      }
      if (action.screen === "game" && state.playerInUgadaika != null) {
        return {
          ...state,
          screen: action.screen,
          playerInUgadaika: null,
          showReturnedFromUgadaika: true,
          gameSidePanel: null,
        }
      }
      const leaveGame = action.screen !== "game"
      return {
        ...state,
        screen: action.screen,
        gameSidePanel: leaveGame ? null : state.gameSidePanel,
      }
    }
    case "SET_USER": {
      let admirers: Player[] = []
      let favorites: Player[] = []
      let restoredFrameId: string | null = null
      try {
        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(ADMIRERS_LS_KEY(action.user.id))
            ?? window.sessionStorage.getItem(ADMIRERS_LS_KEY(action.user.id))
          if (raw) admirers = parseAdmirersFromStorage(raw)
          const rawFav = window.localStorage.getItem(FAVORITES_LS_KEY(action.user.id))
            ?? window.sessionStorage.getItem(FAVORITES_LS_KEY(action.user.id))
          if (rawFav) favorites = parseAdmirersFromStorage(rawFav)
          const savedFrame = window.localStorage.getItem(AVATAR_FRAME_LS_KEY(action.user.id))
          if (savedFrame && savedFrame !== "none") restoredFrameId = savedFrame
        }
      } catch {
        admirers = []
        favorites = []
      }
      let mergedUser = action.user
      try {
        if (typeof window !== "undefined") {
          if (window.localStorage.getItem(PROFILE_SHOW_VK_LS_KEY(action.user.id)) === "0") {
            mergedUser = { ...mergedUser, showVkAfterCare: false }
          }
          if (window.localStorage.getItem(PROFILE_CHAT_INVITE_LS_KEY(action.user.id)) === "1") {
            mergedUser = { ...mergedUser, openToChatInvites: true }
          }
        }
      } catch {
        /* ignore */
      }
      const nextFrames = { ...(state.avatarFrames ?? {}) }
      if (restoredFrameId) nextFrames[action.user.id] = restoredFrameId
      const uid = mergedUser.id
      return {
        ...state,
        currentUser: mergedUser,
        admirers,
        favorites,
        avatarFrames: nextFrames,
        bottleSkin: state.bottleSkin ?? "classic",
        ownedBottleSkins:
          state.ownedBottleSkins && state.ownedBottleSkins.length > 0 ? state.ownedBottleSkins : ["classic"],
        bottleCooldownUntil: undefined,
        bottleDonorId: undefined,
        bottleDonorName: undefined,
        tableStyle: state.tableStyle ?? "classic_night",
        courtshipProfileAllowed: {
          ...(state.courtshipProfileAllowed ?? {}),
          [uid]: mergedUser.showVkAfterCare !== false,
        },
        allowChatInvite: {
          ...(state.allowChatInvite ?? {}),
          [uid]: mergedUser.openToChatInvites === true,
        },
      }
    }
    case "CLEAR_USER":
      return {
        ...state,
        currentUser: null,
        players: [],
        popularityStats: null,
        tableId: (() => {
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.removeItem("spindate_tableId")
            } catch {
              void 0
            }
          }
          return Math.floor(Math.random() * 9999) + 1
        })(),
        roomCreatorPlayerId: null,
        gameSidePanel: null,
      }
    case "ADD_DRUNK_TIME": {
      const now = Date.now()
      const current = state.drunkUntil?.[action.playerId] ?? 0
      const base = Math.max(now, current)
      const next = base + action.ms
      return {
        ...state,
        drunkUntil: {
          ...(state.drunkUntil ?? {}),
          [action.playerId]: next,
        },
      }
    }
    case "UPDATE_USER_NAME": {
      const updatedPlayers = state.players.map((p) =>
        p.id === action.playerId ? { ...p, name: action.name } : p,
      )
      const updatedUser =
        state.currentUser && state.currentUser.id === action.playerId
          ? { ...state.currentUser, name: action.name }
          : state.currentUser
      return { ...state, players: updatedPlayers, currentUser: updatedUser }
    }
    case "UPDATE_USER_AVATAR": {
      const updatedPlayers = state.players.map((p) =>
        p.id === action.playerId ? { ...p, avatar: action.avatar } : p,
      )
      const updatedUser =
        state.currentUser && state.currentUser.id === action.playerId
          ? { ...state.currentUser, avatar: action.avatar }
          : state.currentUser
      return { ...state, players: updatedPlayers, currentUser: updatedUser }
    }
    case "UPDATE_USER_STATUS": {
      const nextStatus = action.status.trim().slice(0, 15)
      const updatedPlayers = state.players.map((p) =>
        p.id === action.playerId ? { ...p, status: nextStatus } : p,
      )
      const updatedUser =
        state.currentUser && state.currentUser.id === action.playerId
          ? { ...state.currentUser, status: nextStatus }
          : state.currentUser
      return { ...state, players: updatedPlayers, currentUser: updatedUser }
    }
    case "SET_PLAYERS": {
      // Синхронизация комнаты: если текущий пользователь по каким-то причинам
      // отсутствует в приходящем списке игроков, добавляем его обратно.
      const incoming = action.players
      const incomingIds = new Set(incoming.map((p) => p.id))

      // Во время вращения/результата нельзя менять порядок игроков, иначе бутылка
      // будет указывать на одного, а имена/таргеты — на другого.
      // Поэтому сохраняем текущий порядок, удаляем выбывших и добавляем новичков в конец.
      let nextPlayers: Player[]
      if (state.isSpinning || state.showResult) {
        const byId = new Map<number, Player>()
        for (const p of incoming) byId.set(p.id, p)

        nextPlayers = state.players
          .filter((p) => byId.has(p.id))
          .map((p) => byId.get(p.id)!)

        const existingIds = new Set(nextPlayers.map((p) => p.id))
        for (const p of incoming) {
          if (!existingIds.has(p.id)) nextPlayers.push(p)
        }
      } else {
        nextPlayers = incoming
      }

      if (state.currentUser && !incomingIds.has(state.currentUser.id) && !nextPlayers.some((p) => p.id === state.currentUser!.id)) {
        nextPlayers = [state.currentUser, ...nextPlayers]
      }

      const existingById = new Map(state.players.map((p) => [p.id, p]))
      nextPlayers = nextPlayers.map((p) => {
        const prev = existingById.get(p.id)
        const currentStatus = state.currentUser?.id === p.id ? state.currentUser.status : undefined
        return {
          ...p,
          status: p.status ?? currentStatus ?? prev?.status,
          showVkAfterCare: "showVkAfterCare" in p ? p.showVkAfterCare : prev?.showVkAfterCare,
          openToChatInvites: "openToChatInvites" in p ? p.openToChatInvites : prev?.openToChatInvites,
        }
      })

      const current = state.players[state.currentTurnIndex]
      let nextIndex = 0
      let turnPlayerLeft = false
      if (current) {
        const idx = nextPlayers.findIndex((p) => p.id === current.id)
        if (idx !== -1) {
          nextIndex = idx
        } else {
          turnPlayerLeft = !current.isBot
          nextIndex = 0
        }
      }

      const nextTarget = state.targetPlayer ? nextPlayers.find((p) => p.id === state.targetPlayer!.id) ?? null : null
      const nextTarget2 = state.targetPlayer2 ? nextPlayers.find((p) => p.id === state.targetPlayer2!.id) ?? null : null

      const resetActive = turnPlayerLeft ? {
        isSpinning: false,
        countdown: null as number | null,
        turnStartedAtMs: Date.now(),
        showResult: false,
        resultAction: null as string | null,
        targetPlayer: null as Player | null,
        targetPlayer2: null as Player | null,
      } : {}

      return {
        ...state,
        players: nextPlayers,
        currentTurnIndex: nextPlayers.length === 0 ? 0 : Math.min(nextIndex, nextPlayers.length - 1),
        targetPlayer: nextTarget,
        targetPlayer2: nextTarget2,
        ...resetActive,
      }
    }
    case "SET_TABLE_ID":
      return { ...state, tableId: action.tableId }
    case "SET_TABLE":
      // При входе/смене стола мы "подключаемся" к уже идущей игре:
      // не делаем жёсткий сброс раунда/очереди, а создаём состояние,
      // похожее на уже активную комнату.
      {
        const tableChanged = action.tableId !== state.tableId
        const now = Date.now()
        const nextPlayersRaw = action.players
        const existingById = new Map(state.players.map((p) => [p.id, p]))
        const nextPlayers = nextPlayersRaw.map((p) => {
          const prev = existingById.get(p.id)
          const currentStatus = state.currentUser?.id === p.id ? state.currentUser.status : undefined
          return {
            ...p,
            status: p.status ?? currentStatus ?? prev?.status,
            showVkAfterCare: "showVkAfterCare" in p ? p.showVkAfterCare : prev?.showVkAfterCare,
            openToChatInvites: "openToChatInvites" in p ? p.openToChatInvites : prev?.openToChatInvites,
          }
        })
        const spinnerIdx = nextPlayers.length > 0 ? Math.floor(Math.random() * nextPlayers.length) : 0
        const spinner = nextPlayers[spinnerIdx]
        const others = spinner ? nextPlayers.filter((p) => p.id !== spinner.id) : []

        const target1 = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : null
        const target2 =
          others.length > 1
            ? (() => {
                const pool = others.filter((p) => p.id !== target1?.id)
                return pool[Math.floor(Math.random() * pool.length)]
              })()
            : null

        let bottleAngle = Math.floor(Math.random() * 360)
        let showResult = false
        let resultAction: string | null = null
        let targetPlayer: Player | null = null
        let targetPlayer2: Player | null = null
        let seedLog: GameState["gameLog"] = state.gameLog.slice(-20)

        if (spinner && target1 && target2 && nextPlayers.length >= 3) {
          const targetIdx = nextPlayers.findIndex((p) => p.id === target1.id)
          const segmentDeg = 360 / nextPlayers.length
          const targetDeg = -90 + segmentDeg * targetIdx
          bottleAngle = ((targetDeg + 90) % 360 + 360) % 360

          targetPlayer = target1
          targetPlayer2 = target2
          showResult = true

          const combo = getPairGenderCombo(target1, target2)
          if (combo === "MF") resultAction = "kiss"
          else if (combo === "MM") resultAction = "beer"
          else resultAction = "cocktail"

          const pairText = `${target1.name} & ${target2.name}`
          seedLog = [
            ...seedLog,
            {
              id: generateLogId(),
              type: "system",
              fromPlayer: spinner,
              toPlayer: target1,
              text: `Выпала пара: ${pairText}`,
              timestamp: now,
            },
          ]
        }

        // Рандомные рамки для ботов при посадке за стол
        const nextFrames = { ...(state.avatarFrames ?? {}) }
        for (const p of nextPlayers) {
          if (p.isBot) nextFrames[p.id] = randomAvatarFrame()
        }
        const nextSpinSkips: Record<number, number> = {}
        nextPlayers.forEach((p) => { nextSpinSkips[p.id] = 0 })

        let nextRoomCreator = state.roomCreatorPlayerId ?? null
        if (action.roomCreatorPlayerId !== undefined) {
          nextRoomCreator = action.roomCreatorPlayerId
        } else if (action.tableId !== state.tableId) {
          nextRoomCreator = null
        }

        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem("spindate_tableId", String(action.tableId))
          } catch {
            void 0
          }
        }
        return {
        ...state,
        authorityRevision: tableChanged ? 0 : (state.authorityRevision ?? 0),
        players: nextPlayers,
        tableId: action.tableId,
        roomCreatorPlayerId: nextRoomCreator,
        currentTurnIndex: spinnerIdx,
        turnStartedAtMs: now,
        spinSkips: nextSpinSkips,
        currentTurnDidSpin: false,
        isSpinning: false,
        countdown: null,
        bottleAngle,
        bottleSkin: tableChanged ? (action.bottleSkin ?? "classic") : (action.bottleSkin ?? state.bottleSkin ?? "classic"),
        ownedBottleSkins: tableChanged ? ["classic"] : (state.ownedBottleSkins ?? ["classic"]),
        bottleCooldownUntil: tableChanged ? undefined : state.bottleCooldownUntil,
        bottleDonorId: tableChanged ? undefined : state.bottleDonorId,
        bottleDonorName: tableChanged ? undefined : state.bottleDonorName,
        tableStyle: action.tableStyle ?? state.tableStyle ?? "classic_night",
        targetPlayer,
        targetPlayer2,
        showResult,
        resultAction,
        predictions: [],
        bets: [],
        pot: 0,
        predictionPhase: false,
        roundNumber: 5 + Math.floor(Math.random() * 25),
        gameLog: seedLog.slice(-GAME_TABLE_LOG_MAX_ENTRIES),
        avatarFrames: nextFrames,
        clientTabAway: {},
        pairKissPhase: null,
        }
      }
    case "SET_TABLES_COUNT":
      return { ...state, tablesCount: action.tablesCount }
    case "START_COUNTDOWN":
      if (state.countdown !== null || state.isSpinning) return state
      return { ...state, countdown: 3, turnStartedAtMs: state.turnStartedAtMs ?? Date.now() }
    case "TICK_COUNTDOWN":
      return {
        ...state,
        countdown: state.countdown !== null && state.countdown > 1 ? state.countdown - 1 : null,
      }
    case "START_SPIN": {
      const spinnerId = state.players[state.currentTurnIndex]?.id
      const nextSpinSkips = { ...(state.spinSkips ?? {}) }
      if (spinnerId != null) nextSpinSkips[spinnerId] = 0
      return {
        ...state,
        isSpinning: true,
        countdown: null,
        bottleAngle: action.angle,
        targetPlayer: action.target,
        targetPlayer2: action.target2,
        predictionPhase: false,
        spinSkips: nextSpinSkips,
        currentTurnDidSpin: true,
        pairKissPhase: null,
      }
    }
    case "STOP_SPIN":
      return { ...state, isSpinning: false, showResult: true, resultAction: action.action }
    case "BEGIN_PAIR_KISS_PHASE": {
      return {
        ...state,
        pairKissPhase: {
          roundKey: action.roundKey,
          deadlineMs: action.deadlineMs,
          idA: action.idA,
          idB: action.idB,
          choiceA: null,
          choiceB: null,
          resolved: false,
          outcome: null,
        },
      }
    }
    case "SET_PAIR_KISS_CHOICE": {
      const ph = state.pairKissPhase
      if (!ph || ph.resolved) return state
      if (action.playerId !== ph.idA && action.playerId !== ph.idB) return state
      if (action.playerId === ph.idA && ph.choiceA !== null) return state
      if (action.playerId === ph.idB && ph.choiceB !== null) return state
      const choiceA = action.playerId === ph.idA ? action.yes : ph.choiceA
      const choiceB = action.playerId === ph.idB ? action.yes : ph.choiceB
      return {
        ...state,
        pairKissPhase: {
          ...ph,
          choiceA,
          choiceB,
        },
      }
    }
    case "FINALIZE_PAIR_KISS": {
      const ph = state.pairKissPhase
      if (!ph || ph.resolved) return state
      const ca = ph.choiceA ?? false
      const cb = ph.choiceB ?? false
      let outcome: PairKissOutcome
      if (ca && cb) outcome = "both_yes"
      else if (ca && !cb) outcome = "only_a"
      else if (!ca && cb) outcome = "only_b"
      else outcome = "both_no"
      return {
        ...state,
        pairKissPhase: {
          ...ph,
          choiceA: ca,
          choiceB: cb,
          resolved: true,
          outcome,
        },
      }
    }
    case "NEXT_TURN": {
      if (state.players.length === 0) {
        return {
          ...state,
          currentTurnIndex: 0,
          showResult: false,
          targetPlayer: null,
          targetPlayer2: null,
          resultAction: null,
          predictions: [],
          bets: [],
          pot: 0,
          predictionPhase: false,
          extraTurnPlayerId: undefined,
          pairKissPhase: null,
        }
      }

      let nextIndex = (state.currentTurnIndex + 1) % state.players.length

      if (state.extraTurnPlayerId != null) {
        const idx = state.players.findIndex(p => p.id === state.extraTurnPlayerId)
        if (idx !== -1) {
          nextIndex = idx
        }
      }

      const inUgadaika = state.playerInUgadaika ?? null
      if (inUgadaika != null && state.players.length > 0) {
        let steps = 0
        while (state.players[nextIndex]?.id === inUgadaika && steps < state.players.length) {
          nextIndex = (nextIndex + 1) % state.players.length
          steps++
        }
      }

      const nextSpinSkips = { ...(state.spinSkips ?? {}) }
      const playerWhoHadTurnId = state.players[state.currentTurnIndex]?.id
      if (!state.currentTurnDidSpin && playerWhoHadTurnId != null) {
        nextSpinSkips[playerWhoHadTurnId] = (state.spinSkips?.[playerWhoHadTurnId] ?? 0) + 1
      }

      return {
        ...state,
        spinSkips: nextSpinSkips,
        currentTurnDidSpin: false,
        currentTurnIndex: nextIndex,
        turnStartedAtMs: Date.now(),
        showResult: false,
        targetPlayer: null,
        targetPlayer2: null,
        resultAction: null,
        bottleAngle: state.bottleAngle,
        predictions: [],
        bets: [],
        pot: 0,
        predictionPhase: false,
        roundNumber: state.roundNumber + 1,
        extraTurnPlayerId: undefined,
        pairKissPhase: null,
      }
    }
    case "ADD_FAVORITE": {
      if (state.favorites.find((f) => f.id === action.player.id)) return state
      const nextFav = [...state.favorites, action.player]
      if (state.currentUser) persistFavoritesList(state.currentUser.id, nextFav)
      return { ...state, favorites: nextFav }
    }
    case "ADD_ADMIRER": {
      if (!state.currentUser || state.currentUser.id === action.player.id) return state
      if (state.admirers.find((a) => a.id === action.player.id)) return state
      const next = [...state.admirers, action.player]
      persistAdmirersList(state.currentUser.id, next)
      return { ...state, admirers: next }
    }
    case "REMOVE_ADMIRER": {
      if (!state.currentUser) return state
      const next = state.admirers.filter((a) => a.id !== action.playerId)
      persistAdmirersList(state.currentUser.id, next)
      return { ...state, admirers: next }
    }
    case "OPEN_CHAT":
      return { ...state, chatWith: action.player, screen: "chat" }
    case "SEND_MESSAGE": {
      const existing = state.chatMessages[action.toId] || []
      return {
        ...state,
        chatMessages: {
          ...state.chatMessages,
          [action.toId]: [...existing, action.message],
        },
      }
    }
    case "SEND_GENERAL_CHAT": {
      const list = [...(state.generalChatMessages ?? []), action.message]
      return { ...state, generalChatMessages: trimRoomChatMessages(list) }
    }
    case "SEND_INTERGAME_CHAT": {
      const list = [...(state.intergameChatMessages ?? []), action.message]
      const kept = list.slice(-200)
      return { ...state, intergameChatMessages: kept }
    }
    case "PAY_VOICES":
      return { ...state, voiceBalance: Math.max(0, state.voiceBalance - action.amount) }
    case "ADD_VOICES":
      return { ...state, voiceBalance: state.voiceBalance + action.amount }
    case "RESTORE_GAME_STATE": {
      const vp = action.visualPrefs
      let nextSounds = state.soundsEnabled
      if (vp?.soundsEnabled !== undefined) {
        nextSounds = vp.soundsEnabled
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(SOUNDS_ENABLED_KEY, vp.soundsEnabled ? "1" : "0")
          }
        } catch {
          /* ignore */
        }
      }
      let nextAvatarFrames = { ...(state.avatarFrames ?? {}) }
      const pid = action.playerIdForVisuals
      if (pid != null && vp?.avatarFrameId !== undefined) {
        if (vp.avatarFrameId === null || vp.avatarFrameId === "none") {
          const { [pid]: _, ...rest } = nextAvatarFrames
          nextAvatarFrames = rest
          try {
            if (typeof window !== "undefined") window.localStorage.removeItem(AVATAR_FRAME_LS_KEY(pid))
          } catch {
            /* ignore */
          }
        } else {
          nextAvatarFrames = { ...nextAvatarFrames, [pid]: vp.avatarFrameId }
          try {
            if (typeof window !== "undefined")
              window.localStorage.setItem(AVATAR_FRAME_LS_KEY(pid), vp.avatarFrameId)
          } catch {
            /* ignore */
          }
        }
      }
      return {
        ...state,
        voiceBalance: Math.max(0, action.voiceBalance),
        inventory: Array.isArray(action.inventory) ? [...action.inventory] : [],
        ...(vp?.tableStyle ? { tableStyle: vp.tableStyle } : {}),
        ...(vp?.ownedBottleSkins !== undefined ? { ownedBottleSkins: [...vp.ownedBottleSkins] } : {}),
        ...(vp?.soundsEnabled !== undefined ? { soundsEnabled: nextSounds } : {}),
        avatarFrames: nextAvatarFrames,
        gameSidePanel: null,
      }
    }
    case "ADD_BONUS":
      return { ...state, bonusBalance: state.bonusBalance + action.amount }
    case "RESET_ROUND":
      return {
        ...state,
        showResult: false,
        targetPlayer: null,
        targetPlayer2: null,
        resultAction: null,
        isSpinning: false,
        pairKissPhase: null,
      }
    case "ADD_LOG": {
      const nextLog = [...state.gameLog.slice(-GAME_TABLE_LOG_MAX_ENTRIES), action.entry].slice(-GAME_TABLE_LOG_MAX_ENTRIES)
      let nextAdmirers = state.admirers
      // «Ухаживать»: если кто-то ухаживает за текущим пользователем — добавить в поклонники
      if (
        action.entry.type === "care" &&
        action.entry.fromPlayer &&
        action.entry.toPlayer &&
        state.currentUser &&
        action.entry.toPlayer.id === state.currentUser.id &&
        action.entry.fromPlayer.id !== state.currentUser.id &&
        !state.admirers.some((a) => a.id === action.entry.fromPlayer!.id)
      ) {
        nextAdmirers = [...state.admirers, action.entry.fromPlayer]
        persistAdmirersList(state.currentUser.id, nextAdmirers)
      }
      return {
        ...state,
        gameLog: nextLog,
        admirers: nextAdmirers,
        emotionUseTodayByPlayer: bumpEmotionUseForLogEntry(state.emotionUseTodayByPlayer, action.entry),
      }
    }
    case "REQUEST_EXTRA_TURN":
      return { ...state, extraTurnPlayerId: action.playerId }
    case "SET_BOTTLE_COOLDOWN_UNTIL":
      try {
        if (typeof window !== "undefined" && state.currentUser?.id != null) {
          const uid = state.currentUser.id
          if (action.ts != null) {
            window.localStorage.setItem(BOTTLE_COOLDOWN_LS_KEY(uid), String(action.ts))
          } else {
            window.localStorage.removeItem(BOTTLE_COOLDOWN_LS_KEY(uid))
          }
        }
      } catch {
        // ignore
      }
      return { ...state, bottleCooldownUntil: action.ts }
    case "SET_BOTTLE_DONOR":
      return { ...state, bottleDonorId: action.playerId, bottleDonorName: action.playerName }
    case "SET_BOTTLE_TABLE_PURCHASE": {
      try {
        if (typeof window !== "undefined" && state.currentUser?.id != null) {
          const uid = state.currentUser.id
          window.localStorage.setItem(BOTTLE_SKIN_LS_KEY(uid), action.skin)
          window.localStorage.setItem(BOTTLE_COOLDOWN_LS_KEY(uid), String(action.cooldownUntil))
        }
      } catch {
        /* ignore */
      }
      return {
        ...state,
        bottleSkin: action.skin,
        ownedBottleSkins: Array.from(new Set([...(state.ownedBottleSkins ?? ["classic"]), action.skin])),
        bottleCooldownUntil: action.cooldownUntil,
        bottleDonorId: action.donorId,
        bottleDonorName: action.donorName,
      }
    }
    case "CLEAR_RETURNED_FROM_UGADAIKA":
      return { ...state, showReturnedFromUgadaika: false }
    case "SET_SOUNDS_ENABLED": {
      try {
        if (typeof window !== "undefined") window.localStorage.setItem("spindate_sounds_enabled", action.enabled ? "1" : "0")
      } catch {
        // ignore
      }
      return { ...state, soundsEnabled: action.enabled }
    }
    case "BUY_EMOTION_PACK": {
      if (action.cost < 0 || action.extraPerType <= 0) return state
      if (state.voiceBalance < action.cost) return state
      const currentBoost = state.emotionDailyBoost
      const sameDay = Boolean(currentBoost?.dateKey) && currentBoost?.dateKey === action.dateKey
      const nextExtra = (sameDay ? currentBoost?.extraPerType ?? 0 : 0) + action.extraPerType
      const mergedExtraByType = sameDay ? { ...(currentBoost?.extraByType ?? {}) } : {}
      const qCount = sameDay ? (currentBoost?.quotaBoostPurchasesCount ?? 0) : 0
      return {
        ...state,
        voiceBalance: state.voiceBalance - action.cost,
        emotionDailyBoost: {
          dateKey: action.dateKey,
          extraPerType: nextExtra,
          extraByType: mergedExtraByType,
          quotaBoostPurchasesCount: qCount,
        },
      }
    }
    case "BUY_EMOTION_QUOTA_SELECTION": {
      const { dateKey, selectedTypes, extraPerPurchase } = action
      if (!selectedTypes.length || extraPerPurchase <= 0) return state
      const cur = state.emotionDailyBoost ?? {
        dateKey: "",
        extraPerType: 0,
        extraByType: {},
        quotaBoostPurchasesCount: 0,
      }
      const sameDay = Boolean(cur.dateKey) && cur.dateKey === dateKey
      const prevPurchases = sameDay ? (cur.quotaBoostPurchasesCount ?? 0) : 0
      const costPerType = prevPurchases === 0 ? 5 : 15
      const totalCost = selectedTypes.length * costPerType
      if (state.voiceBalance < totalCost) return state
      // Только совпадение даты (без «truthy» extraByType) — иначе после первой покупки
      // { kiss: 50 } терялся при повторном мерже из-за `sameDay && cur?.extraByType`.
      const extraByType: Partial<Record<"kiss" | "beer" | "cocktail", number>> = sameDay
        ? { ...(cur.extraByType ?? {}) }
        : {}
      const legacy = sameDay ? (cur.extraPerType ?? 0) : 0
      for (const t of selectedTypes) {
        if (t !== "kiss" && t !== "beer" && t !== "cocktail") continue
        extraByType[t] = (extraByType[t] ?? 0) + extraPerPurchase
      }
      return {
        ...state,
        voiceBalance: state.voiceBalance - totalCost,
        emotionDailyBoost: {
          dateKey,
          extraPerType: legacy,
          extraByType,
          quotaBoostPurchasesCount: prevPurchases + 1,
        },
      }
    }

    case "SET_TABLE_PAUSED":
      return { ...state, tablePaused: action.paused }

    case "SET_CLIENT_TAB_AWAY": {
      const next = { ...(state.clientTabAway ?? {}) }
      if (action.away) {
        next[action.playerId] = true
      } else {
        delete next[action.playerId]
      }
      return { ...state, clientTabAway: next }
    }

    // ---- Daily quests ----
    case "CLAIM_DAILY_QUEST": {
      const todayKey = action.dateKey
      const idx = Math.max(0, Math.min(4, action.questIndex))
      const base = state.dailyQuests?.dateKey === todayKey
        ? state.dailyQuests!
        : {
            dateKey: todayKey,
            claimed: [false, false, false, false, false] as [boolean, boolean, boolean, boolean, boolean],
          }
      if (base.claimed[idx]) return state
      const claimed = [...base.claimed] as [boolean, boolean, boolean, boolean, boolean]
      claimed[idx] = true
      return { ...state, dailyQuests: { ...base, claimed } }
    }

    // ---- Prediction system ----
    case "START_PREDICTION_PHASE":
      return { ...state, predictionPhase: true, predictions: [], bets: [], pot: 0 }
    case "END_PREDICTION_PHASE":
      return { ...state, predictionPhase: false }
    case "ADD_PREDICTION": {
      // One prediction per player per round
      const filtered = state.predictions.filter(p => p.playerId !== action.prediction.playerId)
      return { ...state, predictions: [...filtered, action.prediction] }
    }
    case "CLEAR_PREDICTIONS":
      return { ...state, predictions: [] }

    // ---- Betting system ----
    case "PLACE_BET": {
      return {
        ...state,
        bets: [...state.bets, action.bet],
        pot: state.pot + action.bet.amount,
        voiceBalance: state.voiceBalance - action.bet.amount,
      }
    }
    case "CLEAR_BETS":
      return { ...state, bets: [], pot: 0 }
    case "ADD_TO_POT":
      return { ...state, pot: state.pot + action.amount }
    case "RESET_POT":
      return { ...state, pot: 0 }

    // ---- Inventory ----
    case "ADD_INVENTORY_ITEM":
      return { ...state, inventory: [...state.inventory, action.item] }
    case "GIVE_ROSE": {
      const roseCost = 50
      if (state.voiceBalance < roseCost) return state
      return {
        ...state,
        voiceBalance: state.voiceBalance - roseCost,
        rosesGiven: [
          ...(state.rosesGiven ?? []),
          {
            fromPlayerId: action.fromPlayerId,
            toPlayerId: action.toPlayerId,
            timestamp: Date.now(),
          },
        ],
      }
    }
    case "EXCHANGE_ROSES_FOR_VOICES": {
      const roses = state.inventory.filter((i) => i.type === "rose")
      const toRemove = Math.min(action.amount, roses.length)
      if (toRemove <= 0) return state
      const rest = state.inventory.filter((i) => i.type !== "rose")
      const rosesLeft = roses.slice(toRemove)
      return {
        ...state,
        inventory: [...rest, ...rosesLeft],
        voiceBalance: state.voiceBalance + toRemove * 15,
      }
    }
    case "EXCHANGE_VOICES_FOR_ROSES": {
      const costPerRose = 20
      const cost = action.amount * costPerRose
      if (state.voiceBalance < cost || action.amount <= 0) return state
      const newRoses = Array.from({ length: action.amount }, (_, i) => ({
        type: "rose" as const,
        fromPlayerId: 0,
        fromPlayerName: "Магазин",
        timestamp: Date.now() + i,
      }))
      return {
        ...state,
        voiceBalance: state.voiceBalance - cost,
        inventory: [...state.inventory, ...newRoses],
      }
    }
    case "EXCHANGE_INVENTORY_GIFT_FOR_VOICES": {
      const bundledGiftRows = DEFAULT_GIFT_CATALOG_ROWS.filter((r) => r.published && !r.deleted)
      const cost = getPublishedShopGiftHeartCost(action.giftType, bundledGiftRows)
      if (cost == null) return state
      const gain = heartsFromGiftSellback(cost)
      if (gain < 1) return state
      const idx = state.inventory.findIndex((i) => i.type === action.giftType)
      if (idx < 0) return state
      const nextInventory = state.inventory.filter((_, j) => j !== idx)
      return {
        ...state,
        inventory: nextInventory,
        voiceBalance: state.voiceBalance + gain,
      }
    }
    case "REMOVE_INVENTORY_ROSES": {
      const roses = state.inventory.filter((i) => i.type === "rose")
      const toRemove = Math.min(action.amount, roses.length)
      if (toRemove <= 0) return state
      const rest = state.inventory.filter((i) => i.type !== "rose")
      const rosesLeft = roses.slice(toRemove)
      return { ...state, inventory: [...rest, ...rosesLeft] }
    }
    case "CLAIM_WELCOME_GIFT": {
      /* Раньше: +150 за первый вход. Награды теперь через ежедневную серию в DailyStreakBonusDialog. */
      return { ...state }
    }
    case "UGADAIKA_ADD_ROUND_WON": {
      const uid = state.currentUser?.id
      const nextTotal = (state.ugadaikaRoundsWon ?? 0) + 1
      const byPlayer = { ...(state.ugadaikaRoundsByPlayer ?? {}) }
      if (uid != null) {
        byPlayer[uid] = (byPlayer[uid] ?? 0) + 1
      }
      let nextState: GameState = {
        ...state,
        ugadaikaRoundsWon: nextTotal,
        ugadaikaRoundsByPlayer: byPlayer,
        voiceBalance: state.voiceBalance + 20,
      }
      if (nextTotal % 10 === 0) {
        const newRose: InventoryItem = {
          type: "rose",
          fromPlayerId: 0,
          fromPlayerName: "Угадай-ка",
          timestamp: Date.now(),
        }
        nextState = { ...nextState, inventory: [...nextState.inventory, newRose] }
      }
      const pairPartnerId = action.pairPartnerId
      if (uid != null && pairPartnerId != null && uid !== pairPartnerId) {
        const key = [uid, pairPartnerId].sort((a, b) => a - b).join("_")
        const pairCount = (state.ugadaikaPairMatchCount ?? {})[key] ?? 0
        const nextPairCount = pairCount + 1
        const pairMatchCount = { ...(state.ugadaikaPairMatchCount ?? {}), [key]: nextPairCount }
        const friendUnlocked = nextPairCount >= 5
          ? { ...(state.ugadaikaFriendUnlocked ?? {}), [key]: true }
          : (state.ugadaikaFriendUnlocked ?? {})
        nextState = { ...nextState, ugadaikaPairMatchCount: pairMatchCount, ugadaikaFriendUnlocked: friendUnlocked }
      }
      return nextState
    }

    // ---- Player menu ----
    case "OPEN_PLAYER_MENU":
      return { ...state, playerMenuTarget: action.player }
    case "CLOSE_PLAYER_MENU":
      return { ...state, playerMenuTarget: null }
    case "SET_AVATAR_FRAME": {
      try {
        if (typeof window !== "undefined" && state.currentUser?.id === action.playerId) {
          if (action.frameId === "none") window.localStorage.removeItem(AVATAR_FRAME_LS_KEY(action.playerId))
          else window.localStorage.setItem(AVATAR_FRAME_LS_KEY(action.playerId), action.frameId)
        }
      } catch {
        // ignore
      }
      const next = { ...(state.avatarFrames ?? {}), [action.playerId]: action.frameId }
      if (action.frameId === "none") {
        const { [action.playerId]: _, ...rest } = next
        return { ...state, avatarFrames: rest }
      }
      return { ...state, avatarFrames: next }
    }
    case "SET_COURTSHIP_PROFILE_ALLOWED": {
      try {
        if (typeof window !== "undefined") {
          if (action.allowed) window.localStorage.removeItem(PROFILE_SHOW_VK_LS_KEY(action.playerId))
          else window.localStorage.setItem(PROFILE_SHOW_VK_LS_KEY(action.playerId), "0")
        }
      } catch {
        /* ignore */
      }
      const showVkAfterCare = action.allowed
      const patch = (p: Player) => (p.id === action.playerId ? { ...p, showVkAfterCare } : p)
      return {
        ...state,
        players: state.players.map(patch),
        currentUser: state.currentUser?.id === action.playerId ? patch(state.currentUser) : state.currentUser,
        courtshipProfileAllowed: {
          ...(state.courtshipProfileAllowed ?? {}),
          [action.playerId]: action.allowed,
        },
      }
    }
    case "SET_ALLOW_CHAT_INVITE": {
      try {
        if (typeof window !== "undefined") {
          if (action.allowed) window.localStorage.setItem(PROFILE_CHAT_INVITE_LS_KEY(action.playerId), "1")
          else window.localStorage.removeItem(PROFILE_CHAT_INVITE_LS_KEY(action.playerId))
        }
      } catch {
        /* ignore */
      }
      const openToChatInvites = action.allowed
      const patch = (p: Player) => (p.id === action.playerId ? { ...p, openToChatInvites } : p)
      return {
        ...state,
        players: state.players.map(patch),
        currentUser: state.currentUser?.id === action.playerId ? patch(state.currentUser) : state.currentUser,
        allowChatInvite: {
          ...(state.allowChatInvite ?? {}),
          [action.playerId]: action.allowed,
        },
      }
    }

    // ---- VIP status ----
    case "SET_VIP_STATUS": {
      const now = Date.now()
      const vipIsActive = action.isVip && (action.vipUntilTs == null || action.vipUntilTs > now)
      const updatedPlayers = state.players.map((p) =>
        p.id === action.playerId
          ? { ...p, isVip: vipIsActive, vipUntilTs: action.vipUntilTs }
          : p,
      )
      const updatedUser =
        state.currentUser && state.currentUser.id === action.playerId
          ? { ...state.currentUser, isVip: vipIsActive, vipUntilTs: action.vipUntilTs }
          : state.currentUser
      return { ...state, players: updatedPlayers, currentUser: updatedUser }
    }

    case "SET_POPULARITY_STATS":
      return { ...state, popularityStats: action.stats }

    // ---- Bottle skin ----
    case "SET_BOTTLE_SKIN":
      try {
        if (typeof window !== "undefined" && state.currentUser?.id != null) {
          window.localStorage.setItem(BOTTLE_SKIN_LS_KEY(state.currentUser.id), action.skin)
        }
      } catch {
        // ignore
      }
      return {
        ...state,
        bottleSkin: action.skin,
        ownedBottleSkins: Array.from(new Set([...(state.ownedBottleSkins ?? ["classic"]), action.skin])),
      }

    case "SYNC_TABLE_AUTHORITY": {
      const lease = authoritySnapshotExpiredBottleLease(action.payload, Date.now())
      const p = lease.snapshot
      if (lease.changed) {
        try {
          if (typeof window !== "undefined" && state.currentUser?.id != null) {
            const uid = state.currentUser.id
            window.localStorage.setItem(BOTTLE_SKIN_LS_KEY(uid), "classic")
            window.localStorage.removeItem(BOTTLE_COOLDOWN_LS_KEY(uid))
          }
        } catch {
          /* ignore */
        }
      }
      const mergedFrames = { ...(state.avatarFrames ?? {}), ...(p.avatarFrames ?? {}) }
      const todayKey = dateKeyFromTimestamp(Date.now())
      const fromLog = rebuildTodayLimitedEmotionsFromLog(p.gameLog, todayKey)
      const emotionUseTodayByPlayer = mergeEmotionBucketsForSync(state.emotionUseTodayByPlayer, fromLog, todayKey)

      // Подтянуть поклонников из лога: кто ухаживал за текущим пользователем
      let syncAdmirers = state.admirers
      if (state.currentUser) {
        const uid = state.currentUser.id
        const existingIds = new Set(syncAdmirers.map((a) => a.id))
        for (const entry of p.gameLog) {
          if (
            entry.type === "care" &&
            entry.toPlayer?.id === uid &&
            entry.fromPlayer &&
            entry.fromPlayer.id !== uid &&
            !existingIds.has(entry.fromPlayer.id)
          ) {
            syncAdmirers = [...syncAdmirers, entry.fromPlayer]
            existingIds.add(entry.fromPlayer.id)
          }
        }
        if (syncAdmirers !== state.admirers) {
          persistAdmirersList(uid, syncAdmirers)
        }
      }

      // Active phase: initiator (or roundDriver for bots) keeps local gameplay state
      const turnPlayer = state.players[state.currentTurnIndex]
      const isMyTurnDirect = state.currentUser != null && turnPlayer?.id === state.currentUser.id
      const roundDriverId = getRoundDriverPlayerId(state.players)
      const isBotTurnAndDriver = !!(
        turnPlayer?.isBot &&
        state.currentUser &&
        roundDriverId != null &&
        roundDriverId === state.currentUser.id
      )
      const isInitiator = isMyTurnDirect || isBotTurnAndDriver
      const inActivePhase = state.countdown !== null || state.isSpinning || state.showResult
      const sameTurnAsServer =
        p.roundNumber === state.roundNumber &&
        p.currentTurnIndex === state.currentTurnIndex
      const keepLocal = isInitiator && inActivePhase && sameTurnAsServer
      const predictionSyncWindow =
        sameTurnAsServer &&
        !state.isSpinning &&
        !state.showResult &&
        state.countdown === null &&
        (state.predictionPhase || p.predictionPhase)

      const keepLocalCountdown = keepLocal && state.countdown !== null && (p.countdown === null || p.countdown >= state.countdown)
      /** Не держим локальный спин, если сервер уже сообщил isSpinning=false — иначе клиент может "залипнуть" в кручении. */
      const keepLocalSpinState = keepLocal && state.isSpinning && p.isSpinning
      /** Только инициатор крутит локально; иначе все должны брать bottleAngle с сервера — иначе рассинхрон. */
      const keepLocalAngle = keepLocalSpinState
      const keepLocalResult = keepLocal && state.showResult && !p.showResult
      const localPairKissPhase = state.pairKissPhase ?? null
      const keepLocalPairKiss =
        localPairKissPhase != null &&
        !localPairKissPhase.resolved &&
        p.pairKissPhase == null &&
        sameTurnAsServer &&
        state.showResult &&
        p.showResult
      const mergedPredictions = mergePredictionsForSync(state.predictions, p.predictions ?? [], predictionSyncWindow)
      const mergedBets = mergeBetsForSync(state.bets, p.bets ?? [], predictionSyncWindow)
      const mergedPot = predictionSyncWindow
        ? Math.max(
            p.pot ?? 0,
            state.pot,
            mergedBets.reduce((sum, bet) => sum + bet.amount, 0),
          )
        : (p.pot ?? 0)
      const syncedPredictionPhase =
        keepLocalCountdown || keepLocalSpinState || keepLocalResult
          ? state.predictionPhase
          : predictionSyncWindow
            ? (p.predictionPhase || state.predictionPhase)
            : p.predictionPhase
      const localById = new Map(state.players.map((pl) => [pl.id, pl]))
      const mergedPlayers = p.players.map((pl) => {
        const prev = localById.get(pl.id)
        const currentStatus = state.currentUser?.id === pl.id ? state.currentUser.status : undefined
        return {
          ...pl,
          status: pl.status ?? currentStatus ?? prev?.status,
          showVkAfterCare: "showVkAfterCare" in pl ? pl.showVkAfterCare : prev?.showVkAfterCare,
          openToChatInvites: "openToChatInvites" in pl ? pl.openToChatInvites : prev?.openToChatInvites,
        }
      })

      return {
        ...state,
        authorityRevision: p.revision,
        players: mergedPlayers,
        currentTurnIndex: p.currentTurnIndex,
        turnStartedAtMs:
          typeof p.turnStartedAtMs === "number"
            ? p.turnStartedAtMs
            : (p.turnStartedAtMs === null ? null : state.turnStartedAtMs),
        isSpinning: keepLocalSpinState ? state.isSpinning : p.isSpinning,
        countdown: keepLocalCountdown ? state.countdown : p.countdown,
        bottleAngle: keepLocalAngle ? state.bottleAngle : p.bottleAngle,
        bottleSkin: p.bottleSkin ?? state.bottleSkin ?? "classic",
        tableStyle: p.tableStyle ?? state.tableStyle ?? "classic_night",
        bottleCooldownUntil: p.bottleCooldownUntil ?? state.bottleCooldownUntil,
        bottleDonorId: p.bottleDonorId,
        bottleDonorName: p.bottleDonorName,
        targetPlayer: keepLocalSpinState ? state.targetPlayer : p.targetPlayer,
        targetPlayer2: keepLocalSpinState ? state.targetPlayer2 : p.targetPlayer2,
        showResult: keepLocalResult ? state.showResult : p.showResult,
        resultAction: keepLocalResult ? state.resultAction : p.resultAction,
        pairKissPhase:
          p.pairKissPhase != null
            ? p.pairKissPhase
            : (keepLocalResult || keepLocalPairKiss)
              ? state.pairKissPhase ?? null
              : null,
        roundNumber: p.roundNumber,
        predictionPhase: syncedPredictionPhase,
        predictions: mergedPredictions,
        bets: mergedBets,
        pot: mergedPot,
        currentTurnDidSpin: p.currentTurnDidSpin,
        extraTurnPlayerId: p.extraTurnPlayerId,
        playerInUgadaika: p.playerInUgadaika ?? null,
        spinSkips: { ...p.spinSkips },
        gameLog: mergeGameLogsForSync(state.gameLog, p.gameLog),
        emotionUseTodayByPlayer,
        generalChatMessages: trimRoomChatMessages(p.generalChatMessages),
        avatarFrames: mergedFrames,
        drunkUntil: (() => {
          const merged: Record<number, number> = { ...(state.drunkUntil ?? {}) }
          for (const [k, v] of Object.entries(p.drunkUntil ?? {})) {
            const pid = Number(k)
            merged[pid] = Math.max(merged[pid] ?? 0, v as number)
          }
          return merged
        })(),
        admirers: syncAdmirers,
        clientTabAway: { ...(p.clientTabAway ?? {}) },
      }
    }

    default:
      return state
  }
}

function gameReducer(state: GameState, action: GameAction): GameState {
  return protectEconomy(state, gameReducerCore(state, action), action)
}

const GameStateContext = createContext<GameState | null>(null)
const GameDispatchContext = createContext<React.Dispatch<GameAction> | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  const currentUid = state.currentUser?.id
  const currentFrameSig = currentUid != null ? state.avatarFrames?.[currentUid] : undefined
  const ownedSkinsSig = state.ownedBottleSkins?.join(",") ?? ""

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(SOUNDS_ENABLED_KEY) === "0") {
        dispatch({ type: "SET_SOUNDS_ENABLED", enabled: false })
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const user = state.currentUser
    if (!user || typeof window === "undefined") return
    let cancelled = false
    void (async () => {
      try {
        const res = await apiFetch("/api/popularity/me", { credentials: "include", cache: "no-store" })
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean
        } & Partial<PopularityStats>
        if (cancelled || !res.ok || !data?.ok) return
        const stats: PopularityStats = {
          monthKey: typeof data.monthKey === "string" ? data.monthKey : "",
          ratingTotal: typeof data.ratingTotal === "number" ? data.ratingTotal : 0,
          popularityMonth: typeof data.popularityMonth === "number" ? data.popularityMonth : 0,
          popularityLifetime: typeof data.popularityLifetime === "number" ? data.popularityLifetime : 0,
          level: typeof data.level === "number" ? data.level : 1,
          monthRank: typeof data.monthRank === "number" ? data.monthRank : null,
          monthlyTopFrame: Boolean(data.monthlyTopFrame),
        }
        dispatch({ type: "SET_POPULARITY_STATS", stats })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state.currentUser?.id])

  useEffect(() => {
    const user = state.currentUser
    if (!user) return
    if (currentFrameSig !== VIP_AUTO_FRAME_ID) return

    // Источник правды по VIP может прийти чуть позже после перезапуска/деплоя:
    // не снимаем авто-рамку, пока статус ещё не определён.
    const syncedSelf = state.players.find((p) => p.id === user.id)
    const vipSource = syncedSelf ?? user
    const hasVipSignal = typeof vipSource.isVip === "boolean" || typeof vipSource.vipUntilTs === "number"
    if (!hasVipSignal) return

    const clearVipFrameIfStillAuto = () => {
      const action = { type: "SET_AVATAR_FRAME" as const, playerId: user.id, frameId: "none" }
      const sync = getTableSyncDispatch()
      if (sync) {
        sync(action)
      } else {
        dispatch(action)
      }
    }

    const now = Date.now()
    const vipStillActive = Boolean(vipSource.isVip) && (vipSource.vipUntilTs == null || vipSource.vipUntilTs > now)
    if (!vipStillActive) {
      clearVipFrameIfStillAuto()
      return
    }
    if (vipSource.vipUntilTs == null) return

    const delay = vipSource.vipUntilTs - now + 250
    if (delay <= 0) {
      clearVipFrameIfStillAuto()
      return
    }

    const timer = window.setTimeout(() => {
      clearVipFrameIfStillAuto()
    }, delay)
    return () => window.clearTimeout(timer)
  }, [
    state.currentUser?.id,
    state.currentUser?.isVip,
    state.currentUser?.vipUntilTs,
    state.players,
    currentFrameSig,
    dispatch,
  ])

  // Экономика + визуальные настройки: сразу на сервер (debounce 400ms), чтобы смена ВК/ОК/логина подтягивала тот же вид.
  useEffect(() => {
    if (!state.currentUser || typeof window === "undefined") return
    const endpoint = userStatePutUrl(state.currentUser)
    if (!endpoint) return

    const t = setTimeout(() => {
      const visualPrefs = buildVisualPrefsPayload(state)
      const payload = JSON.stringify({
        voiceBalance: state.voiceBalance,
        inventory: state.inventory,
        visualPrefs,
      })
      const persist = async (attempt: number) => {
        try {
          const res = await apiFetch(endpoint, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: payload,
          })
          if (res.ok) return true
          if (attempt === 0) {
            window.setTimeout(() => {
              void persist(1)
            }, 500)
          }
          return false
        } catch {
          if (attempt === 0) {
            window.setTimeout(() => {
              void persist(1)
            }, 500)
          }
          return false
        }
      }
      void persist(0)
    }, 400)
    return () => clearTimeout(t)
  }, [
    state.currentUser,
    state.voiceBalance,
    state.inventory,
    state.tableStyle,
    ownedSkinsSig,
    state.soundsEnabled,
    currentFrameSig,
  ])

  return (
    <GameDispatchContext.Provider value={dispatch}>
      <GameStateContext.Provider value={state}>
        {children}
      </GameStateContext.Provider>
    </GameDispatchContext.Provider>
  )
}

export function useGame() {
  const state = useGameState()
  const dispatch = useGameDispatch()
  return { state, dispatch }
}

export function useGameState() {
  const state = useContext(GameStateContext)
  if (!state) throw new Error("useGameState must be used within GameProvider")
  return state
}

export function useGameDispatch() {
  const dispatch = useContext(GameDispatchContext)
  if (!dispatch) throw new Error("useGameDispatch must be used within GameProvider")
  return dispatch
}

export function getBotResponse(): string {
  const responses = [
    "Привет! Рада знакомству!",
    "О, как интересно! Расскажи о себе.",
    "Мне тоже нравится эта игра!",
    "А ты часто тут играешь?",
    "Какой у тебя любимый фильм?",
    "Я тоже люблю гулять по вечерам.",
    "Спасибо за подарок!",
    "Давай встретимся как-нибудь!",
  ]
  return responses[Math.floor(Math.random() * responses.length)]
}

/** Helper to sort a pair of IDs for consistent comparison */
export function sortPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a]
}

/** Check if two pairs are the same */
export function pairsMatch(p1: [number, number], p2: [number, number]): boolean {
  return p1[0] === p2[0] && p1[1] === p2[1]
}
