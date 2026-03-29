"use client"

import React from "react"
import { Heart } from "lucide-react"
import type { PairAction, PairGenderCombo } from "@/lib/game-types"
import { cn } from "@/lib/utils"

const MOBILE_EMOTION_STRIP_SCROLL =
  "flex w-full max-w-full items-center justify-center gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain py-0.5 [-webkit-overflow-scrolling:touch]"
const MOBILE_EMOTION_STRIP_BTN =
  "flex h-8 shrink-0 flex-row items-center gap-1 rounded-full px-2 py-0 pr-2.5 text-left text-[10px] font-bold leading-none transition-[transform,filter] hover:brightness-105 active:scale-[0.98] disabled:opacity-40"

const ACTION_BUTTON_STYLES: Record<string, { bg: string; border: string; shadow: string; text: string }> = {
  kiss:      { bg: "linear-gradient(180deg, #e74c3c 0%, #c0392b 100%)", border: "#a93226", shadow: "#7b241c", text: "#ffffff" },
  flowers:   { bg: "linear-gradient(180deg, #ffb347 0%, #ff7e00 100%)", border: "#e67e22", shadow: "#a04000", text: "#111827" },
  diamond:   { bg: "linear-gradient(180deg, #78d6ff 0%, #1ea5ff 100%)", border: "#0a6bd1", shadow: "#063f7a", text: "#0b1120" },
  beer:      { bg: "linear-gradient(180deg, #f39c12 0%, #e67e22 100%)", border: "#d35400", shadow: "#a04000", text: "#111827" },
  banya:     { bg: "linear-gradient(180deg, #34d399 0%, #16a34a 100%)", border: "#166534", shadow: "#0f3d22", text: "#052e16" },
  tools:     { bg: "linear-gradient(180deg, #bdc3c7 0%, #7f8c8d 100%)", border: "#4e5c5f", shadow: "#2c3e50", text: "#111827" },
  gift_voice:{ bg: "linear-gradient(180deg, #f1c40f 0%, #f39c12 100%)", border: "#d68910", shadow: "#9a6408", text: "#111827" },
  lipstick:  { bg: "linear-gradient(180deg, #ff6b81 0%, #c0392b 100%)", border: "#a93226", shadow: "#7b241c", text: "#ffffff" },
  chat:      { bg: "linear-gradient(180deg, #9b59b6 0%, #8e44ad 100%)", border: "#7d3c98", shadow: "#5b2c6f", text: "#f9fafb" },
  cocktail:  { bg: "linear-gradient(180deg, #f39c12 0%, #e67e22 100%)", border: "#d35400", shadow: "#a04000", text: "#111827" },
  song:      { bg: "linear-gradient(180deg, #5dade2 0%, #2e86c1 100%)", border: "#21618c", shadow: "#154360", text: "#f9fafb" },
  rose:      { bg: "linear-gradient(180deg, #ff5a7a 0%, #c2185b 100%)", border: "#880e4f", shadow: "#4a0a2a", text: "#ffffff" },
  hug:       { bg: "linear-gradient(180deg, #2ecc71 0%, #27ae60 100%)", border: "#1e8449", shadow: "#145a32", text: "#ecfdf5" },
  selfie:    { bg: "linear-gradient(180deg, #95a5a6 0%, #7f8c8d 100%)", border: "#566573", shadow: "#2c3e50", text: "#111827" },
  skip:      { bg: "linear-gradient(180deg, #7f8c8d 0%, #636e72 100%)", border: "#535c5e", shadow: "#3d4648", text: "#f9fafb" },
}

function shouldShowActionCostBadge(actionId: string, actionCost: number): boolean {
  if (actionId === "kiss" || actionId === "beer" || actionId === "cocktail") return false
  return actionCost > 0
}

interface EmotionPanelProps {
  isPcLayout: boolean
  showMobileEmotionStrip: boolean
  isEmotionLimitReached: boolean
  isMyTurn: boolean
  canRespondInResult: boolean
  voiceBalance: number
  quotaCost: number
  quotaAmount: number
  sidebarGiftMode: boolean
  sidebarTargetPlayer: { id: number; name: string } | null
  sidebarActions: PairAction[]
  availableActions: PairAction[]
  currentPairCombo: PairGenderCombo | null
  effectiveSidebarCombo: PairGenderCombo | null
  getEffectiveActionCost: (actionId: string, combo: PairGenderCombo | null) => number
  renderActionIcon: (action: PairAction) => React.ReactNode
  onPurchaseQuota: () => void
  onPerformAction: (actionId: string) => void
  onResponseEmotion: (actionId: string) => void
  onGiftEmotion: (actionId: string) => void
}

