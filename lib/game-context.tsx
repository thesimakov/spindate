"use client"

import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react"
import type { GameState, GameAction, Player, Gender, InventoryItem } from "./game-types"

// Имена жителей стран СНГ (25+ женских и 25+ мужских)
const FEMALE_NAMES: string[] = [
  // Беларусь
  "Алина", "Вероника", "Ксения", "Светлана", "Дарья",
  // Киргизия
  "Айгуль", "Асел", "Нурия", "Мадина", "Гульнара",
  // Таджикистан
  "Мехринисо", "Зульфия", "Фотима", "Шахноза", "Нилуфар",
  // Узбекистан
  "Дильноза", "Севара", "Нодира", "Шахзода", "Лола",
  // Россия
  "Екатерина", "Анна", "Мария", "Ольга", "Виктория",
]

const MALE_NAMES: string[] = [
  // Беларусь
  "Андрей", "Денис", "Илья", "Максим", "Владислав",
  // Киргизия
  "Айбек", "Нурсултан", "Эркин", "Бахтияр", "Темир",
  // Таджикистан
  "Фаррух", "Далер", "Бехруз", "Шерзод", "Хуршед",
  // Узбекистан
  "Жахонгир", "Сардор", "Азиз", "Рустам", "Тимур",
  // Россия
  "Алексей", "Сергей", "Дмитрий", "Роман", "Иван",
]

const CITIES = ["Москва", "Санкт-Петербург", "Минск", "Алматы", "Ташкент", "Бишкек", "Новосибирск", "Екатеринбург", "Казань", "Нижний Новгород"]
const INTERESTS = ["Путешествия, музыка", "Книги, кино", "Спорт, природа", "Фотография, искусство", "Кулинария, вино", "Танцы, театр", "Наука, технологии", "Йога, медитация"]
const ZODIAC_SIGNS = ["Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева", "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"]

/** Идентификаторы рамок аватарки (для ботов и профиля) */
export const AVATAR_FRAME_IDS = ["none", "gold", "silver", "hearts", "roses", "gradient", "neon", "snow", "rabbit", "fairy", "fox", "mag", "malif", "mir", "vesna"] as const

export function randomAvatarFrame(): (typeof AVATAR_FRAME_IDS)[number] {
  return AVATAR_FRAME_IDS[Math.floor(Math.random() * AVATAR_FRAME_IDS.length)]
}

export function generateBots(count: number, _userGender: Gender): Player[] {
  const bots: Player[] = []
  for (let i = 0; i < count; i++) {
    // Жёсткое чередование полов для приблизительно 50/50
    const isFemale = i % 2 === 0
    const nameList = isFemale ? FEMALE_NAMES : MALE_NAMES

    // Используем реальные портреты (randomuser.me)
    const avatarIndex = (100 + i) % 100
    const avatarUrl = isFemale
      ? `https://randomuser.me/api/portraits/women/${avatarIndex}.jpg`
      : `https://randomuser.me/api/portraits/men/${avatarIndex}.jpg`

    bots.push({
      id: 1000 + i,
      name: nameList[i % nameList.length],
      avatar: avatarUrl,
      gender: isFemale ? "female" : "male",
      age: 25 + Math.floor(Math.random() * 20),
      purpose: (["relationships", "communication", "love"] as const)[Math.floor(Math.random() * 3)],
      lookingFor: Math.random() < 0.75 ? (isFemale ? "male" : "female") : (isFemale ? "female" : "male"),
      isBot: true,
      online: Math.random() > 0.3,
      isVip: Math.random() < 0.2,
      city: CITIES[i % CITIES.length],
      interests: INTERESTS[i % INTERESTS.length],
      zodiac: ZODIAC_SIGNS[i % ZODIAC_SIGNS.length],
    })
  }
  return bots
}

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
  chatWith: null,
  chatMessages: {},
  voiceBalance: 0,
  bonusBalance: 0,
  tableId: Math.floor(Math.random() * 9999) + 1,
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
  emotionDailyBoost: {
    dateKey: "",
    extraPerType: 0,
  },
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_SCREEN": {
      if (action.screen === "ugadaika") {
        return { ...state, screen: action.screen, playerInUgadaika: state.currentUser?.id ?? null }
      }
      if (action.screen === "game" && state.playerInUgadaika != null) {
        return { ...state, screen: action.screen, playerInUgadaika: null, showReturnedFromUgadaika: true }
      }
      return { ...state, screen: action.screen }
    }
    case "SET_USER":
      return { ...state, currentUser: action.user }
    case "CLEAR_USER":
      return { ...state, currentUser: null, players: [], tableId: Math.floor(Math.random() * 9999) + 1 }
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
        const nextPlayers = action.players
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
              type: resultAction as any,
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

        return {
        ...state,
        players: nextPlayers,
        tableId: action.tableId,
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
        gameLog: seedLog.slice(-50),
        avatarFrames: nextFrames,
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

      const normAngle = state.bottleAngle % 360
      return {
        ...state,
        spinSkips: nextSpinSkips,
        currentTurnDidSpin: false,
        currentTurnIndex: nextIndex,
        showResult: false,
        targetPlayer: null,
        targetPlayer2: null,
        resultAction: null,
        bottleAngle: normAngle,
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
    case "PAY_VOICES":
      return { ...state, voiceBalance: Math.max(0, state.voiceBalance - action.amount) }
    case "ADD_VOICES":
      return { ...state, voiceBalance: state.voiceBalance + action.amount }
    case "RESTORE_GAME_STATE":
      return {
        ...state,
        voiceBalance: Math.max(0, action.voiceBalance),
        inventory: Array.isArray(action.inventory) ? [...action.inventory] : [],
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
    case "ADD_LOG":
      return { ...state, gameLog: [...state.gameLog.slice(-50), action.entry] }
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
      const sameDay = currentBoost?.dateKey === action.dateKey
      const nextExtra = (sameDay ? currentBoost?.extraPerType ?? 0 : 0) + action.extraPerType
      return {
        ...state,
        voiceBalance: state.voiceBalance - action.cost,
        emotionDailyBoost: {
          dateKey: action.dateKey,
          extraPerType: nextExtra,
        },
      }
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
      return {
        ...state,
        voiceBalance: state.voiceBalance + 150,
      }
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
      return {
        ...state,
        bottleSkin: action.skin,
        ownedBottleSkins: Array.from(new Set([...(state.ownedBottleSkins ?? ["classic"]), action.skin])),
      }

    default:
      return state
  }
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

  // Сохранение сердец и роз на сервере для пользователей по логину
  useEffect(() => {
    if (state.currentUser?.authProvider !== "login" || typeof window === "undefined") return
    const t = setTimeout(() => {
      fetch("/api/user/state", {
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
  }, [state.currentUser?.authProvider, state.voiceBalance, state.inventory])

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

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function generateLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** Helper to sort a pair of IDs for consistent comparison */
export function sortPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a]
}

/** Check if two pairs are the same */
export function pairsMatch(p1: [number, number], p2: [number, number]): boolean {
  return p1[0] === p2[0] && p1[1] === p2[1]
}

/** Determine pair gender combo */
export function getPairGenderCombo(p1: Player, p2: Player): "MM" | "MF" | "FF" {
  if (p1.gender === "male" && p2.gender === "male") return "MM"
  if (p1.gender === "female" && p2.gender === "female") return "FF"
  return "MF"
}
