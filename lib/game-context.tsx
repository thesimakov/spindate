"use client"

import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react"
import {
  GAME_TABLE_LOG_MAX_ENTRIES,
  type GameState,
  type GameAction,
  type Player,
  type InventoryItem,
  type GameLogEntry,
  type EmotionUseTodayBucket,
} from "./game-types"
import { generateBots as generateBotsImpl, AVATAR_FRAME_IDS, randomAvatarFrame as randomAvatarFrameImpl } from "@/lib/bots"
import { generateLogId as generateLogIdImpl, generateMessageId as generateMessageIdImpl } from "@/lib/ids"
import { getPairGenderCombo as getPairGenderComboImpl } from "@/lib/pair-utils"
import { apiFetch } from "@/lib/api-fetch"

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
  isSpinning: false,
  countdown: null,
  bottleAngle: 0,
  bottleSkin: "classic",
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
  tableId: Math.floor(Math.random() * 9999) + 1,
  roomCreatorPlayerId: null,
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
  },
  emotionUseTodayByPlayer: {},
  tablePaused: false,
  clientTabAway: {},
  gameSidePanel: null,
  chatPanelPlayer: null,
}

const ADMIRERS_LS_KEY = (userId: number) => `spindate_admirers_v1_${userId}`
const AVATAR_FRAME_LS_KEY = (userId: number) => `spindate_avatar_frame_v1_${userId}`
const BOTTLE_SKIN_LS_KEY = (userId: number) => `spindate_bottle_skin_v1_${userId}`

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
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIRERS_LS_KEY(userId), JSON.stringify(list))
    }
  } catch {
    // ignore
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
      let restoredFrameId: string | null = null
      let restoredBottleSkin: GameState["bottleSkin"] | null = null
      try {
        if (typeof window !== "undefined") {
          const raw = window.localStorage.getItem(ADMIRERS_LS_KEY(action.user.id))
          if (raw) admirers = parseAdmirersFromStorage(raw)
          const savedFrame = window.localStorage.getItem(AVATAR_FRAME_LS_KEY(action.user.id))
          if (savedFrame && savedFrame !== "none") restoredFrameId = savedFrame
          const savedBottle = window.localStorage.getItem(BOTTLE_SKIN_LS_KEY(action.user.id)) as GameState["bottleSkin"] | null
          if (savedBottle) restoredBottleSkin = savedBottle
        }
      } catch {
        admirers = []
      }
      const nextFrames = { ...(state.avatarFrames ?? {}) }
      if (restoredFrameId) nextFrames[action.user.id] = restoredFrameId
      const nextOwnedBottleSkins = Array.from(
        new Set([...(state.ownedBottleSkins ?? ["classic"]), restoredBottleSkin ?? "classic"]),
      )
      return {
        ...state,
        currentUser: action.user,
        admirers,
        avatarFrames: nextFrames,
        bottleSkin: restoredBottleSkin ?? state.bottleSkin,
        ownedBottleSkins: nextOwnedBottleSkins,
      }
    }
    case "CLEAR_USER":
      return {
        ...state,
        currentUser: null,
        players: [],
        admirers: [],
        tableId: Math.floor(Math.random() * 9999) + 1,
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
        }
      })

      const current = state.players[state.currentTurnIndex]
      let nextIndex = 0
      if (current) {
        const idx = nextPlayers.findIndex((p) => p.id === current.id)
        nextIndex = idx !== -1 ? idx : 0
      }

      const nextTarget = state.targetPlayer ? nextPlayers.find((p) => p.id === state.targetPlayer!.id) ?? null : null
      const nextTarget2 = state.targetPlayer2 ? nextPlayers.find((p) => p.id === state.targetPlayer2!.id) ?? null : null

      return {
        ...state,
        players: nextPlayers,
        currentTurnIndex: nextPlayers.length === 0 ? 0 : Math.min(nextIndex, nextPlayers.length - 1),
        targetPlayer: nextTarget,
        targetPlayer2: nextTarget2,
      }
    }
    case "SET_TABLE_ID":
      return { ...state, tableId: action.tableId }
    case "SET_TABLE":
      // При входе/смене стола мы "подключаемся" к уже идущей игре:
      // не делаем жёсткий сброс раунда/очереди, а создаём состояние,
      // похожее на уже активную комнату.
      {
        const now = Date.now()
        const nextPlayersRaw = action.players
        const existingById = new Map(state.players.map((p) => [p.id, p]))
        const nextPlayers = nextPlayersRaw.map((p) => {
          const prev = existingById.get(p.id)
          const currentStatus = state.currentUser?.id === p.id ? state.currentUser.status : undefined
          return {
            ...p,
            status: p.status ?? currentStatus ?? prev?.status,
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
              fromPlayer: state.currentUser ?? undefined,
              text: `Вы присоединились к столу #${action.tableId}. Игра уже идёт`,
              timestamp: now,
            },
            {
              id: generateLogId(),
              type: "system",
              fromPlayer: spinner,
              toPlayer: target1,
              text: `Выпала пара: ${pairText}`,
              timestamp: now,
            },
          ]
        } else {
          seedLog = [
            ...seedLog,
            {
              id: generateLogId(),
              type: "system",
              fromPlayer: state.currentUser ?? undefined,
              text: `Вы присоединились к столу #${action.tableId}. Игра уже идёт`,
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

        return {
        ...state,
        players: nextPlayers,
        tableId: action.tableId,
        roomCreatorPlayerId: nextRoomCreator,
        currentTurnIndex: spinnerIdx,
        spinSkips: nextSpinSkips,
        currentTurnDidSpin: false,
        isSpinning: false,
        countdown: null,
        bottleAngle,
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
        }
      }
    case "SET_TABLES_COUNT":
      return { ...state, tablesCount: action.tablesCount }
    case "START_COUNTDOWN":
      return { ...state, countdown: 3 }
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
      }
    }
    case "STOP_SPIN":
      return { ...state, isSpinning: false, showResult: true, resultAction: action.action }
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
      }
    }
    case "ADD_FAVORITE":
      if (state.favorites.find((f) => f.id === action.player.id)) return state
      return { ...state, favorites: [...state.favorites, action.player] }
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
      const kept = list.slice(-50)
      return { ...state, generalChatMessages: kept }
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
    case "RESTORE_GAME_STATE":
      return {
        ...state,
        voiceBalance: Math.max(0, action.voiceBalance),
        inventory: Array.isArray(action.inventory) ? [...action.inventory] : [],
        gameSidePanel: null,
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
      }
    case "ADD_LOG": {
      const nextLog = [...state.gameLog.slice(-GAME_TABLE_LOG_MAX_ENTRIES), action.entry]
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
      return { ...state, bottleCooldownUntil: action.ts }
    case "SET_BOTTLE_DONOR":
      return { ...state, bottleDonorId: action.playerId, bottleDonorName: action.playerName }
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
      return {
        ...state,
        voiceBalance: state.voiceBalance - action.cost,
        emotionDailyBoost: {
          dateKey: action.dateKey,
          extraPerType: nextExtra,
          extraByType: mergedExtraByType,
        },
      }
    }
    case "BUY_EMOTION_QUOTA_SELECTION": {
      const { dateKey, selectedTypes, extraPerPurchase, costPerType } = action
      if (!selectedTypes.length || extraPerPurchase <= 0 || costPerType <= 0) return state
      const totalCost = selectedTypes.length * costPerType
      if (state.voiceBalance < totalCost) return state
      const cur = state.emotionDailyBoost ?? { dateKey: "", extraPerType: 0, extraByType: {} }
      // Только совпадение даты (без «truthy» extraByType) — иначе после первой покупки
      // { kiss: 50 } терялся при повторном мерже из-за `sameDay && cur?.extraByType`.
      const sameDay = Boolean(cur.dateKey) && cur.dateKey === dateKey
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
      return { ...state, predictionPhase: true, predictions: [], bets: [] }
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
      if (state.voiceBalance < 50) return state
      return {
        ...state,
        voiceBalance: state.voiceBalance - 50,
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
        voiceBalance: state.voiceBalance + toRemove * 5,
      }
    }
    case "EXCHANGE_VOICES_FOR_ROSES": {
      const costPerRose = 5
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
        voiceBalance: state.voiceBalance + 10,
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
    case "SET_COURTSHIP_PROFILE_ALLOWED":
      return {
        ...state,
        courtshipProfileAllowed: {
          ...(state.courtshipProfileAllowed ?? {}),
          [action.playerId]: action.allowed,
        },
      }
    case "SET_ALLOW_CHAT_INVITE":
      return {
        ...state,
        allowChatInvite: {
          ...(state.allowChatInvite ?? {}),
          [action.playerId]: action.allowed,
        },
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
      const p = action.payload
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

      const keepLocalAngle = state.isSpinning && !p.isSpinning
      const localById = new Map(state.players.map((pl) => [pl.id, pl]))
      const mergedPlayers = p.players.map((pl) => {
        const prev = localById.get(pl.id)
        const currentStatus = state.currentUser?.id === pl.id ? state.currentUser.status : undefined
        return {
          ...pl,
          status: pl.status ?? currentStatus ?? prev?.status,
        }
      })

      return {
        ...state,
        players: mergedPlayers,
        currentTurnIndex: p.currentTurnIndex,
        isSpinning: p.isSpinning,
        countdown: p.countdown,
        bottleAngle: keepLocalAngle ? state.bottleAngle : p.bottleAngle,
        bottleSkin: p.bottleSkin ?? state.bottleSkin ?? "classic",
        bottleDonorId: p.bottleDonorId,
        bottleDonorName: p.bottleDonorName,
        targetPlayer: p.targetPlayer,
        targetPlayer2: p.targetPlayer2,
        showResult: p.showResult,
        resultAction: p.resultAction,
        roundNumber: p.roundNumber,
        predictionPhase: p.predictionPhase,
        currentTurnDidSpin: p.currentTurnDidSpin,
        extraTurnPlayerId: p.extraTurnPlayerId,
        playerInUgadaika: p.playerInUgadaika ?? null,
        spinSkips: { ...p.spinSkips },
        gameLog: [...p.gameLog],
        emotionUseTodayByPlayer,
        generalChatMessages: [...(p.generalChatMessages ?? [])],
        avatarFrames: mergedFrames,
        drunkUntil: { ...(state.drunkUntil ?? {}), ...(p.drunkUntil ?? {}) },
        admirers: syncAdmirers,
        clientTabAway: { ...(p.clientTabAway ?? {}) },
        predictions: [],
        bets: [],
        pot: 0,
      }
    }

    default:
      return state
  }
}

