"use client"

import React from "react"
import {
  Heart,
  RotateCw,
  Star,
  Sparkles,
  User,
  Gift,
  MessageCircle,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { GameAction } from "@/lib/game-types"

interface SideMenuPanelProps {
  isPcLayout: boolean
  leftSideMenuExpanded: boolean
  setLeftSideMenuExpanded: React.Dispatch<React.SetStateAction<boolean>>
  voiceBalance: number
  tablesCount: number | undefined
  isMyTurn: boolean
  isSpinning: boolean
  showResult: boolean
  countdown: number | null
  cooldownLeftMs: number
  formatCooldown: (ms: number) => string
  currentUserId: number | undefined
  dispatch: (action: GameAction) => void
  onOpenBottleCatalog: () => void
  onChangeTable: () => void
  onExtraSpin: () => void
  onPause: () => void
  onOpenChatList: () => void
  emotionContent: React.ReactNode
}

function SideMenuPanelInner({
  isPcLayout,
  leftSideMenuExpanded,
  setLeftSideMenuExpanded,
  voiceBalance,
  tablesCount,
  isMyTurn,
  isSpinning,
  showResult,
  countdown,
  cooldownLeftMs,
  formatCooldown,
  currentUserId,
  dispatch,
  onOpenBottleCatalog,
  onChangeTable,
  onExtraSpin,
  onPause,
  onOpenChatList,
  emotionContent,
}: SideMenuPanelProps) {
  const sideBtnClass =
    "flex items-center gap-1.5 rounded-[999px] px-3 py-2 transition-all hover:brightness-110 hover:-translate-y-[1px] min-h-[40px]" +
    (!leftSideMenuExpanded
      ? " max-lg:min-h-[44px] max-lg:w-11 max-lg:min-w-[44px] max-lg:justify-center max-lg:rounded-full max-lg:px-2 max-lg:gap-0"
      : "")
  const sideBtnTextClass =
    "text-[13px] font-semibold leading-none" + (!leftSideMenuExpanded ? " max-lg:hidden" : "")

  const darkBtnStyle = {
    background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
    border: "1px solid rgba(56,189,248,0.28)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
  }

  return (
    <div
      className={cn(
        "relative z-20 shrink-0 flex-none flex-col gap-1.5 overflow-y-auto max-h-app p-2 pt-20 lg:pt-24 transition-[width] duration-200 ease-out",
        isPcLayout ? "flex" : "hidden md:flex",
        leftSideMenuExpanded ? "w-[190px]" : "w-14 lg:w-[190px]",
      )}
    >
      <div className="mb-1 flex shrink-0 items-center justify-center lg:hidden">
        <button
          type="button"
          onClick={() => setLeftSideMenuExpanded((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full border transition-colors hover:bg-slate-700/50"
          style={{ borderColor: "rgba(71, 85, 105, 0.8)", background: "rgba(15, 23, 42, 0.85)" }}
          aria-expanded={leftSideMenuExpanded}
          aria-label={leftSideMenuExpanded ? "Свернуть боковое меню" : "Развернуть боковое меню"}
        >
          {leftSideMenuExpanded ? (
            <ChevronLeft className="h-5 w-5" style={{ color: "#e8c06a" }} />
          ) : (
            <ChevronRight className="h-5 w-5" style={{ color: "#e8c06a" }} />
          )}
        </button>
      </div>

      <div className={!leftSideMenuExpanded ? "max-lg:hidden" : ""}>
        {emotionContent}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        {!isMyTurn && !isSpinning && !showResult && countdown === null && (
          <div className={isPcLayout ? "hidden" : "md:hidden"}>
            <button
              onClick={onExtraSpin}
              disabled={voiceBalance < 10}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
              style={{
                background: "linear-gradient(180deg, #9b59b6 0%, #8e44ad 100%)",
                color: "#fff",
                border: "2px solid #7d3c98",
                boxShadow: "0 2px 0 #5b2c6f",
              }}
            >
              <RotateCw className="h-3.5 w-3.5" />
              {"Крутить вне очереди (10)"}
            </button>
          </div>
        )}

        {/* Bank */}
        <div
          className={
            "flex w-full min-w-0 items-center gap-1.5 rounded-[999px] px-2 py-2 min-h-[40px] sm:px-3" +
            (!leftSideMenuExpanded ? " max-lg:justify-center max-lg:px-2 max-lg:gap-1" : "")
          }
          style={{
            background: "linear-gradient(135deg, rgba(15,23,42,0.9) 0%, rgba(10,20,40,0.92) 100%)",
            border: "1px solid rgba(56,189,248,0.28)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 20px rgba(2,6,23,0.45)",
          }}
        >
          <div className={"flex min-w-0 flex-1 items-center gap-1.5" + (!leftSideMenuExpanded ? " max-lg:justify-center max-lg:flex-none" : "")}>
            <Heart className="h-5 w-5 shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]" style={{ color: "#fde68a" }} fill="currentColor" />
            <span className="text-[15px] font-black tabular-nums leading-none shrink-0 sm:text-base" style={{ color: "#fff" }}>{voiceBalance}</span>
            <span className={"text-[11px] leading-none truncate " + (!leftSideMenuExpanded ? "max-lg:hidden" : "")} style={{ color: "#cbd5e1" }}>{"Ваш банк"}</span>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })}
            className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all hover:brightness-110 active:scale-95" + (!leftSideMenuExpanded ? " max-lg:flex" : "")}
            style={{
              border: "1px solid rgba(56,189,248,0.5)",
              color: "#7dd3fc",
              background: "linear-gradient(180deg, rgba(56,189,248,0.22) 0%, rgba(14,116,144,0.2) 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
            title="Пополнить банк"
            aria-label="Открыть магазин сердец"
          >
            <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden />
          </button>
        </div>

        <button onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "shop" })} className={sideBtnClass} style={{ background: "linear-gradient(135deg, #facc15 0%, #fb923c 100%)", border: "1px solid rgba(245, 158, 11, 0.8)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 10px 20px rgba(251,146,60,0.35)" }}>
          <Gift className="h-4 w-4" style={{ color: "#1f2937" }} />
          <span className={sideBtnTextClass} style={{ color: "#1f2937" }}>{"Магазин"}</span>
        </button>

        <button onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "profile" })} className={sideBtnClass} style={darkBtnStyle}>
          <User className="h-4 w-4" style={{ color: "#e8c06a" }} />
          <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Профиль"}</span>
        </button>

        <button type="button" onClick={onOpenBottleCatalog} title={cooldownLeftMs > 0 ? formatCooldown(cooldownLeftMs) : "Бутылочка"} className={sideBtnClass} style={darkBtnStyle}>
          <span className="text-base">{"🍾"}</span>
          <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Бутылочка"}</span>
          {cooldownLeftMs > 0 && (
            <span className={"ml-auto text-xs font-semibold " + (!leftSideMenuExpanded ? "max-lg:hidden" : "")} style={{ color: "#e8c06a" }}>{formatCooldown(cooldownLeftMs)}</span>
          )}
        </button>

        <button onClick={onChangeTable} className={sideBtnClass} style={darkBtnStyle}>
          <RotateCw className="h-4 w-4" style={{ color: "#e8c06a" }} />
          <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Сменить стол"}</span>
        </button>

        {currentUserId && (
          <button type="button" onClick={onPause} className={sideBtnClass} style={{ ...darkBtnStyle, border: "1px solid rgba(239,68,68,0.28)" }}>
            <span className="text-base" aria-hidden>{"⏸"}</span>
            <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Пауза"}</span>
          </button>
        )}

        <button onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "rating" })} className={sideBtnClass} style={darkBtnStyle}>
          <Trophy className="h-4 w-4" style={{ color: "#e8c06a" }} />
          <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Рейтинг"}</span>
        </button>

        <button onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "favorites" })} className={sideBtnClass} style={darkBtnStyle}>
          <Star className="h-4 w-4" style={{ color: "#e8c06a" }} />
          <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Избранное"}</span>
        </button>

        <div className="lg:hidden w-full">
          <button onClick={onOpenChatList} className={`${sideBtnClass} w-full justify-start`} style={darkBtnStyle}>
            <MessageCircle className="h-4 w-4 shrink-0" style={{ color: "#e8c06a" }} />
            <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Сообщения"}</span>
          </button>
        </div>

        {currentUserId && (
          <button onClick={() => dispatch({ type: "SET_GAME_SIDE_PANEL", panel: "daily" })} className={sideBtnClass} style={darkBtnStyle}>
            <Sparkles className="h-4 w-4" style={{ color: "#e8c06a" }} />
            <span className={sideBtnTextClass} style={{ color: "#f0e0c8" }}>{"Ежедневные задачи"}</span>
          </button>
        )}

        <div
          className={"flex items-center gap-1.5 rounded-[999px] px-3 py-2 min-h-[40px]" + (!leftSideMenuExpanded ? " max-lg:justify-center max-lg:px-2" : "")}
          style={{ background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(56,189,248,0.18)" }}
          title={!leftSideMenuExpanded ? `Столов в игре: ${tablesCount ?? "—"}` : undefined}
        >
          <RotateCw className="h-3 w-3 shrink-0" style={{ color: "#94a3b8" }} />
          <span className={"text-[11px] leading-none " + (!leftSideMenuExpanded ? "max-lg:hidden" : "")} style={{ color: "#94a3b8" }}>
            {"Столов в игре: "}{tablesCount ?? "—"}
          </span>
        </div>
      </div>
    </div>
  )
}

export const SideMenuPanel = React.memo(SideMenuPanelInner)
