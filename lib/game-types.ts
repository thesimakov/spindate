export type Gender = "male" | "female"
export type LookingFor = "male" | "female"
export type Purpose = "relationships" | "communication" | "love"

export interface Player {
  id: number
  name: string
  avatar: string
  gender: Gender
  age: number
  purpose: Purpose
  lookingFor?: LookingFor
  isBot?: boolean
  online?: boolean
  isVip?: boolean
  /** VIP активен до этого времени (ms). Если не задано, то как бессрочный флаг. */
  vipUntilTs?: number
  authProvider?: "vk" | "login"
  /** Город (если указан в профиле) */
  city?: string
  /** Интересы (если указаны в профиле) */
  interests?: string
  /** Знак зодиака */
  zodiac?: string
}

export interface ChatMessage {
  id: string
  senderId: number
  text: string
  timestamp: number
  gift?: string
}

/** Сообщение в общем чате стола */
export interface GeneralChatMessage {
  id: string
  senderId: number
  senderName: string
  text: string
  timestamp: number
}

export interface GameLogEntry {
  id: string
  type:
    | "kiss"
    | "beer"
    | "skip"
    | "invite"
    | "join"
    | "system"
    | "hug"
    | "selfie"
    | "flowers"
    | "song"
    | "rose"
    | "diamond"
    | "gift_voice"
    | "banya"
    | "tools"
    | "lipstick"
    | "chat"
    | "laugh"
    | "cocktail"
    | "prediction"
    | "care"
  fromPlayer?: Player
  toPlayer?: Player
  text: string
  timestamp: number
}

/* ---- Prediction system ---- */
export interface Prediction {
  playerId: number        // who made the prediction
  playerName: string
  targetPair: [number, number] // predicted pair [id1, id2] (sorted)
}

/* ---- Betting system ---- */
export interface Bet {
  playerId: number
  playerName: string
  targetPair: [number, number] // the pair they bet on [id1, id2] (sorted)
  amount: number
}

/* ---- Inventory items ---- */
export interface InventoryItem {
  type:
    | "rose"
    | "flowers"
    | "song"
    | "diamond"
    // Игрушки и сувениры из магазина
    | "toy_bear"
    | "toy_car"
    | "toy_ball"
    | "souvenir_magnet"
    | "souvenir_keychain"
    | "plush_heart"
    | "chocolate_box"
  fromPlayerId: number
  fromPlayerName: string
  timestamp: number
  toPlayerId?: number
}

/* ---- Gender-based action definitions ---- */
export type PairGenderCombo = "MM" | "MF" | "FF"

export interface PairAction {
  id: string
  label: string
  icon: string
  cost: number        // 0 = free
  combo: PairGenderCombo[]
}

export const PAIR_ACTIONS: PairAction[] = [
  // M+F
  { id: "kiss",    label: "Поцеловать",         icon: "kiss",     cost: 1, combo: ["MF"] },
  { id: "flowers", label: "Подарить цветы",     icon: "flowers",  cost: 1, combo: ["MF", "FF"] },
  { id: "diamond", label: "Подарить бриллиант", icon: "diamond",  cost: 3, combo: ["MF"] },
  // M+M
  { id: "beer",    label: "Выпить пива",        icon: "beer",     cost: 1, combo: ["MM"] },
  { id: "banya",   label: "Парить вениками",    icon: "banya",    cost: 1, combo: ["MM"] },
  { id: "tools",   label: "Подарить инструменты", icon: "tools",  cost: 2, combo: ["MM"] },
  // F+F
  { id: "lipstick", label: "Губная помада",     icon: "lipstick", cost: 1, combo: ["FF"] },
  { id: "cocktail", label: "Коктейль",          icon: "cocktail", cost: 1, combo: ["FF"] },
  // Universal
  { id: "skip",    label: "Пропустить",         icon: "skip",     cost: 0,  combo: ["MM", "MF", "FF"] },
]

