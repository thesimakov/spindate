"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Heart, RotateCcw, Sparkles } from "lucide-react"
import { useGame } from "@/lib/game-context"
import { markUiTourDone } from "@/lib/ui-tour-storage"
import { cn } from "@/lib/utils"

type TutorialStep = 1 | 2 | 3 | 4 | 5 | 6 | 7
type ActiveTarget = "spin" | "kiss" | "botAvatar" | "emotionKiss" | "changeTable" | null

type DemoPlayer = {
  id: number
  name: string
  gender: "male" | "female"
  x: number
  y: number
  isBot?: boolean
}

const PLAYERS: DemoPlayer[] = [
  { id: 1, name: "Ты", gender: "female", x: 50, y: 86 },
  { id: 2, name: "Макс", gender: "male", x: 50, y: 12, isBot: true },
  { id: 3, name: "Лена", gender: "female", x: 14, y: 26 },
  { id: 4, name: "Илья", gender: "male", x: 86, y: 26 },
  { id: 5, name: "Ася", gender: "female", x: 20, y: 70 },
  { id: 6, name: "Павел", gender: "male", x: 80, y: 70 },
]

const HINT_BY_STEP: Record<Extract<TutorialStep, 1 | 3 | 4 | 6 | 7>, string> = {
  1: "Твой ход, нажми на кнопку",
  3: "Нажми «Поцеловать»",
  4: "Нажми на меня",
  6: "Выбери эмоцию «Поцелуй»",
  7: "Теперь ты готов. Смени стол!",
}

const hintClassByTarget: Record<Exclude<ActiveTarget, null>, string> = {
  spin: "left-1/2 top-[74%] -translate-x-1/2",
  kiss: "left-1/2 top-[30%] -translate-x-[6%]",
  botAvatar: "left-1/2 top-[6%] -translate-x-1/2",
  emotionKiss: "left-[72%] top-[47%] -translate-x-1/2",
  changeTable: "right-6 top-14",
}

function withActiveRing(active: boolean, base: string): string {
  return cn(
    base,
    active
      ? "pointer-events-auto z-[70] ring-4 ring-yellow-400 shadow-[0_0_0_8px_rgba(250,204,21,0.2)] animate-pulse"
      : "pointer-events-none",
  )
}

function HintBubble({ text, className }: { text: string; className: string }) {
  return (
    <motion.div
      key={text}
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.22 }}
      className={cn(
        "pointer-events-none absolute z-[72] w-[min(88vw,19rem)] rounded-xl border border-yellow-300/70 bg-slate-950/95 px-3 py-2 text-sm font-semibold text-yellow-100",
        className,
      )}
    >
      {text}
    </motion.div>
  )
}

