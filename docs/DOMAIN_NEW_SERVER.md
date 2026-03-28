# Перепривязка домена к новому серверу

Пошагово: DNS → Nginx → HTTPS. Домен будет открываться на новом сервере (где уже запущен Spindate через PM2).

---

## 1. Узнать IP нового сервера

На новом сервере или в панели хостинга посмотри внешний IP. Например: **79.174.77.47**.

---

## 2. Прописать домен в DNS (у регистратора или в Cloudflare)

Зайди туда, где управляешь доменом (регистратор, Cloudflare, хостинг DNS).

**Нужно изменить A-запись** для твоего домена (или поддомена):

| Тип | Имя (Host) | Значение (Value)     | TTL  |
|-----|------------|----------------------|------|
| A   | @          | **IP_НОВОГО_СЕРВЕРА**| 300  |
| A   | www        | **IP_НОВОГО_СЕРВЕРА**| 300  |

- Если домен **spindate.lemnity.ru** — обычно это поддомен. Тогда создаёшь/меняешь A-запись для **spindate** (или оставляешь поле «Имя» как `spindate`), значение — IP нового сервера.
- Для корня домена **lemnity.ru** — запись с именем **@**.
- **www** — по желанию, можно тоже указать на тот же IP.

Сохрани изменения. Распространение DNS — от нескольких минут до 24–48 часов (часто 5–30 минут).

**Проверка с компа:**
```bash
ping spindate.lemnity.ru
```
Должен отвечать новый IP.

---

## 3. На новом сервере: установить Nginx (если ещё не стоит)

Подключись по SSH к **новому** серверу:

```bash
apt update
apt install -y nginx
```

---

## 4. Создать конфиг Nginx для домена

Подставь **свой домен** вместо `spindate.lemnity.ru`:

```bash
nano /etc/nginx/sites-available/spindate
```

Вставь (замени домен на свой):

```nginx
server {
    listen 80;
    server_name spindate.lemnity.ru;
    location / {
        # Порт как в ecosystem.config.cjs (сейчас по умолчанию 3001; если менял PORT — подставь свой)
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

Сохрани (Ctrl+O, Enter, Ctrl+X).

Включи конфиг и проверь:

```bash
ln -sf /etc/nginx/sites-available/spindate /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

После того как DNS обновится, сайт должен открываться по **http://spindate.lemnity.ru**.

---

## 5. Включить HTTPS (Let's Encrypt)

Когда A-запись уже указывает на новый сервер и сайт открывается по HTTP:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d spindate.lemnity.ru
```

Укажи email, согласись с условиями. Certbot сам настроит SSL и редирект с HTTP на HTTPS. Сертификат будет продлеваться автоматически.

Проверь: **https://spindate.lemnity.ru** должен открываться по HTTPS.

---

## 6. (Опционально) Переменная окружения с URL

Если в приложении используется свой URL (например для VK Mini App), на новом сервере в папке проекта создай или отредактируй `.env.local`:

```bash
cd /var/www/spindate
nano .env.local
```

Добавь (с твоим доменом и https):

```env
NEXT_PUBLIC_APP_URL=https://spindate.lemnity.ru
```

Сохрани. Если менял что-то в env, пересобери и перезапусти:

```bash
npm run build
pm2 restart spindate
```

---

## Краткий чеклист

| Шаг | Где | Действие |
|-----|-----|-----------|
| 1 | DNS | A-запись домена/поддомена → IP нового сервера |
| 2 | Комп | `ping` домена — виден новый IP |
| 3 | Сервер | `apt install nginx`, конфиг в sites-available |
| 4 | Сервер | `ln -s` в sites-enabled, `nginx -t`, `reload nginx` |
| 5 | Сервер | `certbot --nginx -d твой.домен` |
| 6 | Сервер | При необходимости: `.env.local` и `pm2 restart spindate` |

После этого домен полностью привязан к новому серверу с HTTP и HTTPS.
