"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({ origin: true, credentials: true });
    const port = Number(process.env.PORT ?? 4001);
    await app.listen(port);
    process.stdout.write(`[spin-game-nest] http://localhost:${port}  WebSocket: socket.io\n`);
}
void bootstrap();
//# sourceMappingURL=main.js.map