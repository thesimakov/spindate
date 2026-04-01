# Анализ фронтенд кодовой базы: Spindate

Онлайн-игра «Крути и знакомься» (бутылочка для знакомств) в формате **VK Mini App** с серверной синхронизацией столов. Репозиторий — **монолит**: React-клиент, Next.js Route Handlers и серверные модули (SQLite, Redis) живут в одном проекте.

## 📁 Структура проекта

### Схематичное дерево (до 3-го уровня)

```
spindate/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Корневой layout, тема, метаданные
│   ├── page.tsx            # Точка входа: GameProvider + GameApp
│   ├── globals.css         # Tailwind 4, CSS-переменные, игровые цвета
│   ├── error.tsx           # Граница ошибок сегмента
│   ├── global-error.tsx
│   ├── admin-lemnity/      # Админ-страница (отдельный маршрут)
│   └── api/                # Route Handlers (REST для стола, чата, auth, VK)
├── components/             # UI и экраны приложения
│   ├── ui/                 # Примитивы (shadcn-подобные: Radix + CVA)
│   ├── game-app.tsx        # Маршрутизация по state.screen
│   ├── game-room.tsx       # Основной игровой стол
│   ├── registration-screen.tsx
│   └── …                   # Экраны магазина, чата, профиля и др.
├── hooks/                  # Клиентские хуки (синхронизация, таймеры)
├── lib/                    # Доменная логика, типы, серверные утилиты
│   ├── game-context.tsx    # Глобальное состояние игры (reducer)
│   ├── game-types.ts
│   ├── api-fetch.ts
│   ├── vk-bridge.ts
│   ├── table-authority-*.ts
│   └── …                   # Redis, SQLite, live tables, auth
├── public/                 # Статические ассеты
└── …                       # Конфиги: next, eslint, postcss, tsconfig
```

### Назначение директорий

- **`app/`** — маршруты Next.js: одна основная страница с динамическим рендером, API-роуты для многопользовательского стола, сессий и интеграции с VK. Комментарии в коде явно связывают поведение кэша с деплоем на VPS и статическим экспортом для GitHub Pages.
- **`components/`** — монолитные экраны и крупные виджеты игры плюс каталог `ui/` на базе Radix UI (диалоги, формы, тосты и т.д.), оформленный в едином визуальном стиле.
- **`hooks/`** — изоляция побочных эффектов: синхронизация с сервером (`use-sync-engine`), игровые таймеры (`use-game-timers`), обёртки над тостами.
- **`lib/`** — типы игры, reducer-контекст, клиентский `apiFetch`, мост VK Mini App, а также серверная логика авторитета стола, Redis/SQLite, используемая из Route Handlers. Организация скорее **по слоям и доменам** (игра, стол, auth, VK), чем строго feature-sliced.
- **`app/admin-lemnity/`** — отдельный маршрут администрирования (клиентский модуль `admin-lemnity-client.tsx` и страница-обёртка); полезно знать команде поддержки, но не относится к основному игровому UX большинства пользователей.
- **`lib/dev-registry.ts`** — используется в `GameApp` для проверки блокировок и банов в dev/отладочных сценариях; связка с продуктовой модерацией должна документироваться отдельно, если реестр расширяется.

### Принципы организации кода

Архитектура **гибридная**: навигация между крупными разделами приложения реализована через поле `screen` в глобальном состоянии и `switch` в `GameApp`, а не через множество URL-маршрутов Next — это типично для мини-приложений с одним «шеллом». Паттерн **единого контекста + reducer** централизует игровое состояние; синхронизация с бэкендом вынесена в отдельный хук. UI-kit лежит отдельным деревом `components/ui/`, что соответствует **layer-based** подходу для дизайн-системы.

---

## 🛠 Технологический стек

