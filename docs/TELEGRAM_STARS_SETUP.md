# Telegram Stars — настройка оплаты сердец

1. **BotFather**: создайте бота или используйте существующего; включите для него приём платежей (Stars), получите токен.
2. **Переменные окружения** (см. `.env.example`):
   - `TELEGRAM_PAYMENTS_BOT_TOKEN` — токен бота.
   - `TELEGRAM_PAYMENTS_WEBHOOK_SECRET` — случайная строка; её же передайте в `setWebhook` как `secret_token`.
3. **Webhook**: укажите URL `https://<ваш-домен>/api/telegram/stars/webhook` на тот же бот. Запросы должны доходить до Next.js (не обрезать тело).
4. **Клиент**: в Telegram Mini App доступен `Telegram.WebApp.openInvoice` — в магазине показывается блок «Telegram Stars», если обнаружен `window.Telegram.WebApp`.
5. **Начисление**: после `successful_payment` сервер добавляет сердца в `user_game_state` или `vk_user_game_state` в зависимости от сессии, создавшей счёт (`POST /api/telegram/stars/invoice`).

Курс и пакеты задаются в `lib/telegram-stars-pricing.ts`.
