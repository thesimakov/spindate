# NestJS — каркас WebSocket (Socket.io)

Альтернатива `reference/spin-game-stack` (Express). События совпадают с `lib/spin-game-events.ts`.

```bash
cd reference/spin-game-nest
npm install
npm run start:dev
```

По умолчанию порт **4001** (чтобы не конфликтовать с Express-стеком на 4000).

Дальше: перенести сервисы из `spin-game-stack/src/services`, добавить `AuthGuard` на `handshake.auth.token`, PrismaModule, RedisModule.
