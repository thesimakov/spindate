# Настройка деплоя с GitHub на свой сервер

После каждого пуша в ветку `main` GitHub Actions собирает проект и выкладывает его на ваш сервер по SSH. Нужно один раз настроить секреты в репозитории и ключ на сервере.

---

## 1. Создать SSH-ключ для деплоя

На своём компьютере (или на сервере — тогда скопируй приватный ключ в секрет):

```bash
ssh-keygen -t ed25519 -C "github-deploy-spindate" -f deploy_key -N ""
```

Появятся файлы `deploy_key` (приватный) и `deploy_key.pub` (публичный).

---

## 2. Добавить публичный ключ на сервер

Подключись к серверу и добавь публичный ключ в `authorized_keys` пользователя, под которым будет выполняться деплой (например `root`):

```bash
ssh root@ВАШ_IP
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "ВСТАВЬ_СЮДА_СОДЕРЖИМОЕ_deploy_key.pub" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Проверка с компа (с указанием своего ключа):

```bash
ssh -i deploy_key root@ВАШ_IP "echo OK"
```

Должно вывести `OK` без запроса пароля.

---

## 3. Создать секреты в GitHub

В репозитории: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Добавь три секрета:

| Name             | Value                                      |
|------------------|--------------------------------------------|
| `SERVER_SSH_KEY` | Весь текст из файла **deploy_key** (приватный ключ), включая строки `-----BEGIN ... KEY-----` и `-----END ... KEY-----` |
| `SERVER_HOST`    | IP сервера или домен, например `79.174.77.47` или `spindate.lemnity.ru` |
| `SERVER_USER`    | Имя пользователя SSH, например `root`     |

Сохрани. Секреты в логах не показываются.

---

## 4. Подготовка сервера перед первым деплоем

На сервере должны быть установлены Node.js 20, npm, PM2 и каталог приложения. Один раз выполни (если ещё не делал):

```bash
# Node.js 20, PM2, каталог
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
mkdir -p /var/www/spindate
```

Первый раз PM2 нужно запустить вручную после того, как workflow скопирует файлы:

```bash
cd /var/www/spindate
npm ci
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

(Команду из вывода `pm2 startup` выполни до конца.)

При следующих деплоях workflow сам делает `npm ci` и `pm2 restart spindate`.

---

## 5. Как это работает

- При **push в main** запускается workflow **"Build and deploy to own server"**.
- Сборка идёт **без** статического экспорта (для `next start`).
- По SSH на сервер копируются: `.next/`, `public/`, `package.json`, `package-lock.json`, `next.config.mjs`, `ecosystem.config.cjs`.
- На сервере выполняется: `cd /var/www/spindate && npm ci && pm2 restart spindate`.

Если секреты не заданы, шаг деплоя просто пропускается (сборка всё равно выполняется).

---

## 6. Ручной запуск деплоя

В репозитории: **Actions** → выбери workflow **"Build and deploy to own server"** → **Run workflow** → **Run workflow**. Деплой пойдёт без нового коммита.
