# Обновление приложения на сервере (spindate.lemnity.ru)

Если на сайте всё ещё старая версия после правок, сделай полное обновление на сервере.

**Важно:** На сервере обязательно должна быть папка **`public/`** (и в ней **`public/assets/`** с картинками: бутылочки, рамки, эмоции). Next.js отдаёт их по адресу `/assets/...`. Без этой папки картинки не грузятся (404). Каталог файлов и путей — [public/assets/README.md](../public/assets/README.md). При деплое копируй не только `.next` и `node_modules`, но и **`public`**.

## 1. Код должен быть на сервере

Если правишь код локально и деплоишь через **Git**:

**На своём компьютере:**
```bash
cd /Users/thesimakov/Documents/GitHub/spindate
git add -A
git commit -m "обновление"
git push
```

**На сервере:**
```bash
cd /var/www/spindate
git pull
```

Если заливаешь файлы по **FTP/SFTP** или копируешь вручную — убедись, что на сервер попали все изменённые файлы (в т.ч. из `components/`, `app/`, `lib/`).

---

## 2. Чистая пересборка и перезапуск на сервере

Подключись по SSH к серверу и выполни **по порядку**:

```bash
cd /var/www/spindate

# Удалить старую сборку (иначе Next может отдавать старый кеш)
rm -rf .next

# Установить зависимости
npm ci

# Собрать проект
npm run build

# Перезапустить приложение
pm2 restart spindate
```

Или одной командой (если в проекте есть скрипт):
```bash
cd /var/www/spindate && rm -rf .next && npm ci && npm run build && pm2 restart spindate
```

---

## 3. Проверить, что запущена нужная папка

Убедись, что PM2 запускает приложение из `/var/www/spindate`:

```bash
pm2 show spindate
```

В выводе смотри **Exec cwd** (рабочая директория) — должна быть `/var/www/spindate`. Если там другой путь, значит запущена старая копия. Тогда:

```bash
pm2 delete spindate
cd /var/www/spindate
pm2 start npm --name "spindate" -- start
pm2 save
```

---

## 4. Сбросить кеш в браузере

После деплоя открой сайт с обходом кеша:

- **Chrome/Edge:** Ctrl+Shift+R (Windows) или Cmd+Shift+R (Mac)
- Или открой в режиме **инкогнито**
- Или в DevTools (F12) → вкладка Network → включи **Disable cache** и обнови страницу

После этого должна открываться уже новая версия.
