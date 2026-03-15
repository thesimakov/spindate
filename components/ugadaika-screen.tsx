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

const SAME_SEX_COUNT = 4
const OPPOSITE_SEX_COUNT = 4
const PARTICIPANTS_TOTAL = SAME_SEX_COUNT + OPPOSITE_SEX_COUNT // 8

/** 8 участников: 4 одного пола с пользователем (индексы 0–3, снизу), 4 противоположного (индексы 4–7, сверху). Сначала боты со стола, при нехватке — из пула ботов. */
function getShuffledParticipants(
  currentUser: Player | null,
  players: Player[] | null,
  seed: number,
): Player[] {
  if (!currentUser) return []
  const needSame = SAME_SEX_COUNT   // 4 того же пола (включая пользователя)
  const needOpposite = OPPOSITE_SEX_COUNT // 4 противоположного пола
  const others = (players ?? []).filter((p) => p.id !== currentUser.id)
  const shuffledOthers = shuffleWithSeed([...others], seed)
  const bots = generateBots(120, currentUser.gender)
  const shuffledBots = shuffleWithSeed(bots, seed + 1000)
  const pool = [...shuffledOthers, ...shuffledBots]
  const sameSex = pool.filter((p) => p.gender === currentUser.gender)
  const oppositeSex = pool.filter((p) => p.gender !== currentUser.gender)
  const fallback = generateBots(40, currentUser.gender).map((p, i) => ({ ...p, id: 20000 + seed + i }))
  const sameSexPool = [...sameSex, ...fallback.filter((p) => p.gender === currentUser.gender)]
  const oppositeSexPool = [...oppositeSex, ...fallback.filter((p) => p.gender !== currentUser.gender)]
  const sameFour: Player[] = [currentUser]
  for (let i = 0; i < needSame - 1; i++) {
    sameFour.push(sameSexPool[i] ?? fallback[i])
  }
  const oppositeFour: Player[] = oppositeSexPool.slice(0, needOpposite)
  while (oppositeFour.length < needOpposite) {
    oppositeFour.push(fallback.filter((p) => p.gender !== currentUser.gender)[oppositeFour.length] ?? fallback[0])
  }
  return [...shuffleWithSeed(sameFour, seed + 1), ...shuffleWithSeed(oppositeFour, seed + 2)]
}

/** Индексы: 0–3 = того же пола, что пользователь (снизу), 4–7 = противоположного (сверху). Каждый выбирает одного из противоположной группы. */
function getSameSexIndices(participants: Player[], currentUserIndex: number): number[] {
  const userGender = participants[currentUserIndex]?.gender
  return participants.map((p, i) => i).filter((i) => participants[i].gender === userGender)
}
function getOppositeSexIndices(participants: Player[], currentUserIndex: number): number[] {
  const userGender = participants[currentUserIndex]?.gender
  return participants.map((p, i) => i).filter((i) => participants[i].gender !== userGender)
}