export interface GameState {
  screen: "registration" | "payment" | "game" | "chat" | "favorites" | "shop" | "profile" | "ugadaika"
  currentUser: Player | null
  players: Player[]
  currentTurnIndex: number
  isSpinning: boolean
  countdown: number | null
  bottleAngle: number
  bottleSkin?: "classic" | "ruby" | "neon" | "frost" | "baby" | "vip" | "milk"
  targetPlayer: Player | null
  targetPlayer2: Player | null  // second target (bottle bottom)
  showResult: boolean
  resultAction: string | null
  favorites: Player[]
  chatWith: Player | null
  chatMessages: Record<number, ChatMessage[]>
  voiceBalance: number
  bonusBalance: number
  tableId: number
  gameLog: GameLogEntry[]
  // Prediction & Betting
  predictions: Prediction[]
  bets: Bet[]
  pot: number
  predictionPhase: boolean     // true = accepting predictions & bets before spin
  roundNumber: number
  // Inventory
  inventory: InventoryItem[]
  // Player menu
  playerMenuTarget: Player | null
  /** Если true — при ухаживании показывать ссылку на профиль ВК; если false — дать написать личное сообщение */
  courtshipProfileAllowed?: Record<number, boolean>
  /** Если true — у этого игрока в меню показывается кнопка «Пригласить общаться» */
  allowChatInvite?: Record<number, boolean>
  // Meta
  tablesCount?: number
  ownedBottleSkins?: ("classic" | "ruby" | "neon" | "frost" | "baby" | "vip" | "milk")[]
  extraTurnPlayerId?: number
  bottleCooldownUntil?: number
  bottleDonorId?: number
  bottleDonorName?: string
  drunkUntil?: Record<number, number>
  dailyQuests?: {
    dateKey: string
    /** Для каждого из 5 заданий дня — получена ли награда (1 роза). Макс. 5 роз в день. */
    claimed: [boolean, boolean, boolean, boolean, boolean]
  }
  /** История подаренных роз: кто кому. Для рейтинга симпатии и ачивки «Настоящие чувства» (10 одному игроку). */
  rosesGiven?: Array<{ fromPlayerId: number; toPlayerId: number; timestamp: number }>
  /** Рамка на аватарке игрока: playerId -> id рамки (gold, silver, hearts, roses, gradient, neon, snow, none). */
  avatarFrames?: Record<number, string>
  /** Мини-игра «Угадай-ка»: всего выигранных туров текущего пользователя. */
  ugadaikaRoundsWon?: number
  /** Мини-игра «Угадай-ка»: выигранные туры по игрокам (playerId -> количество). Для рейтинга Топ 10. */
  ugadaikaRoundsByPlayer?: Record<number, number>
  /** Угадай-ка: сколько раз пара (id1_id2, сортированные) совпадала — для разблокировки «дружить профилями». */
  ugadaikaPairMatchCount?: Record<string, number>
  /** Угадай-ка: пары, у которых разблокировано «дружить профилями» (ключ "id1_id2"). */
  ugadaikaFriendUnlocked?: Record<string, boolean>
  /** id игрока, который сейчас в мини-игре «Угадай-ка» — ход и бутылочка его пропускаются, на аватарке «в игре». */
  playerInUgadaika?: number | null
  /** Показать анимацию «вернулся к нам» после выхода из мини-игры. */
  showReturnedFromUgadaika?: boolean
  /** Сколько раз подряд игрок пропустил кручение (не крутил, когда был его ход). Если >= 3 — показываем «отошёл» (zzz). */
  spinSkips?: Record<number, number>
  /** Был ли текущий ход уже использован на кручение (чтобы в NEXT_TURN отличать пропуск от кручения). */
  currentTurnDidSpin?: boolean
  /** Включены ли звуки эмоций (по умолчанию true). Сохраняется в localStorage. */
  soundsEnabled?: boolean
  /** Общий чат стола (последние сообщения). */
  generalChatMessages?: GeneralChatMessage[]
  /** Купленные в магазине доп. эмоции на сегодня (добавка к суточному лимиту для лимитируемых эмоций). */
  emotionDailyBoost?: {
    dateKey: string
    extraPerType: number
  }
}

