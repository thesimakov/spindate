"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { Flower2, Gem, Gift, Heart, MessageCircle, Plus, Sparkles, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useGame } from "@/lib/game-context"
import { markUiTourDone } from "@/lib/ui-tour-storage"
import { formatVoiceBalanceCompact } from "@/lib/format-voice-balance"
import { cn } from "@/lib/utils"

const PAD = 8

type TourStep = {
  title: string
  body: string
}

/** Обучение интерфейсу игрового стола (макет похож на реальный GameRoom). */
const STEPS: TourStep[] = [
  {
    title: "Игровой стол",
    body:
      "Здесь происходит игра: игроки сидят по кругу, в центре — бутылочка. Так вы знакомитесь и общаетесь за одним столом.",
  },
  {
    title: "Магазин",
    body:
      "Оранжевая кнопка «Магазин» — пополнение баланса голосами ВК и покупка VIP на неделю или месяц.",
  },
  {
    title: "Эмоции и действия",
    body:
      "Панель «Эмоции» и цветные кнопки: поцелуй, цветы, бриллианты и другие — так вы реагируете на выпавшую пару и тратите сердечки.",
  },
  {
    title: "Бутылочка и ход",
    body:
      "Когда ваш ход, нажмите кнопку кручения под столом — бутылочка выберет пару. Дальше можно использовать действия слева.",
  },
  {
    title: "Чат комнаты",
    body:
      "Справа — общий чат этой комнаты: пишите всем за столом, пока идёт игра.",
  },
  {
    title: "Меню у аватарки",
    body:
      "Нажмите на чужую аватарку: эмоции для вашей пары сразу подбираются по полу (м/м, м/ж, ж/ж). В меню — «Подарить подарок» и «Профиль»: карточка игрока, ухаживание, ВК при разрешении, розы.",
  },
  {
    title: "Объявления — табло",
    body:
      "Внизу экрана — бегущая строка «Табло». Нажмите «+», напишите своё объявление и отправьте на модерацию; после одобрения текст появится в ленте.",
  },
  {
    title: "Дальше — выбор стола",
    body:
      "После обучения вы попадёте в лобби: выберите комнату или создайте свою. Приятной игры!",
  },
]

const ACTION_MOCK: Array<{
  id: string
  label: string
  style: { bg: string; border: string; shadow: string; text: string }
  cost?: number
}> = [
  {
    id: "kiss",
    label: "Поцеловать",
    style: {
      bg: "linear-gradient(180deg, #e74c3c 0%, #c0392b 100%)",
      border: "#a93226",
      shadow: "#7b241c",
      text: "#ffffff",
    },
  },
  {
    id: "flowers",
    label: "Цветы",
    style: {
      bg: "linear-gradient(180deg, #ffb347 0%, #ff7e00 100%)",
      border: "#e67e22",
      shadow: "#a04000",
      text: "#111827",
    },
    cost: 2,
  },
  {
    id: "diamond",
    label: "Бриллианты",
    style: {
      bg: "linear-gradient(180deg, #78d6ff 0%, #1ea5ff 100%)",
      border: "#0a6bd1",
      shadow: "#063f7a",
      text: "#0b1120",
    },
    cost: 3,
  },
  {
    id: "skip",
    label: "Пропустить",
    style: {
      bg: "linear-gradient(180deg, #7f8c8d 0%, #636e72 100%)",
      border: "#535c5e",
      shadow: "#3d4648",
      text: "#f9fafb",
    },
  },
]

function SpotlightOverlay({
  rect,
  onDimClick,
}: {
  rect: DOMRect | null
  onDimClick: () => void
}) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null
  const { top, left, width, height } = rect
  const vw = typeof window !== "undefined" ? window.innerWidth : 0
  const vh = typeof window !== "undefined" ? window.innerHeight : 0

  return (
    <>
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className="fixed z-[201] cursor-default border-0 bg-black/75 p-0"
        style={{ top: 0, left: 0, right: 0, height: top }}
        onClick={onDimClick}
      />
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className="fixed z-[201] cursor-default border-0 bg-black/75 p-0"
        style={{ top: top + height, left: 0, width: vw, height: Math.max(0, vh - top - height) }}
        onClick={onDimClick}
      />
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className="fixed z-[201] cursor-default border-0 bg-black/75 p-0"
        style={{ top, left: 0, width: Math.max(0, left), height }}
        onClick={onDimClick}
      />
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className="fixed z-[201] cursor-default border-0 bg-black/75 p-0"
        style={{
          top,
          left: left + width,
          width: Math.max(0, vw - left - width),
          height,
        }}
        onClick={onDimClick}
      />
      <div
        className="pointer-events-none fixed z-[202] rounded-xl ring-2 ring-amber-400/95 shadow-[0_0_0_4px_rgba(251,191,36,0.2)]"
        style={{ top, left, width, height }}
      />
    </>
  )
}

