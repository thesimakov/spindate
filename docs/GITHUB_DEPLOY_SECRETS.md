# Настройка деплоя с GitHub на свой сервер

После каждого пуша в ветку `main` GitHub Actions собирает проект и выкладывает его на сервер по SSH. Нужно один раз настроить секреты и ключ на сервере.

---

## 1. Создать SSH-ключ для деплоя

На своём компьютере (или на сервере — тогда приватный ключ потом скопируешь в секрет):

```bash
ssh-keygen -t ed25519 -C "github-deploy-spindate" -f deploy_key -N ""
```

Появятся файлы **deploy_key** (приватный) и **deploy_key.pub** (публичный).

---

## 2. Добавить публичный ключ на сервер

Подключись к серверу и добавь публичный ключ в `authorized_keys` пользователя, под которым идёт деплой (например `root`):

```bash
ssh root@ВАШ_IP
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
```

Вставь **одну строку** — полное содержимое файла `deploy_key.pub` (скопируй с компа: `cat deploy_key.pub`). Сохрани (Ctrl+O, Enter, Ctrl+X).

```bash
chmod 600 ~/.ssh/authorized_keys
```

Проверка с компа (должно вывести OK без пароля):

```bash
ssh -i deploy_key root@ВАШ_IP "echo OK"
```

---

## 3. Создать секреты в GitHub

В репозитории: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Добавь три секрета:

| Name             | Value |
|------------------|--------|
| **SERVER_SSH_KEY** | Полное содержимое **приватного** ключа `deploy_key` (см. ниже) |
| **SERVER_HOST**    | IP или домен сервера, например `79.174.77.47` или `spindate.lemnity.ru` |
| **SERVER_USER**    | Пользователь SSH, например `root` |

### Как вставить SERVER_SSH_KEY

В секрет нужно вставить **весь** приватный ключ — от `-----BEGIN OPENSSH PRIVATE KEY-----` до `-----END OPENSSH PRIVATE KEY-----` включительно, **со всеми строками между ними**.

**На Mac/Linux** в папке, где лежит `deploy_key`:

```bash
cat deploy_key
```

Скопируй весь вывод из терминала и вставь в значение секрета **SERVER_SSH_KEY**. Так сохраняются переносы строк.

Не используй base64 — в workflow ключ используется как есть (сырой текст с очисткой `\r` и пробелов в конце строк).

---

## 4. Подготовка сервера перед первым деплоем

На сервере должны быть установлены Node.js 20+, npm и PM2:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
mkdir -p /var/www/spindate
```

Первый раз PM2 запустится из workflow. Если нужно запустить вручную после первого деплоя:

```bash
cd /var/www/spindate
npm ci
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

(Команду из вывода `pm2 startup` выполни до конца.)

---

## 5. Как это работает

- При **push в main** запускается workflow **"Build and deploy to own server"**.
- Сборка идёт без статического экспорта (для `next start`).
- По SSH на сервер копируются: `.next/`, `public/`, `package.json`, `package-lock.json`, `next.config.mjs`, `ecosystem.config.cjs`.
- На сервере выполняется: `npm ci`, затем `pm2 restart spindate` (или `pm2 start`, если процесс ещё не был запущен).

Если секреты не заданы, шаг деплоя пропускается (сборка всё равно выполняется).

---

## 6. Ручной запуск деплоя

В репозитории: **Actions** → **Build and deploy to own server** → **Run workflow** → **Run workflow**.

---

## Ошибки

- **`mkstemp ... Permission denied` при rsync** — пользователь из **SERVER_USER** не может писать в `/var/www/spindate`. Один раз на сервере: `chown -R ВАШ_ПОЛЬЗОВАТЕЛЬ:ВАШ_ПОЛЬЗОВАТЕЛЬ /var/www/spindate` (тот же логин, что в секрете; не IP и не `user@host`). Либо задайте владельца каталога тому пользователю, под которым идёт SSH-деплой. В workflow также используется временный каталог `/tmp/rsync-spindate` для приёма файлов.
- **Permission denied (publickey)** — на сервере нет этого публичного ключа в `~/.ssh/authorized_keys` или в секрете другой ключ. Проверь шаги 1–2 и что в SERVER_SSH_KEY вставлен ключ от того же ключа, что и в `authorized_keys`.
- **Load key: error in libcrypto** — ключ в секрете испорчен (потеряны переносы строк или лишние символы). Вставь заново через `cat deploy_key` и копирование из терминала.
- **base64: invalid input** — в workflow не используется base64; если видишь эту ошибку, в репозитории на GitHub должна быть актуальная версия `.github/workflows/deploy-server.yml` (без base64). Сделай push и перезапусти workflow.