function EmotionPanelInner({
  isPcLayout,
  showMobileEmotionStrip,
  isEmotionLimitReached,
  isMyTurn,
  canRespondInResult,
  voiceBalance,
  quotaCost,
  quotaAmount,
  sidebarGiftMode,
  sidebarTargetPlayer,
  sidebarActions,
  availableActions,
  currentPairCombo,
  effectiveSidebarCombo,
  getEffectiveActionCost,
  renderActionIcon,
  onPurchaseQuota,
  onPerformAction,
  onResponseEmotion,
  onGiftEmotion,
}: EmotionPanelProps) {
  if (isPcLayout) return null

  return (
    <div
      className={cn(
        "h-[70px] w-full shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden px-0.5",
        "flex md:hidden",
      )}
    >
      {showMobileEmotionStrip && (
        <div className="relative z-[36] flex w-full max-w-full min-h-0 flex-col items-center justify-center gap-0.5">
          {isEmotionLimitReached && (
            <button
              type="button"
              onClick={onPurchaseQuota}
              className="flex h-6 w-full max-w-[min(100%,20rem)] shrink-0 items-center justify-center gap-1 rounded-md px-2 text-[9px] font-bold leading-none transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
              disabled={voiceBalance < quotaCost}
              style={{
                background: "linear-gradient(180deg, #22d3ee 0%, #6366f1 100%)",
                color: "#0f172a",
                border: "1px solid rgba(103, 232, 249, 0.85)",
                boxShadow: "0 1px 0 rgba(30, 64, 175, 0.85)",
              }}
            >
              {`Купить (+${quotaAmount})`}
            </button>
          )}

          {sidebarGiftMode && sidebarTargetPlayer ? (
            <ActionStrip
              actions={sidebarActions.filter((a) => a.id !== "skip")}
              combo={effectiveSidebarCombo}
              getEffectiveActionCost={getEffectiveActionCost}
              renderActionIcon={renderActionIcon}
              onAction={onGiftEmotion}
              alwaysEnabled
            />
          ) : isMyTurn ? (
            <ActionStrip
              actions={availableActions.filter((a) => a.id !== "skip")}
              combo={currentPairCombo}
              voiceBalance={voiceBalance}
              getEffectiveActionCost={getEffectiveActionCost}
              renderActionIcon={renderActionIcon}
              onAction={onPerformAction}
            />
          ) : canRespondInResult ? (
            <ActionStrip
              actions={availableActions.filter((a) => a.id !== "skip")}
              combo={currentPairCombo}
              voiceBalance={voiceBalance}
              getEffectiveActionCost={getEffectiveActionCost}
              renderActionIcon={renderActionIcon}
              onAction={onResponseEmotion}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}

interface ActionStripProps {
  actions: PairAction[]
  combo: PairGenderCombo | null
  voiceBalance?: number
  alwaysEnabled?: boolean
  getEffectiveActionCost: (id: string, combo: PairGenderCombo | null) => number
  renderActionIcon: (action: PairAction) => React.ReactNode
  onAction: (id: string) => void
}

function ActionStrip({ actions, combo, voiceBalance = Infinity, alwaysEnabled, getEffectiveActionCost, renderActionIcon, onAction }: ActionStripProps) {
  return (
    <div className={MOBILE_EMOTION_STRIP_SCROLL}>
      {actions.map((action) => {
        const style = ACTION_BUTTON_STYLES[action.id] || ACTION_BUTTON_STYLES.skip
        const actionCost = getEffectiveActionCost(action.id, combo)
        const canAfford = alwaysEnabled || actionCost === 0 || voiceBalance >= actionCost
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.id)}
            disabled={!canAfford}
            className={MOBILE_EMOTION_STRIP_BTN}
            style={{
              background: style.bg,
              color: style.text,
              border: `1px solid ${style.border}`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 0 ${style.shadow}`,
            }}
          >
            <span className="flex shrink-0 items-center justify-center text-sm [&>svg]:h-3.5 [&>svg]:w-3.5">
              {renderActionIcon(action)}
            </span>
            <span className="min-w-0 max-w-[5.75rem] truncate">{action.label}</span>
            {shouldShowActionCostBadge(action.id, actionCost) && (
              <span
                className="heart-price heart-price--badge flex shrink-0 items-center rounded-full px-1 py-px opacity-95"
                style={{ background: "rgba(0,0,0,0.18)", color: style.text }}
              >
                {actionCost}
                <Heart className="heart-price__icon h-2.5 w-2.5" fill="currentColor" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export const EmotionPanel = React.memo(EmotionPanelInner)
