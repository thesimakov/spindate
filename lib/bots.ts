import type { Gender, Player } from "@/lib/game-types"

const FEMALE_NAMES: string[] = [
  "Алина", "Вероника", "Ксения", "Светлана", "Дарья",
  "Айгуль", "Асел", "Нурия", "Мадина", "Гульнара",
  "Мехринисо", "Зульфия", "Фотима", "Шахноза", "Нилуфар",
  "Дильноза", "Севара", "Нодира", "Шахзода", "Лола",
  "Екатерина", "Анна", "Мария", "Ольга", "Виктория",
]

const MALE_NAMES: string[] = [
  "Андрей", "Денис", "Илья", "Максим", "Владислав",
  "Айбек", "Нурсултан", "Эркин", "Бахтияр", "Темир",
  "Фаррух", "Далер", "Бехруз", "Шерзод", "Хуршед",
  "Жахонгир", "Сардор", "Азиз", "Рустам", "Тимур",
  "Алексей", "Сергей", "Дмитрий", "Роман", "Иван",
]

const CITIES = ["Москва", "Санкт-Петербург", "Минск", "Алматы", "Ташкент", "Бишкек", "Новосибирск", "Екатеринбург", "Казань", "Нижний Новгород"]
const INTERESTS = ["Путешествия, музыка", "Книги, кино", "Спорт, природа", "Фотография, искусство", "Кулинария, вино", "Танцы, театр", "Наука, технологии", "Йога, медитация"]
const ZODIAC_SIGNS = ["Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева", "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"]

export const AVATAR_FRAME_IDS = ["none", "gold", "silver", "hearts", "roses", "gradient", "neon", "snow", "rabbit", "fairy", "fox", "mag", "malif", "mir", "vesna"] as const

export function randomAvatarFrame(): (typeof AVATAR_FRAME_IDS)[number] {
  return AVATAR_FRAME_IDS[Math.floor(Math.random() * AVATAR_FRAME_IDS.length)]
}

export function generateBots(count: number, _userGender: Gender): Player[] {
  const bots: Player[] = []
  for (let i = 0; i < count; i++) {
    const isFemale = i % 2 === 0
    const nameList = isFemale ? FEMALE_NAMES : MALE_NAMES
    const avatarIndex = (100 + i) % 100
    const avatarUrl = isFemale
      ? `https://randomuser.me/api/portraits/women/${avatarIndex}.jpg`
      : `https://randomuser.me/api/portraits/men/${avatarIndex}.jpg`

    bots.push({
      id: 1000 + i,
      name: nameList[i % nameList.length],
      avatar: avatarUrl,
      gender: isFemale ? "female" : "male",
      age: 25 + Math.floor(Math.random() * 20),
      purpose: (["relationships", "communication", "love"] as const)[Math.floor(Math.random() * 3)],
      lookingFor: Math.random() < 0.75 ? (isFemale ? "male" : "female") : (isFemale ? "female" : "male"),
      isBot: true,
      online: Math.random() > 0.3,
      isVip: Math.random() < 0.2,
      city: CITIES[i % CITIES.length],
      interests: INTERESTS[i % INTERESTS.length],
      zodiac: ZODIAC_SIGNS[i % ZODIAC_SIGNS.length],
    })
  }
  return bots
}