| Категория | Технология | Версия (по package.json) |
|-----------|------------|---------------------------|
| Фреймворк | Next.js (App Router) | 16.1.6 |
| UI-библиотека | React | 19.2.4 |
| Язык | TypeScript | 5.7.3 |
| Сборка | Next (`next dev/build --webpack`) | см. scripts |
| Стили | Tailwind CSS + PostCSS | tailwindcss ^4.2.0 |
| UI-примитивы | Radix UI (множество пакетов `@radix-ui/*`) | зафиксированы в deps |
| Варианты стилей кнопок и т.п. | class-variance-authority (CVA) | ^0.7.1 |
| Утилиты классов | clsx, tailwind-merge | — |
| Темизация | next-themes | ^0.4.6 |
| Формы (инфраструктура) | react-hook-form, @hookform/resolvers, zod | в зависимостях |
| VK Mini App | @vkontakte/vk-bridge | ^2.15.11 |
| Аналитика | @vercel/analytics | 1.6.1 |
| Уведомления UI | sonner | ^1.7.1 |
| Иконки | lucide-react | ^0.564.0 |
| Сервер (в том же репозитории) | better-sqlite3, ioredis | для API routes |
| Графики | recharts | 2.15.0 |
| Карусель | embla-carousel-react | 8.6.0 |
| Выбор дат | react-day-picker | 9.13.2 |
| Панели | react-resizable-panels | ^2.1.7 |

**Сборка и развёртывание:** `npm run dev` / `build` / `start`; для GitHub Pages — условный `output: "export"` и `basePath` через переменные окружения в `next.config.mjs`. Docker в репозитории не обнаружен.

**Управление состоянием:** централизованный **React Context + `useReducer`** в `lib/game-context.tsx`; отдельные хуки для синхронизации и таймеров. Redux/MobX/Zustand не используются.

**CSS:** Tailwind 4 с `@import 'tailwindcss'`, кастомный вариант `dark`, CSS-переменные для палитры и «игровых» цветов (`--felt-green`, `--gold-rim` и т.д.), плюс `tw-animate-css` для анимаций.

**Наблюдение по версиям:** в `devDependencies` указан `@next/eslint-plugin-next` **^16.2.0**, тогда как `next` зафиксирован на **16.1.6** — обычно безвредно, но при обновлениях пакетов стоит выравнивать мажор/минор Next и плагина, чтобы избежать расхождений в правилах.

---

## 🏗 Архитектура

### Компонентная модель

- **Контейнер верхнего уровня:** `app/page.tsx` оборачивает приложение в `GameProvider` и рендерит `GameApp`.
- **Маршрутизация экранов:** в `GameApp` используется `switch (state.screen)` с кейсами `registration`, `game`, `chat`, `shop`, `ugadaika` и др. Это **state-driven navigation** вместо file-based routes для основого UX.
- **Крупные экраны:** `GameRoom` агрегирует стол, бутылку, чат стола, эмоции, боковые панели — файл очень большой по объёму строк, что указывает на накопление логики в одном модуле.

### Разделение логики

- **Hooks:** `useSyncEngine` перехватывает `dispatch`, дублирует отмеченные действия на сервер (`/api/table/events`) и опрашивает авторитетное состояние стола; `useGameTimers` инкапсулирует интервалы и таймауты хода, результата, тумана и т.д.
- **Reducer:** `gameReducer` в `game-context.tsx` обрабатывает десятки типов действий (`SET_USER`, `START_SPIN`, `ADD_LOG`, …) — классический **Flux-подобный** поток данных.

Пример паттерна «локальный dispatch + синхронизация только для части действий»:

```tsx
// hooks/use-sync-engine.ts (фрагмент)
const dispatch = useCallback((action: GameAction) => {
  rawDispatch(action)
  if (remoteActionRef.current) return
  if (!isTableSyncedAction(action)) return
  void pushTableAction(action)
}, [rawDispatch, pushTableAction])
```

### Управление состоянием

- Один **глобальный** `GameState` с полями от экрана и пользователя до инвентаря, логов, ставок, паузы стола и т.д.
- Локальное хранилище (например, поклонники) и `sessionStorage` для сессии через `api-fetch` дополняют контекст.

### API-слой и данные

- Клиент: **`apiFetch`** — обёртка над `fetch` с `credentials: "include"` и заголовком `X-Session-Token` из `sessionStorage` (обход ограничений cookie во встроенном VK WebView).
- Сервер: Route Handlers в `app/api/...` используют модули из `lib/` (авторитет стола, Redis, SQLite). Пример: `POST /api/table/state` возвращает снимок стола и ревизию для инкрементальной синхронизации.

```ts
// app/api/table/state/route.ts (фрагмент)
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const tableId = Math.floor(Number(body?.tableId))
  const sinceRevision = Math.floor(Number(body?.sinceRevision ?? 0))
  // … ensureTableAuthority, getTableAuthoritySnapshot …
  return NextResponse.json({ ok: true, revision, changed, snapshot }, { headers: NO_CACHE })
}
```

