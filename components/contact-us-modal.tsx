"use client"

import { useCallback, type ReactNode } from "react"
import {
  AlertTriangle,
  ClipboardList,
  HelpCircle,
  Mail,
  Shield,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { buildContactMailto } from "@/lib/contact-links"
import { reportGameClientError } from "@/lib/report-game-client-error"
import { cn } from "@/lib/utils"
import type { InlineToastType } from "@/hooks/use-inline-toast"

type ContactUsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNotify?: (message: string, type?: InlineToastType) => void
  /** Доп. поля в JSON при «Сообщить об ошибке». */
  diagnosticsExtra?: Record<string, unknown>
}

type RowProps = {
  icon: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
}

function ContactRow({ icon, label, onClick, disabled }: RowProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-left text-[15px] font-medium text-slate-900 transition last:border-b-0",
        disabled
          ? "cursor-not-allowed opacity-45"
          : "hover:bg-slate-50 active:bg-slate-100/80",
      )}
      onClick={disabled ? undefined : onClick}
    >
      {icon}
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  )
}

export function ContactUsModal({ open, onOpenChange, onNotify, diagnosticsExtra }: ContactUsModalProps) {
  const playerId =
    typeof diagnosticsExtra?.currentUserId === "number" ? diagnosticsExtra.currentUserId : undefined

  const handleDiagnostics = useCallback(async () => {
    const payload: Record<string, unknown> = {
      t: new Date().toISOString(),
      href: typeof window !== "undefined" ? window.location.href : "",
      ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      viewport:
        typeof window !== "undefined"
          ? { w: window.innerWidth, h: window.innerHeight }
          : undefined,
      ...diagnosticsExtra,
    }
    const ok = await reportGameClientError({
      source: "manual_diagnostics",
      message: "Сообщить об ошибке (ручной отчёт)",
      payload,
    })
    if (ok) {
      onNotify?.("Отчёт отправлен", "success")
      onOpenChange(false)
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      } catch {
        /* буфер опционален */
      }
      return
    }
    onNotify?.("Не удалось отправить отчёт. Проверьте сеть.", "error")
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      onNotify?.("Данные скопированы в буфер", "info")
    } catch {
      /* ignore */
    }
  }, [diagnosticsExtra, onNotify, onOpenChange])

  const openMail = useCallback(() => {
    window.location.href = buildContactMailto(playerId)
  }, [playerId])

  const iconBox = (className: string, node: React.ReactNode) => (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base shadow-sm ${className}`}
    >
      {node}
    </span>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/40 backdrop-blur-[2px]"
        className="max-w-[min(100vw-1.5rem,22rem)] gap-0 overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-0 text-slate-900 shadow-2xl sm:max-w-md"
      >
        <div className="relative px-1 pb-1 pt-3">
          <DialogClose
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-600 shadow-sm transition hover:bg-slate-50"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </DialogClose>
          <DialogHeader className="space-y-0 px-4 pb-2 pt-2 text-center">
            <DialogTitle className="text-[17px] font-bold tracking-tight text-slate-400">
              Связаться с нами
            </DialogTitle>
          </DialogHeader>

          <nav className="mx-1 mb-1 overflow-hidden rounded-2xl border border-slate-100 bg-white" aria-label="Способы связи">
            <ContactRow
              icon={iconBox(
                "bg-gradient-to-br from-orange-100 to-amber-100 text-orange-600",
                <Mail className="h-5 w-5" strokeWidth={2.25} aria-hidden />,
              )}
              label="Написать письмо"
              onClick={openMail}
            />
            <ContactRow
              icon={iconBox(
                "bg-gradient-to-br from-amber-100 to-yellow-50 text-amber-700",
                <HelpCircle className="h-5 w-5" strokeWidth={2.25} aria-hidden />,
              )}
              label="Вопросы и ответы"
              disabled
            />
            <ContactRow
              icon={iconBox(
                "bg-gradient-to-br from-sky-100 to-blue-100 text-blue-700",
                <Shield className="h-5 w-5" strokeWidth={2.25} aria-hidden />,
              )}
              label="Политика конфиденциальности"
              disabled
            />
            <ContactRow
              icon={iconBox(
                "bg-gradient-to-br from-amber-50 to-stone-100 text-amber-900",
                <ClipboardList className="h-5 w-5" strokeWidth={2.25} aria-hidden />,
              )}
              label="Инструкция игры"
              disabled
            />
            <ContactRow
              icon={iconBox(
                "bg-gradient-to-br from-red-100 to-rose-50 text-red-600",
                <AlertTriangle className="h-5 w-5" strokeWidth={2.25} aria-hidden />,
              )}
              label="Сообщить об ошибке"
              onClick={() => void handleDiagnostics()}
            />
          </nav>
        </div>
      </DialogContent>
    </Dialog>
  )
}