function gameReducer(state: GameState, action: GameAction): GameState {
  return protectEconomy(state, gameReducerCore(state, action), action)
}

const GameContext = createContext<{
  state: GameState
  dispatch: React.Dispatch<GameAction>
} | null>(null)

const SOUNDS_ENABLED_KEY = "spindate_sounds_enabled"

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState)
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem(SOUNDS_ENABLED_KEY) === "0") {
        dispatch({ type: "SET_SOUNDS_ENABLED", enabled: false })
      }
    } catch {
      // ignore
    }
  }, [])

  // Сохранение сердец и роз на сервере для пользователей по логину и VK
  useEffect(() => {
    if (!state.currentUser || typeof window === "undefined") return
    const isLogin = state.currentUser.authProvider === "login"
    const isVk = state.currentUser.authProvider === "vk"
    if (!isLogin && !isVk) return

    const endpoint = isVk
      ? `/api/user/state?vk_user_id=${encodeURIComponent(String(state.currentUser.id))}`
      : "/api/user/state"
    const t = setTimeout(() => {
      apiFetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          voiceBalance: state.voiceBalance,
          inventory: state.inventory,
        }),
      }).catch(() => {})
    }, 1500)
    return () => clearTimeout(t)
  }, [state.currentUser, state.voiceBalance, state.inventory])

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const context = useContext(GameContext)
  if (!context) throw new Error("useGame must be used within GameProvider")
  return context
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