### Роутинг и навигация

- **Next:** фактически одна главная страница с `dynamic = "force-dynamic"`; дополнительно `admin-lemnity` и API.
- **В приложении:** переходы через `dispatch({ type: "SET_SCREEN", screen: ... })` и связанные действия (`SET_GAME_SIDE_PANEL`, `OPEN_SIDE_CHAT`).

### Ошибки и loading

- **`app/error.tsx`:** клиентский boundary с сообщением на русском, `reset`, в dev — вывод `error.message`.
- **`app/global-error.tsx`:** запасной boundary для критических сбоев корневого layout (см. документацию Next.js App Router).
- **Загрузка:** `AppLoader`, `TableLoaderOverlay`, флаги `loading` на экране регистрации; отложенная «нормализация» UI после готовности стола в `GameApp` (таймаут `NORMALIZE_DELAY_MS` в `GameApp`).

### Типы действий и reducer

`GameAction` в `lib/game-types.ts` оформлен как **дискриминирующее объединение** по полю `type`. Это позволяет TypeScript сужать тип payload в ветках `switch` внутри `gameReducer`. Такой подход масштабируется лучше, чем набор опциональных полей на одном объекте, хотя при десятках кейсов файл reducer становится длинным и нуждается в навигации по поиску или вынесении групп кейсов в чистые функции.

### Метаданные и SEO

Корневой `app/layout.tsx` задаёт `metadata` (title, description, Open Graph) и `viewport` (в т.ч. `themeColor`, `viewportFit: 'cover'`). `metadataBase` берётся из `NEXT_PUBLIC_APP_URL` — важно не забывать выставлять переменную в CI (как сделано в `deploy-server.yml`), иначе абсолютные URL для OG могут быть некорректны. Шрифт **Inter** подключается через `next/font/google` с подмножествами **latin** и **cyrillic**, что соответствует русскоязычному UI.

### Безопасность на стыке клиента и API

Сессия дублируется: httpOnly-cookie на сервере и **`X-Session-Token`** в `sessionStorage` для клиентов без нормальных cookie (комментарий в `api-fetch.ts`). Это осознанный компромисс для VK WebView; при ревью изменений в auth важно проверять, не утекает ли токен в логи и не ослаблена ли серверная валидация.

---

## 🎨 UI/UX и стилизация

### Подходы к стилизации

- **Tailwind 4** с утилитарными классами в JSX.
- **`cn()`** (`clsx` + `tailwind-merge`) для условных классов.
- **CVA** для вариантов компонентов (например, кнопки с градиентами и игровой эстетикой).
- **Radix** даёт доступность примитивов (Dialog, Tabs и т.д.); обёртки в `components/ui/`.

### Дизайн-система / UI-kit

- Набор компонентов в **`components/ui/`** по мотивам **shadcn/ui**: Button, Dialog, Form, Sheet, Toast и др. — единая точка для типографики и интерактивов.
- Тема: **`ThemeProvider`** из `next-themes` в корневом layout, по умолчанию тёмная тема, `className="dark"` на `<html>`.

### Адаптивность

- Хук **`useGameLayoutMode`** / **`use-media-query`** для мобильного vs десктопного режима (размер стола, число игроков при матчмейкинге).
- Viewport в `layout`: `viewportFit: 'cover'` под безопасные зоны мини-приложений.
- Отладочный оверлей **layout debug** (через query или localStorage) для диагностики ширины во встроенном VK.

### Темизация

- **next-themes** + CSS-переменные в `globals.css` для светлой/тёмной схемы; комментарии в коде ориентируют на тёмно-синюю палитру и игровые акценты.

### Доступность (a11y)

- Частичное использование **`aria-*`**, `role="dialog"`, `aria-modal`, `aria-live` в игровых панелях (например, громкость, боковое меню). Полный аудит a11y по проекту не проводился; Radix повышает базовый уровень для компонентов из `ui/`.

---

## ✅ Качество кода

### Линтеры и форматирование

- **ESLint 9** с flat-config (`eslint.config.mjs`): `@typescript-eslint/recommended`, плагины Next и `react-hooks`; `no-explicit-any` отключён; неиспользуемые переменные — предупреждение с префиксом `_`.
- **Prettier** в зависимостях не указан — единого автоформаттера в `package.json` нет.
- **Stylelint** не используется.

