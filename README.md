# Крути и знакомься — мини-приложение

Игра в бутылочку для знакомств во ВКонтакте (VK Mini App).

## Быстрый старт

```bash
npm install
cp .env.example .env.local   # при необходимости отредактируйте
npm run build
npm start
```

## Подключение к ВКонтакте

- **Пошагово для чайника:** [ПОШАГОВО_ЧАЙНИК.md](./ПОШАГОВО_ЧАЙНИК.md)
- **Простая инструкция:** [ПОДКЛЮЧЕНИЕ_ПРОСТО.md](./ПОДКЛЮЧЕНИЕ_ПРОСТО.md)
- **Краткая техническая:** [ПОДКЛЮЧЕНИЕ.md](./ПОДКЛЮЧЕНИЕ.md)
- **Публикация и оплаты:** [docs/VK_PUBLICATION.md](./docs/VK_PUBLICATION.md)

## Развёртывание на сервере

- **Несколько инстансов (Redis):** [docs/REDIS_MULTI_INSTANCE.md](./docs/REDIS_MULTI_INSTANCE.md) — задайте `REDIS_URL`, иначе состояние столов только в памяти одного процесса.
- **Краткий чеклист:** [SERVER_DEPLOY.md](./SERVER_DEPLOY.md)
- **С нуля (новый VPS):** [docs/DEPLOY_FROM_SCRATCH.md](./docs/DEPLOY_FROM_SCRATCH.md)
- **Перепривязка домена:** [docs/DOMAIN_NEW_SERVER.md](./docs/DOMAIN_NEW_SERVER.md)
- **Деплой с GitHub на сервер по SSH:** [docs/GITHUB_DEPLOY_SECRETS.md](./docs/GITHUB_DEPLOY_SECRETS.md)

## Картинки и ассеты

Все статические файлы (бутылочки, рамки, эмоции) — в **public/assets/**. Описание каталога и путей: [public/assets/README.md](./public/assets/README.md). В коде пути задаются в `lib/assets.ts` и используются через `assetUrl()`.

## Ссылки

- Домен (пример): **https://spindate.lemnity.ru**
- ID приложения VK: **54511363**

## Технологии

- Next.js 16, React 19
- VK Bridge — авторизация, оплаты, приглашение друзей
- Tailwind CSS
