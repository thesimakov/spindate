"use client"

import { useEffect, useMemo, useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGame } from "@/lib/game-context"
import { PAIR_ACTIONS } from "@/lib/game-types"

function purposeLabel(purpose: string) {
  switch (purpose) {
    case "relationships":
      return "Отношения"
    case "communication":
      return "Общение"
    case "love":
      return "Любовь"
    default:
      return "—"
  }
}

function genderLabel(g: string) {
  return g === "male" ? "Мужчина" : g === "female" ? "Женщина" : "—"
}

function lookingForLabel(userGender: string, lookingFor: string | undefined) {
  if (!lookingFor) return "—"

  if (userGender === "male" && lookingFor === "male") return "друга"
  if (userGender === "female" && lookingFor === "female") return "подругу"
  if (userGender === "male" && lookingFor === "female") return "подругу"
  if (userGender === "female" && lookingFor === "male") return "друга"

  return lookingFor === "male" ? "мужчину" : "женщину"
}

const GIFT_IDS = new Set(["flowers", "diamond", "song", "rose", "gift_voice", "tools", "lipstick"])

export function ProfileScreen() {
  const { state, dispatch } = useGame()
  const { currentUser, players, voiceBalance, bonusBalance, inventory, rosesGiven, courtshipProfileAllowed, allowChatInvite, gameLog } = state

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

  const isVip = !!players.find((p) => p.id === currentUser.id)?.isVip
  const initialName = useMemo(() => currentUser.name ?? "", [currentUser.name])
  const [name, setName] = useState(initialName)
  const [avatarInput, setAvatarInput] = useState(currentUser.avatar ?? "")
  const [showGiveRoseModal, setShowGiveRoseModal] = useState(false)
  const nameTrimmed = name.trim()
  const canSaveName = nameTrimmed.length >= 2 && nameTrimmed.length <= 16 && nameTrimmed !== currentUser.name
  const canChangeAvatar = currentUser.authProvider === "login" && avatarInput.trim().length > 0 && avatarInput !== currentUser.avatar

  useEffect(() => {
    setName(initialName)
  }, [initialName])

  const handleSaveName = () => {
    if (!canSaveName) return
    dispatch({ type: "UPDATE_USER_NAME", playerId: currentUser.id, name: nameTrimmed })
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col items-center overflow-y-auto px-4 py-6 sm:py-8 pb-[max(2rem,env(safe-area-inset-bottom))] game-bg-animated">
      <div className="w-full max-w-lg min-h-0 flex-shrink-0 space-y-4 rounded-2xl border border-slate-800 bg-[rgba(2,6,23,0.85)] px-4 sm:px-6 py-5 sm:py-7 shadow-[0_24px_50px_rgba(0,0,0,0.75)]">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-full border border-slate-700">
            <img src={currentUser.avatar} alt={currentUser.name} className="h-full w-full object-cover" />
            {isVip && (
              <div
                className="absolute flex items-center justify-center rounded-full"
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

          <div className="flex flex-col">
            <div className="text-[15px] font-semibold text-slate-400">{"Имя"}</div>
            <div className="mt-1 flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={16}
                className="h-9 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-[15px] font-semibold text-slate-50 outline-none"
                placeholder="Введите имя"
              />
              <Button
                size="sm"
                onClick={handleSaveName}
                disabled={!canSaveName}
                className="h-9 rounded-xl px-3 text-[15px] font-semibold disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,#38bdf8,#a78bfa)",
                  color: "#0b1220",
                  border: "1px solid rgba(148,163,184,0.35)",
                }}
              >
                {"Сохранить"}
              </Button>
            </div>
            <div className="text-[15px] text-slate-300">
              {currentUser.age} {"лет"} {"•"} {genderLabel(currentUser.gender)}
            </div>

            {currentUser.authProvider === "login" && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[15px] font-semibold text-slate-400">{"Фото профиля"}</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={avatarInput}
                    onChange={(e) => setAvatarInput(e.target.value)}
                    placeholder="Вставьте URL картинки"
                    className="h-8 flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-[15px] text-slate-50 outline-none"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!canChangeAvatar) return
                      dispatch({ type: "UPDATE_USER_AVATAR", playerId: currentUser.id, avatar: avatarInput.trim() })
                    }}
                    disabled={!canChangeAvatar}
                    className="h-8 rounded-xl px-3 text-[15px] font-semibold disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg,#38bdf8,#a78bfa)",
                      color: "#0b1220",
                      border: "1px solid rgba(148,163,184,0.35)",
                    }}
                  >
                    {"Обновить"}
                  </Button>
                </div>
                <p className="text-[15px] text-slate-500">
                  {"Временно аватарка берётся по URL. Позже это будет сохраняться на нашем сервере."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Достижения */}
        <div
          className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3"
        >
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-[15px] font-semibold text-slate-100">Достижения</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[15px]">
              <span style={{ color: heartbreakerCount >= 100 ? "#f97373" : "#e2e8f0" }}>
                Сердцеед
              </span>
              <span className="text-slate-400">
                {Math.min(heartbreakerCount, 100)}/100
              </span>
            </div>
            <div className="flex items-center justify-between text-[15px]">
              <span style={{ color: giftSpent >= 1000 ? "#facc15" : "#e2e8f0" }}>
                Щедрый
              </span>
              <span className="text-slate-400">
                {Math.min(giftSpent, 1000)}/1000
              </span>
            </div>
            <div className="flex items-center justify-between text-[15px]">
              <span style={{ color: spinCount >= 50 ? "#4ade80" : "#e2e8f0" }}>
                Душа компании
              </span>
              <span className="text-slate-400">
                {Math.min(spinCount, 50)}/50
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="text-[15px] font-semibold text-slate-400">{"Баланс сердец"}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[15px]" style={{ color: "#f97316" }}>{"❤"}</span>
              <span className="text-[15px] font-bold text-slate-100">{voiceBalance}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="text-[15px] font-semibold text-slate-400">{"Бонусы"}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[15px]" style={{ color: "#2ecc71" }}>{"🏆"}</span>
              <span className="text-[15px] font-bold text-slate-100">{bonusBalance}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="text-[15px] font-semibold text-slate-400">{"Баланс роз"}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[15px]">{"🌹"}</span>
              <span className="text-[15px] font-bold text-slate-100">{rosesBalance}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
          <div>
            <div className="text-[15px] font-semibold text-slate-400">{"Получено роз"}</div>
            <div className="text-[15px] font-bold text-slate-100">{rosesReceived}</div>
          </div>
          <Button
            size="sm"
            className="rounded-xl text-[15px] font-semibold shrink-0"
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
            <span className="text-[15px] font-semibold text-rose-200">{"Настоящие чувства"}</span>
            <span className="text-[13px] text-slate-400">— подарили 10 роз одному игроку</span>
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
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
            className="h-4 w-4 rounded border-slate-600 accent-amber-500"
          />
          <span className="text-[15px] font-medium text-slate-100">
            {"Разрешаю ухаживание"}
          </span>
        </label>
        <p className="text-[15px] text-slate-400 -mt-2">
          {courtshipProfileAllowed?.[currentUser.id] !== false
            ? "Кто нажал «Ухаживание» — увидит ссылку на ваш профиль ВК."
            : "Кто нажал «Ухаживание» — сможет написать вам личное сообщение в игре."}
        </p>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
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
            className="h-4 w-4 rounded border-slate-600 accent-amber-500"
          />
          <span className="text-[15px] font-medium text-slate-100">
            {"Общение"}
          </span>
        </label>
        <p className="text-[15px] text-slate-400 -mt-2">
          {allowChatInvite?.[currentUser.id] === true
            ? "У вас включена кнопка «Пригласить общаться» — другие могут пригласить вас в личный чат."
            : "Включите, чтобы другие могли нажать «Пригласить общаться» и написать вам в личный чат."}
        </p>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="outline"
            className="w-full rounded-xl text-[15px]"
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "game" })}
          >
            {"Назад к столу"}
          </Button>
        </div>
      </div>

      {showGiveRoseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowGiveRoseModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-[15px] font-bold text-slate-100">Подарить розу (50 ❤)</h3>
            <p className="mb-3 text-[13px] text-slate-400">Повышает рейтинг симпатии. За 10 роз одному игроку — ачивка «Настоящие чувства».</p>
            <ul className="max-h-48 overflow-y-auto space-y-1">
              {players
                .filter((p) => p.id !== currentUser.id)
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-800/80 px-3 py-2">
                    <span className="text-[15px] text-slate-100 truncate">{p.name}</span>
                    <Button
                      size="sm"
                      className="rounded-lg text-[13px] font-semibold shrink-0 disabled:opacity-50"
                      style={{
                        background: voiceBalance >= 50 ? "linear-gradient(180deg, #e11d48 0%, #be123c 100%)" : undefined,
                        color: "#fff",
                      }}
                      variant={voiceBalance >= 50 ? "default" : "outline"}
                      disabled={voiceBalance < 50}
                      onClick={() => {
                        if (voiceBalance < 50) return
                        dispatch({ type: "GIVE_ROSE", fromPlayerId: currentUser.id, toPlayerId: p.id })
                        setShowGiveRoseModal(false)
                      }}
                    >
                      Подарить
                    </Button>
                  </li>
                ))}
            </ul>
            <Button
              variant="outline"
              className="mt-3 w-full rounded-xl text-[15px]"
              onClick={() => setShowGiveRoseModal(false)}
            >
              Закрыть
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={() => dispatch({ type: "SET_SCREEN", screen: "registration" })}
        className="mt-4 text-[15px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
      >
        {"Выйти из профиля"}
      </button>
    </div>
  )
}

