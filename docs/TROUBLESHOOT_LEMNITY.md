# Почему не открывается https://spindate.lemnity.ru — чеклист

Если сайт не открывается или выдаёт ошибку, проверь по шагам.

---

## 0. Стили «слетели», в Network — **500** на `*.css` / `*.js` из `/_next/static/`, а на GitHub Pages всё ок

**Почему так:** [GitHub Pages](https://thesimakov.github.io/spindate/) отдаёт **готовые статические файлы** из `out/` (сборка с `BUILD_FOR_PAGES`). На VPS работает **`next start`** за **Nginx** — все запросы, включая `/_next/static/chunks/...`, должны попадать в **тот же процесс Node**, что слушает порт из **`ecosystem.config.cjs`**.

В репозитории для **spindate** в `ecosystem.config.cjs` задан **`PORT=3002`** (на одном VPS с другим Next-проектом тот может быть на **3001** — не перепутай). Если в Nginx в `proxy_pass` указан **другой** порт (например `3000` или `3001`, пока приложение на `3002`), прокси смотрит **не туда**: часто получаются **502**, пустые ответы на чанки и «голый» HTML без стилей.

**Что сделать на сервере:**

1. Проверить порт приложения: `pm2 show spindate` → поле `PORT` или `grep PORT /var/www/spindate/ecosystem.config.cjs`.
2. В `/etc/nginx/sites-enabled/...` для `location /` выставить **`proxy_pass http://127.0.0.1:3002;`** (ровно тот порт, что у PM2 для spindate).
3. `sudo nginx -t && sudo systemctl reload nginx`.
4. Локально на сервере: `curl -sI http://127.0.0.1:3002/_next/static/` — не должно быть обрыва соединения; затем снова открыть сайт в инкогнито.

Если после правки всё ещё 500 — смотри **`pm2 logs spindate`** и **`sudo tail -80 /var/log/nginx/error.log`**.

---

## 1. Проверка DNS (со своего компьютера)

```bash
# Должен вернуть IP твоего сервера
ping -c 2 spindate.lemnity.ru
# или
nslookup spindate.lemnity.ru
```

- **Не резолвится / unknown host** — домен не привязан к серверу. В панели регистратора домена (где куплен lemnity.ru) добавь **A-запись**: имя `spindate`, значение — **IP твоего VPS**.
- **Резолвится в IP** — переходи к шагу 2.

---

## 2. Доступность сервера по SSH

```bash
ssh root@spindate.lemnity.ru
# или: ssh root@IP_СЕРВЕРА
```

- **Не подключается (timeout / connection refused)** — сервер выключен, неверный IP в DNS или фаервол блокирует порт 22. Проверь VPS в панели хостинга и правила фаервола.
- **Подключился** — на сервере выполни шаги 3–6.

---

## 3. Работает ли приложение (PM2)

На сервере:

```bash
pm2 list
pm2 show spindate
pm2 logs spindate --lines 30
```

- **Процесса `spindate` нет** — запусти: `cd /var/www/spindate && pm2 start ecosystem.config.cjs && pm2 save`
- **Статус `errored` или `stopped`** — смотри логи: `pm2 logs spindate`. Часто причина: нет `node_modules` или папки `.next`. Выполни:
  ```bash
  cd /var/www/spindate
  npm ci
  npm run build
  pm2 restart spindate
  pm2 save
  ```
- **Статус `online`** — приложение запущено, переходи к шагу 4.

---

## 4. Слушает ли Next.js нужный порт (для spindate в репо — **3002**, см. `ecosystem.config.cjs`)

На сервере:

```bash
ss -tlnp | grep node
# или явно порт из ecosystem.config.cjs:
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/
```

- **Порт не слушается** — перезапусти приложение: `pm2 restart spindate`, снова проверь `pm2 logs spindate`.
- **curl на этот порт возвращает 200** — приложение работает локально. Переходи к шагу 5.

---

## 5. Настроен ли Nginx

На сервере:

```bash
sudo nginx -t
sudo systemctl status nginx
ls -la /etc/nginx/sites-enabled/
```

- **Nginx не установлен** — установи и настрой:
  ```bash
  sudo apt update && sudo apt install -y nginx
  ```
  Создай конфиг (подставь свой домен):
  ```bash
  sudo nano /etc/nginx/sites-available/spindate
  ```
  Содержимое:
  ```nginx
  server {
      listen 80;
      server_name spindate.lemnity.ru;
      location / {
          proxy_pass http://127.0.0.1:3002;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
          proxy_cache_bypass $http_upgrade;
      }
  }
  ```
  Включи сайт и перезагрузи Nginx:
  ```bash
  sudo ln -sf /etc/nginx/sites-available/spindate /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  ```
- **Сайта нет в sites-enabled** — сделай симлинк (см. выше) и `sudo systemctl reload nginx`.
- **Nginx запущен и конфиг ок** — переходи к шагу 6.

---

## 6. HTTPS (Certbot)

Проверь, есть ли сертификат:

```bash
sudo certbot certificates
```

- **Сертификата для spindate.lemnity.ru нет** — выдай:
  ```bash
  sudo apt install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d spindate.lemnity.ru
  ```
- **Сертификат есть** — открой в браузере https://spindate.lemnity.ru (лучше в режиме инкогнито или с отключённым кешем).

---

## 7. Деплой через GitHub Actions

Если деплой идёт через **Build and deploy to own server**:

1. В репозитории: **Settings → Secrets and variables → Actions**. Должны быть:
   - **SERVER_SSH_KEY** — приватный SSH-ключ (полностью, `cat deploy_key`).
   - **SERVER_HOST** — IP или домен сервера (например `spindate.lemnity.ru` или `79.174.77.47`).
   - **SERVER_USER** — пользователь SSH (часто `root`).

2. **Actions** → workflow **Build and deploy to own server** → последний запуск. Если был ошибка — исправь секреты или путь на сервере (по умолчанию `/var/www/spindate`).

3. После успешного деплоя на сервере обязательно:
   ```bash
   cd /var/www/spindate && npm ci && pm2 restart spindate && pm2 save
   ```
   (Workflow уже делает это; если деплой был вручную — выполни сам.)

---

## 8. Краткая проверка «всё ли на месте» на сервере

```bash
cd /var/www/spindate
ls -la .next package.json ecosystem.config.cjs public/
pm2 list
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/
```

- Есть `.next`, `package.json`, `ecosystem.config.cjs`, папка `public/`.
- PM2 показывает `spindate` в статусе `online`.
- `curl` на порт из `ecosystem.config.cjs` (для spindate сейчас **3002**) возвращает `200`.

Если всё так, но по домену всё равно не открывается — смотри логи Nginx: `sudo tail -50 /var/log/nginx/error.log`.

---

## Итог

| Проблема | Действие |
|----------|----------|
| DNS не резолвится | A-запись для `spindate` → IP сервера |
| SSH не подключается | Проверить VPS, фаервол, IP |
| Нет процесса spindate | `cd /var/www/spindate && pm2 start ecosystem.config.cjs` |
| PM2 errored/stopped | `npm ci && npm run build && pm2 restart spindate` |
| Порт Node не слушается | Проверить логи PM2, перезапустить приложение |
| Nginx не установлен/не настроен | Установить nginx, `proxy_pass` на **тот же порт**, что PM2 (см. `ecosystem.config.cjs`, для spindate **3002**) |
| Нет HTTPS | `sudo certbot --nginx -d spindate.lemnity.ru` |
| Деплой через GitHub не срабатывает | Проверить Secrets (SERVER_SSH_KEY, SERVER_HOST, SERVER_USER) |

После изменений подожди 1–2 минуты и открой https://spindate.lemnity.ru в режиме инкогнито.
