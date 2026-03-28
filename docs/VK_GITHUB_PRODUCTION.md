# VK Mini App, GitHub и «сломанные» стили на домене

Кратко: **VK не подключается к GitHub напрямую.** Мини-приложение всегда открывает **один заданный вами HTTPS-URL**. Обновления из репозитория попадают в игру только после **сборки и выкладки** на сервер (вручную или через GitHub Actions).

---

## 1. Почему «GitHub не подтягивается» в VK

1. **В настройках мини-приложения VK** указан URL вида `https://spindate.lemnity.ru` (или старый адрес GitHub Pages). VK **никогда** не делает `git pull` — он просто загружает эту страницу в WebView.
2. Чтобы изменения из GitHub попали на сайт, нужен **деплой**:
   - либо workflow **Build and deploy to own server** (нужны секреты `SERVER_SSH_KEY`, `SERVER_HOST`, `SERVER_USER` — см. [GITHUB_DEPLOY_SECRETS.md](./GITHUB_DEPLOY_SECRETS.md));
   - либо ручной `git pull` + `npm run build` + `pm2 restart` на сервере.
3. Если секреты **не заданы**, в логах Actions деплой **тихо пропускается** (сборка проходит, на сервер ничего не уходит).

**Проверка:** в VK → настройки приложения → **URL приложения** = тот же домен, куда вы реально деплоите (например `https://spindate.lemnity.ru`).

---

## 2. «Сломанные» стили (чёрный экран, голый HTML, системные кнопки)

Нормальная страница подгружает CSS с путей вида `/_next/static/css/....css`. Если стили не применились, чаще всего:

| Причина | Что сделать |
|--------|-------------|
| **Закэширован старый HTML** после деплоя, а новые файлы в `/_next/static/` уже другие | Жёсткое обновление (Ctrl+F5), режим инкогнито. В проекте для `/` выставлен `Cache-Control: no-store`, но прокси/CDN может кэшировать иначе. |
| **Nginx смотрит не на тот порт**, где слушает Node (в `ecosystem.config.cjs` по умолчанию **3001**) | В `proxy_pass` должен быть тот же порт, что у `PORT` в PM2. См. [DOMAIN_NEW_SERVER.md](./DOMAIN_NEW_SERVER.md). |
| **Nginx отдаёт не тот корень** (например `try_files` к статике вместо прокси на Next) | Для SPA-заглушек так не делают: весь сайт, включая `/_next/static/`, должен идти на `next start`. |
| Собрали с **`BUILD_FOR_PAGES=true`** (GitHub Pages) и выкладываете на **свой домен** без подпапки | Для VPS нужна обычная сборка **без** этого флага (как в `deploy-server.yml`). |

**Проверки с компьютера:**

```bash
curl -sI https://spindate.lemnity.ru/ | head -5
curl -sI "https://spindate.lemnity.ru/_next/static/css/" 2>/dev/null | head -3
# Возьми точный путь к css из исходного кода страницы (view-source) и проверь:
# curl -sI "https://spindate.lemnity.ru/_next/static/css/XXXX.css"
```

Ожидается **HTTP/2xx** и `Content-Type: text/css` для файла `.css`.

---

## 3. Переменные при сборке в CI

В `.github/workflows/deploy-server.yml` для шага `npm run build` заданы `NEXT_PUBLIC_APP_URL` и `NEXT_PUBLIC_VK_APP_ID`, чтобы прод-сборка совпадала с доменом и VK. Форк репозитория при необходимости поменяй значения в workflow или заведи [переменные репозитория](https://docs.github.com/en/actions/learn-github-actions/variables) и подставь их через `vars`.

---

## 4. GitHub Pages: 404 на `https://user.github.io/repo/`

Частые причины:

1. **`export const revalidate = 0` в корневом `app/layout.tsx`** — страница становится динамической, при `output: "export"` **нет `index.html` в `out/`** → Pages отдаёт 404. В проекте для экспорта используется `revalidate = false`, свежий HTML на VPS — через `Cache-Control` в `next.config.mjs`.
2. **Артефакт деплоя** — при `basePath=/имя-репо` файлы лежат в `out/имя-репо/`. В workflow нужно выкладывать **содержимое этой папки** как корень сайта (в `.github/workflows/nextjs.yml` шаг «Resolve GitHub Pages artifact root»), а не весь `out/` целиком.
3. В **Settings → Pages** источник: **GitHub Actions**, ветка `main` с успешным workflow «Deploy Next.js site to Pages».

## 5. Полезные ссылки

- Настройка секретов деплоя: [GITHUB_DEPLOY_SECRETS.md](./GITHUB_DEPLOY_SECRETS.md)
- Nginx и домен: [DOMAIN_NEW_SERVER.md](./DOMAIN_NEW_SERVER.md)
- Публикация в VK: [VK_PUBLICATION.md](./VK_PUBLICATION.md)
