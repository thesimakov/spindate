"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Sparkles, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InlineToast } from "@/components/ui/inline-toast"
import { useGame } from "@/lib/game-context"
import { PAIR_ACTIONS } from "@/lib/game-types"
import { assetUrl } from "@/lib/assets"
import { useInlineToast } from "@/hooks/use-inline-toast"

function genderLabel(g: string) {
  return g === "male" ? "Мужчина" : g === "female" ? "Женщина" : "—"
}

const GIFT_IDS = new Set(["flowers", "diamond", "song", "rose", "gift_voice", "tools", "lipstick"])

export function ProfileScreen() {
  const { state, dispatch } = useGame()
  const { currentUser, players, voiceBalance, bonusBalance, inventory, rosesGiven, courtshipProfileAllowed, allowChatInvite, gameLog, avatarFrames, soundsEnabled } = state

  const currentFrameId = (avatarFrames ?? {})[currentUser?.id ?? 0] ?? "none"
  const FREE_FRAMES = [
    { id: "none", label: "Без рамки", border: "2px solid #475569", shadow: "none", animationClass: undefined, svgPath: undefined as string | undefined, cost: 0 },
    { id: "gold", label: "Золото", border: "3px solid #e8c06a", shadow: "0 0 10px rgba(232,192,106,0.8)", animationClass: "frame-preview-anim-gold", svgPath: undefined, cost: 0 },
    { id: "silver", label: "Серебро", border: "3px solid #c0c0c0", shadow: "0 0 10px rgba(192,192,192,0.7)", animationClass: "frame-preview-anim-silver", svgPath: undefined, cost: 0 },
    { id: "hearts", label: "Сердечки", border: "3px solid #e74c3c", shadow: "0 0 12px rgba(231,76,60,0.7)", animationClass: "frame-preview-anim-hearts", svgPath: undefined, cost: 0 },
    { id: "roses", label: "Розы", border: "3px solid #be123c", shadow: "0 0 12px rgba(190,18,60,0.6)", animationClass: "frame-preview-anim-roses", svgPath: undefined, cost: 0 },
    { id: "gradient", label: "Градиент", border: "3px solid #8b5cf6", shadow: "0 0 14px rgba(139,92,246,0.6)", animationClass: "frame-preview-anim-gradient", svgPath: undefined, cost: 0 },
    { id: "neon", label: "Неон", border: "3px solid rgba(0, 255, 255, 0.95)", shadow: "none", animationClass: "frame-preview-anim-neon", svgPath: undefined, cost: 0 },
    { id: "snow", label: "Снежная", border: "3px solid rgba(186, 230, 253, 0.95)", shadow: "0 0 12px rgba(186, 230, 253, 0.5)", animationClass: "frame-preview-anim-snow", svgPath: undefined, cost: 0 },
  ] as const
  const PREMIUM_FRAMES = [
    { id: "fox", label: "Лиса", border: "2px solid transparent", shadow: "none", animationClass: undefined, svgPath: "ram-lis.svg", cost: 5 },
    { id: "rabbit", label: "Кролик", border: "2px solid transparent", shadow: "none", animationClass: undefined, svgPath: "ram-rabbit.svg", cost: 5 },
    { id: "fairy", label: "Фея", border: "2px solid transparent", shadow: "none", animationClass: undefined, svgPath: "ram-fea.svg", cost: 5 },
    { id: "mag", label: "Маг сердца", border: "2px solid transparent", shadow: "none", animationClass: undefined, svgPath: "ram-mag.svg", cost: 5 },
    { id: "malif", label: "Милифисента", border: "2px solid transparent", shadow: "none", animationClass: undefined, svgPath: "ram-malif.svg", cost: 5 },
    { id: "mir", label: "Миру мир", border: "2px solid transparent", shadow: "none", animationClass: undefined, svgPath: "ram-mir.svg", cost: 5 },
    { id: "vesna", label: "Весна", border: "2px solid transparent", shadow: "none", animationClass: undefined, svgPath: "ram-vesna.svg", cost: 5 },
  ] as const
  const PROFILE_FRAMES = [...FREE_FRAMES, ...PREMIUM_FRAMES]

  const rosesBalance = useMemo(
    () => inventory.filter((i) => i.type === "rose").length,
    [inventory],
  )

  const heartbreakerCount = useMemo(
    () =>
      currentUser
        ? gameLog.filter(
            (e) =>
              e.type === "kiss" &&
              (e.fromPlayer?.id === currentUser.id || e.toPlayer?.id === currentUser.id),
          ).length
        : 0,
    [currentUser, gameLog],
  )
  const spinCount = useMemo(
    () =>
      currentUser
        ? gameLog.filter(
            (e) =>
              e.fromPlayer?.id === currentUser.id && e.text.startsWith("Выпала пара:"),
          ).length
        : 0,
    [currentUser, gameLog],
  )
  const giftSpent = useMemo(
    () =>
      currentUser
        ? gameLog.reduce((sum, entry) => {
            if (entry.fromPlayer?.id !== currentUser.id) return sum
            if (!GIFT_IDS.has(entry.type)) return sum
            const action = PAIR_ACTIONS.find((a) => a.id === entry.type)
            return sum + (action?.cost ?? 0)
          }, 0)
        : 0,
    [currentUser, gameLog],
  )

  const rosesReceived = useMemo(
    () => (currentUser && rosesGiven ? rosesGiven.filter((r) => r.toPlayerId === currentUser.id).length : 0),
    [currentUser, rosesGiven],
  )
  const hasTrueFeelingsAchievement = useMemo(() => {
    if (!currentUser || !rosesGiven) return false
    const byTarget: Record<number, number> = {}
    for (const r of rosesGiven) {
      if (r.fromPlayerId !== currentUser.id) continue
      byTarget[r.toPlayerId] = (byTarget[r.toPlayerId] ?? 0) + 1
    }
    return Object.values(byTarget).some((n) => n >= 10)
  }, [currentUser, rosesGiven])

  if (!currentUser) return null

  const myPlayer = players.find((p) => p.id === currentUser.id)
  const isVip = !!myPlayer?.isVip && (myPlayer.vipUntilTs == null || myPlayer.vipUntilTs > Date.now())
  const initialName = useMemo(() => currentUser.name ?? "", [currentUser.name])
  const [name, setName] = useState(initialName)
  const [avatarInput, setAvatarInput] = useState(currentUser.avatar ?? "")
  const [showGiveRoseModal, setShowGiveRoseModal] = useState(false)
  const [showFramesModal, setShowFramesModal] = useState(false)
  /** В модалке рамок: наведение на карточку — крупное превью; иначе показываем текущую рамку */
  const [frameHoverPreviewId, setFrameHoverPreviewId] = useState<string | null>(null)
  /** Анимация «как за столом» после успешной отправки розы */
  const [roseGiftFx, setRoseGiftFx] = useState(false)
  const roseGiftFxTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { toast, showToast } = useInlineToast(1700)
  const nameTrimmed = name.trim()
  const canSaveName = nameTrimmed.length >= 2 && nameTrimmed.length <= 16 && nameTrimmed !== currentUser.name
  const canChangeAvatar = currentUser.authProvider === "login" && avatarInput.trim().length > 0 && avatarInput !== currentUser.avatar
  const sectionCardClass = "rounded-xl border border-cyan-300/20 bg-slate-950/70 px-3 py-3 shadow-[0_8px_24px_rgba(2,6,23,0.5)]"
  const secondaryBtnClass = "rounded-xl border border-slate-600 bg-slate-800/70 text-sm font-semibold text-slate-100 transition-all hover:bg-slate-700/70"
  const valueTextClass = "text-sm font-bold text-slate-100"

  useEffect(() => {
    setName(initialName)
  }, [initialName])

  useEffect(() => {
    if (showFramesModal) setFrameHoverPreviewId(null)
  }, [showFramesModal])

  useEffect(() => {
    return () => {
      if (roseGiftFxTimeoutRef.current) clearTimeout(roseGiftFxTimeoutRef.current)
    }
  }, [])

  const triggerRoseGiftFx = () => {
    if (roseGiftFxTimeoutRef.current) clearTimeout(roseGiftFxTimeoutRef.current)
    setRoseGiftFx(true)
    roseGiftFxTimeoutRef.current = setTimeout(() => {
      setRoseGiftFx(false)
      roseGiftFxTimeoutRef.current = null
    }, 2600)
  }

  const displayFrameId = frameHoverPreviewId ?? currentFrameId
  const previewFrameMeta = PROFILE_FRAMES.find((x) => x.id === displayFrameId) ?? FREE_FRAMES[0]

  const handleSaveName = () => {
    if (!canSaveName) return
    dispatch({ type: "UPDATE_USER_NAME", playerId: currentUser.id, name: nameTrimmed })
    showToast("Имя сохранено", "success")
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col items-center px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] game-bg-animated">
      {toast && <InlineToast toast={toast} />}
      <div className="w-full max-w-lg flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-cyan-300/20 bg-[rgba(2,6,23,0.85)] shadow-[0_24px_50px_rgba(0,0,0,0.75)]">
        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 sm:py-7 space-y-4">
        <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 mb-1 border-b border-cyan-300/15 bg-slate-950/85 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold text-slate-100 tracking-wide">Профиль</h1>
          <span className="text-xs sm:text-sm text-slate-400">ID: {currentUser.id}</span>
        </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="relative h-16 w-16 overflow-visible">
              {roseGiftFx && (
                <>
                  {/* Кольцо как у «цели» за столом (targetPulse) */}
                  <div
                    className="profile-rose-gift-target-ring pointer-events-none absolute inset-[-5px] z-[14] rounded-full"
                    aria-hidden
                  />
                  {/* Летящая роза — как flyEmoji со стола */}
                  <span
                    className="profile-rose-gift-fly-emoji pointer-events-none absolute left-1/2 top-1/2 z-[24] text-[2.35rem] drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)]"
                    aria-hidden
                  >
                    {"\uD83C\uDF39"}
                  </span>
                  {/* Короткий «фейерверк» роз вокруг (как рамка «Розы» на столе) */}
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 z-[13] -translate-x-1/2 -translate-y-1/2"
                    style={{ width: 0, height: 0 }}
                    aria-hidden
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                      const angleDeg = i * 45
                      const roseSize = 8
                      const radius = 28
                      return (
                        <div
                          key={i}
                          className="absolute left-0 top-0 inline-flex items-center justify-center"
                          style={{
                            width: roseSize * 2,
                            height: roseSize * 2,
                            marginLeft: -roseSize,
                            marginTop: -roseSize,
                            transform: `rotate(${angleDeg}deg) translateY(-${radius}px)`,
                          }}
                        >
                          <span
                            className="profile-rose-gift-burst-petal inline-block text-sm leading-none"
                            style={{ animationDelay: `${i * 0.07}s` }}
                          >
                            {"\uD83C\uDF39"}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              <div
                className={`relative z-[10] h-full w-full overflow-hidden rounded-full transition-all duration-200 ${
                  (() => {
                    const f = PROFILE_FRAMES.find((x) => x.id === currentFrameId)
                    return f?.animationClass ?? ""
                  })()
                }`}
                style={
                  currentFrameId !== "none"
                    ? (() => {
                        const f = PROFILE_FRAMES.find((x) => x.id === currentFrameId)
                        return f ? { border: f.border, boxShadow: f.shadow, padding: 3 } : {}
                      })()
                    : { border: "2px solid #475569" }
                }
              >
                <img src={currentUser.avatar} alt={currentUser.name} className="h-full w-full rounded-full object-cover" />
              </div>
              {(() => {
                const f = PROFILE_FRAMES.find((x) => x.id === currentFrameId)
                return f?.svgPath ? (
                  <img
                    src={assetUrl(f.svgPath)}
                    alt=""
                    className="pointer-events-none absolute inset-0 z-[11] h-full w-full object-contain"
                    aria-hidden
                  />
                ) : null
              })()}
              {isVip && (
                <div
                  className="absolute z-[26] flex items-center justify-center rounded-full"
                  style={{
                    width: 22,
                    height: 22,
                    background: "linear-gradient(135deg,#facc15,#f97316)",
                    color: "#111827",
                    border: "2px solid #a15c10",
                    top: 4,
                    right: 4,
                    boxShadow: "0 0 10px rgba(250,204,21,0.9)",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 18h16l-1.5-7.5-3.5 3-3-6.5-3 6.5-3.5-3L4 18z"
                      fill="#111827"
                    />
                  </svg>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFramesModal(true)}
              className={`w-full px-3 py-2 ${secondaryBtnClass}`}
            >
              Рамки
            </button>
            <button
              type="button"
              onClick={() => {
                const nextEnabled = soundsEnabled === false
                dispatch({ type: "SET_SOUNDS_ENABLED", enabled: nextEnabled })
                showToast(nextEnabled ? "Звуки включены" : "Звуки отключены", "success")
              }}
              className={`mt-2 flex w-full items-center justify-center gap-2 px-3 py-2 ${secondaryBtnClass}`}
            >
              {soundsEnabled === false ? (
                <>
                  <VolumeX className="h-4 w-4" />
                  Включить звуки
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" />
                  Отключить звуки
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col">
            <div className="text-sm font-semibold text-slate-400">{"Имя"}</div>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                className="h-9 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm font-semibold text-slate-50 outline-none"
                placeholder="Введите имя"
              />
              <Button
                size="sm"
                onClick={handleSaveName}
                disabled={!canSaveName}
                className="h-9 rounded-xl px-3 text-sm font-semibold disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,#38bdf8,#a78bfa)",
                  color: "#0b1220",
                  border: "1px solid rgba(148,163,184,0.35)",
                }}
              >
                {"Сохранить"}
              </Button>
            </div>
            <div className="text-sm text-slate-300">
              {currentUser.age} {"лет"} {"•"} {genderLabel(currentUser.gender)}
            </div>

            {currentUser.authProvider === "login" && (
              <div className="mt-3 space-y-1.5">
                <div className="text-sm font-semibold text-slate-400">{"Фото профиля"}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={avatarInput}
                    onChange={(e) => setAvatarInput(e.target.value)}
                    placeholder="Вставьте URL картинки"
                    className="h-8 flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-50 outline-none"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!canChangeAvatar) return
                      dispatch({ type: "UPDATE_USER_AVATAR", playerId: currentUser.id, avatar: avatarInput.trim() })
                      showToast("Фото обновлено", "success")
                    }}
                    disabled={!canChangeAvatar}
                    className="h-8 rounded-xl px-3 text-sm font-semibold disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg,#38bdf8,#a78bfa)",
                      color: "#0b1220",
                      border: "1px solid rgba(148,163,184,0.35)",
                    }}
                  >
                    {"Обновить"}
                  </Button>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">
                  {"Временно аватарка берётся по URL. Позже это будет сохраняться на нашем сервере."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Достижения */}
        <div
          className={sectionCardClass}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-slate-100">Достижения</span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-2.5 py-2">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span style={{ color: heartbreakerCount >= 100 ? "#f97373" : "#e2e8f0" }}>
                Сердцеед
              </span>
              <span className="text-slate-400">
                {Math.min(heartbreakerCount, 100)}/100
              </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.min(100, (heartbreakerCount / 100) * 100)}%` }} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-2.5 py-2">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span style={{ color: giftSpent >= 1000 ? "#facc15" : "#e2e8f0" }}>
                Щедрый
              </span>
              <span className="text-slate-400">
                {Math.min(giftSpent, 1000)}/1000
              </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, (giftSpent / 1000) * 100)}%` }} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-2.5 py-2">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span style={{ color: spinCount >= 50 ? "#4ade80" : "#e2e8f0" }}>
                Душа компании
              </span>
              <span className="text-slate-400">
                {Math.min(spinCount, 50)}/50
              </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, (spinCount / 50) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className={sectionCardClass}>
            <div className="text-xs sm:text-sm font-semibold text-slate-400">{"Сердца"}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-base" style={{ color: "#f97316" }}>{"❤"}</span>
              <span className={valueTextClass}>{voiceBalance}</span>
            </div>
          </div>
          <div className={sectionCardClass}>
            <div className="text-xs sm:text-sm font-semibold text-slate-400">{"Бонусы"}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-base" style={{ color: "#2ecc71" }}>{"🏆"}</span>
              <span className={valueTextClass}>{bonusBalance}</span>
            </div>
          </div>
          <div className={sectionCardClass}>
            <div className="text-xs sm:text-sm font-semibold text-slate-400">{"Розы"}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-base">{"🌹"}</span>
              <span className={valueTextClass}>{rosesBalance}</span>
            </div>
          </div>
        </div>

        <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${sectionCardClass}`}>
          <div>
            <div className="text-xs sm:text-sm font-semibold text-slate-400">{"Получено роз"}</div>
            <div className={valueTextClass}>{rosesReceived}</div>
          </div>
          <Button
            size="sm"
            className="rounded-xl text-sm font-semibold shrink-0"
            style={{
              background: voiceBalance >= 50 ? "linear-gradient(180deg, #e11d48 0%, #be123c 100%)" : undefined,
              border: "1px solid rgba(225,29,72,0.5)",
              color: "#fff",
            }}
            variant={voiceBalance < 50 ? "outline" : "default"}
            disabled={voiceBalance < 50}
            onClick={() => setShowGiveRoseModal(true)}
          >
            {"Подарить розу — 50 ❤"}
          </Button>
        </div>
        {hasTrueFeelingsAchievement && (
          <div className="rounded-xl border border-rose-500/50 bg-rose-950/30 px-3 py-2 flex items-center gap-2">
            <span className="text-lg">🌹</span>
            <span className="text-sm font-semibold text-rose-200">{"Настоящие чувства"}</span>
            <span className="text-xs sm:text-sm text-slate-400">— подарили 10 роз одному игроку</span>
          </div>
        )}

        <label className={`flex cursor-pointer items-center gap-3 ${sectionCardClass}`}>
          <input
            type="checkbox"
            checked={courtshipProfileAllowed?.[currentUser.id] !== false}
            onChange={(e) =>
              dispatch({
                type: "SET_COURTSHIP_PROFILE_ALLOWED",
                playerId: currentUser.id,
                allowed: e.target.checked,
              })
            }
            className="h-4 w-4 rounded border-slate-600 accent-amber-500 transition-transform duration-200 checked:scale-110"
          />
          <span className="text-sm font-medium text-slate-100">
            {"Разрешаю ухаживание"}
          </span>
        </label>
        <p className="text-xs sm:text-sm text-slate-400 -mt-2">
          {courtshipProfileAllowed?.[currentUser.id] !== false
            ? "Кто нажал «Ухаживание» — увидит ссылку на ваш профиль ВК."
            : "Кто нажал «Ухаживание» — сможет написать вам личное сообщение в игре."}
        </p>

        <label className={`flex cursor-pointer items-center gap-3 ${sectionCardClass}`}>
          <input
            type="checkbox"
            checked={allowChatInvite?.[currentUser.id] === true}
            onChange={(e) =>
              dispatch({
                type: "SET_ALLOW_CHAT_INVITE",
                playerId: currentUser.id,
                allowed: e.target.checked,
              })
            }
            className="h-4 w-4 rounded border-slate-600 accent-amber-500 transition-transform duration-200 checked:scale-110"
          />
          <span className="text-sm font-medium text-slate-100">
            {"Общение"}
          </span>
        </label>
        <p className="text-xs sm:text-sm text-slate-400 -mt-2">
          {allowChatInvite?.[currentUser.id] === true
            ? "У вас включена кнопка «Пригласить общаться» — другие могут пригласить вас в личный чат."
            : "Если хотите пообщаться, но кнопка не работает — активируйте приват."}
        </p>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="outline"
            className="w-full rounded-xl text-sm"
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "game" })}
          >
            {"Назад к столу"}
          </Button>
        </div>
        </div>
      </div>

      {showFramesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          style={{ background: "rgba(2,6,23,0.76)", backdropFilter: "blur(10px)" }}
          onClick={() => setShowFramesModal(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[90dvh] min-h-0 overflow-y-auto rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-300 overscroll-contain"
            style={{
              background: "linear-gradient(165deg, rgba(15, 23, 42, 0.98) 0%, rgba(2, 6, 23, 0.98) 55%, rgba(15, 23, 42, 0.98) 100%)",
              border: "1px solid rgba(56, 189, 248, 0.28)",
              boxShadow: "0 0 0 1px rgba(56, 189, 248, 0.08), 0 25px 50px -12px rgba(0,0,0,0.55), 0 0 45px -12px rgba(56, 189, 248, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(56,189,248,0.08)_0%,transparent_50%)] pointer-events-none" aria-hidden />
            <h3 className="relative mb-4 text-xl font-black tracking-tight" style={{ color: "#e2e8f0", textShadow: "0 0 18px rgba(56, 189, 248, 0.25)" }}>
              Рамка аватарки
            </h3>

            <div
              className="relative mb-5 rounded-2xl border border-slate-600/45 bg-slate-950/40 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              onPointerLeave={(e) => {
                const next = e.relatedTarget as Node | null
                if (next && (e.currentTarget as HTMLElement).contains(next)) return
                setFrameHoverPreviewId(null)
              }}
            >
              <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-500">
                Предпросмотр
              </p>
              <div className="mb-2 flex justify-center">
                <div className="relative h-[7.5rem] w-[7.5rem]">
                  <div
                    className={`h-full w-full overflow-hidden rounded-full transition-all duration-200 ${previewFrameMeta.animationClass ?? ""}`}
                    style={
                      displayFrameId !== "none"
                        ? { border: previewFrameMeta.border, boxShadow: previewFrameMeta.shadow, padding: 4 }
                        : { border: "2px solid #475569" }
                    }
                  >
                    <img
                      src={currentUser.avatar}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  </div>
                  {previewFrameMeta.svgPath ? (
                    <img
                      src={assetUrl(previewFrameMeta.svgPath)}
                      alt=""
                      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                      aria-hidden
                    />
                  ) : null}
                  {isVip && (
                    <div
                      className="absolute flex items-center justify-center rounded-full"
                      style={{
                        width: 26,
                        height: 26,
                        background: "linear-gradient(135deg,#facc15,#f97316)",
                        color: "#111827",
                        border: "2px solid #a15c10",
                        top: 6,
                        right: 6,
                        boxShadow: "0 0 10px rgba(250,204,21,0.9)",
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M4 18h16l-1.5-7.5-3.5 3-3-6.5-3 6.5-3.5-3L4 18z"
                          fill="#111827"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
              <p className="mb-5 text-center text-sm font-semibold text-cyan-100/95">{previewFrameMeta.label}</p>

            <p className="relative mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
              Бесплатные
            </p>
            <div className="relative grid grid-cols-4 gap-3 mb-6">
              {FREE_FRAMES.map((f) => {
                const isSelected = currentFrameId === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onPointerEnter={() => setFrameHoverPreviewId(f.id)}
                    onClick={() => {
                      currentUser && dispatch({ type: "SET_AVATAR_FRAME", playerId: currentUser.id, frameId: f.id })
                      setShowFramesModal(false)
                      showToast("Рамка применена", "success")
                    }}
                    className={`flex flex-col items-center gap-2 rounded-2xl py-3 px-2 transition-all duration-200 hover:scale-105 hover:shadow-lg disabled:opacity-50 ${
                      isSelected ? "frame-pick-card-free--active" : "frame-pick-card-free--idle"
                    }`}
                  >
                    <div
                      className={`relative h-14 w-14 flex-shrink-0 rounded-full overflow-hidden ring-2 ring-slate-600/50 ${
                        isSelected ? "frame-pick-preview--pulse" : ""
                      }`}
                    >
                      <div
                        className={`h-full w-full rounded-full bg-slate-800 ${f.animationClass ?? ""}`}
                        style={{ border: f.border, boxShadow: f.shadow, padding: 2 }}
                      />
                      {f.svgPath && (
                        <img
                          src={assetUrl(f.svgPath)}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                          aria-hidden
                        />
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-200 leading-tight text-center">{f.label}</span>
                  </button>
                )
              })}
            </div>

            <p className="relative mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: "#fcd34d" }}>
              <span>Премиум</span>
              <span className="text-xs font-semibold normal-case opacity-90">5 ❤ за рамку</span>
            </p>
            <div className="relative grid grid-cols-3 gap-3">
              {PREMIUM_FRAMES.map((f) => {
                const canAfford = (voiceBalance ?? 0) >= f.cost
                const isSelected = currentFrameId === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-disabled={!canAfford}
                    onPointerEnter={() => setFrameHoverPreviewId(f.id)}
                    onClick={() => {
                      if (!currentUser) return
                      if (f.cost > 0 && (voiceBalance ?? 0) < f.cost) {
                        showToast("Недостаточно сердец для рамки", "error")
                        return
                      }
                      if (f.cost > 0) dispatch({ type: "PAY_VOICES", amount: f.cost })
                      dispatch({ type: "SET_AVATAR_FRAME", playerId: currentUser.id, frameId: f.id })
                      setShowFramesModal(false)
                      showToast("Рамка применена", "success")
                    }}
                    className={`flex flex-col items-center gap-2 rounded-2xl py-3 px-2 transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                      !canAfford ? "cursor-not-allowed opacity-45 hover:scale-100" : ""
                    } ${isSelected ? "frame-pick-card-premium--active" : "frame-pick-card-premium--idle"}`}
                  >
                    <div
                      className={`relative h-14 w-14 flex-shrink-0 rounded-full overflow-hidden ring-2 ring-amber-500/30 ${
                        isSelected ? "frame-pick-preview--pulse" : ""
                      }`}
                    >
                      <div
                        className="h-full w-full rounded-full bg-slate-800"
                        style={{ border: f.border, boxShadow: f.shadow, padding: 2 }}
                      />
                      {f.svgPath && (
                        <img
                          src={assetUrl(f.svgPath)}
                          alt=""
                          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                          aria-hidden
                        />
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-200 leading-tight text-center">{f.label}</span>
                    <span className="text-xs font-bold text-amber-300">{f.cost} ❤</span>
                  </button>
                )
              })}
            </div>
            </div>

            <Button
              variant="outline"
              className="relative mt-2 w-full rounded-xl text-sm font-semibold border transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ borderColor: "rgba(56,189,248,0.45)", color: "#e2e8f0" }}
              onClick={() => setShowFramesModal(false)}
            >
              Закрыть
            </Button>
          </div>
        </div>
      )}

      {showGiveRoseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: "rgba(2,6,23,0.76)", backdropFilter: "blur(10px)" }}
          onClick={() => setShowGiveRoseModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border p-4 shadow-xl"
            style={{
              borderColor: "rgba(56,189,248,0.28)",
              background: "linear-gradient(165deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.98) 55%, rgba(15,23,42,0.98) 100%)",
              boxShadow: "0 0 0 1px rgba(56, 189, 248, 0.08), 0 16px 32px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-bold text-slate-100">Подарить розу (50 ❤)</h3>
            <p className="mb-3 text-sm text-slate-400">Повышает рейтинг симпатии. За 10 роз одному игроку — ачивка «Настоящие чувства».</p>
            <ul className="max-h-48 overflow-y-auto space-y-1">
              {players
                .filter((p) => p.id !== currentUser.id)
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-2">
                    <span className="text-sm text-slate-100 truncate">{p.name}</span>
                    <Button
                      size="sm"
                      className="rounded-lg text-xs font-semibold shrink-0 disabled:opacity-50"
                      style={{
                        background: voiceBalance >= 50 ? "linear-gradient(180deg, #e11d48 0%, #be123c 100%)" : undefined,
                        color: "#fff",
                      }}
                      variant={voiceBalance >= 50 ? "default" : "outline"}
                      disabled={voiceBalance < 50}
                      onClick={() => {
                        if (voiceBalance < 50) {
                          showToast("Недостаточно сердец для розы", "error")
                          return
                        }
                        dispatch({ type: "GIVE_ROSE", fromPlayerId: currentUser.id, toPlayerId: p.id })
                        setShowGiveRoseModal(false)
                        triggerRoseGiftFx()
                        showToast("Роза подарена", "success")
                      }}
                    >
                      Подарить
                    </Button>
                  </li>
                ))}
            </ul>
            <Button
              variant="outline"
              className="mt-3 w-full rounded-xl text-sm"
              onClick={() => setShowGiveRoseModal(false)}
            >
              Закрыть
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={() => dispatch({ type: "SET_SCREEN", screen: "registration" })}
        className="mt-4 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
      >
        {"Выйти из профиля"}
      </button>
    </div>
  )
}

