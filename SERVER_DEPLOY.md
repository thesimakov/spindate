# Развёртывание на сервере (VPS)

Краткий чеклист для запуска приложения на своём сервере (Ubuntu/Debian). Подробная пошаговая инструкция — в [ПОДКЛЮЧЕНИЕ_ПРОСТО.md](./ПОДКЛЮЧЕНИЕ_ПРОСТО.md).

## 1. Требования

- Node.js 18+
- Домен, направленный на IP сервера (A-запись)

## 2. Установка на сервере

```bash
# Перейти в каталог (или клонировать репозиторий)
cd /var/www/spindate   # или ваш путь

# Переменные окружения
echo 'NEXT_PUBLIC_VK_APP_ID=54483214' > .env.local
echo 'NEXT_PUBLIC_APP_URL=https://spindate.lemnity.ru' >> .env.local

# Сборка и запуск
npm ci
npm run build
npm start
```

Приложение будет слушать порт **3000**. Для проверки: `http://IP_СЕРВЕРА:3000`.

## 3. Постоянный запуск (PM2)

```bash
sudo npm install -g pm2
pm2 start npm --name "spindate" -- start
pm2 save
pm2 startup
# Выполнить команду, которую выведет pm2 startup
```

## 4. Nginx + HTTPS

Создайте конфиг `/etc/nginx/sites-available/spindate`:

```nginx
server {
    listen 80;
    server_name spindate.lemnity.ru;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Включите сайт и получите сертификат:

```bash
sudo ln -sf /etc/nginx/sites-available/spindate /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d spindate.lemnity.ru
```

## 5. Настройки ВКонтакте

В [Управление приложениями](https://vk.com/apps?act=manage) → ваше приложение → **Настройки** → **Адрес приложения**:  
`https://spindate.lemnity.ru` (без слеша в конце).

## 6. Важно

- Папка **data/** создаётся автоматически для SQLite (логин/сессии). На сервере она должна быть доступна на запись для процесса Node.
- После смены `.env.local` выполните `npm run build` и перезапустите приложение (`pm2 restart spindate`).
