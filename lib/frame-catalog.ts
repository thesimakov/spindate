export type FrameCatalogId =
  | "none"
  | "gold"
  | "silver"
  | "hearts"
  | "roses"
  | "gradient"
  | "neon"
  | "snow"
  | "rabbit"
  | "fairy"
  | "fox"
  | "mag"
  | "malif"
  | "mir"
  | "vesna"

export type FrameCatalogSection = "free" | "premium"

export type FrameCatalogRow = {
  id: FrameCatalogId
  section: FrameCatalogSection
  name: string
  border: string
  shadow: string
  animationClass?: string
  svgPath?: string
  cost: number
  published: boolean
  deleted?: boolean
}

export const DEFAULT_FRAME_CATALOG_ROWS: FrameCatalogRow[] = [
  {
    id: "none",
    section: "free",
    name: "Без рамки",
    border: "2px solid #475569",
    shadow: "none",
    animationClass: "",
    svgPath: "",
    cost: 0,
    published: true,
  },
  {
    id: "gold",
    section: "free",
    name: "Золото",
    border: "3px solid #e8c06a",
    shadow: "0 0 10px rgba(232,192,106,0.8)",
    animationClass: "frame-preview-anim-gold",
    svgPath: "",
    cost: 0,
    published: true,
  },
  {
    id: "silver",
    section: "free",
    name: "Серебро",
    border: "3px solid #c0c0c0",
    shadow: "0 0 10px rgba(192,192,192,0.7)",
    animationClass: "frame-preview-anim-silver",
    svgPath: "",
    cost: 0,
    published: true,
  },
  {
    id: "hearts",
    section: "free",
    name: "Сердечки",
    border: "3px solid #e74c3c",
    shadow: "0 0 12px rgba(231,76,60,0.7)",
    animationClass: "frame-preview-anim-hearts",
    svgPath: "",
    cost: 0,
    published: true,
  },
  {
    id: "roses",
    section: "free",
    name: "Розы",
    border: "3px solid #be123c",
    shadow: "0 0 12px rgba(190,18,60,0.6)",
    animationClass: "frame-preview-anim-roses",
    svgPath: "",
    cost: 0,
    published: true,
  },
  {
    id: "gradient",
    section: "free",
    name: "Градиент",
    border: "3px solid #8b5cf6",
    shadow: "0 0 14px rgba(139,92,246,0.6)",
    animationClass: "frame-preview-anim-gradient",
    svgPath: "",
    cost: 0,
    published: true,
  },
  {
    id: "neon",
    section: "free",
    name: "Неон",
    border: "3px solid rgba(0, 255, 255, 0.95)",
    shadow: "none",
    animationClass: "frame-preview-anim-neon",
    svgPath: "",
    cost: 0,
    published: true,
  },
  {
    id: "snow",
    section: "free",
    name: "Снежная",
    border: "3px solid rgba(186, 230, 253, 0.95)",
    shadow: "0 0 12px rgba(186, 230, 253, 0.5)",
    animationClass: "frame-preview-anim-snow",
    svgPath: "",
    cost: 0,
    published: true,
  },
  {
    id: "fox",
    section: "premium",
    name: "Лиса",
    border: "2px solid transparent",
    shadow: "none",
    animationClass: "",
    svgPath: "ram-lis.svg",
    cost: 5,
    published: true,
  },
  {
    id: "rabbit",
    section: "premium",
    name: "Кролик",
    border: "2px solid transparent",
    shadow: "none",
    animationClass: "",
    svgPath: "ram-rabbit.svg",
    cost: 5,
    published: true,
  },
  {
    id: "fairy",
    section: "premium",
    name: "Фея",
    border: "2px solid transparent",
    shadow: "none",
    animationClass: "",
    svgPath: "ram-fea.svg",
    cost: 5,
    published: true,
  },
  {
    id: "mag",
    section: "premium",
    name: "Маг сердца",
    border: "2px solid transparent",
    shadow: "none",
    animationClass: "",
    svgPath: "ram-mag.svg",
    cost: 5,
    published: true,
  },
  {
    id: "malif",
    section: "premium",
    name: "Милифисента",
    border: "2px solid transparent",
    shadow: "none",
    animationClass: "",
    svgPath: "ram-malif.svg",
    cost: 5,
    published: true,
  },
  {
    id: "mir",
    section: "premium",
    name: "Миру мир",
    border: "2px solid transparent",
    shadow: "none",
    animationClass: "",
    svgPath: "ram-mir.svg",
    cost: 5,
    published: true,
  },
  {
    id: "vesna",
    section: "premium",
    name: "Весна",
    border: "2px solid transparent",
    shadow: "none",
    animationClass: "",
    svgPath: "ram-vesna.svg",
    cost: 5,
    published: true,
  },
]

export function isFrameCatalogId(value: string): value is FrameCatalogId {
  return typeof value === "string" && value.trim().length > 0
}

export function normalizeFrameCatalogRows(
  rows: unknown,
  options?: { onlyPublished?: boolean; includeDeleted?: boolean },
): FrameCatalogRow[] {
  if (!Array.isArray(rows)) {
    return options?.onlyPublished
      ? DEFAULT_FRAME_CATALOG_ROWS.filter((row) => row.published && !row.deleted)
      : DEFAULT_FRAME_CATALOG_ROWS
  }
  const out: FrameCatalogRow[] = []
  for (const item of rows) {
    if (!item || typeof item !== "object") continue
    const rec = item as Partial<FrameCatalogRow> & { id?: string; section?: string }
    if (typeof rec.id !== "string" || !isFrameCatalogId(rec.id)) continue
    const normalized: FrameCatalogRow = {
      id: rec.id,
      section: rec.section === "free" ? "free" : "premium",
      name: typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : rec.id,
      border: typeof rec.border === "string" && rec.border.trim() ? rec.border.trim() : "2px solid #475569",
      shadow: typeof rec.shadow === "string" && rec.shadow.trim() ? rec.shadow.trim() : "none",
      animationClass: typeof rec.animationClass === "string" ? rec.animationClass.trim() : "",
      svgPath: typeof rec.svgPath === "string" ? rec.svgPath.trim() : "",
      cost: Math.max(0, Number.isFinite(Number(rec.cost)) ? Math.floor(Number(rec.cost)) : 0),
      published: rec.published !== false,
      deleted: rec.deleted === true,
    }
    if (!options?.includeDeleted && normalized.deleted) continue
    if (options?.onlyPublished && !normalized.published) continue
    out.push(normalized)
  }
  return out
}