### TypeScript

- **`strict: true`** в `tsconfig.json`, алиасы `@/*`.
- Типы игры и действий сосредоточены в **`lib/game-types.ts`** — сильная сторона для доменной модели.
- В ESLint ослаблен контроль `any`, что может снижать строгость на границах.

### Тесты

- Автотестов **не обнаружено** (поиск `*.test.*` / `*.spec.*` — пусто). Критический функционал (reducer, sync engine, API) не покрыт unit/e2e тестами в репозитории.

### Документация в коде

- Есть содержательные комментарии в **layout**, **next.config**, **workflows** (деплой, кэш HTML, static export).
- JSDoc используется выборочно; крупные файлы полагаются на имена типов и кейсов reducer.

### Соглашения по именованию

- Компоненты в PascalCase, хуки с префиксом `use`, типы и экшены в UPPER_SNAKE для диспатча — последовательно для React-кодовой базы.

---

## 🔧 Ключевые компоненты и модули

### 1. `GameProvider` / `useGame` (`lib/game-context.tsx`)

**Назначение:** единый источник правды для игрового состояния и диспатчер всех игровых событий.

**Роль:** питает `GameApp`, `GameRoom`, экраны регистрации и магазина; хранит начальный `initialState` и `gameReducer`.

**Пример использования:**

```tsx
// app/page.tsx
export default function Page() {
  return (
    <GameProvider>
      <main className="flex h-app min-h-0 w-full …">
        <GameApp />
      </main>
    </GameProvider>
  )
}
```

**API:** `useGame()` → `{ state, dispatch }`; экспортируются хелперы (`generateBots`, `generateLogId`, …).

**Зависимости:** `game-types`, `apiFetch`, боты, утилиты пар; интеграция с персистентностью и API через экраны и хуки.

---

### 2. `GameApp` (`components/game-app.tsx`)

**Назначение:** корневой UI-контроллер: инициализация VK, блокировки dev-registry, уведомления ЛС, выбор экрана по `state.screen`, боковые панели (профиль, магазин, рейтинг, чат игрока).

**Пример (фрагмент маршрутизации):**

```tsx
switch (state.screen) {
  case "registration":
    return <RegistrationScreen />
  case "game":
    return (
      <>
        <GameRoom />
        {/* панели, debug, PM toasts */}
      </>
    )
  case "chat":
    return <ChatScreen />
  // …
}
```

**Пропсы:** нет (берёт всё из контекста).

**Зависимости:** `vk-bridge`, `usePmNotifications`, множество экранных компонентов.

---

### 3. `useSyncEngine` (`hooks/use-sync-engine.ts`)

**Назначение:** синхронизация многопользовательского стола: отправка действий на сервер, опрос live/authority, составление стола из игроков (`composeTablePlayers`).

**Интеграции:** `apiFetch` → `/api/table/events`, `/api/table/live`, `/api/table/state` и связанные эндпоинты.

**Ключевое API:** возвращает обёрнутый `dispatch`, `syncLiveTable`, `fetchTableAuthority`, флаги готовности.

---

### 4. `GameRoom` (`components/game-room.tsx`)

**Назначение:** основной игровой стол: бутылка, игроки по кругу, таймеры хода, чат стола, эмоции, скины бутылки, интеграция с `useSyncEngine` и `useGameTimers`.

**Особенность:** очень большой модуль — высокая когнитивная нагрузка при сопровождении; точка приложения усилий при рефакторинге.

**Зависимости:** десятки локальных и shared-компонентов, `game-types`, ассеты, тема.

---

### 5. `apiFetch` (`lib/api-fetch.ts`)

**Назначение:** унифицированный клиентский HTTP с cookie и резервным токеном в `sessionStorage` для VK.

```ts
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? undefined)
  // … X-Session-Token из sessionStorage …
  return fetch(input, {
    ...init,
    credentials: init?.credentials ?? "include",
    headers,
  })
}
```

---

## Паттерны и практики

### Жизненный цикл VK Mini App

