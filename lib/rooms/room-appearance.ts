import type { BottleSkin, TableStyle } from "@/lib/game-types"

export type RoomTableStyle = TableStyle

export const DEFAULT_ROOM_BOTTLE_SKIN: BottleSkin = "classic"
export const DEFAULT_ROOM_TABLE_STYLE: RoomTableStyle = "classic_night"

export const ROOM_TABLE_STYLE_OPTIONS: Array<{ id: RoomTableStyle; name: string }> = [
  { id: "classic_night", name: "Классическая ночь" },
  { id: "sunset_lounge", name: "Закатный лаунж" },
  { id: "ocean_breeze", name: "Океанский бриз" },
  { id: "violet_dream", name: "Фиолетовый сон" },
]

const ROOM_BOTTLE_SKINS: BottleSkin[] = [
  "classic",
  "ruby",
  "neon",
  "frost",
  "baby",
  "vip",
  "milk",
  "frame_69",
  "frame_70",
  "frame_71",
  "frame_72",
  "frame_73",
  "frame_74",
  "frame_75",
  "frame_76",
  "frame_77",
  "frame_78",
  "frame_79",
  "frame_80",
  "fortune_wheel",
]

const ROOM_BOTTLE_SET = new Set<string>(ROOM_BOTTLE_SKINS)
const ROOM_TABLE_STYLE_SET = new Set<string>(ROOM_TABLE_STYLE_OPTIONS.map((s) => s.id))

/** id из админского каталога бутылочек (не только захардкоженный список). */
const CUSTOM_BOTTLE_SKIN_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i

export function normalizeRoomBottleSkin(value: unknown): BottleSkin {
  if (typeof value !== "string") return DEFAULT_ROOM_BOTTLE_SKIN
  const v = value.trim()
  if (!v) return DEFAULT_ROOM_BOTTLE_SKIN
  if (ROOM_BOTTLE_SET.has(v)) return v as BottleSkin
  if (CUSTOM_BOTTLE_SKIN_RE.test(v)) return v as BottleSkin
  return DEFAULT_ROOM_BOTTLE_SKIN
}

export function normalizeRoomTableStyle(value: unknown): RoomTableStyle {
  if (typeof value === "string" && ROOM_TABLE_STYLE_SET.has(value)) return value as RoomTableStyle
  return DEFAULT_ROOM_TABLE_STYLE
}
