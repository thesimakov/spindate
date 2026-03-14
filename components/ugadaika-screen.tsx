"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { ArrowLeft, Heart, Trophy } from "lucide-react"
import { AppLoader } from "@/components/app-loader"
import { useGame, generateBots } from "@/lib/game-context"
import type { Player } from "@/lib/game-types"

const SIMULATED_BOT_COUNT = 10
const SIMULATED_UPDATE_INTERVAL_MS = 5000

const ROUND_SECONDS = 10
/** Минимальное время показа лоадера (мс): подгрузка currentUser, участников и стабилизация кода перед стартом */
const LOADER_MIN_MS = 900

function nextSeed(s: number) {
  return (s * 9301 + 49297) % 233280
}

/** Детерминированная перетасовка массива по seed — чтобы не было одних и тех же ботов подряд */
function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = nextSeed(s)
    const j = Math.floor((s / 233280) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Четверо участников (2М + 2Ж) с перемешанным пулом по seed — разные боты при каждом новом seed */
function getShuffledParticipants(
  currentUser: Player | null,
  players: Player[] | null,
  seed: number,
): Player[] {
  if (!currentUser) return []
  const needMale = currentUser.gender === "male" ? 1 : 2
  const needFemale = currentUser.gender === "female" ? 1 : 2
  const others = (players ?? []).filter((p) => p.id !== currentUser.id)
  const bots = generateBots(40, currentUser.gender)
  const pool = shuffleWithSeed([...others, ...bots], seed)
  const males = pool.filter((p) => p.gender === "male").slice(0, needMale)
  const females = pool.filter((p) => p.gender === "female").slice(0, needFemale)
  const fallback = generateBots(20, currentUser.gender)
  const males2 =
    males.length < needMale
      ? [...males, ...fallback.filter((p) => p.gender === "male").slice(0, needMale - males.length)]
      : males
  const females2 =
    females.length < needFemale
      ? [...females, ...fallback.filter((p) => p.gender === "female").slice(0, needFemale - females.length)]
      : females
  const list = [currentUser, ...males2, ...females2].slice(0, 4)
  return shuffleWithSeed(list, seed + 1)
}

/** Каждый участник независимо выбирает одного человека противоположного пола. Возвращает likes: кто кого выбрал.
 * myIndex — если передан, задаём «живое» распределение: с равной вероятностью 0, 1 или 2 человека противоположного пола выбирают тебя. */
function getRandomChoicesOppositeSex(
  participants: Player[],
  seed: number,
  myIndex?: number,
): Record<number, number> | null {
  const maleIdx = participants.map((p, i) => i).filter((i) => participants[i].gender === "male")
  const femaleIdx = participants.map((p, i) => i).filter((i) => participants[i].gender === "female")
  if (maleIdx.length !== 2 || femaleIdx.length !== 2) return null
  const likes: Record<number, number> = {}
  let s = seed

  if (myIndex !== undefined && myIndex >= 0) {
    const isUserMale = participants[myIndex]?.gender === "male"
    const oppositeIdx = isUserMale ? femaleIdx : maleIdx
    const sameIdx = isUserMale ? maleIdx : femaleIdx
    const otherSame = sameIdx.find((i) => i !== myIndex)
    if (otherSame !== undefined && oppositeIdx.length === 2) {
      s = nextSeed(s)
      const roll = (s / 233280) * 3
      const howManyChooseUser = roll < 1 ? 0 : roll < 2 ? 1 : 2
      if (howManyChooseUser === 0) {
        likes[oppositeIdx[0]] = otherSame
        likes[oppositeIdx[1]] = otherSame
      } else if (howManyChooseUser === 1) {
        s = nextSeed(s)
        const whoChoosesUser = (s / 233280) < 0.5 ? 0 : 1
        likes[oppositeIdx[whoChoosesUser]] = myIndex
        likes[oppositeIdx[1 - whoChoosesUser]] = otherSame
      } else {
        likes[oppositeIdx[0]] = myIndex
        likes[oppositeIdx[1]] = myIndex
      }
    }
  }

  for (const m of maleIdx) {
    if (likes[m] !== undefined) continue
    s = nextSeed(s)
    const pick = Math.floor((s / 233280) * 2)
    likes[m] = femaleIdx[pick]
  }
  for (const f of femaleIdx) {
    if (likes[f] !== undefined) continue
    s = nextSeed(s)
    const pick = Math.floor((s / 233280) * 2)
    likes[f] = maleIdx[pick]
  }
  return likes
}

/** Индексы участников, которые выбрали текущего игрока (кто выбрал «тебя»). */
function getWhoChoseMe(likes: Record<number, number>, myIndex: number): number[] {
  return Object.keys(likes)
    .map(Number)
    .filter((i) => likes[i] === myIndex)
}

/** Взаимные пары: оба выбрали друг друга. По ним определяем, кто остаётся, кто выходит. */
function getMutualPairs(likes: Record<number, number>): [number, number][] {
  const pairs: [number, number][] = []
  const done = new Set<number>()
  for (const a of Object.keys(likes).map(Number)) {
    if (done.has(a)) continue
    const b = likes[a]
    if (likes[b] === a && a !== b) {
      pairs.push([Math.min(a, b), Math.max(a, b)])
      done.add(a)
      done.add(b)
    }
  }
  return pairs
}

export function UgadaikaScreen() {
  const { state, dispatch } = useGame()
  const { inventory, ugadaikaRoundsWon, ugadaikaRoundsByPlayer, currentUser, players, voiceBalance } = state
  const rosesCount = useMemo(() => inventory.filter((i) => i.type === "rose").length, [inventory])

  const [gameShuffleSeed, setGameShuffleSeed] = useState(() => Date.now())
  const [isLoading, setIsLoading] = useState(true)

  const participants = useMemo(
    () => getShuffledParticipants(currentUser, players, gameShuffleSeed),
    [currentUser, players, gameShuffleSeed],
  )

  const bgDots = useMemo(() => {
    const seed = Date.now()
    return Array.from({ length: 18 }, (_, i) => {
      const x = (seed * (i + 11) * 9301) % 100
      const y = (seed * (i + 29) * 49297) % 100
      const size = 6 + ((seed + i * 17) % 8)
      const duration = 16 + ((seed + i * 31) % 16)
      const delay = ((seed + i * 13) % 10)
      const isPink = i % 3 === 0
      return { x, y, size, duration, delay, isPink }
    })
  }, [])

  const [phase, setPhase] = useState<"idle" | "playing" | "reveal" | "gameover">("idle")
  const [roundNumber, setRoundNumber] = useState(1)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [timer, setTimer] = useState(ROUND_SECONDS)
  /** Кто кого выбрал: каждый участник независимо выбрал одного противоположного пола */
  const [actualLikes, setActualLikes] = useState<Record<number, number> | null>(null)
  const [roundsWonThisGame, setRoundsWonThisGame] = useState(0)
  /** Побед подряд (для награды «5 подряд — роза») */
  const [consecutiveWins, setConsecutiveWins] = useState(0)
  /** Показать окно «5 побед подряд — роза в подарок» */
  const [showFiveWinsPopup, setShowFiveWinsPopup] = useState(false)
  /** Четверо в текущем раунде; при переходе раунда двое остаются, двое заменяются новыми */
  const [gameParticipants, setGameParticipants] = useState<Player[] | null>(null)
  /** Обратный отсчёт до автоматического перехода к следующему раунду при выигрыше (сек) */
  const [countdownToNextRound, setCountdownToNextRound] = useState<number | null>(null)
  /** Обратный отсчёт до выхода с поля при проигрыше (сек) */
  const [countdownToGameover, setCountdownToGameover] = useState<number | null>(null)
  /** Имитация живых игроков: боты с отрицательными id и их очки (обновляются по таймеру) */
  const [simulatedBots] = useState<Player[]>(() =>
    generateBots(SIMULATED_BOT_COUNT, "male").map((p, i) => ({ ...p, id: -i - 1 })),
  )
  const [simulatedScores, setSimulatedScores] = useState<Record<number, number>>(() =>
    Object.fromEntries(
      Array.from({ length: SIMULATED_BOT_COUNT }, (_, i) => [-(i + 1), Math.floor(Math.random() * 22)]),
    ),
  )
  /** id игрока, чьи очки только что обновились (для анимации) */
  const [lastUpdatedId, setLastUpdatedId] = useState<number | null>(null)
  /** Предыдущие места для анимации смены позиции */
  const prevPlacesRef = useRef<Record<number, number>>({})
  /** Раунд, за который уже начислена победа (чтобы не считать дважды) */
  const lastCreditedWinRoundRef = useRef<number | null>(null)

  /** Участники текущего раунда (4 человека) */
  const participantsInRound = gameParticipants ?? participants
  const currentUserIndex = useMemo(
    () => (currentUser ? participantsInRound.findIndex((p) => p.id === currentUser.id) : -1),
    [currentUser, participantsInRound],
  )
  /** Кто выбрал текущего игрока (индексы участников) */
  const whoChoseMe = useMemo(
    () => (actualLikes && currentUserIndex >= 0 ? getWhoChoseMe(actualLikes, currentUserIndex) : []),
    [actualLikes, currentUserIndex],
  )
  /** Фактические выборы с учётом клика пользователя: твой выбор в раунде = кого ты нажал. */
  const effectiveLikes = useMemo(() => {
    if (!actualLikes || currentUserIndex < 0) return actualLikes ?? null
    const guessed = selectedIds[0]
    if (guessed === undefined || guessed === null) return actualLikes
    return { ...actualLikes, [currentUserIndex]: guessed }
  }, [actualLikes, currentUserIndex, selectedIds])
  /** Взаимные пары по эффективным выборам (твой выбор = твой клик). */
  const mutualPairs = useMemo(
    () => (effectiveLikes ? getMutualPairs(effectiveLikes) : []),
    [effectiveLikes],
  )
  /** Текущий игрок в взаимной паре? (тогда остаётся в игре) */
  const amIInMutualPair = useMemo(
    () => currentUserIndex >= 0 && mutualPairs.some(([a, b]) => a === currentUserIndex || b === currentUserIndex),
    [currentUserIndex, mutualPairs],
  )
  /** С кем в паре (при победе): второй участник взаимной пары */
  const myPairPartner = useMemo(() => {
    const pair = mutualPairs.find(([a, b]) => a === currentUserIndex || b === currentUserIndex)
    if (!pair) return null
    const partnerIndex = pair[0] === currentUserIndex ? pair[1] : pair[0]
    return participantsInRound[partnerIndex] ?? null
  }, [mutualPairs, currentUserIndex, participantsInRound])

  const startGame = useCallback(() => {
    const seed = Date.now()
    setGameShuffleSeed(seed)
    const four = getShuffledParticipants(currentUser, players, seed)
    setRoundNumber(1)
    setRoundsWonThisGame(0)
    setConsecutiveWins(0)
    setShowFiveWinsPopup(false)
    lastCreditedWinRoundRef.current = null
    setGameParticipants(four)
    setPhase("playing")
    setSelectedIds([])
    setTimer(ROUND_SECONDS)
    const myIdx = four.findIndex((p) => p.id === currentUser.id)
    setActualLikes(getRandomChoicesOppositeSex(four, seed + 1, myIdx >= 0 ? myIdx : undefined) ?? {})
  }, [currentUser, players])

  const startNextRound = useCallback(() => {
    if (!currentUser || !gameParticipants || gameParticipants.length !== 4 || !actualLikes) return
    const likesForPair = effectiveLikes ?? actualLikes
    const pairs = getMutualPairs(likesForPair)
    const myPair = pairs.find(([a, b]) => a === currentUserIndex || b === currentUserIndex)
    if (!myPair) return
    const [stayA, stayB] = myPair
    const playerA = gameParticipants[stayA]
    const playerB = gameParticipants[stayB]
    if (!playerA || !playerB) return
    let stayPlayers: Player[] = playerA.id === currentUser.id ? [playerA, playerB] : [playerB, playerA]
    if (stayPlayers[0].id !== currentUser.id) return
    const currentRoundIds = new Set(gameParticipants.map((p) => p.id))
    const nextRoundNum = roundNumber + 1
    const freshBots = generateBots(60, currentUser?.gender ?? "male").map((p, i) => ({
      ...p,
      id: 50000 + nextRoundNum * 1000 + i,
    }))
    const others = (players ?? []).filter((p) => p.id !== currentUser?.id && !currentRoundIds.has(p.id))
    const pool = [...others, ...freshBots]
    const shuffledPool = shuffleWithSeed(pool, nextRoundNum * 1000 + Date.now())
    const males = shuffledPool.filter((p) => p.gender === "male")
    const females = shuffledPool.filter((p) => p.gender === "female")
    const oneMale = males[0]
    const oneFemale = females[0]
    const newPlayers: Player[] = []
    if (oneMale) newPlayers.push(oneMale)
    if (oneFemale) newPlayers.push(oneFemale)
    if (newPlayers.length < 2) {
      const extra = generateBots(10, currentUser?.gender ?? "male").map((p, i) => ({
        ...p,
        id: 60000 + nextRoundNum * 1000 + i,
      }))
      if (!oneMale) newPlayers.unshift(extra.filter((p) => p.gender === "male")[0] ?? extra[0])
      if (!oneFemale) newPlayers.push(extra.filter((p) => p.gender === "female")[0] ?? extra[1] ?? extra[0])
    }
    const nextFour: Player[] = [...stayPlayers, ...newPlayers.slice(0, 2)]
    let nextLikes = getRandomChoicesOppositeSex(nextFour, Date.now() + nextRoundNum + 100, 0)
    if (!nextLikes) return
    nextLikes = { ...nextLikes, 0: 1, 1: 0 }
    setGameParticipants(nextFour)
    setRoundNumber((r) => r + 1)
    setSelectedIds([])
    setTimer(ROUND_SECONDS)
    setActualLikes(nextLikes)
    setPhase("playing")
  }, [gameParticipants, actualLikes, effectiveLikes, currentUserIndex, currentUser, players, roundNumber])

  useEffect(() => {
    if (phase !== "playing" || timer <= 0) return
    const t = setInterval(() => setTimer((x) => x - 1), 1000)
    return () => clearInterval(t)
  }, [phase, timer])

  useEffect(() => {
    if (phase !== "playing") return
    if (timer <= 0) {
      setPhase("reveal")
    }
  }, [phase, timer, selectedIds.length])

  /** Один клик: угадать, кто выбрал тебя. Выбрать можно только противоположный пол. */
  const handleAvatarClick = (index: number) => {
    if (phase !== "playing" || selectedIds.length >= 1) return
    if (index === currentUserIndex) return
    if (participantsInRound[index].gender === participantsInRound[currentUserIndex].gender) return
    setSelectedIds([index])
  }

  const guessedWhoChoseMe = selectedIds[0] ?? null

  const guessedCorrectly =
    guessedWhoChoseMe !== null && whoChoseMe.length > 0 && whoChoseMe.includes(guessedWhoChoseMe)

  useEffect(() => {
    if (phase !== "reveal" || !guessedCorrectly) return
    if (lastCreditedWinRoundRef.current === roundNumber) return
    lastCreditedWinRoundRef.current = roundNumber
    setRoundsWonThisGame((w) => w + 1)
    const nextConsecutive = consecutiveWins + 1
    setConsecutiveWins(nextConsecutive >= 5 ? 0 : nextConsecutive)
    if (nextConsecutive >= 5) {
      dispatch({
        type: "ADD_INVENTORY_ITEM",
        item: {
          type: "rose",
          fromPlayerId: 0,
          fromPlayerName: "Угадай-ка",
          timestamp: Date.now(),
        },
      })
      setShowFiveWinsPopup(true)
    }
    dispatch({ type: "UGADAIKA_ADD_ROUND_WON", pairPartnerId: myPairPartner?.id })
  }, [phase, guessedCorrectly, roundNumber, consecutiveWins, dispatch, myPairPartner?.id])

  const amIInMutualPairForCountdown = phase === "reveal" && whoChoseMe.length > 0 && amIInMutualPair && guessedCorrectly
  useEffect(() => {
    if (amIInMutualPairForCountdown && countdownToNextRound === null) {
      setCountdownToNextRound(5)
    }
  }, [amIInMutualPairForCountdown, countdownToNextRound])

  useEffect(() => {
    if (countdownToNextRound === null || countdownToNextRound <= 0) return
    const id = setInterval(() => {
      setCountdownToNextRound((c) => (c !== null && c > 0 ? c - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [countdownToNextRound])

  useEffect(() => {
    if (countdownToNextRound === 0) {
      startNextRound()
      setCountdownToNextRound(null)
    }
  }, [countdownToNextRound, startNextRound])

  const isLoseReveal = phase === "reveal" && whoChoseMe.length > 0 && (!amIInMutualPair || !guessedCorrectly)
  useEffect(() => {
    if (isLoseReveal) setConsecutiveWins(0)
  }, [isLoseReveal])
  useEffect(() => {
    if (isLoseReveal && countdownToGameover === null) {
      setCountdownToGameover(5)
    }
  }, [isLoseReveal, countdownToGameover])

  useEffect(() => {
    if (countdownToGameover === null || countdownToGameover <= 0) return
    const id = setInterval(() => {
      setCountdownToGameover((c) => (c !== null && c > 0 ? c - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [countdownToGameover])

  useEffect(() => {
    if (countdownToGameover === 0) {
      setPhase("gameover")
      setCountdownToGameover(null)
    }
  }, [countdownToGameover])

  /** Новая попытка в том же раунде: новые пары, снова 10 сек */
  const retryRound = useCallback(() => {
    const seed = Date.now() + roundNumber + Math.floor(Math.random() * 1e6)
    setActualLikes(getRandomChoicesOppositeSex(participantsInRound, seed, currentUserIndex >= 0 ? currentUserIndex : undefined) ?? {})
    setSelectedIds([])
    setTimer(ROUND_SECONDS)
    setPhase("playing")
  }, [participantsInRound, roundNumber, currentUserIndex])

  const handleRevealContinue = () => {
    if (guessedCorrectly) {
      startNextRound()
    }
  }

  const backToGame = () => {
    dispatch({ type: "SET_SCREEN", screen: "game" })
  }

  const totalRoundsWon = (ugadaikaRoundsWon ?? 0)

  /** Рейтинг Угадай-ка: реальные игроки */
  const ugadaikaLeaderboard = useMemo(() => {
    const byPlayer = ugadaikaRoundsByPlayer ?? {}
    const seen = new Set<number>()
    const list: { player: Player; rounds: number }[] = []
    if (currentUser) {
      seen.add(currentUser.id)
      list.push({ player: currentUser, rounds: byPlayer[currentUser.id] ?? 0 })
    }
    for (const p of players ?? []) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      list.push({ player: p, rounds: byPlayer[p.id] ?? 0 })
    }
    return list
  }, [currentUser, players, ugadaikaRoundsByPlayer])

  /** Полный рейтинг: реальные + имитация живых игроков (боты), сортировка по очкам — места меняются */
  const fullLeaderboard = useMemo(() => {
    const real = ugadaikaLeaderboard
    const sim = simulatedBots.map((p) => ({ player: p, rounds: simulatedScores[p.id] ?? 0 }))
    return [...real, ...sim].sort((a, b) => b.rounds - a.rounds)
  }, [ugadaikaLeaderboard, simulatedBots, simulatedScores])

  /** Место текущего пользователя в общей таблице (1-based); 0 — не в таблице */
  const myPlaceInTable = useMemo(() => {
    if (!currentUser?.id) return 0
    const idx = fullLeaderboard.findIndex((item) => item.player.id === currentUser.id)
    return idx < 0 ? 0 : idx + 1
  }, [fullLeaderboard, currentUser?.id])

  /** Периодическое обновление очков у случайного «живого» бота — имитация активности */
  useEffect(() => {
    const t = setInterval(() => {
      const idx = Math.floor(Math.random() * SIMULATED_BOT_COUNT)
      const botId = -(idx + 1)
      setSimulatedScores((prev) => ({ ...prev, [botId]: (prev[botId] ?? 0) + 1 }))
      setLastUpdatedId(botId)
    }, SIMULATED_UPDATE_INTERVAL_MS)
    return () => clearInterval(t)
  }, [])

  /** Сброс подсветки строки после анимации */
  useEffect(() => {
    if (lastUpdatedId === null) return
    const id = setTimeout(() => setLastUpdatedId(null), 650)
    return () => clearTimeout(id)
  }, [lastUpdatedId])

  /** Запоминаем места для анимации смены позиции */
  useEffect(() => {
    const next: Record<number, number> = {}
    fullLeaderboard.forEach((item, i) => {
      next[item.player.id] = i + 1
    })
    prevPlacesRef.current = next
  }, [fullLeaderboard])

  /** Лоадер: ждём готовности данных (currentUser, 4 участника с валидными данными) и минимальное время — чтобы код успел подгрузиться и всё работало */
  const participantsReady =
    currentUser &&
    participants.length === 4 &&
    participants.every((p) => p != null && typeof p.id === "number" && (p.gender === "male" || p.gender === "female"))
  useEffect(() => {
    if (!participantsReady) return
    const timer = setTimeout(() => setIsLoading(false), LOADER_MIN_MS)
    return () => clearTimeout(timer)
  }, [participantsReady])

  if (!currentUser) return null

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] game-bg-animated">
        <AppLoader
          title="Подготовка игры..."
          subtitle="Загружаем участников и настройки"
          hint="Угадай-ка"
        />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-y-auto text-slate-100 pb-[env(safe-area-inset-bottom)] game-bg-animated">
      <div className="game-particles" aria-hidden="true">
        {bgDots.map((d, idx) => (
          <span
            key={idx}
            className={`game-particles__dot ${d.isPink ? "game-particles__dot--pink" : ""}`}
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: `${d.size}px`,
              height: `${d.size}px`,
              animationDuration: `${d.duration}s`,
              animationDelay: `${d.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 flex min-h-dvh flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700 px-4 py-3">
        <button
          type="button"
          onClick={backToGame}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700/80 text-slate-200 hover:bg-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Угадай-ка</h1>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-slate-700/80 px-3 py-1.5 text-sm">
            <span className="text-amber-300">🌹</span>
            <span>{rosesCount}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-slate-700/80 px-3 py-1.5 text-sm">
            <Heart className="h-4 w-4 text-rose-400" fill="currentColor" />
            <span>{voiceBalance ?? 0}</span>
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 min-h-0 w-full">
        {/* Топ 10 по Угадай-ка — слева, не сдвигает центр контента */}
        <aside className="absolute left-0 top-0 bottom-0 z-10 hidden w-[200px] flex-col border-r border-slate-700 bg-slate-900/50 p-3 overflow-hidden md:flex">
          <div className="flex items-center gap-1.5 mb-2 shrink-0">
            <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="text-xs font-bold text-amber-200">Топ 10</span>
          </div>
          <p className="text-[10px] text-slate-400 mb-1 shrink-0">Выиграно туров в Угадай-ка</p>
          {myPlaceInTable > 0 && (
            <p className="text-[11px] font-semibold text-amber-300 mb-2 shrink-0">
              Ваше место в таблице: {myPlaceInTable}
            </p>
          )}
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto min-h-0 py-0.5">
            {fullLeaderboard.length === 0 ? (
              <p className="text-[10px] text-slate-500 py-2">Пока нет данных</p>
            ) : (
              fullLeaderboard.map((item, i) => {
                const place = i + 1
                const isTop10 = place <= 10
                const isYou = item.player.id === currentUser?.id
                const prevPlace = prevPlacesRef.current[item.player.id]
                const placeChanged = prevPlace !== undefined && prevPlace !== place
                const scoreJustUpdated = lastUpdatedId === item.player.id
                return (
                  <div
                    key={item.player.id}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 min-h-0 transition-colors duration-300 ${
                      scoreJustUpdated ? "ugadaika-top10-row-updated" : ""
                    } ${placeChanged ? "ugadaika-top10-place-changed" : ""}`}
                    style={{
                      background: isTop10 && !scoreJustUpdated ? "rgba(232, 192, 106, 0.12)" : undefined,
                      borderLeft: isTop10 ? "3px solid rgb(251 191 36)" : "3px solid transparent",
                    }}
                  >
                    <span className="w-5 shrink-0 text-[10px] font-bold tabular-nums text-amber-400/90">
                      {place}.
                    </span>
                    <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-slate-600 bg-slate-700">
                      {item.player.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.player.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">?</span>
                      )}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-[11px] text-slate-200">
                      {isYou ? `${item.player.name} (вы)` : item.player.name}
                    </span>
                    <span className="text-[10px] font-semibold shrink-0 tabular-nums text-amber-300/90">
                      {item.rounds}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        <main className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto md:ml-[200px]">
      {phase === "idle" && (
        <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-8">
          <div
            className="relative w-full max-w-lg rounded-[28px] border border-slate-600/80 bg-slate-900/60 px-6 py-8 shadow-[0_24px_60px_rgba(0,0,0,0.4)]"
            style={{ backdropFilter: "blur(12px)" }}
          >
            <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/5" />
            <div className="relative flex flex-col items-center gap-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/30 to-rose-500/30 shadow-[0_0_24px_rgba(251,191,36,0.2)]">
                <Heart className="h-7 w-7 text-amber-400/90" fill="currentColor" />
              </div>
              <h2 className="text-center text-xl font-bold text-slate-100">Как играть</h2>
              <div className="space-y-3 text-center">
                <p className="text-[15px] leading-relaxed text-slate-300">
                  Четверо участников (2 парня и 2 девушки). Каждый выбирает одного человека противоположного пола. Твоя задача — угадать, кто выбрал тебя.
                </p>
                <p className="text-[15px] leading-relaxed text-slate-300">
                  Кто угадал свою пару — остаётся; кто не угадал — выходит. К оставшейся паре подключаются два новых участника.
                </p>
                <p className="text-sm font-medium text-amber-200/90">
                  Таймер 10 сек. Не в паре или не угадал — вылетаешь. Никто не выбрал тебя — ещё один шанс.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-200">Рейтинг: {totalRoundsWon} туров</span>
              </div>
              <button
                type="button"
                onClick={startGame}
                className="mt-2 w-full max-w-xs rounded-2xl py-4 text-lg font-bold text-white shadow-[0_4px_20px_rgba(225,29,72,0.45)] transition-all hover:scale-[1.02] hover:shadow-[0_6px_28px_rgba(225,29,72,0.55)] active:scale-[0.98] disabled:opacity-40"
                style={{
                  background: "linear-gradient(180deg, #f43f5e 0%, #be123c 50%, #9f1239 100%)",
                  border: "2px solid rgba(251, 191, 36, 0.35)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                Играть
              </button>
            </div>
          </div>
        </div>
      )}

      {(phase === "playing" || phase === "reveal") && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-6 min-h-0">
          <div className="flex items-center justify-between w-full max-w-md">
            <span className="text-slate-400">Раунд {roundNumber}</span>
            <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2">
              <span className="text-2xl font-mono font-bold tabular-nums text-amber-400">{timer}</span>
              <span className="text-slate-400">сек</span>
            </div>
          </div>

          <div
            className="relative w-full max-w-md rounded-[28px] border border-slate-700 bg-[rgba(2,6,23,0.55)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
            style={{
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-white/5" />
            <div className="relative grid w-full grid-cols-2 gap-5 sm:gap-6">
            {participantsInRound.map((p, index) => {
              const isNotClickable =
                phase === "playing" &&
                (index === currentUserIndex || participantsInRound[index].gender === participantsInRound[currentUserIndex].gender)
              return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleAvatarClick(index)}
                disabled={phase !== "playing" || selectedIds.length >= 1 || isNotClickable}
                title={isNotClickable ? "Выбирать можно только того, кто мог выбрать тебя (противоположный пол)" : undefined}
                className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2 transition-all ${
                  isNotClickable
                    ? "cursor-not-allowed opacity-50 border-slate-600 bg-slate-800/80"
                    : selectedIds.includes(index)
                      ? "border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/50"
                      : phase === "reveal" && whoChoseMe.length > 0
                        ? whoChoseMe.includes(index)
                          ? "border-emerald-500 bg-emerald-500/20"
                          : "border-slate-600 bg-slate-800/80"
                        : "border-slate-600 bg-slate-800/80 hover:border-slate-500"
                }`}
              >
                <div className="h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-full border-2 border-slate-600 shadow-[0_10px_25px_rgba(0,0,0,0.55)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                </div>
                <span className="text-xs font-semibold text-slate-200 truncate max-w-full">
                  {p.id === currentUser.id ? `${p.name} (вы)` : p.name}
                </span>
                {phase === "playing" && selectedIds.includes(index) && (
                  <span className="text-[10px] font-medium text-amber-400">твой выбор</span>
                )}
                {phase === "reveal" && actualLikes && actualLikes[index] !== undefined && (
                  <p className="text-sm font-medium text-rose-300 flex items-center gap-1">
                    <Heart className="h-4 w-4 fill-current shrink-0" />
                    → {participantsInRound[actualLikes[index]].name}
                  </p>
                )}
              </button>
              );
            })}
            </div>

            {phase === "playing" && selectedIds.length === 1 && guessedWhoChoseMe !== null && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border-2 border-amber-400/70 bg-amber-500/15 px-4 py-2">
                <span className="text-sm font-semibold text-amber-200">Твой выбор:</span>
                <span className="text-sm font-medium text-amber-200">
                  {participantsInRound[guessedWhoChoseMe].name}
                </span>
              </div>
            )}

            {phase === "reveal" && guessedWhoChoseMe !== null && (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2">
                <span className="text-sm text-slate-400">Твой выбор:</span>
                <span className="text-sm font-medium text-slate-200">{participantsInRound[guessedWhoChoseMe].name}</span>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
              <span className="text-[12px] text-slate-300">
                {phase === "playing"
                  ? `Угадай, кто выбрал тебя: ${selectedIds.length === 1 ? "выбрано" : "выбери одного"}`
                  : whoChoseMe.length === 0
                    ? "Никто не выбрал тебя. Ещё один шанс!"
                    : !amIInMutualPair
                      ? "Ты не в паре — выходишь из игры."
                      : guessedCorrectly
                        ? "Верно! Ты в паре и угадал — остаёшься."
                        : "Ты не угадал пару — вылетаешь из игры."}
              </span>
              <span className="text-[12px] font-semibold text-slate-200">
                Рейтинг: {totalRoundsWon}
              </span>
            </div>
          </div>

          {phase === "playing" && (
            <p className="text-center text-sm text-slate-400">
              Кто из участников противоположного пола выбрал тебя? Выбери одного.
            </p>
          )}

          {phase === "reveal" && (
            <div className="ugadaika-result-popup-backdrop" aria-modal="true" role="dialog">
              <div className="ugadaika-result-popup-box flex flex-col items-center gap-4">
                {whoChoseMe.length === 0 ? (
                  <div className="w-full rounded-2xl border-2 border-slate-500 bg-slate-800/95 p-6 shadow-2xl">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm font-medium text-amber-200/90">Никто не выбрал тебя</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {participantsInRound.filter((p) => p.id !== currentUser?.id && p.gender !== currentUser?.gender).map((p) => (
                          <div key={p.id} className="flex flex-col items-center gap-0.5">
                            <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-amber-500/50 bg-slate-700">
                              {p.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-400 text-sm">{p.name?.slice(0, 1) ?? "?"}</div>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 truncate max-w-[3rem]">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-slate-200 mt-4">Ещё один шанс!</p>
                    <p className="mt-2 text-slate-400">Выиграно туров в этой игре: {roundsWonThisGame}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={retryRound}
                        className="rounded-xl bg-rose-600 px-6 py-3 font-bold text-white hover:bg-rose-500"
                      >
                        Попробовать снова
                      </button>
                      <button
                        type="button"
                        onClick={backToGame}
                        className="rounded-xl border border-slate-500 px-6 py-3 text-slate-300 hover:bg-slate-700"
                      >
                        К столу
                      </button>
                    </div>
                  </div>
                ) : !amIInMutualPair ? (
                  <div className="ugadaika-result-lose w-full">
                    <div className="ugadaika-result-glow rounded-2xl border-2 border-amber-500/50 bg-slate-800/95 p-6 shadow-2xl">
                      <div className="flex flex-col items-center gap-3">
                        {guessedWhoChoseMe !== null && actualLikes && (() => {
                          const chosenByMe = participantsInRound[guessedWhoChoseMe]
                          const chosenByThem = actualLikes[guessedWhoChoseMe]
                          const nameA = chosenByMe?.name ?? "?"
                          const nameB = chosenByThem !== undefined && participantsInRound[chosenByThem]
                            ? (chosenByThem === currentUserIndex ? "тебя" : (participantsInRound[chosenByThem]?.name ?? "?"))
                            : "другого"
                          return (
                            <p className="text-base font-semibold text-amber-300">
                              Увы — {nameA} выбрал{chosenByMe?.gender === "female" ? "а" : ""} {nameB}
                            </p>
                          )
                        })()}
                        <div className="flex flex-wrap justify-center gap-3">
                          {whoChoseMe.length > 0
                            ? whoChoseMe.map((i) => {
                                const p = participantsInRound[i]
                                return (
                                  <div key={p.id} className="flex flex-col items-center gap-0.5">
                                    <div className="ring-4 ring-red-500/90 rounded-full p-0.5 bg-slate-800 shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                                      {p.avatar ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={p.avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
                                      ) : (
                                        <div className="h-16 w-16 rounded-full bg-slate-600 flex items-center justify-center text-slate-400 text-lg">{p.name?.slice(0, 1) ?? "?"}</div>
                                      )}
                                    </div>
                                    <span className="text-xs text-slate-300">{p.name}</span>
                                  </div>
                                )
                              })
                            : participantsInRound.filter((p) => p.id !== currentUser?.id && p.gender !== currentUser?.gender).map((p) => (
                                <div key={p.id} className="flex flex-col items-center gap-0.5">
                                  <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-slate-500 bg-slate-700">
                                    {p.avatar ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-slate-400 text-sm">{p.name?.slice(0, 1) ?? "?"}</div>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 truncate max-w-[3rem]">{p.name}</span>
                                </div>
                              ))}
                        </div>
                        <p className="text-sm font-medium text-slate-300 mt-1">
                          {whoChoseMe.length > 0 ? (
                            <>Тебя выбрал{whoChoseMe.length === 1 ? "а" : "и"}: {whoChoseMe.map((i) => participantsInRound[i].name).join(" и ")}</>
                          ) : (
                            "Тебя никто не выбрал"
                          )}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-amber-400 mt-4">Ты не в взаимной паре — выходишь из игры.</p>
                      <p className="mt-1 text-center text-sm text-slate-400">Образовавшаяся пара остаётся, к ним подключаются другие игроки.</p>
                      <p className="mt-2 text-slate-400">Выиграно туров в этой игре: {roundsWonThisGame}</p>
                      {countdownToGameover !== null && countdownToGameover > 0 && (
                        <p className="mt-3 text-center text-sm font-medium text-amber-200">
                          Выход с поля через {countdownToGameover} сек
                        </p>
                      )}
                    </div>
                  </div>
                ) : guessedCorrectly ? (
                  <div className="ugadaika-result-win w-full">
                    <div className="ugadaika-result-glow rounded-2xl border-2 border-emerald-500/50 bg-slate-800/95 p-6 shadow-2xl">
                      <div className="flex flex-col items-center gap-3">
                        {guessedWhoChoseMe !== null && (() => {
                          const shownPartner = participantsInRound[guessedWhoChoseMe]
                          return shownPartner ? (
                            <>
                              <p className="text-sm font-medium text-emerald-200">Ты в паре с: {shownPartner.name}</p>
                              <div className="ring-4 ring-emerald-500/90 rounded-full p-0.5 bg-slate-800 shadow-[0_0_12px_rgba(34,197,94,0.5)]">
                                {shownPartner.avatar ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={shownPartner.avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
                                ) : (
                                  <div className="h-16 w-16 rounded-full bg-slate-600 flex items-center justify-center text-slate-400 text-lg">{shownPartner.name?.slice(0, 1) ?? "?"}</div>
                                )}
                              </div>
                            </>
                          ) : (
                            <p className="text-sm font-medium text-emerald-200">Ты угадал пару!</p>
                          )
                        })()}
                        {guessedWhoChoseMe === null && <p className="text-sm font-medium text-emerald-200">Ты угадал пару!</p>}
                      </div>
                      <p className="text-lg font-semibold text-emerald-300 mt-4">Верно! Остаёшься в игре.</p>
                      <p className="mt-2 text-sm font-medium text-emerald-200/90">+10 сердец</p>
                      {totalRoundsWon > 0 && totalRoundsWon % 10 === 0 && (
                        <p className="text-sm font-medium text-rose-200/90">+1 роза за 10 побед!</p>
                      )}
                      <p className="mt-1 text-center text-sm text-slate-400">Вторая пара выходит. К вам с партнёром подключаются два новых участника.</p>
                      <p className="mt-2 text-slate-400">Выиграно туров в этой игре: {roundsWonThisGame + 1}</p>
                      {countdownToNextRound !== null && countdownToNextRound > 0 && (
                        <p className="mt-3 text-center text-sm font-medium text-emerald-200">
                          Следующий раунд через {countdownToNextRound} сек
                        </p>
                      )}
                      <p className="mt-4 text-center text-sm font-semibold text-emerald-300/90">
                        Вы вместе идёте дальше в игру.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="ugadaika-result-lose w-full">
                    <div className="ugadaika-result-glow rounded-2xl border-2 border-amber-500/50 bg-slate-800/95 p-6 shadow-2xl">
                      <div className="flex flex-col items-center gap-3">
                        {guessedWhoChoseMe !== null && actualLikes && (() => {
                          const chosenByMe = participantsInRound[guessedWhoChoseMe]
                          const chosenByThem = actualLikes[guessedWhoChoseMe]
                          const nameA = chosenByMe?.name ?? "?"
                          const nameB = chosenByThem !== undefined && participantsInRound[chosenByThem]
                            ? (chosenByThem === currentUserIndex ? "тебя" : (participantsInRound[chosenByThem]?.name ?? "?"))
                            : "другого"
                          return (
                            <p className="text-base font-semibold text-amber-300">
                              Увы — {nameA} выбрал{chosenByMe?.gender === "female" ? "а" : ""} {nameB}
                            </p>
                          )
                        })()}
                        <div className="flex flex-wrap justify-center gap-3">
                          {whoChoseMe.length > 0
                            ? whoChoseMe.map((i) => {
                                const p = participantsInRound[i]
                                return (
                                  <div key={p.id} className="flex flex-col items-center gap-0.5">
                                    <div className="ring-4 ring-red-500/90 rounded-full p-0.5 bg-slate-800 shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                                      {p.avatar ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={p.avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
                                      ) : (
                                        <div className="h-16 w-16 rounded-full bg-slate-600 flex items-center justify-center text-slate-400 text-lg">{p.name?.slice(0, 1) ?? "?"}</div>
                                      )}
                                    </div>
                                    <span className="text-xs text-slate-300">{p.name}</span>
                                  </div>
                                )
                              })
                            : null}
                        </div>
                        <p className="text-sm font-medium text-slate-300 mt-1">
                          {whoChoseMe.length > 0 ? (
                            <>Тебя выбрал{whoChoseMe.length === 1 ? "а" : "и"}: {whoChoseMe.map((i) => participantsInRound[i].name).join(" и ")}</>
                          ) : (
                            "Тебя никто не выбрал"
                          )}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-amber-400 mt-4">Ты не угадал, кто выбрал тебя — вылетаешь из игры.</p>
                      <p className="mt-2 text-slate-400">Выиграно туров в этой игре: {roundsWonThisGame}</p>
                      {countdownToGameover !== null && countdownToGameover > 0 && (
                        <p className="mt-3 text-center text-sm font-medium text-amber-200">
                          Выход с поля через {countdownToGameover} сек
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showFiveWinsPopup && (
        <div className="ugadaika-result-popup-backdrop fixed inset-0 z-[60]" aria-modal="true" role="dialog">
          <div className="ugadaika-result-popup-box flex flex-col items-center gap-4 rounded-2xl border-2 border-amber-500/60 bg-slate-800/98 p-6 shadow-2xl">
            <p className="text-center text-2xl font-bold text-amber-300">5 побед подряд!</p>
            <p className="text-center text-lg text-rose-200">Роза в подарок 🌹</p>
            <p className="text-center text-sm text-slate-400">Роза добавлена в ваш инвентарь</p>
            <button
              type="button"
              onClick={() => setShowFiveWinsPopup(false)}
              className="mt-2 rounded-xl bg-amber-500 px-6 py-3 font-bold text-slate-900 hover:bg-amber-400"
            >
              Отлично!
            </button>
          </div>
        </div>
      )}

      {phase === "gameover" && (
        <div className="flex flex-1 w-full min-h-full flex-col items-center justify-center gap-6 px-6 py-8">
          <h2 className="text-xl font-bold text-amber-400 text-center">Игра окончена</h2>
          <p className="text-center text-slate-300">
            До вылета вы выиграли туров: {roundsWonThisGame}
          </p>
          <p className="text-center text-sm text-slate-500">Всего в рейтинге: {totalRoundsWon} туров</p>
          <button
            type="button"
            onClick={startGame}
            className="rounded-xl bg-rose-600 px-8 py-4 text-lg font-bold text-white disabled:opacity-40 hover:bg-rose-500"
          >
            Играть снова
          </button>
          <button type="button" onClick={backToGame} className="rounded-xl border border-slate-500 px-6 py-2 text-slate-300 hover:bg-slate-700">
            К столу
          </button>
        </div>
      )}
        </main>
      </div>
    </div>
    </div>
  )
}