`GameApp` при монтировании вызывает `initVkResilient()`, а затем поддерживает платформенные VK-вызовы через подписку на ресайз (`subscribeVkViewportResize`, `VKWebAppExpand`). Это отделяет **платформенные** concern’ы от игровой логики. Регистрация (`RegistrationScreen`) опирается на `vk-bridge` для тихого входа и сочетает email/пароль с VK — многоуровневый вход отражён в состоянии и API `/api/auth/*`.

### Таймеры и побочные эффекты

`useGameTimers` концентрирует константы длительностей (ход, результат, предсказание, AFK-skip) и синхронизирует их с `dispatch`. Так уменьшается дублирование `setInterval`/`setTimeout` в `GameRoom`.

```tsx
// hooks/use-game-timers.ts (идея интерфейса)
export interface UseGameTimersParams {
  tableId: number
  roundNumber: number
  currentTurnIndex: number
  currentTurnPlayer: Player | undefined
  currentUser: Player | null
  isSpinning: boolean
  showResult: boolean
  countdown: number | null
  predictionPhase: boolean
  dispatch: (action: GameAction) => void
  handleSpin: () => void
  playersRef: React.RefObject<Player[]>
  casualMode: boolean
}
```

### Поверхность HTTP API (Route Handlers)

Для ориентира в кодовой базе полезен список маршрутов `app/api`:

| Префикс | Назначение |
|---------|------------|
| `/api/auth/login`, `register`, `logout`, `me`, `vk` | Сессии и провайдер VK |
| `/api/user/state` | Состояние пользователя на сервере |
| `/api/table/live` | Подбор стола / live-столы |
| `/api/table/state`, `/api/table/events` | Авторитетное состояние и события стола |
| `/api/chat/private`, `/api/chat/unread` | Личные сообщения |
| `/api/vk/payments` | Платежи VK |

Клиент почти везде ходит через **`apiFetch`**, что упрощает смену базового URL и заголовков.

### Дополнительные npm-зависимости (UX и контент)

Помимо «каркаса» в таблице стека стоит упомянуть: **emoji-picker-react** и кастомные пикеры чата для эмодзи-реакций; **embla-carousel-react** — карусели; **recharts** — графики (если используются в админке или статистике); **date-fns** — даты; **cmdk** — command palette в стиле shadcn; **vaul** — drawer; **input-otp** — OTP-поля. Они задают **плотность UI** и ожидания по bundle size — при профилировании стоит смотреть динамические импорты для тяжёлых экранов.

### Общая сводка

- **Оптимистичный локальный UI + сходимость с сервером:** действия применяются в reducer немедленно; сервер догоняется через poll и authority snapshot.
- **Производительность:** поллинг с интервалами (например, live 3 с, authority 800 мс в sync engine); debounce применения снимков; `next/image` с `unoptimized: true` (осознанный выбор под статический экспорт/хостинг).
- **Асинхронность:** `async/await` в эффектах и обработчиках; ошибки сети часто глушатся с расчётом на следующий poll (комментарии в sync engine).
- **Валидация:** схемы Zod в проекте заявлены зависимостями; основной поток регистрации использует локальный state и ручные проверки — **потенциал для унификации с `react-hook-form` + zod** там, где появятся сложные формы.
- **Локализация:** интерфейс **на русском**, `lang="ru"` в layout; отдельной i18n-библиотеки нет — строки захардкожены в компонентах.

### Нестандартные решения

- **Двойной деплой:** прод на Node (`next start` по SSH из CI) и превью на **GitHub Pages** со статическим экспортом; workflow **временно перемещает `app/api`**, чтобы Next не включал API в static build — необычный, но документированный приём.
- **Кэш-контроль:** заголовки `Cache-Control` для `/` и админки, комментарии о битых хэшах после деплоя — признак реальных прод-проблем, закрытых конфигурацией.
- **CSP `frame-ancestors`** для встраивания VK — правильно для мини-приложения.

---

## ⚙️ Инфраструктура разработки

Модули **`lib/db.ts`**, **`lib/redis.ts`**, **`lib/table-authority-server.ts`**, **`lib/live-tables-*.ts`** и родственные файлы выполняют роль **бэкенда внутри Next**: Route Handlers импортируют их напрямую. С точки зрения фронтенд-команды важно: изменения в типах `TableAuthorityPayload` / `GameState` должны согласовываться с сериализацией на сервере и с клиентским reducer — это не «чистый» SPA, а **full-stack bundle**.

### Скрипты `package.json`

