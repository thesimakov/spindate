"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Smile } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Theme } from "emoji-picker-react"
import { cn } from "@/lib/utils"

const EmojiPicker = dynamic(() => import("emoji-picker-react").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-[380px] w-[300px] items-center justify-center text-xs text-slate-500">…</div>
  ),
})

type TableChatEmojiPickerProps = {
  disabled?: boolean
  onEmojiSelect: (emoji: string) => void
  className?: string
  /** Подпись тултипа (без нативного title на кнопке — только тут, чтобы не дублировать). */
  title?: string
  /** Если передан при «нет VIP»: тултип с текстом + кнопка «Стать VIP». */
  onBecomeVip?: () => void
}

export function TableChatEmojiPicker({
  disabled,
  onEmojiSelect,
  className,
  title,
  onBecomeVip,
}: TableChatEmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const tooltipText = title?.trim() || "Смайлики"
  const showVipUpsell = !!(disabled && onBecomeVip)

  const buttonStyles = {
    background: "linear-gradient(180deg, rgba(56,189,248,0.22) 0%, rgba(14,165,233,0.16) 100%)",
    border: "1px solid rgba(56,189,248,0.4)",
    boxShadow: "0 1px 0 rgba(15,23,42,0.5)",
  } as const

  const triggerInner = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all hover:brightness-110 disabled:opacity-40",
        disabled && "pointer-events-none",
        className,
      )}
      style={buttonStyles}
      aria-label="Смайлики"
      aria-expanded={disabled ? false : open}
    >
      <Smile className="h-4 w-4" style={{ color: "#bae6fd" }} strokeWidth={2} />
    </button>
  )

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={(next) => {
        if (!disabled) setOpen(next)
      }}
    >
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            {disabled ? (
              <span
                className="inline-flex cursor-default rounded-full outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/55"
                tabIndex={0}
                aria-label="Смайлики"
              >
                {triggerInner}
              </span>
            ) : (
              triggerInner
            )}
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          className={cn(
            "z-50 max-w-[min(92vw,280px)] text-balance",
            showVipUpsell && "pointer-events-auto flex flex-col items-stretch gap-2 px-3 py-2.5 text-left",
          )}
        >
          {showVipUpsell ? (
            <>
              <p className="text-xs leading-snug">{tooltipText}</p>
              <button
                type="button"
                className="rounded-md px-2 py-1.5 text-[11px] font-bold leading-none transition hover:brightness-110 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(180deg, rgba(251,191,36,0.95) 0%, rgba(245,158,11,0.88) 100%)",
                  border: "1px solid rgba(251,191,36,0.65)",
                  boxShadow: "0 1px 0 rgba(15,23,42,0.45)",
                  color: "#0f172a",
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onBecomeVip()
                }}
              >
                Стать VIP
              </button>
            </>
          ) : (
            <p className="text-xs">{tooltipText}</p>
          )}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        className="w-auto max-w-[min(100vw-24px,320px)] border border-slate-600/80 bg-slate-950/98 p-0 shadow-2xl"
        align="end"
        side="top"
        sideOffset={8}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <EmojiPicker
          theme={Theme.DARK}
          width={300}
          height={380}
          searchPlaceHolder="Поиск…"
          previewConfig={{ showPreview: false }}
          lazyLoadEmojis
          onEmojiClick={(emojiData) => {
            onEmojiSelect(emojiData.emoji)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