export function UiTourScreen() {
  const { state, dispatch } = useGame()
  const currentUser = state.currentUser
  const voiceBalance = state.voiceBalance ?? 0

  const centerTableRef = useRef<HTMLDivElement>(null)
  const shopBtnRef = useRef<HTMLButtonElement>(null)
  const actionsBlockRef = useRef<HTMLDivElement>(null)
  const bottleSpinRef = useRef<HTMLDivElement>(null)
  const roomChatRef = useRef<HTMLDivElement>(null)
  const avatarMenuPopRef = useRef<HTMLDivElement>(null)
  const tickerBarRef = useRef<HTMLDivElement>(null)
  const finishHintRef = useRef<HTMLDivElement>(null)

  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!currentUser) {
      dispatch({ type: "SET_SCREEN", screen: "lobby" })
    }
  }, [currentUser, dispatch])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const targetRef = useMemo(() => {
    switch (stepIndex) {
      case 0:
        return centerTableRef
      case 1:
        return shopBtnRef
      case 2:
        return actionsBlockRef
      case 3:
        return bottleSpinRef
      case 4:
        return roomChatRef
      case 5:
        return avatarMenuPopRef
      case 6:
        return tickerBarRef
      case 7:
        return finishHintRef
      default:
        return centerTableRef
    }
  }, [stepIndex])

  const updateRect = useCallback(() => {
    const el = targetRef.current
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect(
      new DOMRect(
        r.left - PAD,
        r.top - PAD,
        r.width + PAD * 2,
        r.height + PAD * 2,
      ),
    )
  }, [targetRef])

  useLayoutEffect(() => {
    updateRect()
  }, [stepIndex, updateRect, voiceBalance])

  useEffect(() => {
    const el = targetRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      updateRect()
    })
    ro.observe(el)
    const onWin = () => {
      updateRect()
    }
    window.addEventListener("resize", onWin)
    window.visualViewport?.addEventListener("resize", onWin)
    window.visualViewport?.addEventListener("scroll", onWin)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", onWin)
      window.visualViewport?.removeEventListener("resize", onWin)
      window.visualViewport?.removeEventListener("scroll", onWin)
    }
  }, [targetRef, updateRect])

  const goLobby = useCallback(() => {
    if (currentUser) markUiTourDone(currentUser.id)
    dispatch({ type: "SET_SCREEN", screen: "lobby" })
  }, [currentUser, dispatch])

  const handleNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((s) => s + 1)
    } else {
      goLobby()
    }
  }, [stepIndex, goLobby])

  const handleBack = useCallback(() => {
    setStepIndex((s) => Math.max(0, s - 1))
  }, [])

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  const sideBtnClass =
    "pointer-events-none flex w-full items-center gap-2 rounded-[999px] px-3 py-2 min-h-[40px]"
  const sideBtnTextClass = "text-[13px] font-semibold leading-none"
  const darkSideBtnStyle: CSSProperties = {
    background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
    border: "1px solid rgba(56,189,248,0.28)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
  }
  const sideBtnPairWrap = "flex w-full gap-1.5 flex-row"
  const sideBtnCompactClass =
    "pointer-events-none relative flex flex-1 min-w-0 items-center justify-center gap-1.5 rounded-[999px] px-2.5 py-1.5 min-h-[36px]"
  const sideBtnCompactTextClass = "text-[12px] font-semibold leading-none truncate"

  if (!currentUser) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-slate-950 text-slate-100"
      role="dialog"
      aria-modal
      aria-labelledby="ui-tour-title"
      aria-describedby="ui-tour-desc"
    >
      {/* Верх: как в игре — музыка / звуки (неактивны) */}
      <div className="pointer-events-none relative z-[200] flex shrink-0 gap-1.5 px-2 pt-2 sm:px-3">
        <div
          className="rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold"
          style={{
            borderColor: "rgba(148, 163, 184, 0.6)",
            background: "rgba(30, 41, 59, 0.6)",
            color: "#e5e7eb",
          }}
        >
          🔇 Музыка: выкл
        </div>
        <div
          className="rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold"
          style={{
            borderColor: "rgba(148, 163, 184, 0.6)",
            background: "rgba(30, 41, 59, 0.6)",
            color: "#e5e7eb",
          }}
        >
          🔇 Звуки: выкл
        </div>
      </div>

      <div
        className={cn(
          "relative z-[200] flex min-h-0 flex-1 flex-col p-2 pb-[min(42vh,280px)] sm:p-3",
          "lg:pb-40",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-3",
          )}
        >
        {/* Центр — на мобильном сверху (как главный фокус стола) */}
        <div
          className={cn(
            "order-1 flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center lg:order-2",
          )}
        >
          <div
            ref={centerTableRef}
            className="relative flex aspect-[60/50] w-full max-w-[min(92vw,520px)] flex-col items-center justify-center rounded-2xl sm:rounded-3xl"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(30,58,95,0.55) 0%, rgba(15,23,42,0.95) 60%, rgba(2,6,23,1) 100%)",
              boxShadow: "0 24px 50px rgba(0,0,0,0.88), 0 0 55px rgba(56,189,248,0.1)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-3 rounded-[22px] sm:inset-4 sm:rounded-[26px]"
              style={{
                boxShadow: "inset 0 0 56px rgba(0,0,0,0.78)",
                background:
                  "radial-gradient(circle at center, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.96) 68%, rgba(2,6,23,1) 100%)",
              }}
            />
            {/* Игроки по кругу — условные точки */}
            <div className="pointer-events-none absolute inset-4 flex items-center justify-center">
              <div className="relative h-[min(55vw,240px)] w-[min(55vw,240px)] rounded-full border border-slate-600/40 sm:h-60 sm:w-60">
                {["Дарья", "Макс", "Алина", "Иван", "Катя", "Лев"].map((name, i) => {
                  const deg = (i / 6) * 360 - 90
                  const rad = (deg * Math.PI) / 180
                  const r = 42
                  const x = 50 + r * Math.cos(rad)
                  const y = 50 + r * Math.sin(rad)
                  return (
                    <div
                      key={name}
                      className="absolute flex w-10 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full border-2 border-slate-500 bg-slate-700",
                          i === 1 && "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900",
                        )}
                      />
                      <span className="max-w-[3.5rem] truncate text-[9px] text-slate-400">{name}</span>
                    </div>
                  )
                })}
                <div ref={bottleSpinRef} className="absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
                  <div
                    className="h-10 w-28 rotate-[-8deg] rounded-full shadow-lg"
                    style={{
                      background: "linear-gradient(180deg, #22c55e 0%, #15803d 100%)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                    }}
                    title="Бутылочка"
                  />
                  <div
                    className="rounded-2xl border border-slate-600/80 px-6 py-2.5 text-sm font-bold text-slate-200"
                    style={{
                      background: "linear-gradient(180deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)",
                    }}
                  >
                    Крутится…
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Пример мини-меню по клику на аватарку (как в игре) */}
          <div className="mt-3 flex w-full max-w-[min(92vw,520px)] flex-col items-center px-1">
            <p className="mb-2 max-w-[18rem] text-center text-[10px] leading-snug text-slate-500">
              Нажмите на чужую аватарку — под ней откроется меню
            </p>
            <div
              ref={avatarMenuPopRef}
              className="pointer-events-none relative w-[min(92vw,200px)] rounded-2xl border p-2 pt-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.65)]"
              style={{
                background: "linear-gradient(165deg, rgba(22, 32, 52, 0.98) 0%, rgba(8, 15, 32, 0.99) 100%)",
                borderColor: "rgba(251, 191, 36, 0.28)",
              }}
            >
              <div
                className="pointer-events-none absolute -right-1 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] ring-2 ring-slate-900/80"
                style={{
                  background: "linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)",
                  color: "#ffffff",
                  border: "1px solid rgba(254, 202, 202, 0.95)",
                }}
                aria-hidden
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-1.5 pt-0.5">
                <div className="flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl border border-slate-500/30 bg-slate-950/70 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-500/10 text-rose-200">
                    <Gift className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] font-extrabold leading-tight text-white sm:text-xs">
                    Подарить подарок
                  </span>
                </div>
                <div className="flex min-h-[2.75rem] w-full items-center gap-2 rounded-xl border border-amber-400/35 bg-slate-950/70 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-amber-400/15">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/40 bg-gradient-to-b from-amber-400/25 to-amber-600/15 text-amber-100">
                    <User className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] font-extrabold leading-tight text-amber-50 sm:text-xs">
                    Профиль
                  </span>
                </div>
              </div>
              <p className="mt-2 border-t border-slate-600/40 pt-2 text-[9px] leading-tight text-slate-500">
                В «Профиле»: ухаживание, ВК при разрешении, розы
              </p>
            </div>
          </div>
        </div>

        {/* Левая колонка: эмоции + действия + экономика */}
        <aside
          className={cn(
            "order-2 flex w-full min-w-0 shrink-0 flex-col gap-2 overflow-y-auto lg:order-1 lg:w-[min(92vw,250px)]",
          )}
        >
          <div
            ref={actionsBlockRef}
            className="flex w-full flex-col gap-2 rounded-xl p-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
            style={{
              background: "rgba(15, 23, 42, 0.92)",
              border: "1px solid rgba(148, 163, 184, 0.45)",
            }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 shrink-0" style={{ color: "#e8c06a" }} />
              <span className="text-sm font-extrabold" style={{ color: "#e8c06a" }}>
                Эмоции
              </span>
            </div>
            <div className="flex justify-center gap-2 text-[10px] text-slate-400">
              <span>💋 0/50</span>
              <span>🍺 0/50</span>
              <span>🍬 0/50</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {ACTION_MOCK.map((a) => (
                <div
                  key={a.id}
                  className="pointer-events-none flex min-h-[2.5rem] items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-extrabold"
                  style={{
                    background: a.style.bg,
                    color: a.style.text,
                    border: `1px solid ${a.style.border}`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 0 ${a.style.shadow}`,
                  }}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center">
                    {a.id === "kiss" ? (
                      <span className="text-lg">💋</span>
                    ) : a.id === "flowers" ? (
                      <Flower2 className="h-5 w-5" />
                    ) : a.id === "diamond" ? (
                      <Gem className="h-5 w-5" />
                    ) : (
                      <span className="text-sm">⏭</span>
                    )}
                  </span>
                  <span className="min-w-0 truncate">{a.label}</span>
                  {a.cost != null ? (
                    <span className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">
                      {a.cost}
                      <Heart className="h-3 w-3" fill="currentColor" />
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex w-full min-w-0 items-center gap-2 rounded-[999px] px-2 py-2 min-h-[40px] sm:px-3"
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
              border: "1px solid rgba(56,189,248,0.28)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
            }}
          >
            <Heart
              className="h-5 w-5 shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]"
              style={{ color: "#fde68a" }}
              fill="currentColor"
            />
            <span className="inline-flex shrink-0 items-baseline text-[15px] font-black tabular-nums leading-none text-white sm:text-base">
              {formatVoiceBalanceCompact(voiceBalance)}
            </span>
            <span className="text-[11px] leading-none truncate text-slate-300">Ваш банк</span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  border: "1px solid rgba(56,189,248,0.5)",
                  color: "#7dd3fc",
                  background: "linear-gradient(180deg, rgba(56,189,248,0.22) 0%, rgba(14,116,144,0.2) 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
                }}
              >
                <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden />
              </div>
            </div>
          </div>

          <button
            ref={shopBtnRef}
            type="button"
            tabIndex={-1}
            className={sideBtnClass}
            style={{
              background: "linear-gradient(135deg, #facc15 0%, #fb923c 100%)",
              border: "1px solid rgba(245, 158, 11, 0.8)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 10px 20px rgba(251,146,60,0.35)",
            }}
          >
            <Gift className="h-4 w-4 shrink-0" style={{ color: "#1f2937" }} />
            <span className={sideBtnTextClass} style={{ color: "#1f2937" }}>
              Магазин
            </span>
          </button>

          <div className={sideBtnPairWrap}>
            <div className={sideBtnCompactClass} style={darkSideBtnStyle}>
              <User className="h-3.5 w-3.5 shrink-0" style={{ color: "#e8c06a" }} />
              <span className={sideBtnCompactTextClass} style={{ color: "#f0e0c8" }}>
                Профиль
              </span>
            </div>
            <div className={sideBtnCompactClass} style={darkSideBtnStyle}>
              <MessageCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "#e8c06a" }} />
              <span className={sideBtnCompactTextClass} style={{ color: "#f0e0c8" }}>
                Чат
              </span>
            </div>
          </div>

          <div className="flex w-full gap-1.5">
            <div
              className="pointer-events-none flex flex-1 items-center justify-center gap-1.5 rounded-[999px] px-2 py-2 text-[12px] font-semibold text-slate-200"
              style={darkSideBtnStyle}
            >
              Бутылочка
            </div>
            <div
              className="pointer-events-none flex flex-1 items-center justify-center gap-1.5 rounded-[999px] px-2 py-2 text-[12px] font-semibold text-slate-200"
              style={darkSideBtnStyle}
            >
              Меню
            </div>
          </div>
        </aside>

        {/* Правый чат */}
        <aside
          ref={roomChatRef}
          className="order-3 flex min-h-[120px] w-full shrink-0 flex-col rounded-xl border border-slate-600/50 bg-slate-900/85 p-2 shadow-lg lg:order-3 lg:mt-0 lg:min-h-0 lg:w-[min(92vw,240px)] xl:w-[260px]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-600/50 pb-2">
            <span className="text-sm font-extrabold text-amber-100">Чат комнаты</span>
            <span className="text-[10px] text-slate-500">Свернуть</span>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">Игра начинается…</p>
        </aside>
        </div>

        {/* Табло — бегущая строка и «+» для объявления (как GameStatusTicker) */}
        <div
          ref={tickerBarRef}
          className="pointer-events-none mt-1 shrink-0 overflow-hidden rounded-[10px] border border-cyan-300/30 bg-slate-950/90 shadow-[0_-8px_24px_rgba(0,0,0,0.45)] backdrop-blur"
        >
          <div className="flex items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3">
            <span className="shrink-0 rounded border border-cyan-300/50 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-100">
              Табло
            </span>
            <div className="relative min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-xs font-medium text-cyan-100 sm:text-sm">
                Добро пожаловать в игру • Нажмите «+», чтобы добавить своё объявление…
              </p>
            </div>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  tabIndex={-1}
                  className="pointer-events-auto shrink-0 rounded-lg border border-cyan-400/45 bg-cyan-500/15 p-1.5 text-cyan-100"
                  aria-label="табло объявлений"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={8}
                className="border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-100 shadow-xl"
              >
                табло объявлений
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Шаг «готово» — над нижней панелью; видима на последнем шаге */}
      <div
        ref={finishHintRef}
        className={cn(
          "pointer-events-none fixed left-1/2 z-[199] w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-emerald-500/35 bg-emerald-950/90 px-4 py-3 text-center shadow-lg backdrop-blur-sm transition-opacity duration-200",
          stepIndex === STEPS.length - 1 ? "opacity-100" : "opacity-0",
        )}
        style={{ bottom: "calc(11.5rem + env(safe-area-inset-bottom, 0px))" }}
        aria-hidden={stepIndex !== STEPS.length - 1}
      >
        <p className="text-sm font-semibold text-emerald-100">Готово к игре</p>
        <p className="mt-1 text-xs text-emerald-200/85">
          Нажмите «К выбору стола» или завершите обучение — откроется лобби комнат.
        </p>
      </div>

      <SpotlightOverlay rect={rect} onDimClick={() => {}} />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[203] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
        <div
          className="pointer-events-auto w-full max-w-lg rounded-2xl border border-slate-600/80 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-sm"
          style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.5)" }}
        >
          <h2 id="ui-tour-title" className="text-lg font-black text-white">
            {step.title}
          </h2>
          <p id="ui-tour-desc" className="mt-2 text-sm leading-relaxed text-slate-300">
            {step.body}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              {stepIndex + 1} / {STEPS.length}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {stepIndex > 0 ? (
                <Button type="button" variant="outline" className="border-slate-600" onClick={handleBack}>
                  Назад
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className="bg-slate-700 text-slate-100 hover:bg-slate-600"
                onClick={goLobby}
              >
                Завершить обучение
              </Button>
              <Button type="button" onClick={handleNext}>
                {isLast ? "К выбору стола" : "Далее"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
