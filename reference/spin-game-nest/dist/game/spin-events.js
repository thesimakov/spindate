"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerEvents = exports.ClientEvents = void 0;
exports.ClientEvents = {
    joinRoom: "join_room",
    leaveRoom: "leave_room",
    spinBottle: "spin_bottle",
    kissPlayer: "kiss_player",
    sendGift: "send_gift",
    chatMessage: "chat_message",
};
exports.ServerEvents = {
    roomState: "room_state",
    spinResult: "spin_result",
    kissResult: "kiss_result",
    giftSent: "gift_sent",
    chatMessage: "chat_message",
    secretKissNotification: "secret_kiss_notification",
    error: "error",
    missionProgress: "mission_progress",
};
//# sourceMappingURL=spin-events.js.map