export function UiTourScreen() {
  const { state, dispatch } = useGame()
  const currentUser = state.currentUser
  const [step, setStep] = useState<TutorialStep>(1)
  const [bottleAngle, setBottleAngle] = useState(-12)
  const [bottleSpinning, setBottleSpinning] = useState(false)
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null)
  const [kissesModalOpen, setKissesModalOpen] = useState(false)
  const [kissesModalEntered, setKissesModalEntered] = useState(false)
  const [botAccepted, setBotAccepted] = useState(false)
  const [emotionsOpen, setEmotionsOpen] = useState(false)
  const [emotionsPanelEntered, setEmotionsPanelEntered] = useState(false)
  const [emotionFx, setEmotionFx] = useState(false)
  const [blockPulse, setBlockPulse] = useState(false)
  const denyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (denyTimerRef.current != null) window.clearTimeout(denyTimerRef.current)
    }
  }, [])

  const activeTarget: ActiveTarget = useMemo(() => {
    if (step === 1) return "spin"
    if (step === 3) return "kiss"
    if (step === 4) return "botAvatar"
    if (step === 6) return "emotionKiss"
    if (step === 7) return "changeTable"
    return null
  }, [step])

  useEffect(() => {
    if (step !== 2 || !kissesModalEntered) return
    const id = window.setTimeout(() => setStep(3), 200)
    return () => window.clearTimeout(id)
  }, [step, kissesModalEntered])

  useEffect(() => {
    if (step !== 5 || !emotionsPanelEntered) return
    const id = window.setTimeout(() => setStep(6), 200)
    return () => window.clearTimeout(id)
  }, [step, emotionsPanelEntered])

  useEffect(() => {
    if (!emotionFx) return
    const id = window.setTimeout(() => setEmotionFx(false), 900)
    return () => window.clearTimeout(id)
  }, [emotionFx])

  const pulseBlockedArea = useCallback(() => {
    setBlockPulse(true)
    if (denyTimerRef.current != null) window.clearTimeout(denyTimerRef.current)
    denyTimerRef.current = window.setTimeout(() => {
      setBlockPulse(false)
      denyTimerRef.current = null
    }, 220)
  }, [])

  const goTableSelection = useCallback(() => {
    if (currentUser) markUiTourDone(currentUser.id)
    dispatch({ type: "SET_SCREEN", screen: "lobby" })
  }, [currentUser, dispatch])

  const handleSpinClick = useCallback(() => {
    if (step !== 1 || bottleSpinning) return
    const me = PLAYERS.find((p) => p.id === 1)!
    const opposite = PLAYERS.find((p) => p.id !== me.id && p.gender !== me.gender) ?? PLAYERS[1]!
    setTargetPlayerId(opposite.id)
    setBottleSpinning(true)
    setBottleAngle(706)
    window.setTimeout(() => {
      setBottleSpinning(false)
      setStep(2)
      setKissesModalOpen(true)
    }, 1000)
  }, [step, bottleSpinning])

  const handleKissClick = useCallback(() => {
    if (step !== 3) return
    setBotAccepted(true)
    window.setTimeout(() => setStep(4), 520)
  }, [step])

  const handleBotAvatarClick = useCallback(() => {
    if (step !== 4) return
    setStep(5)
    setEmotionsOpen(true)
  }, [step])

  const handleEmotionKissClick = useCallback(() => {
    if (step !== 6) return
    setEmotionFx(true)
    setStep(7)
  }, [step])

  if (!currentUser) return null

  return (
    <div className="fixed inset-0 z-[220] overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(30,58,90,0.35)_0%,rgba(2,6,23,0.95)_70%)]" />

      <div className="pointer-events-none relative z-[10] h-full w-full p-3 sm:p-5">
        <button
          type="button"
          onClick={step === 7 ? goTableSelection : undefined}
          className={withActiveRing(
            activeTarget === "changeTable",
            "absolute right-6 top-5 rounded-full border border-slate-500/70 bg-slate-900/85 px-4 py-2 text-sm font-bold text-white",
          )}
        >
          <RotateCcw className="mr-2 inline h-4 w-4" />
          Сменить стол
        </button>

        <div className="mx-auto mt-8 flex h-[min(78vh,44rem)] w-full max-w-5xl items-center justify-center">
          <div className="relative aspect-[1.45/1] w-full max-w-3xl rounded-[2rem] border border-slate-600/70 bg-slate-900/90 shadow-[0_28px_90px_rgba(2,6,23,0.8)]">
            <div className="absolute inset-[7%] rounded-[1.8rem] bg-[radial-gradient(circle_at_50%_40%,rgba(37,99,235,0.35)_0%,rgba(15,23,42,0.96)_70%)]" />

            {PLAYERS.map((p) => {
              const isTarget = p.id === targetPlayerId
              const isTutorialBot = p.isBot === true && p.id === 2
              const avatarClass = withActiveRing(
                activeTarget === "botAvatar" && isTutorialBot,
                cn(
                  "absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 text-sm font-black text-white",
                  p.gender === "female" ? "border-pink-300 bg-pink-600/60" : "border-sky-300 bg-sky-600/60",
                ),
              )
              return (
                <div key={p.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                  <button
                    type="button"
                    onClick={isTutorialBot ? handleBotAvatarClick : undefined}
                    className={avatarClass}
                  >
                    {p.name.slice(0, 1)}
                  </button>
                  <p className="mt-2 text-center text-xs font-bold text-slate-200">{p.name}</p>
                  {isTarget ? <p className="mt-0.5 text-center text-[11px] text-emerald-300">Выбран(а)</p> : null}
                </div>
              )
            })}

            <motion.div
              animate={{ rotate: bottleAngle }}
              transition={bottleSpinning ? { duration: 0.95, ease: "easeOut" } : { duration: 0.2 }}
              className="absolute left-1/2 top-1/2 z-[25] h-10 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700 shadow-[0_10px_22px_rgba(0,0,0,0.45)]"
            />

            <button
              type="button"
              onClick={handleSpinClick}
              className={withActiveRing(
                activeTarget === "spin",
                "absolute bottom-7 left-1/2 -translate-x-1/2 rounded-2xl border border-emerald-300/70 bg-emerald-500 px-6 py-3 text-base font-black text-slate-950",
              )}
            >
              Крутить бутылочку
            </button>
          </div>
        </div>

        <AnimatePresence>
          {kissesModalOpen ? (
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              onAnimationComplete={() => setKissesModalEntered(true)}
              className="absolute left-1/2 top-[22%] z-[45] w-[min(88vw,22rem)] -translate-x-1/2 rounded-2xl border border-rose-300/40 bg-slate-900/95 p-4 shadow-2xl"
            >
              <h3 className="text-lg font-black text-rose-200">Поцелуи</h3>
              <p className="mt-1 text-sm text-slate-300">Робот предлагает начать с поцелуя. Подтверди действие.</p>
              <button
                type="button"
                onClick={handleKissClick}
                className={withActiveRing(
                  activeTarget === "kiss",
                  "mt-4 inline-flex items-center rounded-xl border border-rose-300/60 bg-rose-500 px-4 py-2 text-sm font-black text-white",
                )}
              >
                <Heart className="mr-2 h-4 w-4" />
                Поцеловать
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {botAccepted ? (
            <motion.div
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              className="absolute left-[64%] top-[30%] z-[50] rounded-lg border border-emerald-300/60 bg-emerald-500/20 px-3 py-1.5 text-sm font-bold text-emerald-100"
            >
              Робот: Да
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {emotionsOpen ? (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.28 }}
              onAnimationComplete={() => setEmotionsPanelEntered(true)}
              className="absolute left-[72%] top-[55%] z-[47] w-[min(88vw,17rem)] rounded-2xl border border-slate-400/50 bg-slate-900/95 p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Панель эмоций</p>
              <button
                type="button"
                onClick={handleEmotionKissClick}
                className={withActiveRing(
                  activeTarget === "emotionKiss",
                  "mt-2 inline-flex items-center rounded-xl border border-pink-300/60 bg-pink-500 px-3 py-2 text-sm font-black text-white",
                )}
              >
                <Heart className="mr-1.5 h-4 w-4" />
                Поцелуй
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {emotionFx ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 8 }}
              animate={{ opacity: 1, scale: 1.05, y: -6 }}
              exit={{ opacity: 0, scale: 0.85, y: -20 }}
              transition={{ duration: 0.45 }}
              className="absolute left-[58%] top-[44%] z-[55] rounded-full bg-pink-500/20 px-5 py-3 text-lg font-black text-pink-100"
            >
              💋 Поцелуй!
            </motion.div>
          ) : null}
        </AnimatePresence>

        {activeTarget ? (
          <motion.button
            type="button"
            aria-label="Зона блокировки обучения"
            onClick={pulseBlockedArea}
            animate={blockPulse ? { x: [-2, 2, -1, 0] } : { x: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-[60] bg-black/45 pointer-events-auto"
          />
        ) : null}

        <AnimatePresence>
          {activeTarget && (step === 1 || step === 3 || step === 4 || step === 6 || step === 7) ? (
            <HintBubble text={HINT_BY_STEP[step]} className={hintClassByTarget[activeTarget]} />
          ) : null}
        </AnimatePresence>

        <div className="pointer-events-none absolute bottom-4 left-1/2 z-[80] -translate-x-1/2 rounded-xl border border-slate-600/80 bg-slate-900/95 px-4 py-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Обучение</p>
          <p className="text-sm font-black text-white">Шаг {step} / 7</p>
          <p className="mt-0.5 text-xs text-slate-300">Интерактивная демо-сцена «Стол»</p>
        </div>

        {blockPulse ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-[81] flex justify-center">
            <div className="rounded-md border border-yellow-400/60 bg-yellow-400/15 px-3 py-1 text-xs font-semibold text-yellow-100">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" />
              Нажми на подсвеченный элемент
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