/** 8 участников: 0–3 same, 4–7 opposite. Каждый выбирает одного противоположного пола. myIndex — индекс пользователя (в 0–3), задаём, сколько из 4 противоположных выбирают его (0–4). */
function getRandomChoicesOppositeSex(
  participants: Player[],
  seed: number,
  myIndex?: number,
): Record<number, number> | null {
  const sameIdx = participants.length === PARTICIPANTS_TOTAL && myIndex !== undefined && myIndex >= 0
    ? getSameSexIndices(participants, myIndex)
    : participants.map((p, i) => i).filter((i) => participants[i].gender === "male")
  const oppositeIdx = participants.length === PARTICIPANTS_TOTAL && myIndex !== undefined && myIndex >= 0
    ? getOppositeSexIndices(participants, myIndex)
    : participants.map((p, i) => i).filter((i) => participants[i].gender === "female")
  if (sameIdx.length !== OPPOSITE_SEX_COUNT || oppositeIdx.length !== OPPOSITE_SEX_COUNT) return null
  const likes: Record<number, number> = {}
  let s = seed

  if (myIndex !== undefined && myIndex >= 0 && sameIdx.length === 4 && oppositeIdx.length === 4) {
    const otherSame = sameIdx.filter((i) => i !== myIndex)
    s = nextSeed(s)
    const howManyChooseUser = Math.floor((s / 233280) * 5)
    const countChooseUser = Math.min(howManyChooseUser, 4)
    const chooserIndices = shuffleWithSeed([...oppositeIdx], s).slice(0, countChooseUser)
    const otherOpposite = oppositeIdx.filter((i) => !chooserIndices.includes(i))
    for (const i of chooserIndices) likes[i] = myIndex
    for (const i of otherOpposite) {
      s = nextSeed(s)
      likes[i] = otherSame[Math.floor((s / 233280) * otherSame.length)]
    }
  }

  for (const i of sameIdx) {
    if (likes[i] !== undefined) continue
    s = nextSeed(s)
    likes[i] = oppositeIdx[Math.floor((s / 233280) * oppositeIdx.length)]
  }
  for (const i of oppositeIdx) {
    if (likes[i] !== undefined) continue
    s = nextSeed(s)
    likes[i] = sameIdx[Math.floor((s / 233280) * sameIdx.length)]
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

  const ugadaikaMusicRef = useRef<HTMLAudioElement | null>(null)
  const [musicEnabled, setMusicEnabled] = useState(false)

  const getMusicUrl = useCallback(() => {
    if (typeof window === "undefined") return ""
    const base = (() => {
      const segs = window.location.pathname.split("/").filter(Boolean)
      return segs.length > 0 ? `/${segs[0]}` : ""
    })()
    const file = "Origami-chosic.com_.mp3"
    return `${window.location.origin}${base}/music/${file}`
  }, [])

  const stopMusic = useCallback(() => {
    const a = ugadaikaMusicRef.current
    if (!a) return
    a.pause()
    a.currentTime = 0
  }, [])

  const ensureAudio = useCallback(() => {
    if (ugadaikaMusicRef.current) return ugadaikaMusicRef.current
    const url = getMusicUrl()
    if (!url) return null
    const a = new Audio(url)
    a.loop = true
    a.volume = 0.35
    a.preload = "auto"
    ugadaikaMusicRef.current = a
    return a
  }, [getMusicUrl])

  const startMusic = useCallback(async () => {
    const a = ensureAudio()
    if (!a) return
    try {
      await a.play()
    } catch {
      // autoplay policy or load error (e.g. file missing)
    }
  }, [ensureAudio])

  const toggleMusic = useCallback(() => {
    setMusicEnabled((prev) => {
      const next = !prev
      if (next) {
        const a = ensureAudio()
        if (a) {
          a.volume = 0.35
          a.play().catch(() => {})
        }
      } else {
        stopMusic()
      }
      return next
    })
  }, [ensureAudio, stopMusic])

  useEffect(() => {
    if (!musicEnabled) stopMusic()
  }, [musicEnabled, stopMusic])

  useEffect(() => {
    return () => {
      stopMusic()
      ugadaikaMusicRef.current = null
    }
  }, [stopMusic])

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
  const lastNoChoiceRoseRoundRef = useRef<number | null>(null)
  /** Смещение барабана (вниз = полоса вверх): после выбора игрока анимация останавливается на выбранном */
  const [reelTranslateY, setReelTranslateY] = useState(0)
  /** Флаг для анимации «приземления» после остановки барабана */
  const [reelJustStopped, setReelJustStopped] = useState(false)
  /** Высота одного слота в ленте (отступ между аватарками) */
  const REEL_SLOT_HEIGHT = 112
  /** Высота видимого окна барабана (с превью сверху/снизу) */
  const REEL_WINDOW_HEIGHT = 160
  const REEL_CYCLES = 3

  /** Участники текущего раунда (8 человек: 0–3 same, 4–7 opposite) */
  const participantsInRound = gameParticipants ?? participants
  const oppositeIndices = useMemo(
    () => (participantsInRound.length === PARTICIPANTS_TOTAL && currentUser
      ? getOppositeSexIndices(participantsInRound, participantsInRound.findIndex((p) => p.id === currentUser.id))
      : [4, 5, 6, 7]),
    [participantsInRound, currentUser],
  )
  const sameIndices = useMemo(
    () => (participantsInRound.length === PARTICIPANTS_TOTAL && currentUser
      ? getSameSexIndices(participantsInRound, participantsInRound.findIndex((p) => p.id === currentUser.id))
      : [0, 1, 2, 3]),
    [participantsInRound, currentUser],
  )
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
    const eight = getShuffledParticipants(currentUser, players, seed)
    setRoundNumber(1)
    setRoundsWonThisGame(0)
    setConsecutiveWins(0)
    setShowFiveWinsPopup(false)
    lastCreditedWinRoundRef.current = null
    lastNoChoiceRoseRoundRef.current = null
    setGameParticipants(eight)
    setPhase("playing")
    setSelectedIds([])
    setReelTranslateY(0)
    setTimer(ROUND_SECONDS)
    const myIdx = eight.findIndex((p) => p.id === currentUser.id)
    setActualLikes(getRandomChoicesOppositeSex(eight, seed + 1, myIdx >= 0 ? myIdx : undefined) ?? {})
  }, [currentUser, players])

  const startNextRound = useCallback(() => {
    if (!currentUser || !gameParticipants || gameParticipants.length !== PARTICIPANTS_TOTAL || !actualLikes) return
    const likesForPair = effectiveLikes ?? actualLikes
    const pairs = getMutualPairs(likesForPair)
    const myPair = pairs.find(([a, b]) => a === currentUserIndex || b === currentUserIndex)
    if (!myPair) return
    const [stayA, stayB] = myPair
    const playerA = gameParticipants[stayA]
    const playerB = gameParticipants[stayB]
    if (!playerA || !playerB) return
    const partner = playerA.id === currentUser.id ? playerB : playerA
    const currentRoundIds = new Set(gameParticipants.map((p) => p.id))
    const nextRoundNum = roundNumber + 1
    const freshBots = generateBots(120, currentUser.gender).map((p, i) => ({
      ...p,
      id: 50000 + nextRoundNum * 1000 + i,
    }))
    const others = (players ?? []).filter((p) => p.id !== currentUser?.id && p.id !== partner.id && !currentRoundIds.has(p.id))
    const shuffledOthers = shuffleWithSeed([...others], nextRoundNum * 1000 + 1)
    const shuffledBots = shuffleWithSeed(freshBots, nextRoundNum * 1000 + 2)
    const pool = [...shuffledOthers, ...shuffledBots]
    const sameSexPool = pool.filter((p) => p.gender === currentUser.gender)
    const oppositeSexPool = pool.filter((p) => p.gender !== currentUser.gender)
    const needSame = SAME_SEX_COUNT - 1
    const needOpposite = OPPOSITE_SEX_COUNT - 1
    const newSame = sameSexPool.slice(0, needSame)
    const newOpposite = oppositeSexPool.slice(0, needOpposite)
    const fallback = generateBots(20, currentUser.gender).map((p, i) => ({ ...p, id: 60000 + nextRoundNum * 1000 + i }))
    while (newSame.length < needSame) newSame.push(fallback.filter((p) => p.gender === currentUser.gender)[newSame.length] ?? fallback[0])
    while (newOpposite.length < needOpposite) newOpposite.push(fallback.filter((p) => p.gender !== currentUser.gender)[newOpposite.length] ?? fallback[0])
    const nextEight: Player[] = [currentUser, ...newSame.slice(0, 3), partner, ...newOpposite.slice(0, 3)]
    const nextLikes = getRandomChoicesOppositeSex(nextEight, Date.now() + nextRoundNum + 100, 0)
    if (!nextLikes) return
    setGameParticipants(nextEight)
    setRoundNumber((r) => r + 1)
    setSelectedIds([])
    setReelTranslateY(0)
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

  /** Клик по участнику противоположного пола — выбираешь его (твой выбор на раунд). */
  const handleAvatarClick = useCallback((index: number) => {
    if (phase !== "playing" || selectedIds.length >= 1) return
    if (index === currentUserIndex) return
    if (participantsInRound[index].gender === participantsInRound[currentUserIndex].gender) return
    setSelectedIds([index])
  }, [phase, selectedIds.length, currentUserIndex, participantsInRound])

  /** После выбора игрока — анимация барабана: крутится с отскоком и останавливается по центру */
  useEffect(() => {
    if (phase !== "playing" || selectedIds.length !== 1 || oppositeIndices.length === 0) return
    const chosenIdx = selectedIds[0]
    if (chosenIdx === undefined) return
    const targetReelIndex = oppositeIndices.indexOf(chosenIdx)
    if (targetReelIndex < 0) return
    setReelJustStopped(false)
    const selectedSlotTop = (REEL_CYCLES * oppositeIndices.length + targetReelIndex) * REEL_SLOT_HEIGHT
    const selectedSlotCenter = selectedSlotTop + REEL_SLOT_HEIGHT / 2
    const finalY = REEL_WINDOW_HEIGHT / 2 - selectedSlotCenter
    setReelTranslateY(0)
    const t = setTimeout(() => setReelTranslateY(finalY), 100)
    return () => clearTimeout(t)
  }, [phase, selectedIds, oppositeIndices])

  const handleReelTransitionEnd = useCallback(() => {
    if (selectedIds.length !== 1) return
    setReelJustStopped(true)
  }, [selectedIds.length])

  useEffect(() => {
    if (!reelJustStopped) return
    const t = setTimeout(() => setReelJustStopped(false), 600)
    return () => clearTimeout(t)
  }, [reelJustStopped])

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

  useEffect(() => {
    if (phase !== "reveal" || whoChoseMe.length > 0) return
    if (lastNoChoiceRoseRoundRef.current === roundNumber) return
    lastNoChoiceRoseRoundRef.current = roundNumber
    dispatch({
      type: "ADD_INVENTORY_ITEM",
      item: {
        type: "rose",
        fromPlayerId: 0,
        fromPlayerName: "Угадай-ка",
        timestamp: Date.now(),
      },
    })
  }, [phase, whoChoseMe.length, roundNumber, dispatch])

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
    setReelTranslateY(0)
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

  /** Лоадер: ждём готовности данных (currentUser, 8 участников) и минимальное время */
  const participantsReady =
    currentUser &&
    participants.length === PARTICIPANTS_TOTAL &&
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
    <div className="relative flex h-dvh min-h-dvh max-h-dvh flex-col overflow-hidden text-slate-100 pb-[env(safe-area-inset-bottom)] game-bg-animated">
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
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700 px-4 py-3">
        <button
          type="button"
          onClick={backToGame}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700/80 text-slate-200 hover:bg-slate-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1
          className="text-xl font-black tracking-tight inline-flex items-center gap-2"
          style={{
            background: "linear-gradient(135deg, #fce7f3 0%, #f472b6 40%, #ec4899 70%, #be185d 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4)) drop-shadow(0 0 12px rgba(236, 72, 153, 0.3))",
          }}
        >
          <span className="inline-flex items-center gap-0.5 text-rose-400" style={{ WebkitTextFillColor: "unset" }}>
            <Heart
              className="ugadaika-logo-heart ugadaika-logo-heart-1 h-7 w-7 text-rose-400"
              fill="currentColor"
              strokeWidth={1.5}
              aria-hidden
            />
            <Heart
              className="ugadaika-logo-heart ugadaika-logo-heart-2 h-6 w-6 text-rose-400"
              fill="currentColor"
              strokeWidth={1.5}
              aria-hidden
            />
          </span>
          <span>Угадай-ка</span>
        </h1>
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

      {/* Кнопка музыки под верхней строкой, справа */}
      <div className="flex shrink-0 justify-end px-4 py-1.5 border-b border-slate-700/50 bg-slate-900/30">
        <button
          type="button"
          onClick={toggleMusic}
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm"
          style={{
            borderColor: "rgba(148, 163, 184, 0.7)",
            background: "rgba(15, 23, 42, 0.85)",
            color: "#e5e7eb",
            backdropFilter: "blur(8px)",
          }}
        >
          <span aria-hidden="true">{musicEnabled ? "🔊" : "🔇"}</span>
          <span>{musicEnabled ? "Музыка: вкл" : "Музыка: выкл"}</span>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 w-full overflow-hidden">
        {/* Топ 10 по Угадай-ка — слева, шире и с крупными ячейками */}
        <aside className="absolute left-0 top-0 bottom-0 z-10 hidden w-[280px] flex-col border-r border-slate-700 bg-slate-900/50 p-4 overflow-hidden md:flex">
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <Trophy className="h-5 w-5 shrink-0 text-amber-400" />
            <span className="text-sm font-bold text-amber-200">Топ 10</span>
          </div>
          <p className="text-xs text-slate-400 mb-2 shrink-0">Выиграно туров в Угадай-ка</p>
          {myPlaceInTable > 0 && (
            <p className="text-sm font-semibold text-amber-300 mb-3 shrink-0">
              Ваше место в таблице: {myPlaceInTable}
            </p>
          )}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto min-h-0 py-1">
            {fullLeaderboard.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">Пока нет данных</p>
            ) : (
              fullLeaderboard.map((item, i) => {
                const place = i + 1
                const isTop10 = place <= 10
                const isYou = item.player.id === currentUser?.id
                const prevPlace = prevPlacesRef.current[item.player.id]
                const placeChanged = prevPlace !== undefined && prevPlace !== place
                const scoreJustUpdated = lastUpdatedId === item.player.id
                const isPodium = place <= 3
                const placeColor =
                  place === 1 ? "text-amber-300" : place === 2 ? "text-slate-300" : place === 3 ? "text-amber-700" : "text-amber-400/90"
                return (
                  <div
                    key={item.player.id}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-4 min-h-[56px] transition-all duration-300 border ${
                      scoreJustUpdated ? "ugadaika-top10-row-updated" : ""
                    } ${placeChanged ? "ugadaika-top10-place-changed" : ""} ${
                      isYou
                        ? "ring-2 ring-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.3)] border-amber-500/50"
                        : "border-slate-700/60"
                    }`}
                    style={{
                      background: isYou
                        ? "linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(245,158,11,0.12) 100%)"
                        : isTop10 && !scoreJustUpdated
                          ? "linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(51,65,85,0.5) 100%)"
                          : "rgba(15,23,42,0.6)",
                      boxShadow: isYou
                        ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 8px rgba(0,0,0,0.2)"
                        : "inset 0 1px 0 rgba(255,255,255,0.03), 0 1px 3px rgba(0,0,0,0.15)",
                      borderLeft: isTop10 ? "4px solid rgb(251 191 36)" : "4px solid transparent",
                    }}
                  >
                    <span
                      className={`w-8 shrink-0 text-base font-black tabular-nums ${placeColor}`}
                    >
                      {place}.
                    </span>
                    <span
                      className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 shadow-md"
                      style={{
                        borderColor: isPodium ? "rgba(251,191,36,0.6)" : "rgba(71,85,105,0.8)",
                        boxShadow: isPodium ? "0 2px 8px rgba(251,191,36,0.2)" : "0 2px 4px rgba(0,0,0,0.3)",
                      }}
                    >
                      {item.player.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.player.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-slate-700 text-xs text-slate-400">?</span>
                      )}
                    </span>
                    <span className={`flex-1 min-w-0 truncate text-sm font-medium ${isYou ? "text-amber-100" : "text-slate-200"}`}>
                      {isYou ? `${item.player.name} (вы)` : item.player.name}
                    </span>
                    <span
                      className="text-base font-bold shrink-0 tabular-nums min-w-[2rem] text-right"
                      style={{ color: isTop10 ? "#fcd34d" : "rgba(203, 213, 225, 0.9)" }}
                    >
                      {item.rounds}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        <main className="ugadaika-main-scroll flex min-h-0 w-full min-w-0 flex-1 flex-col md:ml-[280px]">
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
                  Участвуют 8 человек: Нажми на того, кто тебе нравится: вы с ним образуете пару на раунд. Если вы выбрали друг друга — пара переходит в следующий раунд.
                </p>
                <p className="text-sm font-medium text-amber-200/90">
                  Таймер 10 сек. Совпала пара — остаётесь, к вам добавляют 6 новых. Не совпала — вылетаешь.
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
        <div className="flex min-w-0 shrink-0 flex-col items-center justify-start gap-4 sm:gap-5 overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 pb-6 sm:pb-8 lg:pt-16">
          <div className="flex items-center justify-between w-full max-w-2xl">
            <div className="rounded-xl border border-amber-500/30 bg-slate-800/90 px-4 py-2 shadow-[0_0_20px_rgba(251,191,36,0.08)]">
              <span className="text-sm font-semibold text-amber-200/90">Раунд </span>
              <span className="text-lg font-black text-amber-300">{roundNumber}</span>
            </div>
            <div
              className="flex items-center gap-2 rounded-xl border-2 border-amber-400/40 bg-gradient-to-b from-slate-800 to-slate-900 px-5 py-2.5 shadow-[0_0_24px_rgba(251,191,36,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]"
              style={{ boxShadow: "0 0 0 1px rgba(251,191,36,0.15), 0 0 24px rgba(251,191,36,0.12), inset 0 1px 0 rgba(255,255,255,0.06)" }}
            >
              <span className="text-2xl font-mono font-black tabular-nums text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]">{timer}</span>
              <span className="text-slate-400 text-sm font-medium">сек</span>
            </div>
          </div>

          <div
            className="ugadaika-game-field relative w-full max-w-2xl min-w-0 rounded-2xl sm:rounded-3xl p-4 sm:p-6 overflow-hidden"
            style={{
              background: "linear-gradient(165deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.94) 35%, rgba(15, 23, 42, 0.97) 100%)",
              border: "2px solid rgba(251, 191, 36, 0.2)",
              boxShadow: "0 0 0 1px rgba(251, 191, 36, 0.12), inset 0 1px 0 rgba(255,255,255,0.06), 0 25px 50px -12px rgba(0, 0, 0, 0.55), 0 0 48px -16px rgba(251, 191, 36, 0.18)",
              backdropFilter: "blur(14px)",
            }}
          >
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-amber-400/10" aria-hidden />
            <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_90%_60%_at_50%_0%,rgba(251,191,36,0.08)_0%,transparent_55%)]" aria-hidden />
            <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_70%_80%_at_50%_100%,rgba(30,41,59,0.6)_0%,transparent_60%)]" aria-hidden />

            {/* Раскладка: на мобильной — сверху претенденты, центр барабан, снизу игроки; на десктопе — слева претенденты, центр барабан, справа игроки */}
            <div className="relative flex w-full min-w-0 flex-col items-stretch justify-center gap-4 sm:gap-4 my-1 sm:my-2 min-h-0 lg:flex-row">
              {/* Претенденты: на мобильной — сверху, в ряд; на десктопе — слева, колонка */}
              <div className="flex flex-col items-center gap-1.5 sm:gap-2 shrink-0 order-1 lg:flex-col lg:order-none">
                <span className="text-xs font-bold text-amber-200/95 w-full lg:w-auto text-center">
                  {currentUser?.gender === "female" ? "Претенденты" : "Претендентки"}
                </span>
                <div className="flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-3 lg:flex-col max-w-full overflow-x-auto overflow-y-hidden">
                {oppositeIndices.map((idx) => {
                  const p = participantsInRound[idx]
                  if (!p) return null
                  const isChosen = selectedIds[0] === idx
                  const choseMe = phase === "reveal" && whoChoseMe.includes(idx)
                  const canClick = phase === "playing" && selectedIds.length < 1
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAvatarClick(idx)}
                      disabled={!canClick}
                      className={`flex flex-col items-center gap-0.5 rounded-2xl border-2 p-1.5 sm:p-2 transition-all duration-300 text-left ${
                        isChosen
                          ? "border-amber-400 bg-amber-500/25 ring-2 ring-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.35)] scale-105"
                          : ""
                      } ${choseMe ? "border-emerald-500/70 bg-emerald-500/15" : ""} ${
                        !isChosen && !choseMe
                          ? "border-slate-600/90 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-700/50"
                          : ""
                      } ${canClick ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <div
                        className={`h-12 w-12 sm:h-14 sm:w-14 overflow-hidden rounded-full border-2 shadow-lg transition-all shrink-0 ${
                          isChosen ? "border-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.5)]" : "border-slate-500 shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                      </div>
                      <span className={`text-[9px] sm:text-[10px] font-medium truncate max-w-[3.5rem] ${isChosen ? "text-amber-300 font-bold" : "text-slate-200"}`}>
                        {p.name}
                      </span>
                      {isChosen && (
                        <span className="text-[8px] font-bold text-amber-400 uppercase tracking-wide">Выбор</span>
                      )}
                    </button>
                  )
                })}
                </div>
              </div>

              {/* Центр: рамка слот-машины — барабан (на мобильной — по центру между претендентами и игроками) */}
            <div className="ugadaika-slot-casing flex flex-col items-stretch justify-center shrink-0 my-0 mx-1 sm:mx-4 order-2 lg:order-none">
              {/* Верхняя полоса с лампочками — по верхнему краю, поднята */}
              <div className="ugadaika-slot-band ugadaika-slot-band-top flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 w-full mb-2 sm:mb-4">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className="ugadaika-slot-bulb" aria-hidden />
                ))}
              </div>
              <div className="flex flex-1 min-h-0 items-center justify-center gap-3 sm:gap-6 px-2 sm:px-5 py-1.5 sm:py-2">
                {/* Левая ячейка — Ты (одинаковый размер с правой, контент по центру); на мобильной компактнее */}
                <div className="ugadaika-jackpot-left flex flex-col items-center justify-center w-28 h-56 sm:w-36 sm:h-72 shrink-0 overflow-hidden relative rounded-xl">
                  <span className="ugadaika-jackpot-dot text-amber-300 top-1.5 left-1.5" aria-hidden />
                  <span className="ugadaika-jackpot-dot text-amber-300 top-1.5 right-1.5" aria-hidden />
                  <span className="ugadaika-jackpot-dot text-amber-300 bottom-1.5 left-1.5" aria-hidden />
                  <span className="ugadaika-jackpot-dot text-amber-300 bottom-1.5 right-1.5" aria-hidden />
                  <div className="ugadaika-avatar-cell ugadaika-avatar-cell-gold h-16 w-16 sm:h-24 sm:w-24 overflow-hidden rounded-full border-2 border-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.5),0_0_32px_rgba(245,158,11,0.2),inset_0_1px_0_rgba(255,255,255,0.25)] bg-slate-800 ring-2 ring-amber-400/60">
                    {currentUser?.avatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={currentUser.avatar} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <span className="text-xs font-black text-amber-200 mt-2 tracking-wide drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">Ты</span>
                </div>
                {/* Правая ячейка — барабан (одинаковый размер с левой, контент по центру); на мобильной компактнее */}
                <div className="ugadaika-jackpot-right flex flex-col items-center justify-center w-28 h-56 sm:w-36 sm:h-72 shrink-0 overflow-hidden relative rounded-xl">
                  <span className="ugadaika-jackpot-dot text-rose-300 top-1.5 left-1.5" aria-hidden />
                  <span className="ugadaika-jackpot-dot text-rose-300 top-1.5 right-1.5" aria-hidden />
                  <span className="ugadaika-jackpot-dot text-rose-300 bottom-1.5 left-1.5" aria-hidden />
                  <span className="ugadaika-jackpot-dot text-rose-300 bottom-1.5 right-1.5" aria-hidden />
                  <div
                    className={`ugadaika-reel-window relative w-full overflow-hidden rounded-lg flex justify-center mx-0.5 shrink-0 ${reelJustStopped ? "ugadaika-reel-landing" : ""}`}
                    style={{ height: REEL_WINDOW_HEIGHT }}
                  >
                    <div className="ugadaika-reel-edge ugadaika-reel-edge-top pointer-events-none absolute left-0 right-0 top-0 z-10 h-5 sm:h-6" aria-hidden />
                    <div className="ugadaika-reel-edge ugadaika-reel-edge-bottom pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-5 sm:h-6" aria-hidden />
                    <div
                      className={`flex flex-col items-center ugadaika-reel-strip ${selectedIds.length === 0 ? "ugadaika-reel-idle" : ""}`}
                      style={{
                        height: REEL_SLOT_HEIGHT * 16,
                        ...(selectedIds.length === 1
                          ? {
                              transform: `translate3d(0, ${reelTranslateY}px, 0)`,
                              transition: "transform 2.6s cubic-bezier(0.22, 1.15, 0.36, 1)",
                              willChange: "transform",
                            }
                          : { willChange: "transform" }),
                      }}
                      onTransitionEnd={handleReelTransitionEnd}
                    >
                      {Array.from({ length: 16 }, (_, i) => {
                        const idx = oppositeIndices[i % oppositeIndices.length]
                        const p = participantsInRound[idx]
                        if (!p) return null
                        return (
                          <div
                            key={`${p.id}-${i}`}
                            className="flex flex-col items-center justify-center shrink-0"
                            style={{ height: REEL_SLOT_HEIGHT }}
                          >
                            <div className="ugadaika-avatar-cell ugadaika-avatar-cell-rose h-16 w-16 sm:h-24 sm:w-24 overflow-hidden rounded-full border-2 border-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.4),0_0_28px_rgba(225,29,72,0.15),inset_0_1px_0_rgba(255,255,255,0.2)] bg-slate-800 ring-2 ring-rose-400/50">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="mt-1.5 flex justify-center flex-shrink-0">
                    {selectedIds[0] !== undefined && participantsInRound[selectedIds[0]] ? (
                      <span className="text-[10px] font-bold text-rose-100 truncate text-center px-0.5 drop-shadow-[0_0_4px_rgba(0,0,0,0.8)]">
                        {participantsInRound[selectedIds[0]].name}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[9px] font-medium">?</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Нижняя полоса с лампочками — прижата к нижнему краю */}
              <div className="ugadaika-slot-band ugadaika-slot-band-bottom flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 w-full mt-auto pt-2 sm:pt-4">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className="ugadaika-slot-bulb" aria-hidden />
                ))}
              </div>
            </div>

              {/* Игроки: на мобильной — снизу, в ряд; на десктопе — справа, колонка */}
              <div className="flex flex-col items-center gap-1.5 sm:gap-2 shrink-0 order-3 lg:flex-col lg:order-none">
                <span className="text-xs font-bold text-amber-200/95 w-full lg:w-auto text-center">Игроки</span>
                <div className="flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-3 lg:flex-col max-w-full overflow-x-auto overflow-y-hidden">
                {sameIndices.map((idx) => {
                  const p = participantsInRound[idx]
                  if (!p) return null
                  const isYou = p.id === currentUser?.id
                  return (
                    <div
                      key={p.id}
                      className={`flex flex-col items-center gap-0.5 rounded-2xl border-2 p-1.5 sm:p-2 ${
                        isYou ? "border-amber-500/80 bg-amber-500/20 shadow-[0_0_16px_rgba(251,191,36,0.2)]" : "border-slate-600/90 bg-slate-800/50"
                      }`}
                    >
                      <div
                        className={`h-12 w-12 sm:h-14 sm:w-14 overflow-hidden rounded-full border-2 shadow-lg shrink-0 ${
                          isYou ? "border-amber-500/70 shadow-[0_0_12px_rgba(251,191,36,0.25)]" : "border-slate-500 shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                      </div>
                      <span className={`text-[9px] sm:text-[10px] font-medium truncate max-w-[3.5rem] ${isYou ? "text-amber-200" : "text-slate-200"}`}>
                        {isYou ? "Вы" : p.name}
                      </span>
                    </div>
                  )
                })}
                </div>
              </div>
            </div>

            {phase === "playing" && selectedIds.length === 0 && (
              <p
                className="text-center text-sm font-medium my-3 px-3 py-2 rounded-xl bg-slate-800/50 border border-amber-500/20 text-amber-100/90 max-w-md mx-auto"
                style={{ textShadow: "0 0 12px rgba(251,191,36,0.15), 0 1px 2px rgba(0,0,0,0.3)" }}
              >
                <span className="inline lg:hidden">Нажми на претендента выше — выбери пару</span>
                <span className="hidden lg:inline">Нажми на участника слева — выбери пару</span>
              </p>
            )}

            {phase === "playing" && selectedIds.length === 1 && guessedWhoChoseMe !== null && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/15 to-amber-500/10 px-5 py-2.5 shadow-[0_0_20px_rgba(251,191,36,0.15)]">
                <span className="text-sm font-semibold text-amber-200">На кого остановилось:</span>
                <span className="text-sm font-bold text-amber-100">
                  {participantsInRound[guessedWhoChoseMe].name}
                </span>
              </div>
            )}

            {phase === "reveal" && guessedWhoChoseMe !== null && (
              <div
                className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-amber-500/25 bg-gradient-to-r from-slate-800/90 to-slate-800/70 px-5 py-2.5"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 16px rgba(251,191,36,0.06)" }}
              >
                <span className="text-sm text-amber-200/80 font-medium">Твоя пара:</span>
                <span className="text-sm font-bold text-amber-100">{participantsInRound[guessedWhoChoseMe].name}</span>
              </div>
            )}

            <div
              className="mt-4 flex items-center justify-between rounded-2xl border border-amber-500/20 bg-gradient-to-r from-slate-800/90 via-slate-800/85 to-slate-900/90 px-4 py-3"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 20px rgba(251,191,36,0.06), 0 4px 12px rgba(0,0,0,0.2)" }}
            >
              <span className="text-[12px] text-slate-200 font-medium">
                {phase === "playing"
                  ? (selectedIds.length === 1 ? "Пара выбрана. Ждём результат." : "Выбери одного — нажми на претендента выше.")
                  : whoChoseMe.length === 0
                    ? "Не расстраивайся — это игра! Вот тебе 1 роза 🌹"
                    : !amIInMutualPair
                      ? "Пара не совпала — выходишь из игры."
                      : guessedCorrectly
                        ? "Пара совпала! Вы остаётесь в игре."
                        : "Пара не совпала — вылетаешь из игры."}
              </span>
              <span className="text-[12px] font-bold text-amber-200/90">
                Рейтинг: {totalRoundsWon}
              </span>
            </div>
          </div>

          {phase === "reveal" && (
            <div className="ugadaika-result-popup-backdrop" aria-modal="true" role="dialog">
              <div className="ugadaika-result-popup-box flex flex-col items-center gap-4">
                {whoChoseMe.length === 0 ? (
                  <div
                    className="w-full max-w-md rounded-3xl border-2 border-amber-500/40 bg-gradient-to-b from-slate-800/98 via-slate-900/98 to-slate-800/98 p-6 sm:p-8 shadow-2xl"
                    style={{
                      boxShadow: "0 0 0 1px rgba(251, 191, 36, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px -10px rgba(251, 191, 36, 0.12)",
                    }}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <p
                        className="text-base sm:text-lg font-bold text-center text-amber-100 drop-shadow-[0_0_12px_rgba(251,191,36,0.25)]"
                        style={{ textShadow: "0 0 20px rgba(251, 191, 36, 0.2)" }}
                      >
                        Никто не выбрал тебя — не расстраивайся!
                      </p>
                      <div className="flex flex-wrap justify-center gap-4">
                        {participantsInRound.filter((p) => p.id !== currentUser?.id && p.gender !== currentUser?.gender).map((p) => (
                          <div key={p.id} className="flex flex-col items-center gap-1.5">
                            <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-amber-500/60 bg-slate-700 ring-2 ring-amber-500/20 shadow-lg shadow-amber-500/10">
                              {p.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-400 text-sm">{p.name?.slice(0, 1) ?? "?"}</div>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-300 truncate max-w-[4rem] font-medium">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-6 pt-5 border-t border-amber-500/20">
                      <p className="text-xl font-black text-center text-amber-200 tracking-tight" style={{ textShadow: "0 0 16px rgba(251, 191, 36, 0.3)" }}>
                        Это игра. Вот тебе 1 роза! 🌹
                      </p>
                      <p className="mt-2 text-center text-sm text-slate-400">Роза добавлена в инвентарь. Выиграно туров: <span className="font-semibold text-slate-300">{roundsWonThisGame}</span></p>
                    </div>
                    <div className="mt-6 flex flex-col sm:flex-row flex-wrap items-stretch justify-center gap-3">
                      <button
                        type="button"
                        onClick={retryRound}
                        className="rounded-2xl px-8 py-3.5 font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: "linear-gradient(180deg, #f43f5e 0%, #be123c 50%, #9f1239 100%)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 20px rgba(244, 63, 94, 0.4)",
                        }}
                      >
                        Попробовать снова
                      </button>
                      <button
                        type="button"
                        onClick={backToGame}
                        className="rounded-2xl border-2 border-slate-500/80 bg-slate-700/80 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-600/80 hover:border-slate-400/60 transition-all"
                      >
                        К столу
                      </button>
                    </div>
                  </div>
                ) : !amIInMutualPair ? (
                  <div className="ugadaika-result-lose w-full max-w-md">
                    <div
                      className="rounded-3xl border-2 border-amber-500/40 p-6 sm:p-8 overflow-hidden"
                      style={{
                        background: "linear-gradient(165deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 50%, rgba(30, 41, 59, 0.98) 100%)",
                        boxShadow: "0 0 0 1px rgba(251, 191, 36, 0.12), inset 0 1px 0 rgba(255,255,255,0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px -10px rgba(251, 191, 36, 0.08)",
                      }}
                    >
                      <div className="flex flex-col items-center gap-4">
                        {guessedWhoChoseMe !== null && actualLikes && (() => {
                          const chosenByMe = participantsInRound[guessedWhoChoseMe]
                          const chosenByThem = actualLikes[guessedWhoChoseMe]
                          const nameA = chosenByMe?.name ?? "?"
                          const nameB = chosenByThem !== undefined && participantsInRound[chosenByThem]
                            ? (chosenByThem === currentUserIndex ? "тебя" : (participantsInRound[chosenByThem]?.name ?? "?"))
                            : "другого"
                          return (
                            <p className="text-lg font-bold text-center text-amber-100" style={{ textShadow: "0 0 20px rgba(251, 191, 36, 0.2)" }}>
                              Увы — {nameA} выбрал{chosenByMe?.gender === "female" ? "а" : ""} {nameB}
                            </p>
                          )
                        })()}
                        <div className="flex flex-wrap justify-center gap-5">
                          {whoChoseMe.length > 0
                            ? whoChoseMe.map((i) => {
                                const p = participantsInRound[i]
                                return (
                                  <div key={p.id} className="flex flex-col items-center gap-2">
                                    <div
                                      className="rounded-full p-1 shadow-lg"
                                      style={{
                                        background: "linear-gradient(135deg, #f87171 0%, #dc2626 50%, #b91c1c 100%)",
                                        boxShadow: "0 0 0 3px rgba(248, 113, 113, 0.4), 0 0 24px rgba(239, 68, 68, 0.3)",
                                      }}
                                    >
                                      <div className="rounded-full overflow-hidden bg-slate-800 ring-2 ring-slate-700">
                                        {p.avatar ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={p.avatar} alt="" className="h-20 w-20 rounded-full object-cover" />
                                        ) : (
                                          <div className="h-20 w-20 rounded-full flex items-center justify-center text-slate-400 text-lg">{p.name?.slice(0, 1) ?? "?"}</div>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-sm font-medium text-slate-200">{p.name}</span>
                                  </div>
                                )
                              })
                            : participantsInRound.filter((p) => p.id !== currentUser?.id && p.gender !== currentUser?.gender).map((p) => (
                                <div key={p.id} className="flex flex-col items-center gap-1">
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
                        <p className="text-sm font-medium text-slate-300 text-center">
                          {whoChoseMe.length > 0 ? (
                            <>Тебя выбрал{whoChoseMe.length === 1 ? "а" : "и"}: {whoChoseMe.map((i) => participantsInRound[i].name).join(" и ")}</>
                          ) : (
                            "Тебя никто не выбрал — не расстраивайся, это игра!"
                          )}
                        </p>
                      </div>
                      <div className="mt-6 pt-5 border-t border-amber-500/20">
                        <p className="text-xl font-black text-center text-amber-300 tracking-tight" style={{ textShadow: "0 0 16px rgba(251, 191, 36, 0.25)" }}>
                          Ты не в взаимной паре — выходишь из игры.
                        </p>
                        <p className="mt-3 text-center text-sm text-slate-400 leading-relaxed">Образовавшаяся пара остаётся, к ним подключаются другие игроки.</p>
                        <p className="mt-3 text-center text-slate-400">Выиграно туров в этой игре: <span className="font-semibold text-slate-300">{roundsWonThisGame}</span></p>
                      </div>
                      {countdownToGameover !== null && countdownToGameover > 0 && (
                        <div className="mt-5 flex justify-center">
                          <span className="rounded-full bg-amber-500/20 border border-amber-500/50 px-5 py-2 text-sm font-bold text-amber-200">
                            Выход с поля через {countdownToGameover} сек
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : guessedCorrectly ? (
                  <div className="ugadaika-result-win w-full max-w-md">
                    <div
                      className="rounded-3xl border-2 border-emerald-500/40 p-6 sm:p-8 overflow-hidden"
                      style={{
                        background: "linear-gradient(165deg, rgba(6, 78, 59, 0.25) 0%, rgba(15, 23, 42, 0.98) 30%, rgba(30, 41, 59, 0.98) 70%, rgba(6, 78, 59, 0.2) 100%)",
                        boxShadow: "0 0 0 1px rgba(52, 211, 153, 0.15), inset 0 1px 0 rgba(255,255,255,0.06), 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px -10px rgba(52, 211, 153, 0.12)",
                      }}
                    >
                      <div className="flex flex-col items-center gap-4">
                        {guessedWhoChoseMe !== null && (() => {
                          const shownPartner = participantsInRound[guessedWhoChoseMe]
                          return shownPartner ? (
                            <>
                              <p className="text-base font-bold text-emerald-100" style={{ textShadow: "0 0 16px rgba(52, 211, 153, 0.2)" }}>
                                Ты в паре с: {shownPartner.name}
                              </p>
                              <div
                                className="rounded-full p-1.5 shadow-lg"
                                style={{
                                  background: "linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)",
                                  boxShadow: "0 0 0 3px rgba(52, 211, 153, 0.35), 0 0 28px rgba(34, 197, 94, 0.35)",
                                }}
                              >
                                <div className="rounded-full overflow-hidden bg-slate-800 ring-2 ring-slate-700">
                                  {shownPartner.avatar ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={shownPartner.avatar} alt="" className="h-20 w-20 rounded-full object-cover" />
                                  ) : (
                                    <div className="h-20 w-20 rounded-full flex items-center justify-center text-slate-400 text-lg">{shownPartner.name?.slice(0, 1) ?? "?"}</div>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-base font-bold text-emerald-200">Ты угадал пару!</p>
                          )
                        })()}
                        {guessedWhoChoseMe === null && <p className="text-base font-bold text-emerald-200">Ты угадал пару!</p>}
                      </div>
                      <div className="mt-6 pt-5 border-t border-emerald-500/20">
                        <p className="text-xl font-black text-center text-emerald-300 tracking-tight" style={{ textShadow: "0 0 20px rgba(52, 211, 153, 0.3)" }}>
                          Верно! Остаёшься в игре.
                        </p>
                        <p className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-rose-200">
                          <Heart className="h-5 w-5 text-rose-400 fill-current shrink-0" />
                          +10 сердец
                        </p>
                        {totalRoundsWon > 0 && totalRoundsWon % 10 === 0 && (
                          <p className="mt-1 text-sm font-medium text-rose-200/90">+1 роза за 10 побед!</p>
                        )}
                        <p className="mt-3 text-center text-sm text-slate-400 leading-relaxed">Вторая пара выходит. К вам с партнёром подключаются два новых участника.</p>
                        <p className="mt-3 text-center text-slate-400">Выиграно туров в этой игре: <span className="font-semibold text-slate-300">{roundsWonThisGame + 1}</span></p>
                      </div>
                      {countdownToNextRound !== null && countdownToNextRound > 0 && (
                        <div className="mt-5 flex justify-center">
                          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/50 px-5 py-2 text-sm font-bold text-emerald-200">
                            Следующий раунд через {countdownToNextRound} сек
                          </span>
                        </div>
                      )}
                      <p className="mt-4 text-center text-sm font-semibold text-emerald-200/90">
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
                            "Тебя никто не выбрал — не расстраивайся, это игра!"
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
        <div className="flex flex-1 w-full min-h-full flex-col items-center justify-center px-6 py-8">
          <div
            className="w-full max-w-md rounded-3xl border-2 border-amber-500/40 p-8 shadow-2xl"
            style={{
              background: "linear-gradient(165deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)",
              boxShadow: "0 0 0 1px rgba(251, 191, 36, 0.1), inset 0 1px 0 rgba(255,255,255,0.04), 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px -10px rgba(251, 191, 36, 0.1)",
            }}
          >
            <h2
              className="text-2xl sm:text-3xl font-black text-center text-amber-300 mb-2"
              style={{ textShadow: "0 0 24px rgba(251, 191, 36, 0.35)" }}
            >
              Игра окончена
            </h2>
            <div className="mt-6 space-y-2">
              <p className="text-center text-base font-semibold text-slate-200">
                До вылета вы выиграли туров: <span className="text-amber-200 font-bold">{roundsWonThisGame}</span>
              </p>
              <p className="text-center text-sm text-slate-400">
                Всего в рейтинге: <span className="text-slate-200 font-semibold">{totalRoundsWon}</span> туров
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={startGame}
                className="w-full rounded-2xl px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                style={{
                  background: "linear-gradient(180deg, #f43f5e 0%, #be123c 50%, #9f1239 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 20px rgba(244, 63, 94, 0.4)",
                }}
              >
                Играть снова
              </button>
              <button
                type="button"
                onClick={backToGame}
                className="w-full rounded-2xl border-2 border-slate-500 bg-slate-700/90 px-6 py-3.5 text-base font-bold text-slate-100 hover:bg-slate-600 hover:border-slate-400 transition-all"
              >
                К столу
              </button>
            </div>
          </div>
        </div>
      )}
        </main>
      </div>
    </div>
    </div>
  )
}