export type GameAction =
  | { type: "SET_SCREEN"; screen: GameState["screen"] }
  | { type: "SET_USER"; user: Player }
  | { type: "CLEAR_USER" }
  | { type: "UPDATE_USER_NAME"; playerId: number; name: string }
  | { type: "UPDATE_USER_AVATAR"; playerId: number; avatar: string }
  | { type: "ADD_DRUNK_TIME"; playerId: number; ms: number }
  | { type: "SET_PLAYERS"; players: Player[] }
  | { type: "SET_TABLE_ID"; tableId: number }
  | { type: "SET_TABLE"; players: Player[]; tableId: number }
  | { type: "SET_TABLES_COUNT"; tablesCount: number }
  | { type: "START_COUNTDOWN" }
  | { type: "TICK_COUNTDOWN" }
  | { type: "START_SPIN"; angle: number; target: Player; target2: Player }
  | { type: "STOP_SPIN"; action: string }
  | { type: "NEXT_TURN" }
  | { type: "ADD_FAVORITE"; player: Player }
  | { type: "OPEN_CHAT"; player: Player }
  | { type: "SEND_MESSAGE"; toId: number; message: ChatMessage }
  | { type: "SEND_GENERAL_CHAT"; message: GeneralChatMessage }
  | { type: "PAY_VOICES"; amount: number }
  | { type: "ADD_VOICES"; amount: number }
  | { type: "RESTORE_GAME_STATE"; voiceBalance: number; inventory: InventoryItem[] }
  | { type: "ADD_BONUS"; amount: number }
  | { type: "RESET_ROUND" }
  | { type: "ADD_LOG"; entry: GameLogEntry }
  | { type: "REQUEST_EXTRA_TURN"; playerId: number }
  | { type: "SET_BOTTLE_COOLDOWN_UNTIL"; ts?: number }
  | { type: "SET_BOTTLE_DONOR"; playerId: number; playerName: string }
  // Daily quests
  | { type: "CLAIM_DAILY_QUEST"; questIndex: number; dateKey: string }
  // Predictions
  | { type: "START_PREDICTION_PHASE" }
  | { type: "END_PREDICTION_PHASE" }
  | { type: "ADD_PREDICTION"; prediction: Prediction }
  | { type: "CLEAR_PREDICTIONS" }
  // Betting
  | { type: "PLACE_BET"; bet: Bet }
  | { type: "CLEAR_BETS" }
  | { type: "ADD_TO_POT"; amount: number }
  | { type: "RESET_POT" }
  // Inventory
  | { type: "ADD_INVENTORY_ITEM"; item: InventoryItem }
  /** Подарить розу игроку (50 сердец). Повышает рейтинг симпатии. */
  | { type: "GIVE_ROSE"; fromPlayerId: number; toPlayerId: number }
  /** Обменять розы на голоса: 1 роза = 5 сердец. */
  | { type: "EXCHANGE_ROSES_FOR_VOICES"; amount: number }
  /** Обменять монеты (сердечки) на розы: 5 сердец = 1 роза. */
  | { type: "EXCHANGE_VOICES_FOR_ROSES"; amount: number }
  /** Снять розы из инвентаря (например, вход в «Угадай-ка»). */
  | { type: "REMOVE_INVENTORY_ROSES"; amount: number }
  /** Забрать приветственный подарок при первом заходе (150 сердец). */
  | { type: "CLAIM_WELCOME_GIFT" }
  /** Угадай-ка: добавить выигранный тур; pairPartnerId — с кем в паре (для учёта «дружить профилями»). */
  | { type: "UGADAIKA_ADD_ROUND_WON"; pairPartnerId?: number }
  // Player menu
  | { type: "OPEN_PLAYER_MENU"; player: Player }
  | { type: "CLOSE_PLAYER_MENU" }
  | { type: "SET_AVATAR_FRAME"; playerId: number; frameId: string }
  | { type: "SET_COURTSHIP_PROFILE_ALLOWED"; playerId: number; allowed: boolean }
  | { type: "SET_ALLOW_CHAT_INVITE"; playerId: number; allowed: boolean }
  // VIP
  | { type: "SET_VIP_STATUS"; playerId: number; isVip: boolean; vipUntilTs?: number }
  // Bottle skin
  | { type: "SET_BOTTLE_SKIN"; skin: "classic" | "ruby" | "neon" | "frost" | "baby" | "vip" | "milk" }
  /** Сбросить анимацию «вернулся к нам» после показа. */
  | { type: "CLEAR_RETURNED_FROM_UGADAIKA" }
  /** Включить/выключить звуки эмоций (сохраняется в localStorage). */
  | { type: "SET_SOUNDS_ENABLED"; enabled: boolean }
  /** Магазин: добавить пакет эмоций на сегодня (например, +50 к каждому лимитируемому виду). */
  | { type: "BUY_EMOTION_PACK"; cost: number; extraPerType: number; dateKey: string }
