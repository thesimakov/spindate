# Развёртывание Spindate на облачном сервере с нуля

Пошаговая инструкция: от чистого VPS/облачного сервера до работающего приложения по своему домену.

---

## Требования к серверу

- **ОС:** Ubuntu 22.04 / 24.04 или Debian 11/12 (рекомендуется).
- **Ресурсы:** минимум 512 MB RAM, 1 vCPU; для стабильной работы лучше 1 GB RAM.
- **Доступ:** SSH по ключу или паролю.
- **Домен:** желательно привязать домен к IP сервера (A-запись), чтобы потом включить HTTPS.

---

## 1. Подключение и обновление системы

```bash
ssh root@ВАШ_IP
# или: ssh ubuntu@ВАШ_IP  (если пользователь ubuntu)

apt update && apt upgrade -y
```

---

## 2. Установка Node.js (LTS)

Установка Node.js 20 через NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

node -v   # должно быть v20.x
npm -v
```

---

## 3. Установка инструментов для сборки (для native-модулей)

Проект использует `better-sqlite3`, для его сборки нужны компилятор и Python:

```bash
apt install -y build-essential python3
```

---

## 4. Размещение проекта на сервере

### Вариант А: клонирование из GitHub

```bash
apt install -y git
mkdir -p /var/www
cd /var/www
git clone https://github.com/ВАШ_USERNAME/spindate.git
cd spindate
```

Если репозиторий приватный, настройте SSH-ключ или токен (GitHub → Settings → Deploy keys или Personal access token).

### Вариант Б: загрузка архива по SCP/SFTP

На своём компьютере (в папке с проектом, **без** `node_modules` и `.next`):

```bash
tar --exclude='node_modules' --exclude='.next' --exclude='.git' -czvf spindate.tar.gz .
scp spindate.tar.gz root@ВАШ_IP:/var/www/
```

На сервере:

```bash
mkdir -p /var/www/spindate
cd /var/www/spindate
tar -xzvf /var/www/spindate.tar.gz -C /var/www/spindate
```

Убедитесь, что на сервере есть папка **`public/`** и в ней **`public/assets/`** (картинки бутылочек, рамок, эмоций). Без неё изображения в игре не будут грузиться.

---

## 5. Переменные окружения (опционально)

Если нужен свой URL приложения (для VK Mini App или ссылок):

```bash
cd /var/www/spindate
nano .env.local
```

Содержимое (подставьте свой домен):

```env
NEXT_PUBLIC_APP_URL=https://ваш-домен.ru
# Опционально, если используете VK Mini App:
# NEXT_PUBLIC_VK_APP_ID=12345678
```

На сервере при запуске через PM2 переменные из `.env.local` Next.js подхватывает сам при `next start`. Если нужно задать их в PM2 — см. раздел 7.

---

## 6. Сборка и первый запуск

```bash
cd /var/www/spindate

# Установка зависимостей (строго по lockfile)
npm ci

# Сборка приложения
npm run build
```

Проверка запуска вручную (порт можно задать через `PORT=3001`; для PM2 см. `ecosystem.config.cjs`):

```bash
npm start
```

По умолчанию `next start` слушает порт **3000**; для проверки откройте `http://ВАШ_IP:3000`. Если страница открывается — остановите процесс (Ctrl+C) и переходите к запуску через PM2 (в репозитории PM2 использует **3001** — см. `ecosystem.config.cjs`).

---

## 7. Запуск через PM2 и автозапуск при перезагрузке

Установка PM2 глобально и запуск приложения:

```bash
npm install -g pm2
cd /var/www/spindate
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Команда `pm2 startup` выведет команду вида `sudo env PATH=...` — её нужно выполнить, как указано в выводе.

Полезные команды PM2:

```bash
pm2 list          # список процессов
pm2 logs spindate # логи в реальном времени
pm2 restart spindate
pm2 stop spindate
```

В `ecosystem.config.cjs` по умолчанию **`PORT: 3001`**. Nginx должен проксировать на **тот же** порт.

---

## 8. Nginx как обратный прокси (рекомендуется)

Так можно раздавать приложение по 80/443 порту и позже включить HTTPS.

Установка Nginx:

```bash
apt install -y nginx
```

Создание конфига (подставьте свой домен или IP):

```bash
nano /etc/nginx/sites-available/spindate
```

Пример для домена (без SSL):

```nginx
server {
    listen 80;
    server_name ваш-домен.ru;
    location / {
        proxy_pass http://127.0.0.1:3001;
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

Если пока нет домена, замените `server_name ваш-домен.ru;` на `server_name _;` или укажите IP.

Включение конфига и перезагрузка Nginx:

```bash
ln -sf /etc/nginx/sites-available/spindate /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

После этого открывайте в браузере: `http://ваш-домен.ru` или `http://ВАШ_IP`.

---

## 9. HTTPS (Let's Encrypt)

Когда домен указывает на сервер (A-запись), можно получить бесплатный сертификат:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ваш-домен.ru
```

Следуйте подсказкам. Certbot сам настроит Nginx на 443 и редирект с HTTP. Обновление сертификата: `certbot renew` (обычно уже добавлен в cron).

---

## 10. Обновление приложения после изменений

Подключитесь по SSH и выполните в папке проекта:

```bash
cd /var/www/spindate
git pull
rm -rf .next
npm ci
npm run build
pm2 restart spindate
```

Или используйте скрипт из репозитория:

```bash
cd /var/www/spindate
bash deploy-on-server.sh
```

(В скрипте замените URL в последней строке на свой домен при необходимости.)

---

## Краткий чеклист

| Шаг | Действие |
|-----|----------|
| 1 | Обновить ОС |
| 2 | Установить Node.js 20 |
| 3 | Установить `build-essential`, `python3` |
| 4 | Клонировать/загрузить проект в `/var/www/spindate` |
| 5 | Убедиться, что есть папка `public/assets/` |
| 6 | (Опционально) Создать `.env.local` с `NEXT_PUBLIC_APP_URL` |
| 7 | `npm ci` → `npm run build` |
| 8 | `pm2 start ecosystem.config.cjs` → `pm2 save` → `pm2 startup` |
| 9 | Nginx: `proxy_pass` на порт из PM2 (в репозитории по умолчанию **3001**) |
| 10 | (По желанию) Запустить `certbot --nginx` для HTTPS |

После этого приложение доступно по вашему домену (или IP), картинки грузятся с `/assets/`, обновления делаются через `git pull` и пересборку с перезапуском PM2.
