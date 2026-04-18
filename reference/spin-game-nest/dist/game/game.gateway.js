"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var GameGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const spin_events_1 = require("./spin-events");
let GameGateway = GameGateway_1 = class GameGateway {
    log = new common_1.Logger(GameGateway_1.name);
    server;
    joinRoom(body, client) {
        void client.join(body.roomId);
        return { ok: true };
    }
    leaveRoom(body, client) {
        void client.leave(body.roomId);
        return { ok: true };
    }
    spinBottle(body, client) {
        this.log.debug(`spin_bottle room=${body.roomId} socket=${client.id}`);
        this.server.to(body.roomId).emit(spin_events_1.ServerEvents.spinResult, {
            roomId: body.roomId,
            spinnerUserId: "stub",
            targetUserId: "stub",
        });
        return { ok: true };
    }
    chat(body, client) {
        this.server.to(body.roomId).emit(spin_events_1.ServerEvents.chatMessage, {
            roomId: body.roomId,
            userId: client.id,
            username: "player",
            text: String(body.text).slice(0, 500),
            ts: Date.now(),
        });
        return { ok: true };
    }
};
exports.GameGateway = GameGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", Function)
], GameGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)(spin_events_1.ClientEvents.joinRoom),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "joinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(spin_events_1.ClientEvents.leaveRoom),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "leaveRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(spin_events_1.ClientEvents.spinBottle),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "spinBottle", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(spin_events_1.ClientEvents.chatMessage),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Function]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "chat", null);
exports.GameGateway = GameGateway = GameGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: true, credentials: true },
        transports: ["websocket"],
    })
], GameGateway);
//# sourceMappingURL=game.gateway.js.map