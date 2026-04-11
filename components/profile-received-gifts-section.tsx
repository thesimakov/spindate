"use client"

import { useMemo, useId } from "react"
import { Gift } from "lucide-react"
import type { GiftCatalogRow } from "@/lib/gift-catalog"
import { DEFAULT_GIFT_CATALOG_ROWS } from "@/lib/gift-catalog"
import { aggregateReceivedGiftsByType, buildReceivedGiftsRows } from "@/lib/profile-received-gifts"
import type { InventoryItem } from "@/lib/game-types"

export const PROFILE_RECEIVED_GIFTS_SECTION_CARD_CLASS =
  "rounded-3xl border border-slate-200/85 bg-gradient-to-b from-white to-slate-50 px-4 py-4 shadow-[0_10px_26px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.85)]"

type RosesGivenEntry = { fromPlayerId: number; toPlayerId: number; timestamp: number }

export type ProfileReceivedGiftsSectionProps = {
  targetUserId: number
  inventory: InventoryItem[]
  rosesGiven: RosesGivenEntry[] | undefined
  catalogRows: readonly GiftCatalogRow[]
  perspective: "self" | "other"
  /** Обёртка секции: по умолчанию карточка как во вкладке профиля; в меню игрока — например `mt-4 border-t border-slate-200 pt-3` */
  className?: string
  /** Без блока с иконкой и подзаголовком — только список или пустое состояние (например в модалке со своим заголовком) */
  hideIntro?: boolean
}

export function ProfileReceivedGiftsSection({
  targetUserId,
  inventory,
  rosesGiven,
  catalogRows,
  perspective,
  className = PROFILE_RECEIVED_GIFTS_SECTION_CARD_CLASS,
  hideIntro = false,
}: ProfileReceivedGiftsSectionProps) {
  const baseId = useId()
  const headingId = `${baseId}-gifts-heading`

  const rows = useMemo(() => {
    const catalogSource = catalogRows.length > 0 ? catalogRows : DEFAULT_GIFT_CATALOG_ROWS
    const counts = aggregateReceivedGiftsByType({
      inventory,
      rosesGiven,
      userId: targetUserId,
    })
    return buildReceivedGiftsRows(counts, catalogSource)
  }, [inventory, rosesGiven, targetUserId, catalogRows])

  const emptyText =
    perspective === "self"
      ? "Пока никто не дарил вам подарки за столом."
      : "Пока никто не дарил этому игроку подарки за столом."

  return (
    <section className={className} aria-labelledby={hideIntro ? undefined : headingId}>
      {!hideIntro && (
        <div className="mb-4 flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-100 to-pink-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]"
            aria-hidden
          >
            <Gift className="h-5 w-5 text-rose-800" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="text-lg font-black tracking-tight text-slate-900">
              Подарки
            </h2>
            <p className="mt-1 text-[15px] font-medium leading-snug text-slate-700">
              Подарки от других игроков за столом. Одинаковые подарки суммируются.
            </p>
          </div>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="text-[15px] font-medium leading-relaxed text-slate-600">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.type}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100">
                {row.imgSrc ? (
                  <img src={row.imgSrc} alt="" className="h-full w-full object-contain p-0.5" />
                ) : (
                  <span className="text-2xl leading-none" aria-hidden>
                    {row.emoji}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-black text-slate-900">{row.label}</p>
              </div>
              <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[15px] font-black tabular-nums text-slate-800">
                {row.count > 1 ? `×${row.count}` : "×1"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
