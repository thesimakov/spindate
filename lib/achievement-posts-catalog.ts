export type AchievementCatalogEntry = {
  key: string
  title: string
  hint: string
  defaultStatus: string
  group: "base" | "events"
}

export const ACHIEVEMENT_POST_CATALOG: AchievementCatalogEntry[] = [
  { key: "base_heartbreaker", title: "Сердцеед", hint: "поцелуи в игре", defaultStatus: "Сердцеед", group: "base" },
  { key: "base_generous", title: "Щедрый", hint: "потрачено ❤ на подарки", defaultStatus: "Щедрый", group: "base" },
  { key: "base_soul", title: "Душа компании", hint: "раз крутили бутылочку", defaultStatus: "Душа компании", group: "base" },
  { key: "event_kvas_lover", title: "Любитель кваса", hint: "подарил на стол Закваску", defaultStatus: "Квас-гуру", group: "events" },
  { key: "event_zakvasochnik", title: "Заквасочник", hint: "подарил на стол квас", defaultStatus: "Заквасочник", group: "events" },
  { key: "event_master_ferment", title: "Мастер закваски", hint: "Квасить подряд 40 раз", defaultStatus: "Мастер закваски", group: "events" },
  { key: "event_table_soul", title: "Душа стола", hint: "Квасить подряд 20 раз", defaultStatus: "Душа стола", group: "events" },
  { key: "event_rest_lover", title: "Любитель отдыха", hint: "попарить 10 раз друга", defaultStatus: "Любитель отдыха", group: "events" },
  { key: "event_spender", title: "Транжира", hint: "подарить красотке 20 бриллиантов", defaultStatus: "Транжира", group: "events" },
  { key: "event_bonjour", title: "Бонжур", hint: "подарить на стол квас", defaultStatus: "Бонжур", group: "events" },
  { key: "event_fluffy", title: "Пушистость", hint: "получить 10 мягких игрушек", defaultStatus: "Пушистость", group: "events" },
  { key: "event_tea", title: "Чайная церемония", hint: "условие будет добавлено", defaultStatus: "Чайный мастер", group: "events" },
  { key: "event_party", title: "Утренник", hint: "подарить всем игрокам игрушки", defaultStatus: "Утренник", group: "events" },
  { key: "event_farmer", title: "Фермер", hint: "купить рамку и получить в подарок корову", defaultStatus: "Фермер", group: "events" },
  { key: "event_soul_company", title: "Душа компании", hint: "получить 100 квасов (для парня)", defaultStatus: "Душа компании", group: "events" },
  { key: "event_assistant", title: "Подручная", hint: "получить 100 заквасок (для девушек)", defaultStatus: "Подручная", group: "events" },
  { key: "event_gulyaka", title: "Гуляка", hint: "сменить 5 столов за 10 минут", defaultStatus: "Гуляка", group: "events" },
  { key: "event_8march", title: "8 марта", hint: "получить 100 цветов за час (для девушек)", defaultStatus: "8 марта", group: "events" },
  { key: "event_lonely", title: "Одиночка", hint: "не получить поцелуя в ответ", defaultStatus: "Одиночка", group: "events" },
  { key: "event_monk", title: "Монах", hint: "прожить в игре 30 дней подряд", defaultStatus: "Монах", group: "events" },
  { key: "event_prince", title: "Принц", hint: "поцеловать 50 раз девушку с рамкой принцесса", defaultStatus: "Принц", group: "events" },
  { key: "event_jeweler", title: "Ювелир", hint: "подарить 300 бриллиантов", defaultStatus: "Ювелир", group: "events" },
  { key: "event_male_friendship", title: "Мужская дружба", hint: "собрать 20 друзей мужиков", defaultStatus: "Мужская дружба", group: "events" },
  { key: "event_female_friendship", title: "Женская дружба", hint: "собрать 20 друзей женщин", defaultStatus: "Женская дружба", group: "events" },
  { key: "event_new_year", title: "Новый год", hint: "подарить новогодний стол", defaultStatus: "Новый год", group: "events" },
  { key: "event_pirate", title: "Пират", hint: "купить 30 сундуков", defaultStatus: "Пират", group: "events" },
  { key: "event_princess", title: "Принцесса", hint: "поцеловать 200 раз парня с рамкой принц", defaultStatus: "Принцесса", group: "events" },
  { key: "event_kvass", title: "Закваска", hint: "купить 10 раз Закваску", defaultStatus: "Закваска", group: "events" },
  { key: "event_snow", title: "Снежный бой", hint: "во время зимней игры запустить снежком 300 раз в игроков", defaultStatus: "Снежный бой", group: "events" },
  { key: "event_sweet", title: "Сладкоежка", hint: "получить в подарок 20 сладостей", defaultStatus: "Сладкоежка", group: "events" },
  { key: "event_heartbreaker_week", title: "Сердцеед (ка)", hint: "собрать 500 сердец за неделю", defaultStatus: "Сердцеед(ка)", group: "events" },
  { key: "event_cupid", title: "Купидон (ка)", hint: "подарить 100 роз", defaultStatus: "Купидон(ка)", group: "events" },
  { key: "event_mage", title: "Маг", hint: "купить 10 раз рамку магия", defaultStatus: "Маг", group: "events" },
  { key: "event_help_newbies", title: "Помощь новичкам", hint: "подарить 50 подарков новичкам", defaultStatus: "Помощник", group: "events" },
  { key: "event_santa", title: "Дедушка Мороз", hint: "отправить 300 новогодних подарков", defaultStatus: "Дед Мороз", group: "events" },
  { key: "event_tourist", title: "Турист", hint: "играй с разных городов и стран", defaultStatus: "Турист", group: "events" },
  { key: "event_fairy", title: "Фея", hint: "с рамкой фея поцелуй 300 раз", defaultStatus: "Фея", group: "events" },
  { key: "event_first_guy", title: "Первый парень", hint: "продержаться в топ-10 3 недели (для парней)", defaultStatus: "Первый парень", group: "events" },
  { key: "event_first_lady", title: "Первая леди", hint: "продержаться в топ-10 3 недели (для девушек)", defaultStatus: "Первая леди", group: "events" },
  { key: "event_friendship", title: "Дружбанио", hint: "пригласить 10 друзей за месяц", defaultStatus: "Дружбанио", group: "events" },
  { key: "event_psychic", title: "Экстрасенс", hint: "выиграть 10 турниров в мини-игре", defaultStatus: "Экстрасенс", group: "events" },
  { key: "event_cultural", title: "Культурный игрок", hint: "сказать «привет» всем игрокам 20 раз", defaultStatus: "Культурный", group: "events" },
  { key: "event_witcher", title: "Ведьмак (Ведьма)", hint: "во время хэллоуинского ивента собрать коллекцию из 5 разных «проклятых» предметов", defaultStatus: "Ведьмак(ма)", group: "events" },
  { key: "event_valentine", title: "Валентин", hint: "отправить 100 «валентинок» за день 14 февраля", defaultStatus: "Валентин", group: "events" },
  { key: "event_gardener", title: "Дачник", hint: "во время летнего ивента посадить и вырастить 20 виртуальных растений", defaultStatus: "Дачник", group: "events" },
  { key: "event_snowgirl", title: "Снегурочка", hint: "помочь «Деду Морозу» за одним столом не менее 2 часов", defaultStatus: "Снегурочка", group: "events" },
]

export const ACHIEVEMENT_POST_CATALOG_BY_KEY = new Map(
  ACHIEVEMENT_POST_CATALOG.map((x) => [x.key, x]),
)

export const ACHIEVEMENT_POST_CATALOG_BY_TITLE = new Map(
  ACHIEVEMENT_POST_CATALOG.map((x) => [x.title, x]),
)