| Скрипт | Назначение |
|--------|------------|
| `dev` | `next dev --webpack` — явный выбор бандлера |
| `build` | `next build --webpack` |
| `start` | production-сервер Next |
| `lint` | `eslint .` |

### Среда разработки

- Node рекомендуется согласовать с CI (**24** в workflows).
- Path alias `@/*` для импортов из корня репозитория.

### CI/CD

- **`.github/workflows/nextjs.yml`:** деплой на GitHub Pages с ветки `pages-preview`, static export, восстановление `app/api` после сборки, копирование ассетов под `basePath`.
- **`deploy-server.yml`:** на push в `main` — сборка с env для прод-домена и VK App ID, удаление `.next/cache`, деплой по SSH.
- В обоих workflow для `actions/checkout` включён флаг **`lfs: true`** — в репозитории, вероятно, есть крупные бинарные ассеты под Git LFS; локальный клон без LFS может давать неполные файлы.

### Переменные окружения (ориентир для разработчиков)

Помимо стандартных `NODE_ENV`, в CI и проде фигурируют: **`NEXT_PUBLIC_APP_URL`**, **`NEXT_PUBLIC_BUILD_ID`** (часто git SHA), **`NEXT_PUBLIC_VK_APP_ID`**, **`BUILD_FOR_PAGES`**, **`NEXT_PUBLIC_BASE_PATH`**. Фронтенд-код читает только переменные с префиксом `NEXT_PUBLIC_*` в клиентском бандле; остальные остаются на сервере Route Handlers. Полный список переменных описан в **`.env.example`** в корне репозитория — его стоит держать актуальным при добавлении новых секретов и публичных ключей.

### Pre-commit / Docker

- **Husky / lint-staged:** в репозитории не найдены.
- **Docker:** отсутствует.

---

## 📋 Выводы и рекомендации

### Сильные стороны

1. Современный стек (**Next 16, React 19, TS strict**), предсказуемый data-flow через **reducer**.
2. Выделенный **sync layer** и типизированные **`game-types`** облегчают понимание многопользовательской модели.
3. **UI-kit на Radix + Tailwind + CVA** даёт основу для консистентного интерфейса.
4. Продуманные **деплой-пайплайны** и комментарии о кэше и static export.
5. Интеграция **VK Bridge** и UX-настройки под мини-приложение.

### Области для улучшения

1. **Декомпозиция `game-room.tsx`** на подмодули (доска, чат, модалки, меню) — снизит порог входа и риск регрессий.
2. **Автотесты:** unit-тесты для `gameReducer` и чистых функций в `lib/`; интеграционные для API; при возможности e2e критического сценария «вход → стол».
3. **Строже типизация** на внешних границах (отключённый `no-explicit-any`); поэтапное включение.
4. **Prettier** (или единый форматтер) в проект и, при желании, pre-commit.
5. **Использование Zod + RHF** там, где формы разрастутся (сейчас инфраструктура есть, применение не везде).
6. **a11y:** систематический проход по клавиатурной навигации и фокусу в кастомных игровых оверлеях.

### Уровень сложности для разработчиков

- **В целом уровень middle+:** требуется понимание React 18/19, Next App Router, асинхронных границ и распределённого состояния. Монолитные файлы и отсутствие тестов повышают планку до **senior** при изменениях в core игры и синхронизации.
- **Junior-friendly задачи:** правка копирайта, стилей Tailwind в изолированных экранах, мелкие правки в `components/ui/*`, добавление статики в `public/`.
- **Требуют опыта:** любые правки в `use-sync-engine`, authority/Redis, миграции состояния в `gameReducer`, изменение контрактов API.

### Риски и ограничения анализа

Документ составлен по **статическому** обзору репозитория без запуска приложения и без нагрузочного тестирования. Фактическое покрытие веток в `GameRoom`, поведение при обрыве сети и полнота обработки edge cases на сервере могут отличаться; для production-аудита рекомендуется дополнить ревью метриками runtime и мониторингом API.

---

*Документ подготовлен по состоянию репозитория на момент анализа; версии зависимостей следует перепроверять в `package.json` после обновлений. Целевой объём обзора — порядка 3000–4000 слов; при необходимости углубления отдельных подсистем (только API, только VK, только reducer) имеет смысл вынести их в отдельные внутренние RFC или ADR.*
