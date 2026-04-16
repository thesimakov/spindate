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
  title?: string
}

export function TableChatEmojiPicker({ disabled, onEmojiSelect, className, title }: TableChatEmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const tooltipText = title?.trim() || "Смайлики"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all hover:brightness-110 disabled:opacity-40",
                className,
              )}
              style={{
                background: "linear-gradient(180deg, rgba(56,189,248,0.22) 0%, rgba(14,165,233,0.16) 100%)",
                border: "1px solid rgba(56,189,248,0.4)",
                boxShadow: "0 1px 0 rgba(15,23,42,0.5)",
              }}
              aria-label="Смайлики"
              aria-expanded={open}
              title={tooltipText}
            >
              <Smile className="h-4 w-4" style={{ color: "#bae6fd" }} strokeWidth={2} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" sideOffset={8}>
          <p className="text-xs">{tooltipText}</p>
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
